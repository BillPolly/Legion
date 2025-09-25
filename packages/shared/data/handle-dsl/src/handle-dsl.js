/**
 * Handle DSL - Universal template literal DSL for any Handle type
 * 
 * Provides a natural language syntax for Handle operations that works
 * with ANY resource type - not tied to DataStore or any specific implementation.
 */

import { HandleDSLEngine } from './engine.js';

/**
 * Main handle DSL tagged template literal
 * Works with any Handle instance to provide natural query/update syntax
 * 
 * Examples:
 *   handle`users where age > ${18}` 
 *   handle`config.database.host`
 *   handle`orders[${orderId}].items`
 *   handle`tasks | filter status = "pending" | sort priority`
 * 
 * @param {TemplateStringsArray} strings - Template strings
 * @param {...any} values - Interpolated values
 * @returns {HandleDSLProxy} Proxy that translates operations to Handle calls
 */
export function handle(strings, ...values) {
  const engine = new HandleDSLEngine();
  const query = engine.parseTemplate(strings, values);
  
  // Return a proxy that intercepts operations and translates to Handle API
  return new HandleDSLProxy(query);
}

// Shorthand alias
export const h = handle;

/**
 * DSL Proxy that translates natural syntax to Handle operations
 */
class HandleDSLProxy {
  constructor(query) {
    this.query = query;
    this._handle = null;
    
    // Return a Proxy to intercept all operations
    return new Proxy(this, {
      get: this._handleGet.bind(this),
      set: this._handleSet.bind(this),
      has: this._handleHas.bind(this),
      deleteProperty: this._handleDelete.bind(this),
      apply: this._handleApply.bind(this)
    });
  }
  
  /**
   * Bind this DSL to an actual Handle instance
   */
  on(handle) {
    this._handle = handle;
    return this;
  }
  
  /**
   * Execute the query against the bound handle
   */
  async execute() {
    if (!this._handle) {
      throw new Error('No handle bound. Use .on(handle) first.');
    }
    
    // Translate DSL query to Handle query spec
    const querySpec = this._translateToQuerySpec();
    return await this._handle.query(querySpec);
  }
  
  /**
   * Subscribe to changes matching the query
   */
  subscribe(callback) {
    if (!this._handle) {
      throw new Error('No handle bound. Use .on(handle) first.');
    }
    
    const querySpec = this._translateToQuerySpec();
    return this._handle.subscribe(querySpec, callback);
  }
  
  /**
   * Update resources matching the query
   */
  async update(updateSpec) {
    if (!this._handle) {
      throw new Error('No handle bound. Use .on(handle) first.');
    }
    
    const querySpec = this._translateToQuerySpec();
    
    // First query to get matching resources
    const matches = await this._handle.query(querySpec);
    
    // Update each match
    const results = [];
    for (const match of matches) {
      const result = await match.update(updateSpec);
      results.push(result);
    }
    
    return results;
  }
  
  /**
   * Create a child handle with this query as context
   */
  project() {
    if (!this._handle) {
      throw new Error('No handle bound. Use .on(handle) first.');
    }
    
    const querySpec = this._translateToQuerySpec();
    return this._handle.project(querySpec);
  }
  
  // Private methods for proxy operations
  
  _handleGet(target, prop) {
    // Built-in methods
    if (prop in target) {
      return target[prop];
    }
    
    // Chain additional query operations
    if (typeof prop === 'string') {
      // Add property access to query
      this.query.path.push(prop);
      return this;
    }
    
    return undefined;
  }
  
  _handleSet(target, prop, value) {
    if (!this._handle) {
      throw new Error('No handle bound. Use .on(handle) first.');
    }
    
    // Translate property set to update operation
    const updateSpec = {
      [prop]: value
    };
    
    this.update(updateSpec);
    return true;
  }
  
  _handleHas(target, prop) {
    // Check if property exists in query result
    return this.query.path.includes(prop);
  }
  
  _handleDelete(target, prop) {
    if (!this._handle) {
      throw new Error('No handle bound. Use .on(handle) first.');
    }
    
    // Translate delete to update with undefined
    const updateSpec = {
      [prop]: undefined
    };
    
    this.update(updateSpec);
    return true;
  }
  
  _handleApply(target, thisArg, args) {
    // Allow calling as function for execution
    return this.execute(...args);
  }
  
  /**
   * Translate DSL query to Handle query spec
   */
  _translateToQuerySpec() {
    const spec = {
      type: this.query.type,
      path: this.query.path,
      filters: this.query.filters,
      operations: this.query.operations
    };
    
    // Handle different query types
    switch (this.query.type) {
      case 'path':
        // Simple path access: "users.123.name"
        spec.select = this.query.path;
        break;
        
      case 'filter':
        // Filter query: "users where age > 18"
        spec.where = this.query.filters;
        break;
        
      case 'pipeline':
        // Pipeline operations: "users | filter | sort | limit"
        spec.pipeline = this.query.operations;
        break;
        
      case 'pattern':
        // Pattern matching: "orders[*].items[status='pending']"
        spec.pattern = this.query.pattern;
        break;
    }
    
    return spec;
  }
}

/**
 * Helper function to create bound DSL queries
 * 
 * @param {Handle} handle - Handle to bind to
 * @returns {Function} Bound DSL function
 */
export function createBoundDSL(handle) {
  return (strings, ...values) => {
    return h(strings, ...values).on(handle);
  };
}