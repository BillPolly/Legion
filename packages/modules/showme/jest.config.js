export default {
  // ES6 module support
  preset: null,
  testEnvironment: 'node',

  // Test environment options
  testEnvironmentOptions: {
    customExportConditions: ['node', 'node-addons']
  },

  // Transform settings for ES modules
  transform: {},
  
  // Test file patterns - non-DOM tests only
  testMatch: [
    '**/__tests__/**/*.test.js',
    // Exclude server/tool tests (handled by jest.config.node.js)
    '!**/__tests__/unit/tools/*.test.js',
    '!**/__tests__/unit/ShowMeModule.test.js',
    '!**/__tests__/integration/**/*.test.js',
    // Exclude DOM-based tests (handled by jest.config.dom.js)
    '!**/__tests__/unit/components/**/*.test.js',
    '!**/__tests__/renderers/**/*.test.js',
    '!**/__tests__/unit/renderers/**/*.test.js'
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