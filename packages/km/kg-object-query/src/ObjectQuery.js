/**
 * ObjectQuery - Main API class providing backward compatibility
 * 
 * Maintains identical interface to original ObjectQuery while using
 * KG-powered implementation under the hood for enhanced capabilities
 */

import { KGQueryProcessor } from './KGQueryProcessor.js';

export class ObjectQuery {
  /**
   * Create an object query processor (backward compatible)
   * @param {Object} querySpecification - Query specification
   */
  constructor(querySpecification) {
    if (!querySpecification) {
      throw new Error('Query specification is required');
    }

    this.querySpec = querySpecification;
    this.processor = new KGQueryProcessor(querySpecification);
  }

  /**
   * Execute query on root object to generate labeled inputs
   * EXACT same API as original ObjectQuery
   * @param {Object} rootObject - Root object to extract data from
   * @param {Object} options - Execution options
   * @returns {Object} Labeled inputs ready for prompt-builder
   */
  execute(rootObject, options = {}) {
    if (!rootObject || typeof rootObject !== 'object') {
      throw new Error('Root object must be a non-null object');
    }

    const labeledInputs = {};

    // Process all bindings using KG processor
    if (this.querySpec.bindings) {
      for (const [bindingName, bindingDef] of Object.entries(this.querySpec.bindings)) {
        try {
          const value = this.processor.processBinding(bindingDef, rootObject);
          if (value !== undefined) {
            labeledInputs[bindingName] = value;
          }
        } catch (error) {
          if (options.strict) {
            throw error;
          }
          // Skip failed bindings in non-strict mode (same as original)
          console.warn(`Failed to process binding ${bindingName}: ${error.message}`);
        }
      }
    }

    // Process context variables using KG processor
    if (this.querySpec.contextVariables) {
      for (const [varName, varDef] of Object.entries(this.querySpec.contextVariables)) {
        try {
          const value = this.processor.processContextVariable(varDef, rootObject);
          if (value !== undefined) {
            labeledInputs[varName] = value;
          }
        } catch (error) {
          if (options.strict) {
            throw error;
          }
          console.warn(`Failed to process context variable ${varName}: ${error.message}`);
        }
      }
    }

    return labeledInputs;
  }

  /**
   * Validate the query specification (backward compatible)
   * @throws {Error} If query is invalid
   */
  validateQuery() {
    this.processor.validateQuerySpec();
  }

  /**
   * Analyze root object structure (backward compatible)
   * @param {Object} rootObject - Object to analyze
   * @returns {Object} Structure analysis
   */
  analyzeObject(rootObject) {
    return {
      type: typeof rootObject,
      isArray: Array.isArray(rootObject),
      keys: rootObject && typeof rootObject === 'object' ? Object.keys(rootObject) : [],
      depth: this._calculateDepth(rootObject),
      size: this._estimateSize(rootObject)
    };
  }

  /**
   * Get all paths referenced in query (backward compatible)
   * @returns {string[]} Array of paths
   */
  getRequiredPaths() {
    const paths = [];
    
    if (this.querySpec.bindings) {
      for (const binding of Object.values(this.querySpec.bindings)) {
        if (binding.path) {
          paths.push(binding.path);
        }
        if (binding.aggregate) {
          binding.aggregate.forEach(item => {
            if (item.path) paths.push(item.path);
          });
        }
      }
    }

    if (this.querySpec.contextVariables) {
      for (const varDef of Object.values(this.querySpec.contextVariables)) {
        if (varDef.path) {
          paths.push(varDef.path);
        }
      }
    }

    return [...new Set(paths)]; // Remove duplicates
  }

  /**
   * Get KG-specific statistics (NEW - enhanced functionality)
   * @returns {Object} Query processor statistics
   */
  getStats() {
    return this.processor.getStats();
  }

  /**
   * Clean up resources (NEW - enhanced functionality)
   */
  cleanup() {
    this.processor.cleanup();
  }

  /**
   * Calculate object depth (backward compatible)
   * @private
   */
  _calculateDepth(obj, currentDepth = 0) {
    if (!obj || typeof obj !== 'object' || currentDepth > 10) {
      return currentDepth;
    }

    let maxDepth = currentDepth;
    
    for (const value of Object.values(obj)) {
      if (typeof value === 'object' && value !== null) {
        const depth = this._calculateDepth(value, currentDepth + 1);
        maxDepth = Math.max(maxDepth, depth);
      }
    }

    return maxDepth;
  }

  /**
   * Estimate object size (backward compatible)
   * @private
   */
  _estimateSize(obj) {
    try {
      return JSON.stringify(obj).length;
    } catch (error) {
      return 0;
    }
  }
}