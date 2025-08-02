/**
 * Jest setup file for storage package tests
 * Configures test environment for ES modules and MongoDB testing
 */

// Only run setup if jest is available (for unit tests)
if (typeof jest !== 'undefined') {
  // Global test timeout for async operations
  jest.setTimeout(30000);

  // Suppress console.log during tests unless needed
  const originalConsoleLog = console.log;
  const originalConsoleWarn = console.warn;

  beforeAll(() => {
    if (process.env.NODE_ENV === 'test' && !process.env.VERBOSE_TESTS) {
      console.log = jest.fn();
      console.warn = jest.fn();
    }
  });

  afterAll(() => {
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
  });
}

// Global test utilities
global.testUtils = {
  // Helper to create test data
  createTestDocument: (id = 1) => ({
    _id: `test-doc-${id}`,
    name: `Test Document ${id}`,
    value: Math.floor(Math.random() * 100),
    created: new Date(),
    tags: [`tag-${id}`, 'test'],
    metadata: {
      version: 1,
      type: 'test-document'
    }
  }),

  // Helper to create multiple test documents
  createTestDocuments: (count = 5) => {
    return Array.from({ length: count }, (_, i) => 
      global.testUtils.createTestDocument(i + 1)
    );
  },

  // Helper to wait for async operations
  wait: (ms = 100) => new Promise(resolve => setTimeout(resolve, ms)),

  // Helper to create mock ResourceManager
  createMockResourceManager: () => ({
    get: jest.fn((key) => {
      switch (key) {
        case 'env.MONGODB_URL':
          return 'mongodb://localhost:27017/test';
        case 'env.STORAGE_CONFIG':
          return { maxConnections: 10 };
        default:
          return null;
      }
    }),
    register: jest.fn(),
    initialize: jest.fn().mockResolvedValue()
  })
};