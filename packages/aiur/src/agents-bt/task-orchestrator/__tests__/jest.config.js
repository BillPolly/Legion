export default {
  displayName: 'TaskOrchestrator',
  testMatch: ['**/__tests__/**/*.test.js'],
  testEnvironment: 'node',
  verbose: true,
  collectCoverage: false,
  
  // ES modules support
  extensionsToTreatAsEsm: ['.js'],
  globals: {
    'jest': {
      useESM: true
    }
  },
  transform: {},
  
  // Test timeouts for LLM operations
  testTimeout: 180000, // 3 minutes
  
  // Setup and teardown
  setupFilesAfterEnv: [],
  
  // Coverage settings (if enabled)
  collectCoverageFrom: [
    '../*.js',
    '!**/__tests__/**',
    '!**/node_modules/**'
  ],
  
  // Module resolution for Legion packages
  moduleNameMapping: {
    '^@legion/(.*)$': '<rootDir>/../../../../../../packages/$1/src/index.js'
  }
};