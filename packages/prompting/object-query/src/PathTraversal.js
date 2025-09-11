/**
 * PathTraversal - Advanced object path navigation and data extraction
 * 
 * Provides flexible path traversal with support for:
 * - Basic object navigation (obj.prop.subprop)
 * - Array access and slicing (arr[0], arr[-1], arr[1:5])
 * - Wildcard matching (*.prop, obj.*.value)
 * - Conditional filtering (arr[prop=value])
 */

export class PathTraversal {
  /**
   * Traverse object using path specification
   * @param {Object} obj - Object to traverse
   * @param {string} path - Path specification
   * @param {Object} options - Traversal options
   * @returns {*} Value at path or undefined
   */
  static traverse(obj, path, options = {}) {
    if (!obj) {
      return undefined;
    }

    if (!path || path === '') {
      return obj;
    }

    if (typeof path !== 'string') {
      throw new Error('Path must be a string');
    }

    // Handle array slicing notation
    if (path.includes('[') && (path.includes(':') || path.includes('-'))) {
      return this._traverseWithSlicing(obj, path);
    }

    // Handle wildcard paths
    if (path.includes('*')) {
      return this.expandWildcards(obj, path);
    }

    // Handle conditional filtering
    if (path.includes('[') && (path.includes('=') || path.includes('>') || path.includes('<'))) {
      return this._traverseWithConditional(obj, path);
    }

    // Basic path traversal
    return this._traverseBasic(obj, path);
  }

  /**
   * Validate path syntax
   * @param {string} path - Path to validate
   * @throws {Error} If path syntax is invalid
   */
  static validatePath(path) {
    if (path === null || path === undefined) {
      throw new Error('Path must be a string');
    }

    if (typeof path !== 'string') {
      throw new Error('Path must be a string');
    }

    if (path === '') {
      return; // Empty path is valid (returns root)
    }

    // Check for invalid syntax patterns
    if (path.includes('..')) {
      throw new Error('Invalid path syntax: consecutive dots not allowed');
    }

    if (path.includes('[') && !path.includes(']')) {
      throw new Error('Invalid path syntax: unmatched brackets');
    }

    // Check for invalid bracket patterns
    if (path.includes('.[') || path.includes('[.')) {
      throw new Error('Invalid path syntax: invalid bracket placement');
    }
  }

  /**
   * Expand wildcard patterns in path
   * @param {Object} obj - Object to search
   * @param {string} path - Path with wildcards
   * @returns {Array} Array of matching values
   */
  static expandWildcards(obj, path) {
    if (!obj || !path || !path.includes('*')) {
      return [this.traverse(obj, path)];
    }

    const parts = path.split('.');
    let currentValues = [obj];
    
    for (const part of parts) {
      if (part === '*') {
        // Expand wildcard
        const newValues = [];
        for (const value of currentValues) {
          if (Array.isArray(value)) {
            newValues.push(...value);
          } else if (typeof value === 'object' && value !== null) {
            newValues.push(...Object.values(value));
          }
        }
        currentValues = newValues;
      } else if (part.includes('[') && part.includes('=')) {
        // Handle conditional filtering within wildcard
        const newValues = [];
        for (const value of currentValues) {
          if (Array.isArray(value)) {
            const filtered = this.conditionalFilter(value, part.match(/\[([^\]]+)\]/)[1]);
            newValues.push(...filtered);
          } else {
            newValues.push(value);
          }
        }
        currentValues = newValues;
      } else {
        // Regular property access
        const newValues = [];
        for (const value of currentValues) {
          const nextValue = this._traverseBasic(value, part);
          if (nextValue !== undefined) {
            newValues.push(nextValue);
          }
        }
        currentValues = newValues;
      }
    }
    
    return currentValues;
  }

  /**
   * Apply array slicing notation
   * @param {Array} array - Array to slice
   * @param {string} sliceNotation - Slice notation (e.g., "1:5", "-3:", "2")
   * @returns {Array|*} Sliced array or single element
   */
  static applySlicing(array, sliceNotation) {
    if (!Array.isArray(array)) {
      return array;
    }

    if (!sliceNotation || typeof sliceNotation !== 'string') {
      return array;
    }

    // Handle single index
    if (!sliceNotation.includes(':')) {
      const index = parseInt(sliceNotation);
      if (isNaN(index)) {
        return array;
      }
      
      const actualIndex = index < 0 ? array.length + index : index;
      return array[actualIndex];
    }

    // Handle slice notation
    const [startStr, endStr] = sliceNotation.split(':');
    
    let start = 0;
    let end = array.length;
    
    if (startStr && startStr.trim() !== '') {
      start = parseInt(startStr);
      if (start < 0) start = array.length + start;
    }
    
    if (endStr && endStr.trim() !== '') {
      end = parseInt(endStr);
      if (end < 0) end = array.length + end;
    }
    
    return array.slice(start, end);
  }

  /**
   * Apply conditional filtering to array
   * @param {Array} array - Array to filter
   * @param {string} condition - Filter condition
   * @returns {Array} Filtered array
   */
  static conditionalFilter(array, condition) {
    if (!Array.isArray(array) || !condition) {
      return Array.isArray(array) ? array : [];
    }

    try {
      return array.filter(item => this._evaluateCondition(item, condition));
    } catch (error) {
      return array; // Return original array if filtering fails
    }
  }

  /**
   * Basic object path traversal
   * @private
   */
  static _traverseBasic(obj, path) {
    if (!obj || !path) {
      return obj;
    }

    const parts = path.split('.');
    let current = obj;
    
    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      
      // Handle array indices
      const arrayMatch = part.match(/^(.+)\[(\d+)\]$/) || part.match(/^(\d+)$/);
      if (arrayMatch) {
        const propName = arrayMatch[1] || '';
        const index = parseInt(arrayMatch[2] || arrayMatch[1]);
        
        if (propName) {
          current = current[propName];
        }
        
        if (Array.isArray(current)) {
          const actualIndex = index < 0 ? current.length + index : index;
          current = current[actualIndex];
        } else {
          return undefined;
        }
      } else {
        current = current[part];
      }
    }
    
    return current;
  }

  /**
   * Traverse with array slicing
   * @private
   */
  static _traverseWithSlicing(obj, path) {
    // Find the part with slicing
    const sliceMatch = path.match(/^(.+)\[([^\]]+)\](.*)$/);
    if (!sliceMatch) {
      return this._traverseBasic(obj, path);
    }

    const [, beforePath, sliceNotation, afterPath] = sliceMatch;
    
    // Get the array to slice
    let arrayValue = beforePath ? this._traverseBasic(obj, beforePath) : obj;
    
    if (!Array.isArray(arrayValue)) {
      return undefined;
    }

    // Apply slicing
    const sliced = this.applySlicing(arrayValue, sliceNotation);
    
    // Continue traversal if there's more path
    if (afterPath && afterPath.startsWith('.')) {
      const remainingPath = afterPath.substring(1);
      if (Array.isArray(sliced)) {
        return sliced.map(item => this._traverseBasic(item, remainingPath));
      } else {
        return this._traverseBasic(sliced, remainingPath);
      }
    }
    
    return sliced;
  }

  /**
   * Traverse with conditional filtering
   * @private
   */
  static _traverseWithConditional(obj, path) {
    const condMatch = path.match(/^(.+)\[([^\]]+)\](.*)$/);
    if (!condMatch) {
      return this._traverseBasic(obj, path);
    }

    const [, beforePath, condition, afterPath] = condMatch;
    
    // Get the array to filter
    let arrayValue = beforePath ? this._traverseBasic(obj, beforePath) : obj;
    
    if (!Array.isArray(arrayValue)) {
      return undefined;
    }

    // Apply conditional filter
    const filtered = this.conditionalFilter(arrayValue, condition);
    
    // Continue traversal if there's more path
    if (afterPath && afterPath.startsWith('.')) {
      const remainingPath = afterPath.substring(1);
      return filtered.map(item => this._traverseBasic(item, remainingPath));
    }
    
    return filtered;
  }

  /**
   * Evaluate filter condition on item
   * @private
   */
  static _evaluateCondition(item, condition) {
    // Simple equality: prop=value
    if (condition.includes('=') && !condition.includes('>') && !condition.includes('<')) {
      const [prop, value] = condition.split('=');
      return String(item[prop]) === value;
    }

    // Greater than: prop>value  
    if (condition.includes('>')) {
      const [prop, value] = condition.split('>');
      return Number(item[prop]) > Number(value);
    }

    // Less than: prop<value
    if (condition.includes('<')) {
      const [prop, value] = condition.split('<');
      return Number(item[prop]) < Number(value);
    }

    // Contains: prop~value
    if (condition.includes('~')) {
      const [prop, value] = condition.split('~');
      return String(item[prop]).includes(value);
    }

    return true; // Default to include if condition is unclear
  }
}