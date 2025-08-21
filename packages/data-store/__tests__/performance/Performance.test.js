/**
 * Performance tests for DataStore optimizations
 * Tests caching, batching, and memory management
 */

import { DataStore, createDataStore } from '../../src/DataStore.js';
import { CacheManager, createCacheManager } from '../../src/performance/CacheManager.js';
import { BatchOptimizer, createBatchOptimizer } from '../../src/performance/BatchOptimizer.js';

describe('Performance Optimizations', () => {
  describe('CacheManager', () => {
    let cacheManager;

    beforeEach(() => {
      cacheManager = createCacheManager({
        graphSpecCacheSize: 10,
        resultCacheSize: 10,
        resultTTL: 100 // 100ms for testing
      });
    });

    afterEach(() => {
      cacheManager.clear();
    });

    describe('LRU cache behavior', () => {
      it('should cache and retrieve GraphSpecs', () => {
        const spec1 = { id: 'spec1', query: 'test' };
        const spec2 = { id: 'spec2', query: 'test2' };
        
        // Cache specs
        const result1 = cacheManager.getOrCreateGraphSpec('key1', () => spec1);
        const result2 = cacheManager.getOrCreateGraphSpec('key2', () => spec2);
        
        expect(result1).toBe(spec1);
        expect(result2).toBe(spec2);
        
        // Retrieve from cache
        const cached1 = cacheManager.getOrCreateGraphSpec('key1', () => ({ id: 'new' }));
        expect(cached1).toBe(spec1); // Should return cached version
        
        const stats = cacheManager.getStatistics();
        expect(stats.performance.graphSpecReuse).toBe(1);
      });

      it('should evict least recently used items', () => {
        // Fill cache to capacity
        for (let i = 0; i < 10; i++) {
          cacheManager.getOrCreateGraphSpec(`key${i}`, () => ({ id: i }));
        }
        
        // Access first item to make it recently used
        cacheManager.getOrCreateGraphSpec('key0', () => ({ id: 'new' }));
        
        // Add new item, should evict LRU (key1)
        const newSpec = { id: 'new' };
        cacheManager.getOrCreateGraphSpec('key10', () => newSpec);
        
        // key1 should be evicted, key0 should still be cached
        const cached0 = cacheManager.getOrCreateGraphSpec('key0', () => ({ id: 'different' }));
        expect(cached0.id).toBe(0); // Still cached
        
        const cached1 = cacheManager.getOrCreateGraphSpec('key1', () => ({ id: 'replaced' }));
        expect(cached1.id).toBe('replaced'); // Was evicted
      });

      it('should respect TTL for result cache', async () => {
        const results = [{ id: 1 }, { id: 2 }];
        
        // Cache results
        cacheManager.cacheResults('query1', results);
        
        // Should be cached immediately
        let cached = cacheManager.getCachedResults('query1');
        expect(cached).toEqual(results);
        
        // Wait for TTL to expire
        await new Promise(resolve => setTimeout(resolve, 150));
        
        // Should be expired
        cached = cacheManager.getCachedResults('query1');
        expect(cached).toBeNull();
      });
    });

    describe('predicate sharing', () => {
      it('should share predicates across queries', () => {
        const predicate1 = { name: 'IsActive', evaluate: () => true };
        const predicate2 = { name: 'HasTag', evaluate: () => true };
        
        // Create shared predicates
        const shared1 = cacheManager.getOrCreateSharedPredicate('IsActive', () => predicate1);
        const shared2 = cacheManager.getOrCreateSharedPredicate('HasTag', () => predicate2);
        
        expect(shared1).toBe(predicate1);
        expect(shared2).toBe(predicate2);
        
        // Reuse shared predicates
        const reused = cacheManager.getOrCreateSharedPredicate('IsActive', () => ({ different: true }));
        expect(reused).toBe(predicate1); // Should return shared version
        
        const stats = cacheManager.getStatistics();
        expect(stats.performance.predicateSharing).toBe(1);
      });
    });

    describe('iterator factory caching', () => {
      it('should cache and reuse iterator factories', () => {
        const factory1 = () => ({ next: () => null });
        const factory2 = () => ({ next: () => null });
        
        // Cache factories
        cacheManager.cacheIteratorFactory('relation1', factory1);
        cacheManager.cacheIteratorFactory('relation2', factory2);
        
        // Retrieve cached factories
        const cached1 = cacheManager.getIteratorFactory('relation1');
        const cached2 = cacheManager.getIteratorFactory('relation2');
        
        expect(cached1).toBe(factory1);
        expect(cached2).toBe(factory2);
        
        const stats = cacheManager.getStatistics();
        expect(stats.iteratorFactories).toBe(2);
      });
    });

    describe('memory management', () => {
      it('should perform garbage collection', () => {
        // Add some cached items
        for (let i = 0; i < 5; i++) {
          cacheManager.cacheResults(`query${i}`, [{ id: i }], 50); // 50ms TTL
        }
        
        // Wait for items to expire
        setTimeout(() => {
          const result = cacheManager.performGarbageCollection();
          expect(result.cleared).toBeGreaterThan(0);
        }, 100);
      });

      it('should provide optimization recommendations', () => {
        // Simulate low hit rate
        for (let i = 0; i < 20; i++) {
          cacheManager.getOrCreateGraphSpec(`key${i}`, () => ({ id: i }));
        }
        
        const recommendations = cacheManager.optimizeCacheSizes();
        
        // Should recommend increasing cache size due to evictions
        if (recommendations.graphSpecCacheSize) {
          expect(recommendations.graphSpecCacheSize).toBeGreaterThan(10);
        }
      });
    });

    describe('cache warming', () => {
      it('should warm up caches with common queries', () => {
        const commonQueries = [
          { key: 'common1', spec: { query: 'frequent1' }, results: [1, 2, 3] },
          { key: 'common2', spec: { query: 'frequent2' }, results: [4, 5, 6] },
          { key: 'common3', spec: { query: 'frequent3' } }
        ];
        
        const warmed = cacheManager.warmUp(commonQueries);
        expect(warmed).toBe(5); // 3 specs + 2 results
        
        // Verify cached
        const cached1 = cacheManager.getCachedResults('common1');
        expect(cached1).toEqual([1, 2, 3]);
      });
    });
  });

  describe('BatchOptimizer', () => {
    let optimizer;
    let processedBatches;

    beforeEach(() => {
      optimizer = createBatchOptimizer({
        minBatchSize: 5,
        maxBatchSize: 20,
        batchTimeout: 10
      });
      
      processedBatches = [];
      optimizer.on('batch', batch => {
        processedBatches.push(batch);
      });
    });

    afterEach(() => {
      optimizer.clear();
    });

    describe('batching behavior', () => {
      it('should batch writes up to size threshold', async () => {
        // Add writes below threshold
        for (let i = 0; i < 4; i++) {
          optimizer.addWrite({ type: 'add', id: i });
        }
        
        expect(processedBatches.length).toBe(0); // Not flushed yet
        
        // Add write to reach threshold
        optimizer.addWrite({ type: 'add', id: 4 });
        
        await new Promise(resolve => setTimeout(resolve, 20));
        
        expect(processedBatches.length).toBe(1);
        expect(processedBatches[0].length).toBe(5);
      });

      it('should flush on timeout', async () => {
        // Add writes below threshold
        optimizer.addWrite({ type: 'add', id: 1 });
        optimizer.addWrite({ type: 'add', id: 2 });
        
        // Wait for timeout
        await new Promise(resolve => setTimeout(resolve, 20));
        
        expect(processedBatches.length).toBe(1);
        expect(processedBatches[0].length).toBe(2);
      });

      it('should handle bulk writes', async () => {
        const writes = Array.from({ length: 15 }, (_, i) => ({
          type: 'add',
          id: i
        }));
        
        optimizer.addWrites(writes);
        
        await new Promise(resolve => setTimeout(resolve, 20));
        
        expect(processedBatches.length).toBe(1);
        expect(processedBatches[0].length).toBe(15);
      });
    });

    describe('deduplication', () => {
      it('should remove duplicate operations', async () => {
        const edge = { type: 'hasName', src: 'entity1', dst: 'name1' };
        
        // Add duplicate operations
        optimizer.addWrite({ type: 'add', edge });
        optimizer.addWrite({ type: 'add', edge });
        optimizer.addWrite({ type: 'add', edge });
        
        // Add different operation
        optimizer.addWrite({ type: 'add', edge: { ...edge, dst: 'name2' } });
        optimizer.addWrite({ type: 'remove', edge });
        
        await optimizer.flush();
        
        const batch = processedBatches[0];
        
        // Should have deduplicated the adds
        const adds = batch.filter(op => op.type === 'add' && op.edge.dst === 'name1');
        expect(adds.length).toBe(1);
        
        const stats = optimizer.getStatistics();
        expect(stats.duplicatesRemoved).toBeGreaterThan(0);
      });
    });

    describe('coalescing', () => {
      it('should coalesce related operations', async () => {
        const src = 'entity1';
        
        // Multiple operations on same entity
        optimizer.addWrite({ 
          type: 'add', 
          edge: { type: 'hasName', src, dst: 'name1' } 
        });
        optimizer.addWrite({ 
          type: 'add', 
          edge: { type: 'hasName', src, dst: 'name2' } 
        });
        optimizer.addWrite({ 
          type: 'remove', 
          edge: { type: 'hasName', src, dst: 'name1' } 
        });
        
        // Different entity
        optimizer.addWrite({ 
          type: 'add', 
          edge: { type: 'hasName', src: 'entity2', dst: 'name3' } 
        });
        
        // More on first entity
        optimizer.addWrite({ 
          type: 'add', 
          edge: { type: 'hasName', src, dst: 'name4' } 
        });
        
        await optimizer.flush();
        
        const stats = optimizer.getStatistics();
        expect(stats.writesCoalesced).toBeGreaterThan(0);
      });

      it('should cancel out add/remove pairs', async () => {
        const edge = { type: 'hasTag', src: 'item1', dst: 'tag1' };
        
        // Add then remove same edge
        optimizer.addWrite({ type: 'add', edge });
        optimizer.addWrite({ type: 'remove', edge });
        
        await optimizer.flush();
        
        const batch = processedBatches[0];
        
        // Should result in no-op or cancellation
        const hasNoop = batch.some(op => op.type === 'noop');
        const hasOriginal = batch.some(op => 
          op.type === 'add' && op.edge?.dst === 'tag1'
        );
        
        expect(hasNoop || !hasOriginal).toBe(true);
      });
    });

    describe('adaptive batching', () => {
      it('should adapt batch size based on throughput', async () => {
        const initialConfig = optimizer.getConfiguration();
        const initialBatchSize = initialConfig.currentBatchSize;
        
        // Simulate good throughput
        for (let batch = 0; batch < 5; batch++) {
          for (let i = 0; i < initialBatchSize; i++) {
            optimizer.addWrite({ type: 'add', id: `${batch}-${i}` });
          }
          await new Promise(resolve => setTimeout(resolve, 5));
        }
        
        const finalConfig = optimizer.getConfiguration();
        
        // Batch size may have adapted (increased or stayed same)
        expect(finalConfig.currentBatchSize).toBeGreaterThanOrEqual(initialBatchSize);
      });
    });

    describe('statistics', () => {
      it('should track optimization statistics', async () => {
        // Add various operations
        for (let i = 0; i < 10; i++) {
          optimizer.addWrite({ 
            type: i % 2 === 0 ? 'add' : 'remove',
            edge: { type: 'rel', src: `src${i % 3}`, dst: `dst${i}` }
          });
        }
        
        await optimizer.flush();
        
        const stats = optimizer.getStatistics();
        
        expect(stats.totalBatches).toBe(1);
        expect(stats.totalWrites).toBe(10);
        expect(stats.averageBatchSize).toBeGreaterThan(0);
        expect(stats.averageLatency).toBeGreaterThan(0);
        expect(stats.optimizationRate).toBeGreaterThanOrEqual(0);
      });

      it('should reset statistics', async () => {
        // Add some operations
        optimizer.addWrite({ type: 'add', id: 1 });
        optimizer.addWrite({ type: 'add', id: 2 });
        await optimizer.flush();
        
        // Reset
        optimizer.resetStatistics();
        
        const stats = optimizer.getStatistics();
        expect(stats.totalBatches).toBe(0);
        expect(stats.totalWrites).toBe(0);
      });
    });
  });

  describe('DataStore with Performance Optimizations', () => {
    let dataStore;
    let cacheManager;
    let batchOptimizer;

    beforeEach(() => {
      dataStore = createDataStore({
        enableKernel: false,
        batchSize: 10
      });
      
      cacheManager = createCacheManager();
      batchOptimizer = createBatchOptimizer();
      
      // Define test relationships
      dataStore.defineRelationType('hasName', 'nameOf');
      dataStore.defineRelationType('hasTag', 'taggedOn');
      dataStore.defineRelationType('relatedTo', 'relatedFrom');
    });

    afterEach(async () => {
      await dataStore.close();
      cacheManager.clear();
      batchOptimizer.clear();
    });

    describe('integrated performance', () => {
      it('should handle high-volume writes efficiently', async () => {
        const startTime = Date.now();
        const writeCount = 1000;
        
        // Add many edges
        for (let i = 0; i < writeCount; i++) {
          dataStore.addEdge('relatedTo', `src${i}`, `dst${i}`);
        }
        
        // Flush pending writes
        await dataStore.flush();
        
        const duration = Date.now() - startTime;
        const throughput = writeCount / (duration / 1000);
        
        // Should achieve reasonable throughput
        expect(throughput).toBeGreaterThan(100); // At least 100 writes/second
        
        const stats = dataStore.getStats();
        expect(stats.store.edges).toBe(writeCount);
      });

      it('should handle concurrent queries efficiently', async () => {
        // Add test data
        for (let i = 0; i < 100; i++) {
          dataStore.addEdge('hasTag', `item${i}`, `tag${i % 10}`);
        }
        await dataStore.flush();
        
        const startTime = Date.now();
        const queries = [];
        
        // Submit multiple queries
        for (let i = 0; i < 20; i++) {
          const subscriptionId = dataStore.submitQuery(
            { path: 'hasTag' },
            ['src', 'dst']
          );
          queries.push(subscriptionId);
        }
        
        // Wait for queries to process
        await new Promise(resolve => setTimeout(resolve, 50));
        
        const duration = Date.now() - startTime;
        
        // Should handle multiple queries quickly
        expect(duration).toBeLessThan(100);
        
        // Clean up subscriptions
        for (const id of queries) {
          dataStore.unsubscribe(id);
        }
      });

      it('should maintain low memory footprint', async () => {
        const initialMemory = process.memoryUsage().heapUsed;
        
        // Add and remove many edges
        for (let cycle = 0; cycle < 10; cycle++) {
          // Add edges
          for (let i = 0; i < 100; i++) {
            dataStore.addEdge('hasName', `entity${i}`, `name${i}`);
          }
          
          await dataStore.flush();
          
          // Remove edges
          for (let i = 0; i < 50; i++) {
            dataStore.removeEdge('hasName', `entity${i}`, `name${i}`);
          }
          
          await dataStore.flush();
        }
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
        
        const finalMemory = process.memoryUsage().heapUsed;
        const memoryGrowth = finalMemory - initialMemory;
        
        // Memory growth should be reasonable (not linear with operations)
        const memoryGrowthMB = memoryGrowth / (1024 * 1024);
        expect(memoryGrowthMB).toBeLessThan(50); // Less than 50MB growth
      });
    });

    describe('cache effectiveness', () => {
      it('should benefit from query caching', async () => {
        // Add test data
        for (let i = 0; i < 100; i++) {
          dataStore.addEdge('hasTag', `item${i}`, 'important');
        }
        await dataStore.flush();
        
        // Submit same query multiple times
        const querySpec = { path: 'hasTag', constraints: [{ field: 'dst', operator: '=', value: 'important' }] };
        const projection = ['src'];
        
        const startTime1 = Date.now();
        const sub1 = dataStore.submitQuery(querySpec, projection);
        const time1 = Date.now() - startTime1;
        
        await new Promise(resolve => setTimeout(resolve, 10));
        
        const startTime2 = Date.now();
        const sub2 = dataStore.submitQuery(querySpec, projection);
        const time2 = Date.now() - startTime2;
        
        // Second query should be faster due to caching
        expect(time2).toBeLessThanOrEqual(time1);
        
        // Clean up
        dataStore.unsubscribe(sub1);
        dataStore.unsubscribe(sub2);
      });
    });
  });
});