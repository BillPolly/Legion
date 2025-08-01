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
        '^/lib/yaml$': 'yaml',
        '^/lib/markdown-it$': 'markdown-it',
        '^/lib/highlight\\.js$': 'highlight.js',
        '^/lib/codemirror/(.*)$': '@codemirror/$1',
        '^/src/(.*)$': '<rootDir>/src/$1'
    }
};