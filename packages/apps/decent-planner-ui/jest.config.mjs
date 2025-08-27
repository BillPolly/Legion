/**
 * Jest configuration for decent-planner-ui
 * Uses jsdom for DOM testing without needing a real browser
 */

export default {
  testEnvironment: 'jsdom',
  
  // Handle ES modules
  transform: {},
  
  // Module resolution
  moduleNameMapper: {
    '^@legion/(.*)$': '<rootDir>/../../$1/src/index.js',
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  
  // Test patterns
  testMatch: [
    '**/__tests__/**/*.test.js'
  ],
  
  // Coverage settings
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',
    '!src/**/__tests__/**'
  ],
  
  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/__tests__/setup/jest.setup.js'
  ],
  
  // Global test timeout
  testTimeout: 10000,
  
  // Verbose output
  verbose: true,
  
  // Clear mocks between tests
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true
};