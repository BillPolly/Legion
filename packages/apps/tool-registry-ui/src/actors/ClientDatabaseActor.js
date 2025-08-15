/**
 * ClientDatabaseActor - Client-side actor for database operations
 * Communicates with ServerDatabaseActor via WebSocket
 */

import { Actor } from '/legion/shared/actors/src/index.js';

export class ClientDatabaseActor extends Actor {
  constructor(toolRegistryBrowser) {
    super();
    this.toolRegistryBrowser = toolRegistryBrowser;
    this.remoteActor = null;
  }

  setRemoteActor(remoteActor) {
    this.remoteActor = remoteActor;
    console.log('🔗 ClientDatabaseActor connected to server');
  }

  async receive(message) {
    const { type, data } = message;
    
    try {
      switch (type) {
        case 'db:stats':
          await this.handleDatabaseStats(data);
          break;
          
        case 'db:health':
          await this.handleHealthCheck(data);
          break;
          
        case 'error':
          console.error('Database server error:', data.error);
          break;
          
        default:
          console.log('Unknown database message from server:', type, data);
      }
    } catch (error) {
      console.error('Error handling database message:', error);
    }
  }

  // Request database statistics
  getStats() {
    if (this.remoteActor) {
      console.log('📊 Requesting database stats from server...');
      this.remoteActor.receive({
        type: 'db:get-stats'
      });
    }
  }

  // Request health check
  checkHealth() {
    if (this.remoteActor) {
      console.log('🏥 Requesting database health check from server...');
      this.remoteActor.receive({
        type: 'db:health-check'
      });
    }
  }

  // Handle database statistics
  async handleDatabaseStats(stats) {
    console.log('📊 Database stats:', stats);
    
    // Update UI with database statistics
    if (this.toolRegistryBrowser) {
      // Could update an admin panel or status display
      this.toolRegistryBrowser.updateConnectionStatus?.('connected', stats);
    }
  }

  // Handle health check response
  async handleHealthCheck(health) {
    console.log('🏥 Database health:', health);
    
    // Update connection status in UI
    if (this.toolRegistryBrowser) {
      const status = health.healthy ? 'connected' : 'error';
      this.toolRegistryBrowser.updateConnectionStatus?.(status, health);
    }
  }
}