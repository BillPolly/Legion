/**
 * MockBrowserAgent - WebSocket client simulating Browser agent
 */

import { WebSocket } from 'ws';
import { EventEmitter } from 'events';

export class MockBrowserAgent extends EventEmitter {
  constructor(wsUrl = 'ws://localhost:9901/browser', options = {}) {
    super();
    this.wsUrl = wsUrl;
    this.ws = null;
    this.connected = false;
    this.sessionId = options.sessionId || 'test-session';
    this.pageId = options.pageId || `page-${Date.now()}`;
    this.pageUrl = options.pageUrl || 'http://localhost:3000';
    this.userAgent = options.userAgent || 'Mozilla/5.0 (Test Browser)';
    this.messageQueue = [];
    this.messagesReceived = [];
  }
  
  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      let welcomeReceived = false;
      
      this.ws.on('open', () => {
        // WebSocket is open, but we're not fully connected until we get welcome message
        console.log('Browser WebSocket opened, waiting for welcome message...');
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
          console.log('Browser welcome message received, fully connected');
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
      this.ws.send(JSON.stringify(message));
      return true;
    }
    this.messageQueue.push(message);
    return false;
  }
  
  async identify() {
    return this.send({
      type: 'identify',
      sessionId: this.sessionId,
      pageId: this.pageId,
      pageUrl: this.pageUrl,
      userAgent: this.userAgent,
      timestamp: Date.now()
    });
  }
  
  async sendConsole(method, ...args) {
    return this.send({
      type: 'console',
      method,
      args: args.map(a => String(a)),
      sessionId: this.sessionId,
      pageId: this.pageId,
      location: this.pageUrl,
      timestamp: Date.now()
    });
  }
  
  async sendNetwork(subtype, url, correlationId, options = {}) {
    return this.send({
      type: 'network',
      subtype, // 'request', 'response', 'error'
      url,
      correlationId,
      method: options.method || 'GET',
      status: options.status,
      duration: options.duration,
      sessionId: this.sessionId,
      pageId: this.pageId,
      timestamp: Date.now()
    });
  }
  
  async sendError(message, stack, filename, lineno, colno) {
    return this.send({
      type: 'error',
      message,
      stack,
      filename,
      lineno,
      colno,
      sessionId: this.sessionId,
      pageId: this.pageId,
      timestamp: Date.now()
    });
  }
  
  async sendUnhandledRejection(reason) {
    return this.send({
      type: 'unhandledrejection',
      reason: reason instanceof Error ? {
        message: reason.message,
        stack: reason.stack
      } : String(reason),
      sessionId: this.sessionId,
      pageId: this.pageId,
      timestamp: Date.now()
    });
  }
  
  async sendDomMutation(summary) {
    return this.send({
      type: 'dom-mutation',
      summary,
      sessionId: this.sessionId,
      pageId: this.pageId,
      timestamp: Date.now()
    });
  }
  
  async sendUserInteraction(event, target) {
    return this.send({
      type: 'user-interaction',
      event,
      target,
      sessionId: this.sessionId,
      pageId: this.pageId,
      timestamp: Date.now()
    });
  }
  
  async sendVisibility(hidden, visibilityState) {
    return this.send({
      type: 'visibility',
      hidden,
      visibilityState,
      sessionId: this.sessionId,
      pageId: this.pageId,
      timestamp: Date.now()
    });
  }
  
  async sendWithCorrelation(correlationId, message) {
    return this.send({
      ...message,
      correlationId,
      sessionId: this.sessionId,
      pageId: this.pageId,
      timestamp: Date.now()
    });
  }
  
  // Simulate a correlated API call
  async simulateApiCall(url, correlationId) {
    // Send request
    await this.sendNetwork('request', url, correlationId, { method: 'GET' });
    
    // Log to console with correlation
    await this.sendConsole('log', `[${correlationId}] Fetch GET ${url}`);
    
    // Simulate response after delay
    setTimeout(() => {
      this.sendNetwork('response', url, correlationId, { 
        status: 200, 
        duration: 150 
      });
    }, 150);
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