/**
 * Integration tests for HandleVectorStore with real services
 * Phase 3: Vector storage with real Nomic and Qdrant
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { HandleVectorStore } from '../../src/HandleVectorStore.js';
import { ResourceManager } from '@legion/resource-manager';

describe('HandleVectorStore Integration', () => {
  let store;
  let resourceManager;
  const testHandleURI = 'legion://local/test/sample-for-vector-test';

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
    store = new HandleVectorStore(resourceManager);
    await store.initialize();
  }, 60000);

  afterAll(async () => {
    // Clean up test vectors
    try {
      await store.deleteVectors(testHandleURI);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Initialization with Real Services', () => {
    it('should initialize with real Nomic and Qdrant handles', () => {
      expect(store.initialized).toBe(true);
      expect(store.nomicHandle).toBeDefined();
      expect(store.qdrantHandle).toBeDefined();
    });

    it('should have Qdrant collection created', async () => {
      const info = await store.qdrantHandle.getInfo();
      expect(info).toBeDefined();
    });
  });

  describe('Real Embedding Generation', () => {
    it('should generate real embeddings using Nomic', async () => {
      const text = 'JavaScript code file containing Express.js server implementation with REST API endpoints';
      const embedding = await store.generateEmbedding(text);

      expect(embedding).toBeDefined();
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBe(768);
      expect(embedding.every(val => typeof val === 'number')).toBe(true);
    }, 30000);

    it('should generate different embeddings for different text', async () => {
      const text1 = 'Database for storing user information and authentication data';
      const text2 = 'Image file containing product photography for e-commerce';

      const embedding1 = await store.generateEmbedding(text1);
      const embedding2 = await store.generateEmbedding(text2);

      expect(embedding1).not.toEqual(embedding2);

      // Embeddings should be different (cosine distance check)
      const dotProduct = embedding1.reduce((sum, val, i) => sum + val * embedding2[i], 0);
      const mag1 = Math.sqrt(embedding1.reduce((sum, val) => sum + val * val, 0));
      const mag2 = Math.sqrt(embedding2.reduce((sum, val) => sum + val * val, 0));
      const cosineSimilarity = dotProduct / (mag1 * mag2);

      // Different texts should have similarity < 1.0
      expect(cosineSimilarity).toBeLessThan(0.99);
    }, 30000);
  });

  describe('Store and Search Glosses', () => {
    it('should store gloss embeddings in Qdrant', async () => {
      const glosses = [
        {
          perspective: 'functional',
          description: 'JavaScript code file implementing Express.js server with RESTful API endpoints for user management',
          keywords: ['javascript', 'express', 'api', 'server']
        },
        {
          perspective: 'contextual',
          description: 'Backend service component providing HTTP interface for application business logic and data access',
          keywords: ['backend', 'service', 'http', 'application']
        }
      ];

      const result = await store.storeGlossEmbeddings(testHandleURI, glosses);

      expect(result.success).toBe(true);
      expect(result.count).toBe(2);
      expect(result.vectorIds).toHaveLength(2);
    }, 30000);

    it('should search for similar handles', async () => {
      const query = 'API server for managing users';

      const results = await store.searchSimilar(query, {
        limit: 5,
        threshold: 0.3
      });

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);

      // Should find our test handle
      const foundTestHandle = results.some(r => r.handleURI === testHandleURI);
      expect(foundTestHandle).toBe(true);

      // Results should have required properties
      if (results.length > 0) {
        const result = results[0];
        expect(result.handleURI).toBeDefined();
        expect(result.glossType).toBeDefined();
        expect(result.description).toBeDefined();
        expect(result.keywords).toBeDefined();
        expect(result.similarity).toBeDefined();
        expect(typeof result.similarity).toBe('number');
        expect(result.similarity).toBeGreaterThan(0);
        expect(result.similarity).toBeLessThanOrEqual(1);
      }
    }, 30000);

    it('should return results sorted by similarity', async () => {
      const query = 'JavaScript Express server implementation';

      const results = await store.searchSimilar(query, { limit: 10 });

      if (results.length > 1) {
        // Check that results are sorted by similarity (descending)
        for (let i = 0; i < results.length - 1; i++) {
          expect(results[i].similarity).toBeGreaterThanOrEqual(results[i + 1].similarity);
        }
      }
    }, 30000);

    it('should filter results by threshold', async () => {
      const query = 'completely unrelated quantum physics molecular biology';

      const results = await store.searchSimilar(query, {
        limit: 10,
        threshold: 0.8  // High threshold
      });

      // Should return fewer or no results due to high threshold
      expect(results.length).toBeLessThan(5);
    }, 30000);
  });

  describe('Vector Deletion', () => {
    it('should delete vectors for a handle URI', async () => {
      // First store some vectors
      const deleteTestURI = 'legion://local/test/delete-test';
      const glosses = [{
        perspective: 'test',
        description: 'Test gloss for deletion',
        keywords: ['test']
      }];

      await store.storeGlossEmbeddings(deleteTestURI, glosses);

      // Now delete
      const result = await store.deleteVectors(deleteTestURI);

      expect(result.success).toBe(true);
      expect(result.handleURI).toBe(deleteTestURI);

      // Verify deleted - search should not find it
      const searchResults = await store.searchSimilar('test gloss', { limit: 100 });
      const found = searchResults.some(r => r.handleURI === deleteTestURI);
      expect(found).toBe(false);
    }, 30000);
  });
});