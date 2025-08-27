/**
 * Jest setup file for decent-planner-ui tests
 * Configures jsdom and global test utilities
 */

import { jest } from '@jest/globals';

// Add TextEncoder/TextDecoder for jsdom
import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
global.jest = jest;

// Mock WebSocket globally
class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = MockWebSocket.CONNECTING;
    this.onopen = null;
    this.onmessage = null;
    this.onerror = null;
    this.onclose = null;
    this.messages = [];
    this._openTimeout = null;
    
    // Simulate connection
    this._openTimeout = setImmediate(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) this.onopen({ type: 'open' });
    });
  }
  
  send(data) {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    this.messages.push(data);
  }
  
  close(code = 1000, reason = '') {
    this.readyState = MockWebSocket.CLOSED;
    if (this._openTimeout) {
      clearImmediate(this._openTimeout);
      this._openTimeout = null;
    }
    if (this.onclose) {
      this.onclose({ type: 'close', code, reason });
    }
  }
  
  // Utility method for testing - simulate receiving a message
  simulateMessage(data) {
    if (this.onmessage) {
      this.onmessage({ type: 'message', data });
    }
  }
  
  // WebSocket states
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
}

global.WebSocket = MockWebSocket;

// Mock fetch for testing
global.fetch = jest.fn(() => 
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve('')
  })
);

// Add custom matchers if needed
expect.extend({
  toBeValidDomainEntity(received) {
    const pass = received && 
                 typeof received === 'object' &&
                 typeof received.validate === 'function';
    
    return {
      pass,
      message: () => pass 
        ? `Expected ${received} not to be a valid domain entity`
        : `Expected ${received} to be a valid domain entity with validate() method`
    };
  }
});

// Suppress console errors in tests unless explicitly needed
const originalError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalError;
});

// Clear all timers after each test to prevent leaks
afterEach(() => {
  // Clear all timers and immediates
  jest.clearAllTimers();
  jest.useRealTimers();
});