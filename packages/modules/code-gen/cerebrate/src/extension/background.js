/**
 * Background Service Worker for Cerebrate Chrome Extension
 * Manages extension lifecycle, message routing, and persistent connections
 */
export class BackgroundService {

  constructor() {
    this.state = 'idle';
    this.connections = new Map(); // tabId -> connection info
    this.ports = new Map(); // tabId -> port
    this.version = '1.0.0';
    this.staleConnectionTimeout = 60000; // 1 minute
  }

  /**
   * Initialize background service
   */
  initialize() {
    // Setup event listeners
    this.setupInstallHandler();
    this.setupMessageHandler();
    this.setupPortHandler();
    this.setupTabHandlers();
    this.setupActionHandler();
    this.setupStorageHandler();

    // Restore persisted state
    this.restoreState().catch(error => {
      console.error('Failed to restore state:', error);
    });

    // Start cleanup interval
    this.startCleanupInterval();

    this.state = 'ready';
  }

  /**
   * Setup installation event handler
   * @private
   */
  setupInstallHandler() {
    chrome.runtime.onInstalled.addListener((details) => {
      if (details.reason === 'install') {
        // Fresh installation
        chrome.storage.local.set({
          installedAt: Date.now(),
          version: this.version
        });
      } else if (details.reason === 'update') {
        // Extension updated
        chrome.storage.local.set({
          updatedAt: Date.now(),
          previousVersion: details.previousVersion,
          version: this.version
        });
      }
    });
  }

  /**
   * Setup message handler
   * @private
   */
  setupMessageHandler() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Indicates async response
    });
  }

  /**
   * Setup port connection handler
   * @private
   */
  setupPortHandler() {
    chrome.runtime.onConnect.addListener((port) => {
      const tabId = port.sender?.tab?.id;
      if (!tabId) return;

      this.ports.set(tabId, port);

      port.onMessage.addListener((message) => {
        this.handlePortMessage(message, tabId, port);
      });

      port.onDisconnect.addListener(() => {
        this.ports.delete(tabId);
        this.updateConnection(tabId, { status: 'disconnected', port: null });
      });
    });
  }

  /**
   * Setup tab event handlers
   * @private
   */
  setupTabHandlers() {
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'loading') {
        // Tab is navigating, might need to reconnect
        const connection = this.connections.get(tabId);
        if (connection && connection.status === 'connected') {
          this.updateConnection(tabId, { status: 'reconnecting' });
        }
      }
    });

    chrome.tabs.onRemoved.addListener((tabId) => {
      // Cleanup connection when tab is closed
      this.removeConnection(tabId);
    });
  }

  /**
   * Setup browser action handler
   * @private
   */
  setupActionHandler() {
    chrome.action.onClicked.addListener((tab) => {
      // Send message to content script to toggle DevTools
      chrome.tabs.sendMessage(tab.id, { action: 'toggle-devtools' });
    });
  }

  /**
   * Setup storage change handler
   * @private
   */
  setupStorageHandler() {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes.connections) {
        // Connections updated in storage
        this.syncConnectionsFromStorage(changes.connections.newValue);
      }
    });
  }

  /**
   * Handle incoming messages
   * @param {Object} message - Message object
   * @param {Object} sender - Sender information
   * @param {Function} sendResponse - Response callback
   * @private
   */
  async handleMessage(message, sender, sendResponse) {
    const tabId = sender.tab?.id;

    try {
      switch (message.command) {
        case 'connect':
          this.handleConnect(tabId, message.data);
          sendResponse({ success: true });
          break;

        case 'disconnect':
          this.handleDisconnect(tabId);
          sendResponse({ success: true });
          break;

        case 'getStatus':
          sendResponse({
            success: true,
            data: this.getConnection(tabId)
          });
          break;

        default:
          sendResponse({
            success: false,
            error: `Unknown command: ${message.command}`
          });
      }
    } catch (error) {
      sendResponse({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Handle port messages
   * @param {Object} message - Message from port
   * @param {number} tabId - Tab ID
   * @param {Port} port - Chrome port object
   * @private
   */
  handlePortMessage(message, tabId, port) {
    if (message.type === 'status' && message.data.connected) {
      this.updateConnection(tabId, {
        status: 'connected',
        port: port
      });
    }
  }

  /**
   * Handle connect command
   * @param {number} tabId - Tab ID
   * @param {Object} data - Connection data
   * @private
   */
  handleConnect(tabId, data) {
    this.trackConnection(tabId, {
      status: 'connecting',
      url: data.url,
      tabId: tabId,
      connectedAt: Date.now(),
      lastActivity: Date.now()
    });

    this.updateBadge(tabId, 'connecting');
  }

  /**
   * Handle disconnect command
   * @param {number} tabId - Tab ID
   * @private
   */
  handleDisconnect(tabId) {
    this.removeConnection(tabId);
    this.updateBadge(tabId, 'disconnected');
  }

  /**
   * Track a connection
   * @param {number} tabId - Tab ID
   * @param {Object} connectionInfo - Connection information
   */
  trackConnection(tabId, connectionInfo) {
    this.connections.set(tabId, connectionInfo);
    this.persistConnections();
  }

  /**
   * Update connection information
   * @param {number} tabId - Tab ID
   * @param {Object} updates - Updates to apply
   * @private
   */
  updateConnection(tabId, updates) {
    const connection = this.connections.get(tabId);
    if (connection) {
      Object.assign(connection, updates, {
        lastActivity: Date.now()
      });
      this.persistConnections();
      
      if (updates.status) {
        this.updateBadge(tabId, updates.status);
      }
    }
  }

  /**
   * Remove a connection
   * @param {number} tabId - Tab ID
   * @private
   */
  removeConnection(tabId) {
    this.connections.delete(tabId);
    this.ports.delete(tabId);
    this.persistConnections();
  }

  /**
   * Get connection information
   * @param {number} tabId - Tab ID
   * @returns {Object|null} - Connection info or null
   */
  getConnection(tabId) {
    return this.connections.get(tabId) || null;
  }

  /**
   * Get all active connections
   * @returns {Array} - Array of active connections
   */
  getActiveConnections() {
    return Array.from(this.connections.values()).filter(
      conn => conn.status === 'connected' || conn.status === 'connecting'
    );
  }

  /**
   * Get current state
   * @returns {string} - Current state
   */
  getState() {
    return this.state;
  }

  /**
   * Update badge for tab
   * @param {number} tabId - Tab ID
   * @param {string} status - Connection status
   */
  updateBadge(tabId, status) {
    switch (status) {
      case 'connected':
        chrome.action.setBadgeText({ text: '●', tabId });
        chrome.action.setBadgeBackgroundColor({ color: '#00FF00', tabId });
        break;
      case 'connecting':
        chrome.action.setBadgeText({ text: '●', tabId });
        chrome.action.setBadgeBackgroundColor({ color: '#FFA500', tabId });
        break;
      case 'error':
        chrome.action.setBadgeText({ text: '!', tabId });
        chrome.action.setBadgeBackgroundColor({ color: '#FF0000', tabId });
        break;
      case 'disconnected':
      default:
        chrome.action.setBadgeText({ text: '', tabId });
        break;
    }
  }

  /**
   * Persist connections to storage
   * @private
   */
  async persistConnections() {
    const connectionsObj = {};
    this.connections.forEach((conn, tabId) => {
      // Only persist non-sensitive data
      connectionsObj[tabId] = {
        status: conn.status,
        url: conn.url,
        connectedAt: conn.connectedAt,
        lastActivity: conn.lastActivity
      };
    });

    try {
      await chrome.storage.local.set({ connections: connectionsObj });
    } catch (error) {
      console.error('Failed to persist connections:', error);
    }
  }

  /**
   * Restore state from storage
   */
  async restoreState() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['connections'], (result) => {
        if (result && result.connections) {
          this.syncConnectionsFromStorage(result.connections);
        }
        resolve();
      });
    });
  }

  /**
   * Sync connections from storage
   * @param {Object} connectionsObj - Connections object from storage
   * @private
   */
  syncConnectionsFromStorage(connectionsObj) {
    if (!connectionsObj) return;

    Object.entries(connectionsObj).forEach(([tabId, conn]) => {
      this.connections.set(parseInt(tabId), conn);
    });
  }

  /**
   * Cleanup stale connections
   */
  cleanupStaleConnections() {
    const now = Date.now();
    const staleThreshold = now - this.staleConnectionTimeout;

    this.connections.forEach((conn, tabId) => {
      if (conn.lastActivity < staleThreshold && conn.status !== 'connected') {
        this.removeConnection(tabId);
      }
    });
  }

  /**
   * Start cleanup interval
   * @private
   */
  startCleanupInterval() {
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleConnections();
    }, 30000); // Run every 30 seconds
  }

  /**
   * Destroy background service
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.connections.clear();
    this.ports.clear();
    this.state = 'idle';
  }
}

// Create singleton instance
const backgroundService = new BackgroundService();

// Initialize on service worker start (only if chrome is available)
if (typeof chrome !== 'undefined' && chrome.runtime) {
  backgroundService.initialize();
}

// Export for testing
export default backgroundService;