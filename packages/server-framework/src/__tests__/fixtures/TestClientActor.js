/**
 * Test client actor for integration testing
 * This file gets served to the browser
 */

import { Actor } from '@legion/actors';
import { ResourceManager } from '@legion/resource-manager';

export default class TestClientActor extends Actor {
  constructor() {
    super();
    this.resourceManager = ResourceManager.getInstance();
    this.messageCount = 0;
  }

  async initialize() {
    // Set up message handlers
    this.on('server_message', (data) => {
      this.messageCount++;
      console.log('Received from server:', data);
    });

    this.on('get_stats', () => {
      return {
        messageCount: this.messageCount,
        hasResourceManager: !!this.resourceManager
      };
    });
  }

  // Send message to server
  async sendToServer(message) {
    return this.send('server_message', message);
  }

  // Ping the server
  async ping() {
    return this.send('ping', { timestamp: Date.now() });
  }

  // Test echo
  async echo(data) {
    return this.send('echo', data);
  }
}