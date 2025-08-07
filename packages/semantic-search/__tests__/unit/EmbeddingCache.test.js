/**
 * Tests for EmbeddingCache
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { EmbeddingCache } from '../../src/utils/EmbeddingCache.js';

describe('EmbeddingCache', () => {
  let cache;
  let mockResourceManager;
  
  beforeEach(() => {
    mockResourceManager = {
      get: jest.fn().mockReturnValue(null)
    };
    
    cache = new EmbeddingCache({
      ttl: 60, // 60 seconds for testing
      maxSize: 10,
      resourceManager: mockResourceManager
    });
  });
  
  afterEach(async () => {
    if (cache) {
      await cache.close();
    }
  });
  
  describe('Basic Operations', () => {
    it('should store and retrieve embeddings', async () => {
      const text = 'test text';
      const embedding = [0.1, 0.2, 0.3];
      
      await cache.set(text, embedding);
      const retrieved = await cache.get(text);
      
      expect(retrieved).toEqual(embedding);
    });
    
    it('should return null for non-existent keys', async () => {
      const result = await cache.get('non-existent');
      expect(result).toBeNull();
    });
    
    it('should check if embedding exists', async () => {
      const text = 'test';
      const embedding = [0.1];
      
      expect(await cache.has(text)).toBe(false);
      
      await cache.set(text, embedding);
      
      expect(await cache.has(text)).toBe(true);
    });
    
    it('should clear all cached items', async () => {
      await cache.set('text1', [0.1]);
      await cache.set('text2', [0.2]);
      
      expect(cache.cache.size).toBe(2);
      
      await cache.clear();
      
      expect(cache.cache.size).toBe(0);
      expect(await cache.get('text1')).toBeNull();
      expect(await cache.get('text2')).toBeNull();
    });
  });
  
  describe('TTL Expiration', () => {
    it('should expire items after TTL', async () => {
      const shortCache = new EmbeddingCache({
        ttl: 0.1, // 100ms
        resourceManager: mockResourceManager
      });
      
      await shortCache.set('text', [0.1]);
      
      // Should exist immediately
      expect(await shortCache.get('text')).toEqual([0.1]);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Should be expired
      expect(await shortCache.get('text')).toBeNull();
      
      await shortCache.close();
    });
    
    it('should update timestamp on access', async () => {
      const text = 'test';
      const embedding = [0.1];
      
      await cache.set(text, embedding);
      const initialTimestamp = cache.timestamps.get(cache._generateKey(text));
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Access the item
      await cache.get(text);
      const newTimestamp = cache.timestamps.get(cache._generateKey(text));
      
      expect(newTimestamp).toBeGreaterThan(initialTimestamp);
    });
  });
  
  describe('LRU Eviction', () => {
    it('should evict oldest items when max size reached', async () => {
      const smallCache = new EmbeddingCache({
        ttl: 3600,
        maxSize: 3,
        resourceManager: mockResourceManager
      });
      
      // Fill cache
      await smallCache.set('text1', [0.1]);
      await smallCache.set('text2', [0.2]);
      await smallCache.set('text3', [0.3]);
      
      expect(smallCache.cache.size).toBe(3);
      
      // Add one more - should evict oldest
      await smallCache.set('text4', [0.4]);
      
      // Cache size should not exceed max
      expect(smallCache.cache.size).toBeLessThanOrEqual(3);
      
      await smallCache.close();
    });
  });
  
  describe('Cache Statistics', () => {
    it('should provide cache statistics', async () => {
      await cache.set('text1', [0.1]);
      await cache.set('text2', [0.2]);
      
      const stats = cache.getStats();
      
      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(10);
      expect(stats.ttlSeconds).toBe(60);
      expect(stats.memoryUsage).toBeGreaterThan(0);
      expect(stats.expired).toBeDefined();
      expect(stats.hitRatio).toBeDefined();
    });
  });
  
  describe('Key Generation', () => {
    it('should generate consistent keys for same text', () => {
      const text = 'test text';
      
      const key1 = cache._generateKey(text);
      const key2 = cache._generateKey(text);
      
      expect(key1).toBe(key2);
      expect(typeof key1).toBe('string');
      expect(key1.length).toBe(64); // SHA256 hex length
    });
    
    it('should generate different keys for different text', () => {
      const key1 = cache._generateKey('text1');
      const key2 = cache._generateKey('text2');
      
      expect(key1).not.toBe(key2);
    });
  });
  
  describe('Cleanup', () => {
    it('should clean up expired entries', async () => {
      const shortCache = new EmbeddingCache({
        ttl: 0.1, // 100ms
        resourceManager: mockResourceManager
      });
      
      await shortCache.set('text1', [0.1]);
      await shortCache.set('text2', [0.2]);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Manually trigger cleanup
      shortCache._cleanup();
      
      expect(shortCache.cache.size).toBe(0);
      
      await shortCache.close();
    });
  });
  
  describe('Memory Estimation', () => {
    it('should estimate memory usage', () => {
      const estimation = cache._estimateMemoryUsage();
      
      expect(typeof estimation).toBe('number');
      expect(estimation).toBeGreaterThanOrEqual(0);
    });
    
    it('should increase memory estimation with more items', async () => {
      const initial = cache._estimateMemoryUsage();
      
      await cache.set('text1', new Array(1536).fill(0.1));
      await cache.set('text2', new Array(1536).fill(0.2));
      
      const after = cache._estimateMemoryUsage();
      
      expect(after).toBeGreaterThan(initial);
    });
  });
});