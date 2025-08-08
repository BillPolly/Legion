/**
 * Frontend test setup for JSDOM environment
 */

// Import Jest globals for JSDOM tests
import { jest } from '@jest/globals';

// Make jest available globally for JSDOM tests
global.jest = jest;

// Mock global objects that might not be available in JSDOM
global.performance = global.performance || {
  now: () => Date.now(),
  timing: {
    navigationStart: Date.now() - 1000,
    loadEventEnd: Date.now(),
    domContentLoadedEventEnd: Date.now() - 500
  },
  getEntriesByType: jest.fn(() => []),
  memory: {
    usedJSHeapSize: 1024 * 1024,
    totalJSHeapSize: 2 * 1024 * 1024
  }
};

// Mock WebSocket for tests
global.WebSocket = jest.fn(() => ({
  send: jest.fn(),
  close: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn()
}));

// Mock fetch for API tests
global.fetch = jest.fn();

// Mock browser APIs
global.ErrorEvent = class MockErrorEvent extends Event {
  constructor(type, eventInitDict = {}) {
    super(type);
    this.message = eventInitDict.message || '';
    this.filename = eventInitDict.filename || '';
    this.lineno = eventInitDict.lineno || 0;
    this.colno = eventInitDict.colno || 0;
    this.error = eventInitDict.error || null;
  }
};

global.PromiseRejectionEvent = class MockPromiseRejectionEvent extends Event {
  constructor(type, eventInitDict = {}) {
    super(type);
    this.promise = eventInitDict.promise || Promise.resolve();
    this.reason = eventInitDict.reason || null;
  }
};

// Mock console methods to avoid excessive output during tests
const originalConsole = global.console;
global.console = {
  ...originalConsole,
  debug: jest.fn(),
  log: originalConsole.log,
  warn: originalConsole.warn,
  error: originalConsole.error
};

// Mock sessionStorage
global.sessionStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};

// Mock screen object
global.screen = {
  width: 1920,
  height: 1080,
  colorDepth: 24
};

console.log('Frontend test setup completed');