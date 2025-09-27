export default {
  testEnvironment: 'node',
  transform: {},
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverageFrom: ['src/**/*.js'],
  moduleNameMapper: {
    '^@legion/resource-manager$': '<rootDir>/../../resource-manager/src/index.js',
    '^@legion/sop-registry$': '<rootDir>/../sop-registry/src/index.js',
    '^@legion/tools-registry$': '<rootDir>/../../tools-registry/src/index.js',
    '^@legion/llm-client$': '<rootDir>/../../prompting/llm-client/src/index.js',
    '^@legion/prompt-manager$': '<rootDir>/../../prompting/prompt-manager/src/index.js'
  },
  testTimeout: 60000
};