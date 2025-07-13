import { jest } from '@jest/globals';
import { WebSocketManager } from '../src/websocket.js';

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  constructor(url) {
    this.url = url;
    this.readyState = MockWebSocket.CONNECTING;
    this.onopen = null;
    this.onclose = null;
    this.onerror = null;
    this.onmessage = null;
    
    // Simulate connection after a short delay
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) this.onopen();
    }, 10);
  }

  send(data) {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    // Store sent data for testing
    this.lastSentData = data;
  }

  close(code, reason) {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose({ code: code || 1000, reason: reason || '' });
    }
  }

  // Helper method to simulate receiving a message
  simulateMessage(data) {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(data) });
    }
  }
}

// Replace global WebSocket with mock
global.WebSocket = MockWebSocket;
global.WebSocket.CONNECTING = 0;
global.WebSocket.OPEN = 1;
global.WebSocket.CLOSING = 2;
global.WebSocket.CLOSED = 3;

describe('WebSocket Manager Simple Tests', () => {
  let wsManager;

  beforeEach(() => {
    wsManager = new WebSocketManager('ws://localhost:3000/ws');
  });

  afterEach(() => {
    if (wsManager) {
      wsManager.disconnect();
    }
  });

  test('WebSocketManager can be instantiated', () => {
    expect(wsManager).toBeDefined();
    expect(wsManager.url).toBe('ws://localhost:3000/ws');
    expect(wsManager.ws).toBeNull();
    expect(wsManager.reconnectAttempts).toBe(0);
    expect(wsManager.pendingMessages.size).toBe(0);
  });

  test('generateMessageId creates unique IDs', () => {
    const id1 = wsManager.generateMessageId();
    const id2 = wsManager.generateMessageId();
    
    expect(id1).toMatch(/^msg_\d+_1$/);
    expect(id2).toMatch(/^msg_\d+_2$/);
    expect(id1).not.toBe(id2);
  });

  test('isConnected returns falsy when not connected', () => {
    expect(wsManager.isConnected()).toBeFalsy();
  });

  test('connect creates WebSocket connection', async () => {
    const onOpenSpy = jest.fn();
    wsManager.onOpen = onOpenSpy;
    
    wsManager.connect();
    
    expect(wsManager.ws).toBeDefined();
    expect(wsManager.ws.url).toBe('ws://localhost:3000/ws');
    
    // Wait for connection
    await new Promise(resolve => setTimeout(resolve, 20));
    
    expect(onOpenSpy).toHaveBeenCalled();
    expect(wsManager.isConnected()).toBe(true);
  });

  test('disconnect closes WebSocket connection', async () => {
    wsManager.connect();
    await new Promise(resolve => setTimeout(resolve, 20));
    
    expect(wsManager.isConnected()).toBe(true);
    
    wsManager.disconnect();
    
    expect(wsManager.ws).toBeNull();
  });

  test('updateStatus calls onStatusChange callback', () => {
    const onStatusChangeSpy = jest.fn();
    wsManager.onStatusChange = onStatusChangeSpy;
    
    wsManager.updateStatus('connected');
    
    expect(onStatusChangeSpy).toHaveBeenCalledWith('connected');
  });
});