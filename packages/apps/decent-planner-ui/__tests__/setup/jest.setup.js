/**
 * Jest setup file for decent-planner-ui tests
 * Configures jsdom and global test utilities
 */

import { jest } from '@jest/globals';

// Add TextEncoder/TextDecoder for jsdom
import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
global.jest = jest;

// NO MOCK WEBSOCKETS - use real WebSocket or fail per CLAUDE.md

// NO MOCK FETCH - use real fetch or fail per CLAUDE.md

// Add custom matchers if needed
expect.extend({
  toBeValidDomainEntity(received) {
    const pass = received && 
                 typeof received === 'object' &&
                 typeof received.validate === 'function';
    
    return {
      pass,
      message: () => pass 
        ? `Expected ${received} not to be a valid domain entity`
        : `Expected ${received} to be a valid domain entity with validate() method`
    };
  }
});

// NO CONSOLE MOCKING - see real errors per CLAUDE.md

// Clear all timers after each test to prevent leaks
afterEach(() => {
  // Clear all timers and immediates
  jest.clearAllTimers();
  jest.useRealTimers();
});