export default {
  testEnvironment: 'node',
  transform: {},
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  testMatch: [
    '**/__tests__/**/*.test.js'
  ],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js'
  ],
  testTimeout: 30000, // Default 30s for LLM calls
  
  // Increased memory for large integration tests
  maxWorkers: 2,
  
  // Verbose output for debugging integration issues
  verbose: true
};