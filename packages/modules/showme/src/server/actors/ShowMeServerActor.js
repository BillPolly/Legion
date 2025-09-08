/**
 * ShowMeServerActor
 * 
 * Server-side protocol actor for ShowMe module
 * Handles asset display requests and client coordination
 */

import { Actor } from '@legion/actors';

export class ShowMeServerActor extends Actor {
  constructor(actorSpace, config = {}) {
    super(actorSpace, config);
    
    // Track connected clients and assets
    this.connectedClients = new Set();
    this.assetsStored = 0;
    
    // Reference to server for asset operations
    this.server = config.server;
  }

  /**
   * Define the protocol for this actor
   */
  getProtocol() {
    return {
      name: "ShowMeServer",
      version: "1.0.0",
      state: {
        schema: {
          connectedClients: { type: 'number', required: true },
          assetsStored: { type: 'number', required: true },
          serverRunning: { type: 'boolean', required: true }
        },
        initial: {
          connectedClients: 0,
          assetsStored: 0,
          serverRunning: true
        }
      },
      messages: {
        receives: {
          "client-connect": {
            schema: {
              clientId: { type: 'string', required: true },
              timestamp: { type: 'number', required: true }
            }
          },
          "client-disconnect": {
            schema: {
              clientId: { type: 'string', required: true },
              timestamp: { type: 'number', required: true }
            }
          },
          "display-asset": {
            schema: {
              assetId: { type: 'string', required: true },
              assetType: { type: 'string', required: true },
              title: { type: 'string', required: true },
              asset: { type: 'any', required: true }
            }
          },
          "request-asset": {
            schema: {
              assetId: { type: 'string', required: true },
              clientId: { type: 'string', required: true }
            }
          },
          "close-window": {
            schema: {
              windowId: { type: 'string', required: true },
              assetId: { type: 'string', required: false }
            }
          }
        },
        sends: {
          "asset-ready": {
            schema: {
              assetId: { type: 'string', required: true },
              assetType: { type: 'string', required: true },
              title: { type: 'string', required: true }
            }
          },
          "asset-data": {
            schema: {
              assetId: { type: 'string', required: true },
              asset: { type: 'any', required: true },
              assetType: { type: 'string', required: true },
              title: { type: 'string', required: true }
            }
          },
          "asset-deleted": {
            schema: {
              assetId: { type: 'string', required: true }
            }
          },
          "server-status": {
            schema: {
              running: { type: 'boolean', required: true },
              connectedClients: { type: 'number', required: true },
              assetsStored: { type: 'number', required: true }
            }
          }
        }
      }
    };
  }

  /**
   * Initialize the actor
   */
  async initialize() {
    await super.initialize();
    
    // Set initial state
    this.updateState({
      connectedClients: 0,
      assetsStored: this.server ? this.server.assetStorage.size : 0,
      serverRunning: true
    });
    
    console.log('ShowMeServerActor initialized');
  }

  /**
   * Handle client connection
   */
  async handleClientConnect({ clientId, timestamp }) {
    this.connectedClients.add(clientId);
    
    this.updateState({
      connectedClients: this.connectedClients.size
    });
    
    console.log(`Client connected: ${clientId}`);
    
    // Send current server status to new client
    await this.send('server-status', {
      running: true,
      connectedClients: this.connectedClients.size,
      assetsStored: this.state.assetsStored
    });
  }

  /**
   * Handle client disconnection
   */
  async handleClientDisconnect({ clientId, timestamp }) {
    this.connectedClients.delete(clientId);
    
    this.updateState({
      connectedClients: this.connectedClients.size
    });
    
    console.log(`Client disconnected: ${clientId}`);
  }

  /**
   * Handle display asset request
   */
  async handleDisplayAsset({ assetId, assetType, title, asset }) {
    console.log(`Displaying asset: ${assetId} (${assetType})`);
    
    // Store asset if server reference available
    if (this.server && this.server.assetStorage) {
      this.server.assetStorage.set(assetId, {
        id: assetId,
        asset,
        assetType,
        title,
        timestamp: Date.now()
      });
      
      this.updateState({
        assetsStored: this.server.assetStorage.size
      });
    }
    
    // Notify all connected clients that asset is ready
    await this.broadcast('asset-ready', {
      assetId,
      assetType,
      title
    });
  }

  /**
   * Handle asset data request
   */
  async handleRequestAsset({ assetId, clientId }) {
    console.log(`Client ${clientId} requesting asset: ${assetId}`);
    
    if (this.server && this.server.assetStorage) {
      const assetData = this.server.assetStorage.get(assetId);
      
      if (assetData) {
        // Send asset data to requesting client
        await this.sendToClient(clientId, 'asset-data', {
          assetId: assetData.id,
          asset: assetData.asset,
          assetType: assetData.assetType,
          title: assetData.title
        });
      } else {
        console.warn(`Asset not found: ${assetId}`);
      }
    }
  }

  /**
   * Handle window close request
   */
  async handleCloseWindow({ windowId, assetId }) {
    console.log(`Window closed: ${windowId}`);
    
    // If assetId provided, we could clean up the asset
    if (assetId && this.server && this.server.assetStorage) {
      // For now, keep assets in storage for potential reuse
      // Could implement cleanup policy later
    }
  }

  /**
   * Broadcast message to all connected clients
   */
  async broadcast(messageType, data) {
    for (const clientId of this.connectedClients) {
      await this.sendToClient(clientId, messageType, data);
    }
  }

  /**
   * Send message to specific client
   */
  async sendToClient(clientId, messageType, data) {
    await this.send(messageType, {
      ...data,
      targetClient: clientId
    });
  }

  /**
   * Update state and emit change
   */
  updateState(updates) {
    this.state = { ...this.state, ...updates };
    this.emitStateChange();
  }

  /**
   * Clean up on shutdown
   */
  async shutdown() {
    console.log('ShowMeServerActor shutting down');
    
    this.updateState({
      serverRunning: false
    });
    
    await super.shutdown();
  }
}

export default ShowMeServerActor;