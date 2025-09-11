/**
 * EmbeddingCache - Caching layer for embeddings
 * 
 * Provides caching for generated embeddings to reduce API costs
 * and improve performance for frequently accessed embeddings.
 */

import crypto from 'crypto';

export class EmbeddingCache {
  constructor(config) {
    this.config = {
      ttl: 3600, // 1 hour default TTL
      maxSize: 10000, // Maximum number of cached embeddings
      persistToDisk: false,
      ...config
    };

    // In-memory cache
    this.cache = new Map();
    this.timestamps = new Map();
    this.resourceManager = config.resourceManager;
    
    // Optional persistent storage
    this.persistentStore = null;
    if (this.config.persistToDisk && this.resourceManager) {
      this._initializePersistentStore();
    }

    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this._cleanup();
    }, Math.min(this.config.ttl * 1000, 300000)); // Every 5 minutes max
    
    // Allow cleanup in tests
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Get embedding from cache
   * @param {string} text - Text to get embedding for
   * @returns {Promise<Array<number>|null>} - Cached embedding or null
   */
  async get(text) {
    const key = this._generateKey(text);
    
    // Check in-memory cache first
    if (this.cache.has(key)) {
      const timestamp = this.timestamps.get(key);
      
      // Check if expired
      if (this._isExpired(timestamp)) {
        this.cache.delete(key);
        this.timestamps.delete(key);
      } else {
        // Update access time for LRU
        this.timestamps.set(key, Date.now());
        return this.cache.get(key);
      }
    }

    // Check persistent storage if available
    if (this.persistentStore) {
      return await this._getFromPersistentStore(key);
    }

    return null;
  }

  /**
   * Store embedding in cache
   * @param {string} text - Text the embedding belongs to
   * @param {Array<number>} embedding - Embedding vector
   */
  async set(text, embedding) {
    const key = this._generateKey(text);
    const timestamp = Date.now();

    // Ensure we don't exceed max size BEFORE adding
    if (this.cache.size >= this.config.maxSize) {
      this._enforceMaxSize();
    }

    // Store in memory
    this.cache.set(key, embedding);
    this.timestamps.set(key, timestamp);

    // Store in persistent storage if available
    if (this.persistentStore) {
      await this._setInPersistentStore(key, embedding, timestamp);
    }
  }

  /**
   * Check if an embedding is cached
   * @param {string} text - Text to check
   * @returns {Promise<boolean>} - Whether embedding is cached
   */
  async has(text) {
    const cached = await this.get(text);
    return cached !== null;
  }

  /**
   * Clear the cache
   */
  async clear() {
    this.cache.clear();
    this.timestamps.clear();
    
    if (this.persistentStore) {
      await this._clearPersistentStore();
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const now = Date.now();
    const expired = Array.from(this.timestamps.values())
      .filter(timestamp => this._isExpired(timestamp))
      .length;

    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      expired: expired,
      hitRatio: this._calculateHitRatio(),
      memoryUsage: this._estimateMemoryUsage(),
      ttlSeconds: this.config.ttl
    };
  }

  /**
   * Close the cache and cleanup resources
   */
  async close() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    if (this.persistentStore) {
      await this._closePersistentStore();
    }
  }

  // ===================
  // Private methods
  // ===================

  /**
   * Generate cache key from text
   * @private
   */
  _generateKey(text) {
    return crypto
      .createHash('sha256')
      .update(text)
      .digest('hex');
  }

  /**
   * Check if timestamp is expired
   * @private
   */
  _isExpired(timestamp) {
    return Date.now() - timestamp > (this.config.ttl * 1000);
  }

  /**
   * Cleanup expired entries
   * @private
   */
  _cleanup() {
    let removed = 0;
    
    for (const [key, timestamp] of this.timestamps.entries()) {
      if (this._isExpired(timestamp)) {
        this.cache.delete(key);
        this.timestamps.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`EmbeddingCache: Cleaned up ${removed} expired entries`);
    }
  }

  /**
   * Enforce maximum cache size using LRU
   * @private
   */
  _enforceMaxSize() {
    // Remove oldest entries (LRU) to make room
    const entries = Array.from(this.timestamps.entries())
      .sort((a, b) => a[1] - b[1]); // Sort by timestamp (oldest first)

    // Remove at least 1 item, or 10% of max size (whichever is greater)
    const toRemove = Math.max(1, Math.floor(this.config.maxSize * 0.1));
    
    for (let i = 0; i < toRemove && i < entries.length; i++) {
      const [key] = entries[i];
      this.cache.delete(key);
      this.timestamps.delete(key);
    }
  }

  /**
   * Calculate hit ratio for statistics
   * @private
   */
  _calculateHitRatio() {
    // This would require tracking hits/misses
    // For now, return a placeholder
    return 0.0;
  }

  /**
   * Estimate memory usage
   * @private
   */
  _estimateMemoryUsage() {
    // Rough estimate: each embedding is ~1536 floats * 8 bytes + overhead
    const avgEmbeddingSize = 1536 * 8 + 100; // bytes
    return this.cache.size * avgEmbeddingSize;
  }

  /**
   * Initialize persistent storage
   * @private
   */
  async _initializePersistentStore() {
    try {
      // Use Legion's storage system if available
      const storageProvider = this.resourceManager.get('storageProvider');
      if (storageProvider) {
        this.persistentStore = storageProvider.getProvider('memory'); // Start with memory provider
      }
    } catch (error) {
      console.warn('EmbeddingCache: Could not initialize persistent storage:', error.message);
    }
  }

  /**
   * Get from persistent store
   * @private
   */
  async _getFromPersistentStore(key) {
    if (!this.persistentStore) return null;

    try {
      const result = await this.persistentStore.findOne('embedding_cache', { _id: key });
      
      if (result && !this._isExpired(result.timestamp)) {
        // Load into memory cache
        this.cache.set(key, result.embedding);
        this.timestamps.set(key, result.timestamp);
        return result.embedding;
      }
      
      // Remove expired entry
      if (result) {
        await this.persistentStore.delete('embedding_cache', { _id: key });
      }
    } catch (error) {
      console.warn('EmbeddingCache: Error reading from persistent store:', error.message);
    }

    return null;
  }

  /**
   * Set in persistent store
   * @private
   */
  async _setInPersistentStore(key, embedding, timestamp) {
    if (!this.persistentStore) return;

    try {
      await this.persistentStore.insert('embedding_cache', {
        _id: key,
        embedding: embedding,
        timestamp: timestamp,
        ttl: this.config.ttl
      });
    } catch (error) {
      console.warn('EmbeddingCache: Error writing to persistent store:', error.message);
    }
  }

  /**
   * Clear persistent store
   * @private
   */
  async _clearPersistentStore() {
    if (!this.persistentStore) return;

    try {
      await this.persistentStore.delete('embedding_cache', {});
    } catch (error) {
      console.warn('EmbeddingCache: Error clearing persistent store:', error.message);
    }
  }

  /**
   * Close persistent store
   * @private
   */
  async _closePersistentStore() {
    // Persistent store is managed by storage provider, no action needed
    this.persistentStore = null;
  }
}