import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { 
  InMemoryTripleStore, 
  FileSystemTripleStore, 
  StorageConfig,
  withCache,
  withOptimization
} from '../../src/storage/index.js';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

/**
 * Cross-provider compatibility tests
 * Ensures all storage providers implement ITripleStore correctly
 */
describe('Cross-Provider Compatibility Tests', () => {
  let testProviders = [];
  let tempFiles = [];

  beforeEach(async () => {
    // Create test providers
    testProviders = [
      {
        name: 'InMemoryTripleStore',
        store: new InMemoryTripleStore(),
        cleanup: async () => {}
      },
      {
        name: 'FileSystemTripleStore',
        store: await createTempFileStore(),
        cleanup: async () => {
          for (const file of tempFiles) {
            try {
              await fs.unlink(file);
            } catch (error) {
              // Ignore cleanup errors
            }
          }
          tempFiles = [];
        }
      }
    ];
  });

  afterEach(async () => {
    // Cleanup all providers
    for (const provider of testProviders) {
      try {
        await provider.cleanup();
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    testProviders = [];
  });

  // Helper function to create temporary file store
  async function createTempFileStore() {
    const tempFile = join(tmpdir(), `kg-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.json`);
    tempFiles.push(tempFile);
    return new FileSystemTripleStore(tempFile, { format: 'json' });
  }

  describe('Basic Operations', () => {
    test('should add and retrieve triples consistently', async () => {
      for (const provider of testProviders) {
        const { name, store } = provider;
        
        // Add a triple
        const added = await store.addTriple('subject1', 'predicate1', 'object1');
        expect(added).toBe(true);
        
        // Query the triple
        const results = await store.query('subject1', 'predicate1', 'object1');
        expect(results).toHaveLength(1);
        expect(results[0]).toEqual(['subject1', 'predicate1', 'object1']);
        
        // Check existence
        const exists = await store.exists('subject1', 'predicate1', 'object1');
        expect(exists).toBe(true);
        
        // Check size
        const size = await store.size();
        expect(size).toBe(1);
      }
    });

    test('should handle different data types consistently', async () => {
      const testData = [
        ['subject1', 'predicate1', 'string_value'],
        ['subject2', 'predicate2', 42],
        ['subject3', 'predicate3', true],
        ['subject4', 'predicate4', null],
        ['subject5', 'predicate5', { nested: 'object' }],
        ['subject6', 'predicate6', [1, 2, 3]]
      ];

      for (const provider of testProviders) {
        const { name, store } = provider;
        
        // Add all test data
        for (const [s, p, o] of testData) {
          await store.addTriple(s, p, o);
        }
        
        // Verify all data
        for (const [s, p, o] of testData) {
          const results = await store.query(s, p, o);
          expect(results).toHaveLength(1);
          expect(results[0]).toEqual([s, p, o]);
        }
        
        // Clear for next provider
        await store.clear();
      }
    });

    test('should remove triples consistently', async () => {
      for (const provider of testProviders) {
        const { name, store } = provider;
        
        // Add triples
        await store.addTriple('subject1', 'predicate1', 'object1');
        await store.addTriple('subject2', 'predicate2', 'object2');
        
        // Remove one triple
        const removed = await store.removeTriple('subject1', 'predicate1', 'object1');
        expect(removed).toBe(true);
        
        // Verify removal
        const exists = await store.exists('subject1', 'predicate1', 'object1');
        expect(exists).toBe(false);
        
        // Verify other triple still exists
        const stillExists = await store.exists('subject2', 'predicate2', 'object2');
        expect(stillExists).toBe(true);
        
        // Check size
        const size = await store.size();
        expect(size).toBe(1);
      }
    });
  });

  describe('Query Patterns', () => {
    beforeEach(async () => {
      // Add test data to all providers
      const testTriples = [
        ['Person1', 'name', 'Alice'],
        ['Person1', 'age', 30],
        ['Person1', 'type', 'Person'],
        ['Person2', 'name', 'Bob'],
        ['Person2', 'age', 25],
        ['Person2', 'type', 'Person'],
        ['Company1', 'name', 'TechCorp'],
        ['Company1', 'type', 'Company']
      ];

      for (const provider of testProviders) {
        for (const [s, p, o] of testTriples) {
          await provider.store.addTriple(s, p, o);
        }
      }
    });

    test('should handle all query patterns consistently', async () => {
      const queryPatterns = [
        // Exact match
        { pattern: ['Person1', 'name', 'Alice'], expectedCount: 1 },
        // Subject + predicate
        { pattern: ['Person1', 'name', null], expectedCount: 1 },
        // Subject + object
        { pattern: ['Person1', null, 'Alice'], expectedCount: 1 },
        // Predicate + object
        { pattern: [null, 'name', 'Alice'], expectedCount: 1 },
        // Subject only
        { pattern: ['Person1', null, null], expectedCount: 3 },
        // Predicate only
        { pattern: [null, 'type', null], expectedCount: 3 },
        // Object only
        { pattern: [null, null, 'Person'], expectedCount: 2 },
        // All triples
        { pattern: [null, null, null], expectedCount: 8 }
      ];

      for (const provider of testProviders) {
        const { name, store } = provider;
        
        for (const { pattern, expectedCount } of queryPatterns) {
          const [s, p, o] = pattern;
          const results = await store.query(s, p, o);
          expect(results).toHaveLength(expectedCount);
        }
      }
    });
  });

  describe('Batch Operations', () => {
    test('should handle batch add operations consistently', async () => {
      const batchTriples = [
        ['batch1', 'prop1', 'value1'],
        ['batch2', 'prop2', 'value2'],
        ['batch3', 'prop3', 'value3'],
        ['batch4', 'prop4', 'value4'],
        ['batch5', 'prop5', 'value5']
      ];

      for (const provider of testProviders) {
        const { name, store } = provider;
        
        // Add batch
        const added = await store.addTriples(batchTriples);
        expect(added).toBe(5);
        
        // Verify all added
        const size = await store.size();
        expect(size).toBe(5);
        
        // Verify individual triples
        for (const [s, p, o] of batchTriples) {
          const exists = await store.exists(s, p, o);
          expect(exists).toBe(true);
        }
        
        // Clear for next provider
        await store.clear();
      }
    });

    test('should handle batch remove operations consistently', async () => {
      const testTriples = [
        ['remove1', 'prop1', 'value1'],
        ['remove2', 'prop2', 'value2'],
        ['remove3', 'prop3', 'value3'],
        ['keep1', 'prop4', 'value4'],
        ['keep2', 'prop5', 'value5']
      ];

      const toRemove = testTriples.slice(0, 3);
      const toKeep = testTriples.slice(3);

      for (const provider of testProviders) {
        const { name, store } = provider;
        
        // Add all triples
        await store.addTriples(testTriples);
        
        // Remove batch
        const removed = await store.removeTriples(toRemove);
        expect(removed).toBe(3);
        
        // Verify removals
        for (const [s, p, o] of toRemove) {
          const exists = await store.exists(s, p, o);
          expect(exists).toBe(false);
        }
        
        // Verify kept triples
        for (const [s, p, o] of toKeep) {
          const exists = await store.exists(s, p, o);
          expect(exists).toBe(true);
        }
        
        // Check final size
        const size = await store.size();
        expect(size).toBe(2);
        
        // Clear for next provider
        await store.clear();
      }
    });
  });

  describe('Error Handling', () => {
    test('should handle duplicate additions consistently', async () => {
      for (const provider of testProviders) {
        const { name, store } = provider;
        
        // Add triple
        const added1 = await store.addTriple('dup', 'test', 'value');
        expect(added1).toBe(true);
        
        // Try to add same triple again
        const added2 = await store.addTriple('dup', 'test', 'value');
        expect(added2).toBe(false);
        
        // Size should still be 1
        const size = await store.size();
        expect(size).toBe(1);
      }
    });

    test('should handle removal of non-existent triples consistently', async () => {
      for (const provider of testProviders) {
        const { name, store } = provider;
        
        // Try to remove non-existent triple
        const removed = await store.removeTriple('nonexistent', 'test', 'value');
        expect(removed).toBe(false);
        
        // Size should be 0
        const size = await store.size();
        expect(size).toBe(0);
      }
    });
  });

  describe('Metadata Consistency', () => {
    test('should provide consistent metadata', async () => {
      for (const provider of testProviders) {
        const { name, store } = provider;
        
        const metadata = store.getMetadata();
        
        // All providers should have these properties
        expect(metadata).toHaveProperty('type');
        expect(metadata).toHaveProperty('supportsTransactions');
        expect(metadata).toHaveProperty('supportsPersistence');
        expect(metadata).toHaveProperty('supportsAsync');
        expect(metadata).toHaveProperty('maxTriples');
        
        // Type should be a string
        expect(typeof metadata.type).toBe('string');
        
        // Boolean properties should be boolean
        expect(typeof metadata.supportsTransactions).toBe('boolean');
        expect(typeof metadata.supportsPersistence).toBe('boolean');
        expect(typeof metadata.supportsAsync).toBe('boolean');
        
        // maxTriples should be a number
        expect(typeof metadata.maxTriples).toBe('number');
      }
    });
  });

  describe('Performance Optimization Compatibility', () => {
    test('should work with caching layer', async () => {
      for (const provider of testProviders) {
        const { name, store } = provider;
        
        // Wrap with caching
        const cachedStore = withCache(store, { 
          cacheSize: 100, 
          ttl: 60000 
        });
        
        // Add data
        await cachedStore.addTriple('cached', 'test', 'value');
        
        // Query multiple times (should hit cache)
        const result1 = await cachedStore.query('cached', 'test', 'value');
        const result2 = await cachedStore.query('cached', 'test', 'value');
        
        expect(result1).toEqual(result2);
        expect(result1).toHaveLength(1);
        
        // Check cache stats
        const metadata = cachedStore.getMetadata();
        expect(metadata.cached).toBe(true);
        expect(metadata.cacheEnabled).toBe(true);
      }
    });

    test('should work with query optimization', async () => {
      for (const provider of testProviders) {
        const { name, store } = provider;
        
        // Wrap with optimization
        const optimizedStore = withOptimization(store, {
          enabled: true,
          enableStatistics: true
        });
        
        // Add data
        await optimizedStore.addTriple('optimized', 'test', 'value');
        
        // Query
        const result = await optimizedStore.query('optimized', 'test', 'value');
        expect(result).toHaveLength(1);
        
        // Check optimizer stats
        const metadata = optimizedStore.getMetadata();
        expect(metadata.optimized).toBe(true);
        expect(metadata.optimizerEnabled).toBe(true);
      }
    });
  });

  describe('Configuration Factory', () => {
    test('should create providers through StorageConfig', async () => {
      // Test memory storage
      const memoryStore = StorageConfig.createStore({ type: 'memory' });
      expect(memoryStore.getMetadata().type).toBe('memory');
      
      // Test file storage
      const tempFile = join(tmpdir(), `config-test-${Date.now()}.json`);
      tempFiles.push(tempFile);
      
      const fileStore = StorageConfig.createStore({
        type: 'file',
        path: tempFile,
        format: 'json'
      });
      expect(fileStore.getMetadata().type).toBe('file');
      
      // Test both work the same way
      await memoryStore.addTriple('test', 'config', 'memory');
      await fileStore.addTriple('test', 'config', 'file');
      
      const memoryResult = await memoryStore.query('test', 'config', 'memory');
      const fileResult = await fileStore.query('test', 'config', 'file');
      
      expect(memoryResult).toHaveLength(1);
      expect(fileResult).toHaveLength(1);
    });
  });
});
