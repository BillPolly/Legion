// Jest setup file
import { jest } from '@jest/globals';

global.console = {
  ...console,
  // Suppress console output during tests unless explicitly needed
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};