#!/usr/bin/env python3
"""
Full integration test simulating the web app workflow
"""

import asyncio
import sys
import os
import json

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from research_agent.main import create_workflow
from langchain_core.messages import HumanMessage
from research_agent.models import AgentName


async def test_full_workflow():
    """Test the complete workflow as it runs in web_app.py"""
    print("=" * 60)
    print("FULL WORKFLOW TEST")
    print("=" * 60)

    try:
        # Create workflow
        print("\n1. Creating workflow...")
        app = create_workflow()
        print("   ✓ Workflow created")

        # Initial state (same as web_app.py)
        print("\n2. Setting up initial state...")
        initial_state = {
            "topic": "Python async programming",
            "messages": [
                HumanMessage(content="Research topic: Python async programming", name="user")
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
        print("   ✓ Initial state ready")

        # Stream workflow (same as web_app.py)
        print("\n3. Executing workflow with streaming...")
        progress_map = {
            "query_planner": 20,
            "web_search": 40,
            "link_checker": 60,
            "content_extractor": 80,
            "analyst": 100
        }

        final_report = None

        async for chunk in app.astream(initial_state, stream_mode=["updates"]):
            # chunk is a tuple: (stream_mode, data)
            if isinstance(chunk, tuple):
                stream_mode, data = chunk
            else:
                data = chunk

            node_name = list(data.keys())[0] if data else None
            node_data = data.get(node_name, {}) if node_name else {}

            if node_name:
                progress = progress_map.get(node_name, 0)
                print(f"   [{progress:3d}%] {node_name}")

                # Simulate WebSocket message
                message = {
                    "type": "progress",
                    "data": {
                        "agent": node_name,
                        "progress": progress
                    }
                }

                # Check for final report
                if node_name == "analyst" and node_data.get("report"):
                    report = node_data["report"]
                    final_report = {
                        "type": "complete",
                        "data": {
                            "title": report.title,
                            "summary": report.summary,
                            "content": report.content,
                            "sources": report.sources,
                            "word_count": report.word_count
                        }
                    }
                    print(f"\n   📊 Report generated: {report.word_count} words")
                    print(f"   📝 Sources: {len(report.sources)}")

        print("\n4. Workflow completed successfully!")

        if final_report:
            print("\n" + "=" * 60)
            print("FINAL REPORT")
            print("=" * 60)
            print(f"Title: {final_report['data']['title']}")
            print(f"Word Count: {final_report['data']['word_count']}")
            print(f"Sources: {len(final_report['data']['sources'])}")
            print(f"\nSummary:\n{final_report['data']['summary']}")
            print("\nFirst 3 sources:")
            for i, source in enumerate(final_report['data']['sources'][:3], 1):
                print(f"  {i}. {source}")
            print("=" * 60)
            print("\n✅ TEST PASSED - Workflow works exactly as in web app!")
            return 0
        else:
            print("\n❌ TEST FAILED - No report generated")
            return 1

    except Exception as e:
        import traceback
        print(f"\n❌ TEST FAILED")
        print(f"Error: {e}")
        print(f"\nTraceback:\n{traceback.format_exc()}")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(test_full_workflow())
    sys.exit(exit_code)
