export default {
  // Test environment
  testEnvironment: 'node',
  
  // Enable ES modules support
  preset: null,
  
  // Test file patterns
  testMatch: [
    '<rootDir>/test/**/*.test.js'
  ],
  
  // Coverage settings
  collectCoverage: false,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js'
  ],
  
  // Timeout for async tests
  testTimeout: 30000,
  
  // Verbose output
  verbose: true,
  
  // Transform settings for ES modules
  transform: {},
  
  // Module file extensions
  moduleFileExtensions: ['js', 'json'],
  
  // Test path ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/'
  ],
  
  // Run tests serially to avoid port conflicts and resource issues
  maxWorkers: 1,
  
  // Force exit after tests complete
  forceExit: true,
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Reset modules between tests
  resetModules: true,
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/test/setup.js']
};
