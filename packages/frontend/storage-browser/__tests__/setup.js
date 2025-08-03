/**
 * Jest setup for storage browser tests
 */

// Only define jest mocks if jest is available (not in all environments)
if (typeof jest !== 'undefined') {
  // Mock WebSocket for testing
  global.WebSocket = class MockWebSocket {
    constructor() {
      this.readyState = 1;
      this.OPEN = 1;
      this.send = jest.fn();
      this.close = jest.fn();
      this.addEventListener = jest.fn();
    }
  };

  // Mock localStorage
  global.localStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn()
  };
}

// Fallback mocks for non-jest environments
if (!global.WebSocket) {
  global.WebSocket = class MockWebSocket {
    constructor() {
      this.readyState = 1;
      this.OPEN = 1;
      this.send = () => {};
      this.close = () => {};
      this.addEventListener = () => {};
    }
  };
}

if (!global.localStorage) {
  global.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {}
  };
}

// Mock jest functions for non-jest environments
if (typeof jest === 'undefined') {
  global.jest = {
    fn: () => () => {}
  };
}

// Setup DOM environment
if (typeof document === 'undefined') {
  // Simple DOM mock
  global.document = {
    head: {
      appendChild: () => {},
      querySelector: () => null
    },
    createElement: (tag) => ({
      tagName: tag.toUpperCase(),
      style: {},
      innerHTML: '',
      id: '',
      nodeType: 1,
      appendChild: () => {},
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener: () => {},
      removeEventListener: () => {}
    }),
    querySelector: () => null,
    querySelectorAll: () => []
  };
  
  global.window = {
    document: global.document
  };
  
  global.Node = {
    ELEMENT_NODE: 1
  };
}