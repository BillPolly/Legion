export default {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/test/**/*.test.js'
  ],
  transform: {},
  moduleNameMapper: {
    '^@legion/tools-registry$': '<rootDir>/../../tools/src/index.js',
    '^@legion/shared$': '<rootDir>/../../shared/src/index.js',
    '^@legion/semantic-search$': '<rootDir>/../../semantic-search/src/index.js',
    '^@legion/storage$': '<rootDir>/../../storage/src/index.js',
    '^/legion/frontend-components/(.*)$': '<rootDir>/../../frontend/components/$1',
    '^/legion/tools/(.*)$': '<rootDir>/../../tools/$1',
    '^/legion/shared/(.*)$': '<rootDir>/../../shared/$1',
    '^/legion/actors/(.*)$': '<rootDir>/../../shared/actors/$1'
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