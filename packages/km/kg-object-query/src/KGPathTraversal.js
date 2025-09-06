/**
 * KGPathTraversal - Path traversal using Knowledge Graph triple queries
 * 
 * Replaces simple object property access with KG-based path resolution
 * Supports complex paths like "project.files[0].content" via triple patterns
 */

import { TripleConverter } from './utils/TripleConverter.js';

export class KGPathTraversal {
  /**
   * Traverse a path in the KG starting from root entity
   * @param {KGEngine} kgEngine - KG engine with data
   * @param {string} rootEntityId - Root entity ID (usually 'root_object')
   * @param {string} path - Path to traverse (e.g., "project.files[0].content")
   * @returns {*} Value at path or undefined
   */
  static traverse(kgEngine, rootEntityId, path) {
    if (!path || typeof path !== 'string') {
      throw new Error('Path must be a non-empty string');
    }
    
    // Handle special syntax like "conversation.messages[-3:]"
    if (path.includes('[') && (path.includes(':]') || path.includes('-'))) {
      return this._handleArraySlicing(kgEngine, rootEntityId, path);
    }
    
    // Split path into segments
    const segments = this._parsePath(path);
    
    let currentEntityId = rootEntityId;
    let currentValue = null;
    
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      
      if (segment.type === 'property') {
        // Query for property value
        const propertyId = this._generatePropertyId(currentEntityId, segment.name);
        const triples = kgEngine.query(currentEntityId, propertyId, null);
        
        if (triples.length === 0) {
          return undefined;
        }
        
        if (triples.length === 1) {
          currentValue = triples[0][2];
          // Check if this points to another entity
          currentEntityId = this._isEntityId(currentValue) ? currentValue : null;
        } else {
          // Multiple values - return as array
          currentValue = triples.map(t => t[2]);
          currentEntityId = null;
        }
        
      } else if (segment.type === 'array_index') {
        // Handle array indexing
        if (!Array.isArray(currentValue)) {
          // Need to get array from KG
          const propertyId = this._generatePropertyId(currentEntityId, segment.property);
          const triples = kgEngine.query(currentEntityId, propertyId, null);
          currentValue = triples.map(t => t[2]);
        }
        
        const index = segment.index;
        if (index >= 0 && index < currentValue.length) {
          currentValue = currentValue[index];
          currentEntityId = typeof currentValue === 'string' && currentValue.startsWith('obj_') ? currentValue : null;
        } else {
          return undefined;
        }
        
      } else if (segment.type === 'array_slice') {
        // Handle array slicing like [-3:]
        if (!Array.isArray(currentValue)) {
          const propertyId = this._generatePropertyId(currentEntityId, segment.property);
          const triples = kgEngine.query(currentEntityId, propertyId, null);
          currentValue = triples.map(t => t[2]);
        }
        
        const { start, end } = segment;
        currentValue = currentValue.slice(start, end);
        currentEntityId = null; // Arrays don't have single entity ID
      }
    }
    
    return currentValue;
  }
  
  /**
   * Parse path string into segments
   * @private
   */
  static _parsePath(path) {
    const segments = [];
    const parts = path.split('.');
    
    for (const part of parts) {
      if (part.includes('[')) {
        // Handle array indexing: "files[0]"
        const [property, indexPart] = part.split('[');
        const indexStr = indexPart.replace(']', '');
        
        // Add property segment
        if (property) {
          segments.push({ type: 'property', name: property });
        }
        
        // Add array index segment
        if (indexStr.includes(':')) {
          // Array slicing
          const [startStr, endStr] = indexStr.split(':');
          const start = startStr ? parseInt(startStr) : 0;
          const end = endStr ? parseInt(endStr) : undefined;
          segments.push({ type: 'array_slice', start, end, property });
        } else {
          // Simple index
          const index = parseInt(indexStr);
          segments.push({ type: 'array_index', index, property });
        }
        
      } else {
        // Simple property
        segments.push({ type: 'property', name: part });
      }
    }
    
    return segments;
  }
  
  /**
   * Handle complex array slicing like "conversation.messages[-3:]"
   * @private
   */
  static _handleArraySlicing(kgEngine, rootEntityId, path) {
    // Parse the path to get base path and slice specification
    const sliceMatch = path.match(/^(.+?)\[([^\]]+)\]$/);
    if (!sliceMatch) {
      throw new Error(`Invalid array slice syntax: ${path}`);
    }
    
    const [, basePath, sliceSpec] = sliceMatch;
    
    // Get the array first
    const array = this.traverse(kgEngine, rootEntityId, basePath);
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
   * Generate property ID for KG queries
   * @private
   */
  static _generatePropertyId(entityId, propertyName) {
    // This should match how the original toTriples() generates property IDs
    // For now, use simple format but should be consistent with IDManager
    return `prop_${propertyName}`;
  }
  
  /**
   * Check if a value is an entity ID
   * @private
   */
  static _isEntityId(value) {
    return typeof value === 'string' && (value.includes('_') || value === 'root_object');
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