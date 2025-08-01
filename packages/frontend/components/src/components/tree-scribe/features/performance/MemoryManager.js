/**
 * MemoryManager - Intelligent caching and memory management for TreeScribe
 * 
 * Manages node caching with LRU eviction, TTL expiration, and memory pressure handling
 */

export class MemoryManager {
  constructor(options = {}) {
    this.options = {
      maxCacheSize: 500,
      ttl: 300000, // 5 minutes
      checkInterval: 60000, // 1 minute
      enableMetrics: true,
      ...options
    };

    this.destroyed = false;
    this.cache = new Map();
    this.renderCache = new Map();
    this.metadataCache = new Map();
    this.pinnedItems = new Set();
    
    // Statistics
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      stores: 0
    };
    
    // Timing metrics
    this.timings = {
      storeTime: [],
      getTime: [],
      evictionTime: []
    };
    
    // Memory tracking
    this.memoryUsage = {
      peak: 0,
      current: 0,
      history: []
    };
    
    // Start cleanup interval
    this.cleanupInterval = null;
    if (this.options.checkInterval > 0) {
      this.cleanupInterval = setInterval(() => {
        this._cleanup();
      }, this.options.checkInterval);
    }
  }

  /**
   * Store item in cache
   */
  store(key, value, options = {}) {
    if (this.destroyed) return;
    
    const startTime = performance.now();
    
    // Check if we need to evict
    if (this.cache.size >= this.options.maxCacheSize && !this.cache.has(key)) {
      this._evictLRU();
    }
    
    // Create cache entry
    const entry = {
      value,
      lastAccess: Date.now(),
      created: Date.now(),
      size: this._estimateSize(value),
      priority: options.priority || 'normal',
      metadata: options.metadata || {}
    };
    
    this.cache.set(key, entry);
    
    // Clear related caches
    this.renderCache.delete(key);
    
    // Update stats
    this.stats.stores++;
    this._updateMemoryUsage();
    
    // Track timing
    if (this.options.enableMetrics) {
      this.timings.storeTime.push(performance.now() - startTime);
      this._trimTimings();
    }
  }

  /**
   * Store multiple items efficiently
   */
  storeMany(items, keyFn) {
    const startTime = performance.now();
    
    // Pre-calculate evictions needed
    const itemsToAdd = items.length;
    const currentSize = this.cache.size;
    const maxSize = this.options.maxCacheSize;
    const evictionsNeeded = Math.max(0, (currentSize + itemsToAdd) - maxSize);
    
    // Batch evict if needed
    if (evictionsNeeded > 0) {
      this._evictMultiple(evictionsNeeded);
    }
    
    // Batch store
    items.forEach(item => {
      const key = keyFn(item);
      const entry = {
        value: item,
        lastAccess: Date.now(),
        created: Date.now(),
        size: this._estimateSize(item),
        priority: 'normal',
        metadata: {}
      };
      
      this.cache.set(key, entry);
    });
    
    // Update stats
    this.stats.stores += items.length;
    this._updateMemoryUsage();
  }

  /**
   * Get item from cache
   */
  get(key) {
    if (this.destroyed) return null;
    
    const startTime = performance.now();
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }
    
    // Check TTL
    if (this._isExpired(entry)) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }
    
    // Update access time
    entry.lastAccess = Date.now();
    
    // Update stats
    this.stats.hits++;
    
    // Track timing
    if (this.options.enableMetrics) {
      this.timings.getTime.push(performance.now() - startTime);
      this._trimTimings();
    }
    
    return entry.value;
  }

  /**
   * Check if key exists
   */
  has(key) {
    if (this.destroyed) return false;
    
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    // Check TTL
    if (this._isExpired(entry)) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Delete item from cache
   */
  delete(key) {
    if (this.destroyed) return;
    
    this.cache.delete(key);
    this.renderCache.delete(key);
    this.metadataCache.delete(key);
    this.pinnedItems.delete(key);
    
    this._updateMemoryUsage();
  }

  /**
   * Clear all caches
   */
  clear() {
    this.cache.clear();
    this.renderCache.clear();
    this.metadataCache.clear();
    this.pinnedItems.clear();
    
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      stores: 0
    };
    
    this._updateMemoryUsage();
  }

  /**
   * Store rendered content
   */
  storeRendered(key, rendered) {
    if (this.destroyed) return;
    
    this.renderCache.set(key, {
      content: rendered,
      created: Date.now()
    });
  }

  /**
   * Get rendered content
   */
  getRendered(key) {
    if (this.destroyed) return null;
    
    const entry = this.renderCache.get(key);
    return entry ? entry.content : null;
  }

  /**
   * Store metadata
   */
  storeMetadata(key, metadata) {
    if (this.destroyed) return;
    
    this.metadataCache.set(key, metadata);
  }

  /**
   * Get metadata
   */
  getMetadata(key) {
    if (this.destroyed) return null;
    
    return this.metadataCache.get(key) || null;
  }

  /**
   * Pin item to prevent eviction
   */
  pin(key) {
    this.pinnedItems.add(key);
  }

  /**
   * Unpin item
   */
  unpin(key) {
    this.pinnedItems.delete(key);
  }

  /**
   * Prefetch related nodes
   */
  async prefetchRelated(key, fetchFn) {
    const node = this.get(key);
    if (!node) return;
    
    const relatedIds = [];
    
    // Collect related IDs
    if (node.children) {
      relatedIds.push(...node.children);
    }
    if (node.parentId) {
      relatedIds.push(node.parentId);
    }
    
    // Filter out already cached
    const toFetch = relatedIds.filter(id => !this.has(id));
    
    if (toFetch.length > 0) {
      try {
        const nodes = await fetchFn(toFetch);
        this.storeMany(nodes, node => node.id);
      } catch (error) {
        console.error('Error prefetching related nodes:', error);
      }
    }
  }

  /**
   * Handle memory pressure
   */
  handleMemoryPressure(level) {
    switch (level) {
      case 'moderate':
        // Reduce cache by 25%
        this._reduceCache(0.25);
        break;
        
      case 'critical':
        // Reduce cache by 50%
        this._reduceCache(0.5);
        break;
        
      default:
        // Reduce cache by 10%
        this._reduceCache(0.1);
    }
  }

  /**
   * Get memory info
   */
  getMemoryInfo() {
    const hitRate = this.stats.hits / (this.stats.hits + this.stats.misses) || 0;
    
    return {
      cacheSize: this.cache.size,
      maxCacheSize: this.options.maxCacheSize,
      renderCacheSize: this.renderCache.size,
      metadataCacheSize: this.metadataCache.size,
      pinnedItems: this.pinnedItems.size,
      hitRate,
      missRate: 1 - hitRate,
      memoryUsage: this.memoryUsage.current,
      peakMemory: this.memoryUsage.peak
    };
  }

  /**
   * Get statistics
   */
  getStats() {
    const total = this.stats.hits + this.stats.misses;
    
    return {
      ...this.stats,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      total
    };
  }

  /**
   * Get timing metrics
   */
  getTimings() {
    return {
      avgStoreTime: this._average(this.timings.storeTime),
      avgGetTime: this._average(this.timings.getTime),
      avgEvictionTime: this._average(this.timings.evictionTime)
    };
  }

  /**
   * Get usage patterns
   */
  getUsagePatterns() {
    const history = this.memoryUsage.history;
    
    if (history.length < 2) {
      return {
        growthRate: 0,
        averageItemSize: 0,
        peakUsage: this.memoryUsage.peak
      };
    }
    
    // Calculate growth rate
    const firstUsage = history[0].usage;
    const lastUsage = history[history.length - 1].usage;
    const timeSpan = history[history.length - 1].time - history[0].time;
    const growthRate = timeSpan > 0 ? (lastUsage - firstUsage) / timeSpan : 0;
    
    // Calculate average item size
    let totalSize = 0;
    this.cache.forEach(entry => {
      totalSize += entry.size;
    });
    const averageItemSize = this.cache.size > 0 ? totalSize / this.cache.size : 0;
    
    return {
      growthRate,
      averageItemSize,
      peakUsage: this.memoryUsage.peak
    };
  }

  /**
   * Get optimization suggestions
   */
  getOptimizationSuggestions() {
    const suggestions = [];
    const stats = this.getStats();
    const memInfo = this.getMemoryInfo();
    const patterns = this.getUsagePatterns();
    
    // Check hit rate
    if (stats.hitRate < 0.5) {
      suggestions.push('Low cache hit rate - consider increasing cache size');
    }
    
    // Check if cache is too large
    if (memInfo.cacheSize === memInfo.maxCacheSize && stats.hitRate > 0.9) {
      suggestions.push('High hit rate with full cache - cache size may be larger than needed');
    }
    
    // Check growth rate
    if (patterns.growthRate > 1000) {
      suggestions.push('Rapid memory growth detected - consider more aggressive eviction');
    }
    
    // Check pinned items
    if (memInfo.pinnedItems > memInfo.maxCacheSize * 0.5) {
      suggestions.push('Too many pinned items - may prevent effective cache management');
    }
    
    return suggestions;
  }

  /**
   * Serialize cache state
   */
  serialize() {
    const entries = [];
    
    this.cache.forEach((entry, key) => {
      // Only serialize non-expired entries
      if (!this._isExpired(entry)) {
        entries.push({
          key,
          value: entry.value,
          lastAccess: entry.lastAccess,
          created: entry.created,
          priority: entry.priority,
          metadata: entry.metadata
        });
      }
    });
    
    return JSON.stringify({
      entries,
      stats: this.stats,
      timestamp: Date.now()
    });
  }

  /**
   * Deserialize cache state
   */
  deserialize(data) {
    try {
      const parsed = JSON.parse(data);
      
      // Clear existing cache
      this.clear();
      
      // Restore entries
      parsed.entries.forEach(item => {
        this.cache.set(item.key, {
          value: item.value,
          lastAccess: item.lastAccess,
          created: item.created,
          size: this._estimateSize(item.value),
          priority: item.priority || 'normal',
          metadata: item.metadata || {}
        });
      });
      
      // Restore stats
      if (parsed.stats) {
        this.stats = { ...this.stats, ...parsed.stats };
      }
      
      this._updateMemoryUsage();
    } catch (error) {
      console.error('Error deserializing cache:', error);
    }
  }

  /**
   * Check if entry is expired
   * @private
   */
  _isExpired(entry) {
    return Date.now() - entry.created > this.options.ttl;
  }

  /**
   * Evict least recently used item
   * @private
   */
  _evictLRU() {
    const startTime = performance.now();
    
    let oldestKey = null;
    let oldestTime = Infinity;
    
    // Find LRU item (excluding pinned)
    this.cache.forEach((entry, key) => {
      if (!this.pinnedItems.has(key) && entry.lastAccess < oldestTime) {
        oldestTime = entry.lastAccess;
        oldestKey = key;
      }
    });
    
    if (oldestKey) {
      this.delete(oldestKey);
      this.stats.evictions++;
    }
    
    // Track timing
    if (this.options.enableMetrics) {
      this.timings.evictionTime.push(performance.now() - startTime);
      this._trimTimings();
    }
  }

  /**
   * Evict multiple items
   * @private
   */
  _evictMultiple(count) {
    const items = [];
    
    // Collect non-pinned items with access times
    this.cache.forEach((entry, key) => {
      if (!this.pinnedItems.has(key)) {
        items.push({ key, lastAccess: entry.lastAccess });
      }
    });
    
    // Sort by access time
    items.sort((a, b) => a.lastAccess - b.lastAccess);
    
    // Evict oldest items
    const toEvict = items.slice(0, count);
    toEvict.forEach(item => {
      this.delete(item.key);
      this.stats.evictions++;
    });
  }

  /**
   * Reduce cache by percentage
   * @private
   */
  _reduceCache(percentage) {
    const targetSize = Math.floor(this.cache.size * (1 - percentage));
    const toEvict = this.cache.size - targetSize;
    
    if (toEvict > 0) {
      this._evictMultiple(toEvict);
    }
  }

  /**
   * Cleanup expired entries
   * @private
   */
  _cleanup() {
    const now = Date.now();
    const toDelete = [];
    
    this.cache.forEach((entry, key) => {
      if (this._isExpired(entry)) {
        toDelete.push(key);
      }
    });
    
    toDelete.forEach(key => {
      this.delete(key);
    });
  }

  /**
   * Estimate size of value
   * @private
   */
  _estimateSize(value) {
    // Simple estimation - can be improved
    if (typeof value === 'string') {
      return value.length * 2; // 2 bytes per character
    } else if (typeof value === 'object') {
      return JSON.stringify(value).length * 2;
    } else {
      return 8; // Default size for primitives
    }
  }

  /**
   * Update memory usage tracking
   * @private
   */
  _updateMemoryUsage() {
    let totalSize = 0;
    
    this.cache.forEach(entry => {
      totalSize += entry.size;
    });
    
    this.memoryUsage.current = totalSize;
    this.memoryUsage.peak = Math.max(this.memoryUsage.peak, totalSize);
    
    // Add to history
    this.memoryUsage.history.push({
      time: Date.now(),
      usage: totalSize,
      cacheSize: this.cache.size
    });
    
    // Keep only last 100 entries
    if (this.memoryUsage.history.length > 100) {
      this.memoryUsage.history = this.memoryUsage.history.slice(-100);
    }
  }

  /**
   * Calculate average of array
   * @private
   */
  _average(arr) {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  /**
   * Trim timing arrays
   * @private
   */
  _trimTimings() {
    const maxEntries = 100;
    
    if (this.timings.storeTime.length > maxEntries) {
      this.timings.storeTime = this.timings.storeTime.slice(-maxEntries);
    }
    if (this.timings.getTime.length > maxEntries) {
      this.timings.getTime = this.timings.getTime.slice(-maxEntries);
    }
    if (this.timings.evictionTime.length > maxEntries) {
      this.timings.evictionTime = this.timings.evictionTime.slice(-maxEntries);
    }
  }

  /**
   * Destroy
   */
  destroy() {
    if (this.destroyed) return;
    
    this.destroyed = true;
    
    // Clear interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    // Clear all caches
    this.clear();
  }
}