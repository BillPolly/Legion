"""
Web Search Agent
Executes web searches using Serper API with structured output and retries
"""

import os
import logging
import requests
from langchain_core.messages import HumanMessage, AIMessage

from state import ResearchState
from models import SearchResults, SearchResult

logger = logging.getLogger(__name__)


async def web_search_node(state: ResearchState) -> dict:
    """
    Execute web search using generated queries
    """
    logger.info("� Executing web search...")

    queries = state.get('search_queries', [])
    if not queries:
        return {
            "errors": ["No search queries available"],
            "current_step": "web_search_failed"
        }

    # Use first query
    query = queries[0]
    logger.info(f"Searching for: {query.query}")

    # Get Serper API key
    serper_key = os.getenv('SERPER_API_KEY')

    if not serper_key:
        raise RuntimeError("SERPER_API_KEY not found in environment variables")

    # Real Serper API call
    try:
        response = requests.post(
            "https://google.serper.dev/search",
            headers={
                "X-API-KEY": serper_key,
                "Content-Type": "application/json"
            },
            json={
                "q": query.query,
                "num": 10
            },
            timeout=10
        )
        response.raise_for_status()
        data = response.json()

        results = []
        for item in data.get('organic', []):
            results.append(SearchResult(
                title=item.get('title', ''),
                url=item.get('link', ''),
                snippet=item.get('snippet', ''),
                relevance_score=item.get('position', 10) / 10.0
            ))

        search_results = SearchResults(
            query=query.query,
            results=results,
            total_found=len(results)
        )

    except Exception as e:
        logger.error(f"Serper API error: {e}")
        raise RuntimeError(f"Web search failed: {str(e)}")

    logger.info(f"✓ Found {len(search_results.results)} results")

    # Add to conversation
    messages_to_add = [
        HumanMessage(content=f"Execute search for: {query.query}", name="supervisor"),
        AIMessage(
            content=f"Found {len(search_results.results)} results for query: {query.query}",
            name="web_search"
        )
    ]

    return {
        "search_results": search_results,
        "messages": messages_to_add,
        "current_step": "web_search_complete",
        "progress_percent": 40
    }
�