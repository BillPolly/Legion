export default {
  testEnvironment: 'node',
  transform: {},
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverageFrom: ['src/**/*.js'],
  moduleNameMapper: {
    '^@legion/resource-manager$': '<rootDir>/../../resource-manager/src/index.js',
    '^@legion/nomic$': '<rootDir>/../../nomic/src/index.js',
    '^@legion/llm-client$': '<rootDir>/../../prompting/llm-client/src/index.js'
  },
  testTimeout: 30000
};