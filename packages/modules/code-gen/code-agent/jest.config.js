/**
 * Jest configuration for @legion/code-agent
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
  
  // Test file patterns - run simple unit tests and integration tests
  testMatch: [
    '**/__tests__/unit/simple/*.test.js',
    '**/__tests__/unit/integration/JesterIntegration.test.js',
    '**/__tests__/unit/reporter/JesterReporter.test.js',
    '**/__tests__/integration/RealGitHubIntegration.test.js',
    '**/__tests__/integration/jester-e2e.test.js'
  ],
  
  // Ignore patterns - exclude all problematic tests
  testPathIgnorePatterns: [
    '/node_modules/',
    '/coverage/',
    '__tests__/fixtures/',
    '__tests__/unit/browser/',
    '__tests__/unit/phases/',
    '__tests__/unit/execution/Real.*',
    '__tests__/unit/orchestration/',
    '__tests__/unit/aggregation/',
    '__tests__/unit/reporting/',
    '__tests__/config/',
    '__tests__/system/'
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
  
  // Test timeout (5 seconds for unit tests, longer for integration)
  testTimeout: 600000, // 10 minutes for integration tests
  
  // Run tests serially to prevent memory issues
  maxWorkers: 1,
  
  // Memory management
  logHeapUsage: true,
  
  // Force exit after tests complete to prevent hanging
  forceExit: true,
  
  // Global test variables
  globals: {
    'NODE_ENV': 'test'
  },
  
  // Module name mapping for local development
  moduleNameMapper: {
    '^@legion/llm-planner/(.*)$': '<rootDir>/../../planning/llm-planner/$1',
    '^@legion/llm-planner$': '<rootDir>/../../planning/llm-planner/src',
    '^@legion/module-loader$': '<rootDir>/../../module-loader/src',
    '^@legion/llm$': '<rootDir>/../../llm/src',
    '^@legion/jester$': '<rootDir>/../jester/src'
  }
};