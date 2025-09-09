/**
 * BrowserShowMeClientActor
 * 
 * Browser-compatible client actor for ShowMe module
 * Handles asset display in browser UI without Node.js dependencies
 */

export class BrowserShowMeClientActor {
  constructor(config = {}) {
    // Reference to display manager for UI operations
    this.displayManager = config.displayManager;
    
    // Track open windows
    this.openWindows = new Map();
    
    // Unique client ID
    this.clientId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    
    // WebSocket connection
    this.websocket = null;
    this.connected = false;
    
    // Server URL
    this.serverUrl = config.serverUrl || 'ws://localhost:3893/showme';
    
    // Event handlers
    this.handlers = new Map();
  }

  /**
   * Initialize the actor and connect to server
   */
  async initialize() {
    try {
      await this.connectToServer();
      console.log('ShowMeClientActor initialized successfully');
    } catch (error) {
      console.error('Failed to initialize ShowMeClientActor:', error);
      throw error;
    }
  }

  /**
   * Connect to the ShowMe server via WebSocket
   */
  async connectToServer() {
    return new Promise((resolve, reject) => {
      try {
        this.websocket = new WebSocket(this.serverUrl);
        
        this.websocket.onopen = () => {
          this.connected = true;
          console.log('Connected to ShowMe server');
          resolve();
        };
        
        this.websocket.onmessage = (event) => {
          this.handleMessage(JSON.parse(event.data));
        };
        
        this.websocket.onclose = () => {
          this.connected = false;
          console.log('Disconnected from ShowMe server');
        };
        
        this.websocket.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        };
        
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Handle incoming messages from server
   */
  handleMessage(message) {
    console.log('Received message:', message);
    
    switch (message.type) {
      case 'asset-ready':
        this.handleAssetReady(message);
        break;
      case 'window-created':
        this.handleWindowCreated(message);
        break;
      case 'error':
        this.handleError(message);
        break;
      default:
        console.warn('Unknown message type:', message.type);
    }
  }

  /**
   * Handle asset ready notification
   */
  async handleAssetReady(message) {
    try {
      const { assetId, assetType, title } = message.data;
      
      // Create display window via display manager
      if (this.displayManager) {
        const window = this.displayManager.createWindow({
          title: title || `Asset ${assetId}`,
          assetId: assetId
        });
        
        this.openWindows.set(assetId, window);
        console.log(`Asset ${assetId} displayed in window`);
      } else {
        console.warn('No display manager available for asset:', assetId);
      }
      
    } catch (error) {
      console.error('Failed to handle asset-ready:', error);
    }
  }

  /**
   * Handle window created notification
   */
  handleWindowCreated(message) {
    const { windowId, assetId } = message.data;
    console.log(`Window ${windowId} created for asset ${assetId}`);
  }

  /**
   * Handle error messages
   */
  handleError(message) {
    console.error('Server error:', message.data);
  }

  /**
   * Send message to server
   */
  sendMessage(type, data) {
    if (this.websocket && this.connected) {
      const message = { type, data, clientId: this.clientId, timestamp: Date.now() };
      this.websocket.send(JSON.stringify(message));
    } else {
      console.error('Cannot send message - not connected to server');
    }
  }

  /**
   * Request asset display
   */
  requestAssetDisplay(assetId, options = {}) {
    this.sendMessage('request-asset-display', {
      assetId,
      ...options
    });
  }

  /**
   * Close window
   */
  closeWindow(assetId) {
    const window = this.openWindows.get(assetId);
    if (window && this.displayManager) {
      this.displayManager.closeWindow(window.id);
      this.openWindows.delete(assetId);
    }
  }

  /**
   * Disconnect from server
   */
  disconnect() {
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
      this.connected = false;
    }
  }

  /**
   * Get connection status
   */
  isConnected() {
    return this.connected;
  }

  /**
   * Get client information
   */
  getClientInfo() {
    return {
      clientId: this.clientId,
      connected: this.connected,
      openWindows: this.openWindows.size,
      serverUrl: this.serverUrl
    };
  }
}