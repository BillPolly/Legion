// Jest setup for BehaviorTreeExecutor tests
import { jest } from '@jest/globals';

// Make jest available globally
global.jest = jest;

// Increase timeout for integration tests
jest.setTimeout(30000);

// Console log suppression for cleaner test output
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

// Only show console output in verbose mode or when tests fail
if (!process.env.VERBOSE_TESTS) {
  console.log = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
}

// Restore console methods after each test
afterEach(() => {
  if (!process.env.VERBOSE_TESTS) {
    jest.clearAllMocks();
  }
});

// Global test utilities
global.testUtils = {
  restoreConsole: () => {
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
  },
  
  suppressConsole: () => {
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
  }
};