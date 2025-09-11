/**
 * Jest setup file for Gemini Compatible Agent tests
 */

// Set test environment
process.env.NODE_ENV = 'test';

// Disable logging during tests
console.log = jest.fn();
console.warn = jest.fn();
console.error = jest.fn();

// Cleanup after each test
afterEach(() => {
  jest.clearAllMocks();
});