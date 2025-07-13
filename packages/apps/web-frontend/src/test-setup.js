// Test setup for JSDOM environment
import { jest } from '@jest/globals';

// Mock functions for DOM APIs that may not be available in tests
global.scrollTo = jest.fn();

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
};