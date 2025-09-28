/**
 * Handle - Universal abstract base class for all proxy types
 * 
 * Inherits from Actor to provide remote capability for frontend/backend sharing.
 * Implements the synchronous dispatcher pattern for all proxy operations.
 * 
 * Provides common functionality for all resource proxy objects including:
 * - Resource manager reference management
 * - Synchronous subscription tracking and cleanup
 * - Destruction lifecycle management
 * - Actor system integration for remote capability
 * - Universal introspection via prototype manufacturing
 * 
 * Subclasses must implement:
 * - value() - Get the current value/data
 * - query(querySpec) - Execute queries with this handle as context
 * 
 * CRITICAL: All operations are synchronous - NO await, NO promises in Handle infrastructure!
 */

import { Actor } from '@legion/actors';
import { validateDataSourceInterface } from './DataSource.js';

export class Handle extends Actor {
  constructor(dataSource) {
    super();
    
    // Validate data source using standard validation function
    validateDataSourceInterface(dataSource, 'DataSource');
    
    // Store reference to data source (conceptual placeholder delegates to this)
    this.dataSource = dataSource;
    
    // Track subscriptions for cleanup (synchronous tracking)
    this._subscriptions = new Set();
    
    // Track destruction state
    this._destroyed = false;
    
    // Initialize prototype factory for introspection if schema available
    this._prototypeFactory = null;
    try {
      const schema = this.dataSource.getSchema();
      if (schema) {
        // Will be set by subclasses that need prototype manufacturing
        this._enablePrototypeFactory(schema);
      }
    } catch (error) {
      // Schema not available or data source doesn't support it - continue without prototypes
    }
  }
  
  /**
   * Convenience property to get the handle type name
   * Returns the constructor name for easy identification
   */
  get handleType() {
    return this.constructor.name;
  }
  
  /**
   * Get current value - must be implemented by subclasses
   * CRITICAL: Must be synchronous - no await!
   */
  value() {
    throw new Error('value() must be implemented by subclass');
  }
  
  /**
   * Execute query with this handle as context - must be implemented by subclasses  
   * CRITICAL: Must be synchronous - no await!
   */
  query(querySpec) {
    throw new Error('query() must be implemented by subclass');
  }
  
  /**
   * Actor system message handling
   * Routes Actor messages to appropriate handle methods
   */
  receive(message) {
    this._validateNotDestroyed();
    
    if (typeof message === 'object' && message.type) {
      switch (message.type) {
        case 'query':
          return this.query(message.querySpec);
        case 'value':
          return this.value();
        case 'subscribe':
          return this.subscribe(message.querySpec, message.callback);
        case 'destroy':
          return this.destroy();
        case 'introspect':
          return this.getIntrospectionInfo();
        default:
          return super.receive(message);
      }
    }
    
    return super.receive(message);
  }
  
  /**
   * Subscribe to changes with automatic subscription tracking
   * CRITICAL: Synchronous subscription setup - callback notifications appear async externally
   */
  subscribe(querySpec, callback) {
    this._validateNotDestroyed();
    
    if (!querySpec) {
      throw new Error('Query specification is required');
    }
    
    if (!callback || typeof callback !== 'function') {
      throw new Error('Callback function is required');
    }
    
    // Create subscription through data source (synchronous dispatch)
    const resourceSubscription = this.dataSource.subscribe(querySpec, callback);
    
    // Create tracking wrapper for cleanup (synchronous wrapper creation)
    const trackingWrapper = {
      id: resourceSubscription.id || Date.now() + Math.random(),
      unsubscribe: () => {
        // Synchronous cleanup - no timing issues possible
        this._subscriptions.delete(trackingWrapper);
        resourceSubscription.unsubscribe();
      }
    };
    
    // Track subscription for cleanup (synchronous tracking)
    this._subscriptions.add(trackingWrapper);
    
    return trackingWrapper;
  }
  
  /**
   * Serialize handle for remote transmission
   * Returns a simple object that can be sent over the wire
   */
  serialize() {
    this._validateNotDestroyed();
    
    return {
      __type: 'RemoteHandle',
      handleType: this.handleType,
      handleId: this.id || `handle-${Date.now()}`,
      isDestroyed: this._destroyed
    };
  }
  
  /**
   * Get introspection information about this handle
   * Uses prototype factory if available for universal knowledge layer
   */
  getIntrospectionInfo() {
    this._validateNotDestroyed();
    
    const info = {
      handleType: this.constructor.name,
      isDestroyed: this._destroyed,
      subscriptionCount: this._subscriptions.size,
      hasPrototypeFactory: !!this._prototypeFactory
    };
    
    // Add prototype-based introspection if available
    if (this._prototypeFactory && this.entityId !== undefined) {
      try {
        // Try to get entity type and introspection info
        const entityData = this.dataSource.query({
          find: ['?attr', '?value'],
          where: [[this.entityId, '?attr', '?value']]
        });
        
        if (entityData.length > 0) {
          const entity = {};
          entityData.forEach(([attr, value]) => {
            entity[attr] = value;
          });
          
          const detectedType = this._prototypeFactory.detectEntityType(entity);
          if (detectedType) {
            const prototype = this._prototypeFactory.getEntityPrototype(detectedType);
            const instance = new prototype(this.dataSource, this.entityId);
            
            info.entityType = detectedType;
            info.availableAttributes = instance.getAvailableAttributes ? instance.getAvailableAttributes() : [];
            info.relationships = instance.getRelationships ? instance.getRelationships() : [];
            info.capabilities = instance.getCapabilities ? instance.getCapabilities() : [];
          }
        }
      } catch (error) {
        // Introspection failed - continue without it
        info.introspectionError = error.message;
      }
    }
    
    return info;
  }
  
  /**
   * Get a MetaHandle wrapping this Handle's prototype
   * Enables introspection of the Handle's class structure
   * 
   * NOTE: This method is SYNCHRONOUS but uses dynamic imports.
   * The imports are cached after first call, so subsequent calls are instant.
   * 
   * @returns {MetaHandle} MetaHandle wrapping this Handle's prototype
   */
  getPrototype() {
    this._validateNotDestroyed();
    
    // Cache the imported classes to make this effectively synchronous after first call
    if (!Handle._metaHandleClass) {
      // First call - need to load classes
      // This is technically async, but we handle it synchronously for the Handle pattern
      throw new Error('MetaHandle classes not loaded. Call Handle.initializeIntrospection() first.');
    }
    
    // Create MetaHandle for this Handle's constructor (synchronous after initialization)
    const metaDataSource = new Handle._metaDataSourceClass(this.constructor);
    const metaHandle = new Handle._metaHandleClass(metaDataSource, this.constructor);
    
    return metaHandle;
  }
  
  /**
   * Initialize introspection classes (call once at application startup)
   * This loads MetaHandle and MetaDataSource classes to enable getPrototype()
   * 
   * @returns {Promise<void>}
   */
  static async initializeIntrospection() {
    if (!Handle._metaHandleClass) {
      const { MetaHandle } = await import('./introspection/MetaHandle.js');
      const { MetaDataSource } = await import('./introspection/MetaDataSource.js');
      
      Handle._metaHandleClass = MetaHandle;
      Handle._metaDataSourceClass = MetaDataSource;
    }
  }
  
  /**
   * Clean up all resources and subscriptions
   * CRITICAL: Synchronous cleanup - no race conditions
   */
  destroy() {
    if (this._destroyed) {
      return; // Safe to call multiple times
    }
    
    // Unsubscribe all subscriptions (synchronous cleanup)
    for (const subscription of this._subscriptions) {
      try {
        subscription.unsubscribe();
      } catch (error) {
        // Continue cleanup even if individual unsubscribe fails
        console.warn('Failed to unsubscribe during Handle cleanup:', error);
      }
    }
    
    // Clear subscription tracking (synchronous)
    this._subscriptions.clear();
    
    // Clean up prototype factory
    if (this._prototypeFactory && typeof this._prototypeFactory.clearCache === 'function') {
      this._prototypeFactory.clearCache();
    }
    
    // Mark as destroyed
    this._destroyed = true;
  }
  
  /**
   * Check if handle has been destroyed
   */
  isDestroyed() {
    return this._destroyed;
  }
  
  /**
   * Enable prototype factory for introspection
   * Called by subclasses that need prototype manufacturing capabilities
   * @protected
   */
  _enablePrototypeFactory(schema, schemaFormat = 'auto') {
    if (!this._prototypeFactory) {
      // Import PrototypeFactory dynamically to avoid circular dependencies
      import('./PrototypeFactory.js').then(({ PrototypeFactory }) => {
        this._prototypeFactory = new PrototypeFactory(this.constructor);
        this._prototypeFactory.analyzeSchema(schema, schemaFormat);
      }).catch(error => {
        console.warn('Failed to load PrototypeFactory:', error);
      });
    }
  }
  
  /**
   * Internal validation helper
   * @protected
   */
  _validateNotDestroyed() {
    if (this._destroyed) {
      throw new Error('Handle has been destroyed');
    }
  }
  
  /**
   * Validate query specification
   * Basic validation - subclasses can extend for resource-specific validation
   * @protected
   */
  _validateQuerySpec(querySpec, context = 'Query specification') {
    if (!querySpec || typeof querySpec !== 'object') {
      throw new Error(`${context} must be an object`);
    }
    
    // Basic structure validation - resource-specific validation in subclasses
    if (!querySpec.find && !querySpec.where) {
      throw new Error(`${context} must have find or where clause`);
    }
  }
  
  /**
   * Validate callback function
   * @protected
   */
  _validateCallback(callback, context = 'Callback') {
    if (!callback || typeof callback !== 'function') {
      throw new Error(`${context} function is required`);
    }
  }
  
  // Query Combinator Methods - Universal projection pattern
  
  /**
   * Filter entities using a predicate function
   * Creates new proxy through projection with filter applied
   * @param {Function} predicate - Filter predicate function
   * @returns {Handle} New Handle proxy with filter applied
   */
  where(predicate) {
    this._validateNotDestroyed();
    
    if (!predicate || typeof predicate !== 'function') {
      throw new Error('Where predicate function is required');
    }
    
    // Delegate to DataSource's query builder for universal handling
    return this.dataSource.queryBuilder(this).where(predicate);
  }
  
  /**
   * Transform entities using a mapper function
   * Creates new proxy through projection with transformation applied
   * @param {Function} mapper - Transformation function
   * @returns {Handle} New Handle proxy with transformation applied
   */
  select(mapper) {
    this._validateNotDestroyed();
    
    if (!mapper || typeof mapper !== 'function') {
      throw new Error('Select mapper function is required');
    }
    
    // Delegate to DataSource's query builder for universal handling
    return this.dataSource.queryBuilder(this).select(mapper);
  }
  
  /**
   * Join with another Handle using a join condition
   * Creates new proxy through projection with join applied
   * @param {Handle} otherHandle - Handle to join with
   * @param {Function|string} joinCondition - Join condition function or attribute name
   * @returns {Handle} New Handle proxy with join applied
   */
  join(otherHandle, joinCondition) {
    this._validateNotDestroyed();
    
    if (!otherHandle || !(otherHandle instanceof Handle)) {
      throw new Error('Join requires another Handle instance');
    }
    
    if (!joinCondition) {
      throw new Error('Join condition is required');
    }
    
    // Delegate to DataSource's query builder for universal handling
    return this.dataSource.queryBuilder(this).join(otherHandle, joinCondition);
  }
  
  /**
   * Order entities by a key or function
   * Creates new proxy through projection with ordering applied
   * @param {Function|string} orderBy - Order function or attribute name
   * @param {string} direction - 'asc' or 'desc' (default: 'asc')
   * @returns {Handle} New Handle proxy with ordering applied
   */
  orderBy(orderBy, direction = 'asc') {
    this._validateNotDestroyed();
    
    if (!orderBy) {
      throw new Error('OrderBy field or function is required');
    }
    
    if (direction !== 'asc' && direction !== 'desc') {
      throw new Error('OrderBy direction must be "asc" or "desc"');
    }
    
    // Delegate to DataSource's query builder for universal handling
    return this.dataSource.queryBuilder(this).orderBy(orderBy, direction);
  }
  
  /**
   * Limit the number of results
   * Creates new proxy through projection with limit applied
   * @param {number} count - Maximum number of results
   * @returns {Handle} New Handle proxy with limit applied
   */
  limit(count) {
    this._validateNotDestroyed();
    
    if (typeof count !== 'number' || count <= 0) {
      throw new Error('Limit count must be a positive number');
    }
    
    // Delegate to DataSource's query builder for universal handling
    return this.dataSource.queryBuilder(this).limit(count);
  }
  
  /**
   * Skip a number of results
   * Creates new proxy through projection with offset applied
   * @param {number} count - Number of results to skip
   * @returns {Handle} New Handle proxy with offset applied
   */
  skip(count) {
    this._validateNotDestroyed();
    
    if (typeof count !== 'number' || count < 0) {
      throw new Error('Skip count must be a non-negative number');
    }
    
    // Delegate to DataSource's query builder for universal handling
    return this.dataSource.queryBuilder(this).skip(count);
  }
  
  /**
   * Group entities by a key or function
   * Creates new proxy through projection with grouping applied
   * @param {Function|string} groupBy - Group function or attribute name
   * @returns {Handle} New Handle proxy with grouping applied
   */
  groupBy(groupBy) {
    this._validateNotDestroyed();
    
    if (!groupBy) {
      throw new Error('GroupBy field or function is required');
    }
    
    // Delegate to DataSource's query builder for universal handling
    return this.dataSource.queryBuilder(this).groupBy(groupBy);
  }
  
  /**
   * Aggregate entities using an aggregation function
   * Creates new proxy through projection with aggregation applied
   * @param {Function|string} aggregateFunction - Aggregation function ('count', 'sum', 'avg', etc.) or custom function
   * @param {string} [field] - Field to aggregate (for built-in functions)
   * @returns {Handle} New Handle proxy with aggregation applied
   */
  aggregate(aggregateFunction, field) {
    this._validateNotDestroyed();
    
    if (!aggregateFunction) {
      throw new Error('Aggregate function is required');
    }
    
    // Delegate to DataSource's query builder for universal handling
    return this.dataSource.queryBuilder(this).aggregate(aggregateFunction, field);
  }
  
  /**
   * Take first N results (alias for limit with semantic meaning)
   * Creates new proxy through projection with take applied
   * @param {number} count - Number of results to take
   * @returns {Handle} New Handle proxy with take applied
   */
  take(count) {
    return this.limit(count);
  }
  
  /**
   * Get first result as entity proxy
   * Terminal method that returns an EntityProxy or scalar value
   * @returns {Handle} EntityProxy for first result or null if empty
   */
  first() {
    this._validateNotDestroyed();
    
    // Delegate to DataSource's query builder for terminal operation
    return this.dataSource.queryBuilder(this).first();
  }
  
  /**
   * Get last result as entity proxy
   * Terminal method that returns an EntityProxy or scalar value
   * @returns {Handle} EntityProxy for last result or null if empty
   */
  last() {
    this._validateNotDestroyed();
    
    // Delegate to DataSource's query builder for terminal operation
    return this.dataSource.queryBuilder(this).last();
  }
  
  /**
   * Count the number of results
   * Terminal method that returns a scalar value
   * @returns {number} Count of results
   */
  count() {
    this._validateNotDestroyed();
    
    // Delegate to DataSource's query builder for terminal operation
    return this.dataSource.queryBuilder(this).count();
  }
  
  /**
   * Execute query and return results as array
   * Terminal method that materializes the query
   * @returns {Array} Array of results
   */
  toArray() {
    this._validateNotDestroyed();
    
    // Delegate to DataSource's query builder for terminal operation
    return this.dataSource.queryBuilder(this).toArray();
  }
}