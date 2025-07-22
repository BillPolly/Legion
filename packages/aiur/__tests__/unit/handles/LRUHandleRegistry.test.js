/**
 * Tests for LRUHandleRegistry class
 * 
 * Tests LRU eviction and memory management functionality
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { LRUHandleRegistry } from '../../../src/handles/LRUHandleRegistry.js';

describe('LRUHandleRegistry', () => {
  describe('Basic LRU Functionality', () => {
    let registry;

    beforeEach(() => {
      registry = new LRUHandleRegistry({ maxSize: 3 });
    });

    test('should store handles up to max size', () => {
      registry.create('handle1', { data: 1 });
      registry.create('handle2', { data: 2 });
      registry.create('handle3', { data: 3 });

      expect(registry.size()).toBe(3);
      expect(registry.existsByName('handle1')).toBe(true);
      expect(registry.existsByName('handle2')).toBe(true);
      expect(registry.existsByName('handle3')).toBe(true);
    });

    test('should evict least recently used when exceeding max size', () => {
      registry.create('handle1', { data: 1 });
      registry.create('handle2', { data: 2 });
      registry.create('handle3', { data: 3 });
      
      // This should evict handle1 (least recently created/accessed)
      registry.create('handle4', { data: 4 });

      expect(registry.size()).toBe(3);
      expect(registry.existsByName('handle1')).toBe(false);
      expect(registry.existsByName('handle2')).toBe(true);
      expect(registry.existsByName('handle3')).toBe(true);
      expect(registry.existsByName('handle4')).toBe(true);
    });

    test('should update LRU order on access', () => {
      registry.create('handle1', { data: 1 });
      registry.create('handle2', { data: 2 });
      registry.create('handle3', { data: 3 });

      // Access handle1 to make it most recently used
      registry.getByName('handle1');

      // Add new handle - should evict handle2 now (least recently used)
      registry.create('handle4', { data: 4 });

      expect(registry.existsByName('handle1')).toBe(true); // Was accessed, should remain
      expect(registry.existsByName('handle2')).toBe(false); // Should be evicted
      expect(registry.existsByName('handle3')).toBe(true);
      expect(registry.existsByName('handle4')).toBe(true);
    });

    test('should handle max size of 1', () => {
      const smallRegistry = new LRUHandleRegistry({ maxSize: 1 });

      smallRegistry.create('handle1', { data: 1 });
      expect(smallRegistry.size()).toBe(1);

      smallRegistry.create('handle2', { data: 2 });
      expect(smallRegistry.size()).toBe(1);
      expect(smallRegistry.existsByName('handle1')).toBe(false);
      expect(smallRegistry.existsByName('handle2')).toBe(true);
    });
  });

  describe('LRU Order Tracking', () => {
    let registry;

    beforeEach(() => {
      registry = new LRUHandleRegistry({ maxSize: 5 });
    });

    test('should track creation order', () => {
      const handles = ['first', 'second', 'third'];
      handles.forEach((name, i) => {
        registry.create(name, { order: i });
      });

      const lruOrder = registry.getLRUOrder();
      expect(lruOrder).toEqual(['first', 'second', 'third']);
    });

    test('should update order on getByName access', () => {
      registry.create('first', { data: 1 });
      registry.create('second', { data: 2 });
      registry.create('third', { data: 3 });

      // Access 'first' - should move to end
      registry.getByName('first');

      const lruOrder = registry.getLRUOrder();
      expect(lruOrder).toEqual(['second', 'third', 'first']);
    });

    test('should update order on getHandle access', () => {
      const id1 = registry.create('first', { data: 1 });
      registry.create('second', { data: 2 });
      registry.create('third', { data: 3 });

      // Access by ID - should move to end
      registry.getHandle(id1);

      const lruOrder = registry.getLRUOrder();
      expect(lruOrder).toEqual(['second', 'third', 'first']);
    });

    test('should handle multiple accesses', () => {
      registry.create('a', { data: 1 });
      registry.create('b', { data: 2 });
      registry.create('c', { data: 3 });

      // Multiple accesses
      registry.getByName('a'); // [b, c, a]
      registry.getByName('b'); // [c, a, b]
      registry.getByName('a'); // [c, b, a]

      const lruOrder = registry.getLRUOrder();
      expect(lruOrder).toEqual(['c', 'b', 'a']);
    });
  });

  describe('Memory Usage Tracking', () => {
    let registry;

    beforeEach(() => {
      registry = new LRUHandleRegistry({ maxSize: 10, trackMemoryUsage: true });
    });

    test('should estimate memory usage', () => {
      const initialMemory = registry.getEstimatedMemoryUsage();
      expect(initialMemory).toBe(0);

      registry.create('small', { value: 'test' });
      const afterSmall = registry.getEstimatedMemoryUsage();
      expect(afterSmall).toBeGreaterThan(0);

      const largeData = { array: new Array(1000).fill('data') };
      registry.create('large', largeData);
      const afterLarge = registry.getEstimatedMemoryUsage();
      expect(afterLarge).toBeGreaterThan(afterSmall);
    });

    test('should update memory usage on eviction', () => {
      const registry = new LRUHandleRegistry({ maxSize: 2, trackMemoryUsage: true });

      registry.create('handle1', { data: new Array(100).fill('test') });
      registry.create('handle2', { data: new Array(100).fill('test') });
      
      const memoryWith2 = registry.getEstimatedMemoryUsage();

      // This should evict handle1
      registry.create('handle3', { data: 'small' });
      
      const memoryWith3 = registry.getEstimatedMemoryUsage();
      expect(memoryWith3).toBeLessThan(memoryWith2);
    });
  });

  describe('Configuration Options', () => {
    test('should use default max size when not specified', () => {
      const registry = new LRUHandleRegistry();
      expect(registry.getMaxSize()).toBe(1000); // Default value
    });

    test('should respect custom max size', () => {
      const registry = new LRUHandleRegistry({ maxSize: 50 });
      expect(registry.getMaxSize()).toBe(50);
    });

    test('should enable/disable memory tracking', () => {
      const withTracking = new LRUHandleRegistry({ trackMemoryUsage: true });
      const withoutTracking = new LRUHandleRegistry({ trackMemoryUsage: false });

      withTracking.create('test', { data: 'test' });
      withoutTracking.create('test', { data: 'test' });

      expect(withTracking.getEstimatedMemoryUsage()).toBeGreaterThan(0);
      expect(withoutTracking.getEstimatedMemoryUsage()).toBe(0);
    });
  });

  describe('Eviction Callbacks', () => {
    test('should call eviction callback when handle is evicted', () => {
      const evictedHandles = [];
      const registry = new LRUHandleRegistry({
        maxSize: 2,
        onEviction: (handle) => evictedHandles.push(handle)
      });

      registry.create('handle1', { data: 1 });
      registry.create('handle2', { data: 2 });
      
      expect(evictedHandles).toHaveLength(0);

      registry.create('handle3', { data: 3 }); // Should evict handle1

      expect(evictedHandles).toHaveLength(1);
      expect(evictedHandles[0].name).toBe('handle1');
      expect(evictedHandles[0].data).toEqual({ data: 1 });
    });

    test('should handle eviction callback errors gracefully', () => {
      const registry = new LRUHandleRegistry({
        maxSize: 1,
        onEviction: () => { throw new Error('Callback error'); }
      });

      registry.create('handle1', { data: 1 });
      
      // Should not throw despite callback error
      expect(() => {
        registry.create('handle2', { data: 2 });
      }).not.toThrow();

      expect(registry.existsByName('handle2')).toBe(true);
    });
  });

  describe('Manual Cache Management', () => {
    let registry;

    beforeEach(() => {
      registry = new LRUHandleRegistry({ maxSize: 5 });
    });

    test('should allow manual eviction of specific handles', () => {
      registry.create('keep', { data: 'keep' });
      registry.create('evict', { data: 'evict' });

      expect(registry.existsByName('evict')).toBe(true);
      
      const evicted = registry.evict('evict');
      expect(evicted).toBe(true);
      expect(registry.existsByName('evict')).toBe(false);
      expect(registry.existsByName('keep')).toBe(true);
    });

    test('should return false when manually evicting non-existent handle', () => {
      const evicted = registry.evict('nonExistent');
      expect(evicted).toBe(false);
    });

    test('should allow manual cleanup of least recently used handles', () => {
      registry.create('old1', { data: 1 });
      registry.create('old2', { data: 2 });
      registry.create('new1', { data: 3 });

      // Access new1 to make old1, old2 LRU
      registry.getByName('new1');

      const evicted = registry.evictLRU(2); // Remove 2 oldest
      expect(evicted).toBe(2);
      expect(registry.size()).toBe(1);
      expect(registry.existsByName('new1')).toBe(true);
    });

    test('should clear all handles', () => {
      registry.create('handle1', { data: 1 });
      registry.create('handle2', { data: 2 });

      expect(registry.size()).toBe(2);

      registry.clear();

      expect(registry.size()).toBe(0);
      expect(registry.listNames()).toHaveLength(0);
      expect(registry.getEstimatedMemoryUsage()).toBe(0);
    });
  });

  describe('Statistics', () => {
    let registry;

    beforeEach(() => {
      registry = new LRUHandleRegistry({ maxSize: 3, trackMemoryUsage: true });
    });

    test('should provide cache statistics', () => {
      const freshRegistry = new LRUHandleRegistry({ maxSize: 3, trackMemoryUsage: true });
      
      freshRegistry.create('handle1', { data: 1 });
      freshRegistry.getByName('handle1'); // Hit
      freshRegistry.getByName('nonExistent'); // Miss

      const stats = freshRegistry.getStatistics();
      
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('maxSize');
      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('evictions');
      expect(stats).toHaveProperty('memoryUsage');

      expect(stats.size).toBe(1);
      expect(stats.maxSize).toBe(3);
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.evictions).toBe(0);
    });

    test('should track evictions in statistics', () => {
      registry.create('handle1', { data: 1 });
      registry.create('handle2', { data: 2 });
      registry.create('handle3', { data: 3 });
      registry.create('handle4', { data: 4 }); // Should cause eviction

      const stats = registry.getStatistics();
      expect(stats.evictions).toBe(1);
    });
  });
});