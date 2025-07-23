/**
 * Jest configuration for @legion/aiur
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
    '!src/**/index.js'
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
  
  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.test.js'
  ],
  
  // Module file extensions
  moduleFileExtensions: [
    'js',
    'json'
  ],
  
  // Verbose output
  verbose: true,
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Restore mocks after each test
  restoreMocks: true,
  
  // Test timeout
  testTimeout: 10000,
  
  // Module name mapping for workspace packages
  moduleNameMapper: {
    '^@legion/(.*)$': '<rootDir>/../$1/src/index.js'
  },
  
  // Transform ignore patterns - don't transform node_modules except @legion packages
  transformIgnorePatterns: [
    'node_modules/(?!(@legion)/)'
  ]
};