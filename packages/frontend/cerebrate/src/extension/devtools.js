import { EventEmitter } from 'events';

/**
 * DevTools Manager for Cerebrate Chrome Extension
 * Handles DevTools panel creation and integration
 */
export class DevToolsManager extends EventEmitter {

  constructor() {
    super();
    
    this.panel = null;
    this.initialized = false;
    this.panelVisible = false;
    this.tabId = chrome?.devtools?.inspectedWindow?.tabId || null;
  }

  /**
   * Initialize DevTools integration
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      // Create DevTools panel
      await this.createPanel();
      
      // Setup DevTools API integrations
      this.setupElementsIntegration();
      this.setupNetworkIntegration();
      this.setupMessageHandlers();
      
      this.initialized = true;
      this.emit('initialized');
      
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Create DevTools panel
   * @private
   */
  async createPanel() {
    return new Promise((resolve, reject) => {
      chrome.devtools.panels.create(
        'Cerebrate',
        'assets/icon-24.png',
        'panel.html',
        (panel) => {
          if (!panel) {
            reject(new Error('Failed to create DevTools panel'));
            return;
          }

          this.panel = panel;
          
          // Setup panel event listeners
          panel.onShown.addListener(() => {
            this.panelVisible = true;
            this.emit('visibility-changed', {
              visible: true,
              tabId: this.tabId
            });
          });

          panel.onHidden.addListener(() => {
            this.panelVisible = false;
            this.emit('visibility-changed', {
              visible: false,
              tabId: this.tabId
            });
          });

          resolve(panel);
        }
      );
    });
  }

  /**
   * Setup Elements panel integration
   * @private
   */
  setupElementsIntegration() {
    // Listen for element selection changes
    chrome.devtools.panels.elements.onSelectionChanged.addListener(() => {
      this.evaluateInPage('($0)')
        .then(element => {
          if (element) {
            this.emit('element-selected', { element });
          }
        })
        .catch(error => {
          this.emit('error', error);
        });
    });
  }

  /**
   * Setup Network panel integration
   * @private
   */
  setupNetworkIntegration() {
    // Listen for network requests
    chrome.devtools.network.onRequestFinished.addListener((request) => {
      this.emit('network-request', {
        request: {
          url: request.request.url,
          method: request.request.method,
          headers: request.request.headers,
          postData: request.request.postData
        },
        response: {
          status: request.response.status,
          statusText: request.response.statusText,
          headers: request.response.headers,
          content: request.response.content
        },
        time: request.time,
        startedDateTime: request.startedDateTime
      });
    });
  }

  /**
   * Setup message handlers
   * @private
   */
  setupMessageHandlers() {
    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (sender.tab && sender.tab.id === this.tabId) {
        this.emit('background-message', message);
      }
      return false; // Synchronous response
    });
  }

  /**
   * Evaluate code in the inspected page
   * @param {string} code - Code to evaluate
   * @returns {Promise<*>} - Evaluation result
   */
  async evaluateInPage(code) {
    return new Promise((resolve, reject) => {
      chrome.devtools.inspectedWindow.eval(
        code,
        (result, isException) => {
          if (isException) {
            reject(new Error(`Evaluation failed: ${result}`));
          } else {
            resolve(result);
          }
        }
      );
    });
  }

  /**
   * Send message to background script
   * @param {Object} message - Message to send
   * @returns {Promise<*>} - Response from background
   */
  async sendToBackground(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => {
        resolve(response);
      });
    });
  }

  /**
   * Check if panel is visible
   * @returns {boolean} - True if panel is visible
   */
  isPanelVisible() {
    return this.panelVisible;
  }

  /**
   * Check if initialized
   * @returns {boolean} - True if initialized
   */
  isInitialized() {
    return this.initialized;
  }

  /**
   * Get current tab ID
   * @returns {number|null} - Tab ID or null
   */
  getTabId() {
    return this.tabId;
  }

  /**
   * Destroy DevTools manager and cleanup
   */
  destroy() {
    this.initialized = false;
    this.panelVisible = false;
    this.panel = null;
    this.removeAllListeners();
  }
}

// Create singleton instance
let devToolsManager = null;

/**
 * Get or create DevTools manager instance
 * @returns {DevToolsManager} - DevTools manager instance
 */
export function getDevToolsManager() {
  if (!devToolsManager) {
    devToolsManager = new DevToolsManager();
  }
  return devToolsManager;
}

// Auto-initialize when DevTools page loads
if (typeof chrome !== 'undefined' && chrome.devtools) {
  document.addEventListener('DOMContentLoaded', () => {
    const manager = getDevToolsManager();
    manager.initialize().catch(error => {
      console.error('Failed to initialize DevTools:', error);
    });
  });
}