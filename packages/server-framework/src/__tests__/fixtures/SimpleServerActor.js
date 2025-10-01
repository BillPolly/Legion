/**
 * Simple test server actor for integration testing
 * Compatible with new ActorSpace protocol
 */

export class SimpleServerActor {
  constructor(services) {
    this.isActor = true;
    this.services = services;
    this.messageCount = 0;
    this.lastMessage = null;
  }

  // Actor protocol method - receives (messageType, data)
  async receive(messageType, data) {
    this.messageCount++;
    this.lastMessage = { messageType, data };

    switch (messageType) {
      case 'ping':
        return { pong: true, count: this.messageCount, timestamp: Date.now() };

      case 'echo':
        return data;

      case 'error_test':
        throw new Error('Test error from server actor');

      case 'get_services':
        return {
          hasResourceManager: !!this.services?.get('resourceManager'),
          serviceCount: this.services?.size || 0
        };

      default:
        throw new Error(`Unknown message type: ${messageType}`);
    }
  }
}

// Factory function for creating actor instances
export function createSimpleServerActor(services) {
  return new SimpleServerActor(services);
}