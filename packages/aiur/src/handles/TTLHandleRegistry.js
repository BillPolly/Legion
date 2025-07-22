/**
 * TTLHandleRegistry - Handle registry with TTL (Time-To-Live) functionality
 * 
 * Extends LRUHandleRegistry with automatic expiration and cleanup
 */

import { LRUHandleRegistry } from './LRUHandleRegistry.js';

export class TTLHandleRegistry extends LRUHandleRegistry {
  constructor(options = {}) {
    super(options);
    
    this.defaultTTL = options.defaultTTL !== undefined ? options.defaultTTL : 300000; // 5 minutes default
    this.extendOnAccess = options.extendOnAccess !== false; // Default true
    this.cleanupInterval = options.cleanupInterval || 60000; // 1 minute default cleanup
    
    // TTL tracking
    this.expiryTimers = new Map(); // handle name -> timeout ID
    this.cleanupTimer = null;
    
    // TTL statistics
    this.ttlStats = {
      totalExpired: 0,
      lastCleanup: new Date()
    };
    
    // Start automatic cleanup if interval is set
    if (this.cleanupInterval > 0) {
      this._startAutomaticCleanup();
    }
  }

  /**
   * Create a new handle with TTL support
   * @param {string} name - The name for the handle
   * @param {any} data - The data to store in the handle
   * @param {Object} options - Creation options
   * @param {number} options.ttl - TTL in milliseconds (overrides default)
   * @returns {string} The handle ID
   */
  create(name, data, options = {}) {
    const ttl = options.ttl !== undefined ? options.ttl : this.defaultTTL;
    
    // Validate TTL
    if (ttl < 0 || (typeof ttl !== 'number') || isNaN(ttl)) {
      throw new Error('TTL must be a non-negative number');
    }

    // Create the handle using parent method
    const handleId = super.create(name, data);
    
    // Add TTL metadata
    const handle = this.handles.get(handleId);
    if (handle) {
      if (ttl > 0) {
        handle.metadata.expiresAt = new Date(Date.now() + ttl);
        handle.metadata.ttl = ttl;
      } else {
        handle.metadata.expiresAt = null; // No expiration
        handle.metadata.ttl = 0;
      }
    }
    
    return handleId;
  }

  /**
   * Get handle by name with TTL extension support
   * @param {string} name - The handle name
   * @returns {Object|null} The handle object or null if not found/expired
   */
  getByName(name) {
    const handle = super.getByName(name);
    
    if (handle && this._isExpired(handle)) {
      // Handle has expired, clean it up
      this.delete(handle.id);
      return null;
    }
    
    if (handle && this.extendOnAccess && handle.metadata.ttl > 0) {
      // Extend TTL on access
      handle.metadata.expiresAt = new Date(Date.now() + handle.metadata.ttl);
    }
    
    return handle;
  }

  /**
   * Get handle by ID with TTL extension support
   * @param {string} handleId - The handle ID
   * @returns {Object|null} The handle object or null if not found/expired
   */
  getHandle(handleId) {
    const handle = super.getHandle(handleId);
    
    if (handle && this._isExpired(handle)) {
      // Handle has expired, clean it up
      this.delete(handleId);
      return null;
    }
    
    if (handle && this.extendOnAccess && handle.metadata.ttl > 0) {
      // Extend TTL on access
      handle.metadata.expiresAt = new Date(Date.now() + handle.metadata.ttl);
    }
    
    return handle;
  }

  /**
   * Delete handle with TTL cleanup
   * @param {string} handleId - The handle ID
   * @returns {boolean} True if handle was deleted
   */
  delete(handleId) {
    const handle = this.handles.get(handleId);
    if (handle) {
      // Clean up any expiry timer
      if (this.expiryTimers.has(handle.name)) {
        clearTimeout(this.expiryTimers.get(handle.name));
        this.expiryTimers.delete(handle.name);
      }
    }
    
    return super.delete(handleId);
  }

  /**
   * Clear all handles and cleanup TTL resources
   */
  clear() {
    // Clear all expiry timers
    this.expiryTimers.forEach(timerId => clearTimeout(timerId));
    this.expiryTimers.clear();
    
    // Reset TTL stats
    this.ttlStats = {
      totalExpired: 0,
      lastCleanup: new Date()
    };
    
    super.clear();
  }

  /**
   * Extend TTL for a specific handle
   * @param {string} name - Handle name
   * @param {number} additionalTime - Additional time in milliseconds
   * @returns {boolean} True if TTL was extended
   */
  extendTTL(name, additionalTime) {
    // Use parent method to avoid TTL extension on access
    const handle = super.getByName(name);
    if (!handle || handle.metadata.ttl === 0) {
      return false;
    }
    
    handle.metadata.expiresAt = new Date(handle.metadata.expiresAt.getTime() + additionalTime);
    return true;
  }

  /**
   * Refresh TTL to default for a handle
   * @param {string} name - Handle name
   * @returns {boolean} True if TTL was refreshed
   */
  refreshTTL(name) {
    // Use parent method to avoid TTL extension on access
    const handle = super.getByName(name);
    if (!handle) {
      return false;
    }
    
    if (handle.metadata.ttl > 0) {
      handle.metadata.expiresAt = new Date(Date.now() + this.defaultTTL);
      handle.metadata.ttl = this.defaultTTL;
    }
    
    return true;
  }

  /**
   * Get remaining TTL for a handle
   * @param {string} name - Handle name
   * @returns {number} Remaining TTL in milliseconds, -1 if not found, 0 if expired
   */
  getRemainingTTL(name) {
    const handle = super.getByName(name); // Use parent to avoid TTL extension
    if (!handle) {
      return -1;
    }
    
    if (handle.metadata.ttl === 0) {
      return Infinity; // No expiration
    }
    
    const remaining = handle.metadata.expiresAt.getTime() - Date.now();
    return Math.max(0, remaining);
  }

  /**
   * Manually trigger cleanup of expired handles
   * @returns {number} Number of handles expired
   */
  cleanupExpired() {
    let expiredCount = 0;
    const now = Date.now();
    
    // Collect handles to delete (avoid modifying map during iteration)
    const toDelete = [];
    
    for (const [handleId, handle] of this.handles) {
      if (handle.metadata.expiresAt && handle.metadata.expiresAt.getTime() <= now) {
        toDelete.push(handleId);
      }
    }
    
    // Delete expired handles
    for (const handleId of toDelete) {
      try {
        if (this.delete(handleId)) {
          expiredCount++;
        }
      } catch (error) {
        console.warn('Error during TTL cleanup:', error);
      }
    }
    
    // Update statistics
    this.ttlStats.totalExpired += expiredCount;
    this.ttlStats.lastCleanup = new Date();
    
    return expiredCount;
  }

  /**
   * Get handles that are expiring soon
   * @param {number} threshold - Time threshold in milliseconds (default 1000ms)
   * @returns {Array} Array of handles expiring within threshold
   */
  getExpiringHandles(threshold = 1000) {
    const expiring = [];
    const cutoff = Date.now() + threshold;
    
    for (const [, handle] of this.handles) {
      if (handle.metadata.expiresAt && 
          handle.metadata.expiresAt.getTime() <= cutoff &&
          handle.metadata.expiresAt.getTime() > Date.now()) {
        expiring.push({
          id: handle.id,
          name: handle.name,
          expiresAt: handle.metadata.expiresAt,
          remainingTTL: handle.metadata.expiresAt.getTime() - Date.now()
        });
      }
    }
    
    return expiring.sort((a, b) => a.remainingTTL - b.remainingTTL);
  }

  /**
   * Get TTL health information
   * @returns {Object} Health information about TTL usage
   */
  getTTLHealthInfo() {
    let totalTTL = 0;
    let expiringSoon = 0;
    let permanentHandles = 0;
    const now = Date.now();
    const soonThreshold = 1000; // 1 second
    
    for (const [, handle] of this.handles) {
      if (handle.metadata.ttl === 0) {
        permanentHandles++;
      } else {
        totalTTL += (handle.metadata.expiresAt.getTime() - now);
        if (handle.metadata.expiresAt.getTime() - now <= soonThreshold) {
          expiringSoon++;
        }
      }
    }
    
    return {
      totalHandles: this.size(),
      permanentHandles,
      expiringSoon,
      averageTTL: this.size() > permanentHandles ? totalTTL / (this.size() - permanentHandles) : 0,
      totalExpired: this.ttlStats.totalExpired,
      lastCleanup: this.ttlStats.lastCleanup
    };
  }

  /**
   * Get enhanced statistics including TTL information
   * @returns {Object} Enhanced cache statistics
   */
  getStatistics() {
    const baseStats = super.getStatistics();
    return {
      ...baseStats,
      totalExpired: this.ttlStats.totalExpired,
      lastCleanup: this.ttlStats.lastCleanup
    };
  }

  /**
   * Destroy the registry and cleanup all resources
   */
  destroy() {
    // Stop automatic cleanup
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    // Clear all timers
    this.expiryTimers.forEach(timerId => clearTimeout(timerId));
    this.expiryTimers.clear();
    
    // Clear handles
    this.clear();
  }

  /**
   * Check if a handle has expired
   * @private
   */
  _isExpired(handle) {
    if (!handle.metadata.expiresAt) {
      return false; // No expiration set
    }
    
    return handle.metadata.expiresAt.getTime() <= Date.now();
  }

  /**
   * Start automatic cleanup process
   * @private
   */
  _startAutomaticCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired();
    }, this.cleanupInterval);
  }
}