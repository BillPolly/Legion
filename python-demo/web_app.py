#!/usr/bin/env python3
"""
Web Application for Multi-Agent Research System
Serves HTML dashboard and handles WebSocket connections for streaming updates
"""

import asyncio
import json
import logging
import os
import webbrowser
from pathlib import Path
from datetime import datetime
from http.server import HTTPServer, SimpleHTTPRequestHandler
from threading import Thread
import websockets
from dotenv import load_dotenv

# Add src to path
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from research_agent.main import create_workflow
from langchain_core.messages import HumanMessage
from research_agent.models import AgentName

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class DashboardHTTPRequestHandler(SimpleHTTPRequestHandler):
    """HTTP request handler that serves dashboard.html"""

    def do_GET(self):
        if self.path == '/' or self.path == '/index.html':
            self.path = '/src/research_agent/dashboard.html'
        return SimpleHTTPRequestHandler.do_GET(self)

    def log_message(self, format, *args):
        # Suppress HTTP server logs
        pass


def start_http_server(port=8000):
    """Start HTTP server in separate thread"""
    server = HTTPServer(('localhost', port), DashboardHTTPRequestHandler)
    logger.info(f"HTTP server started on http://localhost:{port}")
    server.serve_forever()


async def handle_research_request(topic: str, websocket):
    """Execute research workflow and stream updates to WebSocket"""
    logger.info(f"Starting research on: {topic}")

    try:
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

        # Stream workflow execution with custom updates
        async for chunk in app.astream(initial_state, stream_mode=["custom", "updates"]):
            stream_mode, data = chunk

            if stream_mode == "custom":
                # Forward custom updates to WebSocket
                await websocket.send(json.dumps(data))
                logger.debug(f"Sent custom update: {data.get('type')}")

        logger.info("Research workflow completed")

    except Exception as e:
        logger.error(f"Research failed: {e}")
        await websocket.send(json.dumps({
            "type": "error",
            "data": {"message": f"Research failed: {str(e)}"}
        }))


async def websocket_handler(websocket, path):
    """Handle WebSocket connections from dashboard"""
    logger.info(f"WebSocket client connected from {websocket.remote_address}")

    try:
        async for message in websocket:
            data = json.loads(message)
            msg_type = data.get('type')

            if msg_type == 'start_research':
                topic = data.get('topic', '')
                if not topic:
                    await websocket.send(json.dumps({
                        "type": "error",
                        "data": {"message": "No topic provided"}
                    }))
                    continue

                # Execute research and stream updates
                await handle_research_request(topic, websocket)

    except websockets.exceptions.ConnectionClosed:
        logger.info("WebSocket client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")


async def start_websocket_server(host='localhost', port=8765):
    """Start WebSocket server"""
    server = await websockets.serve(websocket_handler, host, port)
    logger.info(f"WebSocket server started on ws://{host}:{port}")
    return server


async def main():
    """Main entry point"""
    # Start HTTP server in background thread
    http_thread = Thread(target=start_http_server, args=(8000,), daemon=True)
    http_thread.start()

    # Start WebSocket server
    websocket_server = await start_websocket_server('localhost', 8765)

    # Open browser
    logger.info("Opening browser...")
    webbrowser.open('http://localhost:8000')

    logger.info("Server running. Press Ctrl+C to stop.")

    # Keep running
    await asyncio.Future()  # Run forever


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Shutting down...")
