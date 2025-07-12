export default {
  testEnvironment: 'node',
  transform: {},
  coverageDirectory: '../coverage',
  collectCoverageFrom: [
    '../src/**/*.js',
    '!../src/**/*.test.js',
    '!../src/**/__tests__/**'
  ],
  testMatch: [
    '**/unit/*.test.js',
    '**/integration/*.test.js'
  ],
  setupFilesAfterEnv: ['./setup.js'],
  testTimeout: 30000,
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  extensionsToTreatAsEsm: ['.js'],
  globals: {
    'ts-jest': {
      useESM: true
    }
  }
};