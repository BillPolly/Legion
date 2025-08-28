/**
 * CacheService - Single Responsibility for Caching Operations
 * 
 * Handles only caching-related operations:
 * - Get/Set/Remove cache items
 * - Cache clearing and maintenance
 * - Cache statistics and health
 * 
 * Clean Architecture: Application Layer Service
 * Depends only on abstractions, not concretions
 */

export class CacheService {
  constructor(dependencies) {
    // Dependency Inversion: Depend on abstractions
    this.cache = dependencies.cache; // LRUCache or similar
    this.eventBus = dependencies.eventBus;
    this.metrics = dependencies.metrics || null;
  }

  /**
   * Get item from cache
   * Single responsibility: Cache retrieval
   */
  async get(key, options = {}) {
    if (!key) {
      throw new Error('Cache key is required');
    }

    const { forceRefresh = false } = options;
    
    if (forceRefresh) {
      await this.remove(key);
      return null;
    }

    try {
      const value = await this.cache.get(key);
      
      this.eventBus.emit('cache:hit', { 
        key, 
        found: !!value 
      });

      if (this.metrics) {
        this.metrics.increment(value ? 'cache.hit' : 'cache.miss');
      }

      return value;
    } catch (error) {
      this.eventBus.emit('cache:error', {
        operation: 'get',
        key,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Store item in cache
   * Single responsibility: Cache storage
   */
  async set(key, value, options = {}) {
    if (!key) {
      throw new Error('Cache key is required');
    }

    const { ttl, tags = [] } = options;

    try {
      await this.cache.set(key, value, {
        ttl,
        tags: Array.isArray(tags) ? tags : [tags]
      });

      this.eventBus.emit('cache:set', { 
        key, 
        ttl,
        tags: tags.length
      });

      if (this.metrics) {
        this.metrics.increment('cache.set');
      }

    } catch (error) {
      this.eventBus.emit('cache:error', {
        operation: 'set',
        key,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Remove item from cache
   * Single responsibility: Cache removal
   */
  async remove(key) {
    if (!key) {
      throw new Error('Cache key is required');
    }

    try {
      const existed = await this.cache.has(key);
      await this.cache.delete(key);

      this.eventBus.emit('cache:removed', { 
        key, 
        existed 
      });

      if (this.metrics) {
        this.metrics.increment('cache.remove');
      }

      return existed;
    } catch (error) {
      this.eventBus.emit('cache:error', {
        operation: 'remove',
        key,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Clear cache by pattern or tag
   * Single responsibility: Bulk cache clearing
   */
  async clear(options = {}) {
    const { pattern, tags = [] } = options;
    let clearedCount = 0;

    try {
      if (pattern) {
        clearedCount = await this._clearByPattern(pattern);
      } else if (tags.length > 0) {
        clearedCount = await this._clearByTags(tags);
      } else {
        clearedCount = await this._clearAll();
      }

      this.eventBus.emit('cache:cleared', {
        pattern,
        tags: tags.length,
        clearedCount
      });

      if (this.metrics) {
        this.metrics.increment('cache.clear', clearedCount);
      }

      return clearedCount;
    } catch (error) {
      this.eventBus.emit('cache:error', {
        operation: 'clear',
        pattern,
        tags,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get cache statistics
   * Single responsibility: Cache metrics
   */
  async getStatistics() {
    try {
      const stats = this.cache.getStats();
      
      return {
        size: stats.size || 0,
        maxSize: stats.maxSize || 0,
        hitRate: stats.hits / (stats.hits + stats.misses) || 0,
        hits: stats.hits || 0,
        misses: stats.misses || 0,
        evictions: stats.evictions || 0,
        memoryUsage: stats.memoryUsage || 0
      };
    } catch (error) {
      this.eventBus.emit('cache:error', {
        operation: 'getStatistics',
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Check if cache is healthy
   * Single responsibility: Cache health check
   */
  async isHealthy() {
    try {
      const testKey = `health-check-${Date.now()}`;
      const testValue = { timestamp: Date.now() };

      // Test write
      await this.set(testKey, testValue, { ttl: 1000 });
      
      // Test read
      const retrieved = await this.get(testKey);
      const readSuccess = retrieved?.timestamp === testValue.timestamp;

      // Test remove
      const removeSuccess = await this.remove(testKey);

      const healthy = readSuccess && removeSuccess;

      this.eventBus.emit('cache:health-check', {
        healthy,
        readSuccess,
        removeSuccess
      });

      return healthy;
    } catch (error) {
      this.eventBus.emit('cache:error', {
        operation: 'healthCheck',
        error: error.message
      });
      return false;
    }
  }

  /**
   * Clear cache by pattern
   * Private helper - single responsibility
   */
  async _clearByPattern(pattern) {
    const keys = await this.cache.keys();
    const regex = this._patternToRegex(pattern);
    let clearedCount = 0;

    for (const key of keys) {
      if (regex.test(key)) {
        await this.cache.delete(key);
        clearedCount++;
      }
    }

    return clearedCount;
  }

  /**
   * Clear cache by tags
   * Private helper - single responsibility
   */
  async _clearByTags(tags) {
    if (!this.cache.clearByTags) {
      throw new Error('Cache implementation does not support tag-based clearing');
    }

    return await this.cache.clearByTags(tags);
  }

  /**
   * Clear all cache items
   * Private helper - single responsibility
   */
  async _clearAll() {
    const sizeBefore = this.cache.size;  // size is a getter, not a method
    await this.cache.clear();
    return sizeBefore;
  }

  /**
   * Convert glob pattern to regex
   * Private helper - single responsibility
   */
  _patternToRegex(pattern) {
    // Convert glob pattern to regex
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape regex special chars
      .replace(/\*/g, '.*') // * becomes .*
      .replace(/\?/g, '.'); // ? becomes .
    
    return new RegExp(`^${escaped}$`);
  }
}