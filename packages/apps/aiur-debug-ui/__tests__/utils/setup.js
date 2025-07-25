/**
 * Jest test setup
 */

import { jest } from '@jest/globals';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.DEBUG_UI_PORT = '0'; // Use random port for tests
process.env.LOG_CONSOLE = 'false'; // Disable console logging in tests

// Global test utilities
global.testUtils = {
  /**
   * Wait for a condition to be true
   * @param {Function} condition - Function that returns boolean
   * @param {number} timeout - Maximum wait time in ms
   * @param {number} interval - Check interval in ms
   * @returns {Promise<void>}
   */
  async waitFor(condition, timeout = 5000, interval = 100) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    throw new Error(`Timeout waiting for condition after ${timeout}ms`);
  },

  /**
   * Create a test configuration
   * @param {Object} overrides - Configuration overrides
   * @returns {Object} Test configuration
   */
  createTestConfig(overrides = {}) {
    return {
      server: {
        port: 0, // Random port
        host: 'localhost',
        ...overrides.server
      },
      mcp: {
        defaultUrl: 'ws://localhost:8080/ws',
        reconnectInterval: 100,
        maxReconnectAttempts: 3,
        connectionTimeout: 5000,
        ...overrides.mcp
      },
      ui: {
        theme: 'dark',
        autoConnect: false,
        sessionRefreshInterval: 1000,
        maxEventHistory: 100,
        maxLogHistory: 100,
        ...overrides.ui
      },
      logging: {
        level: 'error',
        console: false,
        ...overrides.logging
      },
      cors: {
        enabled: true,
        origin: '*',
        credentials: false,
        ...overrides.cors
      }
    };
  },

  /**
   * Create a mock logger
   * @returns {Object} Mock logger
   */
  createMockLogger() {
    return {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      child: jest.fn(() => this.createMockLogger())
    };
  },

  /**
   * Extract port from HTTP server
   * @param {http.Server} server - HTTP server
   * @returns {number} Port number
   */
  getServerPort(server) {
    const address = server.address();
    return address ? address.port : null;
  }
};

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});

// Suppress console output during tests
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info
};

beforeAll(() => {
  if (process.env.LOG_CONSOLE !== 'true') {
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
    console.info = jest.fn();
  }
});

afterAll(() => {
  console.log = originalConsole.log;
  console.error = originalConsole.error;
  console.warn = originalConsole.warn;
  console.info = originalConsole.info;
});