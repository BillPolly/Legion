/**
 * Memory validation tests for DataStore
 * Ensures proper cleanup and no memory leaks
 */

import { DataStore, createDataStore } from '../../src/DataStore.js';
import { CacheManager } from '../../src/performance/CacheManager.js';
import { BatchOptimizer } from '../../src/performance/BatchOptimizer.js';

describe('Memory Validation', () => {
  /**
   * Helper to measure memory usage
   */
  function getMemoryUsageMB() {
    const usage = process.memoryUsage();
    return {
      heap: usage.heapUsed / (1024 * 1024),
      external: usage.external / (1024 * 1024),
      total: (usage.heapUsed + usage.external) / (1024 * 1024)
    };
  }

  /**
   * Force garbage collection if available
   */
  function forceGC() {
    if (global.gc) {
      global.gc();
      global.gc(); // Call twice to be thorough
    }
  }

  describe('DataStore memory management', () => {
    it('should release memory after closing', async () => {
      forceGC();
      const initialMemory = getMemoryUsageMB();
      
      // Create and populate DataStore
      const dataStore = createDataStore();
      dataStore.defineRelationType('test', 'testInv');
      
      // Add substantial data
      for (let i = 0; i < 1000; i++) {
        dataStore.addEdge('test', `src${i}`, `dst${i}`);
      }
      await dataStore.flush();
      
      const loadedMemory = getMemoryUsageMB();
      const memoryUsed = loadedMemory.heap - initialMemory.heap;
      expect(memoryUsed).toBeGreaterThan(0); // Should use some memory
      
      // Close and cleanup
      await dataStore.close();
      forceGC();
      
      const finalMemory = getMemoryUsageMB();
      const memoryAfterClose = finalMemory.heap - initialMemory.heap;
      
      // Memory should be mostly released (allow 5MB tolerance)
      expect(memoryAfterClose).toBeLessThan(5);
    });

    it('should clean up subscriptions properly', async () => {
      const dataStore = createDataStore();
      dataStore.defineRelationType('rel', 'relInv');
      
      // Add test data
      for (let i = 0; i < 100; i++) {
        dataStore.addEdge('rel', `a${i}`, `b${i}`);
      }
      await dataStore.flush();
      
      forceGC();
      const beforeSubscriptions = getMemoryUsageMB();
      
      // Create many subscriptions
      const subscriptions = [];
      for (let i = 0; i < 100; i++) {
        const subId = dataStore.submitQuery(
          { path: 'rel' },
          ['src', 'dst']
        );
        subscriptions.push(subId);
      }
      
      const withSubscriptions = getMemoryUsageMB();
      const subscriptionMemory = withSubscriptions.heap - beforeSubscriptions.heap;
      expect(subscriptionMemory).toBeGreaterThan(0);
      
      // Unsubscribe all
      for (const subId of subscriptions) {
        dataStore.unsubscribe(subId);
      }
      
      forceGC();
      const afterUnsubscribe = getMemoryUsageMB();
      const memoryRecovered = withSubscriptions.heap - afterUnsubscribe.heap;
      
      // Should recover most of the subscription memory
      expect(memoryRecovered).toBeGreaterThan(subscriptionMemory * 0.5);
      
      await dataStore.close();
    });

    it('should handle edge removal memory cleanup', async () => {
      const dataStore = createDataStore();
      dataStore.defineRelationType('temp', 'tempInv');
      
      forceGC();
      const initialMemory = getMemoryUsageMB();
      
      // Add many edges
      for (let i = 0; i < 1000; i++) {
        dataStore.addEdge('temp', `x${i}`, `y${i}`);
      }
      await dataStore.flush();
      
      const afterAdd = getMemoryUsageMB();
      const addedMemory = afterAdd.heap - initialMemory.heap;
      
      // Remove all edges
      for (let i = 0; i < 1000; i++) {
        dataStore.removeEdge('temp', `x${i}`, `y${i}`);
      }
      await dataStore.flush();
      
      forceGC();
      const afterRemove = getMemoryUsageMB();
      const finalMemory = afterRemove.heap - initialMemory.heap;
      
      // Should release most memory after removing edges
      expect(finalMemory).toBeLessThan(addedMemory * 0.3);
      
      await dataStore.close();
    });
  });

  describe('CacheManager memory management', () => {
    it('should respect cache size limits', () => {
      const cacheManager = new CacheManager({
        graphSpecCacheSize: 10,
        resultCacheSize: 10
      });
      
      forceGC();
      const initialMemory = getMemoryUsageMB();
      
      // Add many items (more than cache size)
      for (let i = 0; i < 100; i++) {
        cacheManager.getOrCreateGraphSpec(`spec${i}`, () => ({
          id: i,
          largeData: new Array(1000).fill(`data${i}`)
        }));
        
        cacheManager.cacheResults(`query${i}`, 
          new Array(100).fill({ id: i })
        );
      }
      
      const afterFilling = getMemoryUsageMB();
      const memoryUsed = afterFilling.heap - initialMemory.heap;
      
      // Memory usage should be bounded by cache limits
      // (10 specs + 10 results) * estimated size per item
      expect(memoryUsed).toBeLessThan(20); // Less than 20MB for limited caches
      
      // Verify cache sizes are respected
      const stats = cacheManager.getStatistics();
      expect(stats.graphSpecCache.size).toBeLessThanOrEqual(10);
      expect(stats.resultCache.size).toBeLessThanOrEqual(10);
      
      cacheManager.clear();
    });

    it('should clean up expired entries', async () => {
      const cacheManager = new CacheManager({
        resultTTL: 50, // 50ms TTL
        predicateTTL: 50
      });
      
      // Add items with TTL
      for (let i = 0; i < 50; i++) {
        cacheManager.cacheResults(`result${i}`, [{ id: i }]);
      }
      
      forceGC();
      const beforeExpiry = getMemoryUsageMB();
      
      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Perform garbage collection
      const gcResult = cacheManager.performGarbageCollection();
      
      forceGC();
      const afterGC = getMemoryUsageMB();
      
      // Should have cleared expired items
      expect(gcResult.cleared).toBeGreaterThan(0);
      expect(afterGC.heap).toBeLessThanOrEqual(beforeExpiry.heap);
      
      cacheManager.clear();
    });
  });

  describe('BatchOptimizer memory management', () => {
    it('should not accumulate memory with continuous batching', async () => {
      const optimizer = new BatchOptimizer({
        minBatchSize: 10,
        maxBatchSize: 100
      });
      
      let totalProcessed = 0;
      optimizer.on('batch', batch => {
        totalProcessed += batch.length;
      });
      
      forceGC();
      const initialMemory = getMemoryUsageMB();
      
      // Process many batches
      for (let batch = 0; batch < 100; batch++) {
        for (let i = 0; i < 50; i++) {
          optimizer.addWrite({
            type: 'add',
            edge: { type: 'rel', src: `s${i}`, dst: `d${i}` }
          });
        }
        await optimizer.flush();
        
        // Memory should not grow unbounded
        if (batch % 10 === 0) {
          forceGC();
          const currentMemory = getMemoryUsageMB();
          const memoryGrowth = currentMemory.heap - initialMemory.heap;
          
          // Should not grow more than 10MB even after many batches
          expect(memoryGrowth).toBeLessThan(10);
        }
      }
      
      expect(totalProcessed).toBeGreaterThan(0);
      
      optimizer.clear();
    });

    it('should clear pending writes on clear()', () => {
      const optimizer = new BatchOptimizer();
      
      // Add many pending writes
      for (let i = 0; i < 1000; i++) {
        optimizer.addWrite({
          type: 'add',
          largeData: new Array(100).fill(`data${i}`)
        });
      }
      
      const stats = optimizer.getStatistics();
      expect(stats.pendingWrites).toBe(1000);
      
      forceGC();
      const beforeClear = getMemoryUsageMB();
      
      // Clear pending writes
      optimizer.clear();
      
      forceGC();
      const afterClear = getMemoryUsageMB();
      
      // Should release memory
      expect(afterClear.heap).toBeLessThan(beforeClear.heap);
      
      const clearedStats = optimizer.getStatistics();
      expect(clearedStats.pendingWrites).toBe(0);
    });
  });

  describe('Integration memory tests', () => {
    it('should handle sustained load without memory leaks', async () => {
      const dataStore = createDataStore({ batchSize: 50 });
      const cacheManager = new CacheManager();
      const optimizer = new BatchOptimizer();
      
      // Define relationships
      dataStore.defineRelationType('follows', 'followedBy');
      dataStore.defineRelationType('likes', 'likedBy');
      
      forceGC();
      const initialMemory = getMemoryUsageMB();
      const memorySnapshots = [];
      
      // Run sustained operations
      for (let cycle = 0; cycle < 20; cycle++) {
        // Add edges
        for (let i = 0; i < 100; i++) {
          dataStore.addEdge('follows', `user${i}`, `user${(i + 1) % 100}`);
          dataStore.addEdge('likes', `user${i}`, `post${i}`);
        }
        
        // Create subscriptions
        const subs = [];
        for (let i = 0; i < 5; i++) {
          const subId = dataStore.submitQuery(
            { path: cycle % 2 === 0 ? 'follows' : 'likes' },
            ['src', 'dst']
          );
          subs.push(subId);
        }
        
        await dataStore.flush();
        
        // Remove some edges
        for (let i = 0; i < 50; i++) {
          dataStore.removeEdge('follows', `user${i}`, `user${(i + 1) % 100}`);
        }
        
        await dataStore.flush();
        
        // Unsubscribe
        for (const subId of subs) {
          dataStore.unsubscribe(subId);
        }
        
        // Periodic GC and memory check
        if (cycle % 5 === 0) {
          cacheManager.performGarbageCollection();
          forceGC();
          
          const currentMemory = getMemoryUsageMB();
          memorySnapshots.push(currentMemory.heap - initialMemory.heap);
        }
      }
      
      // Check memory growth pattern
      expect(memorySnapshots.length).toBe(4);
      
      // Memory should stabilize, not grow linearly
      const firstSnapshot = memorySnapshots[0];
      const lastSnapshot = memorySnapshots[memorySnapshots.length - 1];
      const growth = lastSnapshot - firstSnapshot;
      
      // Growth should be minimal (less than 10MB over all cycles)
      expect(growth).toBeLessThan(10);
      
      // Cleanup
      await dataStore.close();
      cacheManager.clear();
      optimizer.clear();
      
      forceGC();
      const finalMemory = getMemoryUsageMB();
      const totalGrowth = finalMemory.heap - initialMemory.heap;
      
      // After cleanup, memory should be mostly recovered
      expect(totalGrowth).toBeLessThan(5);
    });

    it('should handle cache thrashing gracefully', async () => {
      const cacheManager = new CacheManager({
        graphSpecCacheSize: 5,
        resultCacheSize: 5
      });
      
      forceGC();
      const initialMemory = getMemoryUsageMB();
      
      // Cause cache thrashing by accessing many different items
      for (let round = 0; round < 100; round++) {
        for (let i = 0; i < 20; i++) {
          // This will cause constant eviction
          cacheManager.getOrCreateGraphSpec(`key${i}`, () => ({
            id: i,
            round: round,
            data: new Array(100).fill(i)
          }));
        }
      }
      
      forceGC();
      const afterThrashing = getMemoryUsageMB();
      const memoryUsed = afterThrashing.heap - initialMemory.heap;
      
      // Despite thrashing, memory should be bounded
      expect(memoryUsed).toBeLessThan(10);
      
      // Cache should still be at its size limit
      const stats = cacheManager.getStatistics();
      expect(stats.graphSpecCache.size).toBeLessThanOrEqual(5);
      
      cacheManager.clear();
    });
  });
});