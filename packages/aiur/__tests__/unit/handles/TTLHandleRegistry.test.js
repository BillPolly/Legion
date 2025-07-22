/**
 * Tests for TTLHandleRegistry class
 * 
 * Tests TTL (Time-To-Live) functionality for automatic handle expiration
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { TTLHandleRegistry } from '../../../src/handles/TTLHandleRegistry.js';

describe('TTLHandleRegistry', () => {
  let registry;
  let originalSetTimeout;
  let originalClearTimeout;

  beforeEach(() => {
    // Mock timers to control time-based tests
    originalSetTimeout = global.setTimeout;
    originalClearTimeout = global.clearTimeout;
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    global.setTimeout = originalSetTimeout;
    global.clearTimeout = originalClearTimeout;
  });

  describe('Basic TTL Functionality', () => {
    beforeEach(() => {
      registry = new TTLHandleRegistry({ defaultTTL: 5000 }); // 5 second default TTL
    });

    test('should create handle with default TTL', () => {
      const handleId = registry.create('testHandle', { data: 'test' });
      expect(registry.existsByName('testHandle')).toBe(true);

      const handle = registry.getHandle(handleId);
      expect(handle.metadata.expiresAt).toBeInstanceOf(Date);
      expect(handle.metadata.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    test('should create handle with custom TTL', () => {
      const customTTL = 10000; // 10 seconds
      const handleId = registry.create('testHandle', { data: 'test' }, { ttl: customTTL });
      
      const handle = registry.getHandle(handleId);
      const expectedExpiry = new Date(Date.now() + customTTL);
      
      // Allow for small timing differences (within 100ms)
      expect(Math.abs(handle.metadata.expiresAt.getTime() - expectedExpiry.getTime())).toBeLessThan(100);
    });

    test('should expire handle after TTL', () => {
      registry.create('expireMe', { data: 'test' }, { ttl: 1000 }); // 1 second TTL
      
      expect(registry.existsByName('expireMe')).toBe(true);
      
      // Fast-forward time by 1.1 seconds
      jest.advanceTimersByTime(1100);
      
      // Trigger cleanup
      registry.cleanupExpired();
      
      expect(registry.existsByName('expireMe')).toBe(false);
    });

    test('should not expire handle before TTL', () => {
      registry.create('keepMe', { data: 'test' }, { ttl: 2000 }); // 2 second TTL
      
      expect(registry.existsByName('keepMe')).toBe(true);
      
      // Fast-forward time by 1 second (less than TTL)
      jest.advanceTimersByTime(1000);
      
      // Trigger cleanup
      registry.cleanupExpired();
      
      expect(registry.existsByName('keepMe')).toBe(true);
    });
  });

  describe('TTL Extension on Access', () => {
    beforeEach(() => {
      registry = new TTLHandleRegistry({ 
        defaultTTL: 2000,
        extendOnAccess: true
      });
    });

    test('should extend TTL when accessed via getByName', () => {
      registry.create('extendMe', { data: 'test' });
      
      // Get initial expiry time
      const handle1 = registry.getByName('extendMe');
      const initialExpiry = handle1.metadata.expiresAt.getTime();
      
      // Fast-forward time by 1 second
      jest.advanceTimersByTime(1000);
      
      // Access the handle again
      const handle2 = registry.getByName('extendMe');
      const newExpiry = handle2.metadata.expiresAt.getTime();
      
      // New expiry should be extended
      expect(newExpiry).toBeGreaterThan(initialExpiry);
    });

    test('should extend TTL when accessed via getHandle', () => {
      const handleId = registry.create('extendMe', { data: 'test' });
      
      // Get initial expiry time
      const handle1 = registry.getHandle(handleId);
      const initialExpiry = handle1.metadata.expiresAt.getTime();
      
      // Fast-forward time by 1 second
      jest.advanceTimersByTime(1000);
      
      // Access the handle again
      const handle2 = registry.getHandle(handleId);
      const newExpiry = handle2.metadata.expiresAt.getTime();
      
      // New expiry should be extended
      expect(newExpiry).toBeGreaterThan(initialExpiry);
    });

    test('should not extend TTL when extendOnAccess is false', () => {
      const registryNoExtend = new TTLHandleRegistry({ 
        defaultTTL: 2000,
        extendOnAccess: false
      });
      
      registryNoExtend.create('noExtend', { data: 'test' });
      
      // Get initial expiry time
      const handle1 = registryNoExtend.getByName('noExtend');
      const initialExpiry = handle1.metadata.expiresAt.getTime();
      
      // Fast-forward time by 1 second
      jest.advanceTimersByTime(1000);
      
      // Access the handle again
      const handle2 = registryNoExtend.getByName('noExtend');
      const newExpiry = handle2.metadata.expiresAt.getTime();
      
      // Expiry should be the same
      expect(newExpiry).toBe(initialExpiry);
    });
  });

  describe('Automatic Cleanup', () => {
    beforeEach(() => {
      registry = new TTLHandleRegistry({ 
        defaultTTL: 1000,
        cleanupInterval: 500 // Clean up every 500ms
      });
    });

    test('should automatically clean up expired handles', () => {
      registry.create('autoExpire1', { data: 'test1' });
      registry.create('autoExpire2', { data: 'test2' });
      
      expect(registry.size()).toBe(2);
      
      // Fast-forward past TTL and cleanup interval
      jest.advanceTimersByTime(1600);
      
      expect(registry.size()).toBe(0);
      expect(registry.existsByName('autoExpire1')).toBe(false);
      expect(registry.existsByName('autoExpire2')).toBe(false);
    });

    test('should not affect non-expired handles during cleanup', () => {
      registry.create('expire', { data: 'expire' }, { ttl: 500 });
      registry.create('keep', { data: 'keep' }, { ttl: 2000 });
      
      expect(registry.size()).toBe(2);
      
      // Fast-forward to expire first handle but not second
      jest.advanceTimersByTime(1000);
      
      expect(registry.size()).toBe(1);
      expect(registry.existsByName('expire')).toBe(false);
      expect(registry.existsByName('keep')).toBe(true);
    });

    test('should stop automatic cleanup when registry is destroyed', () => {
      const spy = jest.spyOn(registry, 'cleanupExpired');
      
      registry.destroy();
      
      // Fast-forward time
      jest.advanceTimersByTime(1000);
      
      // Cleanup should not have been called after destroy
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('Manual TTL Management', () => {
    beforeEach(() => {
      registry = new TTLHandleRegistry({ defaultTTL: 2000 });
    });

    test('should allow manual TTL extension', () => {
      const handleId = registry.create('extend', { data: 'test' });
      const handle1 = registry.handles.get(handleId); // Direct access to avoid TTL extension
      const initialExpiry = handle1.metadata.expiresAt.getTime();
      
      // Extend TTL by 3 seconds
      const extended = registry.extendTTL('extend', 3000);
      expect(extended).toBe(true);
      
      const handle2 = registry.handles.get(handleId); // Direct access to avoid TTL extension
      const newExpiry = handle2.metadata.expiresAt.getTime();
      
      expect(newExpiry).toBeGreaterThan(initialExpiry);
      expect(newExpiry - initialExpiry).toBe(3000);
    });

    test('should return false when extending TTL of non-existent handle', () => {
      const extended = registry.extendTTL('nonExistent', 1000);
      expect(extended).toBe(false);
    });

    test('should allow refreshing TTL to default', () => {
      const handleId = registry.create('refresh', { data: 'test' }, { ttl: 500 });
      
      // Fast-forward time to make it close to expiry
      jest.advanceTimersByTime(400);
      
      const refreshed = registry.refreshTTL('refresh');
      expect(refreshed).toBe(true);
      
      const handle = registry.getHandle(handleId);
      const expectedExpiry = Date.now() + registry.defaultTTL;
      
      expect(Math.abs(handle.metadata.expiresAt.getTime() - expectedExpiry)).toBeLessThan(100);
    });

    test('should get remaining TTL for handle', () => {
      registry.create('checkTTL', { data: 'test' }, { ttl: 5000 });
      
      const remaining1 = registry.getRemainingTTL('checkTTL');
      expect(remaining1).toBeGreaterThan(4900);
      expect(remaining1).toBeLessThanOrEqual(5000);
      
      // Fast-forward time
      jest.advanceTimersByTime(2000);
      
      const remaining2 = registry.getRemainingTTL('checkTTL');
      expect(remaining2).toBeGreaterThan(2900);
      expect(remaining2).toBeLessThanOrEqual(3000);
    });

    test('should return -1 for remaining TTL of non-existent handle', () => {
      const remaining = registry.getRemainingTTL('nonExistent');
      expect(remaining).toBe(-1);
    });

    test('should return 0 for expired handle remaining TTL', () => {
      registry.create('expired', { data: 'test' }, { ttl: 500 });
      
      // Fast-forward past expiry
      jest.advanceTimersByTime(600);
      
      const remaining = registry.getRemainingTTL('expired');
      expect(remaining).toBe(0);
    });
  });

  describe('TTL Configuration', () => {
    test('should use default TTL when not specified', () => {
      const defaultRegistry = new TTLHandleRegistry();
      expect(defaultRegistry.defaultTTL).toBe(300000); // 5 minutes default
    });

    test('should respect custom default TTL', () => {
      const customRegistry = new TTLHandleRegistry({ defaultTTL: 10000 });
      expect(customRegistry.defaultTTL).toBe(10000);
    });

    test('should disable TTL when set to 0', () => {
      const noTTLRegistry = new TTLHandleRegistry({ defaultTTL: 0 });
      
      const handleId = noTTLRegistry.create('permanent', { data: 'test' });
      const handle = noTTLRegistry.getHandle(handleId);
      
      expect(handle.metadata.expiresAt).toBeNull();
    });

    test('should allow per-handle TTL override', () => {
      registry = new TTLHandleRegistry({ defaultTTL: 1000 });
      
      const id1 = registry.create('default', { data: 'test1' }); // Uses default TTL
      const id2 = registry.create('custom', { data: 'test2' }, { ttl: 5000 }); // Custom TTL
      const id3 = registry.create('permanent', { data: 'test3' }, { ttl: 0 }); // No TTL
      
      const handle1 = registry.getHandle(id1);
      const handle2 = registry.getHandle(id2);
      const handle3 = registry.getHandle(id3);
      
      const now = Date.now();
      expect(handle1.metadata.expiresAt.getTime()).toBeCloseTo(now + 1000, -2);
      expect(handle2.metadata.expiresAt.getTime()).toBeCloseTo(now + 5000, -2);
      expect(handle3.metadata.expiresAt).toBeNull();
    });
  });

  describe('TTL Statistics and Monitoring', () => {
    beforeEach(() => {
      registry = new TTLHandleRegistry({ defaultTTL: 2000 });
    });

    test('should track expiration statistics', () => {
      registry.create('expire1', { data: 'test1' }, { ttl: 100 });
      registry.create('expire2', { data: 'test2' }, { ttl: 100 });
      registry.create('keep', { data: 'keep' }, { ttl: 5000 });
      
      // Fast-forward to expire first two handles
      jest.advanceTimersByTime(200);
      registry.cleanupExpired();
      
      const stats = registry.getStatistics();
      expect(stats.totalExpired).toBe(2);
      expect(stats.size).toBe(1);
    });

    test('should provide TTL health information', () => {
      registry.create('soon', { data: 'test1' }, { ttl: 500 });
      registry.create('later', { data: 'test2' }, { ttl: 5000 });
      
      const health = registry.getTTLHealthInfo();
      
      expect(health.totalHandles).toBe(2);
      expect(health.expiringSoon).toBe(1); // Default threshold is 1000ms
      expect(health.averageTTL).toBeGreaterThan(0);
    });

    test('should list expiring handles', () => {
      registry.create('soon1', { data: 'test1' }, { ttl: 500 });
      registry.create('soon2', { data: 'test2' }, { ttl: 800 });
      registry.create('later', { data: 'test3' }, { ttl: 5000 });
      
      const expiring = registry.getExpiringHandles(1000); // Within 1 second
      
      expect(expiring).toHaveLength(2);
      expect(expiring.map(h => h.name)).toContain('soon1');
      expect(expiring.map(h => h.name)).toContain('soon2');
      expect(expiring.map(h => h.name)).not.toContain('later');
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      registry = new TTLHandleRegistry({ defaultTTL: 1000 });
    });

    test('should handle cleanup errors gracefully', () => {
      const mockError = new Error('Cleanup error');
      const originalDelete = registry.delete.bind(registry);
      
      registry.delete = jest.fn().mockImplementation((id) => {
        if (id.includes('error')) {
          throw mockError;
        }
        return originalDelete(id);
      });
      
      registry.create('normal', { data: 'test' }, { ttl: 100 });
      registry.create('error-handle', { data: 'test' }, { ttl: 100 });
      
      // This should not throw despite the error in cleanup
      expect(() => {
        jest.advanceTimersByTime(200);
        registry.cleanupExpired();
      }).not.toThrow();
      
      // Normal handle should still be cleaned up
      expect(registry.existsByName('normal')).toBe(false);
    });

    test('should handle invalid TTL values', () => {
      expect(() => registry.create('test', { data: 'test' }, { ttl: -1000 })).toThrow();
      expect(() => registry.create('test', { data: 'test' }, { ttl: 'invalid' })).toThrow();
      expect(() => registry.create('test', { data: 'test' }, { ttl: NaN })).toThrow();
    });
  });

  describe('Integration with LRU', () => {
    test('should work with LRU eviction', () => {
      // Create a TTL registry that also has LRU functionality
      const lruTTLRegistry = new TTLHandleRegistry({ 
        defaultTTL: 5000,
        maxSize: 2 // LRU with size 2
      });
      
      lruTTLRegistry.create('first', { data: 'first' });
      lruTTLRegistry.create('second', { data: 'second' });
      
      expect(lruTTLRegistry.size()).toBe(2);
      
      // This should trigger LRU eviction
      lruTTLRegistry.create('third', { data: 'third' });
      
      expect(lruTTLRegistry.size()).toBe(2);
      expect(lruTTLRegistry.existsByName('first')).toBe(false); // Evicted by LRU
      expect(lruTTLRegistry.existsByName('second')).toBe(true);
      expect(lruTTLRegistry.existsByName('third')).toBe(true);
    });
  });
});