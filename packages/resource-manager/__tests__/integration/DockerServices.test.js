/**
 * Integration tests for Docker services (MongoDB, Qdrant) via ResourceManager
 * Tests that ResourceManager can properly connect to Docker-based services
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { ResourceManager } from '../../src/ResourceManager.js';

describe('Docker Services Integration', () => {
  let resourceManager;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
  }, 30000);

  afterAll(async () => {
    // Cleanup MongoDB connection to prevent Jest hanging
    const mongoClient = await resourceManager.get('mongoClient');
    if (mongoClient) {
      await mongoClient.close();
    }
  }, 10000);

  describe('Qdrant Vector Database', () => {
    test('should connect to Qdrant and list collections', async () => {
      const qdrantClient = await resourceManager.get('qdrantClient');
      expect(qdrantClient).toBeDefined();

      const response = await qdrantClient.getCollections();
      expect(response).toHaveProperty('result');
      expect(response.result).toHaveProperty('collections');
      expect(Array.isArray(response.result.collections)).toBe(true);
    }, 10000);

    test('should create and delete a test collection', async () => {
      const qdrantClient = await resourceManager.get('qdrantClient');
      const testCollectionName = `test-collection-${Date.now()}`;

      // Create collection
      await qdrantClient.createCollection(testCollectionName, {
        vectors: {
          size: 768,
          distance: 'Cosine'
        }
      });

      // Verify it exists
      const collectionsResponse = await qdrantClient.getCollections();
      const collectionNames = collectionsResponse.result.collections.map(c => c.name);
      expect(collectionNames).toContain(testCollectionName);

      // Delete collection
      await qdrantClient.deleteCollection(testCollectionName);

      // Verify it's gone
      const collectionsAfterResponse = await qdrantClient.getCollections();
      const collectionNamesAfter = collectionsAfterResponse.result.collections.map(c => c.name);
      expect(collectionNamesAfter).not.toContain(testCollectionName);
    }, 15000);
  });

  describe('MongoDB Database', () => {
    test('should connect to MongoDB and ping', async () => {
      const mongoClient = await resourceManager.get('mongoClient');
      expect(mongoClient).toBeDefined();

      const admin = mongoClient.db('admin');
      const result = await admin.command({ ping: 1 });
      expect(result.ok).toBe(1);
    }, 10000);

    test('should create and delete a test database', async () => {
      const mongoClient = await resourceManager.get('mongoClient');
      const testDbName = `test-db-${Date.now()}`;

      // Create database by inserting a document
      const db = mongoClient.db(testDbName);
      const collection = db.collection('test');
      await collection.insertOne({ test: true });

      // Verify it exists
      const adminDb = mongoClient.db('admin');
      const dbs = await adminDb.admin().listDatabases();
      const dbNames = dbs.databases.map(d => d.name);
      expect(dbNames).toContain(testDbName);

      // Delete database
      await db.dropDatabase();

      // Verify it's gone
      const dbsAfter = await adminDb.admin().listDatabases();
      const dbNamesAfter = dbsAfter.databases.map(d => d.name);
      expect(dbNamesAfter).not.toContain(testDbName);
    }, 15000);
  });

  describe('Semantic Search Integration', () => {
    test('should initialize semantic search provider and connect to Qdrant', async () => {
      const semanticSearch = await resourceManager.get('semanticSearch');
      expect(semanticSearch).toBeDefined();
      expect(semanticSearch.name).toBe('SemanticSearchProvider');
      expect(semanticSearch.connected).toBe(true);

      // Verify vector store is accessible
      expect(semanticSearch.vectorStore).toBeDefined();
      expect(semanticSearch.embeddingService).toBeDefined();

      // Test collection creation (without inserting documents)
      const testCollectionName = `test-semantic-${Date.now()}`;
      try {
        await semanticSearch.createCollection(testCollectionName, {
          dimension: 768
        });

        // Verify collection was created by counting documents (should be 0)
        const count = await semanticSearch.count(testCollectionName);
        expect(count).toBe(0);

      } finally {
        // Cleanup
        const qdrantClient = await resourceManager.get('qdrantClient');
        if (qdrantClient) {
          try {
            await qdrantClient.deleteCollection(testCollectionName);
          } catch (error) {
            console.warn(`Failed to cleanup test collection: ${error.message}`);
          }
        }
      }
    }, 15000);
  });
});
