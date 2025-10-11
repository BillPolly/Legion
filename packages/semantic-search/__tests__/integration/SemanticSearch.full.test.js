/**
 * Comprehensive Integration Tests for Semantic Search
 * Tests the full stack: ResourceManager -> SemanticSearchProvider -> Qdrant -> Nomic Embeddings
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { ResourceManager } from '@legion/resource-manager';

describe('Semantic Search Full Integration', () => {
  let resourceManager;
  let semanticSearch;
  let qdrantClient;
  const testCollectionName = `test-semantic-full-${Date.now()}`;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
    semanticSearch = await resourceManager.get('semanticSearch');
    qdrantClient = await resourceManager.get('qdrantClient');
  }, 60000);

  afterAll(async () => {
    // Cleanup test collection
    if (qdrantClient) {
      try {
        await qdrantClient.deleteCollection(testCollectionName);
      } catch (error) {
        console.warn(`Failed to cleanup: ${error.message}`);
      }
    }

    // Close MongoDB connection
    const mongoClient = await resourceManager.get('mongoClient');
    if (mongoClient) {
      await mongoClient.close();
    }
  }, 30000);

  describe('Provider Initialization', () => {
    test('should have initialized semantic search provider', () => {
      expect(semanticSearch).toBeDefined();
      expect(semanticSearch.name).toBe('SemanticSearchProvider');
      expect(semanticSearch.initialized).toBe(true);
      expect(semanticSearch.connected).toBe(true);
    });

    test('should have embedding service', () => {
      expect(semanticSearch.embeddingService).toBeDefined();
      expect(semanticSearch.embeddingDimensions).toBe(768);
      expect(semanticSearch.useLocalEmbeddings).toBe(true);
    });

    test('should have vector store connected', () => {
      expect(semanticSearch.vectorStore).toBeDefined();
      expect(semanticSearch.vectorStore.connected).toBe(true);
    });

    test('should have document processor', () => {
      expect(semanticSearch.documentProcessor).toBeDefined();
    });
  });

  describe('Collection Management', () => {
    test('should create collection successfully', async () => {
      await semanticSearch.createCollection(testCollectionName, {
        dimension: 768
      });

      // Verify collection exists
      const count = await semanticSearch.count(testCollectionName);
      expect(count).toBe(0);
    }, 15000);

    test('should handle creating existing collection gracefully', async () => {
      // Should not throw error
      await semanticSearch.createCollection(testCollectionName, {
        dimension: 768
      });

      const count = await semanticSearch.count(testCollectionName);
      expect(count).toBe(0);
    }, 15000);
  });

  describe('Document Insertion', () => {
    test('should insert single document', async () => {
      const result = await semanticSearch.insert(testCollectionName, {
        id: 'doc1',
        text: 'The capital of France is Paris',
        metadata: { type: 'geography', country: 'France' }
      });

      expect(result.success).toBe(true);
      expect(result.insertedCount).toBe(1);
      expect(result.vectorsStored).toBe(1);

      // Verify count
      const count = await semanticSearch.count(testCollectionName);
      expect(count).toBe(1);
    }, 30000);

    test('should insert multiple documents in batch', async () => {
      const documents = [
        {
          id: 'doc2',
          text: 'Python is a popular programming language',
          metadata: { type: 'technology', topic: 'programming' }
        },
        {
          id: 'doc3',
          text: 'The Eiffel Tower is located in Paris',
          metadata: { type: 'geography', city: 'Paris' }
        },
        {
          id: 'doc4',
          text: 'Machine learning uses algorithms to learn patterns',
          metadata: { type: 'technology', topic: 'ai' }
        },
        {
          id: 'doc5',
          text: 'JavaScript is used for web development',
          metadata: { type: 'technology', topic: 'programming' }
        }
      ];

      const result = await semanticSearch.insert(testCollectionName, documents);

      expect(result.success).toBe(true);
      expect(result.insertedCount).toBe(4);
      expect(result.vectorsStored).toBe(4);

      // Total should be 5 (1 from previous test + 4 new)
      const count = await semanticSearch.count(testCollectionName);
      expect(count).toBe(5);
    }, 60000);
  });

  describe('Semantic Search', () => {
    test('should find documents about Paris', async () => {
      const results = await semanticSearch.semanticSearch(
        testCollectionName,
        'Tell me about Paris',
        { limit: 3 }
      );

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(3);

      // Verify result structure
      const firstResult = results[0];
      expect(firstResult).toHaveProperty('id');
      expect(firstResult).toHaveProperty('_similarity');
      expect(firstResult).toHaveProperty('document');
      expect(firstResult).toHaveProperty('_searchType', 'semantic');

      // Paris-related documents should be in top results
      const parisResults = results.filter(r =>
        r.document.text.toLowerCase().includes('paris')
      );
      expect(parisResults.length).toBeGreaterThan(0);

      // Top result should have high similarity
      expect(firstResult._similarity).toBeGreaterThan(0.5);
    }, 30000);

    test('should find documents about programming', async () => {
      const results = await semanticSearch.semanticSearch(
        testCollectionName,
        'programming languages',
        { limit: 3, threshold: 0.5 }
      );

      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);

      // Programming-related documents should be in results
      const programmingResults = results.filter(r =>
        r.document.text.toLowerCase().includes('python') ||
        r.document.text.toLowerCase().includes('javascript') ||
        r.document.metadata?.topic === 'programming'
      );
      expect(programmingResults.length).toBeGreaterThan(0);
    }, 30000);

    test('should respect similarity threshold', async () => {
      const results = await semanticSearch.semanticSearch(
        testCollectionName,
        'Tell me about Paris',
        { threshold: 0.8, limit: 10 }
      );

      expect(results).toBeDefined();

      // All results should meet threshold
      results.forEach(result => {
        expect(result._similarity).toBeGreaterThanOrEqual(0.8);
      });
    }, 30000);

    test('should respect result limit', async () => {
      const results = await semanticSearch.semanticSearch(
        testCollectionName,
        'technology',
        { limit: 2 }
      );

      expect(results).toBeDefined();
      expect(results.length).toBeLessThanOrEqual(2);
    }, 30000);
  });

  describe('Hybrid Search', () => {
    test('should perform hybrid search combining semantic and keyword', async () => {
      const results = await semanticSearch.hybridSearch(
        testCollectionName,
        'Paris France',
        {
          limit: 3,
          semanticWeight: 0.7,
          keywordWeight: 0.3
        }
      );

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);

      // Results should have hybrid score
      const firstResult = results[0];
      expect(firstResult).toHaveProperty('_hybridScore');
      expect(firstResult).toHaveProperty('_semanticScore');
      expect(firstResult).toHaveProperty('_keywordScore');
      expect(firstResult).toHaveProperty('_searchType', 'hybrid');
    }, 30000);
  });

  describe('Find Similar', () => {
    test('should find documents similar to a reference document', async () => {
      const referenceDoc = {
        id: 'ref1',
        text: 'Programming with Python and JavaScript',
        metadata: { type: 'technology' }
      };

      const results = await semanticSearch.findSimilar(
        testCollectionName,
        referenceDoc,
        { limit: 2, threshold: 0.5 }
      );

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);

      // Results should have similarity scores
      results.forEach(result => {
        expect(result).toHaveProperty('_similarity');
        expect(result._similarity).toBeGreaterThanOrEqual(0.5);
        expect(result).toHaveProperty('_searchType', 'similarity');
      });
    }, 30000);
  });

  describe('CRUD Operations', () => {
    test('should find documents by filter', async () => {
      const results = await semanticSearch.find(
        testCollectionName,
        { 'metadata.type': 'geography' },
        { limit: 10 }
      );

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);

      // All results should match filter
      results.forEach(result => {
        expect(result.payload?.metadata?.type).toBe('geography');
      });
    }, 30000);

    test('should delete documents by filter', async () => {
      const deleteResult = await semanticSearch.delete(
        testCollectionName,
        { id: 'doc1' }
      );

      expect(deleteResult).toBeDefined();

      // Verify document is gone by trying to find it
      const findResults = await semanticSearch.find(
        testCollectionName,
        { id: 'doc1' },
        { limit: 1 }
      );

      expect(findResults.length).toBe(0);
    }, 30000);
  });

  describe('Edge Cases', () => {
    test('should handle empty query gracefully', async () => {
      const results = await semanticSearch.semanticSearch(
        testCollectionName,
        '',
        { limit: 5 }
      );

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      // Should still return some results based on embeddings
    }, 30000);

    test('should handle very long query by truncating', async () => {
      const longQuery = 'technology '.repeat(500); // Very long query

      const results = await semanticSearch.semanticSearch(
        testCollectionName,
        longQuery,
        { limit: 3 }
      );

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    }, 30000);

    test('should handle query with no results above threshold', async () => {
      const results = await semanticSearch.semanticSearch(
        testCollectionName,
        'quantum physics and astrophysics',
        { threshold: 0.95, limit: 10 }
      );

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      // May return 0 results if threshold is too high
    }, 30000);
  });

  describe('Performance', () => {
    test('should handle multiple sequential searches efficiently', async () => {
      const queries = [
        'Paris',
        'programming',
        'machine learning',
        'JavaScript',
        'geography'
      ];

      const startTime = Date.now();

      for (const query of queries) {
        const results = await semanticSearch.semanticSearch(
          testCollectionName,
          query,
          { limit: 3 }
        );
        expect(results).toBeDefined();
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // All 5 searches should complete in reasonable time (< 15 seconds)
      expect(totalTime).toBeLessThan(15000);
    }, 45000);
  });

  describe('Provider Metadata', () => {
    test('should return correct metadata', () => {
      const metadata = semanticSearch.getMetadata();

      expect(metadata).toBeDefined();
      expect(metadata.name).toBe('SemanticSearchProvider');
      expect(metadata.type).toBe('semantic');
      expect(metadata.initialized).toBe(true);
      expect(metadata.connected).toBe(true);
      expect(metadata.useLocalEmbeddings).toBe(true);
      expect(metadata.embeddingDimensions).toBe(768);
      expect(metadata.vectorDatabase).toBe('qdrant');
    });

    test('should return capabilities', () => {
      const capabilities = semanticSearch.getCapabilities();

      expect(capabilities).toBeDefined();
      expect(Array.isArray(capabilities)).toBe(true);
      expect(capabilities).toContain('semanticSearch');
      expect(capabilities).toContain('hybridSearch');
      expect(capabilities).toContain('findSimilar');
      expect(capabilities).toContain('vectorSearch');
      expect(capabilities).toContain('embeddingGeneration');
    });
  });
});
