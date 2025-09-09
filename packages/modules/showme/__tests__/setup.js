/**
 * Jest setup file for ShowMe module tests
 * Configures jsdom environment and global utilities for testing
 */

// Add TextEncoder/TextDecoder polyfills for JSDOM
import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock console methods to reduce noise during tests (but preserve errors)
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  // Only suppress non-critical console output
  console.warn = (...args) => {
    const message = args.join(' ');
    // Still show important warnings
    if (message.includes('WARNING') || message.includes('DEPRECATION')) {
      originalWarn.apply(console, args);
    }
  };
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});

// Mock browser APIs that jsdom doesn't provide
Object.defineProperty(window, 'getBoundingClientRect', {
  value: () => ({
    width: 800,
    height: 600,
    top: 0,
    left: 0,
    right: 800,
    bottom: 600,
    x: 0,
    y: 0
  })
});

// Mock HTMLElement.getBoundingClientRect for drag/resize testing
HTMLElement.prototype.getBoundingClientRect = function() {
  return {
    width: this.offsetWidth || 100,
    height: this.offsetHeight || 100,
    top: 0,
    left: 0,
    right: this.offsetWidth || 100,
    bottom: this.offsetHeight || 100,
    x: 0,
    y: 0
  };
};

// Set default window size for tests
Object.defineProperty(window, 'innerWidth', {
  writable: true,
  configurable: true,
  value: 1024
});

Object.defineProperty(window, 'innerHeight', {
  writable: true,
  configurable: true,
  value: 768
});

// Add any global test utilities here
global.createMockResourceManager = () => {
  return {
    get: (key) => {
      const mockValues = {
        'env.SHOWME_PORT': 3700,
        'env.SHOWME_ASSETS_PATH': '/tmp/showme-assets'
      };
      return mockValues[key] || null;
    }
  };
};

global.createMockDOMElement = (tag = 'div') => {
  const element = document.createElement(tag);
  // Add any common mock properties
  return element;
};