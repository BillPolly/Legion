/**
 * LRUCache - Least Recently Used cache with TTL support
 * 
 * High-performance LRU cache implementation with time-to-live (TTL) support.
 * Used extensively throughout the ResourceManager and DataSourceFactory for caching.
 */

export class LRUCache {
  constructor(options = {}) {
    this.maxSize = options.maxSize || 100;
    this.ttl = options.ttl || null; // TTL in milliseconds, null = no expiration
    
    // Use Map for O(1) insertion order and fast key lookup
    this.cache = new Map();
    
    // Statistics
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      expirations: 0
    };
  }

  /**
   * Get item from cache
   * @param {string} key - Cache key
   * @returns {*} Cached value or undefined if not found/expired
   */
  get(key) {
    const item = this.cache.get(key);
    
    if (!item) {
      this.stats.misses++;
      return undefined;
    }
    
    // Check if item has expired
    if (this.ttl && Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      this.stats.expirations++;
      this.stats.misses++;
      return undefined;
    }
    
    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, {
      value: item.value,
      timestamp: Date.now() // Update access time
    });
    
    this.stats.hits++;
    return item.value;
  }

  /**
   * Set item in cache
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   */
  set(key, value) {
    // Remove existing key if present
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    
    // Check if we need to evict least recently used item
    if (this.cache.size >= this.maxSize) {
      // Remove least recently used (first item in Map)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
      this.stats.evictions++;
    }
    
    // Add new item (most recently used)
    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
  }

  /**
   * Check if key exists in cache (without updating access time)
   * @param {string} key - Cache key
   * @returns {boolean} True if key exists and not expired
   */
  has(key) {
    const item = this.cache.get(key);
    
    if (!item) {
      return false;
    }
    
    // Check if expired
    if (this.ttl && Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      this.stats.expirations++;
      return false;
    }
    
    return true;
  }

  /**
   * Delete item from cache
   * @param {string} key - Cache key
   * @returns {boolean} True if item was deleted
   */
  delete(key) {
    return this.cache.delete(key);
  }

  /**
   * Clear all items from cache
   */
  clear() {
    this.cache.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      expirations: 0
    };
  }

  /**
   * Get current cache size
   * @returns {number} Number of items in cache
   */
  get size() {
    return this.cache.size;
  }

  /**
   * Get all cache keys
   * @returns {Array<string>} Array of cache keys
   */
  keys() {
    return Array.from(this.cache.keys());
  }

  /**
   * Get all cache values
   * @returns {Array<*>} Array of cache values
   */
  values() {
    return Array.from(this.cache.values()).map(item => item.value);
  }

  /**
   * Get all cache entries as [key, value] pairs
   * @returns {Array<Array>} Array of [key, value] pairs
   */
  entries() {
    return Array.from(this.cache.entries()).map(([key, item]) => [key, item.value]);
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getStats() {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      evictions: this.stats.evictions,
      expirations: this.stats.expirations,
      currentSize: this.cache.size,
      maxSize: this.maxSize,
      utilizationRate: this.cache.size / this.maxSize
    };
  }

  /**
   * Clean up expired items
   * @returns {number} Number of items removed
   */
  cleanup() {
    if (!this.ttl) {
      return 0; // No TTL, nothing to clean up
    }
    
    let removed = 0;
    const now = Date.now();
    
    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > this.ttl) {
        this.cache.delete(key);
        this.stats.expirations++;
        removed++;
      }
    }
    
    return removed;
  }

  /**
   * Get item age in milliseconds
   * @param {string} key - Cache key
   * @returns {number|null} Age in milliseconds or null if not found
   */
  getAge(key) {
    const item = this.cache.get(key);
    if (!item) {
      return null;
    }
    
    return Date.now() - item.timestamp;
  }

  /**
   * Get remaining TTL for item
   * @param {string} key - Cache key
   * @returns {number|null} Remaining TTL in milliseconds or null if no TTL/not found
   */
  getTTL(key) {
    if (!this.ttl) {
      return null; // No TTL configured
    }
    
    const item = this.cache.get(key);
    if (!item) {
      return null;
    }
    
    const remaining = this.ttl - (Date.now() - item.timestamp);
    return Math.max(0, remaining);
  }

  /**
   * Update TTL for specific item
   * @param {string} key - Cache key
   * @param {number} newTTL - New TTL in milliseconds
   */
  updateTTL(key, newTTL) {
    const item = this.cache.get(key);
    if (!item) {
      return;
    }
    
    // Calculate new timestamp based on new TTL
    const now = Date.now();
    const newTimestamp = now - (this.ttl - newTTL);
    
    this.cache.set(key, {
      value: item.value,
      timestamp: newTimestamp
    });
  }

  /**
   * Refresh item timestamp (reset age to 0)
   * @param {string} key - Cache key
   */
  refresh(key) {
    const item = this.cache.get(key);
    if (!item) {
      return;
    }
    
    this.cache.set(key, {
      value: item.value,
      timestamp: Date.now()
    });
  }

  /**
   * Get cache memory usage estimate
   * @returns {Object} Memory usage information
   */
  getMemoryUsage() {
    let totalSize = 0;
    let keySize = 0;
    let valueSize = 0;
    
    for (const [key, item] of this.cache.entries()) {
      // Rough estimate of memory usage
      keySize += key.length * 2; // 2 bytes per character (UTF-16)
      
      // Estimate value size based on type
      if (typeof item.value === 'string') {
        valueSize += item.value.length * 2;
      } else if (typeof item.value === 'number') {
        valueSize += 8; // 64-bit number
      } else if (typeof item.value === 'object') {
        valueSize += JSON.stringify(item.value).length * 2; // Rough estimate
      } else {
        valueSize += 8; // Default estimate
      }
    }
    
    totalSize = keySize + valueSize + (this.cache.size * 16); // 16 bytes overhead per entry
    
    return {
      totalBytes: totalSize,
      keyBytes: keySize,
      valueBytes: valueSize,
      overheadBytes: this.cache.size * 16,
      averageEntrySize: this.cache.size > 0 ? totalSize / this.cache.size : 0
    };
  }

  /**
   * Export cache contents for serialization
   * @returns {Object} Cache contents with metadata
   */
  export() {
    const entries = [];
    for (const [key, item] of this.cache.entries()) {
      entries.push({
        key,
        value: item.value,
        timestamp: item.timestamp,
        age: Date.now() - item.timestamp
      });
    }
    
    return {
      maxSize: this.maxSize,
      ttl: this.ttl,
      entries,
      stats: this.stats,
      exportTimestamp: Date.now()
    };
  }

  /**
   * Import cache contents from serialized data
   * @param {Object} data - Exported cache data
   * @param {boolean} preserveAge - Whether to preserve original timestamps
   */
  import(data, preserveAge = false) {
    this.clear();
    
    if (!data || !data.entries) {
      return;
    }
    
    const now = Date.now();
    
    for (const entry of data.entries) {
      // Skip expired entries if TTL is configured
      if (this.ttl && !preserveAge) {
        const age = now - entry.timestamp;
        if (age > this.ttl) {
          continue;
        }
      }
      
      const timestamp = preserveAge ? entry.timestamp : now;
      this.cache.set(entry.key, {
        value: entry.value,
        timestamp
      });
    }
    
    // Restore stats if preserving age
    if (preserveAge && data.stats) {
      this.stats = { ...data.stats };
    }
  }
}