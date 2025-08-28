import { describe, it, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { WebSocketClient } from '../../../src/extension/WebSocketClient.js';

// Mock WebSocket
class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = MockWebSocket.CONNECTING;
    this.onopen = null;
    this.onclose = null;
    this.onerror = null;
    this.onmessage = null;
    
    // Simulate connection after a delay
    setTimeout(() => {
      if (this.onopen && this.readyState === MockWebSocket.CONNECTING) {
        this.readyState = MockWebSocket.OPEN;
        this.onopen({ type: 'open' });
      }
    }, 10);
  }

  send(data) {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
  }

  close(code, reason) {
    this.readyState = MockWebSocket.CLOSING;
    const closeHandler = this.onclose;
    setTimeout(() => {
      this.readyState = MockWebSocket.CLOSED;
      if (closeHandler && typeof closeHandler === 'function') {
        closeHandler({ type: 'close', code: code || 1000, reason: reason || 'Normal closure', wasClean: true });
      }
    }, 10);
  }
}

MockWebSocket.CONNECTING = 0;
MockWebSocket.OPEN = 1;
MockWebSocket.CLOSING = 2;
MockWebSocket.CLOSED = 3;

global.WebSocket = MockWebSocket;

describe('WebSocket Client', () => {
  let wsClient;
  let originalWebSocket;

  beforeEach(() => {
    originalWebSocket = global.WebSocket;
    global.WebSocket = MockWebSocket;
    wsClient = new WebSocketClient();
  });

  afterEach(() => {
    wsClient.destroy();
    global.WebSocket = originalWebSocket;
  });

  describe('Connection Establishment to Debug Server', () => {
    test('should connect to WebSocket server', async () => {
      const connectionPromise = wsClient.connect('ws://localhost:9222');
      
      await expect(connectionPromise).resolves.toBe(true);
      expect(wsClient.isConnected()).toBe(true);
    });

    test('should handle connection with custom options', async () => {
      const options = {
        reconnectAttempts: 5,
        reconnectDelay: 500,
        timeout: 10000
      };

      await wsClient.connect('ws://localhost:9222', options);
      
      expect(wsClient.getConfiguration()).toMatchObject(options);
    });

    test('should reject connection to invalid URL', async () => {
      // Create a new client for this test
      const testClient = new WebSocketClient();
      
      // Add error handler to prevent unhandled errors
      testClient.on('error', () => {}); // Suppress error events
      
      // Mock immediate error
      global.WebSocket = class {
        constructor(url) {
          this.url = url;
          this.readyState = 0; // CONNECTING
          this.onopen = null;
          this.onclose = null;
          this.onerror = null;
          this.onmessage = null;
          
          // Simulate connection failure
          setTimeout(() => {
            if (this.onerror) {
              this.onerror(new Error('Invalid URL'));
            }
            if (this.onclose) {
              this.onclose({ type: 'close', code: 1006 });
            }
          }, 0);
        }
        
        close() {
          this.readyState = 3; // CLOSED
        }
      };

      await expect(testClient.connect('invalid-url', { reconnectAttempts: 0 })).rejects.toThrow();
      testClient.destroy();
      
      // Restore original WebSocket
      global.WebSocket = MockWebSocket;
    });

    test('should timeout connection attempt', async () => {
      // Mock WebSocket that never connects
      global.WebSocket = class {
        constructor(url) {
          this.url = url;
          this.readyState = 0; // CONNECTING
          this.onopen = null;
          this.onclose = null;
          this.onerror = null;
          this.onmessage = null;
          // Never trigger onopen
        }
        
        close() {
          this.readyState = 3; // CLOSED
          const closeHandler = this.onclose;
          if (closeHandler && typeof closeHandler === 'function') {
            setTimeout(() => {
              closeHandler({ type: 'close', code: 1006 });
            }, 0);
          }
        }
      };

      const options = { timeout: 100 };
      await expect(wsClient.connect('ws://localhost:9222', options))
        .rejects.toThrow('Connection timeout');
      
      // Restore original WebSocket
      global.WebSocket = MockWebSocket;
    });
  });

  describe('Connection State Management', () => {
    test('should track connection state correctly', async () => {
      expect(wsClient.getState()).toBe('disconnected');
      
      const connectPromise = wsClient.connect('ws://localhost:9222');
      expect(wsClient.getState()).toBe('connecting');
      
      await connectPromise;
      expect(wsClient.getState()).toBe('connected');
      
      wsClient.disconnect();
      // Wait a bit longer for the disconnection to complete
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(wsClient.getState()).toBe('disconnected');
    });

    test('should emit state change events', async () => {
      const stateChanges = [];
      wsClient.on('stateChange', (state) => {
        stateChanges.push(state);
      });

      await wsClient.connect('ws://localhost:9222');
      wsClient.disconnect();
      await new Promise(resolve => setTimeout(resolve, 30));

      expect(stateChanges).toEqual(['connecting', 'connected', 'disconnecting', 'disconnected']);
    });

    test('should handle multiple connection attempts', async () => {
      await wsClient.connect('ws://localhost:9222');
      
      // Try to connect again while already connected
      await expect(wsClient.connect('ws://localhost:9222'))
        .rejects.toThrow('Already connected');
    });
  });

  describe('Automatic Reconnection Logic', () => {
    test('should attempt reconnection on disconnect', async () => {
      let reconnectAttempts = 0;
      wsClient.on('reconnecting', () => {
        reconnectAttempts++;
      });

      await wsClient.connect('ws://localhost:9222', {
        reconnectAttempts: 3,
        reconnectDelay: 50
      });

      // Simulate unexpected disconnect
      const ws = wsClient.getWebSocket();
      ws.readyState = MockWebSocket.CLOSED;
      ws.onclose({ type: 'close', code: 1006, wasClean: false });

      // Wait for reconnection attempts
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(reconnectAttempts).toBeGreaterThan(0);
    });

    test('should use exponential backoff for reconnection', async () => {
      const delays = [];
      let lastAttemptTime = Date.now();

      wsClient.on('reconnecting', (attempt) => {
        const now = Date.now();
        delays.push(now - lastAttemptTime);
        lastAttemptTime = now;
      });

      await wsClient.connect('ws://localhost:9222', {
        reconnectAttempts: 3,
        reconnectDelay: 50,
        exponentialBackoff: true
      });

      // Force disconnect
      const ws = wsClient.getWebSocket();
      ws.onclose({ type: 'close', code: 1006, wasClean: false });

      await new Promise(resolve => setTimeout(resolve, 500));

      // Each delay should be longer than the previous
      for (let i = 1; i < delays.length; i++) {
        expect(delays[i]).toBeGreaterThan(delays[i - 1]);
      }
    });

    test('should stop reconnecting after max attempts', async () => {
      let attempts = 0;
      wsClient.on('reconnecting', () => {
        attempts++;
      });

      const maxReconnectListener = jest.fn();
      wsClient.on('maxReconnectAttemptsReached', maxReconnectListener);

      await wsClient.connect('ws://localhost:9222', {
        reconnectAttempts: 2,
        reconnectDelay: 50
      });

      // Mock WebSocket that always fails to reconnect
      const originalWebSocket = global.WebSocket;
      global.WebSocket = class {
        constructor(url) {
          this.url = url;
          this.readyState = 0; // CONNECTING
          this.onopen = null;
          this.onclose = null;
          this.onerror = null;
          this.onmessage = null;
          
          // Always fail to connect
          setTimeout(() => {
            if (this.onclose) {
              this.onclose({ type: 'close', code: 1006 });
            }
          }, 10);
        }
        
        close() {
          this.readyState = 3; // CLOSED
        }
      };

      // Force disconnect
      const ws = wsClient.getWebSocket();
      ws.onclose({ type: 'close', code: 1006, wasClean: false });

      await new Promise(resolve => setTimeout(resolve, 300));

      expect(attempts).toBe(2);
      expect(maxReconnectListener).toHaveBeenCalled();
      
      // Restore original WebSocket
      global.WebSocket = originalWebSocket;
    });
  });

  describe('Connection Error Handling', () => {
    test('should handle WebSocket errors', async () => {
      const errorListener = jest.fn();
      wsClient.on('error', errorListener);

      await wsClient.connect('ws://localhost:9222');

      // Simulate WebSocket error
      const ws = wsClient.getWebSocket();
      const error = new Error('WebSocket error');
      ws.onerror(error);

      expect(errorListener).toHaveBeenCalledWith(error);
    });

    test('should handle connection refused', async () => {
      // Create a new client for this test
      const testClient = new WebSocketClient();
      
      // Add error handler to prevent unhandled errors
      testClient.on('error', () => {}); // Suppress error events
      
      global.WebSocket = class {
        constructor(url) {
          this.url = url;
          this.readyState = 0; // CONNECTING
          this.onopen = null;
          this.onclose = null;
          this.onerror = null;
          this.onmessage = null;
          
          setTimeout(() => {
            if (this.onerror) {
              this.onerror(new Error('Connection refused'));
            }
            if (this.onclose) {
              this.onclose({ type: 'close', code: 1006, reason: 'Connection refused' });
            }
          }, 0);
        }
        
        close() {
          this.readyState = 3; // CLOSED
        }
      };

      await expect(testClient.connect('ws://localhost:9222', { reconnectAttempts: 0 }))
        .rejects.toThrow('Connection closed');
      testClient.destroy();
      
      // Restore original WebSocket
      global.WebSocket = MockWebSocket;
    });

    test('should cleanup on connection error', async () => {
      // Create a new client for this test
      const testClient = new WebSocketClient();
      let wsInstance;
      
      // Add error handler to prevent unhandled errors
      testClient.on('error', () => {}); // Suppress error events
      
      global.WebSocket = class {
        constructor(url) {
          wsInstance = this;
          this.url = url;
          this.readyState = 0; // CONNECTING
          this.onopen = null;
          this.onclose = null;
          this.onerror = null;
          this.onmessage = null;
          
          setTimeout(() => {
            this.readyState = 1; // OPEN
            if (this.onopen) {
              this.onopen({ type: 'open' });
            }
            // Then immediately error
            setTimeout(() => {
              if (this.onerror) {
                this.onerror(new Error('Connection lost'));
              }
              this.readyState = 3; // CLOSED
              if (this.onclose) {
                this.onclose({ type: 'close', code: 1006, wasClean: false });
              }
            }, 10);
          }, 10);
        }
        
        close() {
          this.readyState = 3; // CLOSED
        }
      };

      await testClient.connect('ws://localhost:9222', { reconnectAttempts: 0 });
      
      // Wait for error
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(testClient.isConnected()).toBe(false);
      expect(testClient.getState()).toBe('disconnected');
      testClient.destroy();
      
      // Restore original WebSocket
      global.WebSocket = MockWebSocket;
    });
  });

  describe('Message Handling', () => {
    test('should handle incoming messages', async () => {
      const messageListener = jest.fn();
      wsClient.on('message', messageListener);

      await wsClient.connect('ws://localhost:9222');

      const ws = wsClient.getWebSocket();
      const testMessage = { type: 'response', data: 'test' };
      ws.onmessage({ type: 'message', data: JSON.stringify(testMessage) });

      expect(messageListener).toHaveBeenCalledWith(testMessage);
    });

    test('should send messages when connected', async () => {
      await wsClient.connect('ws://localhost:9222');

      const ws = wsClient.getWebSocket();
      ws.send = jest.fn();

      const message = { command: 'test', data: {} };
      wsClient.send(message);

      expect(ws.send).toHaveBeenCalledWith(JSON.stringify(message));
    });

    test('should queue messages when not connected', () => {
      const message = { command: 'test', data: {} };
      
      expect(() => wsClient.send(message)).not.toThrow();
      expect(wsClient.getQueuedMessageCount()).toBe(1);
    });

    test('should send queued messages on connection', async () => {
      const messages = [
        { command: 'test1', data: {} },
        { command: 'test2', data: {} }
      ];

      messages.forEach(msg => wsClient.send(msg));
      expect(wsClient.getQueuedMessageCount()).toBe(2);

      await wsClient.connect('ws://localhost:9222');

      const ws = wsClient.getWebSocket();
      ws.send = jest.fn();

      // Wait for queue processing
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(ws.send).toHaveBeenCalledTimes(2);
      expect(wsClient.getQueuedMessageCount()).toBe(0);
    });
  });

  describe('Connection Lifecycle', () => {
    test('should cleanup resources on destroy', async () => {
      await wsClient.connect('ws://localhost:9222');
      
      const ws = wsClient.getWebSocket();
      ws.close = jest.fn();

      wsClient.destroy();

      expect(ws.close).toHaveBeenCalled();
      expect(wsClient.getState()).toBe('disconnected');
    });

    test('should cancel reconnection attempts on destroy', async () => {
      await wsClient.connect('ws://localhost:9222', {
        reconnectAttempts: 10,
        reconnectDelay: 100
      });

      // Force disconnect to trigger reconnection
      const ws = wsClient.getWebSocket();
      ws.onclose({ type: 'close', code: 1006, wasClean: false });

      // Destroy while reconnecting
      wsClient.destroy();

      expect(wsClient.getState()).toBe('disconnected');
    });
  });
});