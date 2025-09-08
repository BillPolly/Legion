/**
 * ShowMeClientActor
 * 
 * Client-side protocol actor for ShowMe module
 * Handles asset display in browser UI
 */

import { Actor } from '@legion/actors';

export class ShowMeClientActor extends Actor {
  constructor(actorSpace, config = {}) {
    super(actorSpace, config);
    
    // Reference to display manager for UI operations
    this.displayManager = config.displayManager;
    
    // Track open windows
    this.openWindows = new Map();
    
    // Unique client ID
    this.clientId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * Define the protocol for this actor
   */
  getProtocol() {
    return {
      name: "ShowMeClient",
      version: "1.0.0",
      state: {
        schema: {
          connected: { type: 'boolean', required: true },
          windowsOpen: { type: 'number', required: true },
          clientId: { type: 'string', required: true }
        },
        initial: {
          connected: false,
          windowsOpen: 0,
          clientId: ''
        }
      },
      messages: {
        receives: {
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
        },
        sends: {
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
      connected: false,
      windowsOpen: 0,
      clientId: this.clientId
    });
    
    // Connect to server
    await this.connectToServer();
    
    console.log('ShowMeClientActor initialized');
  }

  /**
   * Connect to server
   */
  async connectToServer() {
    try {
      await this.send('client-connect', {
        clientId: this.clientId,
        timestamp: Date.now()
      });
      
      this.updateState({
        connected: true
      });
      
      console.log(`Connected to ShowMe server as ${this.clientId}`);
    } catch (error) {
      console.error('Failed to connect to ShowMe server:', error);
      this.updateState({
        connected: false
      });
    }
  }

  /**
   * Handle asset ready notification
   */
  async handleAssetReady({ assetId, assetType, title }) {
    console.log(`Asset ready: ${assetId} (${assetType})`);
    
    // Request full asset data from server
    await this.send('request-asset', {
      assetId,
      clientId: this.clientId
    });
  }

  /**
   * Handle asset data received
   */
  async handleAssetData({ assetId, asset, assetType, title }) {
    console.log(`Asset data received: ${assetId}`);
    
    // Check if window already exists for this asset
    if (this.openWindows.has(assetId)) {
      // Focus existing window
      const windowInfo = this.openWindows.get(assetId);
      if (this.displayManager && this.displayManager.focusWindow) {
        this.displayManager.focusWindow(windowInfo.windowId);
      }
      return;
    }
    
    // Display asset using display manager
    if (this.displayManager && this.displayManager.displayAsset) {
      try {
        const windowInfo = await this.displayManager.displayAsset({
          assetId,
          asset,
          assetType,
          title
        });
        
        // Track open window
        this.openWindows.set(assetId, {
          windowId: windowInfo.windowId,
          assetType,
          title,
          openedAt: Date.now()
        });
        
        this.updateState({
          windowsOpen: this.openWindows.size
        });
        
        // Set up window close handler
        if (windowInfo.window && windowInfo.window.onClose) {
          windowInfo.window.onClose(() => {
            this.handleWindowClosed(windowInfo.windowId, assetId);
          });
        }
        
      } catch (error) {
        console.error(`Failed to display asset ${assetId}:`, error);
      }
    } else {
      console.warn('Display manager not available');
    }
  }

  /**
   * Handle asset deleted notification
   */
  async handleAssetDeleted({ assetId }) {
    console.log(`Asset deleted: ${assetId}`);
    
    // Close window if open
    if (this.openWindows.has(assetId)) {
      const windowInfo = this.openWindows.get(assetId);
      
      if (this.displayManager && this.displayManager.closeWindow) {
        this.displayManager.closeWindow(windowInfo.windowId);
      }
      
      this.openWindows.delete(assetId);
      
      this.updateState({
        windowsOpen: this.openWindows.size
      });
    }
  }

  /**
   * Handle server status update
   */
  async handleServerStatus({ running, connectedClients, assetsStored }) {
    console.log(`Server status - Running: ${running}, Clients: ${connectedClients}, Assets: ${assetsStored}`);
    
    if (!running) {
      this.updateState({
        connected: false
      });
      
      // Could trigger reconnection logic here
    }
  }

  /**
   * Handle window closed by user
   */
  handleWindowClosed(windowId, assetId) {
    console.log(`Window closed: ${windowId}`);
    
    // Remove from tracking
    if (assetId && this.openWindows.has(assetId)) {
      this.openWindows.delete(assetId);
      
      this.updateState({
        windowsOpen: this.openWindows.size
      });
      
      // Notify server
      this.send('close-window', {
        windowId,
        assetId
      }).catch(error => {
        console.error('Failed to notify server of window close:', error);
      });
    }
  }

  /**
   * Fetch asset data from server API
   */
  async fetchAssetData(assetId) {
    try {
      // This would be replaced with actual HTTP fetch in production
      const response = await fetch(`/api/asset/${assetId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch asset: ${response.statusText}`);
      }
      
      const result = await response.json();
      return result.data;
      
    } catch (error) {
      console.error(`Failed to fetch asset ${assetId}:`, error);
      throw error;
    }
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
    console.log('ShowMeClientActor shutting down');
    
    // Disconnect from server
    if (this.state.connected) {
      await this.send('client-disconnect', {
        clientId: this.clientId,
        timestamp: Date.now()
      });
    }
    
    // Close all open windows
    for (const [assetId, windowInfo] of this.openWindows) {
      if (this.displayManager && this.displayManager.closeWindow) {
        this.displayManager.closeWindow(windowInfo.windowId);
      }
    }
    
    this.openWindows.clear();
    
    this.updateState({
      connected: false,
      windowsOpen: 0
    });
    
    await super.shutdown();
  }
}

export default ShowMeClientActor;