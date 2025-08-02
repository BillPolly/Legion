/**
 * WebSocket-Actor Protocol Bridge
 * 
 * A generic solution for bridging actor-based UI components
 * with any WebSocket server protocol.
 */

import { Protocol } from './Protocol.js';
import { AiurProtocol } from './AiurProtocol.js';
import { WebSocketBridgeActor } from './WebSocketBridgeActor.js';

// Re-export for external use
export { Protocol, AiurProtocol, WebSocketBridgeActor };

// Export protocol type constants for convenience
export const ProtocolTypes = {
  AIUR: 'aiur',
  MCP: 'mcp',
  CUSTOM: 'custom'
};

/**
 * Factory function to create a bridge with the appropriate protocol
 */
export function createWebSocketBridge(type, config = {}) {
  let protocol;
  
  switch (type) {
    case ProtocolTypes.AIUR:
      protocol = new AiurProtocol();
      break;
    // Future: Add MCP protocol, custom protocols, etc.
    // case ProtocolTypes.MCP:
    //   protocol = new MCPProtocol();
    //   break;
    default:
      throw new Error(`Unknown protocol type: ${type}`);
  }
  
  return new WebSocketBridgeActor({
    ...config,
    protocol,
    name: `${type}Bridge`
  });
}