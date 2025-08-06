export default {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/__tests__/utils/jest-globals.js'],
  transform: {},
  setupFilesAfterEnv: ['<rootDir>/__tests__/utils/setup.js'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/index.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testMatch: [
    '**/__tests__/**/*.test.js'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/__tests__/tmp/',
    '/__tests__/fixtures/'
  ],
  testTimeout: 30000,
  maxWorkers: 4,
  verbose: false
};