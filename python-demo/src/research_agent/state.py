"""
State management using LangGraph's MessagesState
Following LangChain best practices for state handling
"""

from typing import Annotated, List, Optional
from typing_extensions import TypedDict
from langgraph.graph import MessagesState
from langchain_core.messages import BaseMessage

from .models import (
    SearchQuery,
    SearchResults,
    LinkCheckResults,
    ResearchReport,
    AgentName
)


class ResearchState(MessagesState):
    """
    Shared state for the research workflow
    Inherits messages list from MessagesState for conversation history
    """

    # Research context
    topic: str
    """The research topic provided by the user"""

    # Query planning
    search_queries: Annotated[List[SearchQuery], "Generated search queries"] = []

    # Search results
    search_results: Optional[SearchResults] = None
    """Results from web search"""

    # Link verification
    link_check_results: Optional[LinkCheckResults] = None
    """Results from link checking"""

    # Content extraction
    page_summaries: Annotated[List[dict], "Summaries of extracted page content"] = []
    """LLM-generated summaries of web page content"""

    # Final report
    report: Optional[ResearchReport] = None
    """Final research report"""

    # Workflow control
    next_agent: AgentName = AgentName.QUERY_PLANNER
    """Which agent to execute next (decided by supervisor)"""

    supervisor_reasoning: str = ""
    """Supervisor's reasoning for routing decision"""

    # Error tracking
    errors: Annotated[List[str], "List of errors encountered"] = []

    # Progress tracking (for UI updates)
    current_step: str = "initializing"
    progress_percent: int = 0
