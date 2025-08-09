export default {
  // Use Node.js environment for testing
  testEnvironment: 'node',
  
  // Enable ES modules support (removed .js as it's inferred from package.json)
  
  // Transform configuration for ES modules
  transform: {},
  
  // Module file extensions
  moduleFileExtensions: ['js', 'json'],
  
  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/?(*.)+(spec|test).js'
  ],
  
  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!**/node_modules/**'
  ],
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  
  // Test timeout for integration tests
  testTimeout: 30000,
  
  // Module name mapping for Legion packages
  moduleNameMapper: {
    '^@legion/tools$': '<rootDir>/../../tools/src/index.js'
  },
  
  // Verbose output for debugging
  verbose: true,
  
  // Force exit after tests complete
  forceExit: true,
  
  // Detect handles that prevent Jest from exiting
  detectOpenHandles: true
};