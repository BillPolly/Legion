"""
Query Planner Agent
Uses LLM to formulate effective search queries from research topic
Following LangChain best practices with structured output
"""

import logging
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, AIMessage

from state import ResearchState
from models import SearchQuery

logger = logging.getLogger(__name__)


async def query_planner_node(state: ResearchState) -> dict:
    """
    Generate optimized search queries using LLM with structured output
    """
    logger.info("📝 Planning search queries...")

    # Import prompt template
    from prompts import query_planner_prompt

    # Get LLM with structured output
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.7)
    structured_llm = llm.with_structured_output(SearchQuery)

    # Create prompt from template
    messages = query_planner_prompt.format_messages(
        topic=state['topic'],
        focus="comprehensive research with authoritative sources",
        expected_sources=5
    )

    # Generate query with structured output
    try:
        search_query = await structured_llm.ainvoke(messages)

        logger.info(f"✓ Generated query: {search_query.query}")

        # Add to conversation history
        messages_to_add = [
            HumanMessage(content=f"Plan search queries for: {state['topic']}", name="user"),
            AIMessage(content=f"Generated query: {search_query.query}\\nFocus: {search_query.focus}", name="query_planner")
        ]

        return {
            "search_queries": [search_query],
            "messages": messages_to_add,
            "current_step": "query_planning_complete",
            "progress_percent": 20
        }

    except Exception as e:
        logger.error(f"Query planning failed: {e}")
        return {
            "errors": [f"Query planning error: {str(e)}"],
            "current_step": "query_planning_failed"
        }
