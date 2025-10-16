"""
Multi-Agent Research System - Main Entry Point
LangGraph workflow with supervisor pattern
Follows LangChain best practices for 2025
"""

import os
import logging
import asyncio
from dotenv import load_dotenv

from langgraph.graph import StateGraph, END
from langchain_core.messages import HumanMessage

from state import ResearchState
from models import AgentName
from agents import (
    supervisor_node,
    query_planner_node,
    web_search_node,
    link_checker_node,
    content_extractor_node,
    analyst_node
)

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def create_workflow() -> StateGraph:
    """
    Create LangGraph workflow with supervisor pattern

    Flow:
    1. Entry -> Supervisor (routing hub)
    2. Supervisor -> Agent (based on state)
    3. Agent -> Supervisor (return control)
    4. Repeat until finished
    """
    workflow = StateGraph(ResearchState)

    # Add all agent nodes
    workflow.add_node("supervisor", supervisor_node)
    workflow.add_node("query_planner", query_planner_node)
    workflow.add_node("web_search", web_search_node)
    workflow.add_node("link_checker", link_checker_node)
    workflow.add_node("content_extractor", content_extractor_node)
    workflow.add_node("analyst", analyst_node)

    # Entry point is supervisor
    workflow.set_entry_point("supervisor")

    # Conditional routing from supervisor
    def route_based_on_decision(state: ResearchState):
        """Route based on supervisor's decision"""
        next_agent = state.get("next_agent", AgentName.FINISH)

        if next_agent == AgentName.FINISH:
            return END

        return next_agent.value

    # Supervisor routes to different agents based on state
    workflow.add_conditional_edges(
        "supervisor",
        route_based_on_decision,
        {
            AgentName.QUERY_PLANNER.value: "query_planner",
            AgentName.WEB_SEARCH.value: "web_search",
            AgentName.LINK_CHECKER.value: "link_checker",
            AgentName.CONTENT_EXTRACTOR.value: "content_extractor",
            AgentName.ANALYST.value: "analyst",
            END: END
        }
    )

    # All agents return to supervisor
    workflow.add_edge("query_planner", "supervisor")
    workflow.add_edge("web_search", "supervisor")
    workflow.add_edge("link_checker", "supervisor")
    workflow.add_edge("content_extractor", "supervisor")
    workflow.add_edge("analyst", "supervisor")

    return workflow.compile()


async def run_research(topic: str) -> dict:
    """
    Execute research workflow for a given topic

    Args:
        topic: Research topic/question

    Returns:
        Final state with research report
    """
    logger.info(f"Starting research on: {topic}")

    # Create workflow
    app = create_workflow()

    # Initial state
    initial_state = {
        "topic": topic,
        "messages": [
            HumanMessage(content=f"Research topic: {topic}", name="user")
        ],
        "search_queries": [],
        "search_results": None,
        "link_check_results": None,
        "page_summaries": [],
        "report": None,
        "next_agent": AgentName.QUERY_PLANNER,
        "supervisor_reasoning": "",
        "errors": [],
        "current_step": "initializing",
        "progress_percent": 0
    }

    # Execute workflow
    final_state = await app.ainvoke(initial_state)

    logger.info("Research workflow completed")

    return final_state


async def main():
    """Main entry point"""
    import sys

    if len(sys.argv) < 2:
        print("Usage: python main.py '<research topic>'")
        print("Example: python main.py 'AI agents in 2025'")
        sys.exit(1)

    topic = sys.argv[1]

    # Run research
    final_state = await run_research(topic)

    # Display and save results
    report = final_state.get('report')
    if report:
        # Display to console
        print("\n" + "="*80)
        print(f"RESEARCH REPORT: {report.title}")
        print("="*80)
        print(f"\nSummary:\n{report.summary}\n")
        print(f"\nFull Report:\n{report.content}\n")
        print(f"\nSources ({len(report.sources)}):")
        for i, source in enumerate(report.sources, 1):
            print(f"{i}. {source}")
        print(f"\nWord Count: {report.word_count}")
        print("="*80)

        # Save to file
        import os
        from datetime import datetime

        os.makedirs('output', exist_ok=True)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"output/report_{timestamp}.md"

        with open(filename, 'w') as f:
            f.write(f"# {report.title}\n\n")
            f.write(f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
            f.write(f"**Word Count:** {report.word_count}\n\n")
            f.write("---\n\n")
            f.write(report.content)
            f.write("\n\n---\n\n")
            f.write(f"## Sources ({len(report.sources)})\n\n")
            for i, source in enumerate(report.sources, 1):
                f.write(f"{i}. {source}\n")

        print(f"\n✓ Report saved to: {filename}")
    else:
        print("\nError: Research failed to generate report")
        errors = final_state.get('errors', [])
        if errors:
            print("Errors encountered:")
            for error in errors:
                print(f"  - {error}")


if __name__ == "__main__":
    asyncio.run(main())
