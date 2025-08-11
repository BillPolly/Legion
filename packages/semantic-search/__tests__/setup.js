/**
 * Test setup for @legion/semantic-search
 * 
 * Configures test environment, mocks, and utilities
 * for semantic search package testing.
 */

import { jest } from '@jest/globals';

// Only use local ONNX embeddings - no OpenAI mocking needed

// Mock Qdrant client
jest.unstable_mockModule('@qdrant/js-client-rest', () => ({
  QdrantClient: jest.fn().mockImplementation(() => ({
    getClusterInfo: jest.fn().mockResolvedValue({ status: 'green' }),
    getCollections: jest.fn().mockResolvedValue({ collections: [] }),
    createCollection: jest.fn().mockResolvedValue({ operation_id: 1 }),
    getCollection: jest.fn().mockResolvedValue({ config: { params: { vectors: { size: 384 } } } }), // Local ONNX dimensions
    upsert: jest.fn().mockResolvedValue({ operation_id: 1, status: 'completed' }),
    search: jest.fn().mockResolvedValue([]),
    scroll: jest.fn().mockResolvedValue({ points: [] }),
    count: jest.fn().mockResolvedValue({ count: 0 }),
    delete: jest.fn().mockResolvedValue({ operation_id: 1 }),
    deleteCollection: jest.fn().mockResolvedValue({}),
    setPayload: jest.fn().mockResolvedValue({ operation_id: 1 }),
    createPayloadIndex: jest.fn().mockResolvedValue({})
  }))
}));

// Mock Legion storage for testing
const mockProvider = {
  connect: jest.fn().mockResolvedValue(),
  disconnect: jest.fn().mockResolvedValue(),
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
  insert: jest.fn().mockResolvedValue({ insertedCount: 1 }),
  update: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
  delete: jest.fn().mockResolvedValue({ deletedCount: 1 }),
  count: jest.fn().mockResolvedValue(0),
  listCollections: jest.fn().mockResolvedValue([]),
  dropCollection: jest.fn().mockResolvedValue(true)
};

jest.unstable_mockModule('@legion/storage', () => ({
  Provider: jest.fn().mockImplementation(function(config) {
    this.config = config;
    this.connected = false;
    this.connect = jest.fn().mockImplementation(async () => { this.connected = true; });
    this.disconnect = jest.fn().mockImplementation(async () => { this.connected = false; });
    this.find = jest.fn().mockResolvedValue([]);
    this.findOne = jest.fn().mockResolvedValue(null);
    this.insert = jest.fn().mockResolvedValue({ insertedCount: 1 });
    this.update = jest.fn().mockResolvedValue({ modifiedCount: 1 });
    this.delete = jest.fn().mockResolvedValue({ deletedCount: 1 });
    this.isConnected = jest.fn().mockImplementation(() => this.connected);
    this.getCapabilities = jest.fn().mockReturnValue(['find', 'insert', 'update', 'delete']);
    this.getMetadata = jest.fn().mockImplementation(() => ({ 
      name: 'MockProvider', 
      connected: this.connected 
    }));
  })
}));

// Test utilities
export const TestUtils = {
  /**
   * Create a mock ResourceManager for testing
   */
  createMockResourceManager(config = {}) {
    return {
      initialized: true,
      get: jest.fn().mockImplementation(key => {
        const defaults = {
          // Only local embeddings - no OpenAI key
          'env.USE_LOCAL_EMBEDDINGS': 'true',
          'env.QDRANT_URL': 'http://localhost:6333',
          'env.QDRANT_API_KEY': 'test-qdrant-key',
          'env.SEMANTIC_SEARCH_BATCH_SIZE': '100',
          'env.SEMANTIC_SEARCH_CACHE_TTL': '3600',
          'env.SEMANTIC_SEARCH_ENABLE_CACHE': 'true',
          ...config
        };
        return defaults[key];
      })
    };
  },

  /**
   * Create mock tool documents for testing
   */
  createMockTools(count = 5) {
    const tools = [];
    for (let i = 1; i <= count; i++) {
      tools.push({
        id: `tool_${i}`,
        name: `test_tool_${i}`,
        description: `Test tool number ${i} for testing purposes`,
        parameters: {
          input: { type: 'string', description: 'Input parameter' }
        },
        module: `test-module-${Math.ceil(i / 2)}`,
        tags: [`tag${i}`, 'test'],
        examples: [`Example usage for tool ${i}`]
      });
    }
    return tools;
  },

  /**
   * Create mock search results
   */
  createMockSearchResults(count = 3, baseScore = 0.8) {
    const results = [];
    for (let i = 1; i <= count; i++) {
      results.push({
        document: this.createMockTools(1)[0],
        score: baseScore - (i - 1) * 0.1,
        id: `result_${i}`,
        vector: null
      });
    }
    return results;
  },

  /**
   * Create mock embeddings
   */
  createMockEmbeddings(count = 1, dimension = 384) { // Local ONNX model uses 384 dimensions
    const embeddings = [];
    for (let i = 0; i < count; i++) {
      embeddings.push(new Array(dimension).fill(0).map(() => Math.random()));
    }
    return embeddings;
  },

  /**
   * Wait for promises to resolve (useful for async testing)
   */
  async waitFor(ms = 10) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * Assert similarity score is within expected range
   */
  assertValidSimilarityScore(score) {
    expect(typeof score).toBe('number');
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  },

  /**
   * Assert search result has required properties
   */
  assertValidSearchResult(result) {
    expect(result).toHaveProperty('document');
    expect(result).toHaveProperty('_similarity');
    expect(result).toHaveProperty('_searchType');
    this.assertValidSimilarityScore(result._similarity);
  },

  /**
   * Assert hybrid search result has additional properties
   */
  assertValidHybridResult(result) {
    this.assertValidSearchResult(result);
    expect(result).toHaveProperty('_hybridScore');
    expect(result).toHaveProperty('_semanticScore');
    expect(result).toHaveProperty('_keywordScore');
    this.assertValidSimilarityScore(result._hybridScore);
    this.assertValidSimilarityScore(result._semanticScore);
    this.assertValidSimilarityScore(result._keywordScore);
  }
};

// Global test configuration
global.console = {
  ...console,
  // Suppress expected warnings in tests
  warn: jest.fn(),
  log: jest.fn()
};

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});