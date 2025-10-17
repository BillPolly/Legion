"""
Content Extraction Agent
Fetches and extracts content from verified URLs
Uses LLM to summarize each page
"""

import logging
import aiohttp
import asyncio
from typing import List
from bs4 import BeautifulSoup
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, AIMessage

from state import ResearchState
from models import SearchResult
from security import sanitize_web_content

logger = logging.getLogger(__name__)


async def fetch_page_content(session, url: str) -> tuple[str, str, str]:
    """Fetch and extract text content from a URL, returns (url, text, html)"""
    try:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as response:
            if response.status != 200:
                return url, "", ""

            html = await response.text()
            soup = BeautifulSoup(html, 'html.parser')

            # Remove script and style elements
            for script in soup(["script", "style"]):
                script.decompose()

            # Get text
            text = soup.get_text()

            # Clean up whitespace
            lines = (line.strip() for line in text.splitlines())
            chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
            text = ' '.join(chunk for chunk in chunks if chunk)

            # Limit to first 3000 characters for summarization
            return url, text[:3000], html

    except Exception as e:
        logger.debug(f"Failed to fetch {url}: {e}")
        return url, "", ""


async def summarize_content(llm: ChatOpenAI, url: str, content: str, topic: str) -> dict:
    """Use LLM to summarize extracted content"""
    if not content:
        return {
            "url": url,
            "summary": "Content could not be extracted",
            "key_points": []
        }

    # Import prompt template
    from prompts import content_summarizer_prompt

    # Create messages from template
    messages = content_summarizer_prompt.format_messages(
        topic=topic,
        url=url,
        content=content
    )

    try:
        response = await llm.ainvoke(messages)
        summary_text = response.content

        return {
            "url": url,
            "summary": summary_text,
            "key_points": summary_text.split('\n')[:5]  # First 5 lines as key points
        }
    except Exception as e:
        logger.error(f"Summarization failed for {url}: {e}")
        return {
            "url": url,
            "summary": "Summarization failed",
            "key_points": []
        }


async def content_extractor_node(state: ResearchState) -> dict:
    """
    Fetch and summarize content from verified URLs
    """
    logger.info("� Extracting and summarizing content...")

    search_results = state.get('search_results')
    link_check_results = state.get('link_check_results')

    if not search_results or not link_check_results:
        return {
            "errors": ["Missing search results or link verification"],
            "current_step": "content_extraction_failed"
        }

    # Get valid URLs
    valid_urls = {r.url for r in link_check_results.results if r.is_valid}
    valid_sources = [r for r in search_results.results if r.url in valid_urls]

    if not valid_sources:
        return {
            "errors": ["No valid sources to extract content from"],
            "current_step": "content_extraction_failed"
        }

    logger.info(f"Extracting content from {len(valid_sources)} URLs...")

    # Fetch all page contents
    async with aiohttp.ClientSession() as session:
        tasks = [fetch_page_content(session, source.url) for source in valid_sources]
        contents = await asyncio.gather(*tasks)

    # Save HTML pages
    import os
    from datetime import datetime
    from urllib.parse import urlparse

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    html_dir = f'output/html_{timestamp}'
    os.makedirs(html_dir, exist_ok=True)

    # Summarize each page and save HTML
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.3)
    summaries = []

    for i, (url, content, html) in enumerate(contents):
        # Save HTML to file
        if html:
            parsed_url = urlparse(url)
            safe_filename = f"{i+1:02d}_{parsed_url.netloc.replace('.', '_')}.html"
            html_path = os.path.join(html_dir, safe_filename)
            with open(html_path, 'w', encoding='utf-8') as f:
                f.write(html)
            logger.info(f"Saved HTML: {html_path}")

        # Security: Check for prompt injection and wrap in delimiters
        is_safe, sanitized_content, reason = sanitize_web_content(url, content)

        if not is_safe:
            logger.warning(f"⚠️ Skipping {url}: {reason}")
            summaries.append({
                "url": url,
                "summary": f"Content skipped due to security concern: {reason}",
                "key_points": []
            })
            continue

        # Summarize content (sanitized_content is already wrapped in delimiters)
        summary = await summarize_content(llm, url, sanitized_content, state['topic'])
        summaries.append(summary)

    logger.info(f"✓ Extracted and summarized {len(summaries)} pages")

    # Add to conversation
    messages_to_add = [
        HumanMessage(content=f"Extract content from {len(valid_sources)} URLs", name="supervisor"),
        AIMessage(
            content=f"Extracted and summarized {len(summaries)} pages of content",
            name="content_extractor"
        )
    ]

    return {
        "page_summaries": summaries,
        "messages": messages_to_add,
        "current_step": "content_extraction_complete",
        "progress_percent": 80
    }
�