export default {
  testEnvironment: 'node',
  testMatch: [
    '**/__tests__/**/*.test.js'
  ],
  verbose: true,
  testTimeout: 10000,
  transform: {},
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js'
  ]
};