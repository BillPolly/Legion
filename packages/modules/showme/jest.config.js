export default {
  // ES6 module support
  preset: null,
  testEnvironment: 'jsdom',
  
  // Test environment options
  testEnvironmentOptions: {
    customExportConditions: ['node', 'node-addons']
  },
  
  // Transform settings for ES modules
  transform: {},
  
  // Module resolution
  moduleNameMapper: {
    '^@legion/server-framework$': '<rootDir>/../../server-framework/src',
    '^@legion/resource-manager$': '<rootDir>/../../resource-manager/src', 
    '^@legion/actors$': '<rootDir>/../../shared/actors/src',
    '^@legion/(.+)$': '<rootDir>/../../$1/src'
  },
  
  // Test file patterns - exclude server and tool tests that need Node environment
  testMatch: [
    '**/__tests__/**/*.test.js',
    '!**/__tests__/unit/tools/*.test.js',
    '!**/__tests__/unit/ShowMeModule.test.js',
    '!**/__tests__/integration/**/*.test.js'
  ],
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.js'],
  
  // Coverage settings
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/__tests__/**'
  ],
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Automatically mock these modules
  modulePathIgnorePatterns: ['<rootDir>/__tests__/__mocks__/'],
  automock: false,
  
  // Verbose output for TDD workflow
  verbose: true
};