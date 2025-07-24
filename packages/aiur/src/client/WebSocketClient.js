/**
 * WebSocketClient - WebSocket client wrapper for MCP stub
 * 
 * Handles connection, reconnection, and request/response management
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';

export class WebSocketClient extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      url: config.url || `ws://${process.env.AIUR_SERVER_HOST || 'localhost'}:${process.env.AIUR_SERVER_PORT || 8080}/ws`,
      reconnectInterval: config.reconnectInterval || 1000,
      maxReconnectInterval: config.maxReconnectInterval || 30000,
      reconnectDecay: config.reconnectDecay || 1.5,
      maxReconnectAttempts: config.maxReconnectAttempts || null,
      requestTimeout: config.requestTimeout || 30000
    };
    
    this.ws = null;
    this.connected = false;
    this.reconnectAttempts = 0;
    this.sessionId = null;
    this.pendingRequests = new Map();
    this.requestIdCounter = 0;
    this.reconnectTimer = null;
    this.connectPromise = null;
  }

  /**
   * Connect to the WebSocket server
   * @returns {Promise} Resolves when connected and session is created/attached
   */
  async connect() {
    if (this.connectPromise) {
      return this.connectPromise;
    }
    
    this.connectPromise = this._doConnect();
    return this.connectPromise;
  }

  /**
   * Internal connection implementation
   * @private
   */
  async _doConnect() {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.url);
        
        this.ws.on('open', async () => {
          this.connected = true;
          this.reconnectAttempts = 0;
          this.emit('connected');
          
          // Clear any reconnect timer
          if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
          }
          
          try {
            // Create or attach to session
            if (this.sessionId) {
              // Reattach to existing session
              await this._attachSession(this.sessionId);
            } else {
              // Create new session
              await this._createSession();
            }
            
            this.connectPromise = null;
            resolve();
          } catch (error) {
            this.connectPromise = null;
            reject(error);
          }
        });
        
        this.ws.on('message', (data) => {
          this._handleMessage(data);
        });
        
        this.ws.on('close', () => {
          this.connected = false;
          this.connectPromise = null;
          this.emit('disconnected');
          this._handleDisconnection();
        });
        
        this.ws.on('error', (error) => {
          this.emit('error', error);
          if (this.connectPromise) {
            this.connectPromise = null;
            reject(error);
          }
        });
        
      } catch (error) {
        this.connectPromise = null;
        reject(error);
      }
    });
  }

  /**
   * Create a new session
   * @private
   */
  async _createSession() {
    const response = await this.sendRequest({
      type: 'session_create'
    });
    
    if (response.sessionId) {
      this.sessionId = response.sessionId;
      this.emit('session_created', response);
    } else {
      throw new Error('Failed to create session');
    }
  }

  /**
   * Attach to existing session
   * @private
   */
  async _attachSession(sessionId) {
    const response = await this.sendRequest({
      type: 'session_attach',
      sessionId
    });
    
    if (response.sessionId) {
      this.emit('session_attached', response);
    } else {
      // Session might have expired, create new one
      this.sessionId = null;
      await this._createSession();
    }
  }

  /**
   * Send a request and wait for response
   * @param {Object} message - Message to send
   * @returns {Promise} Resolves with response
   */
  sendRequest(message) {
    return new Promise((resolve, reject) => {
      if (!this.connected || !this.ws) {
        reject(new Error('Not connected'));
        return;
      }
      
      const requestId = `req_${++this.requestIdCounter}`;
      message.requestId = requestId;
      
      // Set up timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Request timeout: ${message.type || message.method}`));
      }, this.config.requestTimeout);
      
      // Store pending request
      this.pendingRequests.set(requestId, {
        resolve,
        reject,
        timeout,
        message
      });
      
      // Send message
      this.ws.send(JSON.stringify(message));
    });
  }

  /**
   * Send an MCP request
   * @param {string} method - MCP method
   * @param {Object} params - Method parameters
   * @returns {Promise} Resolves with result
   */
  async sendMcpRequest(method, params = {}) {
    const response = await this.sendRequest({
      type: 'mcp_request',
      method,
      params,
      sessionId: this.sessionId
    });
    
    if (response.error) {
      throw new Error(response.error.message || 'MCP request failed');
    }
    
    return response.result;
  }

  /**
   * Handle incoming message
   * @private
   */
  _handleMessage(data) {
    try {
      const message = JSON.parse(data.toString());
      
      // Handle responses to pending requests
      if (message.requestId && this.pendingRequests.has(message.requestId)) {
        const pending = this.pendingRequests.get(message.requestId);
        this.pendingRequests.delete(message.requestId);
        clearTimeout(pending.timeout);
        
        if (message.error) {
          pending.reject(new Error(message.error.message || 'Request failed'));
        } else {
          pending.resolve(message);
        }
        return;
      }
      
      // Handle other message types
      switch (message.type) {
        case 'welcome':
          this.emit('welcome', message);
          break;
          
        case 'event':
          this.emit('event', message);
          break;
          
        case 'pong':
          this.emit('pong', message);
          break;
          
        default:
          this.emit('message', message);
      }
      
    } catch (error) {
      this.emit('error', error);
    }
  }

  /**
   * Handle disconnection
   * @private
   */
  _handleDisconnection() {
    // Clear all pending requests
    for (const [requestId, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Connection lost'));
    }
    this.pendingRequests.clear();
    
    // Attempt reconnection if allowed
    if (this.config.maxReconnectAttempts === null || 
        this.reconnectAttempts < this.config.maxReconnectAttempts) {
      this._scheduleReconnect();
    }
  }

  /**
   * Schedule reconnection attempt
   * @private
   */
  _scheduleReconnect() {
    if (this.reconnectTimer) {
      return;
    }
    
    const interval = Math.min(
      this.config.reconnectInterval * Math.pow(this.config.reconnectDecay, this.reconnectAttempts),
      this.config.maxReconnectInterval
    );
    
    this.reconnectAttempts++;
    this.emit('reconnecting', { attempt: this.reconnectAttempts, interval });
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch(() => {
        // Ignore error, will retry
      });
    }, interval);
  }

  /**
   * Send a ping to keep connection alive
   */
  ping() {
    if (this.connected && this.ws) {
      this.ws.send(JSON.stringify({ type: 'ping' }));
    }
  }

  /**
   * Disconnect from server
   */
  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.connected = false;
    this.sessionId = null;
  }

  /**
   * Check if connected
   * @returns {boolean} Connection status
   */
  isConnected() {
    return this.connected && this.ws && this.ws.readyState === WebSocket.OPEN;
  }
}

export default WebSocketClient;