/**
 * WebSocket server stub - no longer needed as client connects directly to MCP server
 */

import { WebSocketServer } from 'ws';

/**
 * Create a stub WebSocket server (no longer used for proxying)
 * @param {Object} httpServer - HTTP server instance
 * @param {Object} config - Configuration object
 * @param {Object} logger - Logger instance
 * @returns {null} No WebSocket server needed
 */
export function createWebSocketServer(httpServer, config, logger) {
  logger.info('WebSocket proxy disabled - client connects directly to MCP server');
  return null;
}