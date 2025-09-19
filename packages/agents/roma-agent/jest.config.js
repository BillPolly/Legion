export default {
  testEnvironment: 'node',
  testMatch: [
    '**/__tests__/**/*.test.js'
  ],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js'
  ],
  testTimeout: 30000,
  forceExit: true,
  transform: {},
  globals: {
    '__DEV__': true
  }
};
