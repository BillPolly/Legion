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
  
  // Global setup and teardown - DISABLED due to hanging issue
  // globalSetup: '<rootDir>/__tests__/jest.setup.js',
  
  // Setup files that run before each test file
  setupFilesAfterEnv: ['<rootDir>/__tests__/utils/testSetup.js'],
  
  // Timeouts
  testTimeout: 60000, // 60 seconds for database operations
  
  // Verbose output for integration tests
  verbose: true,
  
  // CRITICAL: Run tests sequentially because ToolRegistry is a singleton
  // Parallel tests would interfere with each other
  maxWorkers: 1,
  
  // Disable parallelization within test files
  maxConcurrency: 1,
  
  // Force sequential test execution (runInBand is a CLI flag, not config)
};