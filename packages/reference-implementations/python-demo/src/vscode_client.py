"""
VSCode Orchestrator Client
Sends flashcard updates to VSCode extension
"""

import asyncio
import websockets
import json
import os
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class VSCodeClient:
    def __init__(self, host='localhost', port=17892):
        self.host = host
        self.port = port
        self.ws = None
        self.message_id = 0

    async def connect(self):
        """Connect to VSCode Orchestrator WebSocket"""
        try:
            self.ws = await websockets.connect(f"ws://{self.host}:{self.port}")
            logger.info(f"Connected to VSCode Orchestrator at ws://{self.host}:{self.port}")
        except Exception as e:
            logger.warning(f"Could not connect to VSCode Orchestrator: {e}")
            logger.warning("Flashcards will not be displayed (VSCode extension may not be running)")
            self.ws = None

    async def disconnect(self):
        """Disconnect from VSCode Orchestrator"""
        if self.ws:
            await self.ws.close()
            self.ws = None
            logger.info("Disconnected from VSCode Orchestrator")

    async def send_flashcard(self, title: str, subtitle: str = "", column: int = 3):
        """Send flashcard command to VSCode"""
        if not self.ws:
            logger.debug(f"Skipping flashcard (not connected): {title}")
            return

        try:
            message = {
                "id": self.message_id,
                "cmd": "showFlashcard",
                "args": {
                    "title": title,
                    "subtitle": subtitle,
                    "column": column
                }
            }
            self.message_id += 1

            await self.ws.send(json.dumps(message))
            logger.info(f"📋 Flashcard: {title}")

            # Wait for response
            response = await asyncio.wait_for(self.ws.recv(), timeout=5.0)
            response_data = json.loads(response)

            if not response_data.get('ok'):
                logger.error(f"Flashcard command failed: {response_data.get('error')}")

        except asyncio.TimeoutError:
            logger.warning("Flashcard command timed out")
        except Exception as e:
            logger.error(f"Error sending flashcard: {e}")

# Global instance
_vscode_client = None

async def get_vscode_client():
    """Get or create the global VSCode client instance"""
    global _vscode_client
    if _vscode_client is None:
        host = os.getenv('VSCODE_WS_HOST', 'localhost')
        port = int(os.getenv('VSCODE_WS_PORT', 17892))
        _vscode_client = VSCodeClient(host, port)
        await _vscode_client.connect()
    return _vscode_client
