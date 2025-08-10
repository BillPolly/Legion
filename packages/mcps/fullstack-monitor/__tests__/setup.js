/**
 * Jest setup for MCP server tests
 */

// Mock console.error to reduce noise in tests
const originalError = console.error;
beforeEach(() => {
  console.error = () => {};
});

afterEach(() => {
  console.error = originalError;
});