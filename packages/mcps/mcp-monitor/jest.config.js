export default {
  testEnvironment: 'node',
  transform: {},
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  testMatch: [
    '**/__tests__/**/*.test.js'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/logs/',
    '/scratch/'
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/__tests__/'
  ],
  collectCoverageFrom: [
    'handlers/**/*.js',
    'utils/**/*.js',
    'logger.js',
    'mcp-server.js',
    '!**/__tests__/**'
  ],
  verbose: true,
  testTimeout: 30000,
  forceExit: true,
  detectOpenHandles: true
};