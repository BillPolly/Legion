/**
 * LRUCache - Least Recently Used cache implementation
 * 
 * Provides efficient caching with automatic eviction based on
 * usage patterns and TTL (time-to-live) expiration
 */

export class LRUCache {
  constructor({ maxSize = 1000, ttl = 3600000 } = {}) {
    if (maxSize <= 0) {
      throw new Error('maxSize must be greater than 0');
    }
    
    this.maxSize = maxSize;
    this.ttl = ttl; // Time to live in milliseconds
    this.cache = new Map();
    
    // Statistics
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  /**
   * Get value from cache
   */
  get(key) {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.misses++;
      return undefined;
    }

    // Check if expired
    if (this.ttl > 0 && Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      this.misses++;
      return undefined;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, {
      value: entry.value,
      timestamp: Date.now()
    });

    this.hits++;
    return entry.value;
  }

  /**
   * Set value in cache
   */
  set(key, value) {
    // If key exists, update and move to end
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Evict least recently used (first item)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
      this.evictions++;
    }

    this.cache.set(key, {
      value: value,
      timestamp: Date.now()
    });
  }

  /**
   * Check if key exists in cache
   */
  has(key) {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }

    // Check if expired
    if (this.ttl > 0 && Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete key from cache
   */
  delete(key) {
    return this.cache.delete(key);
  }

  /**
   * Clear all cached items
   */
  clear() {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  /**
   * Get current cache size
   */
  get size() {
    return this.cache.size;
  }

  /**
   * Get all keys (most recent first)
   */
  keys() {
    return Array.from(this.cache.keys()).reverse();
  }

  /**
   * Get all values (most recent first)
   */
  values() {
    return Array.from(this.cache.values()).reverse().map(entry => entry.value);
  }

  /**
   * Get all entries as [key, value] pairs (most recent first)
   */
  entries() {
    return Array.from(this.cache.entries()).reverse()
      .map(([key, entry]) => [key, entry.value]);
  }

  /**
   * Cleanup expired entries
   */
  cleanup() {
    if (this.ttl <= 0) return 0;

    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      hitRate: this.hits + this.misses > 0 ? 
        (this.hits / (this.hits + this.misses)).toFixed(3) : '0.000',
      utilizationRate: (this.cache.size / this.maxSize).toFixed(3)
    };
  }

  /**
   * Peek at value without updating LRU order
   */
  peek(key) {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return undefined;
    }

    // Check if expired
    if (this.ttl > 0 && Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  /**
   * Get oldest entry (least recently used)
   */
  getOldest() {
    if (this.cache.size === 0) {
      return undefined;
    }

    const firstEntry = this.cache.entries().next().value;
    return {
      key: firstEntry[0],
      value: firstEntry[1].value,
      timestamp: firstEntry[1].timestamp
    };
  }

  /**
   * Get newest entry (most recently used)
   */
  getNewest() {
    if (this.cache.size === 0) {
      return undefined;
    }

    const entries = Array.from(this.cache.entries());
    const lastEntry = entries[entries.length - 1];
    
    return {
      key: lastEntry[0],
      value: lastEntry[1].value,
      timestamp: lastEntry[1].timestamp
    };
  }

  /**
   * Set TTL for specific key
   */
  expire(key, ttlMs) {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    // Update timestamp to create custom expiration
    entry.timestamp = Date.now() - (this.ttl - ttlMs);
    return true;
  }

  /**
   * Get TTL remaining for key
   */
  getTTL(key) {
    const entry = this.cache.get(key);
    if (!entry) {
      return -1;
    }

    if (this.ttl <= 0) {
      return Infinity;
    }

    const elapsed = Date.now() - entry.timestamp;
    const remaining = this.ttl - elapsed;
    
    return Math.max(0, remaining);
  }

  /**
   * Iterator support
   */
  *[Symbol.iterator]() {
    for (const [key, entry] of this.cache) {
      yield [key, entry.value];
    }
  }

  /**
   * JSON serialization
   */
  toJSON() {
    return {
      maxSize: this.maxSize,
      ttl: this.ttl,
      size: this.cache.size,
      entries: Array.from(this.cache.entries()).map(([key, entry]) => ({
        key,
        value: entry.value,
        timestamp: entry.timestamp
      })),
      stats: this.getStats()
    };
  }

  /**
   * Create cache from JSON
   */
  static fromJSON(data) {
    const cache = new LRUCache({
      maxSize: data.maxSize,
      ttl: data.ttl
    });

    // Restore entries in order
    for (const entry of data.entries) {
      cache.cache.set(entry.key, {
        value: entry.value,
        timestamp: entry.timestamp
      });
    }

    return cache;
  }
}