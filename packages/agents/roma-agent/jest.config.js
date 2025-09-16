export default {
  testEnvironment: 'node',
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^ws$': '<rootDir>/test-utils/wsStub.cjs'
  },
  transform: {},
  testMatch: [
    '**/__tests__/**/*.test.js'
  ],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js'
  ],
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.js'],
  testTimeout: 30000, // Allow time for real LLM calls
  maxWorkers: 1, // Sequential execution for resource management
  forceExit: true // Force Jest to exit after tests complete
};
