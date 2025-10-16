"""
WebSocket Server for Dashboard Communication
Broadcasts agent updates to connected web clients
"""

import asyncio
import websockets
import json
from typing import Set
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class DashboardServer:
    def __init__(self, host='localhost', port=8765):
        self.host = host
        self.port = port
        self.clients: Set[websockets.WebSocketServerProtocol] = set()
        self.server = None

    async def register(self, websocket):
        """Register a new client connection"""
        self.clients.add(websocket)
        logger.info(f"Client connected. Total clients: {len(self.clients)}")

    async def unregister(self, websocket):
        """Unregister a client connection"""
        self.clients.discard(websocket)
        logger.info(f"Client disconnected. Total clients: {len(self.clients)}")

    async def broadcast(self, message: dict):
        """Broadcast message to all connected clients"""
        if not self.clients:
            logger.debug("No clients connected, skipping broadcast")
            return

        message_str = json.dumps(message)
        disconnected = set()

        for client in self.clients:
            try:
                await client.send(message_str)
            except websockets.exceptions.ConnectionClosed:
                disconnected.add(client)

        # Remove disconnected clients
        for client in disconnected:
            await self.unregister(client)

    async def handler(self, websocket, path):
        """Handle incoming WebSocket connections"""
        await self.register(websocket)
        try:
            async for message in websocket:
                # Echo back or handle client messages if needed
                logger.debug(f"Received message from client: {message}")
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            await self.unregister(websocket)

    async def start(self):
        """Start the WebSocket server"""
        self.server = await websockets.serve(
            self.handler,
            self.host,
            self.port
        )
        logger.info(f"Dashboard WebSocket server started on ws://{self.host}:{self.port}")

    async def stop(self):
        """Stop the WebSocket server"""
        if self.server:
            self.server.close()
            await self.server.wait_closed()
            logger.info("Dashboard WebSocket server stopped")

# Global instance
_dashboard_server = None

def get_dashboard_server(host='localhost', port=8765):
    """Get or create the global dashboard server instance"""
    global _dashboard_server
    if _dashboard_server is None:
        _dashboard_server = DashboardServer(host, port)
    return _dashboard_server
