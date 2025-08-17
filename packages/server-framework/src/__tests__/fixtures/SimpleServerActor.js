/**
 * Simple test server actor for integration testing
 * No dependencies on Actor class for simplicity
 */

export class SimpleServerActor {
  constructor(services) {
    this.services = services;
    this.messageCount = 0;
    this.lastMessage = null;
    this.handlers = new Map();
    
    // Set up handlers
    this.handlers.set('ping', async (data) => {
      this.messageCount++;
      this.lastMessage = data;
      return { type: 'pong', count: this.messageCount };
    });

    this.handlers.set('echo', async (data) => {
      this.messageCount++;
      return { type: 'echo', data: data };
    });

    this.handlers.set('error_test', async () => {
      throw new Error('Test error from server actor');
    });

    this.handlers.set('get_services', async () => {
      return {
        hasResourceManager: !!this.services.get('resourceManager'),
        serviceCount: this.services.size
      };
    });
  }

  async handle(message) {
    const handler = this.handlers.get(message.type);
    if (handler) {
      return await handler(message.data || message);
    }
    throw new Error(`Unknown message type: ${message.type}`);
  }

  // Actor protocol method
  receive(payload, ...args) {
    if (args.length > 0) {
      return this.handle({ type: payload, data: args[0] });
    }
    return this.handle(payload);
  }
}

// Factory function for creating actor instances
export function createSimpleServerActor(services) {
  return new SimpleServerActor(services);
}