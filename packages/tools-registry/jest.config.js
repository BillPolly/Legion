/**
 * Jest Configuration for ToolRegistry Tests
 * 
 * Configured for ES modules.
 */

export default {
  testEnvironment: 'node',
  
  // Don't transform anything (pure ES modules)
  transform: {},
  
  // Test patterns
  testMatch: [
    '**/__tests__/**/*.test.js'
  ],
  
  // Coverage settings
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/test*.js'
  ],
  
  // Setup and teardown
  setupFilesAfterEnv: ['<rootDir>/__tests__/jest.setup.js'],
  
  // Timeouts
  testTimeout: 60000, // 60 seconds for database operations
  
  // Verbose output for integration tests
  verbose: true,
  
  // Run tests in sequence for database tests
  maxWorkers: 1,
  
  // Disable parallelization
  maxConcurrency: 1
};