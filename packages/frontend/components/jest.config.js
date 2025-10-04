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
        '^/lib/codemirror/.*$': '<rootDir>/test/__mocks__/codemirror-bundle.js',
        '^@legion/components/index\\.js$': '<rootDir>/src/index.js',
        '^@legion/components$': '<rootDir>/src/index.js',
        '^/src/(.*)$': '<rootDir>/src/$1'
    }
};