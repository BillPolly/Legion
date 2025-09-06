/**
 * QueryProcessor - Query execution engine
 */

import { PathTraversal } from './PathTraversal.js';
import { DataTransformations } from './DataTransformations.js';

export class QueryProcessor {
  /**
   * Create a query processor
   * @param {Object} querySpec - Query specification
   */
  constructor(querySpec) {
    this.querySpec = querySpec;
    this.validateQuerySpec();
  }

  /**
   * Process a single binding definition
   * @param {Object} bindingDef - Binding definition
   * @param {Object} rootObject - Root object to extract from
   * @returns {*} Processed binding value
   */
  processBinding(bindingDef, rootObject) {
    let value;

    // Handle direct value assignment
    if (bindingDef.value !== undefined) {
      value = bindingDef.value;
    }
    // Handle path-based extraction
    else if (bindingDef.path) {
      value = PathTraversal.traverse(rootObject, bindingDef.path);
      
      if (value === undefined && bindingDef.required) {
        throw new Error(`Required binding path not found: ${bindingDef.path}`);
      }
      
      if (value === undefined && bindingDef.fallback !== undefined) {
        value = bindingDef.fallback;
      }
    }
    // Handle aggregation
    else if (bindingDef.aggregate) {
      value = this._processAggregation(bindingDef.aggregate, rootObject);
    }
    else {
      throw new Error('Binding definition must have path, value, or aggregate');
    }

    // Apply transformations
    if (bindingDef.transform && value !== undefined) {
      value = this.applyTransformations(value, bindingDef);
    }

    return value;
  }

  /**
   * Process a context variable definition
   * @param {Object} varDef - Context variable definition
   * @param {Object} rootObject - Root object to extract from
   * @returns {*} Context variable value
   */
  processContextVariable(varDef, rootObject) {
    if (varDef.value !== undefined) {
      return varDef.value;
    }
    
    if (varDef.path) {
      return PathTraversal.traverse(rootObject, varDef.path);
    }
    
    throw new Error('Context variable definition must have path or value');
  }

  /**
   * Apply transformations to extracted data
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

    switch (transform) {
      case 'summary':
        return DataTransformations.summary(data, mergedOptions);
      case 'recent':
        return DataTransformations.recent(data, mergedOptions);
      case 'concatenate':
        return DataTransformations.concatenate(data, mergedOptions);
      case 'filter':
        return DataTransformations.filter(data, mergedOptions);
      case 'prioritize':
        return DataTransformations.prioritize(data, mergedOptions);
      case 'passthrough':
        return DataTransformations.passthrough(data);
      default:
        throw new Error(`Unknown transformation: ${transform}`);
    }
  }

  /**
   * Validate query specification
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
      PathTraversal.validatePath(binding.path);
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
   * Process aggregation definition
   * @private
   */
  _processAggregation(aggregateDef, rootObject) {
    if (!Array.isArray(aggregateDef)) {
      throw new Error('Aggregate must be an array');
    }

    const values = [];
    let totalWeight = 0;

    for (const item of aggregateDef) {
      const value = PathTraversal.traverse(rootObject, item.path);
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
}