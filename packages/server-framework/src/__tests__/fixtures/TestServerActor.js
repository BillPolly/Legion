/**
 * Test server actor for integration testing
 * Demonstrates a simple server-side actor
 */

import { Actor } from '@legion/actors';

export class TestServerActor extends Actor {
  constructor(services) {
    super();
    this.services = services;
    this.messageCount = 0;
    this.lastMessage = null;
  }

  async initialize() {
    // Set up message handlers
    this.on('ping', async (data) => {
      this.messageCount++;
      this.lastMessage = data;
      return { type: 'pong', count: this.messageCount };
    });

    this.on('echo', async (data) => {
      this.messageCount++;
      return { type: 'echo', data: data };
    });

    this.on('error_test', async () => {
      throw new Error('Test error from server actor');
    });

    this.on('get_services', async () => {
      return {
        hasResourceManager: !!this.services.get('resourceManager'),
        serviceCount: this.services.size
      };
    });
  }

  async cleanup() {
    // Clean up resources
    this.removeAllListeners();
  }
}

// Factory function for creating actor instances
export function createTestServerActor(services) {
  const actor = new TestServerActor(services);
  actor.initialize();
  return actor;
}