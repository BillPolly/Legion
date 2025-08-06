export default {
  testEnvironment: 'node',
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  transform: {},
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/__tests__/**/*.spec.js'
  ],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  // setupFilesAfterEnv: ['<rootDir>/__tests__/utils/setup.js'],
  testTimeout: 10000
};