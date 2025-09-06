import { StorageError } from '@legion/kg-storage-core';

/**
 * LRU Cache with TTL support for storage optimization
 */
export class LRUCache {
  constructor(maxSize = 1000, ttl = 300000) { // 5 minutes default TTL
    this.maxSize = maxSize;
    this.ttl = ttl;
    this.cache = new Map();
    this.timestamps = new Map();
    this.accessOrder = new Map(); // For LRU tracking
    this.accessCounter = 0;
    
    // Statistics
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      expired: 0,
      sets: 0
    };
  }

  /**
   * Get value from cache
   */
  get(key) {
    const now = Date.now();
    
    // Check if key exists
    if (!this.cache.has(key)) {
      this.stats.misses++;
      return undefined;
    }
    
    // Check if expired
    const timestamp = this.timestamps.get(key);
    if (now - timestamp > this.ttl) {
      this._remove(key);
      this.stats.expired++;
      this.stats.misses++;
      return undefined;
    }
    
    // Update access order for LRU
    this.accessOrder.set(key, ++this.accessCounter);
    this.stats.hits++;
    
    return this.cache.get(key);
  }

  /**
   * Set value in cache
   */
  set(key, value) {
    const now = Date.now();
    
    // If key already exists, update it
    if (this.cache.has(key)) {
      this.cache.set(key, value);
      this.timestamps.set(key, now);
      this.accessOrder.set(key, ++this.accessCounter);
      this.stats.sets++;
      return;
    }
    
    // If cache is full, evict LRU item
    if (this.cache.size >= this.maxSize) {
      this._evictLRU();
    }
    
    // Add new item
    this.cache.set(key, value);
    this.timestamps.set(key, now);
    this.accessOrder.set(key, ++this.accessCounter);
    this.stats.sets++;
  }

  /**
   * Check if key exists and is not expired
   */
  has(key) {
    const now = Date.now();
    
    if (!this.cache.has(key)) {
      return false;
    }
    
    const timestamp = this.timestamps.get(key);
    if (now - timestamp > this.ttl) {
      this._remove(key);
      this.stats.expired++;
      return false;
    }
    
    return true;
  }

  /**
   * Delete key from cache
   */
  delete(key) {
    return this._remove(key);
  }

  /**
   * Clear all cache entries
   */
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    this.timestamps.clear();
    this.accessOrder.clear();
    this.accessCounter = 0;
    return size;
  }

  /**
   * Get cache size
   */
  size() {
    return this.cache.size;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      size: this.cache.size,
      maxSize: this.maxSize,
      ttl: this.ttl
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      expired: 0,
      sets: 0
    };
  }

  /**
   * Clean expired entries
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, timestamp] of this.timestamps.entries()) {
      if (now - timestamp > this.ttl) {
        this._remove(key);
        this.stats.expired++;
        cleaned++;
      }
    }
    
    return cleaned;
  }

  /**
   * Get all keys (non-expired)
   */
  keys() {
    this.cleanup(); // Clean expired entries first
    return Array.from(this.cache.keys());
  }

  /**
   * Get all values (non-expired)
   */
  values() {
    this.cleanup(); // Clean expired entries first
    return Array.from(this.cache.values());
  }

  /**
   * Get all entries (non-expired)
   */
  entries() {
    this.cleanup(); // Clean expired entries first
    return Array.from(this.cache.entries());
  }

  // Private methods

  /**
   * Remove key from all maps
   */
  _remove(key) {
    const existed = this.cache.has(key);
    this.cache.delete(key);
    this.timestamps.delete(key);
    this.accessOrder.delete(key);
    return existed;
  }

  /**
   * Evict least recently used item
   */
  _evictLRU() {
    let lruKey = null;
    let lruAccess = Infinity;
    
    for (const [key, access] of this.accessOrder.entries()) {
      if (access < lruAccess) {
        lruAccess = access;
        lruKey = key;
      }
    }
    
    if (lruKey !== null) {
      this._remove(lruKey);
      this.stats.evictions++;
    }
  }
}

/**
 * Cache layer wrapper for storage providers
 */
export class CacheLayer {
  constructor(storage, options = {}) {
    this.storage = storage;
    this.enabled = options.enabled !== false;
    this.cacheSize = options.cacheSize || 1000;
    this.ttl = options.ttl || 300000; // 5 minutes
    this.cacheQueries = options.cacheQueries !== false;
    this.cacheExists = options.cacheExists !== false;
    this.cacheSize = options.cacheSize !== false;
    
    // Separate caches for different operations
    this.queryCache = new LRUCache(this.cacheSize, this.ttl);
    this.existsCache = new LRUCache(Math.floor(this.cacheSize / 2), this.ttl);
    this.sizeCache = new LRUCache(1, Math.min(this.ttl, 60000)); // Size cache with shorter TTL
    
    // Cache invalidation patterns
    this.invalidationPatterns = new Set();
  }

  /**
   * Get metadata including cache stats
   */
  getMetadata() {
    const baseMetadata = this.storage.getMetadata();
    return {
      ...baseMetadata,
      cached: true,
      cacheEnabled: this.enabled,
      cacheStats: {
        query: this.queryCache.getStats(),
        exists: this.existsCache.getStats(),
        size: this.sizeCache.getStats()
      }
    };
  }

  /**
   * Add a triple with cache invalidation
   */
  async addTriple(subject, predicate, object) {
    const result = await this.storage.addTriple(subject, predicate, object);
    
    if (result && this.enabled) {
      this._invalidateForTriple(subject, predicate, object);
    }
    
    return result;
  }

  /**
   * Remove a triple with cache invalidation
   */
  async removeTriple(subject, predicate, object) {
    const result = await this.storage.removeTriple(subject, predicate, object);
    
    if (result && this.enabled) {
      this._invalidateForTriple(subject, predicate, object);
    }
    
    return result;
  }

  /**
   * Query triples with caching
   */
  async query(subject, predicate, object) {
    if (!this.enabled || !this.cacheQueries) {
      return await this.storage.query(subject, predicate, object);
    }
    
    const cacheKey = this._getQueryCacheKey(subject, predicate, object);
    
    // Check cache first
    const cached = this.queryCache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }
    
    // Execute query and cache result
    const result = await this.storage.query(subject, predicate, object);
    this.queryCache.set(cacheKey, result);
    
    return result;
  }

  /**
   * Get size with caching
   */
  async size() {
    if (!this.enabled || !this.cacheSize) {
      return await this.storage.size();
    }
    
    const cacheKey = 'size';
    
    // Check cache first
    const cached = this.sizeCache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }
    
    // Execute and cache result
    const result = await this.storage.size();
    this.sizeCache.set(cacheKey, result);
    
    return result;
  }

  /**
   * Check existence with caching
   */
  async exists(subject, predicate, object) {
    if (!this.enabled || !this.cacheExists) {
      return await this.storage.exists(subject, predicate, object);
    }
    
    const cacheKey = this._getExistsCacheKey(subject, predicate, object);
    
    // Check cache first
    const cached = this.existsCache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }
    
    // Execute and cache result
    const result = await this.storage.exists(subject, predicate, object);
    this.existsCache.set(cacheKey, result);
    
    return result;
  }

  /**
   * Clear all data and caches
   */
  async clear() {
    const result = await this.storage.clear();
    
    if (this.enabled) {
      this.queryCache.clear();
      this.existsCache.clear();
      this.sizeCache.clear();
    }
    
    return result;
  }

  /**
   * Add multiple triples with cache invalidation
   */
  async addTriples(triples) {
    const result = await this.storage.addTriples(triples);
    
    if (result > 0 && this.enabled) {
      for (const [s, p, o] of triples) {
        this._invalidateForTriple(s, p, o);
      }
    }
    
    return result;
  }

  /**
   * Remove multiple triples with cache invalidation
   */
  async removeTriples(triples) {
    const result = await this.storage.removeTriples(triples);
    
    if (result > 0 && this.enabled) {
      for (const [s, p, o] of triples) {
        this._invalidateForTriple(s, p, o);
      }
    }
    
    return result;
  }

  /**
   * Begin transaction (pass through)
   */
  async beginTransaction() {
    if (this.storage.beginTransaction) {
      return await this.storage.beginTransaction();
    }
    throw new StorageError('Transactions not supported by underlying storage');
  }

  /**
   * Close storage and cleanup caches
   */
  async close() {
    if (this.storage.close) {
      await this.storage.close();
    }
    
    if (this.enabled) {
      this.queryCache.clear();
      this.existsCache.clear();
      this.sizeCache.clear();
    }
  }

  /**
   * Warm cache with common queries
   */
  async warmCache(patterns = []) {
    if (!this.enabled) return;
    
    const defaultPatterns = [
      [null, null, null], // All triples
      [null, 'type', null], // All type assertions
      [null, 'label', null], // All labels
    ];
    
    const allPatterns = [...defaultPatterns, ...patterns];
    
    for (const [s, p, o] of allPatterns) {
      try {
        await this.query(s, p, o);
      } catch (error) {
        // Ignore errors during cache warming
        console.warn(`Cache warming failed for pattern [${s}, ${p}, ${o}]:`, error.message);
      }
    }
  }

  /**
   * Clear all caches
   */
  clearCache() {
    if (this.enabled) {
      this.queryCache.clear();
      this.existsCache.clear();
      this.sizeCache.clear();
    }
  }

  /**
   * Get comprehensive cache statistics
   */
  getCacheStats() {
    if (!this.enabled) {
      return { enabled: false };
    }
    
    return {
      enabled: true,
      query: this.queryCache.getStats(),
      exists: this.existsCache.getStats(),
      size: this.sizeCache.getStats(),
      totalMemoryUsage: this._estimateMemoryUsage()
    };
  }

  /**
   * Cleanup expired cache entries
   */
  cleanupCache() {
    if (!this.enabled) return 0;
    
    return this.queryCache.cleanup() + 
           this.existsCache.cleanup() + 
           this.sizeCache.cleanup();
  }

  // Private methods

  /**
   * Generate cache key for query
   */
  _getQueryCacheKey(subject, predicate, object) {
    return `q:${subject || '*'}|${predicate || '*'}|${JSON.stringify(object) || '*'}`;
  }

  /**
   * Generate cache key for exists check
   */
  _getExistsCacheKey(subject, predicate, object) {
    return `e:${subject}|${predicate}|${JSON.stringify(object)}`;
  }

  /**
   * Invalidate cache entries for a triple
   */
  _invalidateForTriple(subject, predicate, object) {
    // Invalidate size cache
    this.sizeCache.clear();
    
    // Invalidate specific exists cache entry
    const existsKey = this._getExistsCacheKey(subject, predicate, object);
    this.existsCache.delete(existsKey);
    
    // Invalidate query cache entries that might include this triple
    const keysToRemove = [];
    
    for (const key of this.queryCache.keys()) {
      if (this._queryKeyMatches(key, subject, predicate, object)) {
        keysToRemove.push(key);
      }
    }
    
    for (const key of keysToRemove) {
      this.queryCache.delete(key);
    }
  }

  /**
   * Check if a query cache key might include the given triple
   */
  _queryKeyMatches(cacheKey, subject, predicate, object) {
    if (!cacheKey.startsWith('q:')) return false;
    
    const [, pattern] = cacheKey.split(':', 2);
    const [s, p, o] = pattern.split('|');
    
    // Check if the cache pattern would match this triple
    return (s === '*' || s === subject) &&
           (p === '*' || p === predicate) &&
           (o === '*' || o === JSON.stringify(object));
  }

  /**
   * Estimate memory usage of caches
   */
  _estimateMemoryUsage() {
    // Rough estimation - would be more accurate with actual memory profiling
    const querySize = this.queryCache.size() * 100; // Assume 100 bytes per entry
    const existsSize = this.existsCache.size() * 50; // Assume 50 bytes per entry
    const sizeSize = this.sizeCache.size() * 20; // Assume 20 bytes per entry
    
    return {
      query: querySize,
      exists: existsSize,
      size: sizeSize,
      total: querySize + existsSize + sizeSize
    };
  }
}

/**
 * Factory function to wrap any storage with caching
 */
export function withCache(storage, options = {}) {
  return new CacheLayer(storage, options);
}
