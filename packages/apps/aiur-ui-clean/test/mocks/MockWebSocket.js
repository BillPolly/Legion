/**
 * MockWebSocket - In-process WebSocket mock for testing
 * 
 * This mock allows direct communication between frontend and backend
 * actors in the same process, perfect for integration testing.
 */
export class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = MockWebSocket.CONNECTING;
    this.binaryType = 'blob';
    
    // Event handlers
    this.onopen = null;
    this.onclose = null;
    this.onerror = null;
    this.onmessage = null;
    
    // Track sent messages for assertions
    this.sentMessages = [];
    
    // Paired socket for bidirectional communication
    this.pairedSocket = null;
    
    // Simulate async connection
    setTimeout(() => this._simulateOpen(), 0);
  }
  
  /**
   * Create a pair of connected MockWebSockets
   * @returns {[MockWebSocket, MockWebSocket]} Client and server sockets
   */
  static createPair() {
    const clientSocket = new MockWebSocket('ws://localhost:8080');
    const serverSocket = new MockWebSocket('ws://localhost:8080');
    
    // Pair them together
    clientSocket.pairedSocket = serverSocket;
    serverSocket.pairedSocket = clientSocket;
    
    return [clientSocket, serverSocket];
  }
  
  /**
   * Send data through the WebSocket
   */
  send(data) {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    
    // Track sent message
    this.sentMessages.push(data);
    
    // If we have a paired socket, deliver the message to it
    if (this.pairedSocket && this.pairedSocket.onmessage) {
      // Simulate async delivery
      setTimeout(() => {
        if (this.pairedSocket.readyState === MockWebSocket.OPEN) {
          this.pairedSocket.onmessage({
            data: data,
            type: 'message',
            target: this.pairedSocket
          });
        }
      }, 0);
    }
  }
  
  /**
   * Close the WebSocket connection
   */
  close(code = 1000, reason = '') {
    if (this.readyState === MockWebSocket.CLOSED) return;
    
    this.readyState = MockWebSocket.CLOSED;
    
    // Notify close handler
    if (this.onclose) {
      setTimeout(() => {
        this.onclose({
          code,
          reason,
          wasClean: true,
          target: this
        });
      }, 0);
    }
    
    // Also close paired socket
    if (this.pairedSocket && this.pairedSocket.readyState !== MockWebSocket.CLOSED) {
      this.pairedSocket.close(code, reason);
    }
  }
  
  /**
   * Simulate connection opening
   */
  _simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    
    if (this.onopen) {
      this.onopen({
        type: 'open',
        target: this
      });
    }
  }
  
  /**
   * Simulate an error
   */
  _simulateError(error) {
    if (this.onerror) {
      this.onerror({
        type: 'error',
        message: error.message || 'WebSocket error',
        error: error,
        target: this
      });
    }
  }
  
  /**
   * Get all messages sent through this socket
   */
  getSentMessages() {
    return this.sentMessages.map(msg => {
      try {
        return typeof msg === 'string' ? JSON.parse(msg) : msg;
      } catch {
        return msg;
      }
    });
  }
  
  /**
   * Clear sent messages history
   */
  clearSentMessages() {
    this.sentMessages = [];
  }
  
  /**
   * Wait for a specific message type
   */
  async waitForMessage(type, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Timeout waiting for message type: ${type}`));
      }, timeout);
      
      const originalOnMessage = this.onmessage;
      
      this.onmessage = (event) => {
        // Call original handler
        if (originalOnMessage) {
          originalOnMessage(event);
        }
        
        try {
          const message = JSON.parse(event.data);
          if (message.type === type) {
            clearTimeout(timeoutId);
            this.onmessage = originalOnMessage;
            resolve(message);
          }
        } catch (e) {
          // Not JSON or parsing error, ignore
        }
      };
    });
  }
}

// WebSocket ready state constants
MockWebSocket.CONNECTING = 0;
MockWebSocket.OPEN = 1;
MockWebSocket.CLOSING = 2;
MockWebSocket.CLOSED = 3;