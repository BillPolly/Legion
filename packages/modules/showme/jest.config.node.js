/**
 * Jest configuration for Node.js environment tests
 * Used for server-side code and integration tests
 */

export default {
  // ES6 module support
  preset: null,
  testEnvironment: 'node',
  
  // Transform settings for ES modules
  transform: {},
  
  // Module resolution
  moduleNameMapper: {
    '^@legion/server-framework$': '<rootDir>/../../server-framework/src',
    '^@legion/resource-manager$': '<rootDir>/../../resource-manager/src', 
    '^@legion/actors$': '<rootDir>/../../shared/actors/src',
    '^@legion/(.+)$': '<rootDir>/../../$1/src'
  },
  
  // Test file patterns - only server and integration tests
  testMatch: [
    '**/__tests__/unit/tools/*.test.js',
    '**/__tests__/unit/ShowMeModule.test.js',
    '**/__tests__/integration/**/*.test.js'
  ],
  
  // Coverage settings
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/__tests__/**'
  ],
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Verbose output for TDD workflow
  verbose: true,
  
  // Test timeout
  testTimeout: 30000,
  
  // Force exit after tests complete
  forceExit: true
};