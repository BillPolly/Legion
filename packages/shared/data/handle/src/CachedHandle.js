/**
 * CachedHandle - Universal base class for handles with caching capabilities
 * 
 * Provides common caching patterns, validation utilities, and cache invalidation
 * subscription management for all Handle types. Works with any ResourceManager implementation.
 * 
 * CRITICAL: All operations are synchronous - NO await, NO promises in Handle infrastructure!
 */

import { Handle } from './Handle.js';
import { ValidationUtils } from './ValidationUtils.js';

export class CachedHandle extends Handle {
  constructor(dataSource, options = {}) {
    super(dataSource);
    
    // Cache configuration
    this._cacheTTL = options.cacheTTL || 5000; // 5 seconds default local cache
    this._enableGlobalCache = options.enableGlobalCache !== false; // enabled by default
    
    // Local cache state
    this._cachedData = null;
    this._cacheTimestamp = 0;
    this._cacheValid = false;
    
    // Global cache manager integration (optional)
    this.cacheManager = options.cacheManager || null;
    
    // Cache invalidation tracking
    this._cacheInvalidationSubs = new Set();
    
    // Options storage
    this.options = options;
  }
  
  /**
   * Check if local cache is valid and not expired
   * CRITICAL: Must be synchronous - no await!
   * 
   * @returns {boolean} True if cache is valid and not expired
   * @protected
   */
  _isLocalCacheValid() {
    return this._cacheValid && 
           this._cachedData !== null && 
           (Date.now() - this._cacheTimestamp) < this._cacheTTL;
  }
  
  /**
   * Update local cache with new data
   * CRITICAL: Must be synchronous - no await!
   * 
   * @param {*} data - Data to cache
   * @param {number} timestamp - Optional timestamp (defaults to now)
   * @protected
   */
  _updateLocalCache(data, timestamp = null) {
    this._cachedData = data;
    this._cacheTimestamp = timestamp || Date.now();
    this._cacheValid = true;
  }
  
  /**
   * Invalidate local and global cache
   * CRITICAL: Must be synchronous - no await!
   * 
   * @protected
   */
  _invalidateCache() {
    // Invalidate local cache
    this._cachedData = null;
    this._cacheTimestamp = 0;
    this._cacheValid = false;
    
    // Invalidate global cache if available
    if (this._enableGlobalCache && this.cacheManager) {
      try {
        // Call appropriate global cache invalidation based on handle type
        if (this.entityId !== undefined) {
          // Entity-specific cache invalidation
          this.cacheManager.invalidateEntity(this.entityId);
        } else if (this._cacheKey) {
          // Generic cache key invalidation
          this.cacheManager.invalidate(this._cacheKey);
        } else {
          // Full cache invalidation
          this.cacheManager.invalidateAll();
        }
      } catch (error) {
        console.warn('Failed to invalidate global cache:', error.message);
      }
    }
  }
  
  /**
   * Setup cache invalidation subscription for automatic cache management
   * CRITICAL: Must be synchronous - no await!
   * 
   * @param {Object} querySpec - Query specification to monitor for changes
   * @param {Function} callback - Optional custom callback (defaults to cache invalidation)
   * @protected
   */
  _setupCacheInvalidation(querySpec, callback = null) {
    // Validate input
    ValidationUtils.validateQuerySpec(querySpec, 'Cache invalidation query');
    
    // Default callback invalidates cache
    const invalidationCallback = callback || (() => {
      this._invalidateCache();
    });
    
    try {
      // Create subscription through DataSource (synchronous)
      const subscription = this.dataSource.subscribe(querySpec, invalidationCallback);
      
      // Track subscription for cleanup
      this._cacheInvalidationSubs.add(subscription);
      
      // Also track in main subscription list for automatic cleanup
      this._subscriptions.add({
        id: subscription.id,
        unsubscribe: () => {
          this._cacheInvalidationSubs.delete(subscription);
          subscription.unsubscribe();
        }
      });
      
      return subscription;
    } catch (error) {
      // If subscription fails, continue without cache invalidation
      // Cache will still work with TTL expiration
      console.warn('Failed to setup cache invalidation:', error.message);
      return null;
    }
  }
  
  /**
   * Get data from cache or ResourceManager with caching
   * Template method pattern - subclasses override _fetchFreshData()
   * CRITICAL: Must be synchronous - no await!
   * 
   * @returns {*} Cached or fresh data
   * @protected
   */
  _getCachedData() {
    // Check local cache first
    if (this._isLocalCacheValid()) {
      return this._cachedData;
    }
    
    // Check global cache if available
    if (this._enableGlobalCache && this.cacheManager && this._cacheKey) {
      try {
        const globalCacheData = this.cacheManager.get(this._cacheKey);
        if (globalCacheData !== null && globalCacheData !== undefined) {
          this._updateLocalCache(globalCacheData);
          return globalCacheData;
        }
      } catch (error) {
        console.warn('Failed to get data from global cache:', error.message);
      }
    }
    
    // Fetch fresh data (implemented by subclasses)
    const freshData = this._fetchFreshData();
    
    // Update caches
    this._updateLocalCache(freshData);
    
    if (this._enableGlobalCache && this.cacheManager && this._cacheKey) {
      try {
        this.cacheManager.set(this._cacheKey, freshData, this._cacheTTL);
      } catch (error) {
        console.warn('Failed to update global cache:', error.message);
      }
    }
    
    return freshData;
  }
  
  /**
   * Fetch fresh data from ResourceManager
   * Must be implemented by subclasses
   * CRITICAL: Must be synchronous - no await!
   * 
   * @returns {*} Fresh data from resource
   * @protected
   */
  _fetchFreshData() {
    throw new Error('_fetchFreshData() must be implemented by subclass');
  }
  
  /**
   * Generate cache key for this handle
   * Can be overridden by subclasses for specific caching strategies
   * 
   * @param {string} type - Cache type (entity, query, etc.)
   * @param {*} identifier - Unique identifier for the cache entry
   * @returns {string} Generated cache key
   * @protected
   */
  _generateCacheKey(type, identifier) {
    if (identifier === null || identifier === undefined) {
      return `${type}:${this.constructor.name}:${Date.now()}`;
    }
    
    if (typeof identifier === 'object') {
      // For query objects, create a stable string representation
      try {
        return `${type}:${JSON.stringify(identifier)}`;
      } catch (error) {
        // Fallback for non-serializable objects
        return `${type}:${this.constructor.name}:${Date.now()}`;
      }
    }
    
    return `${type}:${identifier}`;
  }
  
  /**
   * Create tracked subscription with automatic cleanup and validation
   * CRITICAL: Must be synchronous - no await!
   * 
   * @param {Object} querySpec - Query specification for subscription
   * @param {Function} callback - Callback function for subscription updates
   * @returns {Object} Subscription object with unsubscribe method
   * @protected
   */
  _createTrackedSubscription(querySpec, callback) {
    // Validate parameters using utility functions
    ValidationUtils.validateQuerySpec(querySpec, 'Subscription query');
    ValidationUtils.validateCallback(callback, 'Subscription callback');
    
    // Create subscription through inherited subscribe method (synchronous)
    return this.subscribe(querySpec, callback);
  }
  
  /**
   * Execute bulk operation with error handling and reporting
   * Template method for bulk operations like updates, deletes, etc.
   * CRITICAL: Must be synchronous - no await!
   * 
   * @param {Array} items - Array of items to process
   * @param {Function} operationFn - Function to execute for each item
   * @param {string} operationName - Name of operation for error reporting
   * @returns {Object} Operation result with success status and statistics
   * @protected
   */
  _executeBulkOperation(items, operationFn, operationName = 'Bulk operation') {
    if (!Array.isArray(items)) {
      throw new Error(`${operationName} items must be an array`);
    }
    
    if (typeof operationFn !== 'function') {
      throw new Error(`${operationName} operation function is required`);
    }
    
    const results = {
      success: true,
      processed: 0,
      failed: 0,
      total: items.length,
      errors: []
    };
    
    // Process each item synchronously
    for (let i = 0; i < items.length; i++) {
      try {
        operationFn(items[i], i, items);
        results.processed++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          index: i,
          item: items[i],
          error: error.message
        });
        
        // Log individual errors but continue processing
        console.warn(`${operationName} failed for item ${i}:`, error.message);
      }
    }
    
    // Overall success if at least one item processed successfully
    results.success = results.processed > 0;
    
    return results;
  }
  
  /**
   * Validate entity or resource identifier
   * Flexible validation that works with different identifier types
   * 
   * @param {*} identifier - Identifier to validate
   * @param {string} context - Context for error messages
   * @param {Object} options - Validation options
   * @throws {Error} If identifier is invalid
   * @protected
   */
  _validateIdentifier(identifier, context = 'Identifier', options = {}) {
    const {
      allowNull = false,
      allowStrings = true,
      allowNumbers = true,
      allowObjects = false
    } = options;
    
    if (identifier === null || identifier === undefined) {
      if (!allowNull) {
        throw new Error(`${context} is required`);
      }
      return; // Valid if null is allowed
    }
    
    const type = typeof identifier;
    
    if (type === 'string' && !allowStrings) {
      throw new Error(`${context} cannot be a string`);
    }
    
    if (type === 'number' && !allowNumbers) {
      throw new Error(`${context} cannot be a number`);
    }
    
    if (type === 'object' && !allowObjects) {
      throw new Error(`${context} cannot be an object`);
    }
    
    // Additional validations based on type
    if (type === 'string' && allowStrings && identifier.trim() === '') {
      throw new Error(`${context} cannot be empty string`);
    }
    
    if (type === 'number' && allowNumbers && (isNaN(identifier) || !isFinite(identifier))) {
      throw new Error(`${context} must be a valid number`);
    }
  }
  
  /**
   * Enhanced destroy method with cache cleanup
   * CRITICAL: Must be synchronous - no await!
   */
  destroy() {
    // Clean up cache invalidation subscriptions
    for (const subscription of this._cacheInvalidationSubs) {
      try {
        subscription.unsubscribe();
      } catch (error) {
        console.warn('Failed to unsubscribe cache invalidation:', error.message);
      }
    }
    this._cacheInvalidationSubs.clear();
    
    // Clear local cache
    this._invalidateCache();
    
    // Call parent destroy for standard cleanup
    super.destroy();
  }
  
  /**
   * Get cache statistics and information
   * 
   * @returns {Object} Cache statistics
   */
  getCacheInfo() {
    return {
      hasLocalCache: this._cachedData !== null,
      localCacheValid: this._isLocalCacheValid(),
      cacheAge: this._cacheTimestamp > 0 ? Date.now() - this._cacheTimestamp : null,
      cacheTTL: this._cacheTTL,
      hasGlobalCache: !!this.cacheManager,
      globalCacheEnabled: this._enableGlobalCache,
      invalidationSubscriptions: this._cacheInvalidationSubs.size,
      cacheKey: this._cacheKey || null
    };
  }
  
  /**
   * Force refresh of cached data
   * CRITICAL: Must be synchronous - no await!
   * 
   * @returns {*} Fresh data
   */
  refreshCache() {
    this._invalidateCache();
    return this._getCachedData();
  }
  
  /**
   * Configure cache settings
   * 
   * @param {Object} cacheOptions - Cache configuration options
   */
  configureCaching(cacheOptions = {}) {
    if (cacheOptions.ttl !== undefined) {
      this._cacheTTL = Math.max(0, cacheOptions.ttl);
    }
    
    if (cacheOptions.enableGlobalCache !== undefined) {
      this._enableGlobalCache = !!cacheOptions.enableGlobalCache;
    }
    
    if (cacheOptions.cacheManager !== undefined) {
      this.cacheManager = cacheOptions.cacheManager;
    }
    
    // Invalidate cache if configuration changed significantly
    if (cacheOptions.invalidateOnReconfigure !== false) {
      this._invalidateCache();
    }
  }
}