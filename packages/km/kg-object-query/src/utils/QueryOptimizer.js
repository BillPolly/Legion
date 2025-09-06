/**
 * QueryOptimizer - Optimization utilities for KG-based queries
 * 
 * Provides caching and optimization strategies for frequently accessed paths
 */

export class QueryOptimizer {
  constructor() {
    this.pathCache = new Map();
    this.tripleCache = new Map();
  }
  
  /**
   * Cache path traversal results
   * @param {string} path - Path that was traversed
   * @param {*} result - Result of traversal
   * @param {number} ttl - Time to live in milliseconds (default 5 minutes)
   */
  cachePath(path, result, ttl = 300000) {
    const cacheKey = this._generateCacheKey(path);
    const expiry = Date.now() + ttl;
    
    this.pathCache.set(cacheKey, {
      result,
      expiry,
      accessCount: 1,
      lastAccess: Date.now()
    });
  }
  
  /**
   * Get cached path result
   * @param {string} path - Path to look up
   * @returns {*} Cached result or null if not found/expired
   */
  getCachedPath(path) {
    const cacheKey = this._generateCacheKey(path);
    const cached = this.pathCache.get(cacheKey);
    
    if (!cached) {
      return null;
    }
    
    if (Date.now() > cached.expiry) {
      this.pathCache.delete(cacheKey);
      return null;
    }
    
    // Update access statistics
    cached.accessCount++;
    cached.lastAccess = Date.now();
    
    return cached.result;
  }
  
  /**
   * Cache triple query results
   * @param {string} subject - Triple subject
   * @param {string} predicate - Triple predicate
   * @param {string} object - Triple object
   * @param {Array} triples - Query result triples
   */
  cacheTripleQuery(subject, predicate, object, triples) {
    const cacheKey = this._generateTripleKey(subject, predicate, object);
    
    this.tripleCache.set(cacheKey, {
      triples: [...triples], // Deep copy
      timestamp: Date.now(),
      accessCount: 1
    });
  }
  
  /**
   * Get cached triple query result
   * @param {string} subject - Triple subject
   * @param {string} predicate - Triple predicate  
   * @param {string} object - Triple object
   * @returns {Array|null} Cached triples or null
   */
  getCachedTripleQuery(subject, predicate, object) {
    const cacheKey = this._generateTripleKey(subject, predicate, object);
    const cached = this.tripleCache.get(cacheKey);
    
    if (!cached) {
      return null;
    }
    
    // Triple cache doesn't expire (assumes immutable data during query session)
    cached.accessCount++;
    return [...cached.triples]; // Return copy
  }
  
  /**
   * Clear all caches
   */
  clearCache() {
    this.pathCache.clear();
    this.tripleCache.clear();
  }
  
  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getStats() {
    const pathStats = Array.from(this.pathCache.values());
    const tripleStats = Array.from(this.tripleCache.values());
    
    return {
      pathCache: {
        size: this.pathCache.size,
        totalAccesses: pathStats.reduce((sum, item) => sum + item.accessCount, 0),
        averageAccesses: pathStats.length > 0 ? 
          pathStats.reduce((sum, item) => sum + item.accessCount, 0) / pathStats.length : 0
      },
      tripleCache: {
        size: this.tripleCache.size,
        totalAccesses: tripleStats.reduce((sum, item) => sum + item.accessCount, 0),
        averageAccesses: tripleStats.length > 0 ?
          tripleStats.reduce((sum, item) => sum + item.accessCount, 0) / tripleStats.length : 0
      }
    };
  }
  
  /**
   * Clean expired entries from cache
   */
  cleanup() {
    const now = Date.now();
    
    for (const [key, value] of this.pathCache) {
      if (now > value.expiry) {
        this.pathCache.delete(key);
      }
    }
    
    // Triple cache cleanup - remove least recently used if too large
    if (this.tripleCache.size > 1000) {
      const entries = Array.from(this.tripleCache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      // Remove oldest 25%
      const toRemove = entries.slice(0, Math.floor(entries.length * 0.25));
      toRemove.forEach(([key]) => this.tripleCache.delete(key));
    }
  }
  
  /**
   * Generate cache key for path
   * @private
   */
  _generateCacheKey(path) {
    return `path:${path}`;
  }
  
  /**
   * Generate cache key for triple pattern
   * @private  
   */
  _generateTripleKey(subject, predicate, object) {
    return `triple:${subject || '*'}:${predicate || '*'}:${object || '*'}`;
  }
}