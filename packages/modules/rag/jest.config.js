export default {
  testEnvironment: 'node',
  testTimeout: 60000, // 60 seconds for LLM-heavy tests
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  verbose: false, // Reduce noise in parallel test runs
  maxWorkers: 1, // Run tests sequentially to avoid resource conflicts
  detectOpenHandles: false, // Disable for faster test completion
  forceExit: true // Force exit after tests complete
};