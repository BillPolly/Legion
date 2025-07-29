/**
 * TestClient - Simple WebSocket client for testing
 * 
 * Provides basic WebSocket communication without complex dependencies.
 * Focuses on testing the actual protocol implementation.
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';

export class TestClient extends EventEmitter {
  constructor() {
    super();
    this.ws = null;
    this.isConnected = false;
    this.messageId = 1;
    this.pendingRequests = new Map();
    this.receivedMessages = [];
    this.sessionId = null;
  }

  /**
   * Connect to WebSocket server
   */
  async connect(url) {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url);
      
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 5000);

      this.ws.on('open', () => {
        clearTimeout(timeout);
        this.isConnected = true;
        this.emit('connected');
        resolve();
      });

      this.ws.on('message', (data) => {
        this._handleMessage(data.toString());
      });

      this.ws.on('close', () => {
        this.isConnected = false;
        this.emit('disconnected');
      });

      this.ws.on('error', (error) => {
        clearTimeout(timeout);
        this.emit('error', error);
        reject(error);
      });
    });
  }

  /**
   * Disconnect from server
   */
  disconnect() {
    if (this.ws && this.isConnected) {
      this.ws.close();
    }
    this.isConnected = false;
  }

  /**
   * Send a message and wait for response
   */
  async sendRequest(type, data = {}) {
    const requestId = `req_${this.messageId++}`;
    
    const message = {
      type,
      requestId,
      ...data
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Request timeout: ${requestId}`));
      }, 10000);

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
   * Create a session
   */  
  async createSession() {
    const response = await this.sendRequest('session_create');
    if (response.success && response.sessionId) {
      this.sessionId = response.sessionId;
      return response;
    }
    throw new Error('Failed to create session');
  }

  /**
   * Execute a tool
   */
  async executeTool(toolName, args = {}) {
    if (!this.sessionId) {
      throw new Error('No session created. Call createSession() first.');
    }

    return this.sendRequest('tool_request', {
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      }
    });
  }

  /**
   * List available tools
   */
  async listTools() {
    if (!this.sessionId) {
      throw new Error('No session created. Call createSession() first.');
    }

    return this.sendRequest('tool_request', {
      method: 'tools/list',
      params: {}
    });
  }

  /**
   * Load a module
   */
  async loadModule(moduleName) {
    return this.executeTool('module_load', { name: moduleName });
  }

  /**
   * Wait for a specific message type
   */
  async waitForMessage(messageType, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for message type: ${messageType}`));
      }, timeout);

      // Check if we already received this message type
      const existing = this.receivedMessages.find(msg => msg.type === messageType);
      if (existing) {
        clearTimeout(timer);
        resolve(existing);
        return;
      }

      // Listen for new messages
      const handler = (message) => {
        if (message.type === messageType) {
          clearTimeout(timer);
          this.removeListener('message', handler);
          resolve(message);
        }
      };

      this.on('message', handler);
    });
  }

  /**
   * Get all received messages
   */
  getReceivedMessages() {
    return [...this.receivedMessages];
  }

  /**
   * Clear received messages
   */
  clearMessages() {
    this.receivedMessages = [];
  }

  /**
   * Handle incoming message
   */
  _handleMessage(data) {
    try {
      const message = JSON.parse(data);
      this.receivedMessages.push(message);
      this.emit('message', message);

      // Handle responses to pending requests
      if (message.requestId && this.pendingRequests.has(message.requestId)) {
        const pending = this.pendingRequests.get(message.requestId);
        
        if (message.error) {
          const errorMessage = typeof message.error === 'string' 
            ? message.error 
            : (message.error.message || JSON.stringify(message.error) || 'Request failed');
          pending.reject(new Error(errorMessage));
        } else {
          pending.resolve(message);
        }
      }
    } catch (error) {
      console.error('Failed to parse message:', error);
      this.emit('error', error);
    }
  }
}