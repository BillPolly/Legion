/**
 * LRU (Least Recently Used) Cache with TTL support
 * 
 * Features:
 * - Maximum size limit to prevent memory issues
 * - Time-to-live (TTL) for cached items
 * - Automatic eviction of least recently used items
 * - Statistics tracking for monitoring
 */
export class LRUCache {
  constructor(options = {}) {
    this.maxSize = options.maxSize || 100;
    this.ttl = options.ttl || 3600000; // Default 1 hour TTL
    this.cache = new Map();
    this.accessOrder = [];
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
   * @returns {*} Cached value or undefined
   */
  get(key) {
    const item = this.cache.get(key);
    
    if (!item) {
      this.stats.misses++;
      return undefined;
    }

    // Check if item has expired
    if (this.isExpired(item)) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      this.stats.expirations++;
      this.stats.misses++;
      return undefined;
    }

    // Update access order (move to end)
    this.updateAccessOrder(key);
    this.stats.hits++;
    return item.value;
  }

  /**
   * Check if key exists in cache (and is not expired)
   * @param {string} key - Cache key
   * @returns {boolean} True if key exists and is not expired
   */
  has(key) {
    const item = this.cache.get(key);
    if (!item) return false;
    
    if (this.isExpired(item)) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      this.stats.expirations++;
      return false;
    }
    
    return true;
  }

  /**
   * Set item in cache
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {number} [ttl] - Optional TTL override for this item
   */
  set(key, value, ttl = null) {
    // Remove existing item if present
    if (this.cache.has(key)) {
      this.removeFromAccessOrder(key);
    }

    // Check if we need to evict items
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    // Add new item
    const itemTTL = ttl !== null ? ttl : this.ttl;
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl: itemTTL
    });

    // Add to access order
    this.accessOrder.push(key);
  }

  /**
   * Delete item from cache
   * @param {string} key - Cache key
   * @returns {boolean} True if item was deleted
   */
  delete(key) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      return true;
    }
    return false;
  }

  /**
   * Clear all items from cache
   */
  clear() {
    this.cache.clear();
    this.accessOrder = [];
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      expirations: 0
    };
  }

  /**
   * Get cache size
   * @returns {number} Number of items in cache
   */
  get size() {
    return this.cache.size;
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? this.stats.hits / (this.stats.hits + this.stats.misses)
      : 0;

    return {
      ...this.stats,
      hitRate: hitRate.toFixed(3),
      size: this.cache.size,
      maxSize: this.maxSize
    };
  }

  /**
   * Clean up expired items
   * @returns {number} Number of expired items removed
   */
  cleanupExpired() {
    let removed = 0;
    const now = Date.now();

    for (const [key, item] of this.cache.entries()) {
      if (this.isExpired(item, now)) {
        this.cache.delete(key);
        this.removeFromAccessOrder(key);
        removed++;
      }
    }

    this.stats.expirations += removed;
    return removed;
  }

  /**
   * Check if item is expired
   * @private
   */
  isExpired(item, now = Date.now()) {
    return item.ttl > 0 && (now - item.timestamp) > item.ttl;
  }

  /**
   * Update access order for key
   * @private
   */
  updateAccessOrder(key) {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }

  /**
   * Remove key from access order
   * @private
   */
  removeFromAccessOrder(key) {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  /**
   * Evict least recently used item
   * @private
   */
  evictLRU() {
    if (this.accessOrder.length === 0) return;

    // Find first non-expired item to evict
    let keyToEvict = null;
    for (const key of this.accessOrder) {
      const item = this.cache.get(key);
      if (item && !this.isExpired(item)) {
        keyToEvict = key;
        break;
      }
    }

    if (keyToEvict) {
      this.cache.delete(keyToEvict);
      this.removeFromAccessOrder(keyToEvict);
      this.stats.evictions++;
    }
  }
}