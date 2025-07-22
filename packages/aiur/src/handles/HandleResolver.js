/**
 * HandleResolver - Resolves @handleName references to actual objects
 * 
 * Provides deep resolution of handle references in complex objects and arrays
 */

export class HandleResolver {
  constructor(handleRegistry) {
    this.registry = handleRegistry;
  }

  /**
   * Check if a string is a handle reference (@handleName)
   * @param {any} value - Value to check
   * @returns {boolean} True if value is a handle reference
   */
  isHandleReference(value) {
    if (typeof value !== 'string') {
      return false;
    }
    
    // Must start with @ and have at least one character after
    if (!value.startsWith('@') || value.length <= 1) {
      return false;
    }

    // Extract the handle name part
    const handleName = value.substring(1);
    
    // Handle name should not be empty and should be valid
    return handleName.length > 0;
  }

  /**
   * Extract handle name from reference
   * @param {string} reference - Handle reference string
   * @returns {string|null} Handle name or null if invalid
   */
  extractHandleName(reference) {
    if (!this.isHandleReference(reference)) {
      return null;
    }
    
    return reference.substring(1);
  }

  /**
   * Resolve a single value (string, object, array, etc.)
   * @param {any} value - Value to resolve
   * @returns {any} Resolved value
   */
  resolve(value) {
    if (this.isHandleReference(value)) {
      const handleName = this.extractHandleName(value);
      const handle = this.registry.getByName(handleName);
      
      if (!handle) {
        throw new Error(`Handle not found: ${handleName}`);
      }
      
      return handle.data;
    }
    
    return value;
  }

  /**
   * Resolve handles in an object or array recursively
   * @param {any} obj - Object to resolve handles in
   * @returns {any} Object with resolved handles
   */
  resolveObject(obj) {
    return this._resolveObjectInternal(obj, new WeakSet());
  }

  /**
   * Internal recursive resolution with circular reference detection
   * @private
   */
  _resolveObjectInternal(obj, visited) {
    // Handle primitive types and null/undefined
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj !== 'object') {
      return this.resolve(obj);
    }

    // Check for circular references
    if (visited.has(obj)) {
      throw new Error('Circular reference detected');
    }

    // Handle functions, dates, and other special objects
    if (typeof obj === 'function' || obj instanceof Date) {
      return obj;
    }

    // Mark this object as being processed
    visited.add(obj);

    try {
      if (Array.isArray(obj)) {
        return obj.map(item => this._resolveObjectInternal(item, visited));
      }

      // Handle regular objects
      const resolved = {};
      for (const [key, value] of Object.entries(obj)) {
        resolved[key] = this._resolveObjectInternal(value, visited);
      }

      return resolved;
    } finally {
      // Remove from visited set when done processing
      visited.delete(obj);
    }
  }

  /**
   * Resolve handles in function parameters
   * This is a convenience method for tool parameter resolution
   * @param {Object} params - Parameters object to resolve
   * @returns {Object} Resolved parameters
   */
  resolveParameters(params) {
    if (!params || typeof params !== 'object') {
      return params;
    }

    return this.resolveObject(params);
  }

  /**
   * Get all handle references used in an object
   * @param {any} obj - Object to scan for handle references
   * @returns {string[]} Array of handle names referenced
   */
  getUsedHandles(obj) {
    const handles = new Set();
    this._collectHandles(obj, handles, new WeakSet());
    return Array.from(handles);
  }

  /**
   * Internal method to collect handle references
   * @private
   */
  _collectHandles(obj, handles, visited) {
    if (obj === null || obj === undefined || typeof obj !== 'object') {
      if (this.isHandleReference(obj)) {
        const handleName = this.extractHandleName(obj);
        if (handleName) {
          handles.add(handleName);
        }
      }
      return;
    }

    // Avoid circular references
    if (visited.has(obj)) {
      return;
    }

    if (typeof obj === 'function' || obj instanceof Date) {
      return;
    }

    visited.add(obj);

    try {
      if (Array.isArray(obj)) {
        obj.forEach(item => this._collectHandles(item, handles, visited));
      } else {
        Object.values(obj).forEach(value => this._collectHandles(value, handles, visited));
      }
    } finally {
      visited.delete(obj);
    }
  }

  /**
   * Validate that all handle references in an object exist
   * @param {any} obj - Object to validate
   * @returns {boolean} True if all handles exist
   * @throws {Error} If any handle is missing
   */
  validateHandles(obj) {
    const usedHandles = this.getUsedHandles(obj);
    
    for (const handleName of usedHandles) {
      if (!this.registry.existsByName(handleName)) {
        throw new Error(`Handle not found: ${handleName}`);
      }
    }
    
    return true;
  }
}