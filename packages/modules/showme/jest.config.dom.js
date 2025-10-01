/**
 * Jest configuration for DOM-based tests
 * Used for UI components that require jsdom environment
 */

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
  
  // Test file patterns - DOM-based tests only
  testMatch: [
    // Component tests that need DOM
    '**/__tests__/unit/components/**/*.test.js',
    '**/__tests__/renderers/**/*.test.js',
    '**/__tests__/integration/ViewersIntegration.test.js',
    '**/__tests__/integration/CompleteSystemIntegration.test.js',
    '**/__tests__/integration/ClientToUIIntegration.test.js',
    '**/__tests__/integration/E2E.AssetHandle.Display.test.js',
    '**/__tests__/integration/E2E.InMemoryImage.test.js',
    '**/__tests__/unit/renderers/**/*.test.js'
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
  verbose: true,
  
  // Run tests sequentially to prevent hanging
  maxWorkers: 1,
  
  // Force exit after tests complete
  forceExit: true,
  
  // Detect open handles
  detectOpenHandles: false,
  
  // Timeout for tests
  testTimeout: 30000
};