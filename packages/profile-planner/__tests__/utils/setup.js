/**
 * Jest setup file for profile-planner tests
 */

import { jest } from '@jest/globals';

// Mock console methods to reduce noise during tests
global.console = {
  ...console,
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: console.error // Keep error for debugging
};

// Set environment variables for tests
process.env.ANTHROPIC_API_KEY = 'test-key';
process.env.NODE_ENV = 'test';