export default {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/test/**/*.test.js'
  ],
  transform: {},
  moduleNameMapper: {
    '^@legion/tools-registry$': '<rootDir>/../../tools-registry/src/index.js',
    '^@legion/shared$': '<rootDir>/../../shared/src/index.js',
    '^@legion/storage$': '<rootDir>/../../storage/src/index.js',
    '^@legion/mongodb-provider$': '<rootDir>/../../storage/src/providers/mongodb/index.js',
    '^/legion/frontend-components/(.*)$': '<rootDir>/../../frontend/components/$1',
    '^/legion/tools/(.*)$': '<rootDir>/../../tools-registry/$1',
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
  testTimeout: 30000,
  transformIgnorePatterns: [
    'node_modules/(?!(@legion|mongodb|bson))'
  ],
  globals: {
    'ts-jest': {
      useESM: true
    }
  }
};