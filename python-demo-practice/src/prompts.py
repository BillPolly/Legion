"""
Prompt templates following LangChain best practices
All prompts use ChatPromptTemplate for consistency and testability
"""

from langchain_core.prompts import ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate


# Query Planner Prompts
QUERY_PLANNER_SYSTEM = """You are an expert research query planner. Your job is to generate effective web search queries.

Consider:
- Specific keywords that will find authoritative sources
- Current year context (2025) for recent information
- Multiple aspects of the topic for comprehensive coverage
- Avoiding overly broad or narrow queries"""

QUERY_PLANNER_HUMAN = """Research Topic: {topic}

Generate an optimized search query that will find the most relevant and authoritative sources for this research topic.

Focus on: {focus}
Expected number of sources: {expected_sources}"""

query_planner_prompt = ChatPromptTemplate.from_messages([
    SystemMessagePromptTemplate.from_template(QUERY_PLANNER_SYSTEM),
    HumanMessagePromptTemplate.from_template(QUERY_PLANNER_HUMAN)
])


# Content Summarization Prompts
CONTENT_SUMMARIZER_SYSTEM = """You are an expert content analyst. Your job is to extract key information relevant to a specific research topic.

Provide:
1. A 2-3 sentence summary focusing on relevance to the research topic
2. 3-5 key points that directly relate to the research question

Be concise and focus only on information relevant to the research topic."""

CONTENT_SUMMARIZER_HUMAN = """Research Topic: "{topic}"

URL: {url}

Content:
{content}

Analyze this content and provide a summary with key points relevant to the research topic."""

content_summarizer_prompt = ChatPromptTemplate.from_messages([
    SystemMessagePromptTemplate.from_template(CONTENT_SUMMARIZER_SYSTEM),
    HumanMessagePromptTemplate.from_template(CONTENT_SUMMARIZER_HUMAN)
])


# Analyst Report Generation Prompts
ANALYST_SYSTEM = """You are an expert research analyst. Your job is to synthesize information from multiple verified sources into a comprehensive research report.

Create a well-structured markdown report with:
1. Executive Summary - High-level overview (2-3 paragraphs)
2. Key Findings - Bulleted list of main discoveries
3. Detailed Analysis - In-depth discussion with subsections
4. Sources - Numbered list with clickable markdown links

Make it informative, professional, and well-organized."""

ANALYST_HUMAN = """Research Topic: "{topic}"

Verified Sources and Summaries:
{sources_text}

Generate a comprehensive research report in markdown format."""

analyst_prompt = ChatPromptTemplate.from_messages([
    SystemMessagePromptTemplate.from_template(ANALYST_SYSTEM),
    HumanMessagePromptTemplate.from_template(ANALYST_HUMAN)
])
