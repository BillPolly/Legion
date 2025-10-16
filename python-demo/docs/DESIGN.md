# Multi-Agent Research System - Design Document
## LangChain/LangGraph Best Practices Implementation

## Architecture Pattern: Supervisor Architecture

Based on LangChain best practices, we use the **Supervisor Architecture** where:
- A central supervisor agent coordinates all specialized agents
- Supervisor makes routing decisions and manages conversation flow
- Specialized agents don't communicate directly with each other
- Each agent has a focused responsibility (single-concern principle)

## Agent Roles & Responsibilities

### 1. Supervisor Agent (Orchestrator)
**Responsibility**: Route tasks, maintain conversation memory, make decisions
**Does NOT**: Execute searches, check links, or write reports
**Tools**:
- `route_to_search` - Delegate to search agent
- `route_to_link_checker` - Delegate to link checker
- `route_to_analyst` - Delegate to analyst
- `finish` - Complete workflow

**Key Features**:
- Uses LangChain's `ChatOpenAI` with structured output
- Maintains shared state via LangGraph's `MessagesState`
- Uses tool calling to make routing decisions
- Has access to full conversation history for context

### 2. Query Planner Agent
**Responsibility**: Formulate effective search queries from research topic
**Tools**:
- `create_search_query` - Generate optimized search query

**Key Features**:
- Uses LLM with structured output (Pydantic model)
- Generates multiple query variations for comprehensive research
- Returns structured SearchQuery objects

### 3. Web Search Agent
**Responsibility**: Execute web searches using generated queries
**Tools**:
- `serper_search` - Call Serper API

**Key Features**:
- Accepts SearchQuery objects (structured input)
- Returns structured SearchResult objects
- Uses automatic retry with exponential backoff (LangChain built-in)
- Validates API responses

### 4. Link Checker Agent
**Responsibility**: Verify URL accessibility
**Tools**:
- `check_url` - Validate single URL

**Key Features**:
- Batch processes URLs asynchronously
- Returns structured LinkCheckResult objects
- Uses timeout and retry logic
- Filters to only valid links

### 5. Analyst Agent
**Responsibility**: Generate research report from verified sources
**Tools**:
- `generate_report` - Create markdown report

**Key Features**:
- Uses LLM with structured output for report generation
- Accesses full conversation history for context
- Outputs well-formatted markdown with citations

## State Management (LangGraph Best Practices)

### Shared State Schema
```python
from typing import TypedDict, List, Annotated
from langgraph.graph import MessagesState
from langchain_core.messages import BaseMessage

class ResearchState(MessagesState):
    # Conversation history (inherited from MessagesState)
    messages: Annotated[List[BaseMessage], "Conversation history"]

    # Research context
    topic: str
    queries: List[str]
    search_results: List[dict]
    verified_links: List[dict]
    report: str

    # Workflow control
    next_agent: str
    errors: List[str]
```

### Memory Strategy
- **Buffer Memory**: Use `MessagesState` for conversation history
- **Structured State**: Store intermediate results in typed fields
- **No Vector Memory**: Research is short-lived, no need for vector DB

## Structured Output (Best Practices)

### Use Pydantic Models for ALL Tool Outputs
```python
from pydantic import BaseModel, Field

class SearchQuery(BaseModel):
    query: str = Field(description="Optimized search query")
    focus: str = Field(description="Research focus area")

class SearchResult(BaseModel):
    title: str
    url: str
    snippet: str
    relevance_score: float

class LinkCheckResult(BaseModel):
    url: str
    is_valid: bool
    status_code: int | None
    error: str | None

class ResearchReport(BaseModel):
    title: str
    summary: str
    content: str  # Markdown formatted
    sources: List[str]
```

### Tool Calling with Structured Output
```python
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(model="gpt-4")
structured_llm = llm.with_structured_output(SearchQuery)
```

## Retry & Error Handling (Built-in LangChain)

### Automatic Retry Pattern
```python
from langchain_core.runnables import RunnableRetry

# Wrap tools with retry logic
search_tool_with_retry = RunnableRetry(
    search_tool,
    max_attempts=3,
    wait_exponential_jitter=True
)
```

### Validation & Re-prompting
```python
# If tool call fails validation:
# 1. LangChain automatically formats error as ToolMessage
# 2. Re-prompts LLM with error context
# 3. LLM tries again with corrected input
```

## Observability with LangSmith

### Setup
```python
import os

# Enable LangSmith tracing
os.environ["LANGCHAIN_TRACING_V2"] = "true"
os.environ["LANGCHAIN_API_KEY"] = "your-key"
os.environ["LANGCHAIN_PROJECT"] = "multi-agent-research"
```

### What Gets Tracked
- **All LLM calls** with prompts, responses, tokens, latency
- **Tool usage** - which tools are called, success/failure rates
- **Agent routing** - supervisor decisions and paths taken
- **Retry attempts** - when and why retries occur
- **Error rates** - by agent and tool

### Key Metrics to Monitor
- Token usage per agent
- Tool call success rates
- Average latency per agent
- Most common error types
- Supervisor routing patterns

## LangGraph Workflow Structure

```python
from langgraph.graph import StateGraph, END

# Create graph
workflow = StateGraph(ResearchState)

# Add nodes (agents)
workflow.add_node("supervisor", supervisor_node)
workflow.add_node("query_planner", query_planner_node)
workflow.add_node("web_search", web_search_node)
workflow.add_node("link_checker", link_checker_node)
workflow.add_node("analyst", analyst_node)

# Conditional routing from supervisor
workflow.add_conditional_edges(
    "supervisor",
    route_based_on_decision,  # Function that reads state.next_agent
    {
        "query_planner": "query_planner",
        "web_search": "web_search",
        "link_checker": "link_checker",
        "analyst": "analyst",
        "finish": END
    }
)

# Always return to supervisor after agent execution
workflow.add_edge("query_planner", "supervisor")
workflow.add_edge("web_search", "supervisor")
workflow.add_edge("link_checker", "supervisor")
workflow.add_edge("analyst", "supervisor")

# Set entry point
workflow.set_entry_point("supervisor")

# Compile
app = workflow.compile()
```

## Context Engineering Best Practices

### 1. De-clutter Sub-Agent Context
- Remove supervisor routing messages from sub-agent state
- Each agent only sees relevant conversation history
- Use `forward_message` tool for supervisor to pass results without re-generation

### 2. Agent Name Tagging
```python
from langchain_core.messages import AIMessage

message = AIMessage(
    content="Search results found",
    name="web_search_agent"  # Tag messages with agent name
)
```

### 3. Focused Tool Sets
- Each agent only has access to its specific tools
- Prevents confusion and hallucinated tool calls
- Improves reliability

## Tool Usage Policies

### Limit Tool Calls
```python
# In supervisor prompt:
"Only delegate to search agent if:
1. No relevant information exists in conversation history
2. User explicitly requests new search
3. Topic is significantly different from previous searches"
```

### Tool Validation
```python
from pydantic import validator

class SearchQuery(BaseModel):
    query: str

    @validator('query')
    def query_not_empty(cls, v):
        if not v or len(v) < 3:
            raise ValueError("Query must be at least 3 characters")
        return v
```

## Integration Points

### WebSocket Broadcasting
- Emit events after each agent completes
- Use structured message format:
```python
{
    "type": "agent_update",
    "agent": "web_search",
    "status": "complete",
    "data": {...}  # Structured output
}
```

### VSCode Flashcards
- Supervisor triggers flashcards before routing
- Message format:
```python
{
    "title": "Step 2: Web Search",
    "subtitle": f"Searching for: {query}"
}
```

## Performance Optimization

### Parallel Execution (Future Enhancement)
LangGraph supports parallel execution where independent tasks can run concurrently:
```python
# Multiple searches in parallel
workflow.add_node("parallel_search", [search_1, search_2, search_3])
```

### Caching (LangChain Built-in)
```python
from langchain.cache import InMemoryCache
from langchain.globals import set_llm_cache

set_llm_cache(InMemoryCache())  # Cache repeated prompts
```

## Key Takeaways

1. **Supervisor doesn't execute** - only routes and maintains memory
2. **Structured output everywhere** - All tool outputs use Pydantic models
3. **Automatic retries** - Use LangChain's built-in retry mechanisms
4. **LangSmith observability** - Track everything with one env variable
5. **Clean context** - Each agent sees only what it needs
6. **Focused agents** - One responsibility, minimal tool set
7. **MessagesState** - Built-in conversation memory and history
8. **Tool calling** - Use LLM function calling for all decisions
9. **Validation** - Pydantic models validate all inputs/outputs
10. **No hidden prompts** - Full control over context engineering
