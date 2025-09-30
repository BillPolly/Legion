/**
 * ShowMeServerActor
 * 
 * Server-side protocol actor for ShowMe module
 * Handles asset display requests and client coordination
 */

import { Actor } from '@legion/actors';
import { ResourceManager } from '@legion/resource-manager';
import { AssetHandle } from '../../handles/AssetHandle.js';

export class ShowMeServerActor extends Actor {
  constructor(actorSpace, config = {}) {
    super(actorSpace, config);

    // Track connected clients and assets
    this.connectedClients = new Set();
    this.assetsStored = 0;

    // Reference to server for asset operations
    this.server = config.server;

    // ResourceManager for Handle resolution
    this.resourceManager = null;

    // Remote client actor reference (set by ActorSpaceManager)
    this.remoteActor = null;
  }

  /**
   * Set the remote client actor
   */
  setRemoteActor(remoteActor) {
    this.remoteActor = remoteActor;
    console.log('ShowMeServerActor: Remote actor set');
  }

  /**
   * Define the protocol for this actor
   */
  getProtocol() {
    return {
      name: "ShowMeServer",
      version: "2.0.0",
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
          "display-resource": {
            schema: {
              handleURI: { type: 'string', required: true },
              handleType: { type: 'string', required: true },
              title: { type: 'string', required: false },
              options: { type: 'object', required: false }
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
          "resource-ready": {
            schema: {
              handleURI: { type: 'string', required: true },
              rendererType: { type: 'string', required: true },
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

    // Get ResourceManager singleton for Handle resolution
    this.resourceManager = await ResourceManager.getInstance();

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
    if (this.remoteActor) {
      this.remoteActor.receive('server-status', {
        running: true,
        connectedClients: this.connectedClients.size,
        assetsStored: this.state.assetsStored
      });
    }
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

    // Create AssetHandle - this is an Actor!
    const assetHandle = new AssetHandle({
      id: assetId,
      assetType,
      title,
      asset,
      timestamp: Date.now()
    });

    // Store the handle if server reference available
    if (this.server && this.server.assetStorage) {
      this.server.assetStorage.set(assetId, assetHandle);

      this.updateState({
        assetsStored: this.server.assetStorage.size
      });
    }

    // Send the Handle Actor to client - it will be serialized as RemoteActor!
    await this.broadcast('display-asset', {
      asset: assetHandle,  // This is an Actor - will become RemoteActor on client side!
      title
    });
  }

  /**
   * Handle display resource request (for Handles)
   */
  async handleDisplayResource({ handleURI, handleType, title, options = {} }) {
    console.log(`Displaying resource: ${handleURI} (${handleType})`);

    // Validate ResourceManager is available
    if (!this.resourceManager) {
      throw new Error('ResourceManager not initialized');
    }

    // Resolve Handle from URI
    let handle;
    try {
      handle = await ResourceManager.fromURI(handleURI);
    } catch (error) {
      throw new Error(`Failed to resolve Handle: ${error.message}`);
    }

    // Determine renderer type based on Handle type
    const rendererType = this.selectRendererType(handleType);

    // Generate title if not provided
    const finalTitle = title || this.generateHandleTitle(handleType, handleURI);

    // Store Handle URI (not full instance) if server reference available
    if (this.server && this.server.assetStorage) {
      this.server.assetStorage.set(handleURI, {
        id: handleURI,
        handleURI,
        handleType,
        rendererType,
        title: finalTitle,
        timestamp: Date.now()
      });

      this.updateState({
        assetsStored: this.server.assetStorage.size
      });
    }

    // Notify all connected clients that resource is ready
    await this.broadcast('resource-ready', {
      handleURI,
      rendererType,
      title: finalTitle
    });
  }

  /**
   * Select appropriate renderer type based on Handle type
   * @private
   */
  selectRendererType(handleType) {
    // Map Handle types to renderer types
    const rendererMap = {
      'strategy': 'StrategyRenderer',
      'strategyUsers': 'StrategyRenderer', // Specific strategy subdirectory
      'filesystem': 'HandleRenderer',
      'datastore': 'HandleRenderer'
    };

    return rendererMap[handleType] || 'HandleRenderer';
  }

  /**
   * Generate title for Handle
   * @private
   */
  generateHandleTitle(handleType, handleURI) {
    const type = handleType.charAt(0).toUpperCase() + handleType.slice(1);
    return `${type} Handle`;
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
   * For now, sends to the remote actor if available
   * TODO: Support multiple clients per server actor
   */
  async broadcast(messageType, data) {
    if (this.remoteActor) {
      this.remoteActor.receive(messageType, data);
      console.log(`Broadcast ${messageType} to remote actor`);
    } else {
      console.warn('No remote actor available for broadcast');
    }
  }

  /**
   * Send message to specific client
   */
  async sendToClient(clientId, messageType, data) {
    if (this.remoteActor) {
      this.remoteActor.receive(messageType, data);
    }
  }

  /**
   * Update state
   */
  updateState(updates) {
    this.state = { ...this.state, ...updates };
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