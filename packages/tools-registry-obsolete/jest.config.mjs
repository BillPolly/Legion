export default {
  testEnvironment: 'node',
  testMatch: [
    '**/__tests__/**/*.test.js'
  ],
  testPathIgnorePatterns: [
    '/node_modules/'
  ],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  transform: {},
  testTimeout: 30000,
  maxWorkers: 1,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true
};