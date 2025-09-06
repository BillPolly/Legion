/**
 * Test setup for kg-object-query package
 */

// Import KG object extensions for testing
import '@legion/kg';

// Note: Global test timeout is set in jest config

// Clean up after each test
afterEach(() => {
  // Clean up any global state
  if (global.gc) {
    global.gc();
  }
});