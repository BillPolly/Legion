/**
 * ShowMeApp
 * 
 * Main application class for ShowMe UI
 * Manages WebSocket connection, asset display, and window management
 */

import { AssetDisplayManager } from './services/AssetDisplayManager.js';
import { WebSocketService } from './services/WebSocketService.js';
import { AssetRenderer } from './components/AssetRenderer.js';

export class ShowMeApp {
  constructor(config = {}) {
    this.config = {
      container: config.container || document.body,
      serverUrl: config.serverUrl || 'ws://localhost:3700/showme',
      reconnectInterval: config.reconnectInterval || 3000,
      maxReconnectAttempts: config.maxReconnectAttempts || 10,
      ...config
    };
    
    // Core services
    this.wsService = null;
    this.displayManager = null;
    this.renderer = null;
    
    // State
    this.connected = false;
    this.assets = new Map();
    this.windows = new Map();
  }
  
  /**
   * Initialize the application
   */
  async initialize() {
    // Create display manager
    this.displayManager = new AssetDisplayManager({
      container: this.config.container
    });
    await this.displayManager.initialize();
    
    // Create asset renderer
    this.renderer = new AssetRenderer();
    
    // Create WebSocket service
    this.wsService = new WebSocketService({
      url: this.config.serverUrl,
      reconnectInterval: this.config.reconnectInterval,
      maxReconnectAttempts: this.config.maxReconnectAttempts
    });
    
    // Set up WebSocket event handlers
    this.setupWebSocketHandlers();
    
    // Connect to server
    await this.connect();
    
    // Set up UI
    this.setupUI();
  }
  
  /**
   * Connect to ShowMe server
   */
  async connect() {
    try {
      await this.wsService.connect();
      this.connected = true;
      this.updateConnectionStatus(true);
    } catch (error) {
      console.error('Failed to connect to server:', error);
      this.connected = false;
      this.updateConnectionStatus(false);
      throw error;
    }
  }
  
  /**
   * Set up WebSocket event handlers
   */
  setupWebSocketHandlers() {
    // Connection events
    this.wsService.on('connected', () => {
      console.log('Connected to ShowMe server');
      this.connected = true;
      this.updateConnectionStatus(true);
      
      // Send client identification
      this.wsService.send({
        type: 'client-connect',
        clientId: this.generateClientId(),
        capabilities: ['display', 'interactive']
      });
    });
    
    this.wsService.on('disconnected', () => {
      console.log('Disconnected from ShowMe server');
      this.connected = false;
      this.updateConnectionStatus(false);
    });
    
    this.wsService.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
    
    // Asset events
    this.wsService.on('asset-ready', (data) => {
      this.handleAssetReady(data);
    });
    
    this.wsService.on('asset-updated', (data) => {
      this.handleAssetUpdated(data);
    });
    
    this.wsService.on('asset-removed', (data) => {
      this.handleAssetRemoved(data);
    });
    
    // Window events
    this.wsService.on('window-focus', (data) => {
      this.handleWindowFocus(data);
    });
    
    this.wsService.on('window-close', (data) => {
      this.handleWindowClose(data);
    });
  }
  
  /**
   * Set up main UI
   */
  setupUI() {
    // Create main layout
    this.config.container.innerHTML = `
      <div class="showme-app">
        <div class="showme-header">
          <h1>ShowMe Asset Viewer</h1>
          <div class="connection-status">
            <span class="status-indicator"></span>
            <span class="status-text">Connecting...</span>
          </div>
        </div>
        <div class="showme-content">
          <div class="asset-list">
            <h2>Assets</h2>
            <div class="asset-items"></div>
          </div>
          <div class="window-area" id="window-area"></div>
        </div>
      </div>
    `;
    
    // Apply styles
    this.applyStyles();
    
    // Set window area for display manager
    const windowArea = document.getElementById('window-area');
    this.displayManager.setWindowArea(windowArea);
  }
  
  /**
   * Handle asset ready event
   */
  handleAssetReady(data) {
    console.log('Asset ready:', data);
    
    const { assetId, asset, assetType, title, metadata } = data;
    
    // Store asset
    this.assets.set(assetId, {
      id: assetId,
      asset,
      type: assetType,
      title,
      metadata,
      timestamp: Date.now()
    });
    
    // Display asset in window
    this.displayAsset(assetId);
    
    // Update asset list
    this.updateAssetList();
  }
  
  /**
   * Display asset in window
   */
  displayAsset(assetId) {
    const assetData = this.assets.get(assetId);
    if (!assetData) {
      console.error('Asset not found:', assetId);
      return;
    }
    
    // Create window for asset
    const window = this.displayManager.createWindow({
      id: assetId,
      title: assetData.title,
      type: assetData.type
    });
    
    // Render asset content
    const renderedContent = this.renderer.render(
      assetData.asset,
      assetData.type
    );
    
    // Set window content
    window.setContent(renderedContent);
    
    // Store window reference
    this.windows.set(assetId, window);
    
    // Show window
    window.show();
  }
  
  /**
   * Handle asset updated event
   */
  handleAssetUpdated(data) {
    const { assetId, asset, metadata } = data;
    
    const assetData = this.assets.get(assetId);
    if (assetData) {
      // Update asset data
      assetData.asset = asset;
      assetData.metadata = { ...assetData.metadata, ...metadata };
      assetData.timestamp = Date.now();
      
      // Update window content if exists
      const window = this.windows.get(assetId);
      if (window) {
        const renderedContent = this.renderer.render(
          asset,
          assetData.type
        );
        window.setContent(renderedContent);
      }
      
      // Update asset list
      this.updateAssetList();
    }
  }
  
  /**
   * Handle asset removed event
   */
  handleAssetRemoved(data) {
    const { assetId } = data;
    
    // Remove asset
    this.assets.delete(assetId);
    
    // Close window if exists
    const window = this.windows.get(assetId);
    if (window) {
      window.close();
      this.windows.delete(assetId);
    }
    
    // Update asset list
    this.updateAssetList();
  }
  
  /**
   * Handle window focus event
   */
  handleWindowFocus(data) {
    const { windowId } = data;
    const window = this.windows.get(windowId);
    if (window) {
      window.focus();
    }
  }
  
  /**
   * Handle window close event
   */
  handleWindowClose(data) {
    const { windowId } = data;
    const window = this.windows.get(windowId);
    if (window) {
      window.close();
      this.windows.delete(windowId);
    }
  }
  
  /**
   * Update connection status display
   */
  updateConnectionStatus(connected) {
    const indicator = document.querySelector('.status-indicator');
    const text = document.querySelector('.status-text');
    
    if (indicator && text) {
      if (connected) {
        indicator.style.backgroundColor = '#10b981';
        text.textContent = 'Connected';
      } else {
        indicator.style.backgroundColor = '#ef4444';
        text.textContent = 'Disconnected';
      }
    }
  }
  
  /**
   * Update asset list display
   */
  updateAssetList() {
    const assetItems = document.querySelector('.asset-items');
    if (!assetItems) return;
    
    assetItems.innerHTML = '';
    
    for (const [assetId, assetData] of this.assets) {
      const item = document.createElement('div');
      item.className = 'asset-item';
      item.innerHTML = `
        <div class="asset-type">${assetData.type}</div>
        <div class="asset-title">${assetData.title}</div>
        <div class="asset-actions">
          <button onclick="showMeApp.displayAsset('${assetId}')">Show</button>
          <button onclick="showMeApp.removeAsset('${assetId}')">Remove</button>
        </div>
      `;
      assetItems.appendChild(item);
    }
  }
  
  /**
   * Remove asset
   */
  removeAsset(assetId) {
    // Send remove request to server
    this.wsService.send({
      type: 'remove-asset',
      assetId
    });
    
    // Remove locally
    this.handleAssetRemoved({ assetId });
  }
  
  /**
   * Generate unique client ID
   */
  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }
  
  /**
   * Apply application styles
   */
  applyStyles() {
    const styleId = 'showme-app-styles';
    if (document.getElementById(styleId)) return;
    
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .showme-app {
        width: 100%;
        height: 100vh;
        display: flex;
        flex-direction: column;
        background: #f5f5f5;
      }
      
      .showme-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 24px;
        background: white;
        border-bottom: 1px solid #e5e7eb;
      }
      
      .showme-header h1 {
        font-size: 20px;
        font-weight: 600;
        color: #111827;
      }
      
      .connection-status {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .status-indicator {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #fbbf24;
      }
      
      .status-text {
        font-size: 14px;
        color: #6b7280;
      }
      
      .showme-content {
        flex: 1;
        display: flex;
        overflow: hidden;
      }
      
      .asset-list {
        width: 280px;
        background: white;
        border-right: 1px solid #e5e7eb;
        padding: 16px;
        overflow-y: auto;
      }
      
      .asset-list h2 {
        font-size: 16px;
        font-weight: 600;
        margin-bottom: 12px;
        color: #374151;
      }
      
      .asset-items {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      
      .asset-item {
        padding: 12px;
        background: #f9fafb;
        border-radius: 6px;
        border: 1px solid #e5e7eb;
      }
      
      .asset-type {
        font-size: 12px;
        color: #6b7280;
        text-transform: uppercase;
        margin-bottom: 4px;
      }
      
      .asset-title {
        font-size: 14px;
        color: #111827;
        margin-bottom: 8px;
      }
      
      .asset-actions {
        display: flex;
        gap: 8px;
      }
      
      .asset-actions button {
        padding: 4px 8px;
        font-size: 12px;
        border: 1px solid #d1d5db;
        background: white;
        border-radius: 4px;
        cursor: pointer;
      }
      
      .asset-actions button:hover {
        background: #f3f4f6;
      }
      
      .window-area {
        flex: 1;
        position: relative;
        overflow: hidden;
      }
    `;
    
    document.head.appendChild(style);
  }
  
  /**
   * Cleanup and destroy app
   */
  destroy() {
    // Close all windows
    for (const window of this.windows.values()) {
      window.close();
    }
    this.windows.clear();
    
    // Clear assets
    this.assets.clear();
    
    // Disconnect WebSocket
    if (this.wsService) {
      this.wsService.disconnect();
    }
    
    // Cleanup display manager
    if (this.displayManager) {
      this.displayManager.destroy();
    }
    
    // Clear container
    if (this.config.container) {
      this.config.container.innerHTML = '';
    }
  }
}