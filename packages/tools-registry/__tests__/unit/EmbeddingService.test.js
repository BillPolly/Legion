/**
 * EmbeddingService Unit Tests
 * 
 * Tests for embedding generation functionality following TDD principles
 * All tests written before implementation - they should fail initially
 * 
 * Test Categories:
 * 1. Embedding generation - single and batch
 * 2. Dimension validation and consistency
 * 3. Error handling and edge cases
 * 4. Integration with ResourceManager pattern
 * 5. Caching and performance optimization
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { EmbeddingService } from '../../src/search/EmbeddingService.js';
import { EmbeddingError } from '../../src/errors/index.js';

describe('EmbeddingService', () => {
  let mockResourceManager;
  let mockLlmClient;
  let embeddingService;

  beforeEach(() => {
    // Mock ResourceManager
    mockResourceManager = {
      get: jest.fn()
    };

    // Mock LLM client for embedding generation
    mockLlmClient = {
      generateEmbedding: jest.fn(),
      generateEmbeddings: jest.fn(),
      isAvailable: jest.fn(() => true)
    };

    mockResourceManager.get.mockImplementation((key) => {
      switch (key) {
        case 'llmClient':
          return mockLlmClient;
        default:
          return null;
      }
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor and Initialization', () => {
    test('should create EmbeddingService with ResourceManager', () => {
      embeddingService = new EmbeddingService({
        resourceManager: mockResourceManager,
        options: { dimensions: 768 }
      });

      expect(embeddingService).toBeDefined();
      expect(embeddingService.initialized).toBe(false);
      expect(embeddingService.options.dimensions).toBe(768);
    });

    test('should throw error if ResourceManager is missing', () => {
      expect(() => {
        new EmbeddingService({});
      }).toThrow(EmbeddingError);
    });

    test('should use default options when none provided', () => {
      embeddingService = new EmbeddingService({
        resourceManager: mockResourceManager
      });

      expect(embeddingService.options.dimensions).toBe(384); // Default dimension
      expect(embeddingService.options.batchSize).toBe(20);
      expect(embeddingService.options.cacheSize).toBe(1000);
    });

    test('should initialize successfully with valid ResourceManager', async () => {
      embeddingService = new EmbeddingService({
        resourceManager: mockResourceManager
      });

      await embeddingService.initialize();

      expect(embeddingService.initialized).toBe(true);
      expect(mockResourceManager.get).toHaveBeenCalledWith('llmClient');
    });

    test('should throw error if LLM client not available during initialization', async () => {
      mockResourceManager.get.mockReturnValue(null);
      
      embeddingService = new EmbeddingService({
        resourceManager: mockResourceManager
      });

      await expect(embeddingService.initialize()).rejects.toThrow(EmbeddingError);
    });
  });

  describe('Single Embedding Generation', () => {
    beforeEach(async () => {
      embeddingService = new EmbeddingService({
        resourceManager: mockResourceManager
      });
      await embeddingService.initialize();
    });

    test('should generate embedding for single text', async () => {
      const mockEmbedding = new Array(384).fill(0).map(() => Math.random());
      mockLlmClient.generateEmbedding.mockResolvedValue(mockEmbedding);

      const result = await embeddingService.generateEmbedding('test text');

      expect(mockLlmClient.generateEmbedding).toHaveBeenCalledWith('test text');
      expect(result).toEqual(mockEmbedding);
      expect(result).toHaveLength(384);
    });

    test('should validate embedding dimensions', async () => {
      const wrongDimensions = new Array(256).fill(0).map(() => Math.random());
      mockLlmClient.generateEmbedding.mockResolvedValue(wrongDimensions);

      await expect(embeddingService.generateEmbedding('test text')).rejects.toThrow(EmbeddingError);
    });

    test('should handle empty text input', async () => {
      await expect(embeddingService.generateEmbedding('')).rejects.toThrow(EmbeddingError);
      await expect(embeddingService.generateEmbedding(null)).rejects.toThrow(EmbeddingError);
      await expect(embeddingService.generateEmbedding(undefined)).rejects.toThrow(EmbeddingError);
    });

    test('should handle very long text input', async () => {
      const longText = 'a'.repeat(10000);
      const mockEmbedding = new Array(384).fill(0).map(() => Math.random());
      mockLlmClient.generateEmbedding.mockResolvedValue(mockEmbedding);

      const result = await embeddingService.generateEmbedding(longText);

      expect(result).toEqual(mockEmbedding);
      // Text should be truncated to maxTextLength (8192)
      expect(mockLlmClient.generateEmbedding).toHaveBeenCalledWith('a'.repeat(8192));
    });

    test('should cache embeddings for repeated text', async () => {
      const mockEmbedding = new Array(384).fill(0).map(() => Math.random());
      mockLlmClient.generateEmbedding.mockResolvedValue(mockEmbedding);

      const result1 = await embeddingService.generateEmbedding('test text');
      const result2 = await embeddingService.generateEmbedding('test text');

      expect(result1).toEqual(result2);
      expect(mockLlmClient.generateEmbedding).toHaveBeenCalledTimes(1);
    });
  });

  describe('Batch Embedding Generation', () => {
    beforeEach(async () => {
      embeddingService = new EmbeddingService({
        resourceManager: mockResourceManager,
        options: { batchSize: 5 }
      });
      await embeddingService.initialize();
    });

    test('should generate embeddings for array of texts', async () => {
      const texts = ['text1', 'text2', 'text3'];
      const mockEmbeddings = texts.map(() => 
        new Array(384).fill(0).map(() => Math.random())
      );
      mockLlmClient.generateEmbeddings.mockResolvedValue(mockEmbeddings);

      const results = await embeddingService.generateEmbeddings(texts);

      expect(mockLlmClient.generateEmbeddings).toHaveBeenCalledWith(texts);
      expect(results).toEqual(mockEmbeddings);
      expect(results).toHaveLength(3);
    });

    test('should handle batch processing for large arrays', async () => {
      const texts = new Array(12).fill(0).map((_, i) => `text${i}`);
      const mockEmbeddings = texts.map(() => 
        new Array(384).fill(0).map(() => Math.random())
      );
      
      // Mock batch responses (5 + 5 + 2)
      mockLlmClient.generateEmbeddings
        .mockResolvedValueOnce(mockEmbeddings.slice(0, 5))
        .mockResolvedValueOnce(mockEmbeddings.slice(5, 10))
        .mockResolvedValueOnce(mockEmbeddings.slice(10, 12));

      const results = await embeddingService.generateEmbeddings(texts);

      expect(mockLlmClient.generateEmbeddings).toHaveBeenCalledTimes(3);
      expect(results).toHaveLength(12);
      expect(results).toEqual(mockEmbeddings);
    });

    test('should validate all embedding dimensions in batch', async () => {
      const texts = ['text1', 'text2'];
      const mockEmbeddings = [
        new Array(384).fill(0).map(() => Math.random()),
        new Array(256).fill(0).map(() => Math.random()) // Wrong dimension
      ];
      mockLlmClient.generateEmbeddings.mockResolvedValue(mockEmbeddings);

      await expect(embeddingService.generateEmbeddings(texts)).rejects.toThrow(EmbeddingError);
    });

    test('should handle partial batch failures gracefully', async () => {
      const texts = ['text1', 'text2', 'text3'];
      mockLlmClient.generateEmbeddings.mockRejectedValue(new Error('API Error'));

      await expect(embeddingService.generateEmbeddings(texts)).rejects.toThrow(EmbeddingError);
    });

    test('should handle empty array input', async () => {
      const results = await embeddingService.generateEmbeddings([]);
      expect(results).toEqual([]);
      expect(mockLlmClient.generateEmbeddings).not.toHaveBeenCalled();
    });

    test('should filter out invalid texts in batch', async () => {
      const texts = ['valid text', '', null, 'another valid text', undefined];
      const validTexts = ['valid text', 'another valid text'];
      const mockEmbeddings = validTexts.map(() => 
        new Array(384).fill(0).map(() => Math.random())
      );
      mockLlmClient.generateEmbeddings.mockResolvedValue(mockEmbeddings);

      const results = await embeddingService.generateEmbeddings(texts);

      expect(mockLlmClient.generateEmbeddings).toHaveBeenCalledWith(validTexts);
      expect(results).toHaveLength(2);
    });
  });

  describe('Dimension Validation', () => {
    beforeEach(async () => {
      embeddingService = new EmbeddingService({
        resourceManager: mockResourceManager,
        options: { dimensions: 768 }
      });
      await embeddingService.initialize();
    });

    test('should validate embedding has correct dimensions', () => {
      const validEmbedding = new Array(768).fill(0).map(() => Math.random());
      const invalidEmbedding = new Array(384).fill(0).map(() => Math.random());

      expect(embeddingService._validateEmbedding(validEmbedding)).toBe(true);
      expect(() => embeddingService._validateEmbedding(invalidEmbedding)).toThrow(EmbeddingError);
    });

    test('should validate embedding contains only numbers', () => {
      const validEmbedding = new Array(768).fill(0).map(() => Math.random());
      const invalidEmbedding = [...validEmbedding];
      invalidEmbedding[100] = 'not a number';

      expect(embeddingService._validateEmbedding(validEmbedding)).toBe(true);
      expect(() => embeddingService._validateEmbedding(invalidEmbedding)).toThrow(EmbeddingError);
    });

    test('should validate embedding is not empty or null', () => {
      expect(() => embeddingService._validateEmbedding([])).toThrow(EmbeddingError);
      expect(() => embeddingService._validateEmbedding(null)).toThrow(EmbeddingError);
      expect(() => embeddingService._validateEmbedding(undefined)).toThrow(EmbeddingError);
    });

    test('should validate embedding values are finite', () => {
      const invalidEmbedding = new Array(768).fill(0).map(() => Math.random());
      invalidEmbedding[50] = Infinity;
      invalidEmbedding[100] = NaN;

      expect(() => embeddingService._validateEmbedding(invalidEmbedding)).toThrow(EmbeddingError);
    });
  });

  describe('Caching Functionality', () => {
    beforeEach(async () => {
      embeddingService = new EmbeddingService({
        resourceManager: mockResourceManager,
        options: { cacheSize: 3 }
      });
      await embeddingService.initialize();
    });

    test('should cache embeddings and retrieve from cache', async () => {
      const mockEmbedding = new Array(384).fill(0).map(() => Math.random());
      mockLlmClient.generateEmbedding.mockResolvedValue(mockEmbedding);

      // First call should generate
      const result1 = await embeddingService.generateEmbedding('test text');
      expect(mockLlmClient.generateEmbedding).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const result2 = await embeddingService.generateEmbedding('test text');
      expect(mockLlmClient.generateEmbedding).toHaveBeenCalledTimes(1);
      expect(result1).toEqual(result2);
    });

    test('should evict oldest entries when cache is full', async () => {
      const mockEmbedding = new Array(384).fill(0).map(() => Math.random());
      mockLlmClient.generateEmbedding.mockResolvedValue(mockEmbedding);

      // Fill cache to capacity (cache size is 3)
      await embeddingService.generateEmbedding('text1'); // 1st
      await embeddingService.generateEmbedding('text2'); // 2nd
      await embeddingService.generateEmbedding('text3'); // 3rd
      expect(mockLlmClient.generateEmbedding).toHaveBeenCalledTimes(3);

      // Add one more - should evict oldest (text1)
      await embeddingService.generateEmbedding('text4'); // evicts text1
      expect(mockLlmClient.generateEmbedding).toHaveBeenCalledTimes(4);

      // text1 should be evicted, so this should generate again
      await embeddingService.generateEmbedding('text1');
      expect(mockLlmClient.generateEmbedding).toHaveBeenCalledTimes(5);

      // text3 should still be cached (don't access text2 as it would change LRU order)
      await embeddingService.generateEmbedding('text3');
      expect(mockLlmClient.generateEmbedding).toHaveBeenCalledTimes(5);
    });

    test('should provide cache statistics', () => {
      const stats = embeddingService.getCacheStats();
      
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('maxSize');
      expect(stats).toHaveProperty('hitCount');
      expect(stats).toHaveProperty('missCount');
      expect(stats).toHaveProperty('hitRate');
    });

    test('should clear cache when requested', async () => {
      const mockEmbedding = new Array(384).fill(0).map(() => Math.random());
      mockLlmClient.generateEmbedding.mockResolvedValue(mockEmbedding);

      // Generate and cache
      await embeddingService.generateEmbedding('test text');
      expect(mockLlmClient.generateEmbedding).toHaveBeenCalledTimes(1);

      // Clear cache
      embeddingService.clearCache();

      // Should generate again
      await embeddingService.generateEmbedding('test text');
      expect(mockLlmClient.generateEmbedding).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      embeddingService = new EmbeddingService({
        resourceManager: mockResourceManager
      });
      await embeddingService.initialize();
    });

    test('should throw EmbeddingError for LLM service failures', async () => {
      mockLlmClient.generateEmbedding.mockRejectedValue(new Error('LLM service unavailable'));

      await expect(embeddingService.generateEmbedding('test text')).rejects.toThrow(EmbeddingError);
    });

    test('should throw EmbeddingError for invalid input types', async () => {
      await expect(embeddingService.generateEmbedding(123)).rejects.toThrow(EmbeddingError);
      await expect(embeddingService.generateEmbedding({})).rejects.toThrow(EmbeddingError);
      await expect(embeddingService.generateEmbedding([])).rejects.toThrow(EmbeddingError);
    });

    test('should throw EmbeddingError for batch input validation', async () => {
      await expect(embeddingService.generateEmbeddings('not an array')).rejects.toThrow(EmbeddingError);
      await expect(embeddingService.generateEmbeddings(null)).rejects.toThrow(EmbeddingError);
    });

    test('should handle network timeout errors', async () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.code = 'TIMEOUT';
      mockLlmClient.generateEmbedding.mockRejectedValue(timeoutError);

      await expect(embeddingService.generateEmbedding('test text')).rejects.toThrow(EmbeddingError);
    });

    test('should handle rate limit errors', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      rateLimitError.status = 429;
      mockLlmClient.generateEmbedding.mockRejectedValue(rateLimitError);

      await expect(embeddingService.generateEmbedding('test text')).rejects.toThrow(EmbeddingError);
    });

    test('should throw error when called before initialization', async () => {
      const uninitializedService = new EmbeddingService({
        resourceManager: mockResourceManager
      });

      await expect(uninitializedService.generateEmbedding('test')).rejects.toThrow(EmbeddingError);
      await expect(uninitializedService.generateEmbeddings(['test'])).rejects.toThrow(EmbeddingError);
    });
  });

  describe('Performance and Optimization', () => {
    beforeEach(async () => {
      embeddingService = new EmbeddingService({
        resourceManager: mockResourceManager,
        options: { batchSize: 10 }
      });
      await embeddingService.initialize();
    });

    test('should optimize batch size based on input length', async () => {
      const shortTexts = new Array(5).fill(0).map((_, i) => `short text ${i}`);
      const longTexts = new Array(5).fill(0).map((_, i) => 'long text '.repeat(100) + i);

      const mockEmbedding = new Array(384).fill(0).map(() => Math.random());
      mockLlmClient.generateEmbeddings.mockResolvedValue(
        new Array(5).fill(mockEmbedding)
      );

      await embeddingService.generateEmbeddings(shortTexts);
      await embeddingService.generateEmbeddings(longTexts);

      expect(mockLlmClient.generateEmbeddings).toHaveBeenCalledTimes(2);
    });

    test('should track generation statistics', async () => {
      const mockEmbedding = new Array(384).fill(0).map(() => Math.random());
      mockLlmClient.generateEmbedding.mockResolvedValue(mockEmbedding);

      await embeddingService.generateEmbedding('test1');
      await embeddingService.generateEmbedding('test2');

      const stats = embeddingService.getStats();
      expect(stats.totalGenerated).toBe(2);
      expect(stats.totalRequests).toBe(2);
      expect(stats.averageGenerationTime).toBeGreaterThan(0);
    });

    test('should handle concurrent embedding requests', async () => {
      const mockEmbedding = new Array(384).fill(0).map(() => Math.random());
      mockLlmClient.generateEmbedding.mockResolvedValue(mockEmbedding);

      const promises = [
        embeddingService.generateEmbedding('text1'),
        embeddingService.generateEmbedding('text2'),
        embeddingService.generateEmbedding('text3')
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(mockLlmClient.generateEmbedding).toHaveBeenCalledTimes(3);
    });
  });

  describe('Text Preprocessing', () => {
    beforeEach(async () => {
      embeddingService = new EmbeddingService({
        resourceManager: mockResourceManager
      });
      await embeddingService.initialize();
    });

    test('should normalize text before embedding generation', async () => {
      const mockEmbedding = new Array(384).fill(0).map(() => Math.random());
      mockLlmClient.generateEmbedding.mockResolvedValue(mockEmbedding);

      await embeddingService.generateEmbedding('  Text with extra spaces  \n\t');

      expect(mockLlmClient.generateEmbedding).toHaveBeenCalledWith('Text with extra spaces');
    });

    test('should handle special characters and unicode', async () => {
      const mockEmbedding = new Array(384).fill(0).map(() => Math.random());
      mockLlmClient.generateEmbedding.mockResolvedValue(mockEmbedding);

      const unicodeText = 'Text with émojis 🚀 and ünïcödé characters';
      await embeddingService.generateEmbedding(unicodeText);

      expect(mockLlmClient.generateEmbedding).toHaveBeenCalledWith(unicodeText);
    });

    test('should truncate very long texts to maximum length', async () => {
      const mockEmbedding = new Array(384).fill(0).map(() => Math.random());
      mockLlmClient.generateEmbedding.mockResolvedValue(mockEmbedding);

      const veryLongText = 'word '.repeat(10000);
      await embeddingService.generateEmbedding(veryLongText);

      const calledWith = mockLlmClient.generateEmbedding.mock.calls[0][0];
      expect(calledWith.length).toBeLessThan(veryLongText.length);
    });
  });

  describe('Resource Management', () => {
    test('should properly cleanup resources on shutdown', async () => {
      embeddingService = new EmbeddingService({
        resourceManager: mockResourceManager
      });
      await embeddingService.initialize();

      await embeddingService.shutdown();

      expect(embeddingService.initialized).toBe(false);
    });

    test('should handle graceful shutdown with pending requests', async () => {
      embeddingService = new EmbeddingService({
        resourceManager: mockResourceManager
      });
      await embeddingService.initialize();

      const mockEmbedding = new Array(384).fill(0).map(() => Math.random());
      const slowPromise = new Promise(resolve => 
        setTimeout(() => resolve(mockEmbedding), 1000)
      );
      mockLlmClient.generateEmbedding.mockReturnValue(slowPromise);

      // Start a request but don't wait
      const embeddingPromise = embeddingService.generateEmbedding('test');

      // Shutdown immediately
      await embeddingService.shutdown();

      // Pending request should still complete
      const result = await embeddingPromise;
      expect(result).toEqual(mockEmbedding);
    });
  });
});