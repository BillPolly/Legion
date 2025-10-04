/**
 * ActorWebSocketTestHelper
 *
 * Helper for testing actor framework with MockWebSocket
 * Tests FULL stack including WebSocket serialization
 */

import { MockWebSocket } from './MockWebSocket.js';
import { ActorSpace } from '@legion/actors';

/**
 * Create connected actor spaces using MockWebSocket
 *
 * @param {Object} serverActor - Server-side actor (e.g., CLISessionActor)
 * @param {Object} clientActor - Client-side actor (e.g., BrowserCLIClientActor)
 * @returns {Object} { serverSpace, clientSpace, serverChannel, clientChannel }
 */
export function createConnectedActorSpaces(serverActor, clientActor) {
  // Create MockWebSocket pair
  const { serverWs, clientWs } = MockWebSocket.createPair();

  // Create ActorSpaces
  const serverSpace = new ActorSpace('test-server');
  const clientSpace = new ActorSpace('test-client');

  // Register actors in their spaces
  serverSpace.register(serverActor, 'server-root');
  clientSpace.register(clientActor, 'client-root');

  // Create channels (this wires WebSocket to actor protocol)
  // CRITICAL: Channel handles message serialization/deserialization
  const serverChannel = serverSpace.addChannel(serverWs, serverActor);
  const clientChannel = clientSpace.addChannel(clientWs, clientActor);

  // Trigger open events to simulate connection
  serverWs.simulateOpen();
  clientWs.simulateOpen();

  return {
    serverSpace,
    clientSpace,
    serverChannel,
    clientChannel,
    serverWs,
    clientWs
  };
}

/**
 * Send message from client to server via actor protocol
 *
 * @param {Channel} clientChannel - Client channel
 * @param {string} targetGuid - Server actor GUID
 * @param {string} messageType - Message type (e.g., 'execute-command')
 * @param {Object} data - Message data
 */
export function sendToServer(clientChannel, targetGuid, messageType, data) {
  // Channel.send handles serialization
  clientChannel.send(targetGuid, messageType, data);
}

/**
 * Wait for message from server to client
 *
 * @param {Object} clientActor - Client actor
 * @param {string} messageType - Expected message type
 * @param {number} timeout - Timeout in ms
 * @returns {Promise<Object>} Message data
 */
export function waitForMessage(clientActor, messageType, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const originalReceive = clientActor.receive.bind(clientActor);
    const timeoutId = setTimeout(() => {
      reject(new Error(`Timeout waiting for message: ${messageType}`));
    }, timeout);

    clientActor.receive = function(type, data) {
      const result = originalReceive(type, data);
      if (type === messageType) {
        clearTimeout(timeoutId);
        clientActor.receive = originalReceive; // Restore
        resolve(data);
      }
      return result;
    };
  });
}
