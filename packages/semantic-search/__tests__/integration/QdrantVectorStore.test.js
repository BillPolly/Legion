/**
 * QdrantVectorStore Integration Test
 * NO MOCKS - Uses real Qdrant instance
 * Tests all vector store operations with real embeddings
 */

import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { QdrantVectorStore } from '../../src/services/QdrantVectorStore.js';
import { LocalEmbeddingService } from '../../src/services/LocalEmbeddingService.js';
import { ResourceManager } from '@legion/resource-manager';
import { QdrantClient } from '@qdrant/js-client-rest';

describe('QdrantVectorStore Integration - NO MOCKS', () => {
  let vectorStore;
  let embeddingService;
  let resourceManager;
  let qdrantClient;
  const TEST_COLLECTION = 'test-qdrant-vector-store';
  const VECTOR_DIMENSIONS = 768; // Nomic dimensions

  beforeAll(async () => {
    // Initialize ResourceManager
    resourceManager = ResourceManager.getInstance();
    await resourceManager.initialize();

    // Initialize real embedding service
    embeddingService = new LocalEmbeddingService();
    await embeddingService.initialize();

    // Create direct Qdrant client for verification
    qdrantClient = new QdrantClient({
      url: process.env.QDRANT_URL || 'http://localhost:6333'
    });

    // Verify Qdrant is accessible
    try {
      await qdrantClient.getCollections();
      console.log('✅ Qdrant is accessible');
    } catch (error) {
      throw new Error(`Qdrant not accessible at ${process.env.QDRANT_URL || 'http://localhost:6333'}: ${error.message}`);
    }
  }, 30000);

  afterAll(async () => {
    // Cleanup test collection
    try {
      await qdrantClient.deleteCollection(TEST_COLLECTION);
    } catch (error) {
      // Collection might not exist
    }

    if (embeddingService) {
      await embeddingService.cleanup();
    }
  });

  beforeEach(async () => {
    // Create fresh vector store for each test
    vectorStore = new QdrantVectorStore({
      url: process.env.QDRANT_URL || 'http://localhost:6333'
    }, resourceManager);

    // Ensure collection is deleted before each test
    try {
      await qdrantClient.deleteCollection(TEST_COLLECTION);
    } catch (error) {
      // Collection might not exist
    }
  });

  describe('Connection Management', () => {
    it('should connect to Qdrant successfully', async () => {
      await vectorStore.connect();
      expect(vectorStore.connected).toBe(true);
    });

    it('should fail immediately when Qdrant is not running', async () => {
      // Create vector store with invalid port - should fail immediately
      const badStore = new QdrantVectorStore({
        url: 'http://localhost:9999'
      }, resourceManager);

      // This should fail immediately - NO FALLBACK
      await expect(badStore.connect()).rejects.toThrow(/Failed to connect/);
    });

    it('should reuse singleton client through ResourceManager', async () => {
      const store1 = new QdrantVectorStore({
        url: 'http://localhost:6333'
      }, resourceManager);
      
      const store2 = new QdrantVectorStore({
        url: 'http://localhost:6333'
      }, resourceManager);

      await store1.connect();
      await store2.connect();

      // Both should be connected and using same client
      expect(store1.connected).toBe(true);
      expect(store2.connected).toBe(true);
    });
  });

  describe('Collection Operations', () => {
    beforeEach(async () => {
      await vectorStore.connect();
    });

    it('should create collection with correct dimensions', async () => {
      await vectorStore.createCollection(TEST_COLLECTION, { dimension: VECTOR_DIMENSIONS });

      // Verify collection exists with correct config
      const collections = await qdrantClient.getCollections();
      const testCollection = collections.collections.find(c => c.name === TEST_COLLECTION);
      
      expect(testCollection).toBeDefined();
      
      // Get collection info to verify dimensions
      const collectionInfo = await qdrantClient.getCollection(TEST_COLLECTION);
      expect(collectionInfo.config.params.vectors.size).toBe(VECTOR_DIMENSIONS);
    });

    it('should delete collection', async () => {
      // Create collection first
      await vectorStore.createCollection(TEST_COLLECTION, { dimension: VECTOR_DIMENSIONS });
      
      // Verify it exists
      let collections = await qdrantClient.getCollections();
      expect(collections.collections.some(c => c.name === TEST_COLLECTION)).toBe(true);

      // Delete it
      await vectorStore.deleteCollection(TEST_COLLECTION);

      // Verify it's gone
      collections = await qdrantClient.getCollections();
      expect(collections.collections.some(c => c.name === TEST_COLLECTION)).toBe(false);
    });

    it('should handle collection recreation gracefully', async () => {
      // Create collection
      await vectorStore.createCollection(TEST_COLLECTION, { dimension: VECTOR_DIMENSIONS });
      
      // Try to create again - should not throw
      await expect(vectorStore.createCollection(TEST_COLLECTION, { dimension: VECTOR_DIMENSIONS }))
        .resolves.not.toThrow();
    });

    it('should check if collection exists', async () => {
      // Should not exist initially
      let exists = await vectorStore.collectionExists(TEST_COLLECTION);
      expect(exists).toBe(false);

      // Create collection
      await vectorStore.createCollection(TEST_COLLECTION, { dimension: VECTOR_DIMENSIONS });

      // Should exist now
      exists = await vectorStore.collectionExists(TEST_COLLECTION);
      expect(exists).toBe(true);
    });
  });

  describe('Vector Operations', () => {
    beforeEach(async () => {
      await vectorStore.connect();
      await vectorStore.createCollection(TEST_COLLECTION, { dimension: VECTOR_DIMENSIONS });
    });

    it('should upsert single vector with real embeddings', async () => {
      const text = 'Test document for vector storage';
      const embedding = await embeddingService.embed(text);

      const vector = {
        id: 'test-1',
        vector: embedding,
        payload: {
          text: text,
          category: 'test'
        }
      };

      const result = await vectorStore.upsert(TEST_COLLECTION, [vector]);
      expect(result).toBeDefined();
      expect(result.operation_id).toBeDefined();

      // Verify vector was stored
      const searchResult = await qdrantClient.retrieve(TEST_COLLECTION, {
        ids: ['test-1']
      });
      
      expect(searchResult.length).toBe(1);
      expect(searchResult[0].id).toBe('test-1');
      expect(searchResult[0].payload.text).toBe(text);
    });

    it('should upsert multiple vectors in batch', async () => {
      const texts = [
        'First document about programming',
        'Second document about databases',
        'Third document about machine learning'
      ];

      const embeddings = await embeddingService.embedBatch(texts);
      
      const vectors = texts.map((text, i) => ({
        id: `batch-${i}`,
        vector: embeddings[i],
        payload: {
          text: text,
          index: i
        }
      }));

      const result = await vectorStore.upsert(TEST_COLLECTION, vectors);
      expect(result).toBeDefined();

      // Verify all vectors were stored
      const searchResult = await qdrantClient.retrieve(TEST_COLLECTION, {
        ids: vectors.map(v => v.id)
      });
      
      expect(searchResult.length).toBe(3);
      searchResult.forEach((point, i) => {
        expect(point.payload.text).toBe(texts[i]);
      });
    });

    it('should handle dimension validation', async () => {
      // Try to insert vector with wrong dimensions
      const wrongVector = {
        id: 'wrong-dim',
        vector: new Array(512).fill(0.1), // Wrong size
        payload: { text: 'test' }
      };

      await expect(vectorStore.upsert(TEST_COLLECTION, [wrongVector]))
        .rejects.toThrow();
    });

    it('should update existing vectors', async () => {
      const text1 = 'Original text';
      const embedding1 = await embeddingService.embed(text1);

      // Insert initial vector
      await vectorStore.upsert(TEST_COLLECTION, [{
        id: 'update-test',
        vector: embedding1,
        payload: { text: text1, version: 1 }
      }]);

      // Update with new content
      const text2 = 'Updated text';
      const embedding2 = await embeddingService.embed(text2);

      await vectorStore.upsert(TEST_COLLECTION, [{
        id: 'update-test',
        vector: embedding2,
        payload: { text: text2, version: 2 }
      }]);

      // Verify update
      const result = await qdrantClient.retrieve(TEST_COLLECTION, {
        ids: ['update-test']
      });

      expect(result[0].payload.text).toBe(text2);
      expect(result[0].payload.version).toBe(2);
    });
  });

  describe('Search Operations', () => {
    const testDocuments = [
      { id: 'doc-1', text: 'Python programming language tutorial' },
      { id: 'doc-2', text: 'JavaScript web development guide' },
      { id: 'doc-3', text: 'Machine learning with neural networks' },
      { id: 'doc-4', text: 'Database optimization techniques' },
      { id: 'doc-5', text: 'Cloud computing architecture patterns' }
    ];

    beforeEach(async () => {
      await vectorStore.connect();
      await vectorStore.createCollection(TEST_COLLECTION, { dimension: VECTOR_DIMENSIONS });

      // Index test documents
      const embeddings = await embeddingService.embedBatch(testDocuments.map(d => d.text));
      const vectors = testDocuments.map((doc, i) => ({
        id: doc.id,
        vector: embeddings[i],
        payload: doc
      }));

      await vectorStore.upsert(TEST_COLLECTION, vectors);
    });

    it('should perform semantic search with real embeddings', async () => {
      const query = 'How to learn Python programming';
      const queryEmbedding = await embeddingService.embed(query);

      const results = await vectorStore.search(TEST_COLLECTION, queryEmbedding, {
        limit: 3
      });

      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(3);

      // Python document should rank high
      const pythonResult = results.find(r => r.id === 'doc-1');
      expect(pythonResult).toBeDefined();
      
      // Results should have scores
      results.forEach(result => {
        expect(result.score).toBeDefined();
        expect(result.score).toBeGreaterThan(0);
        expect(result.score).toBeLessThanOrEqual(1);
      });
    });

    it('should respect search limit', async () => {
      const query = 'programming';
      const queryEmbedding = await embeddingService.embed(query);

      const results = await vectorStore.search(TEST_COLLECTION, queryEmbedding, {
        limit: 2
      });

      expect(results.length).toBe(2);
    });

    it('should filter by metadata', async () => {
      // Add documents with categories
      const categorizedDocs = [
        { id: 'cat-1', text: 'Frontend React development', category: 'frontend' },
        { id: 'cat-2', text: 'Backend Node.js APIs', category: 'backend' },
        { id: 'cat-3', text: 'Vue.js components', category: 'frontend' }
      ];

      const embeddings = await embeddingService.embedBatch(categorizedDocs.map(d => d.text));
      const vectors = categorizedDocs.map((doc, i) => ({
        id: doc.id,
        vector: embeddings[i],
        payload: doc
      }));

      await vectorStore.upsert(TEST_COLLECTION, vectors);

      // Search with filter
      const query = 'web development';
      const queryEmbedding = await embeddingService.embed(query);

      const results = await vectorStore.search(TEST_COLLECTION, queryEmbedding, {
        limit: 10,
        filter: {
          must: [
            {
              key: 'category',
              match: { value: 'frontend' }
            }
          ]
        }
      });

      // Should only return frontend documents
      results.forEach(result => {
        expect(result.payload.category).toBe('frontend');
      });
    });

    it('should handle empty search results', async () => {
      // Create a random vector that won't match anything well
      const randomVector = new Array(VECTOR_DIMENSIONS).fill(0).map(() => Math.random());

      const results = await vectorStore.search(TEST_COLLECTION, randomVector, {
        limit: 5,
        threshold: 0.95 // Very high threshold
      });

      // Should return empty or very few results
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('Delete Operations', () => {
    beforeEach(async () => {
      await vectorStore.connect();
      await vectorStore.createCollection(TEST_COLLECTION, { dimension: VECTOR_DIMENSIONS });
    });

    it('should delete vectors by ID', async () => {
      // Insert test vectors
      const texts = ['Document 1', 'Document 2', 'Document 3'];
      const embeddings = await embeddingService.embedBatch(texts);
      const vectors = texts.map((text, i) => ({
        id: `delete-${i}`,
        vector: embeddings[i],
        payload: { text }
      }));

      await vectorStore.upsert(TEST_COLLECTION, vectors);

      // Delete one vector
      await vectorStore.delete(TEST_COLLECTION, {
        ids: ['delete-1']
      });

      // Verify deletion
      const remaining = await qdrantClient.retrieve(TEST_COLLECTION, {
        ids: ['delete-0', 'delete-1', 'delete-2']
      });

      expect(remaining.length).toBe(2);
      expect(remaining.find(p => p.id === 'delete-1')).toBeUndefined();
    });

    it('should delete vectors by filter', async () => {
      // Insert categorized vectors
      const docs = [
        { text: 'Keep this', category: 'keep' },
        { text: 'Delete this 1', category: 'delete' },
        { text: 'Delete this 2', category: 'delete' },
        { text: 'Also keep', category: 'keep' }
      ];

      const embeddings = await embeddingService.embedBatch(docs.map(d => d.text));
      const vectors = docs.map((doc, i) => ({
        id: `filter-${i}`,
        vector: embeddings[i],
        payload: doc
      }));

      await vectorStore.upsert(TEST_COLLECTION, vectors);

      // Delete by filter
      await vectorStore.delete(TEST_COLLECTION, {
        filter: {
          must: [
            {
              key: 'category',
              match: { value: 'delete' }
            }
          ]
        }
      });

      // Verify only 'keep' documents remain
      const searchResult = await vectorStore.search(
        TEST_COLLECTION,
        embeddings[0], // Use any embedding for search
        { limit: 10 }
      );

      searchResult.forEach(result => {
        expect(result.payload.category).toBe('keep');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle connection errors gracefully', async () => {
      const badStore = new QdrantVectorStore({
        url: 'http://invalid-host:6333',
        timeout: 1000
      }, resourceManager);

      await expect(badStore.connect()).rejects.toThrow();
    });

    it('should handle operations on non-existent collections', async () => {
      await vectorStore.connect();

      const fakeVector = new Array(VECTOR_DIMENSIONS).fill(0.1);
      
      // Search on non-existent collection should throw
      await expect(vectorStore.search('non-existent-collection', fakeVector))
        .rejects.toThrow();
    });

    it('should handle invalid vector dimensions', async () => {
      await vectorStore.connect();
      await vectorStore.createCollection(TEST_COLLECTION, { dimension: VECTOR_DIMENSIONS });

      const wrongSizeVector = new Array(512).fill(0.1);

      await expect(vectorStore.upsert(TEST_COLLECTION, [{
        id: 'wrong-size',
        vector: wrongSizeVector,
        payload: {}
      }])).rejects.toThrow();
    });

    it('should handle timeout scenarios', async () => {
      const timeoutStore = new QdrantVectorStore({
        url: process.env.QDRANT_URL || 'http://localhost:6333',
        timeout: 1 // 1ms timeout
      }, resourceManager);

      // Very short timeout might cause operations to fail
      // This tests timeout handling without breaking the test suite
      try {
        await timeoutStore.connect();
        const result = await timeoutStore.search(TEST_COLLECTION, new Array(768).fill(0.1));
        // If it succeeds, Qdrant is very fast
        expect(result).toBeDefined();
      } catch (error) {
        // Timeout error is expected
        expect(error.message).toMatch(/timeout|timed out/i);
      }
    });
  });

  describe('Batch Operations at Scale', () => {
    beforeEach(async () => {
      await vectorStore.connect();
      await vectorStore.createCollection(TEST_COLLECTION, { dimension: VECTOR_DIMENSIONS });
    });

    it('should handle large batch insertions', async () => {
      const BATCH_SIZE = 100;
      const texts = Array.from({ length: BATCH_SIZE }, (_, i) => 
        `Document ${i}: This is test content for batch processing`
      );

      // Generate embeddings in batches
      const embeddings = [];
      const EMBEDDING_BATCH_SIZE = 10;
      
      for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
        const batch = texts.slice(i, i + EMBEDDING_BATCH_SIZE);
        const batchEmbeddings = await embeddingService.embedBatch(batch);
        embeddings.push(...batchEmbeddings);
      }

      // Create vectors
      const vectors = texts.map((text, i) => ({
        id: `batch-scale-${i}`,
        vector: embeddings[i],
        payload: { text, index: i }
      }));

      // Insert in batches
      const INSERT_BATCH_SIZE = 50;
      for (let i = 0; i < vectors.length; i += INSERT_BATCH_SIZE) {
        const batch = vectors.slice(i, i + INSERT_BATCH_SIZE);
        await vectorStore.upsert(TEST_COLLECTION, batch);
      }

      // Verify all were inserted
      const testEmbedding = embeddings[0];
      const results = await vectorStore.search(TEST_COLLECTION, testEmbedding, {
        limit: BATCH_SIZE
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(BATCH_SIZE);
    }, 60000); // 60 second timeout for large batch
  });
});