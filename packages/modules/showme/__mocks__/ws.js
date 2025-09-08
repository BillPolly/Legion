/**
 * Mock for ws module
 * 
 * Provides mock WebSocket and WebSocketServer for testing
 */

export class WebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = WebSocket.OPEN;
    this.onopen = null;
    this.onmessage = null;
    this.onerror = null;
    this.onclose = null;
  }
  
  send(data) {
    // Mock send
  }
  
  close() {
    this.readyState = WebSocket.CLOSED;
    if (this.onclose) {
      this.onclose();
    }
  }
}

WebSocket.CONNECTING = 0;
WebSocket.OPEN = 1;
WebSocket.CLOSING = 2;
WebSocket.CLOSED = 3;

export class WebSocketServer {
  constructor(options) {
    this.options = options;
    this.clients = new Set();
    this.on = jest.fn();
  }
  
  close(callback) {
    if (callback) callback();
  }
}