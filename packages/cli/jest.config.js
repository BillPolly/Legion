export default {
  testEnvironment: 'node',
  transform: {},
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@cli-ui/components/(.*)$': '<rootDir>/apps/cli-ui/src/components/$1',
    '^@cli-ui/utils/(.*)$': '<rootDir>/apps/cli-ui/src/utils/$1',
    '^@legion/components/(.*)$': '<rootDir>/../frontend/components/src/$1',
    '^@legion/handle/remote$': '<rootDir>/../shared/data/handle/src/remote/RemoteHandle.js',
  },
  testMatch: [
    '**/__tests__/**/*.test.js'
  ],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js'
  ],
  coverageDirectory: 'coverage',
  testTimeout: 30000,
  verbose: true,
  globalTeardown: './__tests__/globalTeardown.js'
};