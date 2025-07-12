/**
 * Jest setup file for @jsenvoy/response-parser tests
 */

import { jest } from '@jest/globals';

// Increase timeout for parsing tests
jest.setTimeout(15000);

// Global test utilities
global.TEST_TIMEOUT = 15000;

// Mock console methods in tests to reduce noise
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeEach(() => {
  // Reset console mocks
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterEach(() => {
  // Restore console methods
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
  
  // Clear all mocks
  jest.clearAllMocks();
});