"""
Pydantic models for structured input/output
Following LangChain best practices for type safety
"""

from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Literal
from enum import Enum


class AgentName(str, Enum):
    """Valid agent names for routing"""
    QUERY_PLANNER = "query_planner"
    WEB_SEARCH = "web_search"
    LINK_CHECKER = "link_checker"
    CONTENT_EXTRACTOR = "content_extractor"
    ANALYST = "analyst"
    FINISH = "finish"


class SearchQuery(BaseModel):
    """Structured search query from Query Planner"""
    query: str = Field(description="Optimized search query for web search")
    focus: str = Field(description="Specific research focus area")
    expected_sources: int = Field(default=5, description="Expected number of relevant sources")

    @field_validator('query')
    @classmethod
    def query_not_empty(cls, v):
        if not v or len(v.strip()) < 3:
            raise ValueError("Query must be at least 3 characters")
        return v.strip()


class SearchResult(BaseModel):
    """Single search result from web search"""
    title: str = Field(description="Title of the search result")
    url: str = Field(description="URL of the source")
    snippet: str = Field(description="Text snippet from the source")
    relevance_score: Optional[float] = Field(default=None, description="Relevance score 0-1")

    @field_validator('url')
    @classmethod
    def url_valid(cls, v):
        if not v.startswith('http'):
            raise ValueError("URL must start with http or https")
        return v


class SearchResults(BaseModel):
    """Collection of search results"""
    query: str = Field(description="The search query used")
    results: List[SearchResult] = Field(description="List of search results")
    total_found: int = Field(description="Total number of results found")


class LinkCheckResult(BaseModel):
    """Result of checking a single URL"""
    url: str
    is_valid: bool = Field(description="Whether the URL is accessible")
    status_code: Optional[int] = Field(default=None, description="HTTP status code")
    error: Optional[str] = Field(default=None, description="Error message if check failed")


class LinkCheckResults(BaseModel):
    """Collection of link check results"""
    total_checked: int
    valid_count: int
    invalid_count: int
    results: List[LinkCheckResult]


class ResearchReport(BaseModel):
    """Final research report from Analyst"""
    title: str = Field(description="Report title")
    summary: str = Field(description="Executive summary")
    content: str = Field(description="Full markdown content")
    sources: List[str] = Field(description="List of verified source URLs")
    word_count: int = Field(description="Total word count")

    @field_validator('content')
    @classmethod
    def content_not_empty(cls, v):
        if not v or len(v.strip()) < 100:
            raise ValueError("Report content must be at least 100 characters")
        return v


class SupervisorDecision(BaseModel):
    """Supervisor routing decision"""
    next_agent: AgentName = Field(description="Which agent to route to next")
    reasoning: str = Field(description="Why this agent was chosen")
    message_to_agent: Optional[str] = Field(default=None, description="Instructions for the agent")


class AgentStatus(str, Enum):
    """Agent execution status"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"


class AgentResult(BaseModel):
    """Generic agent execution result"""
    agent_name: str
    status: AgentStatus
    data: dict = Field(default_factory=dict)
    error: Optional[str] = None
    timestamp: Optional[str] = None
"""
Pydantic models for structured input/output
Following LangChain best practices for type safety
"""

from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Literal
from enum import Enum


class AgentName(str, Enum):
    """Valid agent names for routing"""
    QUERY_PLANNER = "query_planner"
    WEB_SEARCH = "web_search"
    LINK_CHECKER = "link_checker"
    CONTENT_EXTRACTOR = "content_extractor"
    ANALYST = "analyst"
    FINISH = "finish"


class SearchQuery(BaseModel):
    """Structured search query from Query Planner"""
    query: str = Field(description="Optimized search query for web search")
    focus: str = Field(description="Specific research focus area")
    expected_sources: int = Field(default=5, description="Expected number of relevant sources")

    @field_validator('query')
    @classmethod
    def query_not_empty(cls, v):
        if not v or len(v.strip()) < 3:
            raise ValueError("Query must be at least 3 characters")
        return v.strip()


class SearchResult(BaseModel):
    """Single search result from web search"""
    title: str = Field(description="Title of the search result")
    url: str = Field(description="URL of the source")
    snippet: str = Field(description="Text snippet from the source")
    relevance_score: Optional[float] = Field(default=None, description="Relevance score 0-1")

    @field_validator('url')
    @classmethod
    def url_valid(cls, v):
        if not v.startswith('http'):
            raise ValueError("URL must start with http or https")
        return v


class SearchResults(BaseModel):
    """Collection of search results"""
    query: str = Field(description="The search query used")
    results: List[SearchResult] = Field(description="List of search results")
    total_found: int = Field(description="Total number of results found")


class LinkCheckResult(BaseModel):
    """Result of checking a single URL"""
    url: str
    is_valid: bool = Field(description="Whether the URL is accessible")
    status_code: Optional[int] = Field(default=None, description="HTTP status code")
    error: Optional[str] = Field(default=None, description="Error message if check failed")


class LinkCheckResults(BaseModel):
    """Collection of link check results"""
    total_checked: int
    valid_count: int
    invalid_count: int
    results: List[LinkCheckResult]


class ResearchReport(BaseModel):
    """Final research report from Analyst"""
    title: str = Field(description="Report title")
    summary: str = Field(description="Executive summary")
    content: str = Field(description="Full markdown content")
    sources: List[str] = Field(description="List of verified source URLs")
    word_count: int = Field(description="Total word count")

    @field_validator('content')
    @classmethod
    def content_not_empty(cls, v):
        if not v or len(v.strip()) < 100:
            raise ValueError("Report content must be at least 100 characters")
        return v


class SupervisorDecision(BaseModel):
    """Supervisor routing decision"""
    next_agent: AgentName = Field(description="Which agent to route to next")
    reasoning: str = Field(description="Why this agent was chosen")
    message_to_agent: Optional[str] = Field(default=None, description="Instructions for the agent")


class AgentStatus(str, Enum):
    """Agent execution status"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"


class AgentResult(BaseModel):
    """Generic agent execution result"""
    agent_name: str
    status: AgentStatus
    data: dict = Field(default_factory=dict)
    error: Optional[str] = None
    timestamp: Optional[str] = None
