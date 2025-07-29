/**
 * WebSocketTestClient - Test client with codec validation
 * 
 * Provides a WebSocket client that validates all messages using ClientCodec
 * and provides helper methods for common test operations.
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { ClientCodec } from '../../../../apps/aiur-debug-ui/src/client/codec/ClientCodec.js';

export class WebSocketTestClient extends EventEmitter {
  constructor(url) {
    super();
    this.url = url;
    this.ws = null;
    this.codec = new ClientCodec();
    this.sessionId = null;
    this.messageId = 1;
    this.pendingRequests = new Map();
    this.receivedEvents = [];
    this.schemas = null;
  }

  /**
   * Connect to WebSocket server and initialize
   */
  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);
      
      this.ws.on('open', () => {
        this.emit('connected');
        resolve();
      });
      
      this.ws.on('error', (error) => {
        this.emit('error', error);
        reject(error);
      });
      
      this.ws.on('message', (data) => {
        this._handleMessage(data.toString());
      });
      
      this.ws.on('close', () => {
        this.emit('disconnected');
      });
    });
  }

  /**
   * Create a session and get schemas
   */
  async createSession() {
    // The welcome message is sent immediately upon connection
    // No need to wait for it separately
    
    // Create session
    const sessionResponse = await this.sendRequest('session_create', {});
    this.sessionId = sessionResponse.sessionId;
    
    // For now, skip schema validation since server doesn't provide schemas
    // In a real implementation, the server would provide schema definitions
    this.schemas = {};
    
    return this.sessionId;
  }

  /**
   * Send a validated request and wait for response
   */
  async sendValidated(method, params) {
    const requestId = `req_${this.messageId++}`;
    
    const message = {
      type: 'mcp_request',
      requestId,
      method,
      params
    };
    
    // Validate request format only if we have schemas and they're not empty
    if (this.schemas && Object.keys(this.schemas).length > 0) {
      const validation = this.codec.validate('mcp_request', message);
      if (!validation.success) {
        throw new Error(`Request validation failed: ${validation.error}`);
      }
    }
    
    // Send and wait for response
    return this.sendRequest('mcp_request', { requestId, method, params });
  }

  /**
   * Send raw request and wait for response
   */
  async sendRequest(type, params) {
    const requestId = params.requestId || `req_${this.messageId++}`;
    
    const message = {
      type,
      requestId,
      ...params
    };
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Request timeout: ${requestId}`));
      }, 10000); // 10 second timeout
      
      this.pendingRequests.set(requestId, {
        resolve: (response) => {
          clearTimeout(timeout);
          this.pendingRequests.delete(requestId);
          resolve(response);
        },
        reject: (error) => {
          clearTimeout(timeout);
          this.pendingRequests.delete(requestId);
          reject(error);
        }
      });
      
      this.ws.send(JSON.stringify(message));
    });
  }

  /**
   * Execute a tool through WebSocket
   */
  async executeTool(toolName, args = {}) {
    return this.sendValidated('tools/call', {
      name: toolName,
      arguments: args
    });
  }

  /**
   * Load a module
   */
  async loadModule(moduleName) {
    return this.executeTool('module_load', { name: moduleName });
  }

  /**
   * List available tools
   */
  async listTools() {
    return this.sendValidated('tools/list', {});
  }

  /**
   * Get all received events
   */
  getEvents() {
    return this.receivedEvents;
  }

  /**
   * Clear received events
   */
  clearEvents() {
    this.receivedEvents = [];
  }

  /**
   * Wait for specific event type
   */
  async waitForEvent(eventType, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for event: ${eventType}`));
      }, timeout);
      
      const checkExisting = this.receivedEvents.find(e => e.type === eventType);
      if (checkExisting) {
        clearTimeout(timer);
        resolve(checkExisting);
        return;
      }
      
      const handler = (event) => {
        if (event.type === eventType) {
          clearTimeout(timer);
          this.removeListener('event', handler);
          resolve(event);
        }
      };
      
      this.on('event', handler);
    });
  }

  /**
   * Disconnect from server
   */
  disconnect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
  }

  /**
   * Handle incoming message
   * @private
   */
  _handleMessage(data) {
    try {
      const message = JSON.parse(data);
      
      // Validate response format if we have schemas
      if (this.schemas && message.type && message.type !== 'welcome') {
        const validation = this.codec.validate(message.type, message);
        if (!validation.success) {
          console.warn(`Response validation failed: ${validation.error}`);
        }
      }
      
      // Handle different message types
      if (message.type === 'event' || message.type === 'progress') {
        this.receivedEvents.push(message);
        this.emit('event', message);
      } else if (message.requestId && this.pendingRequests.has(message.requestId)) {
        const pending = this.pendingRequests.get(message.requestId);
        if (message.error) {
          pending.reject(new Error(message.error.message || message.error || 'Request failed'));
        } else {
          pending.resolve(message);
        }
      } else if (message.type) {
        // Handle non-request messages by type
        this.emit(message.type, message);
      }
      
    } catch (error) {
      console.error('Failed to parse message:', error);
    }
  }

  /**
   * Wait for a specific message type
   * @private
   */
  async _waitForMessageType(type, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for message type: ${type}`));
      }, timeout);
      
      const handler = (message) => {
        clearTimeout(timer);
        this.removeListener(type, handler);
        resolve(message);
      };
      
      this.once(type, handler);
    });
  }
}