/**
 * Jest configuration for @legion/km-data-handle package
 */

export default {
  // Test environment
  testEnvironment: 'node',
  
  // Module type
  preset: null,
  
  // Transform configuration
  transform: {},
  
  // Node flags for ES module support and jest globals
  globals: {
    'NODE_OPTIONS': '--experimental-vm-modules'
  },
  
  // Inject Jest globals
  injectGlobals: true,
  
  // Module name mapping for workspace dependencies
  moduleNameMapper: {
    '^@legion/actors$': '<rootDir>/../../actors/src/index.js'
  },
  
  // Test file patterns
  testMatch: [
    '<rootDir>/__tests__/**/*.test.js'
  ],
  
  // Collect coverage from src files
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js' // Exclude index file from coverage
  ],
  
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    }
  },
  
  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/__tests__/setup.js'
  ],
  
  // Test timeout
  testTimeout: 10000,
  
  // Verbose output
  verbose: true,
  
  // Error on deprecated features
  errorOnDeprecated: true,
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Restore mocks after each test
  restoreMocks: true
};