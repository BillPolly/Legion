/**
 * CacheManager for performance optimization
 * Per design §14: Implements caching and reuse strategies
 * 
 * This module provides:
 * - LRU cache for GraphSpecs
 * - Result caching with TTL
 * - Predicate graph sharing
 * - Memory management
 */

import { EventEmitter } from 'events';

/**
 * LRU Cache implementation
 */
class LRUCache {
  constructor(maxSize = 100, ttl = null) {
    this._maxSize = maxSize;
    this._ttl = ttl; // Time to live in milliseconds
    this._cache = new Map();
    this._accessOrder = new Map(); // key -> last access time
    this._hits = 0;
    this._misses = 0;
  }

  /**
   * Get value from cache
   */
  get(key) {
    if (this._cache.has(key)) {
      const entry = this._cache.get(key);
      
      // Check TTL if configured
      if (this._ttl && entry.timestamp) {
        const age = Date.now() - entry.timestamp;
        if (age > this._ttl) {
          this._cache.delete(key);
          this._accessOrder.delete(key);
          this._misses++;
          return undefined;
        }
      }
      
      // Update access order
      this._accessOrder.set(key, Date.now());
      this._hits++;
      return entry.value;
    }
    
    this._misses++;
    return undefined;
  }

  /**
   * Set value in cache
   */
  set(key, value) {
    // Check if we need to evict
    if (!this._cache.has(key) && this._cache.size >= this._maxSize) {
      this._evictLRU();
    }
    
    this._cache.set(key, {
      value: value,
      timestamp: Date.now()
    });
    this._accessOrder.set(key, Date.now());
  }

  /**
   * Check if key exists
   */
  has(key) {
    return this._cache.has(key);
  }

  /**
   * Delete from cache
   */
  delete(key) {
    this._cache.delete(key);
    this._accessOrder.delete(key);
  }

  /**
   * Clear cache
   */
  clear() {
    this._cache.clear();
    this._accessOrder.clear();
    this._hits = 0;
    this._misses = 0;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const hitRate = this._hits + this._misses > 0 
      ? this._hits / (this._hits + this._misses) 
      : 0;
    
    return {
      size: this._cache.size,
      maxSize: this._maxSize,
      hits: this._hits,
      misses: this._misses,
      hitRate: hitRate,
      ttl: this._ttl
    };
  }

  /**
   * Evict least recently used item
   */
  _evictLRU() {
    let oldestKey = null;
    let oldestTime = Date.now();
    
    for (const [key, time] of this._accessOrder.entries()) {
      if (time < oldestTime) {
        oldestTime = time;
        oldestKey = key;
      }
    }
    
    if (oldestKey !== null) {
      this.delete(oldestKey);
    }
  }
}

/**
 * Cache Manager for DataStore performance optimization
 */
export class CacheManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this._options = {
      graphSpecCacheSize: options.graphSpecCacheSize || 1000,
      graphSpecTTL: options.graphSpecTTL || null, // No TTL by default
      resultCacheSize: options.resultCacheSize || 500,
      resultTTL: options.resultTTL || 60000, // 1 minute default
      predicateCacheSize: options.predicateCacheSize || 100,
      predicateTTL: options.predicateTTL || 300000, // 5 minutes default
      enableStatistics: options.enableStatistics !== false
    };
    
    // Initialize caches
    this._graphSpecCache = new LRUCache(
      this._options.graphSpecCacheSize,
      this._options.graphSpecTTL
    );
    
    this._resultCache = new LRUCache(
      this._options.resultCacheSize,
      this._options.resultTTL
    );
    
    this._predicateCache = new LRUCache(
      this._options.predicateCacheSize,
      this._options.predicateTTL
    );
    
    // Shared predicate graphs
    this._sharedPredicates = new Map();
    
    // Iterator factory cache
    this._iteratorFactories = new Map();
    
    // Statistics
    this._stats = {
      graphSpecReuse: 0,
      resultCacheHits: 0,
      predicateSharing: 0,
      memoryReclaimed: 0
    };
  }

  /**
   * Get or create GraphSpec with caching
   */
  getOrCreateGraphSpec(key, factory) {
    // Check cache first
    let spec = this._graphSpecCache.get(key);
    
    if (spec) {
      this._stats.graphSpecReuse++;
      this.emit('cacheHit', { type: 'graphSpec', key });
      return spec;
    }
    
    // Create new spec
    spec = factory();
    this._graphSpecCache.set(key, spec);
    this.emit('cacheMiss', { type: 'graphSpec', key });
    
    return spec;
  }

  /**
   * Cache query results
   */
  cacheResults(queryId, results, ttl = null) {
    const cache = {
      results: results,
      timestamp: Date.now(),
      queryId: queryId
    };
    
    // Use custom TTL if provided
    if (ttl !== null) {
      const customCache = new LRUCache(1, ttl);
      customCache.set(queryId, cache);
      this._resultCache.set(queryId, customCache);
    } else {
      this._resultCache.set(queryId, cache);
    }
    
    this.emit('resultsCached', { queryId, size: results.length });
  }

  /**
   * Get cached results
   */
  getCachedResults(queryId) {
    const cached = this._resultCache.get(queryId);
    
    if (cached) {
      this._stats.resultCacheHits++;
      this.emit('cacheHit', { type: 'results', queryId });
      return cached.results;
    }
    
    this.emit('cacheMiss', { type: 'results', queryId });
    return null;
  }

  /**
   * Share predicate graph across queries
   */
  getOrCreateSharedPredicate(predicateName, factory) {
    if (this._sharedPredicates.has(predicateName)) {
      this._stats.predicateSharing++;
      return this._sharedPredicates.get(predicateName);
    }
    
    const predicate = factory();
    this._sharedPredicates.set(predicateName, predicate);
    
    this.emit('predicateShared', { name: predicateName });
    return predicate;
  }

  /**
   * Cache iterator factory for reuse
   */
  cacheIteratorFactory(relationName, factory) {
    if (!this._iteratorFactories.has(relationName)) {
      this._iteratorFactories.set(relationName, factory);
    }
    return this._iteratorFactories.get(relationName);
  }

  /**
   * Get cached iterator factory
   */
  getIteratorFactory(relationName) {
    return this._iteratorFactories.get(relationName);
  }

  /**
   * Invalidate caches for a specific query
   */
  invalidateQuery(queryId) {
    // Remove from result cache
    this._resultCache.delete(queryId);
    
    // Invalidate related GraphSpecs
    // Note: This is simplified - in production you'd track query->spec mapping
    
    this.emit('cacheInvalidated', { queryId });
  }

  /**
   * Invalidate all caches for a relation
   */
  invalidateRelation(relationName) {
    // Clear iterator factory
    this._iteratorFactories.delete(relationName);
    
    // Clear affected results
    // Note: In production, track which queries use which relations
    
    this.emit('relationInvalidated', { relationName });
  }

  /**
   * Memory management - clear old entries
   */
  performGarbageCollection() {
    const startMemory = process.memoryUsage().heapUsed;
    
    // Clear expired entries from all caches
    const now = Date.now();
    let cleared = 0;
    
    // Clear expired results
    for (const [key, entry] of this._resultCache._cache.entries()) {
      if (this._options.resultTTL && entry.timestamp) {
        const age = now - entry.timestamp;
        if (age > this._options.resultTTL) {
          this._resultCache.delete(key);
          cleared++;
        }
      }
    }
    
    // Clear expired predicates
    for (const [key, entry] of this._predicateCache._cache.entries()) {
      if (this._options.predicateTTL && entry.timestamp) {
        const age = now - entry.timestamp;
        if (age > this._options.predicateTTL) {
          this._predicateCache.delete(key);
          cleared++;
        }
      }
    }
    
    // Force V8 garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    const endMemory = process.memoryUsage().heapUsed;
    const reclaimed = startMemory - endMemory;
    
    if (reclaimed > 0) {
      this._stats.memoryReclaimed += reclaimed;
    }
    
    this.emit('garbageCollected', {
      cleared: cleared,
      memoryReclaimed: reclaimed
    });
    
    return {
      cleared: cleared,
      memoryReclaimed: reclaimed
    };
  }

  /**
   * Get cache statistics
   */
  getStatistics() {
    return {
      graphSpecCache: this._graphSpecCache.getStats(),
      resultCache: this._resultCache.getStats(),
      predicateCache: this._predicateCache.getStats(),
      sharedPredicates: this._sharedPredicates.size,
      iteratorFactories: this._iteratorFactories.size,
      performance: {
        graphSpecReuse: this._stats.graphSpecReuse,
        resultCacheHits: this._stats.resultCacheHits,
        predicateSharing: this._stats.predicateSharing,
        memoryReclaimed: this._stats.memoryReclaimed
      }
    };
  }

  /**
   * Clear all caches
   */
  clear() {
    this._graphSpecCache.clear();
    this._resultCache.clear();
    this._predicateCache.clear();
    this._sharedPredicates.clear();
    this._iteratorFactories.clear();
    
    this._stats = {
      graphSpecReuse: 0,
      resultCacheHits: 0,
      predicateSharing: 0,
      memoryReclaimed: 0
    };
    
    this.emit('cleared');
  }

  /**
   * Warm up caches with common queries
   */
  warmUp(commonQueries) {
    let warmed = 0;
    
    for (const query of commonQueries) {
      const { key, spec, results } = query;
      
      if (spec) {
        this._graphSpecCache.set(key, spec);
        warmed++;
      }
      
      if (results) {
        this.cacheResults(key, results);
        warmed++;
      }
    }
    
    this.emit('warmedUp', { count: warmed });
    return warmed;
  }

  /**
   * Optimize cache sizes based on usage patterns
   */
  optimizeCacheSizes() {
    const stats = this.getStatistics();
    const recommendations = {};
    
    // Check GraphSpec cache efficiency
    if (stats.graphSpecCache.hitRate < 0.5 && stats.graphSpecCache.size === stats.graphSpecCache.maxSize) {
      recommendations.graphSpecCacheSize = Math.floor(stats.graphSpecCache.maxSize * 1.5);
    }
    
    // Check result cache efficiency
    if (stats.resultCache.hitRate < 0.3) {
      recommendations.resultTTL = Math.floor(this._options.resultTTL * 0.5);
    } else if (stats.resultCache.hitRate > 0.8) {
      recommendations.resultTTL = Math.floor(this._options.resultTTL * 2);
    }
    
    // Check predicate cache
    if (stats.predicateCache.hitRate > 0.7) {
      recommendations.predicateCacheSize = Math.floor(stats.predicateCache.maxSize * 1.2);
    }
    
    this.emit('optimizationRecommendations', recommendations);
    return recommendations;
  }
}

/**
 * Create a cache manager with defaults
 */
export function createCacheManager(options = {}) {
  return new CacheManager(options);
}

// Export LRUCache for direct use if needed
export { LRUCache };