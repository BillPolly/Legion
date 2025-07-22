/**
 * WebSocket Connection Mock for Testing
 * Simulates WebSocket behavior for extension testing
 */
import { EventEmitter } from 'events';

export class WebSocketConnectionMock extends EventEmitter {
  constructor(url, options = {}) {
    super();
    
    this.url = url;
    this.config = {
      autoConnect: options.autoConnect !== false,
      messageDelay: options.messageDelay || 10,
      failureMode: options.failureMode || false,
      instabilityRate: options.instabilityRate || 0.0,
      ...options
    };
    
    // WebSocket states
    this.CONNECTING = 0;
    this.OPEN = 1;
    this.CLOSING = 2;
    this.CLOSED = 3;
    
    this.readyState = this.CLOSED;
    this.messageQueue = [];
    this.sentMessages = [];
    this.receivedMessages = [];
    
    // Mock connection properties
    this.protocol = '';
    this.extensions = '';
    this.binaryType = 'blob';
    
    // Instability simulation
    this.failureMode = false;
    this.instabilityMode = false;
    this.instabilityRate = 0.0;
    
    if (this.config.autoConnect) {
      setTimeout(() => this.connect(), 0);
    }
  }
  
  /**
   * Connect to WebSocket server
   */
  connect() {
    if (this.readyState === this.OPEN || this.readyState === this.CONNECTING) {
      return;
    }
    
    this.readyState = this.CONNECTING;
    
    // Simulate connection delay
    setTimeout(() => {
      if (this.failureMode || this.config.failureMode) {
        this.handleConnectionError();
      } else {
        this.handleConnectionSuccess();
      }
    }, this.config.messageDelay);
  }
  
  /**
   * Handle successful connection
   * @private
   */
  handleConnectionSuccess() {
    this.readyState = this.OPEN;
    this.emit('open', new Event('open'));
    
    // Send queued messages
    this.processMessageQueue();
  }
  
  /**
   * Handle connection error
   * @private
   */
  handleConnectionError() {
    this.readyState = this.CLOSED;
    const error = new Error('Connection failed');
    this.emit('error', error);
  }
  
  /**
   * Send message
   * @param {string|ArrayBuffer|Blob} data - Message data
   */
  send(data) {
    if (this.readyState !== this.OPEN) {
      // Queue message for later sending
      this.messageQueue.push(data);
      return;
    }
    
    // Check for instability
    if (this.instabilityMode && Math.random() < this.instabilityRate) {
      this.simulateDisconnection();
      return;
    }
    
    this.sentMessages.push({
      data: data,
      timestamp: Date.now()
    });
    
    // Auto-generate response for testing
    this.generateAutoResponse(data);
  }
  
  /**
   * Generate automatic response for testing
   * @param {string} data - Original message data
   * @private
   */
  generateAutoResponse(data) {
    setTimeout(() => {
      if (this.readyState !== this.OPEN) return;
      
      try {
        const message = JSON.parse(data);
        const response = this.createMockResponse(message);
        
        this.receivedMessages.push({
          data: JSON.stringify(response),
          timestamp: Date.now()
        });
        
        // Emit message event
        const messageEvent = {
          data: JSON.stringify(response),
          origin: this.url,
          lastEventId: '',
          source: null,
          ports: []
        };
        
        this.emit('message', messageEvent);
      } catch (error) {
        // Invalid JSON - send error response
        const errorResponse = {
          id: 'error',
          type: 'error',
          error: {
            code: 'INVALID_JSON',
            message: 'Invalid JSON message'
          }
        };
        
        const messageEvent = {
          data: JSON.stringify(errorResponse),
          origin: this.url
        };
        
        this.emit('message', messageEvent);
      }
    }, this.config.messageDelay);
  }
  
  /**
   * Create mock response for a message
   * @param {Object} message - Original message
   * @returns {Object} - Mock response
   * @private
   */
  createMockResponse(message) {
    if (message.type === 'ping') {
      return {
        id: message.id,
        type: 'pong',
        timestamp: Date.now()
      };
    }
    
    if (message.type === 'command') {
      return {
        id: message.id,
        type: 'response',
        success: true,
        data: this.generateMockCommandData(message.command, message.params)
      };
    }
    
    // Generic response
    return {
      id: message.id || 'auto-response',
      type: 'response',
      success: true,
      data: { message: 'Mock response', original: message }
    };
  }
  
  /**
   * Generate mock data for command responses
   * @param {string} command - Command name
   * @param {Object} params - Command parameters
   * @returns {Object} - Mock data
   * @private
   */
  generateMockCommandData(command, params = {}) {
    switch (command) {
      case 'inspect_element':
        return {
          element: {
            tagName: 'DIV',
            id: params.selector?.replace('#', '') || 'mock-element',
            className: 'mock-class',
            textContent: 'Mock content'
          }
        };
        
      case 'analyze_javascript':
        return {
          syntax: 'valid',
          complexity: 'low',
          issues: ['Mock issue'],
          suggestions: ['Mock suggestion']
        };
        
      case 'audit_accessibility':
        return {
          score: 85,
          issues: [],
          recommendations: ['Mock recommendation']
        };
        
      default:
        return { result: `Mock response for ${command}` };
    }
  }
  
  /**
   * Close WebSocket connection
   * @param {number} code - Close code
   * @param {string} reason - Close reason
   */
  close(code = 1000, reason = 'Normal closure') {
    if (this.readyState === this.CLOSED || this.readyState === this.CLOSING) {
      return;
    }
    
    this.readyState = this.CLOSING;
    
    setTimeout(() => {
      this.readyState = this.CLOSED;
      
      const closeEvent = {
        code: code,
        reason: reason,
        wasClean: code === 1000
      };
      
      this.emit('close', closeEvent);
    }, this.config.messageDelay);
  }
  
  /**
   * Process queued messages
   * @private
   */
  processMessageQueue() {
    const queue = [...this.messageQueue];
    this.messageQueue = [];
    
    queue.forEach(message => {
      this.send(message);
    });
  }
  
  /**
   * Simulate disconnection
   * @private
   */
  simulateDisconnection() {
    this.readyState = this.CLOSED;
    const closeEvent = {
      code: 1006,
      reason: 'Connection lost',
      wasClean: false
    };
    
    this.emit('close', closeEvent);
  }
  
  /**
   * Add event listener
   * @param {string} type - Event type
   * @param {Function} listener - Event listener
   */
  addEventListener(type, listener) {
    this.on(type, listener);
  }
  
  /**
   * Remove event listener
   * @param {string} type - Event type
   * @param {Function} listener - Event listener
   */
  removeEventListener(type, listener) {
    this.off(type, listener);
  }
  
  /**
   * Set failure mode
   * @param {boolean} enabled - Enable failure mode
   */
  setFailureMode(enabled) {
    this.failureMode = enabled;
  }
  
  /**
   * Set instability mode
   * @param {boolean} enabled - Enable instability
   * @param {number} rate - Instability rate (0.0 to 1.0)
   */
  setInstabilityMode(enabled, rate = 0.1) {
    this.instabilityMode = enabled;
    this.instabilityRate = Math.max(0, Math.min(1, rate));
  }
  
  /**
   * Get message queue
   * @returns {Array} - Queued messages
   */
  getMessageQueue() {
    return [...this.messageQueue];
  }
  
  /**
   * Get sent messages
   * @returns {Array} - Sent messages
   */
  getSentMessages() {
    return [...this.sentMessages];
  }
  
  /**
   * Get received messages
   * @returns {Array} - Received messages
   */
  getReceivedMessages() {
    return [...this.receivedMessages];
  }
  
  /**
   * Clear message history
   */
  clearMessageHistory() {
    this.sentMessages = [];
    this.receivedMessages = [];
    this.messageQueue = [];
  }
  
  /**
   * Get connection statistics
   * @returns {Object} - Connection statistics
   */
  getStatistics() {
    return {
      url: this.url,
      readyState: this.readyState,
      messagesSent: this.sentMessages.length,
      messagesReceived: this.receivedMessages.length,
      queuedMessages: this.messageQueue.length,
      failureMode: this.failureMode,
      instabilityMode: this.instabilityMode,
      instabilityRate: this.instabilityRate
    };
  }
  
  /**
   * Reset mock to initial state
   */
  reset() {
    this.readyState = this.CLOSED;
    this.clearMessageHistory();
    this.failureMode = false;
    this.instabilityMode = false;
    this.instabilityRate = 0.0;
    this.removeAllListeners();
  }
}