/**
 * LRUHandleRegistry - Handle registry with LRU eviction and memory management
 * 
 * Extends HandleRegistry with LRU cache behavior and memory tracking
 */

import { HandleRegistry } from './HandleRegistry.js';

export class LRUHandleRegistry extends HandleRegistry {
  constructor(options = {}) {
    super();
    
    this.maxSize = options.maxSize || 1000;
    this.trackMemoryUsage = options.trackMemoryUsage !== false;
    this.onEviction = options.onEviction || null;
    
    // LRU tracking - use a doubly linked list approach with Set for O(1) operations
    this.lruOrder = new Map(); // handle name -> timestamp for simple LRU
    this.accessCounter = 0;
    
    // Statistics
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      memoryUsage: 0
    };
  }

  /**
   * Create a new handle with LRU tracking
   * @param {string} name - The name for the handle
   * @param {any} data - The data to store in the handle
   * @returns {string} The handle ID
   */
  create(name, data) {
    // Check if we need to evict before adding
    if (this.size() >= this.maxSize) {
      this._evictLRU();
    }

    // If name already exists, remove old handle without stats tracking
    if (this.nameIndex.has(name)) {
      const oldHandleId = this.nameIndex.get(name);
      const oldHandle = this.handles.get(oldHandleId);
      if (oldHandle && this.trackMemoryUsage) {
        this.stats.memoryUsage -= this._estimateSize(oldHandle.data);
      }
      this.handles.delete(oldHandleId);
      this.nameIndex.delete(name);
      this.lruOrder.delete(name);
    }

    // Create the handle directly (avoid double getByName call)
    const handleId = this._generateId();
    const now = new Date();
    
    const handle = {
      id: handleId,
      name: name,
      data: data,
      metadata: {
        created: now,
        lastAccessed: now,
        accessCount: 0
      }
    };

    this.handles.set(handleId, handle);
    this.nameIndex.set(name, handleId);
    
    // Track in LRU order
    this._updateLRUOrder(name);
    
    // Update memory usage
    if (this.trackMemoryUsage) {
      this.stats.memoryUsage += this._estimateSize(data);
    }
    
    return handleId;
  }

  /**
   * Get handle by ID with LRU tracking
   * @param {string} handleId - The handle ID
   * @returns {Object|null} The handle object or null if not found
   */
  getHandle(handleId) {
    const handle = super.getHandle(handleId);
    
    if (handle) {
      this.stats.hits++;
      this._updateLRUOrder(handle.name);
      return handle;
    } else {
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Get handle by name with LRU tracking
   * @param {string} name - The handle name
   * @returns {Object|null} The handle object or null if not found
   */
  getByName(name) {
    const handleId = this.nameIndex.get(name);
    if (!handleId) {
      this.stats.misses++;
      return null;
    }
    
    const handle = this.handles.get(handleId);
    if (!handle) {
      this.stats.misses++;
      return null;
    }

    // Update access metadata
    handle.metadata.lastAccessed = new Date();
    handle.metadata.accessCount++;

    // Update LRU tracking
    this.stats.hits++;
    this._updateLRUOrder(name);
    
    return handle;
  }

  /**
   * Delete handle with LRU cleanup
   * @param {string} handleId - The handle ID
   * @returns {boolean} True if handle was deleted
   */
  delete(handleId) {
    const handle = this.handles.get(handleId);
    if (handle) {
      // Update memory usage before deletion
      if (this.trackMemoryUsage) {
        this.stats.memoryUsage -= this._estimateSize(handle.data);
      }
      
      // Remove from LRU tracking
      this.lruOrder.delete(handle.name);
      
      return super.delete(handleId);
    }
    
    return false;
  }

  /**
   * Delete handle by name with LRU cleanup
   * @param {string} name - The handle name
   * @returns {boolean} True if handle was deleted
   */
  deleteByName(name) {
    const handle = this.getByName(name);
    if (handle) {
      return this.delete(handle.id);
    }
    
    return false;
  }

  /**
   * Clear all handles and reset LRU tracking
   */
  clear() {
    super.clear();
    this.lruOrder.clear();
    this.accessCounter = 0;
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      memoryUsage: 0
    };
  }

  /**
   * Get the current LRU order (least to most recently used)
   * @returns {string[]} Array of handle names in LRU order
   */
  getLRUOrder() {
    // Sort by access order (timestamp)
    return Array.from(this.lruOrder.entries())
      .sort(([, a], [, b]) => a - b)
      .map(([name]) => name);
  }

  /**
   * Get maximum cache size
   * @returns {number} Maximum number of handles
   */
  getMaxSize() {
    return this.maxSize;
  }

  /**
   * Get estimated memory usage
   * @returns {number} Estimated memory usage in bytes
   */
  getEstimatedMemoryUsage() {
    return this.trackMemoryUsage ? this.stats.memoryUsage : 0;
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getStatistics() {
    return {
      size: this.size(),
      maxSize: this.maxSize,
      hits: this.stats.hits,
      misses: this.stats.misses,
      evictions: this.stats.evictions,
      memoryUsage: this.stats.memoryUsage,
      hitRate: this.stats.hits + this.stats.misses > 0 
        ? this.stats.hits / (this.stats.hits + this.stats.misses) 
        : 0
    };
  }

  /**
   * Manually evict a specific handle
   * @param {string} name - Handle name to evict
   * @returns {boolean} True if handle was evicted
   */
  evict(name) {
    return this.deleteByName(name);
  }

  /**
   * Evict the least recently used handles
   * @param {number} count - Number of handles to evict
   * @returns {number} Number of handles actually evicted
   */
  evictLRU(count = 1) {
    const lruOrder = this.getLRUOrder();
    let evicted = 0;
    
    for (let i = 0; i < Math.min(count, lruOrder.length); i++) {
      if (this.deleteByName(lruOrder[i])) {
        evicted++;
      }
    }
    
    return evicted;
  }

  /**
   * Update LRU order for a handle
   * @private
   */
  _updateLRUOrder(name) {
    this.lruOrder.set(name, ++this.accessCounter);
  }

  /**
   * Generate a unique handle ID
   * @private
   * @returns {string} Unique handle ID
   */
  _generateId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2);
    return `handle_${timestamp}_${random}`;
  }

  /**
   * Evict the least recently used handle
   * @private
   */
  _evictLRU() {
    const lruOrder = this.getLRUOrder();
    if (lruOrder.length > 0) {
      const lruName = lruOrder[0];
      const handleId = this.nameIndex.get(lruName);
      
      if (handleId) {
        const handle = this.handles.get(handleId);
        
        if (handle) {
          // Call eviction callback if provided
          if (this.onEviction) {
            try {
              this.onEviction(handle);
            } catch (error) {
              // Log error but don't fail the eviction
              console.warn('Eviction callback error:', error);
            }
          }
          
          // Update memory usage
          if (this.trackMemoryUsage) {
            this.stats.memoryUsage -= this._estimateSize(handle.data);
          }
          
          // Remove from storage and LRU tracking
          this.handles.delete(handle.id);
          this.nameIndex.delete(handle.name);
          this.lruOrder.delete(handle.name);
          
          this.stats.evictions++;
        }
      }
    }
  }

  /**
   * Estimate the size of an object in bytes
   * @private
   */
  _estimateSize(obj) {
    if (!this.trackMemoryUsage) {
      return 0;
    }
    
    let size = 0;
    
    if (obj === null || obj === undefined) {
      return 8; // rough estimate for null/undefined
    }
    
    switch (typeof obj) {
      case 'boolean':
        return 4;
      case 'number':
        return 8;
      case 'string':
        return obj.length * 2; // rough estimate for UTF-16
      case 'object':
        if (Array.isArray(obj)) {
          size = 24; // array overhead
          for (const item of obj) {
            size += this._estimateSize(item);
          }
        } else if (obj instanceof Date) {
          return 24;
        } else {
          size = 24; // object overhead
          for (const [key, value] of Object.entries(obj)) {
            size += key.length * 2; // key size
            size += this._estimateSize(value); // value size
          }
        }
        break;
      default:
        return 24; // default for functions, symbols, etc.
    }
    
    return size;
  }
}