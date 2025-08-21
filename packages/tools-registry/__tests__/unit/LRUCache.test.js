/**
 * Unit Tests for LRU Cache
 * 
 * Tests the LRU cache implementation with:
 * - Size limits
 * - TTL (Time to Live)
 * - Eviction policies
 * - Statistics tracking
 */

import { jest } from '@jest/globals';
import { LRUCache } from '../../src/utils/LRUCache.js';

describe('LRUCache', () => {
  let cache;

  beforeEach(() => {
    cache = new LRUCache({
      maxSize: 3,
      ttl: 1000 // 1 second TTL
    });
  });

  describe('Basic Operations', () => {
    test('should set and get values', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    test('should return undefined for non-existent keys', () => {
      expect(cache.get('nonexistent')).toBeUndefined();
    });

    test('should check if key exists', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('nonexistent')).toBe(false);
    });

    test('should delete keys', () => {
      cache.set('key1', 'value1');
      expect(cache.delete('key1')).toBe(true);
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.delete('nonexistent')).toBe(false);
    });

    test('should clear all items', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.clear();
      expect(cache.size).toBe(0);
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();
    });

    test('should report correct size', () => {
      expect(cache.size).toBe(0);
      cache.set('key1', 'value1');
      expect(cache.size).toBe(1);
      cache.set('key2', 'value2');
      expect(cache.size).toBe(2);
    });
  });

  describe('LRU Eviction', () => {
    test('should evict least recently used item when max size reached', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      
      // Cache is full (size 3)
      expect(cache.size).toBe(3);
      
      // Adding new item should evict key1 (least recently used)
      cache.set('key4', 'value4');
      expect(cache.size).toBe(3);
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBe('value2');
      expect(cache.get('key3')).toBe('value3');
      expect(cache.get('key4')).toBe('value4');
    });

    test('should update access order when getting items', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      
      // Access key1 to make it recently used
      cache.get('key1');
      
      // Adding new item should evict key2 (now least recently used)
      cache.set('key4', 'value4');
      expect(cache.get('key1')).toBe('value1'); // Still exists
      expect(cache.get('key2')).toBeUndefined(); // Evicted
      expect(cache.get('key3')).toBe('value3');
      expect(cache.get('key4')).toBe('value4');
    });

    test('should update existing key without eviction', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      
      // Update existing key
      cache.set('key2', 'newValue2');
      expect(cache.size).toBe(3);
      expect(cache.get('key1')).toBe('value1');
      expect(cache.get('key2')).toBe('newValue2');
      expect(cache.get('key3')).toBe('value3');
    });
  });

  describe('TTL (Time to Live)', () => {
    test('should expire items after TTL', async () => {
      cache.set('key1', 'value1', 100); // 100ms TTL
      expect(cache.get('key1')).toBe('value1');
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.has('key1')).toBe(false);
    });

    test('should use default TTL when not specified', async () => {
      cache.set('key1', 'value1'); // Uses default 1000ms TTL
      expect(cache.get('key1')).toBe('value1');
      
      // Should still exist after 500ms
      await new Promise(resolve => setTimeout(resolve, 500));
      expect(cache.get('key1')).toBe('value1');
      
      // Should expire after 1000ms
      await new Promise(resolve => setTimeout(resolve, 600));
      expect(cache.get('key1')).toBeUndefined();
    });

    test('should handle zero TTL (never expire)', async () => {
      cache.set('key1', 'value1', 0); // Zero TTL = never expire
      
      // Wait some time
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Should still exist
      expect(cache.get('key1')).toBe('value1');
    });

    test('should cleanup expired items', async () => {
      cache.set('key1', 'value1', 100);
      cache.set('key2', 'value2', 200);
      cache.set('key3', 'value3', 0); // Never expire
      
      // Wait for first expiration
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const removed = cache.cleanupExpired();
      expect(removed).toBe(1); // key1 expired
      expect(cache.size).toBe(2);
      
      // Wait for second expiration
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const removed2 = cache.cleanupExpired();
      expect(removed2).toBe(1); // key2 expired
      expect(cache.size).toBe(1);
      expect(cache.get('key3')).toBe('value3'); // Still exists
    });
  });

  describe('Statistics', () => {
    test('should track cache hits and misses', () => {
      cache.set('key1', 'value1');
      
      // Hit
      cache.get('key1');
      
      // Misses
      cache.get('nonexistent');
      cache.get('another');
      
      const stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(2);
      expect(stats.hitRate).toBe('0.333');
    });

    test('should track evictions', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      cache.set('key4', 'value4'); // Evicts key1
      cache.set('key5', 'value5'); // Evicts key2
      
      const stats = cache.getStats();
      expect(stats.evictions).toBe(2);
    });

    test('should track expirations', async () => {
      cache.set('key1', 'value1', 100);
      cache.set('key2', 'value2', 100);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Trigger expiration check
      cache.get('key1');
      cache.get('key2');
      
      const stats = cache.getStats();
      expect(stats.expirations).toBe(2);
    });

    test('should reset statistics on clear', () => {
      cache.set('key1', 'value1');
      cache.get('key1');
      cache.get('nonexistent');
      
      cache.clear();
      
      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.evictions).toBe(0);
      expect(stats.expirations).toBe(0);
    });

    test('should include size and maxSize in stats', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      const stats = cache.getStats();
      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(3);
    });
  });

  describe('Edge Cases', () => {
    test('should handle cache with size 1', () => {
      const smallCache = new LRUCache({ maxSize: 1 });
      
      smallCache.set('key1', 'value1');
      expect(smallCache.get('key1')).toBe('value1');
      
      smallCache.set('key2', 'value2');
      expect(smallCache.get('key1')).toBeUndefined();
      expect(smallCache.get('key2')).toBe('value2');
    });

    test('should handle complex objects as values', () => {
      const obj = { nested: { data: [1, 2, 3] } };
      cache.set('complex', obj);
      
      const retrieved = cache.get('complex');
      expect(retrieved).toBe(obj); // Same reference
      expect(retrieved.nested.data).toEqual([1, 2, 3]);
    });

    test('should handle null and undefined values', () => {
      cache.set('null', null);
      cache.set('undefined', undefined);
      
      expect(cache.get('null')).toBeNull();
      expect(cache.get('undefined')).toBeUndefined();
      expect(cache.has('undefined')).toBe(true); // Key exists even with undefined value
    });

    test('should handle concurrent operations', () => {
      const promises = [];
      
      // Simulate concurrent sets
      for (let i = 0; i < 10; i++) {
        promises.push(
          Promise.resolve().then(() => cache.set(`key${i}`, `value${i}`))
        );
      }
      
      return Promise.all(promises).then(() => {
        // Only last 3 should remain due to max size
        expect(cache.size).toBe(3);
        expect(cache.get('key7')).toBe('value7');
        expect(cache.get('key8')).toBe('value8');
        expect(cache.get('key9')).toBe('value9');
      });
    });
  });

  describe('Memory Management', () => {
    test('should not exceed max size under stress', () => {
      for (let i = 0; i < 1000; i++) {
        cache.set(`key${i}`, `value${i}`);
        expect(cache.size).toBeLessThanOrEqual(3);
      }
      
      // Should have only the last 3 items
      expect(cache.size).toBe(3);
      expect(cache.get('key997')).toBe('value997');
      expect(cache.get('key998')).toBe('value998');
      expect(cache.get('key999')).toBe('value999');
    });

    test('should properly clean up references on eviction', () => {
      const bigObject = { data: new Array(1000).fill('data') };
      
      cache.set('big1', bigObject);
      cache.set('big2', bigObject);
      cache.set('big3', bigObject);
      
      // Force eviction
      cache.set('big4', bigObject);
      
      // big1 should be evicted and no longer accessible
      expect(cache.get('big1')).toBeUndefined();
      expect(cache.size).toBe(3);
    });
  });
});