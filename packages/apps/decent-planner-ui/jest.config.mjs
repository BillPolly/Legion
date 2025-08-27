/**
 * Jest configuration for decent-planner-ui
 * Uses jsdom for DOM testing without needing a real browser
 */

export default {
  testEnvironment: 'node',
  
  // Handle ES modules
  transform: {},
  
  // Module resolution
  moduleNameMapper: {
    '^@legion/decent-planner$': '<rootDir>/../../planning/decent-planner/src/index.js',
    '^@legion/resource-manager$': '<rootDir>/../../resource-manager/src/index.js',
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