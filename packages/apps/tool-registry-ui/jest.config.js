export default {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/test/**/*.test.js'
  ],
  transform: {},
  extensionsToTreatAsEsm: ['.js'],
  moduleNameMapper: {
    '^@legion/tools$': '<rootDir>/../../tools/src/index.js',
    '^@legion/shared$': '<rootDir>/../../shared/src/index.js',
    '^@legion/semantic-search$': '<rootDir>/../../semantic-search/src/index.js',
    '^@legion/storage$': '<rootDir>/../../storage/src/index.js'
  },
  collectCoverageFrom: [
    'src/**/*.js',
    'server/**/*.js',
    '!src/index.js',
    '!server/server.js'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 30000
};