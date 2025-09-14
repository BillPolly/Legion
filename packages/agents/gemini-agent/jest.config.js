export default {
  testEnvironment: 'node',
  testMatch: [
    '**/__tests__/**/*.test.js'
  ],
  verbose: true,
  testTimeout: 200000, // 200 seconds for LLM integration tests
  maxWorkers: 1, // Run tests sequentially to avoid parallel execution conflicts
  transform: {},
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js'
  ]
};