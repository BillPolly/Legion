/**
 * ROMAWebSocketClient - WebSocket client for ROMA server communication
 * Handles connection management, reconnection, and message routing
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';
import chalk from 'chalk';

export class ROMAWebSocketClient extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.host = options.host || 'localhost';
    this.port = options.port || 4020;
    this.url = `ws://${this.host}:${this.port}`;
    
    this.ws = null;
    this.isConnected = false;
    this.isReady = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 5;
    this.reconnectDelay = options.reconnectDelay || 1000;
    this.verbose = options.verbose || false;
    
    // Message queue for when disconnected
    this.messageQueue = [];
    
    // Pending requests (for request-response pattern)
    this.pendingRequests = new Map();
    this.requestTimeout = options.requestTimeout || 30000;
  }

  /**
   * Connect to ROMA server
   * @returns {Promise<void>}
   */
  async connect() {
    return new Promise((resolve, reject) => {
      if (this.isConnected) {
        resolve();
        return;
      }

      if (this.verbose) {
        console.log(chalk.gray(`🔗 Connecting to ROMA server at ${this.url}...`));
      }

      try {
        this.ws = new WebSocket(this.url);
        
        this.ws.on('open', () => {
          this.isConnected = true;
          this.reconnectAttempts = 0;
          
          if (this.verbose) {
            console.log(chalk.green('✅ Connected to ROMA server'));
          }
          
          this.emit('connected');
          
          // Process queued messages
          this._processMessageQueue();
          
          resolve();
        });

        this.ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            this._handleMessage(message);
          } catch (error) {
            if (this.verbose) {
              console.error(chalk.red('❌ Failed to parse message:'), error.message);
            }
            this.emit('error', new Error(`Invalid message format: ${error.message}`));
          }
        });

        this.ws.on('close', (code, reason) => {
          this.isConnected = false;
          this.isReady = false;
          
          if (this.verbose) {
            console.log(chalk.yellow(`🔌 Disconnected from ROMA server (${code}: ${reason})`));
          }
          
          this.emit('disconnected', { code, reason });
          
          // Auto-reconnect if not intentional close
          if (code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this._scheduleReconnect();
          }
        });

        this.ws.on('error', (error) => {
          if (this.verbose) {
            console.error(chalk.red('❌ WebSocket error:'), error.message);
          }
          
          this.emit('error', error);
          
          if (!this.isConnected) {
            reject(error);
          }
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Disconnect from server
   */
  disconnect() {
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    this.isConnected = false;
    this.isReady = false;
  }

  /**
   * Send message to server
   * @param {string} type - Message type
   * @param {Object} payload - Message payload
   * @returns {Promise<void>}
   */
  async send(type, payload = {}) {
    const message = { type, payload };
    
    if (!this.isConnected) {
      if (this.verbose) {
        console.log(chalk.yellow('⏳ Queuing message (not connected):'), type);
      }
      this.messageQueue.push(message);
      return;
    }

    try {
      this.ws.send(JSON.stringify(message));
      
      if (this.verbose) {
        console.log(chalk.blue('📤 Sent:'), type);
      }
    } catch (error) {
      if (this.verbose) {
        console.error(chalk.red('❌ Failed to send message:'), error.message);
      }
      throw error;
    }
  }

  /**
   * Send request and wait for response
   * @param {string} type - Request type
   * @param {Object} payload - Request payload
   * @returns {Promise<Object>} Response payload
   */
  async sendRequest(type, payload = {}) {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return new Promise((resolve, reject) => {
      // Set up timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Request timeout: ${type}`));
      }, this.requestTimeout);

      // Store request resolver
      this.pendingRequests.set(requestId, {
        resolve: (response) => {
          clearTimeout(timeout);
          resolve(response);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
        type
      });

      // Send request with ID
      this.send(type, { ...payload, requestId });
    });
  }

  /**
   * Execute a task and return promise that resolves on completion
   * @param {Object} task - Task to execute
   * @returns {Promise<Object>} Execution result
   */
  async executeTask(task) {
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return new Promise((resolve, reject) => {
      // Set up execution tracking
      const executionTimeout = setTimeout(() => {
        reject(new Error('Task execution timeout'));
      }, 300000); // 5 minutes

      // Listen for execution events
      const onExecutionComplete = (payload) => {
        if (payload.executionId === executionId) {
          clearTimeout(executionTimeout);
          this.removeListener('execution_complete', onExecutionComplete);
          this.removeListener('execution_error', onExecutionError);
          resolve(payload);
        }
      };

      const onExecutionError = (payload) => {
        if (payload.executionId === executionId) {
          clearTimeout(executionTimeout);
          this.removeListener('execution_complete', onExecutionComplete);
          this.removeListener('execution_error', onExecutionError);
          reject(new Error(payload.error || 'Task execution failed'));
        }
      };

      this.on('execution_complete', onExecutionComplete);
      this.on('execution_error', onExecutionError);

      // Start execution
      this.send('execute_task', { executionId, task });
    });
  }

  /**
   * Handle incoming messages
   * @private
   */
  _handleMessage(message) {
    const { type, payload } = message;
    
    if (this.verbose) {
      console.log(chalk.cyan('📨 Received:'), type);
    }

    // Handle responses to requests
    if (payload?.requestId && this.pendingRequests.has(payload.requestId)) {
      const request = this.pendingRequests.get(payload.requestId);
      this.pendingRequests.delete(payload.requestId);
      request.resolve(payload);
      return;
    }

    // Handle special messages
    switch (type) {
      case 'ready':
        this.isReady = true;
        this.emit('ready', payload);
        break;
        
      case 'error':
        this.emit('error', new Error(payload.message || 'Server error'));
        break;
        
      default:
        // Emit as event for listeners
        this.emit(type, payload);
    }
  }

  /**
   * Process queued messages
   * @private
   */
  _processMessageQueue() {
    while (this.messageQueue.length > 0 && this.isConnected) {
      const message = this.messageQueue.shift();
      this.ws.send(JSON.stringify(message));
      
      if (this.verbose) {
        console.log(chalk.blue('📤 Sent queued:'), message.type);
      }
    }
  }

  /**
   * Schedule reconnection attempt
   * @private
   */
  _scheduleReconnect() {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    if (this.verbose) {
      console.log(chalk.yellow(`🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`));
    }
    
    setTimeout(() => {
      this.connect().catch(() => {
        // Connection failed, will try again if under limit
      });
    }, delay);
  }

  /**
   * Get connection status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      isReady: this.isReady,
      reconnectAttempts: this.reconnectAttempts,
      queuedMessages: this.messageQueue.length,
      pendingRequests: this.pendingRequests.size
    };
  }

  /**
   * Wait for connection to be ready
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<void>}
   */
  async waitForReady(timeout = 10000) {
    if (this.isReady) {
      return;
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.removeListener('ready', onReady);
        reject(new Error('Timeout waiting for server ready'));
      }, timeout);

      const onReady = () => {
        clearTimeout(timer);
        this.removeListener('ready', onReady);
        resolve();
      };

      this.once('ready', onReady);
    });
  }
}