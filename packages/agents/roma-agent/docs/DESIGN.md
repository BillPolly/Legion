# ROMA-Agent Design Document

## Executive Summary

ROMA-Agent is a JavaScript implementation of the Recursive Open Meta-Agents framework that **maximally leverages existing Legion infrastructure**. Rather than reinventing capabilities, ROMA-Agent acts as an orchestration layer on top of Legion's proven components. It enables hierarchical task decomposition where complex problems are recursively broken down into atomic operations, executed in parallel when possible, and aggregated back up to solve the original problem. This creates a powerful problem-solving system that handles tasks of arbitrary complexity while maintaining complete transparency and **reusing all existing Legion patterns, tools, and services**.

## Core Concepts

### The ROMA Principle

ROMA operates on a simple recursive algorithm:
- If a task is atomic (can be executed directly), execute it
- If a task is complex, decompose it into subtasks
- Recursively apply this logic to each subtask
- Aggregate results back up the tree to solve the parent task

### MECE Framework

All tasks decompose into three Mutually Exclusive, Collectively Exhaustive operations:

**🤔 THINK** - Pure reasoning and analysis without external data or content creation
- Analyzing patterns in provided data
- Making decisions between options
- Evaluating quality or correctness
- Planning strategies
- Solving logical problems

**✍️ WRITE** - Content generation and synthesis
- Creating documents, code, or creative content
- Synthesizing information from multiple sources
- Formatting and structuring output
- Generating responses and explanations

**🔍 SEARCH** - Information retrieval from external sources
- Web searches for current information
- File system operations (reading files)
- API calls to external services
- Database queries
- Pattern matching in codebases

## Architecture

### Reuse of Legion Infrastructure

ROMA-Agent is built **entirely on existing Legion components**:

- **@legion/configurable-agent**: Base agent architecture and patterns
- **@legion/gemini-tools**: Complete tool suite for all operations
- **@legion/llm-client**: LLM interactions via SimplePromptClient
- **@legion/resource-manager**: Singleton configuration management
- **@legion/schema**: Input/output validation
- **@legion/tools-registry**: Dynamic tool discovery and invocation
- **Actor Framework**: Client-server communication patterns from gemini-agent
- **WebSocket Infrastructure**: Real-time updates using existing patterns

### Task Graph Structure

Every user request becomes a directed acyclic graph (DAG) of tasks:

```
Root Task (User Request)
    ├── Atomizer Node
    │   └── Plan Node
    │       ├── Subtask 1 (SEARCH)
    │       │   └── Execute Node
    │       ├── Subtask 2 (THINK)
    │       │   └── Execute Node
    │       ├── Subtask 3 (WRITE)
    │       │   └── Atomizer Node
    │       │       └── Plan Node
    │       │           ├── Subtask 3.1
    │       │           └── Subtask 3.2
    │       └── Aggregator Node
```

### Core Components

#### TaskNode
The fundamental data structure representing each node in the task graph:
- Unique identifier and type (ATOMIZER, PLAN, EXECUTE, AGGREGATE)
- Operation type (THINK, WRITE, SEARCH, or null for control nodes)
- Execution status tracking
- Parent-child relationships
- Sibling dependencies for ordered execution
- Context accumulation from ancestors and dependencies
- Result storage

#### ROMAOrchestrator
The central orchestration engine that **extends Legion's existing patterns**:
- **Extends ConfigurableAgent**: Inherits state management and lifecycle
- **Uses ResourceManager**: All configuration via singleton pattern
- **Leverages SimplePromptClient**: For all LLM interactions
- **Integrates ToolRegistry**: Dynamic tool discovery and execution
- Manages the entire task graph lifecycle
- Coordinates agent invocations
- Handles parallel execution of independent tasks
- Resolves dependencies between sibling tasks
- Manages recursion depth limits
- Provides real-time status updates via WebSocket (reusing gemini-agent patterns)

#### Agent System (Built on Legion Components)

**AtomizerAgent** (Uses @legion/llm-client)
- Evaluates task complexity using SimplePromptClient
- Decides between direct execution or planning
- Considers recursion depth and task characteristics
- Returns binary decision: EXECUTE or PLAN
- **Reuses**: PromptManager patterns from ConfigurableAgent

**PlannerAgent** (Uses @legion/llm-client + @legion/schema)
- Decomposes complex tasks into MECE subtasks
- Assigns operation types (THINK/WRITE/SEARCH)
- Identifies dependencies between subtasks
- Creates execution order based on information flow
- Generates clear subtask descriptions
- **Reuses**: ResponseValidator for structured output validation

**ExecutorAgents** (Uses @legion/gemini-tools)
- ThinkExecutor: Uses SimplePromptClient for reasoning
- WriteExecutor: Uses write_file, edit_file, smart_edit tools
- SearchExecutor: Uses web_search, web_fetch, grep_search, ripgrep_search tools
- **Reuses**: Complete GeminiToolsModule tool suite

**AggregatorAgent** (Uses @legion/llm-client)
- Synthesizes results from all subtasks using SimplePromptClient
- Produces coherent answer to parent task
- Handles different result types intelligently
- Maintains context relevance
- **Reuses**: SmartToolResultFormatter from gemini-agent

### Execution Flow

#### Three-Directional Information Flow

**Top-Down (Decomposition)**
- Tasks flow from abstract to concrete
- Context propagates to subtasks
- Constraints narrow with depth

**Bottom-Up (Aggregation)**
- Results flow from concrete to abstract
- Information synthesizes at each level
- Final answer emerges at root

**Left-to-Right (Dependencies)**
- Sibling tasks can depend on earlier siblings
- Results flow horizontally when needed
- Enables sequential information gathering

#### Parallel Execution

Independent subtasks execute simultaneously:
- Dependency resolver identifies parallelizable tasks
- Execution pool manages concurrent operations
- Results synchronize at aggregation points

#### Recursion Control

Configurable depth limits prevent infinite recursion:
- Default maximum depth of 3 levels
- Automatic conversion to atomic at max depth
- Depth tracking per branch of execution tree

## Integration with Legion Framework

### Complete Reuse Strategy

ROMA-Agent **does not create any new infrastructure** but instead orchestrates existing Legion components:

### Tool Mapping (100% @legion/gemini-tools)

ROMA operations map **directly to existing Legion tools without modification**:

**SEARCH Operations** (Existing tools from GeminiToolsModule)
- `web_search` - General web information retrieval
- `web_fetch` - Specific URL content extraction
- `read_file` - Local file system reading
- `grep_search` - Pattern matching in files
- `ripgrep_search` - Advanced code searching
- `glob_pattern` - File discovery
- `read_many_files` - Batch file reading

**WRITE Operations** (Existing tools from GeminiToolsModule)
- `write_file` - Create new files
- `edit_file` - Modify existing files
- `smart_edit` - Intelligent code modifications
- `save_memory` - Persist important information
- LLM generation via SimplePromptClient for non-file content

**THINK Operations** (Existing @legion/llm-client)
- SimplePromptClient for all reasoning
- PromptManager for prompt templates
- ResponseValidator for structured outputs

### ResourceManager Integration (100% Existing Pattern)

**Exactly follows Legion's singleton pattern from CLAUDE.md**:
```javascript
// ROMA-Agent uses the exact same pattern as all Legion components
const resourceManager = await ResourceManager.getInstance();
const llmClient = await resourceManager.get('simplePromptClient');
const toolRegistry = await resourceManager.get('toolRegistry');
```

### Actor Framework (Reuses gemini-agent patterns)

**Extends existing actor implementations**:

**ROMAServerActor** (extends GeminiRootServerActor)
- Inherits WebSocket handling
- Inherits message routing
- Adds task graph broadcasting
- Reuses connection management

**ROMAClientActor** (extends GeminiRootClientActor)
- Inherits UI framework
- Inherits WebSocket client
- Adds graph visualization components
- Reuses event handling

### WebSocket Communication (100% gemini-agent infrastructure)

**Uses exact same WebSocket patterns**:
- Message format from gemini-agent
- Connection handling from gemini-agent
- Error recovery patterns
- Real-time update mechanisms

## Data Flow

### Context Management (Uses Legion Patterns)

Context flows through the graph using **existing Legion components**:
- **AgentState** from ConfigurableAgent for state management
- **KnowledgeGraphInterface** for context persistence
- **CacheManager** from gemini-agent for result caching
- Context inheritance from parent tasks
- Context sharing between dependent siblings
- Context pruning using existing ValidationUtils

### Result Propagation (Legion Infrastructure)

Results flow efficiently using **existing formatters**:
- **SmartToolResultFormatter** from gemini-agent for tool results
- **ResponseValidator** from @legion/schema for validation
- Error propagation using **createAgentError** from ConfigurableAgent
- Partial results on timeout using existing patterns

### State Persistence (Legion Storage)

Task graphs persist using **existing Legion storage**:
- **KGStatePersistence** from ConfigurableAgent for graph storage
- **@legion/storage** for database operations if needed
- **CacheManager** for in-memory caching
- Execution trace logging via ResourceManager
- Result caching using existing cache infrastructure

## User Interface (Extends gemini-agent UI)

### Conversation Interface (Reuses gemini-agent components)

Natural language interaction using **existing UI components**:
- **Markdown rendering** from gemini-agent (markdown-it, highlight.js)
- **Chat interface** structure from GeminiRootClientActor
- System shows decomposition in real-time via WebSocket
- Progressive result display as tasks complete
- Final aggregated answer presentation using existing formatters

### Task Graph Visualization (New Component, Existing Framework)

Interactive graph display built on **Legion's actor framework**:
- Uses existing WebSocket infrastructure for updates
- Leverages existing message passing patterns
- Color-coded node status using CSS variables
- Expandable/collapsible branches via existing UI patterns
- Execution timeline using existing timing utilities
- Resource utilization from ResourceManager metrics

### Execution Trace (Uses Legion Logging)

Detailed debugging using **existing Legion infrastructure**:
- Complete prompt/response logging via ResourceManager
- Tool invocation details from ToolRegistry
- Timing information from existing performance monitoring
- Error messages using createAgentError patterns
- Context snapshots via KnowledgeGraphInterface

## Example Execution

### User Request
"Create a comprehensive market analysis for electric vehicles in Europe"

### Decomposition
```
1. SEARCH: Current EV market data for Europe
2. SEARCH: European EV regulations and policies  
3. SEARCH: Major EV manufacturers in Europe
4. THINK: Analyze market trends from data
5. THINK: Identify growth opportunities
6. WRITE: Executive summary
7. WRITE: Detailed analysis sections
8. WRITE: Recommendations and conclusions
9. AGGREGATE: Combine into final report
```

### Execution Characteristics
- Tasks 1-3 execute in parallel (no dependencies)
- Tasks 4-5 depend on search results
- Tasks 6-8 depend on analysis
- Aggregation produces cohesive report

## Configuration (Via ResourceManager)

### Agent Configuration
**Follows Legion's configuration pattern exactly**:
```javascript
// Configuration via ResourceManager singleton (per CLAUDE.md)
const resourceManager = await ResourceManager.getInstance();

// ROMA-specific configuration extends existing patterns
const config = {
  agent: {
    id: 'roma-agent',
    name: 'ROMA Agent',
    // Inherits all ConfigurableAgent config structure
    capabilities: ['recursive-decomposition', 'parallel-execution'],
    prompts: {
      // Uses PromptManager from ConfigurableAgent
      atomizer: await resourceManager.get('prompts.atomizer'),
      planner: await resourceManager.get('prompts.planner'),
      aggregator: await resourceManager.get('prompts.aggregator')
    }
  },
  roma: {
    maxDepth: 3,              // Maximum recursion depth
    parallelLimit: 5,         // Max parallel executions
    timeout: 30000,           // Task timeout in ms
    retryCount: 2,            // Retry failed tasks (uses RetryHelper from gemini-agent)
    cacheResults: true,       // Cache using CacheManager
    verboseLogging: false     // Via ResourceManager logging
  }
}
```

### Operation Weights (Configurable via PromptManager)
Preferences stored in prompt templates:
- Search preference for fact-based tasks
- Think preference for analytical tasks
- Write preference for creative tasks

## Error Handling (100% Legion Patterns)

### Graceful Degradation (Using Legion's ErrorHandling)
- **createAgentError** from ConfigurableAgent for all errors
- **ValidationUtils** from gemini-agent for input validation
- Failed subtasks handled by existing error patterns
- Partial results using existing result formatters
- User notification via WebSocket using existing patterns

### Retry Mechanisms (Uses RetryHelper)
- **RetryHelper** from gemini-agent for all retry logic
- Exponential backoff already implemented
- Circuit breaker patterns from existing infrastructure
- Manual retry through existing UI patterns

### Error Reporting (Legion Infrastructure)
- Error messages via createAgentError
- Logging through ResourceManager
- Error patterns from existing monitoring
- Remediation from existing error handlers

## Testing Strategy (Following Legion Standards)

### Unit Testing (Jest + Real Resources)
- **Jest framework** as per CLAUDE.md requirements
- **Real LLM** via ResourceManager (no mocks)
- **Real tools** from GeminiToolsModule
- Task node operations validation
- Dependency resolver correctness
- Context management using real KnowledgeGraphInterface

### Integration Testing (Legion Patterns)
- Full recursive workflows with **real LLM**
- Parallel execution with **real tools**
- Tool integration via **real ToolRegistry**
- Error propagation using **real error handlers**
- **100% pass rate requirement** per CLAUDE.md

### End-to-End Testing (Full Stack)
- Complete scenarios using **real ResourceManager**
- WebSocket using **real gemini-agent infrastructure**
- UI flows with **real actor framework**
- Performance using **real Legion metrics**

## Key Differences from Other Legion Agents

### vs Gemini-Agent
- **Recursive Architecture**: ROMA decomposes tasks recursively while Gemini processes linearly
- **MECE Operations**: All tasks categorized as THINK/WRITE/SEARCH vs arbitrary tool calls
- **Parallel Execution**: Independent subtasks run simultaneously vs sequential processing
- **Task Graph**: Complete visibility into problem decomposition vs conversation history

### vs Meta-Agent
- **Execution Focus**: ROMA executes tasks directly vs creating other agents
- **Recursive Depth**: Arbitrary depth decomposition vs single-level agent creation
- **Operation Types**: Fixed MECE operations vs dynamic capability discovery
- **Real-time Updates**: Progressive result display vs batch agent generation

### vs ConfigurableAgent
- **Problem Solving**: ROMA focuses on task decomposition vs general configuration
- **Specialization**: Purpose-built for hierarchical execution vs flexible architecture
- **Transparency**: Complete task graph visibility vs black-box processing
- **Scaling**: Handles arbitrary complexity through recursion vs fixed capabilities

## System Requirements

### Runtime Requirements (Standard Legion Stack)
- **Node.js 18+** with ES modules (per Legion requirements)
- **Legion framework** packages installed
- **MongoDB** via existing Legion connection
- **WebSocket** via existing gemini-agent infrastructure

### Resource Requirements (Managed by Legion)
- **Memory**: Managed by ResourceManager limits
- **CPU**: Thread pooling via existing patterns
- **Network**: Via existing HTTP/WebSocket infrastructure
- **Storage**: Via @legion/storage when needed

### Security Considerations (Legion Security Model)
- **Tool sandboxing** via existing Legion patterns
- **Rate limiting** via ResourceManager configuration
- **Input validation** via ValidationUtils and @legion/schema
- **WebSocket security** from gemini-agent
- **API keys** exclusively via ResourceManager singleton

## Implementation Philosophy

### Maximum Reuse Principle

ROMA-Agent demonstrates that **powerful new capabilities can be built entirely through orchestration** of existing Legion components. The implementation:

1. **Zero New Infrastructure**: No new base systems, all built on Legion
2. **100% Tool Reuse**: Every operation uses existing Legion tools
3. **Pattern Consistency**: Follows all Legion patterns exactly
4. **Configuration Unity**: Single ResourceManager for everything
5. **Testing Compliance**: Jest with real resources, no mocks

### What ROMA Adds

ROMA-Agent's **only new contribution** is the orchestration logic:
- **TaskNode**: Simple data structure for graph representation
- **ROMAOrchestrator**: Coordination logic for recursive execution
- **MECE Mapping**: Logic to map tasks to THINK/WRITE/SEARCH
- **Dependency Resolution**: Algorithm for task ordering
- **Graph Visualization**: UI component for task visibility

Everything else is **100% existing Legion infrastructure**.

---

This design document provides the complete technical specification for ROMA-Agent as an MVP implementation within the Legion framework. The architecture enables powerful recursive problem-solving while **maximizing reuse of existing Legion components** and maintaining Legion's clean patterns and fail-fast principles.