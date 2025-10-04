export default {
    testEnvironment: 'jsdom',
    setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
    testMatch: [
        '**/test/**/*.test.js'
    ],
    transform: {},
    collectCoverageFrom: [
        'src/**/*.js',
        '!src/index.js'
    ],
    moduleNameMapper: {
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
        '^@legion/components/index\\.js$': '<rootDir>/src/index.js',
        '^@legion/components$': '<rootDir>/src/index.js',
        '^/src/(.*)$': '<rootDir>/src/$1'
    }
};