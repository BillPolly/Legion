/**
 * Test setup file - runs before all tests
 */

// Set test environment
process.env.NODE_ENV = 'test';

// Global test utilities
global.delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

global.waitFor = async (condition, options = {}) => {
  const { timeout = 5000, interval = 50 } = options;
  const startTime = Date.now();
  
  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error(`Timeout waiting for condition after ${timeout}ms`);
    }
    await global.delay(interval);
  }
};