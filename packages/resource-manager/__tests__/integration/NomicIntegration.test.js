/**
 * Integration tests for Nomic embedding functionality through ResourceManager
 * 
 * Tests the full integration of:
 * - ResourceManager singleton
 * - URI-based Handle creation
 * - NomicDataSource and NomicHandle
 * - Embedding generation and caching
 */

import { jest } from '@jest/globals';
import { ResourceManager } from '../../src/ResourceManager.js';
import { NomicHandle } from '../../src/handles/NomicHandle.js';

describe('Nomic Integration', () => {
  let resourceManager;

  beforeAll(async () => {
    // Get ResourceManager singleton once
    resourceManager = await ResourceManager.getInstance();
  });

  describe('Handle creation via URI', () => {
    it('should create NomicHandle from URI', async () => {
      const uri = 'legion://local/nomic/embed';
      const handle = await resourceManager.createHandleFromURI(uri);
      
      expect(handle).toBeDefined();
      expect(handle).toBeInstanceOf(NomicHandle);
      expect(handle.toURI()).toBe(uri);
    });

    it('should cache Handle instances', async () => {
      const uri = 'legion://local/nomic/embed';
      
      const handle1 = await resourceManager.createHandleFromURI(uri);
      const handle2 = await resourceManager.createHandleFromURI(uri);
      
      // Should return the same Handle instance from cache
      expect(handle1).toBe(handle2);
    });

    it('should create different Handles for different paths', async () => {
      const uri1 = 'legion://local/nomic/embed';
      const uri2 = 'legion://local/nomic/embed/batch';
      
      const handle1 = await resourceManager.createHandleFromURI(uri1);
      const handle2 = await resourceManager.createHandleFromURI(uri2);
      
      expect(handle1).not.toBe(handle2);
      expect(handle1.toURI()).toBe(uri1);
      expect(handle2.toURI()).toBe(uri2);
    });
  });

  describe('Embedding operations through Handle', () => {
    let handle;

    beforeEach(async () => {
      handle = await resourceManager.createHandleFromURI('legion://local/nomic/embed');
    });

    it('should generate embeddings for text', async () => {
      const text = 'This is a test sentence for embeddings';
      const result = await handle.embed(text);
      
      expect(result).toBeDefined();
      expect(result.embedding).toBeDefined();
      expect(Array.isArray(result.embedding)).toBe(true);
      expect(result.embedding.length).toBe(768);
      expect(result.text).toBe(text);
    });

    it('should generate embeddings for batch of texts', async () => {
      const texts = [
        'First test sentence',
        'Second test sentence',
        'Third test sentence'
      ];
      
      const result = await handle.embedBatch(texts);
      
      expect(result).toBeDefined();
      expect(result.embeddings).toBeDefined();
      expect(Array.isArray(result.embeddings)).toBe(true);
      expect(result.embeddings.length).toBe(3);
      
      result.embeddings.forEach(embedding => {
        expect(Array.isArray(embedding)).toBe(true);
        expect(embedding.length).toBe(768);
      });
    });

    it('should calculate similarity between embeddings', async () => {
      const result1 = await handle.embed('cat');
      const result2 = await handle.embed('kitten');
      const result3 = await handle.embed('spaceship');
      
      const similarityCatKitten = await handle.similarity(
        result1.embedding,
        result2.embedding
      );
      
      const similarityCatSpaceship = await handle.similarity(
        result1.embedding,
        result3.embedding
      );
      
      // Cat and kitten should be more similar than cat and spaceship
      expect(similarityCatKitten).toBeGreaterThan(similarityCatSpaceship);
      expect(similarityCatKitten).toBeGreaterThan(0.5);
      expect(similarityCatSpaceship).toBeLessThan(0.5);
    });

    it('should find similar embeddings', async () => {
      const documents = [
        'The cat sat on the mat',
        'A dog ran in the park',
        'The kitten played with yarn',
        'An airplane flew overhead',
        'The feline rested peacefully'
      ];
      
      const query = await handle.embed('cat behavior');
      const docEmbeddings = await handle.embedBatch(documents);
      
      const similar = await handle.findSimilar(
        query.embedding,
        docEmbeddings.embeddings,
        3
      );
      
      expect(similar).toBeDefined();
      expect(Array.isArray(similar)).toBe(true);
      expect(similar.length).toBe(3);
      
      // First result should be most similar
      expect(similar[0].similarity).toBeGreaterThan(similar[1].similarity);
      expect(similar[1].similarity).toBeGreaterThan(similar[2].similarity);
      
      // Cat-related documents should be in top results
      const topIndices = similar.map(s => s.index);
      expect(topIndices).toContain(0); // "The cat sat on the mat"
      expect(topIndices).toContain(2); // "The kitten played with yarn"  
    });
  });

  describe('Caching behavior', () => {
    let handle;

    beforeEach(async () => {
      handle = await resourceManager.createHandleFromURI('legion://local/nomic/embed');
      handle.clearCache();
    });

    it('should cache embeddings for identical text', async () => {
      const text = 'Test caching behavior';
      
      // First call - not cached
      const result1 = await handle.embed(text);
      expect(result1.cached).toBeFalsy();
      
      // Second call - should be cached
      const result2 = await handle.embed(text);
      expect(result2.cached).toBe(true);
      
      // Should return the same embedding reference
      expect(result1.embedding).toBe(result2.embedding);
    });

    it('should track cache statistics', async () => {
      await handle.embed('text1');
      await handle.embed('text2');
      await handle.embed('text1'); // Cache hit
      await handle.embed('text3');
      await handle.embed('text2'); // Cache hit
      
      const stats = handle.getCacheStats();
      
      expect(stats.size).toBe(3); // 3 unique texts
      expect(stats.hits).toBe(2); // 2 cache hits
      expect(stats.misses).toBe(3); // 3 cache misses
      expect(stats.hitRate).toBeCloseTo(0.4, 1); // 2/5 = 0.4
    });
  });

  describe('ResourceManager service management', () => {
    it('should share Nomic service across DataSources', async () => {
      const handle1 = await resourceManager.createHandleFromURI('legion://local/nomic/embed');
      const handle2 = await resourceManager.createHandleFromURI('legion://local/nomic/embed/batch');
      
      // Both handles should share the same DataSource
      expect(handle1.dataSource).toBe(handle2.dataSource);
      
      // And the DataSource should share the same Nomic service
      expect(handle1.dataSource.nomicEmbeddings).toBe(handle2.dataSource.nomicEmbeddings);
    });

    it('should handle very long text gracefully', async () => {
      const handle = await resourceManager.createHandleFromURI('legion://local/nomic/embed');
      
      // Create a very long text
      const veryLongText = 'Lorem ipsum '.repeat(10000); // ~120,000 characters
      
      // Should handle without throwing
      const result = await handle.embed(veryLongText);
      
      expect(result).toBeDefined();
      expect(result.embedding).toBeDefined();
      expect(result.embedding.length).toBe(768);
      
      // Text should be truncated
      expect(result.text.length).toBeLessThan(veryLongText.length);
    });
  });

  describe('Handle hierarchy', () => {
    it('should create child Handles', async () => {
      const parent = await resourceManager.createHandleFromURI('legion://local/nomic/embed');
      const child = parent.child('query');
      
      expect(child).toBeDefined();
      expect(child.toURI()).toBe('legion://local/nomic/embed/query');
      expect(child.dataSource).toBe(parent.dataSource);
      
      // Should still work for embeddings
      const result = await child.embed('test query');
      expect(result.embedding).toBeDefined();
    });

    it('should get parent Handle', async () => {
      const child = await resourceManager.createHandleFromURI('legion://local/nomic/embed/batch');
      const parent = child.parent();
      
      expect(parent).toBeDefined();
      expect(parent.toURI()).toBe('legion://local/nomic/embed');
    });
  });

  describe('Error handling', () => {
    it('should handle invalid URIs gracefully', async () => {
      await expect(
        resourceManager.createHandleFromURI('invalid://uri')
      ).rejects.toThrow();
      
      await expect(
        resourceManager.createHandleFromURI('legion://local/invalid/type')
      ).rejects.toThrow();
    });

    it('should handle null/undefined text gracefully', async () => {
      const handle = await resourceManager.createHandleFromURI('legion://local/nomic/embed');
      
      // Should not throw, but validation should fail
      expect(handle.validateText(null)).toBe(false);
      expect(handle.validateText(undefined)).toBe(false);
      
      // Empty string is valid
      const result = await handle.embed('');
      expect(result.embedding).toBeDefined();
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources properly', async () => {
      const handle = await resourceManager.createHandleFromURI('legion://local/nomic/embed');
      
      // Generate some embeddings to populate cache
      await handle.embed('test1');
      await handle.embed('test2');
      
      const statsBefore = handle.getCacheStats();
      expect(statsBefore.size).toBeGreaterThan(0);
      
      // Destroy the handle
      handle.destroy();
      
      // Should not be able to use after destroy
      await expect(handle.embed('test')).rejects.toThrow('destroyed');
      expect(handle.isDestroyed()).toBe(true);
    });
  });
});