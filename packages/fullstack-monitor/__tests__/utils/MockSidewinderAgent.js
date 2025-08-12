/**
 * MockSidewinderAgent - WebSocket client simulating Sidewinder agent
 */

import { WebSocket } from 'ws';
import { EventEmitter } from 'events';

export class MockSidewinderAgent extends EventEmitter {
  constructor(wsUrl = 'ws://localhost:9901/sidewinder', options = {}) {
    super();
    this.wsUrl = wsUrl;
    this.ws = null;
    this.connected = false;
    this.sessionId = options.sessionId || 'test-session';
    this.pid = options.pid || process.pid;
    this.messageQueue = [];
    this.messagesReceived = [];
  }
  
  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      let welcomeReceived = false;
      
      this.ws.on('open', () => {
        // WebSocket is open, but we're not fully connected until we get welcome message
        console.log('WebSocket opened, waiting for welcome message...');
      });
      
      this.ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        this.messagesReceived.push(message);
        this.emit('message', message);
        
        // Check if this is the welcome message
        if (message.type === 'connected' && !welcomeReceived) {
          welcomeReceived = true;
          this.connected = true;
          this.clientId = message.clientId;
          this.emit('connected');
          console.log('Welcome message received, fully connected');
          resolve();
        }
      });
      
      this.ws.on('close', () => {
        this.connected = false;
        this.emit('disconnected');
        if (!welcomeReceived) {
          reject(new Error('Connection closed before welcome message'));
        }
      });
      
      this.ws.on('error', (error) => {
        this.emit('error', error);
        reject(error);
      });
      
      // Set timeout for full connection (including welcome message)
      setTimeout(() => {
        if (!this.connected || !welcomeReceived) {
          this.ws?.close();
          reject(new Error('Connection timeout - welcome message not received'));
        }
      }, 5000);
    });
  }
  
  send(message) {
    if (this.connected && this.ws) {
      try {
        this.ws.send(JSON.stringify(message));
        return true;
      } catch (error) {
        if (error.message.includes('circular')) {
          // Handle circular references by creating a safe copy
          const safeMessage = this._handleCircularReferences(message);
          this.ws.send(JSON.stringify(safeMessage));
          return true;
        }
        throw error;
      }
    }
    this.messageQueue.push(message);
    return false;
  }

  _handleCircularReferences(obj, seen = new WeakSet()) {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    
    if (seen.has(obj)) {
      return '[Circular Reference]';
    }
    
    seen.add(obj);
    
    if (Array.isArray(obj)) {
      return obj.map(item => this._handleCircularReferences(item, seen));
    }
    
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = this._handleCircularReferences(value, seen);
    }
    
    return result;
  }
  
  async identify() {
    return this.send({
      type: 'identify',
      sessionId: this.sessionId,
      pid: this.pid,
      profile: 'test'
    });
  }
  
  async sendConsole(method, ...args) {
    return this.send({
      type: 'console',
      method,
      args,
      sessionId: this.sessionId,
      pid: this.pid,
      timestamp: Date.now()
    });
  }
  
  async sendProcessStart(argv = process.argv, cwd = process.cwd()) {
    return this.send({
      type: 'processStart',
      pid: this.pid,
      argv,
      cwd,
      timestamp: Date.now()
    });
  }
  
  async sendError(error) {
    return this.send({
      type: 'uncaughtException',
      sessionId: this.sessionId,
      pid: this.pid,
      error: {
        message: error.message,
        stack: error.stack,
        code: error.code
      },
      timestamp: Date.now()
    });
  }
  
  async sendProcessExit(code = 0) {
    return this.send({
      type: 'processExit',
      sessionId: this.sessionId,
      pid: this.pid,
      code,
      timestamp: Date.now()
    });
  }
  
  async sendServerLifecycle(event, port) {
    return this.send({
      type: 'server-lifecycle',
      event,
      port,
      sessionId: this.sessionId,
      pid: this.pid,
      timestamp: Date.now()
    });
  }
  
  async sendWithCorrelation(correlationId, message) {
    return this.send({
      ...message,
      correlationId,
      sessionId: this.sessionId,
      pid: this.pid,
      timestamp: Date.now()
    });
  }
  
  async disconnect() {
    if (this.ws) {
      this.ws.close();
      this.connected = false;
    }
  }
  
  // Helper to wait for a specific message type
  async waitForMessage(type, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for message type: ${type}`));
      }, timeout);
      
      const checkExisting = this.messagesReceived.find(m => m.type === type);
      if (checkExisting) {
        clearTimeout(timer);
        resolve(checkExisting);
        return;
      }
      
      const handler = (message) => {
        if (message.type === type) {
          clearTimeout(timer);
          this.off('message', handler);
          resolve(message);
        }
      };
      
      this.on('message', handler);
    });
  }
  
  getReceivedMessages() {
    return this.messagesReceived;
  }
  
  clearReceivedMessages() {
    this.messagesReceived = [];
  }
}