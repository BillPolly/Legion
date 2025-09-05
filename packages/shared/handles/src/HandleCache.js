/**
 * HandleCache - Generic caching system for handle method results and attributes
 * 
 * Provides TTL-based caching with pattern invalidation and memory management.
 * Used by BaseHandle for transparent method result caching.
 */

export class HandleCache {
  constructor() {
    this.cache = new Map(); // key -> value
    this.timers = new Map(); // key -> timeout timer
  }

  /**
   * Store value in cache with optional TTL
   * @param {string} key - Cache key
   * @param {any} value - Value to store
   * @param {number} ttl - Time to live in milliseconds (0 = no expiration)
   */
  set(key, value, ttl = 0) {
    this.cache.set(key, value);
    
    // Clear existing timer if any
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
    
    // Set TTL timer if specified
    if (ttl > 0) {
      const timer = setTimeout(() => {
        this.cache.delete(key);
        this.timers.delete(key);
      }, ttl);
      
      this.timers.set(key, timer);
    }
  }

  /**
   * Retrieve value from cache
   * @param {string} key - Cache key
   * @returns {any|null} Cached value or null if not found/expired
   */
  get(key) {
    if (this.cache.has(key)) {
      return this.cache.get(key); // Return actual value, including undefined
    }
    return null; // Only return null if key doesn't exist
  }

  /**
   * Check if key exists in cache
   * @param {string} key - Cache key
   * @returns {boolean} True if key exists and not expired
   */
  has(key) {
    return this.cache.has(key);
  }

  /**
   * Delete specific cache entry
   * @param {string} key - Cache key to delete
   * @returns {boolean} True if key was deleted, false if not found
   */
  delete(key) {
    const hadKey = this.cache.has(key);
    
    this.cache.delete(key);
    
    // Clear TTL timer if exists
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
    
    return hadKey;
  }

  /**
   * Invalidate cache entries by pattern
   * @param {string} pattern - Pattern to match against cache keys
   */
  invalidate(pattern) {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.delete(key);
      }
    }
  }

  /**
   * Get cache size (number of entries)
   * @returns {number} Number of cached entries
   */
  size() {
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
   * @returns {Array<any>} Array of cache values
   */
  values() {
    return Array.from(this.cache.values());
  }

  /**
   * Get all cache entries as [key, value] pairs
   * @returns {Array<Array>} Array of [key, value] pairs
   */
  entries() {
    return Array.from(this.cache.entries());
  }

  /**
   * Clear all cache entries and timers
   */
  clear() {
    // Clear all TTL timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    
    this.cache.clear();
    this.timers.clear();
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getStats() {
    return {
      totalEntries: this.cache.size,
      entriesWithTTL: this.timers.size,
      entriesWithoutTTL: this.cache.size - this.timers.size
    };
  }

  /**
   * Cleanup expired entries (manual cleanup for testing)
   * Note: TTL entries are automatically cleaned up by timers
   */
  cleanup() {
    // TTL cleanup is handled automatically by timers
    // This method exists for manual cleanup in tests if needed
    const expiredKeys = [];
    
    for (const [key, timer] of this.timers) {
      if (!this.cache.has(key)) {
        // Entry was already cleaned up
        clearTimeout(timer);
        expiredKeys.push(key);
      }
    }
    
    expiredKeys.forEach(key => this.timers.delete(key));
    
    return expiredKeys.length;
  }
}