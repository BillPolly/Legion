// Jest setup for ES modules and jsdom environment
// Note: @testing-library/jest-dom will be imported when needed
import { jest, expect } from '@jest/globals';

// Mock WebSocket for tests
global.WebSocket = class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = 0; // CONNECTING
    this.onopen = null;
    this.onclose = null;
    this.onerror = null;
    this.onmessage = null;
    
    // Simulate connection after a tick
    setTimeout(() => {
      this.readyState = 1; // OPEN
      if (this.onopen) this.onopen({ type: 'open' });
    }, 0);
  }
  
  send(data) {
    if (this.readyState !== 1) {
      throw new Error('WebSocket is not open');
    }
    // Store sent data for test assertions
    this.lastSentData = data;
  }
  
  close() {
    this.readyState = 3; // CLOSED
    if (this.onclose) this.onclose({ type: 'close' });
  }
  
  // Test helper to simulate receiving a message
  simulateMessage(data) {
    if (this.onmessage) {
      this.onmessage({ type: 'message', data });
    }
  }
};

// Mock console methods to reduce test noise
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
};

// Add custom matchers if needed
expect.extend({
  toBeActor(received) {
    const pass = received && 
                 typeof received === 'object' && 
                 received.isActor === true &&
                 typeof received.receive === 'function';
    
    return {
      pass,
      message: () => pass
        ? `expected ${received} not to be an Actor`
        : `expected ${received} to be an Actor (must have isActor: true and receive method)`
    };
  },
  
  toBeValidMessage(received, expectedType) {
    const pass = received &&
                 typeof received === 'object' &&
                 received.type === expectedType &&
                 received.hasOwnProperty('payload');
    
    return {
      pass,
      message: () => pass
        ? `expected message not to be of type ${expectedType}`
        : `expected message to be of type ${expectedType} with payload property`
    };
  }
});