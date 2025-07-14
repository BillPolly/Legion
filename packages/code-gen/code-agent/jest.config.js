/**
 * Jest configuration for @jsenvoy/code-agent
 * 
 * This configuration supports ES6 modules and provides comprehensive testing
 * capabilities for the code agent package.
 */

export default {
  // Test environment
  testEnvironment: 'node',
  
  // Enable ES6 modules support
  preset: undefined,
  transform: {},
  
  // Coverage configuration
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/__tests__/**',
    '!src/**/index.js' // Exclude barrel exports from coverage
  ],
  
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  
  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/?(*.)+(spec|test).js'
  ],
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/coverage/',
    '__tests__/fixtures/'
  ],
  
  // Setup files
  setupFilesAfterEnv: [],
  
  // Module file extensions
  moduleFileExtensions: [
    'js',
    'json'
  ],
  
  // Verbose output for detailed test results
  verbose: true,
  
  // Detect open handles to prevent hanging tests
  detectOpenHandles: true,
  
  // Force exit after tests complete
  forceExit: false,
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Restore mocks after each test
  restoreMocks: true,
  
  // Error on deprecated features
  errorOnDeprecated: true,
  
  // Test timeout (30 seconds for potential LLM calls)
  testTimeout: 30000,
  
  // Global test variables
  globals: {
    'NODE_ENV': 'test'
  },
  
  // Module name mapping for local development
  moduleNameMapper: {
    '^@jsenvoy/(.*)$': '<rootDir>/../../$1/src'
  }
};