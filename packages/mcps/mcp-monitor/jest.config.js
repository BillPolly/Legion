export default {
  testEnvironment: 'node',
  transform: {},
  testMatch: ['**/__tests__/**/*.test.js'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/__tests__/integration/test-apps/',
    '/__tests__/unit/test-handler-app/'
  ],
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.js']
};