/**
 * HandleCache Unit Tests
 * Test caching functionality with TTL support and memory management
 */

import { jest } from '@jest/globals';
import { HandleCache } from '../../src/HandleCache.js';

describe('HandleCache', () => {
  let cache;

  beforeEach(() => {
    cache = new HandleCache();
    jest.useFakeTimers();
  });

  afterEach(() => {
    cache.clear();
    jest.useRealTimers();
  });

  describe('Basic Cache Operations', () => {
    test('should store and retrieve values', () => {
      cache.set('test-key', 'test-value');
      
      expect(cache.get('test-key')).toBe('test-value');
    });

    test('should return null for non-existent keys', () => {
      expect(cache.get('non-existent-key')).toBeNull();
    });

    test('should check if key exists', () => {
      cache.set('existing-key', 'value');
      
      expect(cache.has('existing-key')).toBe(true);
      expect(cache.has('non-existent-key')).toBe(false);
    });

    test('should delete specific keys', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      const deleted = cache.delete('key1');
      
      expect(deleted).toBe(true);
      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBe('value2');
    });

    test('should return false when deleting non-existent key', () => {
      const deleted = cache.delete('non-existent-key');
      
      expect(deleted).toBe(false);
    });
  });

  describe('TTL (Time To Live) Support', () => {
    test('should expire values after TTL', () => {
      cache.set('ttl-key', 'ttl-value', 1000);
      
      expect(cache.get('ttl-key')).toBe('ttl-value');
      
      // Fast-forward time past TTL
      jest.advanceTimersByTime(1001);
      
      expect(cache.get('ttl-key')).toBeNull();
      expect(cache.has('ttl-key')).toBe(false);
    });

    test('should not expire values without TTL', () => {
      cache.set('persistent-key', 'persistent-value');
      
      // Fast-forward time significantly
      jest.advanceTimersByTime(60000);
      
      expect(cache.get('persistent-key')).toBe('persistent-value');
    });

    test('should update TTL when value is reset', () => {
      cache.set('update-key', 'value1', 1000);
      
      // Half-way through TTL
      jest.advanceTimersByTime(500);
      
      // Reset with new TTL
      cache.set('update-key', 'value2', 2000);
      
      // Should not expire at original TTL time
      jest.advanceTimersByTime(600); // Total 1100ms, past original TTL
      expect(cache.get('update-key')).toBe('value2');
      
      // Should expire at new TTL time
      jest.advanceTimersByTime(1500); // Total 2600ms, past new TTL
      expect(cache.get('update-key')).toBeNull();
    });

    test('should handle zero TTL as no expiration', () => {
      cache.set('zero-ttl-key', 'value', 0);
      
      jest.advanceTimersByTime(60000);
      
      expect(cache.get('zero-ttl-key')).toBe('value');
    });
  });

  describe('Pattern-Based Invalidation', () => {
    test('should invalidate by exact pattern match', () => {
      cache.set('method:read', 'read-result');
      cache.set('method:write', 'write-result');
      cache.set('attr:size', 'size-value');
      
      cache.invalidate('method:');
      
      expect(cache.get('method:read')).toBeNull();
      expect(cache.get('method:write')).toBeNull();
      expect(cache.get('attr:size')).toBe('size-value');
    });

    test('should invalidate by partial pattern match', () => {
      cache.set('user:123:profile', 'profile-data');
      cache.set('user:123:settings', 'settings-data');
      cache.set('user:456:profile', 'other-profile');
      
      cache.invalidate('user:123:');
      
      expect(cache.get('user:123:profile')).toBeNull();
      expect(cache.get('user:123:settings')).toBeNull();
      expect(cache.get('user:456:profile')).toBe('other-profile');
    });

    test('should clear TTL timers when invalidating', () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
      
      cache.set('ttl-key1', 'value1', 5000);
      cache.set('ttl-key2', 'value2', 5000);
      cache.set('other-key', 'value3'); // Different pattern that shouldn't match
      
      cache.invalidate('ttl-key');
      
      expect(clearTimeoutSpy).toHaveBeenCalledTimes(2); // Two TTL timers cleared
      expect(cache.get('ttl-key1')).toBeNull();
      expect(cache.get('ttl-key2')).toBeNull();
      expect(cache.get('other-key')).toBe('value3');
      
      clearTimeoutSpy.mockRestore();
    });

    test('should handle invalidation with no matching keys', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      // Should not throw error
      cache.invalidate('non-matching-pattern');
      
      expect(cache.get('key1')).toBe('value1');
      expect(cache.get('key2')).toBe('value2');
    });
  });

  describe('Memory Management', () => {
    test('should track cache size', () => {
      expect(cache.size()).toBe(0);
      
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      expect(cache.size()).toBe(2);
      
      cache.delete('key1');
      
      expect(cache.size()).toBe(1);
    });

    test('should clear all cache entries and timers', () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
      
      cache.set('key1', 'value1', 1000);
      cache.set('key2', 'value2', 2000);
      cache.set('key3', 'value3');
      
      cache.clear();
      
      expect(cache.size()).toBe(0);
      expect(cache.get('key1')).toBeNull();
      expect(clearTimeoutSpy).toHaveBeenCalledTimes(2); // Two TTL timers cleared
      
      clearTimeoutSpy.mockRestore();
    });

    test('should list all cache keys', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      
      const keys = cache.keys();
      
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toContain('key3');
      expect(keys.length).toBe(3);
    });

    test('should provide cache statistics', () => {
      cache.set('key1', 'value1', 1000);
      cache.set('key2', 'value2');
      
      const stats = cache.getStats();
      
      expect(stats.totalEntries).toBe(2);
      expect(stats.entriesWithTTL).toBe(1);
      expect(stats.entriesWithoutTTL).toBe(1);
    });
  });

  describe('Cache Entry Management', () => {
    test('should handle complex object values', () => {
      const complexObject = {
        data: [1, 2, 3],
        meta: { created: new Date(), id: 'test' }
      };
      
      cache.set('complex-key', complexObject);
      
      const retrieved = cache.get('complex-key');
      expect(retrieved).toEqual(complexObject);
      expect(retrieved).toBe(complexObject); // Should be same reference
    });

    test('should handle function values', () => {
      const testFunction = () => 'test-result';
      
      cache.set('function-key', testFunction);
      
      const retrieved = cache.get('function-key');
      expect(retrieved).toBe(testFunction);
      expect(retrieved()).toBe('test-result');
    });

    test('should handle null and undefined values', () => {
      cache.set('null-key', null);
      cache.set('undefined-key', undefined);
      
      expect(cache.get('null-key')).toBe(null);
      expect(cache.get('undefined-key')).toBe(undefined);
      expect(cache.has('null-key')).toBe(true);
      expect(cache.has('undefined-key')).toBe(true);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle rapid set/get operations', () => {
      for (let i = 0; i < 1000; i++) {
        cache.set(`rapid-key-${i}`, `value-${i}`);
      }
      
      expect(cache.size()).toBe(1000);
      
      for (let i = 0; i < 1000; i++) {
        expect(cache.get(`rapid-key-${i}`)).toBe(`value-${i}`);
      }
    });

    test('should handle concurrent TTL operations', () => {
      cache.set('concurrent1', 'value1', 100);
      cache.set('concurrent2', 'value2', 200);
      cache.set('concurrent3', 'value3', 300);
      
      // Advance to first expiration (100ms)
      jest.advanceTimersByTime(101);
      
      expect(cache.get('concurrent1')).toBeNull();
      expect(cache.get('concurrent2')).toBe('value2');
      expect(cache.get('concurrent3')).toBe('value3');
      
      // Advance to second expiration (200ms total)
      jest.advanceTimersByTime(100);
      
      expect(cache.get('concurrent2')).toBeNull();
      expect(cache.get('concurrent3')).toBe('value3');
      
      // Advance to final expiration (300ms total)
      jest.advanceTimersByTime(100);
      
      expect(cache.get('concurrent3')).toBeNull();
      expect(cache.size()).toBe(0);
    });
  });
});