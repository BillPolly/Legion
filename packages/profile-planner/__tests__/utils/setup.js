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
// Note: Don't override ANTHROPIC_API_KEY - let ResourceManager load it from .env
process.env.NODE_ENV = 'test';