export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^vscode$': '<rootDir>/__tests__/helpers/vscode-mock.ts'
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      useESM: true,
      isolatedModules: true,
      diagnostics: {
        ignoreCodes: [7006, 7019, 7005, 2339]
      }
    }],
  },
  testMatch: [
    '**/__tests__/**/*.test.ts'
  ],
  collectCoverageFrom: [
    'src/**/*.{ts}',
    '!src/**/*.d.ts',
    '!src/types.ts'
  ],
  coverageDirectory: '__tests__/coverage',
  testTimeout: 30000,
  verbose: true
};
