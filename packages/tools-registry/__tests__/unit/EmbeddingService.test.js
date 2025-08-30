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
  let embeddingService;

  beforeEach(() => {
    // Mock ResourceManager
    mockResourceManager = {
      get: jest.fn()
    };

    // Note: The actual implementation uses Nomic directly, not LLM client
    // The mock for @legion/nomic is in __mocks__/@legion/nomic.js
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

    test('should use default options when none provided', async () => {
      embeddingService = new EmbeddingService({
        resourceManager: mockResourceManager
      });

      // Before initialization, dimensions should be null
      expect(embeddingService.options.dimensions).toBe(null);
      expect(embeddingService.options.batchSize).toBe(20);
      expect(embeddingService.options.cacheSize).toBe(1000);
      
      // After initialization, dimensions should be set from Nomic (768)
      await embeddingService.initialize();
      expect(embeddingService.options.dimensions).toBe(768);
    });

    test('should initialize successfully with valid ResourceManager', async () => {
      embeddingService = new EmbeddingService({
        resourceManager: mockResourceManager
      });

      await embeddingService.initialize();

      expect(embeddingService.initialized).toBe(true);
      // No longer checks for llmClient since it uses Nomic directly
      expect(embeddingService.nomicEmbeddings).toBeDefined();
    });

    test('should initialize Nomic embeddings properly', async () => {
      embeddingService = new EmbeddingService({
        resourceManager: mockResourceManager
      });

      await embeddingService.initialize();
      
      expect(embeddingService.initialized).toBe(true);
      expect(embeddingService.nomicEmbeddings).toBeDefined();
      expect(embeddingService.nomicEmbeddings.initialized).toBe(true);
    });
  });

  describe('Single Embedding Generation', () => {
    beforeEach(async () => {
      // Create service with 768 dimensions to match Nomic output
      embeddingService = new EmbeddingService({
        resourceManager: mockResourceManager,
        options: { dimensions: 768 }
      });
      await embeddingService.initialize();
    });

    test('should generate embedding for single text', async () => {
      const result = await embeddingService.generateEmbedding('test text');

      // The mock returns 768-dimensional embeddings as per Nomic standard
      expect(result).toHaveLength(768);
      expect(result.every(v => typeof v === 'number')).toBe(true);
    });

    test('should validate embedding dimensions', async () => {
      // Create a service expecting different dimensions
      const service384 = new EmbeddingService({
        resourceManager: mockResourceManager,
        options: { dimensions: 384 }
      });
      await service384.initialize();
      
      // The mock always returns 768 dimensions, but service expects 384
      await expect(service384.generateEmbedding('test text')).rejects.toThrow(EmbeddingError);
    });

    test('should handle empty text input', async () => {
      await expect(embeddingService.generateEmbedding('')).rejects.toThrow(EmbeddingError);
      await expect(embeddingService.generateEmbedding(null)).rejects.toThrow(EmbeddingError);
      await expect(embeddingService.generateEmbedding(undefined)).rejects.toThrow(EmbeddingError);
    });

    test('should handle very long text input', async () => {
      const longText = 'a'.repeat(10000);
      // Mock the embed function to avoid calling real implementation with long text
      const originalEmbed = embeddingService.nomicEmbeddings.embed;
      embeddingService.nomicEmbeddings.embed = jest.fn().mockResolvedValue(
        new Array(768).fill(0).map(() => Math.random())
      );

      const result = await embeddingService.generateEmbedding(longText);

      expect(result).toHaveLength(768);
      // Text should be truncated to maxTextLength (8192)
      expect(embeddingService.nomicEmbeddings.embed).toHaveBeenCalledWith('a'.repeat(8192));
      embeddingService.nomicEmbeddings.embed = originalEmbed;
    });

    test('should cache embeddings for repeated text', async () => {
      const spy = jest.spyOn(embeddingService.nomicEmbeddings, 'embed');

      const result1 = await embeddingService.generateEmbedding('test text');
      const result2 = await embeddingService.generateEmbedding('test text');

      expect(result1).toEqual(result2);
      expect(spy).toHaveBeenCalledTimes(1); // Should only call once due to caching
      spy.mockRestore();
    });
  });

  describe('Batch Embedding Generation', () => {
    beforeEach(async () => {
      embeddingService = new EmbeddingService({
        resourceManager: mockResourceManager,
        options: { batchSize: 5, dimensions: 768 }
      });
      await embeddingService.initialize();
    });

    test('should generate embeddings for array of texts', async () => {
      const texts = ['text1', 'text2', 'text3'];
      const spy = jest.spyOn(embeddingService.nomicEmbeddings, 'embedBatch');

      const results = await embeddingService.generateEmbeddings(texts);

      expect(spy).toHaveBeenCalledWith(texts);
      expect(results).toHaveLength(3);
      results.forEach(embedding => {
        expect(embedding).toHaveLength(768);
        expect(embedding.every(v => typeof v === 'number')).toBe(true);
      });
      spy.mockRestore();
    });

    test('should handle batch processing for large arrays', async () => {
      const texts = new Array(12).fill(0).map((_, i) => `text${i}`);
      const spy = jest.spyOn(embeddingService.nomicEmbeddings, 'embedBatch');

      const results = await embeddingService.generateEmbeddings(texts);

      // Should be called 3 times: 5 + 5 + 2
      expect(spy).toHaveBeenCalledTimes(3);
      expect(spy).toHaveBeenNthCalledWith(1, texts.slice(0, 5));
      expect(spy).toHaveBeenNthCalledWith(2, texts.slice(5, 10));
      expect(spy).toHaveBeenNthCalledWith(3, texts.slice(10, 12));
      expect(results).toHaveLength(12);
      spy.mockRestore();
    });

    test('should validate all embedding dimensions in batch', async () => {
      const texts = ['text1', 'text2'];
      // Mock embedBatch to return wrong dimensions for second embedding
      embeddingService.nomicEmbeddings.embedBatch = jest.fn().mockResolvedValue([
        new Array(768).fill(0).map(() => Math.random()),
        new Array(256).fill(0).map(() => Math.random()) // Wrong dimension
      ]);

      await expect(embeddingService.generateEmbeddings(texts)).rejects.toThrow(EmbeddingError);
    });

    test('should handle partial batch failures gracefully', async () => {
      const texts = ['text1', 'text2', 'text3'];
      embeddingService.nomicEmbeddings.embedBatch = jest.fn().mockRejectedValue(new Error('API Error'));

      await expect(embeddingService.generateEmbeddings(texts)).rejects.toThrow(EmbeddingError);
    });

    test('should handle empty array input', async () => {
      const spy = jest.spyOn(embeddingService.nomicEmbeddings, 'embedBatch');
      const results = await embeddingService.generateEmbeddings([]);
      expect(results).toEqual([]);
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    test('should filter out invalid texts in batch', async () => {
      const texts = ['valid text', '', null, 'another valid text', undefined];
      const validTexts = ['valid text', 'another valid text'];
      const spy = jest.spyOn(embeddingService.nomicEmbeddings, 'embedBatch');

      const results = await embeddingService.generateEmbeddings(texts);

      expect(spy).toHaveBeenCalledWith(validTexts);
      expect(results).toHaveLength(2);
      spy.mockRestore();
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
        options: { cacheSize: 3, dimensions: 768 }
      });
      await embeddingService.initialize();
    });

    test('should cache embeddings and retrieve from cache', async () => {
      const spy = jest.spyOn(embeddingService.nomicEmbeddings, 'embed');

      // First call should generate
      const result1 = await embeddingService.generateEmbedding('test text');
      expect(spy).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const result2 = await embeddingService.generateEmbedding('test text');
      expect(spy).toHaveBeenCalledTimes(1); // Still 1 due to cache
      expect(result1).toEqual(result2);
      spy.mockRestore();
    });

    test('should evict oldest entries when cache is full', async () => {
      const spy = jest.spyOn(embeddingService.nomicEmbeddings, 'embed');

      // Fill cache to capacity (cache size is 3)
      await embeddingService.generateEmbedding('text1'); // 1st
      await embeddingService.generateEmbedding('text2'); // 2nd
      await embeddingService.generateEmbedding('text3'); // 3rd
      expect(spy).toHaveBeenCalledTimes(3);

      // Add one more - should evict oldest (text1)
      await embeddingService.generateEmbedding('text4'); // evicts text1
      expect(spy).toHaveBeenCalledTimes(4);

      // text1 should be evicted, so this should generate again
      await embeddingService.generateEmbedding('text1');
      expect(spy).toHaveBeenCalledTimes(5);

      // text3 should still be cached (don't access text2 as it would change LRU order)
      await embeddingService.generateEmbedding('text3');
      expect(spy).toHaveBeenCalledTimes(5); // Still 5 due to cache
      spy.mockRestore();
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
      const spy = jest.spyOn(embeddingService.nomicEmbeddings, 'embed');

      // Generate and cache
      await embeddingService.generateEmbedding('test text');
      expect(spy).toHaveBeenCalledTimes(1);

      // Clear cache
      embeddingService.clearCache();

      // Should generate again
      await embeddingService.generateEmbedding('test text');
      expect(spy).toHaveBeenCalledTimes(2);
      spy.mockRestore();
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      embeddingService = new EmbeddingService({
        resourceManager: mockResourceManager,
        options: { dimensions: 768 }
      });
      await embeddingService.initialize();
    });

    test('should throw EmbeddingError for embedding service failures', async () => {
      embeddingService.nomicEmbeddings.embed = jest.fn().mockRejectedValue(new Error('Embedding service unavailable'));

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
      embeddingService.nomicEmbeddings.embed = jest.fn().mockRejectedValue(timeoutError);

      await expect(embeddingService.generateEmbedding('test text')).rejects.toThrow(EmbeddingError);
    });

    test('should handle rate limit errors', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      rateLimitError.status = 429;
      embeddingService.nomicEmbeddings.embed = jest.fn().mockRejectedValue(rateLimitError);

      await expect(embeddingService.generateEmbedding('test text')).rejects.toThrow(EmbeddingError);
    });

    test('should auto-initialize when called before explicit initialization', async () => {
      const uninitializedService = new EmbeddingService({
        resourceManager: mockResourceManager
      });

      // Service should auto-initialize rather than throw error
      const embedding = await uninitializedService.generateEmbedding('test');
      expect(embedding).toHaveLength(768); // Nomic dimensions
      expect(uninitializedService.initialized).toBe(true);
      
      // Batch should also auto-initialize
      const uninitializedService2 = new EmbeddingService({
        resourceManager: mockResourceManager
      });
      const embeddings = await uninitializedService2.generateEmbeddings(['test']);
      expect(embeddings).toHaveLength(1);
      expect(embeddings[0]).toHaveLength(768);
      expect(uninitializedService2.initialized).toBe(true);
    });
  });

  describe('Performance and Optimization', () => {
    beforeEach(async () => {
      embeddingService = new EmbeddingService({
        resourceManager: mockResourceManager,
        options: { batchSize: 10, dimensions: 768 }
      });
      await embeddingService.initialize();
    });

    test('should optimize batch size based on input length', async () => {
      const shortTexts = new Array(5).fill(0).map((_, i) => `short text ${i}`);
      const longTexts = new Array(5).fill(0).map((_, i) => 'long text '.repeat(100) + i);
      const spy = jest.spyOn(embeddingService.nomicEmbeddings, 'embedBatch');

      await embeddingService.generateEmbeddings(shortTexts);
      await embeddingService.generateEmbeddings(longTexts);

      expect(spy).toHaveBeenCalledTimes(2);
      spy.mockRestore();
    });

    test('should track generation statistics', async () => {
      await embeddingService.generateEmbedding('test1');
      await embeddingService.generateEmbedding('test2');

      const stats = embeddingService.getStats();
      expect(stats.totalGenerated).toBe(2);
      expect(stats.totalRequests).toBe(2);
      expect(stats.averageGenerationTime).toBeGreaterThan(0);
    });

    test('should handle concurrent embedding requests', async () => {
      const spy = jest.spyOn(embeddingService.nomicEmbeddings, 'embed');

      const promises = [
        embeddingService.generateEmbedding('text1'),
        embeddingService.generateEmbedding('text2'),
        embeddingService.generateEmbedding('text3')
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(spy).toHaveBeenCalledTimes(3);
      spy.mockRestore();
    });
  });

  describe('Text Preprocessing', () => {
    beforeEach(async () => {
      embeddingService = new EmbeddingService({
        resourceManager: mockResourceManager,
        options: { dimensions: 768 }
      });
      await embeddingService.initialize();
    });

    test('should normalize text before embedding generation', async () => {
      const spy = jest.spyOn(embeddingService.nomicEmbeddings, 'embed');

      await embeddingService.generateEmbedding('  Text with extra spaces  \n\t');

      expect(spy).toHaveBeenCalledWith('Text with extra spaces');
      spy.mockRestore();
    });

    test('should handle special characters and unicode', async () => {
      const spy = jest.spyOn(embeddingService.nomicEmbeddings, 'embed');

      const unicodeText = 'Text with émojis 🚀 and ünïcödé characters';
      await embeddingService.generateEmbedding(unicodeText);

      expect(spy).toHaveBeenCalledWith(unicodeText);
      spy.mockRestore();
    });

    test('should truncate very long texts to maximum length', async () => {
      const spy = jest.spyOn(embeddingService.nomicEmbeddings, 'embed');

      const veryLongText = 'word '.repeat(10000);
      await embeddingService.generateEmbedding(veryLongText);

      const calledWith = spy.mock.calls[0][0];
      expect(calledWith.length).toBeLessThan(veryLongText.length);
      expect(calledWith.length).toBeLessThanOrEqual(8192); // maxTextLength
      spy.mockRestore();
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
        resourceManager: mockResourceManager,
        options: { dimensions: 768 }
      });
      await embeddingService.initialize();

      const mockEmbedding = new Array(768).fill(0).map(() => Math.random());
      const slowPromise = new Promise(resolve => 
        setTimeout(() => resolve(mockEmbedding), 1000)
      );
      embeddingService.nomicEmbeddings.embed = jest.fn().mockReturnValue(slowPromise);

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