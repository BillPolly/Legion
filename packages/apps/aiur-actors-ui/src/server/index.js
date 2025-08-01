/**
 * Server-side actor exports
 */

export { ServerActorSpace } from './ServerActorSpace.js';
export { ToolExecutorActor } from './ToolExecutorActor.js';
export { SessionManagerActor } from './SessionManagerActor.js';
export { EventStreamActor } from './EventStreamActor.js';

/**
 * Create actor endpoint for WebSocket server
 * This would be integrated into the Aiur server
 * 
 * @param {Object} dependencies - Server dependencies
 * @returns {Function} WebSocket handler
 */
export function createActorEndpoint(dependencies) {
  return (ws, req) => {
    // Extract client ID from request
    const clientId = req.headers['x-client-id'] || `client-${Date.now()}`;
    
    // Create actor space for this client
    const actorSpace = new ServerActorSpace(clientId, dependencies);
    
    // Connect WebSocket
    actorSpace.connectWebSocket(ws);
    
    console.log(`Actor client connected: ${clientId}`);
  };
}