/**
 * Jest test setup for @legion/codec
 * Configures ES modules and common test utilities
 */

// Global test utilities
global.expectError = (result, expectedErrorSubstring) => {
  expect(result.success).toBe(false);
  expect(result.errors).toBeInstanceOf(Array);
  expect(result.errors.length).toBeGreaterThan(0);
  if (expectedErrorSubstring) {
    expect(result.errors.some(error => 
      error.includes(expectedErrorSubstring)
    )).toBe(true);
  }
};

global.expectSuccess = (result) => {
  expect(result.success).toBe(true);
  expect(result.errors).toEqual([]);
};