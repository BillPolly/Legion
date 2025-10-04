export default {
  testEnvironment: 'node',
  transform: {},
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@cli-ui/components/(.*)$': '<rootDir>/apps/cli-ui/src/components/$1',
    '^@cli-ui/utils/(.*)$': '<rootDir>/apps/cli-ui/src/utils/$1',
    '^@legion/components/(.*)$': '<rootDir>/../frontend/components/src/$1',
    '^@legion/neurosymbolic-reasoning$': '<rootDir>/../ai/neurosymbolic-reasoning/src/index.js',
    '^@legion/handle/remote$': '<rootDir>/../shared/data/handle/src/remote/RemoteHandle.js',
    '^@lib/codemirror/view$': '@codemirror/view',
    '^@lib/codemirror/state$': '@codemirror/state',
    '^@lib/codemirror/commands$': '@codemirror/commands',
    '^@lib/codemirror/language$': '@codemirror/language',
    '^@lib/codemirror/search$': '@codemirror/search',
    '^@lib/codemirror/autocomplete$': '@codemirror/autocomplete',
    '^@lib/codemirror/lang-javascript$': '@codemirror/lang-javascript',
    '^@lib/codemirror/theme-one-dark$': '@codemirror/theme-one-dark',
    '^@lib/markdown-it$': 'markdown-it',
    '^@lib/highlight\\.js$': 'highlight.js',
    '^@lib/yaml$': 'yaml',
    '^@lib/fast-diff$': 'fast-diff',
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