/**
 * KGQueryProcessor - Core query processing engine powered by Knowledge Graph
 * 
 * Replaces the original QueryProcessor with KG-based implementation
 * while maintaining identical API and behavior
 */

import { SimplePathTraversal } from './SimplePathTraversal.js';
import { KGDataTransformations } from './KGDataTransformations.js';
import { TripleConverter } from './utils/TripleConverter.js';
import { QueryOptimizer } from './utils/QueryOptimizer.js';

export class KGQueryProcessor {
  /**
   * Create a KG-powered query processor
   * @param {Object} querySpec - Query specification
   */
  constructor(querySpec) {
    this.querySpec = querySpec;
    this.kgEngine = null;
    this.rootEntityId = 'root_object';
    this.optimizer = new QueryOptimizer();
    this.validateQuerySpec();
  }
  
  /**
   * Initialize with root object data
   * @param {Object} rootObject - Root object to convert to KG
   */
  initialize(rootObject) {
    // Convert root object to KG triples
    this.kgEngine = TripleConverter.objectToKG(rootObject);
  }
  
  /**
   * Process a single binding definition using KG
   * @param {Object} bindingDef - Binding definition
   * @param {Object} rootObject - Root object (for KG initialization)
   * @returns {*} Processed binding value
   */
  processBinding(bindingDef, rootObject) {
    // Initialize KG if not done yet
    if (!this.kgEngine) {
      this.initialize(rootObject);
    }
    
    let value;

    // Handle direct value assignment
    if (bindingDef.value !== undefined) {
      value = bindingDef.value;
    }
    // Handle path-based extraction using simple path traversal
    else if (bindingDef.path) {
      // Check cache first
      const cachedValue = this.optimizer.getCachedPath(bindingDef.path);
      if (cachedValue !== null) {
        value = cachedValue;
      } else {
        value = SimplePathTraversal.traverse(rootObject, bindingDef.path);
        
        // Cache the result
        if (value !== undefined) {
          this.optimizer.cachePath(bindingDef.path, value);
        }
      }
      
      if (value === undefined && bindingDef.required) {
        throw new Error(`Required binding path not found: ${bindingDef.path}`);
      }
      
      if (value === undefined && bindingDef.fallback !== undefined) {
        value = bindingDef.fallback;
      }
      
      // Apply filter BEFORE transformations if specified
      if (bindingDef.filter && value !== undefined) {
        value = KGDataTransformations.filter(value, bindingDef.filter, this.kgEngine);
      }
    }
    // Handle aggregation using KG
    else if (bindingDef.aggregate) {
      value = this._processAggregation(bindingDef.aggregate, rootObject);
    }
    else {
      throw new Error('Binding definition must have path, value, or aggregate');
    }

    // Apply transformations using KG-enhanced transformations
    if (bindingDef.transform && value !== undefined) {
      value = this.applyTransformations(value, bindingDef);
    }

    return value;
  }
  
  /**
   * Process a context variable definition using KG
   * @param {Object} varDef - Context variable definition
   * @param {Object} rootObject - Root object (for KG initialization)
   * @returns {*} Context variable value
   */
  processContextVariable(varDef, rootObject) {
    // Initialize KG if not done yet
    if (!this.kgEngine) {
      this.initialize(rootObject);
    }
    
    if (varDef.value !== undefined) {
      return varDef.value;
    }
    
    if (varDef.path) {
      // Check cache first
      const cachedValue = this.optimizer.getCachedPath(varDef.path);
      if (cachedValue !== null) {
        return cachedValue;
      }
      
      const value = SimplePathTraversal.traverse(rootObject, varDef.path);
      
      // Cache the result
      if (value !== undefined) {
        this.optimizer.cachePath(varDef.path, value);
      }
      
      return value;
    }
    
    throw new Error('Context variable definition must have path or value');
  }
  
  /**
   * Apply transformations to extracted data using KG-enhanced transforms
   * @param {*} data - Data to transform
   * @param {Object} transformDef - Transformation definition
   * @returns {*} Transformed data
   */
  applyTransformations(data, transformDef) {
    const transform = transformDef.transform;
    const options = transformDef.options || {};
    
    // Merge direct options with nested options
    const mergedOptions = { ...options, ...transformDef };
    delete mergedOptions.transform;
    delete mergedOptions.path;
    delete mergedOptions.options;

    return KGDataTransformations.applyTransformation(transform, data, mergedOptions, this.kgEngine);
  }
  
  /**
   * Validate query specification (same as original)
   * @private
   */
  validateQuerySpec() {
    if (!this.querySpec || typeof this.querySpec !== 'object') {
      throw new Error('Query specification must be an object');
    }

    if (!this.querySpec.bindings) {
      throw new Error('Query specification must have bindings');
    }

    // Validate each binding
    for (const [name, binding] of Object.entries(this.querySpec.bindings)) {
      this._validateBinding(name, binding);
    }

    // Validate context variables if present
    if (this.querySpec.contextVariables) {
      for (const [name, varDef] of Object.entries(this.querySpec.contextVariables)) {
        this._validateContextVariable(name, varDef);
      }
    }
  }
  
  /**
   * Validate a single binding definition
   * @private
   */
  _validateBinding(name, binding) {
    if (!name || typeof name !== 'string') {
      throw new Error('Binding name must be a non-empty string');
    }

    if (!binding || typeof binding !== 'object') {
      throw new Error(`Binding ${name} must be an object`);
    }

    if (!binding.path && binding.value === undefined && !binding.aggregate) {
      throw new Error(`Binding ${name} must have path, value, or aggregate`);
    }

    if (binding.path) {
      SimplePathTraversal.validatePath(binding.path);
    }
  }
  
  /**
   * Validate a context variable definition
   * @private
   */
  _validateContextVariable(name, varDef) {
    if (!name || typeof name !== 'string') {
      throw new Error('Context variable name must be a non-empty string');
    }

    if (!varDef || typeof varDef !== 'object') {
      throw new Error(`Context variable ${name} must be an object`);
    }

    if (!varDef.path && varDef.value === undefined) {
      throw new Error(`Context variable ${name} must have path or value`);
    }
  }
  
  /**
   * Process aggregation definition using simple path traversal 
   * @private
   */
  _processAggregation(aggregateDef, rootObject) {
    if (!Array.isArray(aggregateDef)) {
      throw new Error('Aggregate must be an array');
    }

    const values = [];
    let totalWeight = 0;

    for (const item of aggregateDef) {
      // Use KG path traversal for aggregation paths
      const value = SimplePathTraversal.traverse(rootObject, item.path);
      const weight = item.weight || 1;
      
      if (value !== undefined) {
        values.push({ value, weight });
        totalWeight += weight;
      }
    }

    // Simple concatenation for MVP (weighted combination could be added later)
    return values.map(({ value, weight }) => {
      const contribution = weight / totalWeight;
      return typeof value === 'string' ? value : JSON.stringify(value);
    }).join('\n\n');
  }
  
  /**
   * Get processor statistics
   * @returns {Object} Performance and cache statistics
   */
  getStats() {
    return {
      optimizer: this.optimizer.getStats(),
      kgEngine: this.kgEngine ? {
        initialized: true,
        tripleCount: this.kgEngine.size ? this.kgEngine.size() : 'unknown'
      } : {
        initialized: false
      }
    };
  }
  
  /**
   * Clean up resources
   */
  cleanup() {
    if (this.optimizer) {
      this.optimizer.cleanup();
    }
    
    if (this.kgEngine) {
      // KG engine cleanup if needed
      this.kgEngine = null;
    }
  }
}