/**
 * Simplified Jest Configuration for debugging
 */

export default {
  testEnvironment: 'node',
  transform: {},
  testMatch: [
    '**/__tests__/**/*.test.js'
  ],
  testTimeout: 10000,
  verbose: true,
  maxWorkers: 1
};