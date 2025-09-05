/**
 * HandleRegistry - Registry for managing live handle instances
 * 
 * Different from TypeHandleRegistry (which manages type metadata),
 * this manages actual handle instances for lifecycle tracking and cleanup.
 */

export class HandleRegistry {
  constructor() {
    this.handles = new Map(); // handleId -> handle instance
    this.handlesByType = new Map(); // handleType -> Set of handle instances
    this.creationTime = new Map(); // handleId -> creation timestamp
  }

  /**
   * Register a handle instance
   * @param {BaseHandle} handle - Handle instance to register
   */
  register(handle) {
    if (!handle || !handle.getGuid || !handle.handleType) {
      throw new Error('Invalid handle: must have getGuid() and handleType');
    }

    const handleId = handle.getGuid();
    
    // Register by ID
    this.handles.set(handleId, handle);
    this.creationTime.set(handleId, Date.now());
    
    // Register by type
    if (!this.handlesByType.has(handle.handleType)) {
      this.handlesByType.set(handle.handleType, new Set());
    }
    this.handlesByType.get(handle.handleType).add(handle);
    
    console.log(`[HandleRegistry] Registered handle ${handleId} of type ${handle.handleType}`);
  }

  /**
   * Get handle by ID
   * @param {string} handleId - Handle ID
   * @returns {BaseHandle|null} Handle instance or null if not found
   */
  get(handleId) {
    return this.handles.get(handleId) || null;
  }

  /**
   * Check if handle is registered
   * @param {string} handleId - Handle ID
   * @returns {boolean} True if handle exists
   */
  has(handleId) {
    return this.handles.has(handleId);
  }

  /**
   * Unregister a handle
   * @param {string} handleId - Handle ID
   * @returns {boolean} True if handle was removed
   */
  unregister(handleId) {
    const handle = this.handles.get(handleId);
    if (!handle) return false;

    // Remove from main registry
    this.handles.delete(handleId);
    this.creationTime.delete(handleId);
    
    // Remove from type registry
    const typeSet = this.handlesByType.get(handle.handleType);
    if (typeSet) {
      typeSet.delete(handle);
      
      // Clean up empty type sets
      if (typeSet.size === 0) {
        this.handlesByType.delete(handle.handleType);
      }
    }
    
    console.log(`[HandleRegistry] Unregistered handle ${handleId}`);
    return true;
  }

  /**
   * Get all handles of a specific type
   * @param {string} handleType - Handle type name
   * @returns {Array<BaseHandle>} Array of handle instances
   */
  getByType(handleType) {
    const typeSet = this.handlesByType.get(handleType);
    return typeSet ? Array.from(typeSet) : [];
  }

  /**
   * List all registered handle IDs
   * @returns {Array<string>} Array of handle IDs
   */
  listHandleIds() {
    return Array.from(this.handles.keys());
  }

  /**
   * List all registered handle types
   * @returns {Array<string>} Array of handle type names
   */
  listHandleTypes() {
    return Array.from(this.handlesByType.keys());
  }

  /**
   * Get registry statistics
   * @returns {Object} Registry statistics
   */
  getStats() {
    const typeStats = {};
    for (const [type, handleSet] of this.handlesByType) {
      typeStats[type] = handleSet.size;
    }

    return {
      totalHandles: this.handles.size,
      totalTypes: this.handlesByType.size,
      handlesByType: typeStats
    };
  }

  /**
   * Find handles by criteria
   * @param {Function} predicate - Filter function (handle) => boolean
   * @returns {Array<BaseHandle>} Matching handles
   */
  findHandles(predicate) {
    const result = [];
    for (const handle of this.handles.values()) {
      if (predicate(handle)) {
        result.push(handle);
      }
    }
    return result;
  }

  /**
   * Clear all handles and optionally dispose them
   * @param {boolean} disposeHandles - Whether to call dispose() on handles
   */
  clear(disposeHandles = false) {
    if (disposeHandles) {
      for (const handle of this.handles.values()) {
        if (typeof handle.dispose === 'function') {
          handle.dispose();
        }
      }
    }

    this.handles.clear();
    this.handlesByType.clear();
    this.creationTime.clear();
    
    console.log(`[HandleRegistry] Cleared all handles (disposed: ${disposeHandles})`);
  }

  /**
   * Cleanup old handles by age
   * @param {number} maxAgeMs - Maximum age in milliseconds
   * @param {boolean} disposeHandles - Whether to dispose old handles
   * @returns {number} Number of handles cleaned up
   */
  cleanupOld(maxAgeMs, disposeHandles = true) {
    const now = Date.now();
    const toRemove = [];
    
    for (const [handleId, creationTime] of this.creationTime) {
      if (now - creationTime > maxAgeMs) {
        toRemove.push(handleId);
      }
    }
    
    toRemove.forEach(handleId => {
      const handle = this.handles.get(handleId);
      
      if (disposeHandles && handle && typeof handle.dispose === 'function') {
        handle.dispose();
      }
      
      this.unregister(handleId);
    });
    
    console.log(`[HandleRegistry] Cleaned up ${toRemove.length} old handles`);
    return toRemove.length;
  }

  /**
   * Get global handle registry singleton
   * @returns {HandleRegistry} Global registry instance
   */
  static getGlobalRegistry() {
    if (!global.HandleRegistry || !(global.HandleRegistry instanceof HandleRegistry)) {
      global.HandleRegistry = new HandleRegistry();
    }
    
    return global.HandleRegistry;
  }
}