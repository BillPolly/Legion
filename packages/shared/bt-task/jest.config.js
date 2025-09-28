export default {
  testEnvironment: 'node',
  transform: {},
  moduleNameMapper: {
    '^@legion/tasks$': '<rootDir>/../tasks/src/index.js',
    '^@legion/resource-manager$': '<rootDir>/../../resource-manager/src/index.js',
    '^@legion/tools$': '<rootDir>/../../tools-registry/src/index.js'
  },
  testMatch: [
    '**/__tests__/**/*.test.js'
  ],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  verbose: true,
  testTimeout: 10000
};