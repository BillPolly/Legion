/**
 * EmbeddingService Integration Tests
 * 
 * Tests EmbeddingService with real LLM client and ResourceManager
 * No mocks - tests real embedding generation workflow
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { EmbeddingService } from '../../src/search/EmbeddingService.js';
import { EmbeddingError } from '../../src/errors/index.js';

describe('EmbeddingService Integration Tests', () => {
  let embeddingService;
  let resourceManager;
  let llmClient;

  beforeEach(async () => {
    // Create test ResourceManager
    resourceManager = await global.createTestResourceManager();
    llmClient = resourceManager.get('llmClient');
    
    // Skip tests if LLM client not available
    if (!llmClient) {
      console.log('Skipping embedding integration tests - LLM client not available');
      return;
    }
    
    embeddingService = new EmbeddingService({
      resourceManager,
      options: {
        dimensions: 384,
        batchSize: 5,
        cacheSize: 10,
        verbose: false
      }
    });
    
    await embeddingService.initialize();
  });

  afterEach(async () => {
    if (embeddingService) {
      await embeddingService.shutdown();
    }
  });

  describe('Real Embedding Generation', () => {
    test('should generate real embedding for text', async () => {
      // Skip if no LLM client
      if (!llmClient) {
        console.log('Skipping test - LLM client not available');
        return;
      }

      const text = 'A file reading tool that reads content from the filesystem';
      const embedding = await embeddingService.generateEmbedding(text);

      expect(embedding).toBeDefined();
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBe(384);
      
      // Check all values are numbers
      embedding.forEach(value => {
        expect(typeof value).toBe('number');
        expect(isFinite(value)).toBe(true);
      });
    }, 30000);

    test('should generate consistent embeddings for same text', async () => {
      if (!llmClient) {
        console.log('Skipping test - LLM client not available');
        return;
      }

      const text = 'A calculator tool for mathematical operations';
      
      const embedding1 = await embeddingService.generateEmbedding(text);
      const embedding2 = await embeddingService.generateEmbedding(text);

      expect(embedding1).toEqual(embedding2);
    }, 30000);

    test('should generate different embeddings for different text', async () => {
      if (!llmClient) {
        console.log('Skipping test - LLM client not available');
        return;
      }

      const text1 = 'A file reading tool';
      const text2 = 'A mathematical calculator';
      
      const embedding1 = await embeddingService.generateEmbedding(text1);
      const embedding2 = await embeddingService.generateEmbedding(text2);

      expect(embedding1).not.toEqual(embedding2);
      
      // Calculate cosine similarity (should be less than perfect similarity)
      const similarity = cosineSimilarity(embedding1, embedding2);
      expect(similarity).toBeLessThan(0.99); // Not exactly the same
    }, 30000);

    test('should handle empty text gracefully', async () => {
      if (!llmClient) {
        console.log('Skipping test - LLM client not available');
        return;
      }

      await expect(embeddingService.generateEmbedding('')).rejects.toThrow(EmbeddingError);
      await expect(embeddingService.generateEmbedding('   ')).rejects.toThrow(EmbeddingError);
    });

    test('should handle very long text by truncating', async () => {
      if (!llmClient) {
        console.log('Skipping test - LLM client not available');
        return;
      }

      const longText = 'This is a very long text. '.repeat(1000); // ~27,000 characters
      const embedding = await embeddingService.generateEmbedding(longText);

      expect(embedding).toBeDefined();
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBe(384);
    }, 30000);
  });

  describe('Batch Embedding Generation', () => {
    test('should generate batch embeddings', async () => {
      if (!llmClient) {
        console.log('Skipping test - LLM client not available');
        return;
      }

      const texts = [
        'File reading tool for accessing files',
        'Calculator for mathematical operations',
        'Database query tool for data access',
        'Network request tool for HTTP calls'
      ];

      const embeddings = await embeddingService.generateEmbeddings(texts);

      expect(embeddings).toBeDefined();
      expect(Array.isArray(embeddings)).toBe(true);
      expect(embeddings.length).toBe(4);

      embeddings.forEach(embedding => {
        expect(Array.isArray(embedding)).toBe(true);
        expect(embedding.length).toBe(384);
      });
    }, 60000);

    test('should handle batch processing with invalid texts', async () => {
      if (!llmClient) {
        console.log('Skipping test - LLM client not available');
        return;
      }

      const texts = [
        'Valid file tool',
        '', // Invalid
        'Valid calculator tool',
        null, // Invalid
        'Valid network tool'
      ];

      const embeddings = await embeddingService.generateEmbeddings(texts);

      // Should only return embeddings for valid texts
      expect(embeddings).toBeDefined();
      expect(Array.isArray(embeddings)).toBe(true);
      expect(embeddings.length).toBe(3);
    }, 60000);

    test('should batch process large arrays efficiently', async () => {
      if (!llmClient) {
        console.log('Skipping test - LLM client not available');
        return;
      }

      // Create 12 texts (should be processed in 3 batches of 5, 5, 2)
      const texts = Array.from({length: 12}, (_, i) => 
        `Tool description number ${i + 1} for testing batch processing`
      );

      const startTime = Date.now();
      const embeddings = await embeddingService.generateEmbeddings(texts);
      const endTime = Date.now();

      expect(embeddings.length).toBe(12);
      
      // Verify all embeddings are valid
      embeddings.forEach(embedding => {
        expect(Array.isArray(embedding)).toBe(true);
        expect(embedding.length).toBe(384);
      });

      console.log(`Batch processing time: ${endTime - startTime}ms`);
    }, 120000);
  });

  describe('Caching Integration', () => {
    test('should cache embeddings and improve performance', async () => {
      if (!llmClient) {
        console.log('Skipping test - LLM client not available');
        return;
      }

      const text = 'Test tool for performance measurement';

      // First call - should generate
      const startTime1 = Date.now();
      const embedding1 = await embeddingService.generateEmbedding(text);
      const time1 = Date.now() - startTime1;

      // Second call - should use cache
      const startTime2 = Date.now();
      const embedding2 = await embeddingService.generateEmbedding(text);
      const time2 = Date.now() - startTime2;

      expect(embedding1).toEqual(embedding2);
      
      // Cache should be significantly faster
      expect(time2).toBeLessThan(time1);
      
      const stats = embeddingService.getCacheStats();
      expect(stats.hitCount).toBe(1);
      expect(stats.missCount).toBe(1);
      expect(stats.hitRate).toBe(0.5);
    }, 30000);

    test('should evict old entries when cache is full', async () => {
      if (!llmClient) {
        console.log('Skipping test - LLM client not available');
        return;
      }

      // Fill cache beyond capacity (cache size is 10)
      const texts = Array.from({length: 15}, (_, i) => `Tool ${i}`);

      for (const text of texts) {
        await embeddingService.generateEmbedding(text);
      }

      const stats = embeddingService.getCacheStats();
      expect(stats.size).toBeLessThanOrEqual(10); // Should not exceed max size
      
      // First few texts should be evicted
      const firstTextAgain = await embeddingService.generateEmbedding('Tool 0');
      expect(firstTextAgain).toBeDefined();
      
      // Should have increased miss count due to eviction
      const finalStats = embeddingService.getCacheStats();
      expect(finalStats.missCount).toBeGreaterThan(15);
    }, 180000);
  });

  describe('Error Handling Integration', () => {
    test('should handle LLM service unavailable', async () => {
      if (!llmClient) {
        console.log('Skipping test - LLM client not available');
        return;
      }

      // Create service with broken resource manager
      const brokenResourceManager = {
        get: (key) => {
          if (key === 'llmClient') {
            return null;
          }
          return resourceManager.get(key);
        }
      };

      const brokenService = new EmbeddingService({
        resourceManager: brokenResourceManager
      });

      await expect(brokenService.initialize()).rejects.toThrow(EmbeddingError);
    });

    test('should handle network errors gracefully', async () => {
      if (!llmClient) {
        console.log('Skipping test - LLM client not available');
        return;
      }

      // Create service with failing LLM client
      const failingLlmClient = {
        ...llmClient,
        generateEmbedding: async () => {
          throw new Error('Network error');
        },
        isAvailable: () => true
      };

      const failingResourceManager = {
        get: (key) => {
          if (key === 'llmClient') {
            return failingLlmClient;
          }
          return resourceManager.get(key);
        }
      };

      const failingService = new EmbeddingService({
        resourceManager: failingResourceManager
      });
      
      await failingService.initialize();

      await expect(failingService.generateEmbedding('test')).rejects.toThrow(EmbeddingError);
    });
  });

  describe('Statistics and Monitoring', () => {
    test('should track accurate statistics', async () => {
      if (!llmClient) {
        console.log('Skipping test - LLM client not available');
        return;
      }

      const text1 = 'First unique text for stats';
      const text2 = 'Second unique text for stats';

      // Clear any previous stats
      embeddingService.clearCache();

      await embeddingService.generateEmbedding(text1);
      await embeddingService.generateEmbedding(text2);
      await embeddingService.generateEmbedding(text1); // Should hit cache

      const stats = embeddingService.getStats();
      expect(stats.totalGenerated).toBe(2); // Only 2 unique generations
      expect(stats.totalRequests).toBe(3);  // 3 total requests
      expect(stats.averageGenerationTime).toBeGreaterThan(0);

      const cacheStats = embeddingService.getCacheStats();
      expect(cacheStats.hitCount).toBe(1);
      expect(cacheStats.missCount).toBe(2);
      expect(cacheStats.hitRate).toBe(1/3);
    }, 60000);

    test('should provide memory usage information', async () => {
      if (!llmClient) {
        console.log('Skipping test - LLM client not available');
        return;
      }

      // Generate several embeddings
      const texts = Array.from({length: 5}, (_, i) => `Memory test tool ${i}`);
      
      for (const text of texts) {
        await embeddingService.generateEmbedding(text);
      }

      const cacheStats = embeddingService.getCacheStats();
      expect(cacheStats.size).toBe(5);
      expect(cacheStats.maxSize).toBe(10);

      // Each embedding is ~1536 bytes (384 floats * 4 bytes), plus overhead
      // 5 embeddings should be roughly 8-10KB
      const estimatedMemory = cacheStats.size * 384 * 4; // bytes
      expect(estimatedMemory).toBeGreaterThan(0);
      
      console.log(`Cache memory usage: ~${Math.round(estimatedMemory / 1024)}KB for ${cacheStats.size} embeddings`);
    }, 60000);
  });

  describe('Text Processing Integration', () => {
    test('should handle various text formats', async () => {
      if (!llmClient) {
        console.log('Skipping test - LLM client not available');
        return;
      }

      const texts = [
        'Simple text',
        'Text with  multiple   spaces',
        'Text\nwith\nnewlines',
        'Text\twith\ttabs',
        'Text with émojis 🚀 and ünïcödé',
        'Text with "quotes" and \'apostrophes\'',
        'Text with numbers 123 and symbols @#$%'
      ];

      for (const text of texts) {
        const embedding = await embeddingService.generateEmbedding(text);
        expect(embedding).toBeDefined();
        expect(Array.isArray(embedding)).toBe(true);
        expect(embedding.length).toBe(384);
      }
    }, 120000);

    test('should normalize text consistently', async () => {
      if (!llmClient) {
        console.log('Skipping test - LLM client not available');
        return;
      }

      // These should produce identical embeddings after normalization
      const text1 = 'File   reader   tool';
      const text2 = 'File reader tool';
      const text3 = '  File reader tool  ';

      const embedding1 = await embeddingService.generateEmbedding(text1);
      const embedding2 = await embeddingService.generateEmbedding(text2);
      const embedding3 = await embeddingService.generateEmbedding(text3);

      expect(embedding1).toEqual(embedding2);
      expect(embedding2).toEqual(embedding3);
    }, 60000);
  });
});

/**
 * Helper function to calculate cosine similarity between two vectors
 */
function cosineSimilarity(vectorA, vectorB) {
  if (vectorA.length !== vectorB.length) {
    throw new Error('Vectors must be same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vectorA.length; i++) {
    dotProduct += vectorA[i] * vectorB[i];
    normA += vectorA[i] * vectorA[i];
    normB += vectorB[i] * vectorB[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}