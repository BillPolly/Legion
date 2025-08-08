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
      // JSDOM environment for frontend integration tests
      testEnvironment: 'jsdom',
      testMatch: ['**/__tests__/integration/frontend-*.test.js'],
      setupFilesAfterEnv: ['<rootDir>/__tests__/setup-frontend.js'],
      moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1'
      }
    },
    {
      // Node.js environment for other integration tests
      testEnvironment: 'node',
      testMatch: ['**/__tests__/integration/!(frontend-*).test.js'],
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
  verbose: true
};