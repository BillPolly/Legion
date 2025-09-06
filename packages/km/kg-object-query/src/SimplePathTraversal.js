/**
 * SimplePathTraversal - Direct object path traversal (temporary implementation)
 * 
 * This is a temporary implementation that works with direct object access
 * while we debug the KG integration. Will be replaced with full KG implementation.
 */

export class SimplePathTraversal {
  /**
   * Traverse a path in the object directly
   * @param {Object} rootObject - Root object to traverse
   * @param {string} path - Path to traverse (e.g., "project.files[0].content")
   * @returns {*} Value at path or undefined
   */
  static traverse(rootObject, path) {
    if (!path || typeof path !== 'string') {
      throw new Error('Path must be a non-empty string');
    }
    
    // Handle special syntax like "conversation.messages[-3:]"
    if (path.includes('[') && (path.includes(':]') || path.includes('-'))) {
      return this._handleArraySlicing(rootObject, path);
    }
    
    // Simple path traversal
    const parts = path.split('.');
    let current = rootObject;
    
    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      
      if (part.includes('[')) {
        // Handle array access like "files[0]"
        const [property, indexPart] = part.split('[');
        const indexStr = indexPart.replace(']', '');
        
        if (property) {
          current = current[property];
        }
        
        if (current === null || current === undefined) {
          return undefined;
        }
        
        if (!Array.isArray(current)) {
          return undefined;
        }
        
        const index = parseInt(indexStr);
        current = current[index >= 0 ? index : current.length + index];
      } else {
        // Simple property access
        current = current[part];
      }
    }
    
    return current;
  }
  
  /**
   * Handle complex array slicing like "conversation.messages[-3:]"
   * @private
   */
  static _handleArraySlicing(rootObject, path) {
    // Parse the path to get base path and slice specification
    const sliceMatch = path.match(/^(.+?)\[([^\]]+)\]$/);
    if (!sliceMatch) {
      throw new Error(`Invalid array slice syntax: ${path}`);
    }
    
    const [, basePath, sliceSpec] = sliceMatch;
    
    // Get the array first
    const array = this.traverse(rootObject, basePath);
    if (!Array.isArray(array)) {
      return undefined;
    }
    
    // Parse slice specification
    if (sliceSpec.includes(':')) {
      const [startStr, endStr] = sliceSpec.split(':');
      let start = startStr ? parseInt(startStr) : 0;
      let end = endStr ? parseInt(endStr) : array.length;
      
      // Handle negative indices
      if (start < 0) start = Math.max(0, array.length + start);
      if (end < 0) end = Math.max(0, array.length + end);
      
      return array.slice(start, end);
    } else {
      // Simple index
      const index = parseInt(sliceSpec);
      return array[index >= 0 ? index : array.length + index];
    }
  }
  
  /**
   * Validate path syntax
   * @param {string} path - Path to validate
   * @throws {Error} If path is invalid
   */
  static validatePath(path) {
    if (!path || typeof path !== 'string') {
      throw new Error('Path must be a non-empty string');
    }
    
    // Basic validation - could be enhanced
    if (path.includes('..') || path.includes('//')) {
      throw new Error('Invalid path syntax: double separators not allowed');
    }
    
    // Validate bracket syntax
    const brackets = path.match(/\[([^\]]*)\]/g);
    if (brackets) {
      for (const bracket of brackets) {
        const inner = bracket.slice(1, -1);
        if (inner === '') {
          throw new Error('Empty array index not allowed');
        }
        
        // Allow numbers, negative numbers, and slice syntax
        if (!/^-?\d+(:-?\d*)?$/.test(inner) && !/^-?\d*:-?\d+$/.test(inner)) {
          throw new Error(`Invalid array index syntax: ${bracket}`);
        }
      }
    }
  }
}