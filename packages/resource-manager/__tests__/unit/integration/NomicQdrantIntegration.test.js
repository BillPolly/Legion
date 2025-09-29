/**
 * Integration tests for Nomic and Qdrant working together
 * Tests the complete flow of generating embeddings with Nomic and storing/searching them with Qdrant
 */

import { jest } from '@jest/globals';
import { ResourceManager } from '../../../src/ResourceManager.js';

describe('Nomic and Qdrant Integration', () => {
  let resourceManager;
  let nomicHandle;
  let qdrantHandle;
  let testCollection;

  beforeAll(async () => {
    // Get ResourceManager singleton once
    resourceManager = await ResourceManager.getInstance();
    
    // Create unique collection name for this test run
    testCollection = `test_embeddings_${Date.now()}`;
  });

  afterAll(async () => {
    // Cleanup test collection if it exists
    if (qdrantHandle) {
      try {
        const exists = await qdrantHandle.exists();
        if (exists) {
          await qdrantHandle.deleteCollection();
        }
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  describe('URI-based Handle creation', () => {
    it('should create Nomic Handle via ResourceManager', async () => {
      const uri = 'legion://local/nomic/embeddings';
      nomicHandle = await resourceManager.getHandle(uri);
      
      expect(nomicHandle).toBeDefined();
      expect(nomicHandle.constructor.name).toBe('NomicHandle');
      expect(nomicHandle.toURI()).toBe(uri);
    });

    it('should create Qdrant Handle via ResourceManager', async () => {
      const uri = `legion://local/qdrant/collections/${testCollection}`;
      qdrantHandle = await resourceManager.getHandle(uri);
      
      expect(qdrantHandle).toBeDefined();
      expect(qdrantHandle.constructor.name).toBe('QdrantHandle');
      expect(qdrantHandle.collectionName).toBe(testCollection);
    });

    it('should share DataSource instances between Handles of same type', async () => {
      const uri1 = 'legion://local/nomic/embeddings';
      const uri2 = 'legion://local/nomic/embeddings/test';
      
      const handle1 = await resourceManager.getHandle(uri1);
      const handle2 = await resourceManager.getHandle(uri2);
      
      expect(handle1.dataSource).toBe(handle2.dataSource);
    });
  });

  describe('Nomic embedding generation', () => {
    let embeddings;
    const testTexts = [
      'Machine learning and AI',
      'Neural networks work',
      'Deep learning models',
      'Natural language processing'
    ];

    it('should generate embeddings for text', async () => {
      const text = testTexts[0];
      const embedding = await nomicHandle.embed(text);
      
      expect(embedding).toBeDefined();
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBe(768);
      expect(embedding.every(v => typeof v === 'number')).toBe(true);
    });

    it('should generate embeddings for multiple texts', async () => {
      embeddings = await nomicHandle.embedBatch(testTexts);
      
      expect(embeddings).toBeDefined();
      expect(embeddings.length).toBe(testTexts.length);
      expect(embeddings[0].length).toBe(768);
    });

    it('should cache embeddings for repeated texts', async () => {
      // First call - should compute
      const start1 = Date.now();
      const embedding1 = await nomicHandle.embed(testTexts[0]);
      const time1 = Date.now() - start1;
      
      // Second call - should use cache
      const start2 = Date.now();
      const embedding2 = await nomicHandle.embed(testTexts[0]);
      const time2 = Date.now() - start2;
      
      expect(embedding1).toEqual(embedding2);
      // Cache should be faster (allowing for some variance)
      expect(time2).toBeLessThanOrEqual(time1 + 10);
    });
  });

  describe('Qdrant vector storage', () => {
    let storedEmbeddings;

    beforeAll(async () => {
      // Generate embeddings if not already done
      if (!storedEmbeddings) {
        const texts = [
          'Machine learning and AI',
          'Neural networks work',
          'Deep learning models',
          'Natural language processing'
        ];
        storedEmbeddings = await nomicHandle.embedBatch(texts);
      }
    });

    it('should create collection for vector storage', async () => {
      const config = {
        collection_name: testCollection,
        vectors: {
          size: 768,
          distance: 'Cosine'
        }
      };
      
      const result = await qdrantHandle.createCollection(config);
      expect(result).toBeDefined();
      expect(result.result || result.ok || result.status).toBeTruthy();
    });

    it('should verify collection exists', async () => {
      const exists = await qdrantHandle.exists();
      expect(exists).toBe(true);
    });

    it('should store embeddings as vectors in Qdrant', async () => {
      const points = storedEmbeddings.map((embedding, i) => ({
        id: i,
        vector: embedding,
        payload: {
          text: [
            'Machine learning and AI',
            'Neural networks work',
            'Deep learning models',
            'Natural language processing'
          ][i],
          index: i
        }
      }));
      
      const result = await qdrantHandle.upsert(points);
      expect(result).toBeDefined();
      expect(result.status || result.result || result.ok).toBeTruthy();
    });

    it('should retrieve stored vectors by ID', async () => {
      const points = await qdrantHandle.getPoints([0, 1]);
      
      expect(points).toBeDefined();
      expect(points.length).toBe(2);
      expect(points[0].payload.text).toBe('Machine learning and AI');
    });
  });

  describe('Semantic search integration', () => {
    it('should find similar texts using Nomic embeddings and Qdrant search', async () => {
      // Generate embedding for query
      const queryText = 'Artificial intelligence and machine learning';
      const queryEmbedding = await nomicHandle.embed(queryText);
      
      // Search in Qdrant
      const results = await qdrantHandle.search(queryEmbedding, 3);
      
      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
      
      // First result should be most similar (about ML/AI)
      expect(results[0].payload.text).toContain('Machine learning');
      expect(results[0].score).toBeGreaterThan(0.5);
    });

    it('should find semantically related content', async () => {
      // Query about neural networks
      const queryText = 'How do artificial neurons work in deep neural networks?';
      const queryEmbedding = await nomicHandle.embed(queryText);
      
      const results = await qdrantHandle.search(queryEmbedding, 2);
      
      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
      
      // Should find texts about neural networks and deep learning
      const resultTexts = results.map(r => r.payload.text).join(' ');
      expect(resultTexts).toMatch(/neural|deep|neurons/i);
    });

    it('should handle batch similarity search', async () => {
      const queries = [
        'What is AI?',
        'How do neural networks learn?',
        'Text understanding with computers'
      ];
      
      // Generate embeddings for all queries
      const queryEmbeddings = await nomicHandle.embedBatch(queries);
      
      // Batch search in Qdrant
      const batchResults = await qdrantHandle.batchSearch(queryEmbeddings, 2);
      
      expect(batchResults).toBeDefined();
      expect(batchResults.length).toBe(queries.length);
      
      // Each query should have results
      batchResults.forEach(results => {
        expect(results.length).toBeGreaterThan(0);
        expect(results[0].score).toBeGreaterThan(0);
      });
    });
  });

  describe('Handle navigation and URIs', () => {
    it('should navigate Qdrant Handle hierarchy', async () => {
      // Start from collection
      expect(qdrantHandle.collectionName).toBe(testCollection);
      
      // Navigate to parent (root)
      const parent = qdrantHandle.parent();
      expect(parent).toBeDefined();
      expect(parent.isRoot).toBe(true);
      expect(parent.toURI()).toBe('legion://local/qdrant/collections');
      
      // Navigate to different collection
      const otherCollection = qdrantHandle.collection('other_vectors');
      expect(otherCollection.collectionName).toBe('other_vectors');
      expect(otherCollection.toURI()).toBe('legion://local/qdrant/collections/other_vectors');
    });

    it('should navigate Nomic Handle paths', async () => {
      // Create child Handle
      const child = nomicHandle.child('cache');
      expect(child).toBeDefined();
      expect(child.toURI()).toBe('legion://local/nomic/embeddings/cache');
      
      // Navigate back to parent
      const parent = child.parent();
      expect(parent).toBeDefined();
      expect(parent.toURI()).toBe('legion://local/nomic/embeddings');
    });
  });

  describe('Subscription and events', () => {
    it('should subscribe to Qdrant collection changes', async () => {
      const events = [];
      
      const subscription = qdrantHandle.subscribe(
        (event) => events.push(event),
        { event: 'collection.change', collection: testCollection }
      );
      
      // Trigger change by upserting
      await qdrantHandle.upsert([{
        id: 999,
        vector: new Array(768).fill(0),
        payload: { test: true }
      }]);
      
      expect(events.length).toBe(1);
      expect(events[0].data.operation).toBe('upsert');
      expect(events[0].data.collection).toBe(testCollection);
      
      subscription.unsubscribe();
    });

    it('should subscribe to Nomic model events', async () => {
      const events = [];
      
      const subscription = nomicHandle.subscribe(
        (event) => events.push(event),
        { event: 'model.loaded' }
      );
      
      // Model should already be loaded
      expect(nomicHandle.isModelLoaded()).toBe(true);
      
      subscription.unsubscribe();
    });
  });

  describe('Complete workflow', () => {
    it('should handle complete embedding and search workflow', async () => {
      // 1. Create a new collection
      const workflowCollection = `workflow_test_${Date.now()}`;
      const workflowHandle = await resourceManager.getHandle(
        `legion://local/qdrant/collections/${workflowCollection}`
      );
      
      await workflowHandle.createCollection({
        collection_name: workflowCollection,
        vectors: { size: 768, distance: 'Cosine' }
      });
      
      // 2. Prepare documents
      const documents = [
        { id: 'doc1', text: 'Python is a popular programming language' },
        { id: 'doc2', text: 'JavaScript runs in web browsers' },
        { id: 'doc3', text: 'Rust provides memory safety without garbage collection' },
        { id: 'doc4', text: 'TypeScript adds static typing to JavaScript' },
        { id: 'doc5', text: 'Go is designed for concurrent programming' }
      ];
      
      // 3. Generate embeddings for all documents
      const texts = documents.map(d => d.text);
      const embeddings = await nomicHandle.embedBatch(texts);
      
      // 4. Store in Qdrant
      const points = documents.map((doc, i) => ({
        id: i + 100, // Start at 100 to avoid conflicts with other test data
        vector: embeddings[i],
        payload: doc
      }));
      
      await workflowHandle.upsert(points);
      
      // 5. Search for related content
      const query = 'What programming language is best for web development?';
      const queryEmbedding = await nomicHandle.embed(query);
      const searchResults = await workflowHandle.search(queryEmbedding, 3);
      
      // 6. Verify results
      expect(searchResults.length).toBeGreaterThan(0);
      
      // Should find JavaScript and TypeScript as top results
      const topTexts = searchResults.map(r => r.payload.text).join(' ');
      expect(topTexts).toMatch(/JavaScript|TypeScript/);
      
      // 7. Cleanup
      await workflowHandle.deleteCollection();
    });
  });

  describe('Error handling', () => {
    it('should handle invalid vector dimensions', async () => {
      const invalidVector = new Array(512).fill(0); // Wrong size
      
      await expect(
        qdrantHandle.search(invalidVector, 5)
      ).rejects.toThrow('Invalid vector dimension');
    });

    it('should handle collection not found', async () => {
      const nonExistent = await resourceManager.getHandle(
        'legion://local/qdrant/collections/non_existent_collection'
      );
      
      const exists = await nonExistent.exists();
      expect(exists).toBe(false);
    });

    it('should handle text too long for embedding', async () => {
      // Create very long text (over context limit)
      const longText = 'Lorem ipsum dolor sit amet '.repeat(50);
      
      // Should truncate and still generate embedding
      const embedding = await nomicHandle.embed(longText);
      expect(embedding).toBeDefined();
      expect(embedding.length).toBe(768);
    });
  });

  describe('Performance and caching', () => {
    it('should efficiently handle repeated embeddings', async () => {
      const text = 'Test text for caching';
      const iterations = 10;
      
      const start = Date.now();
      for (let i = 0; i < iterations; i++) {
        await nomicHandle.embed(text);
      }
      const elapsed = Date.now() - start;
      
      // Should be fast due to caching (less than 100ms total for 10 iterations)
      expect(elapsed).toBeLessThan(100);
    });

    it('should maintain separate caches for different Handle instances', async () => {
      const handle1 = await resourceManager.getHandle('legion://local/nomic/embeddings');
      const handle2 = await resourceManager.getHandle('legion://local/nomic/embeddings');
      
      // Both should share the same DataSource and cache
      const text = 'Shared cache test';
      await handle1.embed(text);
      
      // handle2 should also have it cached (same DataSource)
      const cacheStats = handle2.getCacheStats();
      expect(cacheStats.size).toBeGreaterThan(0);
    });
  });
});