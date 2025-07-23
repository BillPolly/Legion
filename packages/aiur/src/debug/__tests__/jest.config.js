/**
 * Jest configuration for Web Debug Interface tests
 */

export default {
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.js'],
  globals: {
    'ts-jest': {
      useESM: true
    }
  },
  moduleNameMapping: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  testMatch: [
    '**/__tests__/**/*.test.js'
  ],
  collectCoverageFrom: [
    '../**/*.js',
    '!../__tests__/**',
    '!../web/**'
  ],
  coverageDirectory: '__coverage__',
  coverageReporters: ['text', 'html', 'json'],
  setupFilesAfterEnv: ['<rootDir>/fixtures/testSetup.js'],
  testTimeout: 30000,
  verbose: true
};