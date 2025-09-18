// Test setup file
import { jest } from '@jest/globals';

// Set test timeout
jest.setTimeout(30000);

// Suppress console logs during tests unless debugging
if (!process.env.DEBUG) {
  global.console.log = jest.fn();
  global.console.warn = jest.fn();
}