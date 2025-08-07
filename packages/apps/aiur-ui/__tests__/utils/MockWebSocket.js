/**
 * MockWebSocket - Simulates WebSocket for testing actor protocol
 */

import { EventEmitter } from 'events';

export class MockWebSocket extends EventEmitter {
  constructor() {
    super();
    this.readyState = 1; // OPEN
    this.OPEN = 1;
    this.CLOSED = 3;
    this.onmessage = null;
    this.onopen = null;
    this.onclose = null;
    this.onerror = null;
    this.sentMessages = [];
    this.partner = null; // Link to another MockWebSocket for bidirectional communication
  }
  
  send(data) {
    const message = typeof data === 'string' ? JSON.parse(data) : data;
    this.sentMessages.push(message);
    
    // If we have a partner, simulate sending to them
    if (this.partner) {
      // Use setTimeout to simulate async network communication
      setTimeout(() => {
        this.partner.simulateMessage(message);
      }, 0);
    }
  }
  
  // Simulate receiving a message
  simulateMessage(data) {
    const event = { 
      data: typeof data === 'string' ? data : JSON.stringify(data) 
    };
    
    if (this.onmessage) {
      this.onmessage(event);
    }
    this.emit('message', event.data);
  }
  
  simulateOpen() {
    this.readyState = this.OPEN;
    if (this.onopen) this.onopen();
    this.emit('open');
  }
  
  simulateClose() {
    this.readyState = this.CLOSED;
    if (this.onclose) this.onclose();
    this.emit('close');
  }
  
  simulateError(error) {
    if (this.onerror) this.onerror(error);
    this.emit('error', error);
  }
  
  close() {
    this.readyState = this.CLOSED;
    this.simulateClose();
  }
  
  // Helper to link two MockWebSockets for bidirectional communication
  static createPair() {
    const serverWS = new MockWebSocket();
    const clientWS = new MockWebSocket();
    serverWS.partner = clientWS;
    clientWS.partner = serverWS;
    return { serverWS, clientWS };
  }
  
  // Helper to get the last sent message
  getLastSentMessage() {
    return this.sentMessages[this.sentMessages.length - 1];
  }
  
  // Helper to clear sent messages
  clearSentMessages() {
    this.sentMessages = [];
  }
  
  // Helper to wait for a specific message type
  waitForMessage(type, timeout = 1000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for message type: ${type}`));
      }, timeout);
      
      const checkMessage = (data) => {
        const msg = typeof data === 'string' ? JSON.parse(data) : data;
        if (msg.type === type || msg.payload?.type === type) {
          clearTimeout(timer);
          this.off('message', checkMessage);
          resolve(msg);
        }
      };
      
      this.on('message', checkMessage);
    });
  }
}

export default MockWebSocket;