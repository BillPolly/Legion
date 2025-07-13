export default {
  testEnvironment: 'jsdom',
  transform: {},
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.js'],
  testMatch: [
    '<rootDir>/__tests__/**/*.test.js'
  ],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/test-setup.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html']
};