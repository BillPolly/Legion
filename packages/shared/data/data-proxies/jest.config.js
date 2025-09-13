export default {
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@legion/data-store$': '<rootDir>/../data-store/index.js',
    '^@legion/datascript$': '<rootDir>/../datascript/index.js'
  },
  testMatch: [
    '**/__tests__/**/*.test.js'
  ],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js'
  ],
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100
    }
  }
};