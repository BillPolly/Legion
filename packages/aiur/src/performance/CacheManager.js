/**
 * Cache Manager
 * 
 * Provides LRU caching with TTL support, cache warming,
 * statistics tracking, and pattern-based invalidation
 */

export class CacheManager {
  constructor(options = {}) {
    this.options = {
      maxSize: options.maxSize || 1000,
      ttl: options.ttl || 300000, // 5 minutes default
      strategy: options.strategy || 'lru',
      ...options
    };

    // Cache storage
    this.cache = new Map();
    this.accessTimes = new Map();
    this.expirationTimes = new Map();

    // Statistics
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      size: 0
    };

    // Cleanup timer
    this.cleanupInterval = setInterval(() => {
      this._cleanup();
    }, 60000); // Cleanup every minute
  }

  /**
   * Set cache value
   */
  set(key, value, ttl = null) {
    const now = Date.now();
    const expiresAt = now + (ttl || this.options.ttl);

    // Check if we need to evict (only if adding new key)
    if (this.cache.size >= this.options.maxSize && !this.cache.has(key)) {
      this._evict();
    }

    // Store value and update access time
    const isNewKey = !this.cache.has(key);
    this.cache.set(key, value);
    
    // For new entries, ensure unique access time that's later than existing ones
    if (isNewKey && this.accessTimes.size > 0) {
      const maxAccessTime = Math.max(...Array.from(this.accessTimes.values()));
      this.accessTimes.set(key, Math.max(now, maxAccessTime + 1));
    } else {
      this.accessTimes.set(key, now);
    }
    this.expirationTimes.set(key, expiresAt);

    this.stats.size = this.cache.size;
  }

  /**
   * Get cache value
   */
  get(key) {
    const now = Date.now();

    // Check if key exists
    if (!this.cache.has(key)) {
      this.stats.misses++;
      return null;
    }

    // Check expiration
    const expiresAt = this.expirationTimes.get(key);
    if (now > expiresAt) {
      this._remove(key);
      this.stats.misses++;
      return null;
    }

    // Update access time for LRU - ensure it's newer than all existing access times
    const maxAccessTime = this.accessTimes.size > 0 ? 
      Math.max(...Array.from(this.accessTimes.values())) : 0;
    const newAccessTime = Math.max(now, maxAccessTime + 1);
    this.accessTimes.set(key, newAccessTime);
    this.stats.hits++;

    return this.cache.get(key);
  }

  /**
   * Check if key exists and is valid
   */
  has(key) {
    return this.get(key) !== null;
  }

  /**
   * Delete cache entry
   */
  delete(key) {
    const existed = this.cache.has(key);
    this._remove(key);
    return existed;
  }

  /**
   * Clear all cache entries
   */
  clear() {
    this.cache.clear();
    this.accessTimes.clear();
    this.expirationTimes.clear();
    this.stats.size = 0;
  }

  /**
   * Get cache statistics
   */
  getStatistics() {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;

    return {
      size: this.cache.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      evictions: this.stats.evictions,
      hitRate,
      maxSize: this.options.maxSize
    };
  }

  /**
   * Warm cache with data
   */
  async warmup(data) {
    const promises = data.map(({ key, value, ttl }) => 
      Promise.resolve(this.set(key, value, ttl))
    );
    
    await Promise.all(promises);
  }

  /**
   * Invalidate cache entries by pattern
   */
  invalidatePattern(pattern) {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    let invalidated = 0;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this._remove(key);
        invalidated++;
      }
    }

    return invalidated;
  }

  /**
   * Get cache keys
   */
  keys() {
    return Array.from(this.cache.keys());
  }

  /**
   * Get all cache entries
   */
  entries() {
    const entries = [];
    const now = Date.now();

    for (const [key, value] of this.cache.entries()) {
      const expiresAt = this.expirationTimes.get(key);
      if (now <= expiresAt) {
        entries.push({
          key,
          value,
          expiresAt,
          accessedAt: this.accessTimes.get(key)
        });
      }
    }

    return entries;
  }

  /**
   * Stop cache manager and cleanup
   */
  stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Remove entry from all maps
   * @private
   */
  _remove(key) {
    this.cache.delete(key);
    this.accessTimes.delete(key);
    this.expirationTimes.delete(key);
    this.stats.size = this.cache.size;
  }

  /**
   * Evict entries based on strategy
   * @private
   */
  _evict() {
    if (this.options.strategy === 'lru') {
      this._evictLRU();
    } else if (this.options.strategy === 'ttl') {
      this._evictByTTL();
    }
  }

  /**
   * Evict least recently used entry
   * @private
   */
  _evictLRU() {
    let oldestKey = null;
    let oldestTime = Infinity;

    // Only consider keys that are actually in the cache
    for (const [key, accessTime] of this.accessTimes.entries()) {
      if (this.cache.has(key) && accessTime < oldestTime) {
        oldestTime = accessTime;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this._remove(oldestKey);
      this.stats.evictions++;
    }
  }

  /**
   * Evict entry with shortest remaining TTL
   * @private
   */
  _evictByTTL() {
    let shortestTTLKey = null;
    let shortestExpiration = Infinity;

    for (const [key, expirationTime] of this.expirationTimes.entries()) {
      if (expirationTime < shortestExpiration) {
        shortestExpiration = expirationTime;
        shortestTTLKey = key;
      }
    }

    if (shortestTTLKey) {
      this._remove(shortestTTLKey);
      this.stats.evictions++;
    }
  }

  /**
   * Clean up expired entries
   * @private
   */
  _cleanup() {
    const now = Date.now();
    const keysToRemove = [];

    for (const [key, expirationTime] of this.expirationTimes.entries()) {
      if (now > expirationTime) {
        keysToRemove.push(key);
      }
    }

    for (const key of keysToRemove) {
      this._remove(key);
    }
  }
}