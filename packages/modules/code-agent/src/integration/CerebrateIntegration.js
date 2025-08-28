/**
 * CerebrateIntegration - Integration layer between CodeAgent and Cerebrate
 * 
 * Provides WebSocket communication with Cerebrate Chrome DevTools extension
 * and coordinates debugging workflows between browser automation and extension.
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';

class CerebrateIntegration extends EventEmitter {
  constructor(codeAgent, config = {}) {
    super();
    
    this.codeAgent = codeAgent;
    this.config = {
      cerebrateServerUrl: config.cerebrateServerUrl || 'ws://localhost:9222',
      reconnectAttempts: config.reconnectAttempts || 5,
      reconnectDelay: config.reconnectDelay || 1000,
      messageTimeout: config.messageTimeout || 30000,
      ...config
    };
    
    // Connection management
    this.ws = null;
    this.connected = false;
    this.reconnectCount = 0;
    this.messageId = 0;
    
    // Message handling
    this.pendingMessages = new Map();
    this.messageHandlers = new Map();
    
    // Session management
    this.sessionId = null;
    this.extensionConnected = false;
    
    // Debugging state
    this.debuggingSessions = new Map();
    
    this._setupMessageHandlers();
  }

  /**
   * Initialize connection to Cerebrate server
   * @returns {Promise<void>}
   */
  async initialize() {
    this.codeAgent.emit('info', {
      message: 'Initializing Cerebrate integration'
    });

    try {
      await this._connect();
      
      this.codeAgent.emit('info', {
        message: 'Cerebrate integration initialized successfully'
      });
      
    } catch (error) {
      this.codeAgent.emit('error', {
        message: `Failed to initialize Cerebrate integration: ${error.message}`,
        error
      });
      throw error;
    }
  }

  /**
   * Connect to Cerebrate WebSocket server
   * @private
   */
  async _connect() {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.cerebrateServerUrl);
        
        this.ws.on('open', () => {
          this.connected = true;
          this.reconnectCount = 0;
          
          this.codeAgent.emit('info', {
            message: `Connected to Cerebrate server: ${this.config.cerebrateServerUrl}`
          });
          
          // Request session initialization
          this._sendMessage('session_init', {
            clientType: 'code-agent',
            version: '1.0.0'
          });
          
          resolve();
        });

        this.ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            this._handleMessage(message);
          } catch (error) {
            this.codeAgent.emit('error', {
              message: `Failed to parse message from Cerebrate: ${error.message}`,
              error
            });
          }
        });

        this.ws.on('close', () => {
          this.connected = false;
          this.extensionConnected = false;
          
          this.codeAgent.emit('warning', {
            message: 'Cerebrate connection closed'
          });
          
          // Attempt reconnection if configured
          if (this.reconnectCount < this.config.reconnectAttempts) {
            setTimeout(() => {
              this.reconnectCount++;
              this.codeAgent.emit('info', {
                message: `Attempting to reconnect to Cerebrate (${this.reconnectCount}/${this.config.reconnectAttempts})`
              });
              this._connect().catch(() => {});
            }, this.config.reconnectDelay * this.reconnectCount);
          }
        });

        this.ws.on('error', (error) => {
          this.codeAgent.emit('error', {
            message: `Cerebrate WebSocket error: ${error.message}`,
            error
          });
          
          if (!this.connected) {
            reject(error);
          }
        });

        // Set connection timeout
        setTimeout(() => {
          if (!this.connected) {
            reject(new Error('Connection timeout'));
          }
        }, 10000);

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Set up message handlers
   * @private
   */
  _setupMessageHandlers() {
    this.messageHandlers.set('session_init_response', (message) => {
      this.sessionId = message.data.sessionId;
      this.codeAgent.emit('info', {
        message: `Cerebrate session established: ${this.sessionId}`
      });
    });

    this.messageHandlers.set('extension_connected', (message) => {
      this.extensionConnected = true;
      this.codeAgent.emit('info', {
        message: 'Cerebrate Chrome extension connected'
      });
      this.emit('extension_ready');
    });

    this.messageHandlers.set('extension_disconnected', (message) => {
      this.extensionConnected = false;
      this.codeAgent.emit('warning', {
        message: 'Cerebrate Chrome extension disconnected'
      });
      this.emit('extension_disconnected');
    });

    this.messageHandlers.set('debug_response', (message) => {
      const pendingMessage = this.pendingMessages.get(message.correlationId);
      if (pendingMessage) {
        clearTimeout(pendingMessage.timeout);
        pendingMessage.resolve(message.data);
        this.pendingMessages.delete(message.correlationId);
      }
    });

    this.messageHandlers.set('debug_event', (message) => {
      this.emit('debug_event', message.data);
    });

    this.messageHandlers.set('error', (message) => {
      this.codeAgent.emit('error', {
        message: `Cerebrate error: ${message.data.error}`,
        data: message.data
      });
    });
  }

  /**
   * Handle incoming messages
   * @param {Object} message - Incoming message
   * @private
   */
  _handleMessage(message) {
    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      handler(message);
    } else {
      this.codeAgent.emit('warning', {
        message: `Unknown message type from Cerebrate: ${message.type}`
      });
    }
  }

  /**
   * Send message to Cerebrate server
   * @param {string} type - Message type
   * @param {Object} data - Message data
   * @param {boolean} expectResponse - Whether to expect a response
   * @returns {Promise<Object>} - Response data if expectResponse is true
   * @private
   */
  async _sendMessage(type, data = {}, expectResponse = false) {
    if (!this.connected || !this.ws) {
      throw new Error('Not connected to Cerebrate server');
    }

    const messageId = ++this.messageId;
    const message = {
      id: messageId,
      type,
      data,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId
    };

    if (expectResponse) {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          this.pendingMessages.delete(messageId);
          reject(new Error(`Message timeout: ${type}`));
        }, this.config.messageTimeout);

        this.pendingMessages.set(messageId, { resolve, reject, timeout });
        
        this.ws.send(JSON.stringify(message));
      });
    } else {
      this.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Start debugging session for a specific URL
   * @param {string} url - URL to debug
   * @param {Object} options - Debugging options
   * @returns {Promise<Object>} - Debug session info
   */
  async startDebuggingSession(url, options = {}) {
    if (!this.extensionConnected) {
      throw new Error('Cerebrate Chrome extension not connected');
    }

    this.codeAgent.emit('info', {
      message: `Starting debugging session for: ${url}`
    });

    const sessionData = {
      url,
      options: {
        enableDOMInspection: true,
        enablePerformanceMonitoring: true,
        enableErrorCapture: true,
        enableNetworkCapture: false,
        ...options
      }
    };

    try {
      const response = await this._sendMessage('start_debug_session', sessionData, true);
      
      const sessionId = response.sessionId;
      this.debuggingSessions.set(sessionId, {
        url,
        options: sessionData.options,
        startTime: new Date(),
        status: 'active'
      });

      this.codeAgent.emit('info', {
        message: `Debug session started: ${sessionId}`
      });

      return {
        success: true,
        sessionId,
        url,
        options: sessionData.options
      };

    } catch (error) {
      this.codeAgent.emit('error', {
        message: `Failed to start debugging session: ${error.message}`,
        error
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Execute debug command through Cerebrate extension
   * @param {string} sessionId - Debug session ID
   * @param {string} command - Debug command
   * @param {Object} params - Command parameters
   * @returns {Promise<Object>} - Command result
   */
  async executeDebugCommand(sessionId, command, params = {}) {
    if (!this.debuggingSessions.has(sessionId)) {
      throw new Error(`Debug session not found: ${sessionId}`);
    }

    this.codeAgent.emit('info', {
      message: `Executing debug command: ${command}`
    });

    try {
      const response = await this._sendMessage('debug_command', {
        sessionId,
        command,
        params
      }, true);

      return {
        success: true,
        command,
        result: response.result,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.codeAgent.emit('error', {
        message: `Debug command failed: ${error.message}`,
        command,
        error
      });
      
      return {
        success: false,
        command,
        error: error.message
      };
    }
  }

  /**
   * Inspect DOM element using Cerebrate
   * @param {string} sessionId - Debug session ID
   * @param {string} selector - CSS selector
   * @returns {Promise<Object>} - Element inspection result
   */
  async inspectElement(sessionId, selector) {
    return this.executeDebugCommand(sessionId, 'inspect_element', {
      selector,
      includeComputed: true,
      includeAccessibility: true
    });
  }

  /**
   * Analyze page performance using Cerebrate
   * @param {string} sessionId - Debug session ID
   * @returns {Promise<Object>} - Performance analysis result
   */
  async analyzePerformance(sessionId) {
    return this.executeDebugCommand(sessionId, 'analyze_performance', {
      includeNetworkTiming: true,
      includeRenderMetrics: true,
      includeResourceUsage: true
    });
  }

  /**
   * Capture page errors using Cerebrate
   * @param {string} sessionId - Debug session ID
   * @returns {Promise<Object>} - Error capture result
   */
  async captureErrors(sessionId) {
    return this.executeDebugCommand(sessionId, 'capture_errors', {
      includeJavaScriptErrors: true,
      includeNetworkErrors: true,
      includeConsoleErrors: true
    });
  }

  /**
   * End debugging session
   * @param {string} sessionId - Debug session ID
   * @returns {Promise<Object>} - Session termination result
   */
  async endDebuggingSession(sessionId) {
    if (!this.debuggingSessions.has(sessionId)) {
      throw new Error(`Debug session not found: ${sessionId}`);
    }

    try {
      await this._sendMessage('end_debug_session', { sessionId });
      
      const session = this.debuggingSessions.get(sessionId);
      session.status = 'ended';
      session.endTime = new Date();
      
      this.codeAgent.emit('info', {
        message: `Debug session ended: ${sessionId}`
      });

      return {
        success: true,
        sessionId,
        duration: session.endTime - session.startTime
      };

    } catch (error) {
      this.codeAgent.emit('error', {
        message: `Failed to end debugging session: ${error.message}`,
        error
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get debugging session info
   * @param {string} sessionId - Debug session ID
   * @returns {Object|null} - Session info or null if not found
   */
  getDebuggingSession(sessionId) {
    return this.debuggingSessions.get(sessionId) || null;
  }

  /**
   * Get all active debugging sessions
   * @returns {Array} - Array of active sessions
   */
  getActiveDebuggingSessions() {
    return Array.from(this.debuggingSessions.entries())
      .filter(([, session]) => session.status === 'active')
      .map(([id, session]) => ({ id, ...session }));
  }

  /**
   * Check if connected to Cerebrate server
   * @returns {boolean} - Connection status
   */
  isConnected() {
    return this.connected;
  }

  /**
   * Check if Chrome extension is connected
   * @returns {boolean} - Extension connection status
   */
  isExtensionConnected() {
    return this.extensionConnected;
  }

  /**
   * Wait for extension to be ready
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<boolean>} - Extension ready status
   */
  async waitForExtension(timeout = 30000) {
    if (this.extensionConnected) {
      return true;
    }

    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        this.off('extension_ready', onReady);
        resolve(false);
      }, timeout);

      const onReady = () => {
        clearTimeout(timeoutId);
        resolve(true);
      };

      this.once('extension_ready', onReady);
    });
  }

  /**
   * Disconnect from Cerebrate server
   * @returns {Promise<void>}
   */
  async disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.connected = false;
    this.extensionConnected = false;
    this.sessionId = null;
    
    // Clear pending messages
    for (const pending of this.pendingMessages.values()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Connection closed'));
    }
    this.pendingMessages.clear();
    
    this.codeAgent.emit('info', {
      message: 'Disconnected from Cerebrate server'
    });
  }

  /**
   * Generate integration status report
   * @returns {Object} - Status report
   */
  generateStatusReport() {
    return {
      connection: {
        connected: this.connected,
        extensionConnected: this.extensionConnected,
        sessionId: this.sessionId,
        serverUrl: this.config.cerebrateServerUrl,
        reconnectCount: this.reconnectCount
      },
      debugging: {
        activeSessions: this.getActiveDebuggingSessions().length,
        totalSessions: this.debuggingSessions.size,
        sessions: Array.from(this.debuggingSessions.entries()).map(([id, session]) => ({
          id,
          url: session.url,
          status: session.status,
          duration: session.endTime ? session.endTime - session.startTime : Date.now() - session.startTime
        }))
      },
      messaging: {
        pendingMessages: this.pendingMessages.size,
        messageId: this.messageId
      },
      generatedAt: new Date().toISOString()
    };
  }
}

export { CerebrateIntegration };