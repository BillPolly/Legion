"""
Analyst Agent
Generates research report using LLM with structured output
"""

import logging
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, AIMessage

from state import ResearchState
from models import ResearchReport

logger = logging.getLogger(__name__)


async def analyst_node(state: ResearchState) -> dict:
    """
    Generate final research report from verified sources
    """
    logger.info("📊 Generating research report...")

    search_results = state.get('search_results')
    link_check_results = state.get('link_check_results')

    if not search_results or not link_check_results:
        return {
            "errors": ["Missing search results or link verification"],
            "current_step": "analyst_failed"
        }

    # Filter to only valid links
    valid_urls = {r.url for r in link_check_results.results if r.is_valid}
    valid_sources = [r for r in search_results.results if r.url in valid_urls]

    if not valid_sources:
        return {
            "errors": ["No valid sources available for report"],
            "current_step": "analyst_failed"
        }

    logger.info(f"Generating report from {len(valid_sources)} verified sources")

    # Import prompt template
    from prompts import analyst_prompt

    # Prepare sources text
    sources_text = "\n\n".join([
        f"Source {i+1}:\nTitle: {s.title}\nURL: {s.url}\nSnippet: {s.snippet}"
        for i, s in enumerate(valid_sources)
    ])

    # Create messages from template
    messages = analyst_prompt.format_messages(
        topic=state['topic'],
        sources_text=sources_text
    )

    # Generate report with LLM
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.7)

    try:
        report_content = await llm.ainvoke(messages)
        content = report_content.content

        # Create structured report
        report = ResearchReport(
            title=f"Research Report: {state['topic']}",
            summary=content[:500] + "..." if len(content) > 500 else content,
            content=content,
            sources=[s.url for s in valid_sources],
            word_count=len(content.split())
        )

        logger.info(f"✓ Report generated: {report.word_count} words")

        # Add to conversation
        messages_to_add = [
            HumanMessage(content=f"Generate report from {len(valid_sources)} sources", name="supervisor"),
            AIMessage(
                content=f"Generated {report.word_count}-word report on: {state['topic']}",
                name="analyst"
            )
        ]

        return {
            "report": report,
            "messages": messages_to_add,
            "current_step": "report_complete",
            "progress_percent": 100
        }

    except Exception as e:
        logger.error(f"Report generation failed: {e}")
        return {
            "errors": [f"Report generation error: {str(e)}"],
            "current_step": "analyst_failed"
        }
