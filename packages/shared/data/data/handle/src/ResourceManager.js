/**
 * ResourceManager - Abstract interface contract for all resource managers
 * 
 * This is NOT a class to inherit from, but an interface contract that all
 * ResourceManager implementations must fulfill. The Handle validates that
 * ResourceManagers implement the required methods.
 * 
 * CRITICAL: All ResourceManager operations must be synchronous - NO await, NO promises!
 * The synchronous dispatcher pattern eliminates race conditions in rapid subscribe/unsubscribe scenarios.
 * 
 * ResourceManagers represent the actual resource that Handle proxies. The Handle is a
 * placeholder that delegates all real work to the ResourceManager.
 */

/**
 * Abstract interface specification for ResourceManager implementations
 * 
 * This object defines the contract that all ResourceManager implementations must fulfill.
 * It serves as documentation and validation reference - implementations do not inherit from this.
 */
export const ResourceManagerInterface = {
  /**
   * Execute query against the resource - REQUIRED METHOD
   * CRITICAL: Must be synchronous - no await!
   * 
   * @param {Object} querySpec - Query specification with find/where clauses
   * @returns {Array} Query results - returned synchronously
   * @throws {Error} If query is invalid or execution fails
   */
  query: (querySpec) => {
    throw new Error('ResourceManager must implement query(querySpec) method');
  },
  
  /**
   * Set up subscription for change notifications - REQUIRED METHOD
   * CRITICAL: Must be synchronous - no await!
   * 
   * The subscription setup is synchronous, but callbacks are invoked when changes occur.
   * This appears asynchronous externally (through callbacks) but is synchronous internally.
   * 
   * @param {Object} querySpec - Query specification to monitor
   * @param {Function} callback - Function called when matching changes occur
   * @returns {Object} Subscription object with unsubscribe method - returned synchronously
   * @throws {Error} If querySpec or callback is invalid
   */
  subscribe: (querySpec, callback) => {
    throw new Error('ResourceManager must implement subscribe(querySpec, callback) method');
  },
  
  /**
   * Get resource schema for introspection - REQUIRED METHOD
   * CRITICAL: Must be synchronous - no await!
   * 
   * @returns {Object} Schema object describing the resource structure
   * @throws {Error} If schema is not available or cannot be generated
   */
  getSchema: () => {
    throw new Error('ResourceManager must implement getSchema() method');
  },
  
  /**
   * Update resource data - OPTIONAL METHOD
   * CRITICAL: Must be synchronous - no await!
   * 
   * @param {Object} updateSpec - Update specification with data to change
   * @returns {Object} Update result with success status and metadata
   * @throws {Error} If update fails or is not supported
   */
  update: (updateSpec) => {
    throw new Error('ResourceManager update() method not implemented');
  },
  
  /**
   * Validate data against resource schema - OPTIONAL METHOD
   * CRITICAL: Must be synchronous - no await!
   * 
   * @param {*} data - Data to validate
   * @returns {boolean} True if data is valid, false otherwise
   * @throws {Error} If validation fails due to system error
   */
  validate: (data) => {
    throw new Error('ResourceManager validate() method not implemented');
  },
  
  /**
   * Get resource metadata and capabilities - OPTIONAL METHOD
   * CRITICAL: Must be synchronous - no await!
   * 
   * @returns {Object} Metadata object with resource information
   */
  getMetadata: () => {
    throw new Error('ResourceManager getMetadata() method not implemented');
  }
};

/**
 * Validate that an object implements the ResourceManager interface
 * Used by Handle constructor to ensure ResourceManager contract compliance
 * 
 * @param {Object} resourceManager - Object to validate
 * @param {string} context - Context for error messages (optional)
 * @throws {Error} If resourceManager doesn't implement required methods
 */
export function validateResourceManagerInterface(resourceManager, context = 'ResourceManager') {
  if (!resourceManager || typeof resourceManager !== 'object') {
    throw new Error(`${context} must be a non-null object`);
  }
  
  // Check required methods
  const requiredMethods = ['query', 'subscribe', 'getSchema'];
  
  for (const method of requiredMethods) {
    if (typeof resourceManager[method] !== 'function') {
      throw new Error(`${context} must implement ${method}() method`);
    }
  }
  
  // Note: We don't test method signatures by calling them
  // as that could have side effects or fail for valid implementations
  // that throw errors in certain conditions (e.g., getSchema() might throw if schema is not available)
}

/**
 * Base ResourceManager implementation template
 * 
 * This is a template/example showing the structure of a ResourceManager implementation.
 * Real implementations should follow this pattern but adapt to their specific data sources.
 * 
 * NOTE: This is NOT meant to be inherited from - copy and adapt the pattern.
 */
export class ResourceManagerTemplate {
  constructor(dataSource, options = {}) {
    this.dataSource = dataSource;
    this.options = options;
    this._subscriptions = new Map(); // Track subscriptions for cleanup
    this._schema = options.schema || this._generateSchema();
  }
  
  /**
   * REQUIRED: Implement query execution
   * CRITICAL: Must be synchronous - no await!
   */
  query(querySpec) {
    // Validate input
    if (!querySpec || typeof querySpec !== 'object') {
      throw new Error('Query specification must be an object');
    }
    
    if (!querySpec.find && !querySpec.where) {
      throw new Error('Query specification must have find or where clause');
    }
    
    // Execute query synchronously against data source
    return this._executeQuery(querySpec);
  }
  
  /**
   * REQUIRED: Implement subscription setup
   * CRITICAL: Must be synchronous - no await!
   */
  subscribe(querySpec, callback) {
    // Validate input
    if (!querySpec || typeof querySpec !== 'object') {
      throw new Error('Query specification must be an object');
    }
    
    if (!callback || typeof callback !== 'function') {
      throw new Error('Callback function is required');
    }
    
    // Create subscription synchronously
    const subscriptionId = Date.now() + Math.random();
    const subscription = {
      id: subscriptionId,
      querySpec,
      callback,
      unsubscribe: () => {
        // Synchronous cleanup
        this._subscriptions.delete(subscriptionId);
        this._unregisterSubscription(subscriptionId);
      }
    };
    
    // Register subscription synchronously
    this._subscriptions.set(subscriptionId, subscription);
    this._registerSubscription(subscription);
    
    return subscription;
  }
  
  /**
   * REQUIRED: Implement schema retrieval
   * CRITICAL: Must be synchronous - no await!
   */
  getSchema() {
    return this._schema;
  }
  
  /**
   * OPTIONAL: Implement data updates
   * CRITICAL: Must be synchronous - no await!
   */
  update(updateSpec) {
    if (!updateSpec || typeof updateSpec !== 'object') {
      throw new Error('Update specification must be an object');
    }
    
    // Execute update synchronously
    const result = this._executeUpdate(updateSpec);
    
    // Notify subscribers synchronously
    this._notifySubscribers(result.changes);
    
    return result;
  }
  
  /**
   * OPTIONAL: Implement data validation
   * CRITICAL: Must be synchronous - no await!
   */
  validate(data) {
    if (data === null || data === undefined) {
      return false;
    }
    
    // Validate against schema synchronously
    return this._validateAgainstSchema(data);
  }
  
  /**
   * OPTIONAL: Implement metadata retrieval
   * CRITICAL: Must be synchronous - no await!
   */
  getMetadata() {
    return {
      dataSourceType: this.dataSource?.constructor?.name || 'Unknown',
      subscriptionCount: this._subscriptions.size,
      schemaVersion: this._schema?.version || '1.0.0',
      capabilities: {
        query: true,
        subscribe: true,
        update: typeof this.update === 'function',
        validate: typeof this.validate === 'function'
      }
    };
  }
  
  // Implementation-specific methods (adapt to your data source)
  
  _executeQuery(querySpec) {
    // Implement based on your data source
    // Examples: DataScript query, SQL query, API call, etc.
    throw new Error('_executeQuery must be implemented by ResourceManager');
  }
  
  _registerSubscription(subscription) {
    // Register with data source for change notifications
    // Implementation depends on your data source
    throw new Error('_registerSubscription must be implemented by ResourceManager');
  }
  
  _unregisterSubscription(subscriptionId) {
    // Clean up subscription registration
    // Implementation depends on your data source
    throw new Error('_unregisterSubscription must be implemented by ResourceManager');
  }
  
  _executeUpdate(updateSpec) {
    // Execute update against data source
    // Return { success: boolean, changes: Array, metadata: Object }
    throw new Error('_executeUpdate must be implemented by ResourceManager');
  }
  
  _notifySubscribers(changes) {
    // Notify all relevant subscriptions of changes
    for (const subscription of this._subscriptions.values()) {
      if (this._matchesQuery(changes, subscription.querySpec)) {
        // Invoke callback synchronously
        subscription.callback(changes);
      }
    }
  }
  
  _matchesQuery(changes, querySpec) {
    // Determine if changes match subscription query
    // Implementation depends on your query format
    return true; // Simplified - implement based on your needs
  }
  
  _generateSchema() {
    // Generate schema from data source if not provided
    // Return schema object describing data structure
    return {
      version: '1.0.0',
      attributes: {},
      relationships: {},
      constraints: {}
    };
  }
  
  _validateAgainstSchema(data) {
    // Validate data against schema
    // Return true if valid, false otherwise
    return true; // Simplified - implement based on your schema
  }
}

/**
 * Utility functions for ResourceManager implementations
 */
export const ResourceManagerUtils = {
  /**
   * Create a standardized subscription object
   */
  createSubscription(id, querySpec, callback, unsubscribeHandler) {
    return {
      id: id || Date.now() + Math.random(),
      querySpec,
      callback,
      unsubscribe: unsubscribeHandler
    };
  },
  
  /**
   * Validate query specification format
   */
  validateQuerySpec(querySpec, context = 'Query specification') {
    if (!querySpec || typeof querySpec !== 'object') {
      throw new Error(`${context} must be an object`);
    }
    
    if (!querySpec.find && !querySpec.where) {
      throw new Error(`${context} must have find or where clause`);
    }
  },
  
  /**
   * Validate callback function
   */
  validateCallback(callback, context = 'Callback') {
    if (!callback || typeof callback !== 'function') {
      throw new Error(`${context} must be a function`);
    }
  }
};