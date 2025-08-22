export default {
  testEnvironment: 'node',
  testMatch: [
    '**/__tests__/**/*.test.js'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/__tests__/utils/',
    '/__tests__/jest.setup.js',
    '/__tests__/jest.teardown.js'
  ],
  setupFilesAfterEnv: [
    './__tests__/jest.setup.js'
  ],
  globalTeardown: './__tests__/jest.teardown.js',
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  transform: {},
  // Increase timeout for integration tests that may include embedding generation
  testTimeout: 60000, // 1 minute for integration tests
  maxWorkers: 1,
  // Force exit to prevent hanging
  forceExit: true,
  // Detect open handles for debugging
  detectOpenHandles: true,
  // Exit after tests complete
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true
};