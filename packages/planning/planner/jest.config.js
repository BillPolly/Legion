export default {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85
    }
  },
  testTimeout: 60000, // 60 seconds for tests making real LLM calls
  moduleNameMapper: {
    '^@test/(.*)$': '<rootDir>/__tests__/$1'
  },
  transform: {},
  testPathIgnorePatterns: [
    '/node_modules/',
    '/__tests__/utils/'
  ],
  // Force exit to prevent hanging on async operations
  forceExit: true,
  // Run tests serially to avoid resource conflicts
  maxWorkers: 1
};