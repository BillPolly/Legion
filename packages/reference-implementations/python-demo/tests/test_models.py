"""
Test Pydantic models
"""

import pytest
from pydantic import ValidationError
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from models import (
    SearchQuery,
    SearchResult,
    SearchResults,
    LinkCheckResult,
    LinkCheckResults,
    ResearchReport,
    AgentName
)


def test_search_query_valid():
    """Test valid SearchQuery creation"""
    query = SearchQuery(
        query="AI agents 2025",
        focus="recent developments",
        expected_sources=5
    )
    assert query.query == "AI agents 2025"
    assert query.focus == "recent developments"
    assert query.expected_sources == 5


def test_search_query_empty_fails():
    """Test that empty query fails validation"""
    with pytest.raises(ValidationError):
        SearchQuery(query="", focus="test")


def test_search_result_valid():
    """Test valid SearchResult creation"""
    result = SearchResult(
        title="Test Article",
        url="https://example.com/article",
        snippet="This is a test snippet",
        relevance_score=0.95
    )
    assert result.title == "Test Article"
    assert result.url == "https://example.com/article"


def test_search_result_invalid_url():
    """Test that invalid URL fails validation"""
    with pytest.raises(ValidationError):
        SearchResult(
            title="Test",
            url="not-a-url",
            snippet="Test"
        )


def test_link_check_result():
    """Test LinkCheckResult creation"""
    result = LinkCheckResult(
        url="https://example.com",
        is_valid=True,
        status_code=200
    )
    assert result.is_valid is True
    assert result.status_code == 200


def test_research_report_valid():
    """Test valid ResearchReport creation"""
    report = ResearchReport(
        title="Test Report",
        summary="This is a summary",
        content="This is content that is long enough to pass validation because it needs at least 100 characters to be valid according to the model constraints",
        sources=["https://example.com"],
        word_count=150
    )
    assert report.title == "Test Report"
    assert report.word_count == 150


def test_research_report_too_short_fails():
    """Test that report with content too short fails validation"""
    with pytest.raises(ValidationError):
        ResearchReport(
            title="Test",
            summary="Summary",
            content="Too short",
            sources=[],
            word_count=2
        )


def test_agent_name_enum():
    """Test AgentName enum values"""
    assert AgentName.QUERY_PLANNER == "query_planner"
    assert AgentName.WEB_SEARCH == "web_search"
    assert AgentName.LINK_CHECKER == "link_checker"
    assert AgentName.CONTENT_EXTRACTOR == "content_extractor"
    assert AgentName.ANALYST == "analyst"
    assert AgentName.FINISH == "finish"
