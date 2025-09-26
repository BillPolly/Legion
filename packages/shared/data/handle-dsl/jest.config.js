/**
 * Jest configuration for @legion/handle-dsl package
 */

export default {
  // Test environment
  testEnvironment: 'node',
  
  // Module type
  preset: null,
  
  // Transform configuration
  transform: {},
  
  // Node flags for ES module support
  globals: {
    'NODE_OPTIONS': '--experimental-vm-modules'
  },
  
  // Inject Jest globals
  injectGlobals: true,
  
  // Module name mapping for workspace dependencies
  moduleNameMapper: {
    '^@legion/handle$': '<rootDir>/../handle/src/index.js'
  },
  
  // Test file patterns
  testMatch: [
    '<rootDir>/__tests__/**/*.test.js'
  ],
  
  // Ignore the old test files
  testPathIgnorePatterns: [
    '/node_modules/',
    '/test/'
  ],
  
  // Collect coverage from src files
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js' // Exclude index file from coverage
  ],
  
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  
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