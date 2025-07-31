/**
 * Jest setup for plan-executor-tools package
 */

// Set up test environment
process.env.NODE_ENV = 'test';

// Suppress console.warn for tests unless needed
const originalWarn = console.warn;
console.warn = (...args) => {
  // Only show warnings that aren't from expected test scenarios
  if (!args[0]?.includes('Failed to load essential module')) {
    originalWarn(...args);
  }
};

// Set test timeout - done in jest.config.js