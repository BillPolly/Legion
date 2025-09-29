/**
 * Performance tests for Handle caching and concurrent access
 * 
 * Tests the performance characteristics of the Handle/URI system under various
 * load conditions, including concurrent access, cache efficiency, memory usage,
 * and scaling behavior.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ResourceManager } from '../../src/ResourceManager.js';

describe('Handle Caching Performance Tests', () => {
  let resourceManager;

  beforeEach(async () => {
    // Clear singleton for each test
    ResourceManager._instance = null;
    ResourceManager._initPromise = null;
    
    // Get fresh ResourceManager instance
    resourceManager = await ResourceManager.getInstance();
  });

  afterEach(() => {
    // Clean up any handles and caches
    if (resourceManager && resourceManager.clearHandleCaches) {
      resourceManager.clearHandleCaches();
    }
    ResourceManager._instance = null;
    ResourceManager._initPromise = null;
  });

  describe('Concurrent Handle Creation Performance', () => {
    it('should handle concurrent creation of same Handle efficiently', async () => {
      const uri = 'legion://local/env/ANTHROPIC_API_KEY';
      const concurrencyLevel = 100;
      
      // Measure time for concurrent Handle creation
      const startTime = performance.now();
      
      const promises = Array(concurrencyLevel).fill(null).map(() => 
        resourceManager.createHandleFromURI(uri)
      );
      
      const handles = await Promise.all(promises);
      const endTime = performance.now();
      
      const executionTime = endTime - startTime;
      
      // Performance assertions
      expect(executionTime).toBeLessThan(1000); // Should complete within 1 second
      expect(handles).toHaveLength(concurrencyLevel);
      
      // All handles should be the same cached instance
      handles.forEach(handle => {
        expect(handle).toBe(handles[0]);
      });
      
      // Only one handle should be in cache
      expect(resourceManager._handleCache.size).toBe(1);
      
      console.log(`Concurrent creation of ${concurrencyLevel} handles took ${executionTime.toFixed(2)}ms`);
      
      // Clean up
      handles[0].destroy();
    });

    it('should handle concurrent creation of different Handles efficiently', async () => {
      const baseUri = 'legion://local/env/TEST_VAR_';
      const handleCount = 50;
      
      const startTime = performance.now();
      
      // Create different URIs concurrently
      const promises = Array(handleCount).fill(null).map((_, i) => 
        resourceManager.createHandleFromURI(`${baseUri}${i}`)
      );
      
      const handles = await Promise.all(promises);
      const endTime = performance.now();
      
      const executionTime = endTime - startTime;
      
      // Performance assertions
      expect(executionTime).toBeLessThan(2000); // Should complete within 2 seconds
      expect(handles).toHaveLength(handleCount);
      expect(resourceManager._handleCache.size).toBe(handleCount);
      
      // All handles should be different instances
      const uniqueHandles = new Set(handles);
      expect(uniqueHandles.size).toBe(handleCount);
      
      console.log(`Concurrent creation of ${handleCount} different handles took ${executionTime.toFixed(2)}ms`);
      
      // Clean up
      handles.forEach(handle => handle.destroy());
    });

    it('should demonstrate race condition prevention', async () => {
      const uri = 'legion://local/env/ANTHROPIC_API_KEY';
      const iterations = 10;
      
      // Run multiple rounds of concurrent creation
      for (let round = 0; round < iterations; round++) {
        // Clear cache between rounds
        resourceManager.clearHandleCaches();
        
        // Create multiple concurrent requests
        const promises = Array(20).fill(null).map(() => 
          resourceManager.createHandleFromURI(uri)
        );
        
        const handles = await Promise.all(promises);
        
        // All should be the same instance (no race conditions)
        handles.forEach(handle => {
          expect(handle).toBe(handles[0]);
        });
        
        // Clean up
        handles[0].destroy();
      }
      
      console.log(`Race condition test completed ${iterations} rounds successfully`);
    });
  });

  describe('Cache Efficiency Performance', () => {
    it('should demonstrate cache hit performance vs creation performance', async () => {
      const uri = 'legion://local/env/ANTHROPIC_API_KEY';
      const iterations = 1000;
      
      // First creation (cache miss)
      const firstStartTime = performance.now();
      const firstHandle = await resourceManager.createHandleFromURI(uri);
      const firstEndTime = performance.now();
      const firstCreationTime = firstEndTime - firstStartTime;
      
      // Subsequent accesses (cache hits)
      const cacheStartTime = performance.now();
      const cachePromises = Array(iterations).fill(null).map(() =>
        resourceManager.createHandleFromURI(uri)
      );
      await Promise.all(cachePromises);
      const cacheEndTime = performance.now();
      const totalCacheTime = cacheEndTime - cacheStartTime;
      const avgCacheTime = totalCacheTime / iterations;
      
      // Cache hits should be significantly faster
      expect(avgCacheTime).toBeLessThan(firstCreationTime / 10); // At least 10x faster
      
      console.log(`First creation: ${firstCreationTime.toFixed(3)}ms`);
      console.log(`Average cache hit: ${avgCacheTime.toFixed(3)}ms`);
      console.log(`Cache speedup: ${(firstCreationTime / avgCacheTime).toFixed(1)}x`);
      
      // Clean up
      firstHandle.destroy();
    });

    it('should measure cache overhead vs direct access', async () => {
      const testCount = 10000;
      
      // Test direct object access
      const directStartTime = performance.now();
      const testObject = { value: 'test' };
      for (let i = 0; i < testCount; i++) {
        const value = testObject.value;
      }
      const directEndTime = performance.now();
      const directTime = directEndTime - directStartTime;
      
      // Test cached Handle access
      const handle = await resourceManager.createHandleFromURI('legion://local/env/ANTHROPIC_API_KEY');
      
      const cacheStartTime = performance.now();
      for (let i = 0; i < testCount; i++) {
        const cachedHandle = await resourceManager.createHandleFromURI('legion://local/env/ANTHROPIC_API_KEY');
      }
      const cacheEndTime = performance.now();
      const cacheTime = cacheEndTime - cacheStartTime;
      
      // Cache overhead should be reasonable
      const overhead = cacheTime / directTime;
      expect(overhead).toBeLessThan(1000); // Cache shouldn't be more than 1000x slower than direct access
      
      console.log(`Direct access time: ${directTime.toFixed(3)}ms`);
      console.log(`Cache access time: ${cacheTime.toFixed(3)}ms`);
      console.log(`Cache overhead: ${overhead.toFixed(1)}x`);
      
      // Clean up
      handle.destroy();
    });
  });

  describe('Memory Usage Performance', () => {
    it('should measure memory efficiency of Handle caching', async () => {
      const baseUri = 'legion://local/env/MEMORY_TEST_';
      const handleCount = 100;
      
      // Measure memory before
      const memBefore = process.memoryUsage();
      
      // Create many handles
      const handles = [];
      for (let i = 0; i < handleCount; i++) {
        const handle = await resourceManager.createHandleFromURI(`${baseUri}${i}`);
        handles.push(handle);
      }
      
      // Measure memory after
      const memAfter = process.memoryUsage();
      
      // Calculate memory usage
      const heapUsed = memAfter.heapUsed - memBefore.heapUsed;
      const memoryPerHandle = heapUsed / handleCount;
      
      // Verify cache contains all handles
      expect(resourceManager._handleCache.size).toBe(handleCount);
      
      // Memory per handle should be reasonable (less than 50KB per handle)
      expect(memoryPerHandle).toBeLessThan(50 * 1024);
      
      console.log(`Memory used for ${handleCount} handles: ${(heapUsed / 1024).toFixed(2)}KB`);
      console.log(`Memory per handle: ${(memoryPerHandle / 1024).toFixed(2)}KB`);
      
      // Clean up and measure memory recovery
      handles.forEach(handle => handle.destroy());
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const memAfterCleanup = process.memoryUsage();
      const memoryRecovered = memAfter.heapUsed - memAfterCleanup.heapUsed;
      
      console.log(`Memory recovered after cleanup: ${(memoryRecovered / 1024).toFixed(2)}KB`);
      
      // Cache should be empty
      expect(resourceManager._handleCache.size).toBe(0);
    });

    it('should demonstrate memory stability under cache pressure', async () => {
      const rounds = 10;
      const handlesPerRound = 50;
      const memorySnapshots = [];
      
      for (let round = 0; round < rounds; round++) {
        // Create handles
        const handles = [];
        for (let i = 0; i < handlesPerRound; i++) {
          const uri = `legion://local/env/PRESSURE_TEST_${round}_${i}`;
          const handle = await resourceManager.createHandleFromURI(uri);
          handles.push(handle);
        }
        
        // Take memory snapshot
        const memUsage = process.memoryUsage();
        memorySnapshots.push(memUsage.heapUsed);
        
        // Clean up this round
        handles.forEach(handle => handle.destroy());
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }
      
      // Analyze memory stability
      const initialMemory = memorySnapshots[0];
      const finalMemory = memorySnapshots[memorySnapshots.length - 1];
      const memoryGrowth = finalMemory - initialMemory;
      const growthPercentage = (memoryGrowth / initialMemory) * 100;
      
      // Memory growth should be minimal (less than 50% over baseline)
      expect(growthPercentage).toBeLessThan(50);
      
      console.log(`Memory growth over ${rounds} rounds: ${(memoryGrowth / 1024).toFixed(2)}KB (${growthPercentage.toFixed(1)}%)`);
      console.log(`Final cache size: ${resourceManager._handleCache.size}`);
      
      // Cache should be empty after cleanup
      expect(resourceManager._handleCache.size).toBe(0);
    });
  });

  describe('Scaling Performance', () => {
    it('should demonstrate linear scaling of cache operations', async () => {
      const scalingSizes = [10, 50, 100, 200]; // Limited by cache max size of 200
      const results = [];
      
      for (const size of scalingSizes) {
        // Clear cache for each test
        resourceManager.clearHandleCaches();
        
        // Measure time to create N handles
        const startTime = performance.now();
        
        const handles = [];
        for (let i = 0; i < size; i++) {
          const uri = `legion://local/env/SCALE_TEST_${i}`;
          const handle = await resourceManager.createHandleFromURI(uri);
          handles.push(handle);
        }
        
        const endTime = performance.now();
        const executionTime = endTime - startTime;
        const timePerHandle = executionTime / size;
        
        results.push({
          size,
          totalTime: executionTime,
          timePerHandle
        });
        
        // Verify cache efficiency - cache limited to max capacity of 200
        expect(resourceManager._handleCache.size).toBe(Math.min(size, 200));
        
        // Clean up
        handles.forEach(handle => handle.destroy());
      }
      
      // Analyze scaling behavior
      console.log('Scaling performance:');
      results.forEach(result => {
        console.log(`${result.size} handles: ${result.totalTime.toFixed(2)}ms total, ${result.timePerHandle.toFixed(3)}ms per handle`);
      });
      
      // Time per handle should remain relatively constant (indicating linear scaling)
      const firstTimePerHandle = results[0].timePerHandle;
      const lastTimePerHandle = results[results.length - 1].timePerHandle;
      const scalingFactor = lastTimePerHandle / firstTimePerHandle;
      
      // Scaling should be roughly linear (factor should be < 3)
      expect(scalingFactor).toBeLessThan(3);
      
      console.log(`Scaling factor: ${scalingFactor.toFixed(2)}x`);
    });

    it('should handle cache invalidation performance', async () => {
      const handleCount = 200;
      const baseUri = 'legion://local/env/INVALIDATION_TEST_';
      
      // Create many handles
      const handles = [];
      for (let i = 0; i < handleCount; i++) {
        const handle = await resourceManager.createHandleFromURI(`${baseUri}${i}`);
        handles.push(handle);
      }
      
      expect(resourceManager._handleCache.size).toBe(handleCount);
      
      // Test selective invalidation performance
      const invalidationStartTime = performance.now();
      
      // Invalidate half the handles using pattern
      resourceManager.invalidateHandleCache('.*INVALIDATION_TEST_[0-9][0-9]$'); // Matches 00-99
      
      const invalidationEndTime = performance.now();
      const invalidationTime = invalidationEndTime - invalidationStartTime;
      
      // Check that roughly half were invalidated
      const remainingHandles = resourceManager._handleCache.size;
      expect(remainingHandles).toBeLessThan(handleCount);
      expect(remainingHandles).toBeGreaterThan(handleCount / 2);
      
      // Invalidation should be fast (less than 100ms for 200 handles)
      expect(invalidationTime).toBeLessThan(100);
      
      console.log(`Invalidated ${handleCount - remainingHandles} handles in ${invalidationTime.toFixed(2)}ms`);
      
      // Test full cache clear performance
      const clearStartTime = performance.now();
      resourceManager.clearHandleCaches();
      const clearEndTime = performance.now();
      const clearTime = clearEndTime - clearStartTime;
      
      // Full clear should be very fast
      expect(clearTime).toBeLessThan(50);
      expect(resourceManager._handleCache.size).toBe(0);
      
      console.log(`Full cache clear took ${clearTime.toFixed(2)}ms`);
    });
  });

  describe('Promise-Based Caching Performance', () => {
    it('should demonstrate efficient promise-based caching during concurrent creation', async () => {
      const uri = 'legion://local/env/ANTHROPIC_API_KEY';
      const concurrencyLevels = [10, 50, 100];
      
      for (const concurrency of concurrencyLevels) {
        // Clear cache for each test
        resourceManager.clearHandleCaches();
        
        const startTime = performance.now();
        
        // Start all concurrent operations
        const promises = Array(concurrency).fill(null).map(() =>
          resourceManager.createHandleFromURI(uri)
        );
        
        const handles = await Promise.all(promises);
        const endTime = performance.now();
        
        const executionTime = endTime - startTime;
        
        // All handles should be identical (same cached instance)
        handles.forEach(handle => {
          expect(handle).toBe(handles[0]);
        });
        
        // Should only have one handle in cache despite concurrent requests
        expect(resourceManager._handleCache.size).toBe(1);
        
        console.log(`Concurrency ${concurrency}: ${executionTime.toFixed(2)}ms, ${(executionTime/concurrency).toFixed(3)}ms per handle`);
        
        // Clean up
        handles[0].destroy();
      }
    });

    it('should measure promise caching overhead', async () => {
      const uri = 'legion://local/env/ANTHROPIC_API_KEY';
      const iterations = 1000;
      
      // Pre-create handle to ensure it's cached
      const preHandle = await resourceManager.createHandleFromURI(uri);
      
      // Measure promise resolution time for cached handles
      const startTime = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        await resourceManager.createHandleFromURI(uri);
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / iterations;
      
      // Average time per cached access should be very fast
      expect(avgTime).toBeLessThan(1); // Less than 1ms per access
      
      console.log(`Promise caching: ${iterations} cached accesses in ${totalTime.toFixed(2)}ms`);
      console.log(`Average time per cached access: ${avgTime.toFixed(4)}ms`);
      
      // Clean up
      preHandle.destroy();
    });
  });

  describe('Real-World Performance Simulation', () => {
    it('should simulate typical application usage patterns', async () => {
      const simulationDuration = 1000; // 1 second
      const startTime = Date.now();
      
      let operationCount = 0;
      let handleCount = 0;
      const handles = new Set();
      
      // Simulate typical application patterns
      while (Date.now() - startTime < simulationDuration) {
        const operationType = Math.random();
        
        if (operationType < 0.7) {
          // 70% - Access existing configuration (cache hits)
          await resourceManager.createHandleFromURI('legion://local/env/ANTHROPIC_API_KEY');
          
        } else if (operationType < 0.9) {
          // 20% - Access new configuration (cache misses)
          const newUri = `legion://local/env/DYNAMIC_CONFIG_${handleCount++}`;
          const handle = await resourceManager.createHandleFromURI(newUri);
          handles.add(handle);
          
        } else {
          // 10% - Clean up some handles
          const handlesArray = Array.from(handles);
          if (handlesArray.length > 0) {
            const handleToDestroy = handlesArray[Math.floor(Math.random() * handlesArray.length)];
            handleToDestroy.destroy();
            handles.delete(handleToDestroy);
          }
        }
        
        operationCount++;
      }
      
      const actualDuration = Date.now() - startTime;
      const operationsPerSecond = (operationCount / actualDuration) * 1000;
      
      console.log(`Simulation results:`);
      console.log(`- Operations: ${operationCount} in ${actualDuration}ms`);
      console.log(`- Throughput: ${operationsPerSecond.toFixed(1)} ops/sec`);
      console.log(`- Final cache size: ${resourceManager._handleCache.size}`);
      console.log(`- Active handles: ${handles.size}`);
      
      // Throughput should be reasonable (at least 100 ops/sec)
      expect(operationsPerSecond).toBeGreaterThan(100);
      
      // Clean up remaining handles
      handles.forEach(handle => handle.destroy());
      resourceManager.clearHandleCaches();
    });
  });
});