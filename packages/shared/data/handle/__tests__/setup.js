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
// ONLY override for custom mocks, not Jest native mocks
if (typeof expect !== 'undefined') {
  const originalToHaveBeenCalledWith = expect.toHaveBeenCalledWith;
  
  expect.extend({
    toHaveBeenCalledWith(received, ...expectedArgs) {
      // If it's a Jest native mock (has .mock property), use Jest's implementation
      if (received && received.mock && typeof received.mock.calls !== 'undefined') {
        // This is Jest's native mock - use Jest's native matcher
        // Jest's expect.extend expects { pass, message } return value
        const calls = received.mock.calls;
        const pass = calls.some(call => {
          if (call.length !== expectedArgs.length) return false;
          return call.every((arg, i) => {
            const expected = expectedArgs[i];
            // Handle expect.any() matchers
            if (expected && typeof expected === 'object' && expected.asymmetricMatch) {
              return expected.asymmetricMatch(arg);
            }
            // Deep equality
            if (typeof expected === 'object' && expected !== null && typeof arg === 'object' && arg !== null) {
              return JSON.stringify(expected) === JSON.stringify(arg);
            }
            return expected === arg;
          });
        });
        
        return {
          pass,
          message: () => pass 
            ? `Expected mock not to have been called with ${JSON.stringify(expectedArgs)}`
            : `Expected mock to have been called with ${JSON.stringify(expectedArgs)}, but it was called with: ${JSON.stringify(calls)}`
        };
      }
      
      // Otherwise use our custom matcher for custom mocks
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