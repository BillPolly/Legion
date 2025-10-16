#!/usr/bin/env python3
"""
Test script to verify the research workflow executes without errors
"""

import asyncio
import sys
import os

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from main import create_workflow
from langchain_core.messages import HumanMessage
from models import AgentName


async def test_workflow():
    """Test the workflow execution with streaming"""
    print("Creating workflow...")
    app = create_workflow()

    print("Setting up initial state...")
    initial_state = {
        "topic": "AI agents",
        "messages": [
            HumanMessage(content="Research topic: AI agents", name="user")
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

    print("Starting workflow stream...")
    try:
        async for chunk in app.astream(initial_state, stream_mode=["custom", "updates"]):
            stream_mode, data = chunk

            if stream_mode == "custom":
                print(f"[CUSTOM] {data.get('type')}: {data.get('data', {})}")
            elif stream_mode == "updates":
                print(f"[UPDATE] {list(data.keys())}")

        print("\n✓ Workflow completed successfully!")

    except Exception as e:
        import traceback
        print(f"\n✗ Workflow failed: {e}")
        print(f"\nTraceback:\n{traceback.format_exc()}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(test_workflow())
