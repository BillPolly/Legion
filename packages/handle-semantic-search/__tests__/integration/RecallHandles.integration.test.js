/**
 * Integration test for recallHandles() - semantic search and instantiation
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { ResourceManager } from '@legion/resource-manager';
import { HandleMetadataExtractor } from '../../src/HandleMetadataExtractor.js';
import { HandleGlossGenerator } from '../../src/HandleGlossGenerator.js';
import { HandleVectorStore } from '../../src/HandleVectorStore.js';
import { HandleSemanticSearchManager } from '../../src/HandleSemanticSearchManager.js';

describe('RecallHandles Integration', () => {
  let resourceManager;
  let searchManager;
  const testHandles = [
    'legion://local/mongodb/users_db/users_collection',
    'legion://local/mongodb/products_db/products_collection',
    'legion://local/mongodb/orders_db/orders_collection'
  ];

  beforeAll(async () => {
    // Get ResourceManager singleton
    resourceManager = await ResourceManager.getInstance();

    // Initialize components
    const metadataExtractor = new HandleMetadataExtractor();
    const llmClient = await resourceManager.get('llmClient');
    const glossGenerator = new HandleGlossGenerator(llmClient);
    await glossGenerator.initialize();
    const vectorStore = new HandleVectorStore(resourceManager);
    await vectorStore.initialize();

    searchManager = new HandleSemanticSearchManager(
      resourceManager,
      metadataExtractor,
      glossGenerator,
      vectorStore
    );

    // Store test handles
    for (const uri of testHandles) {
      await searchManager.storeHandle(uri);
    }
  }, 180000);

  afterAll(async () => {
    // Cleanup
    for (const uri of testHandles) {
      try {
        await searchManager.removeHandle(uri);
      } catch (err) {
        // Ignore cleanup errors
      }
    }
  });

  describe('recallHandles() workflow', () => {
    it('should search and instantiate handles in one call', async () => {
      const recalled = await searchManager.recallHandles('user database collection', {
        limit: 5,
        threshold: 0.5
      });

      expect(Array.isArray(recalled)).toBe(true);
      expect(recalled.length).toBeGreaterThan(0);

      // Check first result structure
      const first = recalled[0];
      expect(first).toHaveProperty('handle');
      expect(first).toHaveProperty('searchResult');
      expect(first).toHaveProperty('handleURI');
      expect(first).toHaveProperty('similarity');
      expect(first).toHaveProperty('handleType');

      // Verify handle is instantiated and usable
      expect(first.handle).toBeDefined();
      expect(first.handle.resourceType).toBe('mongodb');
      expect(typeof first.similarity).toBe('number');
      expect(first.similarity).toBeGreaterThan(0);
    }, 30000);

    it('should return handles sorted by similarity', async () => {
      const recalled = await searchManager.recallHandles('database', {
        limit: 10,
        threshold: 0.3
      });

      expect(recalled.length).toBeGreaterThan(0);

      // Check that similarities are in descending order
      for (let i = 0; i < recalled.length - 1; i++) {
        expect(recalled[i].similarity).toBeGreaterThanOrEqual(recalled[i + 1].similarity);
      }
    }, 30000);

    it('should filter by handle type', async () => {
      const recalled = await searchManager.recallHandles('collection', {
        limit: 10,
        handleTypes: ['mongodb']
      });

      expect(recalled.length).toBeGreaterThan(0);

      // All should be mongodb handles
      for (const item of recalled) {
        expect(item.handleType).toBe('mongodb');
        expect(item.handle.resourceType).toBe('mongodb');
      }
    }, 30000);

    it('should provide search metadata alongside instantiated handle', async () => {
      const recalled = await searchManager.recallHandles('products', { limit: 3 });

      expect(recalled.length).toBeGreaterThan(0);

      const first = recalled[0];

      // Has search result metadata
      expect(first.searchResult).toBeDefined();
      expect(first.searchResult.handleURI).toBe(first.handleURI);
      expect(first.searchResult.similarity).toBe(first.similarity);
      expect(first.searchResult.matchedGloss).toBeDefined();
      expect(first.searchResult.metadata).toBeDefined();

      // Has instantiated handle
      expect(first.handle).toBeDefined();
      expect(first.handle.resourceType).toBeDefined();
    }, 30000);

    it('should work with empty results', async () => {
      const recalled = await searchManager.recallHandles('xyz123nonexistent query', {
        limit: 5,
        threshold: 0.95
      });

      expect(Array.isArray(recalled)).toBe(true);
      expect(recalled.length).toBe(0);
    }, 30000);
  });

  describe('Practical use case: Find and use a database handle', () => {
    it('should recall database handle and query it', async () => {
      // Recall handles matching "users"
      const recalled = await searchManager.recallHandles('users database', { limit: 1 });

      expect(recalled.length).toBeGreaterThan(0);

      const { handle, handleURI, similarity } = recalled[0];

      // We found a relevant handle
      expect(handleURI).toContain('users');
      expect(similarity).toBeGreaterThan(0.5);

      // The handle is ready to use
      expect(handle.resourceType).toBe('mongodb');
      expect(handle.database).toBeDefined();
      expect(handle.collection).toBeDefined();

      // We could now use this handle for queries
      // Example: await handle.findOne({ username: 'test' });
      // But we won't actually query in this test
    }, 30000);
  });
});