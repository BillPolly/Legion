/**
 * Jest configuration for @legion/semantic-search
 */

export default {
  testEnvironment: 'node',
  projects: [
    {
      // Node.js environment for unit tests
      testEnvironment: 'node',
      testMatch: ['**/__tests__/unit/**/*.test.js'],
      moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1'
      }
    },
    {
      // Node.js environment for integration tests
      testEnvironment: 'node',
      testMatch: ['**/__tests__/integration/**/*.test.js'],
      moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1'
      }
    }
  ],
  transform: {},
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/index.js'
  ],
  coverageThreshold: {
    global: {
      branches: 70, // Lower threshold for integration tests
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  testTimeout: 10000,
  verbose: true,
  // Run tests sequentially to avoid ONNX Runtime singleton conflicts
  maxWorkers: 1,
  maxConcurrency: 1
};