"""
Link Checker Agent
Verifies URL accessibility with async batch processing
"""

import logging
import aiohttp
import asyncio
from langchain_core.messages import HumanMessage, AIMessage

from state import ResearchState
from models import LinkCheckResults, LinkCheckResult

logger = logging.getLogger(__name__)


async def check_url(session, url: str) -> LinkCheckResult:
    """Check if a single URL is accessible"""
    try:
        async with session.head(
            url,
            timeout=aiohttp.ClientTimeout(total=5),
            allow_redirects=True
        ) as response:
            return LinkCheckResult(
                url=url,
                is_valid=response.status < 400,
                status_code=response.status,
                error=None
            )
    except Exception as e:
        logger.debug(f"URL check failed for {url}: {e}")
        return LinkCheckResult(
            url=url,
            is_valid=False,
            status_code=None,
            error=str(e)
        )


async def link_checker_node(state: ResearchState) -> dict:
    """
    Verify all search result URLs
    """
    logger.info("� Checking links...")

    search_results = state.get('search_results')
    if not search_results or not search_results.results:
        return {
            "errors": ["No search results to check"],
            "current_step": "link_check_failed"
        }

    # Extract URLs
    urls = [result.url for result in search_results.results]
    logger.info(f"Checking {len(urls)} URLs...")

    # Check all URLs in parallel
    async with aiohttp.ClientSession() as session:
        tasks = [check_url(session, url) for url in urls]
        results = await asyncio.gather(*tasks)

    # Count valid/invalid
    valid = [r for r in results if r.is_valid]
    invalid = [r for r in results if not r.is_valid]

    link_check_results = LinkCheckResults(
        total_checked=len(results),
        valid_count=len(valid),
        invalid_count=len(invalid),
        results=results
    )

    logger.info(f"✓ {len(valid)}/{len(urls)} links valid")

    # Add to conversation
    messages_to_add = [
        HumanMessage(content=f"Verify {len(urls)} URLs", name="supervisor"),
        AIMessage(
            content=f"Checked {len(urls)} links: {len(valid)} valid, {len(invalid)} invalid",
            name="link_checker"
        )
    ]

    return {
        "link_check_results": link_check_results,
        "messages": messages_to_add,
        "current_step": "link_check_complete",
        "progress_percent": 70
    }
�