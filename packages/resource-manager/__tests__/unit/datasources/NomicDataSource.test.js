/**
 * Unit tests for NomicDataSource
 * Following TDD - these tests are written before implementation
 */

import { jest } from '@jest/globals';
import { NomicDataSource } from '../../../src/datasources/NomicDataSource.js';
import { ResourceManager } from '../../../src/ResourceManager.js';

describe('NomicDataSource', () => {
  let dataSource;
  let resourceManager;

  beforeEach(async () => {
    // Get ResourceManager singleton
    resourceManager = await ResourceManager.getInstance();
    dataSource = new NomicDataSource(resourceManager);
  });

  afterEach(() => {
    if (dataSource && dataSource.cleanup) {
      dataSource.cleanup();
    }
  });

  describe('initialization', () => {
    it('should require ResourceManager', () => {
      expect(() => new NomicDataSource()).toThrow('ResourceManager is required');
    });

    it('should initialize with ResourceManager', () => {
      expect(dataSource).toBeDefined();
      expect(dataSource.resourceManager).toBe(resourceManager);
      expect(dataSource.initialized).toBe(false);
    });

    it('should initialize Nomic embeddings on first use', async () => {
      await dataSource.initialize();
      expect(dataSource.initialized).toBe(true);
      expect(dataSource.nomicEmbeddings).toBeDefined();
    });

    it('should only initialize once', async () => {
      await dataSource.initialize();
      const firstEmbeddings = dataSource.nomicEmbeddings;
      
      await dataSource.initialize();
      expect(dataSource.nomicEmbeddings).toBe(firstEmbeddings);
    });
  });

  describe('embed operations', () => {
    beforeEach(async () => {
      await dataSource.initialize();
    });

    it('should embed single text using async method', async () => {
      const result = await dataSource.embedAsync('test text');
      
      expect(result).toBeDefined();
      expect(result.embedding).toBeDefined();
      expect(Array.isArray(result.embedding)).toBe(true);
      expect(result.embedding.length).toBe(768); // Nomic dimensions
      expect(result.text).toBe('test text');
    });

    it('should embed multiple texts in batch', async () => {
      const texts = ['first text', 'second text', 'third text'];
      const result = await dataSource.embedBatchAsync(texts);
      
      expect(result).toBeDefined();
      expect(result.embeddings).toBeDefined();
      expect(Array.isArray(result.embeddings)).toBe(true);
      expect(result.embeddings.length).toBe(3);
      
      result.embeddings.forEach((embedding, index) => {
        expect(Array.isArray(embedding)).toBe(true);
        expect(embedding.length).toBe(768);
      });
    });

    it('should handle empty text gracefully', async () => {
      const result = await dataSource.embedAsync('');
      
      expect(result).toBeDefined();
      expect(result.embedding).toBeDefined();
      expect(result.embedding.length).toBe(768);
    });

    it('should calculate similarity between embeddings', async () => {
      const result1 = await dataSource.embedAsync('cat');
      const result2 = await dataSource.embedAsync('dog');
      const result3 = await dataSource.embedAsync('cat');
      
      const similarity1 = await dataSource.similarityAsync(
        result1.embedding, 
        result2.embedding
      );
      const similarity2 = await dataSource.similarityAsync(
        result1.embedding, 
        result3.embedding
      );
      
      expect(typeof similarity1).toBe('number');
      expect(similarity1).toBeGreaterThanOrEqual(-1);
      expect(similarity1).toBeLessThanOrEqual(1);
      
      // Same text should have perfect or near-perfect similarity
      expect(similarity2).toBeGreaterThan(0.99);
    });
  });

  describe('query interface', () => {
    beforeEach(async () => {
      await dataSource.initialize();
    });

    it('should support async query for embedding', async () => {
      const querySpec = {
        type: 'embed',
        text: 'query text'
      };
      
      const result = await dataSource.queryAsync(querySpec);
      
      expect(result).toBeDefined();
      expect(result.embedding).toBeDefined();
      expect(result.embedding.length).toBe(768);
    });

    it('should support async query for batch embedding', async () => {
      const querySpec = {
        type: 'embedBatch',
        texts: ['text1', 'text2']
      };
      
      const result = await dataSource.queryAsync(querySpec);
      
      expect(result).toBeDefined();
      expect(result.embeddings).toBeDefined();
      expect(result.embeddings.length).toBe(2);
    });

    it('should support async query for similarity', async () => {
      const embedding1 = await dataSource.embedAsync('text1');
      const embedding2 = await dataSource.embedAsync('text2');
      
      const querySpec = {
        type: 'similarity',
        embedding1: embedding1.embedding,
        embedding2: embedding2.embedding
      };
      
      const result = await dataSource.queryAsync(querySpec);
      
      expect(result).toBeDefined();
      expect(typeof result.similarity).toBe('number');
    });

    it('should validate query specs', async () => {
      const invalidSpec = {
        type: 'invalid',
        data: 'test'
      };
      
      await expect(dataSource.queryAsync(invalidSpec)).rejects.toThrow(
        'Unsupported query type: invalid'
      );
    });

    it('should throw error for sync query (not implemented)', () => {
      const querySpec = {
        type: 'embed',
        text: 'test'
      };
      
      expect(() => dataSource.query(querySpec)).toThrow(
        'Synchronous query not yet implemented for Nomic'
      );
    });
  });

  describe('caching', () => {
    beforeEach(async () => {
      await dataSource.initialize();
    });

    it('should cache embeddings for identical text', async () => {
      const text = 'cached text';
      
      const result1 = await dataSource.embedAsync(text);
      const result2 = await dataSource.embedAsync(text);
      
      // Should return the same embedding array reference
      expect(result1.embedding).toBe(result2.embedding);
      expect(result1.cached).toBeFalsy();
      expect(result2.cached).toBe(true);
    });

    it('should respect cache size limit', async () => {
      // Assuming default cache size of 1000
      const texts = [];
      for (let i = 0; i < 1100; i++) {
        texts.push(`text ${i}`);
      }
      
      // Embed all texts
      for (const text of texts) {
        await dataSource.embedAsync(text);
      }
      
      // Check that cache doesn't exceed limit
      expect(dataSource.getCacheSize()).toBeLessThanOrEqual(1000);
    });

    it('should provide cache statistics', async () => {
      await dataSource.embedAsync('text1');
      await dataSource.embedAsync('text2');
      await dataSource.embedAsync('text1'); // Cache hit
      
      const stats = dataSource.getCacheStats();
      
      expect(stats).toBeDefined();
      expect(stats.size).toBe(2);
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(2);
      expect(stats.hitRate).toBeCloseTo(0.333, 2);
    });

    it('should allow cache clearing', async () => {
      await dataSource.embedAsync('text1');
      await dataSource.embedAsync('text2');
      
      expect(dataSource.getCacheSize()).toBe(2);
      
      dataSource.clearCache();
      
      expect(dataSource.getCacheSize()).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should handle initialization errors gracefully', async () => {
      // Mock NomicEmbeddings to throw error
      const errorDataSource = new NomicDataSource(resourceManager);
      
      // Force an error by setting invalid config
      errorDataSource._forceInitError = true;
      
      await expect(errorDataSource.initialize()).rejects.toThrow();
    });

    it('should handle embedding errors gracefully', async () => {
      await dataSource.initialize();
      
      // Test with extremely long text that might cause issues
      const veryLongText = 'x'.repeat(100000);
      
      // Should handle gracefully, possibly by truncating
      const result = await dataSource.embedAsync(veryLongText);
      expect(result).toBeDefined();
      expect(result.embedding).toBeDefined();
    });
  });

  describe('resource management', () => {
    it('should use ResourceManager for Nomic service singleton', async () => {
      const dataSource1 = new NomicDataSource(resourceManager);
      const dataSource2 = new NomicDataSource(resourceManager);
      
      await dataSource1.initialize();
      await dataSource2.initialize();
      
      // Both should use the same Nomic service instance from ResourceManager
      expect(dataSource1.nomicEmbeddings).toBe(dataSource2.nomicEmbeddings);
    });

    it('should cleanup resources on destroy', async () => {
      await dataSource.initialize();
      
      dataSource.destroy();
      
      expect(dataSource.initialized).toBe(false);
      expect(dataSource.nomicEmbeddings).toBeNull();
    });
  });
});