/**
 * Mock ShowMeServer for testing
 * 
 * Provides a mock implementation that doesn't require WebSocket
 */

export class ShowMeServer {
  constructor(config = {}) {
    this.config = config;
    this.started = false;
    this.port = config.port || 3700;
    this.clients = new Map();
  }

  async start() {
    this.started = true;
    return { port: this.port };
  }

  async stop() {
    this.started = false;
  }

  isStarted() {
    return this.started;
  }

  async sendAsset(assetId, asset, assetType, metadata = {}) {
    // Mock implementation - just validate inputs
    if (!assetId) throw new Error('assetId is required');
    if (asset === undefined) throw new Error('asset is required');
    if (!assetType) throw new Error('assetType is required');
    
    return {
      success: true,
      assetId,
      assetType,
      timestamp: Date.now()
    };
  }

  broadcastToClients(message) {
    // Mock implementation
    return true;
  }
}