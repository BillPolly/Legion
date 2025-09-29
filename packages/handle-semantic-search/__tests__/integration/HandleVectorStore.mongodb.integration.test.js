/**
 * Integration tests for HandleVectorStore MongoDB integration with real services
 * Phase 4: Metadata storage in MongoDB
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { HandleVectorStore } from '../../src/HandleVectorStore.js';
import { ResourceManager } from '@legion/resource-manager';

describe('HandleVectorStore MongoDB Integration', () => {
  let store;
  let resourceManager;
  const testHandleURI = 'legion://local/test/mongodb-integration-test';

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
    store = new HandleVectorStore(resourceManager);
    await store.initialize();

    // Clean up any existing test data BEFORE tests run
    try {
      await store.deleteVectors(testHandleURI);
      await store.mongoHandle.dataSource.updateAsync({
        deleteMany: {
          filter: { handleURI: testHandleURI }
        }
      });
    } catch (error) {
      // Ignore cleanup errors
    }
  }, 60000);

  afterAll(async () => {
    // Clean up test data after tests
    try {
      await store.deleteVectors(testHandleURI);
      await store.mongoHandle.dataSource.updateAsync({
        deleteMany: {
          filter: { handleURI: testHandleURI }
        }
      });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('MongoDB Handle Initialization', () => {
    it('should have MongoDB handle initialized', () => {
      expect(store.mongoHandle).toBeDefined();
      expect(store.initialized).toBe(true);
    });
  });

  describe('Handle Record Persistence', () => {
    it('should store complete handle record in MongoDB', async () => {
      const metadata = {
        server: 'local',
        resourceType: 'test',
        path: '/mongodb-test',
        capabilities: ['read', 'write'],
        handleType: 'filesystem'
      };

      const glosses = [
        {
          perspective: 'functional',
          description: 'Test file for MongoDB integration testing',
          keywords: ['test', 'mongodb', 'integration']
        }
      ];

      const vectorIds = [Date.now() * 1000 + 1];

      const result = await store.storeHandleRecord(
        testHandleURI,
        metadata,
        glosses,
        vectorIds
      );

      expect(result.success).toBe(true);
      expect(result.mongoId).toBeDefined();

      // Verify record was stored (use getHandleRecord to get raw document data)
      const record = await store.getHandleRecord(testHandleURI);
      expect(record).toBeDefined();
      expect(record.handleURI).toBe(testHandleURI);
      expect(record.handleType).toBe('filesystem');
      expect(record.metadata).toEqual(metadata);
      expect(record.glosses).toHaveLength(1);
      expect(record.glosses[0].type).toBe('functional');
      expect(record.glosses[0].content).toBe(glosses[0].description);
      expect(record.glosses[0].keywords).toEqual(glosses[0].keywords);
      expect(record.glosses[0].vector_id).toBe(vectorIds[0]);
      expect(record.status).toBe('active');
      expect(record.vector_collection).toBe('handle_vectors');
      expect(record.indexed_at).toBeDefined();
      expect(record.updated_at).toBeDefined();
    }, 30000);

    it('should update existing record on upsert', async () => {
      const metadata = { handleType: 'test', version: 1 };
      const glosses = [
        {
          perspective: 'functional',
          description: 'Version 1',
          keywords: ['v1']
        }
      ];

      // First insert
      await store.storeHandleRecord(testHandleURI, metadata, glosses, [123]);

      const record1 = await store.getHandleRecord(testHandleURI);
      const indexed_at1 = record1.indexed_at;

      // Update with new data
      const metadata2 = { handleType: 'test', version: 2 };
      const glosses2 = [
        {
          perspective: 'functional',
          description: 'Version 2',
          keywords: ['v2']
        }
      ];

      await store.storeHandleRecord(testHandleURI, metadata2, glosses2, [456]);

      const record2 = await store.getHandleRecord(testHandleURI);

      // indexed_at should not change
      expect(record2.indexed_at).toBe(indexed_at1);

      // updated_at should be different
      expect(record2.updated_at).not.toBe(record1.updated_at);

      // Data should be updated
      expect(record2.metadata.version).toBe(2);
      expect(record2.glosses[0].content).toBe('Version 2');
      expect(record2.glosses[0].vector_id).toBe(456);
    }, 30000);
  });

  describe('Handle Record Retrieval', () => {
    it('should retrieve handle record by URI', async () => {
      const metadata = { handleType: 'test' };
      const glosses = [
        {
          perspective: 'functional',
          description: 'Retrieval test',
          keywords: ['retrieval']
        }
      ];

      await store.storeHandleRecord(testHandleURI, metadata, glosses, [789]);

      const record = await store.getHandleRecord(testHandleURI);

      expect(record).toBeDefined();
      expect(record.handleURI).toBe(testHandleURI);
      expect(record.glosses[0].content).toBe('Retrieval test');
    }, 30000);

    it('should return null for non-existent handle', async () => {
      const record = await store.getHandleRecord('legion://local/nonexistent/handle');

      expect(record).toBeNull();
    }, 30000);
  });

  describe('Dual Storage Coordination', () => {
    const dualTestURI = 'legion://local/test/dual-storage-test';

    afterAll(async () => {
      try {
        await store.deleteVectors(dualTestURI);
        await store.mongoHandle.deleteOne({ handleURI: dualTestURI });
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    it('should store in both Qdrant and MongoDB', async () => {
      const metadata = {
        handleType: 'filesystem',
        server: 'local',
        resourceType: 'filesystem',
        path: '/dual-test.js'
      };

      const glosses = [
        {
          perspective: 'functional',
          description: 'JavaScript file for dual storage testing',
          keywords: ['javascript', 'test']
        },
        {
          perspective: 'contextual',
          description: 'Test file in local filesystem',
          keywords: ['filesystem', 'local']
        }
      ];

      const result = await store.storeHandle(dualTestURI, metadata, glosses);

      expect(result.success).toBe(true);
      expect(result.vectorIds).toHaveLength(2);
      expect(result.mongoId).toBeDefined();

      // Verify Qdrant storage
      const searchResults = await store.searchSimilar('dual storage test', {
        limit: 5,
        filter: {
          must: [{ key: 'handle_uri', match: { value: dualTestURI } }]
        }
      });

      expect(searchResults.length).toBeGreaterThan(0);
      const foundURI = searchResults.find(r => r.handleURI === dualTestURI);
      expect(foundURI).toBeDefined();

      // Verify MongoDB storage
      const mongoRecord = await store.getHandleRecord(dualTestURI);
      expect(mongoRecord).toBeDefined();
      expect(mongoRecord.handleURI).toBe(dualTestURI);
      expect(mongoRecord.glosses).toHaveLength(2);
      expect(mongoRecord.glosses[0].vector_id).toBe(result.vectorIds[0]);
      expect(mongoRecord.glosses[1].vector_id).toBe(result.vectorIds[1]);
    }, 60000);

    it('should maintain referential integrity between storages', async () => {
      // Get MongoDB record
      const mongoRecord = await store.getHandleRecord(dualTestURI);
      expect(mongoRecord).toBeDefined();

      // For each gloss, verify vector exists in Qdrant
      for (const gloss of mongoRecord.glosses) {
        const vectorId = gloss.vector_id;

        // Search for this specific vector
        const searchResults = await store.searchSimilar(gloss.content, {
          limit: 10,
          filter: {
            must: [{ key: 'handle_uri', match: { value: dualTestURI } }]
          }
        });

        const foundVector = searchResults.find(r => r.vectorId === vectorId);
        expect(foundVector).toBeDefined();
        expect(foundVector.description).toBe(gloss.content);
      }
    }, 60000);
  });
});