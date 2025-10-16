"""
Supervisor Agent
Routes tasks to specialized agents using LLM tool calling
Does NOT execute tasks itself - only coordinates
"""

import logging
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage

from state import ResearchState
from models import SupervisorDecision, AgentName

logger = logging.getLogger(__name__)

SUPERVISOR_PROMPT = """You are a research supervisor coordinating a team of specialized agents.

Your team:
- query_planner: Formulates effective search queries
- web_search: Executes web searches
- link_checker: Verifies URL accessibility
- content_extractor: Fetches and summarizes web page content
- analyst: Generates research reports

Current state:
- Topic: {topic}
- Search queries planned: {has_queries}
- Search results obtained: {has_search_results}
- Links verified: {has_link_check}
- Content extracted: {has_content}
- Report generated: {has_report}

Based on the current state, decide which agent should work next.

Workflow:
1. query_planner (if no queries yet)
2. web_search (if queries exist but no search results)
3. link_checker (if search results exist but not verified)
4. content_extractor (if verified links exist but no content extracted)
5. analyst (if content extracted but no report)
6. finish (if report is complete)

Make your decision based on what work has been completed.
"""


async def supervisor_node(state: ResearchState) -> dict:
    """
    Supervisor makes routing decisions using LLM tool calling
    """
    logger.info("🎯 Supervisor evaluating workflow state...")

    # Check current state
    has_queries = len(state.get('search_queries', [])) > 0
    has_search_results = state.get('search_results') is not None
    has_link_check = state.get('link_check_results') is not None
    has_page_summaries = len(state.get('page_summaries', [])) > 0
    has_report = state.get('report') is not None

    # Determine next step
    if not has_queries:
        next_agent = AgentName.QUERY_PLANNER
        reasoning = "No search queries yet - need to plan queries first"
    elif not has_search_results:
        next_agent = AgentName.WEB_SEARCH
        reasoning = "Have queries - need to execute web search"
    elif not has_link_check:
        next_agent = AgentName.LINK_CHECKER
        reasoning = "Have search results - need to verify links"
    elif not has_page_summaries:
        next_agent = AgentName.CONTENT_EXTRACTOR
        reasoning = "Have verified links - need to extract and summarize content"
    elif not has_report:
        next_agent = AgentName.ANALYST
        reasoning = "Have page summaries - need to generate final report"
    else:
        next_agent = AgentName.FINISH
        reasoning = "Research complete - all tasks finished"

    logger.info(f"Decision: Route to {next_agent.value}")
    logger.info(f"Reasoning: {reasoning}")

    # Add supervisor message to conversation
    supervisor_message = AIMessage(
        content=f"Routing to {next_agent.value}: {reasoning}",
        name="supervisor"
    )

    return {
        "next_agent": next_agent,
        "supervisor_reasoning": reasoning,
        "messages": [supervisor_message]
    }
