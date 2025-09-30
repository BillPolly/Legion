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
    // Set initial state
    this.updateState({
      connected: false,
      windowsOpen: 0,
      clientId: this.clientId
    });

    // Don't send anything - wait for server to send ready message first
    console.log('ShowMeClientActor initialized - waiting for server');
  }

  /**
   * Set remote server actor reference
   * Called by framework after handshake
   */
  setRemoteActor(remoteActor) {
    this.remoteActor = remoteActor;
    console.log('ShowMeClientActor: Remote server actor set');
    // Wait for server to send first message
  }

  /**
   * Handle messages from server
   */
  receive(messageType, data) {
    console.log('[CLIENT] Received message:', messageType, typeof data);

    if (messageType === 'ready') {
      console.log('[CLIENT] Got ready from server');
      this.updateState({ connected: true });
      return;
    }

    if (messageType === 'display-asset') {
      console.log('[CLIENT] Got display-asset message');
      this.handleDisplayAsset(data);
      return;
    }

    // Call parent receive for default handling
    return super.receive(messageType, data);
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
   * Handle display asset request with RemoteHandle
   * asset is a RemoteHandle proxy to FileHandle on server
   */
  async handleDisplayAsset({ asset, title }) {
    console.log(`Display asset received - asset is RemoteHandle:`, asset.isRemote);
    console.log(`Asset type:`, typeof asset, `constructor:`, asset?.constructor?.name);
    console.log(`Asset has query:`, typeof asset.query);
    console.log(`Asset keys:`, Object.keys(asset).slice(0, 10));

    try {
      // For FileHandle RemoteHandle, determine type
      // For now, assume image type (could query metadata later)
      const assetType = 'image';
      const filePath = title || 'asset';

      // Use file path as ID
      const assetId = filePath || `asset-${Date.now()}`;

      console.log(`Asset type: ${assetType}, path: ${filePath}`);

      // Check if window already exists
      if (this.openWindows.has(assetId)) {
        const windowInfo = this.openWindows.get(assetId);
        if (this.displayManager && this.displayManager.focusWindow) {
          this.displayManager.focusWindow(windowInfo.windowId);
        }
        return;
      }

      // Display using display manager
      if (this.displayManager && this.displayManager.createWindow) {
        const window = this.displayManager.createWindow({
          id: assetId,
          title: title || filePath.split('/').pop(),
          type: assetType
        });

        // Load file content and render
        if (assetType === 'image') {
          console.log('[CLIENT] Getting image data from RemoteHandle...');
          console.log('[CLIENT] Asset is RemoteHandle:', asset.isRemote);

          // asset is a RemoteHandle with getData() method
          const imageData = await asset.getData();
          console.log('[CLIENT] Image data received:', typeof imageData, imageData?.substring(0, 50));

          // imageData should be a data URL string
          const dataUrl = imageData;

          const renderedContent = this.renderAssetContent(dataUrl, assetType);
          console.log('[CLIENT] Rendered HTML:', renderedContent.substring(0, 100));
          window.setContent(renderedContent);
        } else {
          // For other types, get as text via query
          const results = await asset.query({ read: {} });
          const content = results[0];
          const renderedContent = this.renderAssetContent(content, assetType);
          window.setContent(renderedContent);
        }

        window.show();

        this.openWindows.set(assetId, {
          windowId: window.id,
          assetType,
          title: title || filePath.split('/').pop(),
          openedAt: Date.now(),
          assetHandle: asset
        });

        this.updateState({
          windowsOpen: this.openWindows.size
        });
      }
    } catch (error) {
      console.error(`Failed to display asset:`, error);
    }
  }

  /**
   * Get MIME type from file extension
   */
  _getMimeType(extension) {
    const mimeTypes = {
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'svg': 'image/svg+xml'
    };
    return mimeTypes[extension] || 'application/octet-stream';
  }

  /**
   * Handle asset ready notification (DEPRECATED - kept for compatibility)
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
    if (this.displayManager && this.displayManager.createWindow) {
      try {
        // Create window with asset content
        const window = this.displayManager.createWindow({
          id: assetId,
          title: title,
          type: assetType
        });
        
        // Render asset content based on type
        const renderedContent = this.renderAssetContent(asset, assetType);
        window.setContent(renderedContent);
        
        // Show the window
        window.show();
        
        // Track open window
        this.openWindows.set(assetId, {
          windowId: window.id,
          assetType,
          title,
          openedAt: Date.now()
        });
        
        this.updateState({
          windowsOpen: this.openWindows.size
        });
        
      } catch (error) {
        console.error(`Failed to display asset ${assetId}:`, error);
      }
    } else {
      console.warn('Display manager not available or missing createWindow method');
    }
  }

  /**
   * Render asset content based on type
   */
  renderAssetContent(asset, assetType) {
    switch (assetType) {
      case 'json':
        return `<pre style="margin:0; font-family: monospace; white-space: pre-wrap;">${JSON.stringify(asset, null, 2)}</pre>`;
      
      case 'image':
        if (typeof asset === 'string' && (asset.startsWith('http') || asset.startsWith('data:'))) {
          return `<img src="${asset}" style="max-width: 100%; height: auto;" alt="Asset Image">`;
        }
        return '<div>Image data (unsupported format)</div>';
      
      case 'code':
        return `<pre style="margin:0; font-family: monospace; white-space: pre-wrap; background: #f5f5f5; padding: 10px;">${asset}</pre>`;
      
      case 'data':
        if (Array.isArray(asset) && asset.length > 0) {
          // Simple table rendering
          const headers = Object.keys(asset[0]);
          let tableHtml = '<table style="width:100%; border-collapse: collapse;">';
          tableHtml += '<thead><tr>' + headers.map(h => `<th style="border:1px solid #ddd; padding:8px; background:#f5f5f5;">${h}</th>`).join('') + '</tr></thead>';
          tableHtml += '<tbody>';
          for (const row of asset.slice(0, 100)) { // Limit to 100 rows
            tableHtml += '<tr>' + headers.map(h => `<td style="border:1px solid #ddd; padding:8px;">${row[h] || ''}</td>`).join('') + '</tr>';
          }
          tableHtml += '</tbody></table>';
          return tableHtml;
        }
        return `<pre style="margin:0; font-family: monospace;">${JSON.stringify(asset, null, 2)}</pre>`;
      
      case 'web':
        if (typeof asset === 'string' && asset.startsWith('http')) {
          return `<iframe src="${asset}" style="width:100%; height:400px; border:none;" title="Web Content"></iframe>`;
        }
        return `<div style="padding:10px;">${asset}</div>`;
      
      case 'text':
      default:
        return `<div style="padding:10px; font-family: system-ui, sans-serif; white-space: pre-wrap;">${asset}</div>`;
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
    if (this.emitStateChange) {
      this.emitStateChange();
    }
  }

  /**
   * Emit state change (stub for browser environment)
   */
  emitStateChange() {
    // Stub - in browser this would emit events to UI components
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