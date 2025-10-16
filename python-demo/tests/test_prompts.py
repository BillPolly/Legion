"""
Test prompt templates
"""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from research_agent.prompts import (
    query_planner_prompt,
    content_summarizer_prompt,
    analyst_prompt
)


def test_query_planner_prompt_format():
    """Test query planner prompt formatting"""
    messages = query_planner_prompt.format_messages(
        topic="AI agents",
        focus="recent developments",
        expected_sources=5
    )
    assert len(messages) == 2  # System + Human
    assert "AI agents" in str(messages)
    assert "recent developments" in str(messages)


def test_content_summarizer_prompt_format():
    """Test content summarizer prompt formatting"""
    messages = content_summarizer_prompt.format_messages(
        topic="machine learning",
        url="https://example.com",
        content="Test content about ML"
    )
    assert len(messages) == 2
    assert "machine learning" in str(messages)
    assert "example.com" in str(messages)


def test_analyst_prompt_format():
    """Test analyst prompt formatting"""
    sources = "Source 1: Test\nSource 2: Test2"
    messages = analyst_prompt.format_messages(
        topic="quantum computing",
        sources_text=sources
    )
    assert len(messages) == 2
    assert "quantum computing" in str(messages)
    assert "Source 1" in str(messages)
