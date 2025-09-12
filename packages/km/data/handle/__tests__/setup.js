/**
 * Jest setup file for Handle package tests
 * 
 * Configures the test environment for ES modules and Handle package testing.
 */

import { toHaveBeenCalledWith } from './testUtils.js';

// Ensure Node.js experimental VM modules are enabled
if (!process.env.NODE_OPTIONS || !process.env.NODE_OPTIONS.includes('--experimental-vm-modules')) {
  console.warn('Warning: NODE_OPTIONS should include --experimental-vm-modules for proper ES module testing');
}

// Set test environment flag
process.env.NODE_ENV = 'test';

// Extend Jest's expect with custom matchers for our mock functions
if (typeof expect !== 'undefined') {
  expect.extend({
    toHaveBeenCalledWith(received, ...expectedArgs) {
      const result = toHaveBeenCalledWith(received, ...expectedArgs);
      return result;
    }
  });
}

// Global test setup
beforeEach(() => {
  // Clear any global state between tests
  if (typeof jest !== 'undefined') {
    jest.clearAllMocks();
  }
});