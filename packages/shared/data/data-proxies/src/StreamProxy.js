/**
 * StreamProxy - Proxy wrapper for continuous query result streaming
 * 
 * Refactored to extend Handle from @legion/km-data-handle for universal base functionality.
 * Provides a convenient interface for working with query result streams:
 * - Continuous query result monitoring via subscriptions
 * - Fresh query results on each value() call
 * - Additional query execution with same context
 * - Integration with DataStore's reactive system
 */

import { Handle } from '@legion/handle';

export class StreamProxy extends Handle {
  constructor(dataSource, querySpec) {
    // Call Handle constructor (which validates dataSource)
    super(dataSource);
    
    // Validate query specification
    this._validateQuerySpec(querySpec);
    
    this.querySpec = querySpec;
    
    // Backward compatibility - expose store if dataSource has it
    if (dataSource.dataStore) {
      this.store = dataSource.dataStore;
    }
  }
  
  /**
   * Validate query specification
   * @param {Object} querySpec - Query specification to validate
   * @throws {Error} If query specification is invalid
   * @private
   */
  _validateQuerySpec(querySpec) {
    if (!querySpec) {
      throw new Error('Query specification is required');
    }
    
    if (typeof querySpec !== 'object') {
      throw new Error('Query specification must be an object');
    }
    
    // Validate query structure
    if (!querySpec.find || (Array.isArray(querySpec.find) && querySpec.find.length === 0)) {
      throw new Error('Query specification must have find clause');
    }
    
    if (!querySpec.where) {
      throw new Error('Query specification must have where clause');
    }
    
    if (!Array.isArray(querySpec.where)) {
      throw new Error('Where clause must be an array');
    }
  }
  
  /**
   * Validate callback function
   * @param {Function} callback - Callback function to validate
   * @throws {Error} If callback is invalid
   * @private
   */
  _validateCallback(callback) {
    if (!callback || typeof callback !== 'function') {
      throw new Error('Callback function is required');
    }
  }
  
  /**
   * Get current query results
   * @returns {Array} Current query results as array of tuples
   */
  value() {
    this._validateNotDestroyed();
    
    return this.dataSource.query(this.querySpec);
  }
  
  /**
   * Execute additional query with same context
   * @param {Object} querySpec - Query specification with find and where clauses
   * @returns {Array} Query results
   */
  query(querySpec) {
    this._validateNotDestroyed();
    
    // Validate query specification
    this._validateQuerySpec(querySpec);
    
    return this.dataSource.query(querySpec);
  }
  
  /**
   * Create filtered StreamProxy with predicate function
   * @param {Function} predicate - Filter predicate function
   * @returns {StreamProxy} New filtered StreamProxy instance
   */
  filter(predicate) {
    this._validateNotDestroyed();
    
    if (!predicate || typeof predicate !== 'function') {
      throw new Error('Filter predicate function is required');
    }
    
    // Create new StreamProxy that applies the filter
    const filteredProxy = new FilteredStreamProxy(this.dataSource, this.querySpec, predicate);
    return filteredProxy;
  }
  
  
  /**
   * Create subscription for continuous result streaming
   * @param {Object|Function} querySpecOrCallback - Query specification or callback (if monitoring current query)
   * @param {Function} [callback] - Callback function for updates (optional if first param is callback)
   * @returns {Object} Subscription object with unsubscribe method
   */
  subscribe(querySpecOrCallback, callback) {
    this._validateNotDestroyed();
    
    let querySpec;
    let callbackFn;
    
    // Handle overloaded parameters
    if (typeof querySpecOrCallback === 'function') {
      // First parameter is the callback - monitor current stream query
      callbackFn = querySpecOrCallback;
      querySpec = this.querySpec;
    } else if (callback === undefined) {
      // Single parameter that's not a function - invalid
      this._validateCallback(querySpecOrCallback);
    } else {
      // Traditional call with querySpec and callback
      querySpec = querySpecOrCallback;
      callbackFn = callback;
    }
    
    // Validate parameters
    this._validateQuerySpec(querySpec);
    this._validateCallback(callbackFn);
    
    // Create subscription through dataSource
    const resourceSubscription = this.dataSource.subscribe(querySpec, callbackFn);
    
    // Create wrapper subscription that integrates with Handle's subscription tracking
    const wrapperSubscription = {
      id: resourceSubscription.id,
      unsubscribe: () => {
        this._subscriptions.delete(wrapperSubscription);
        resourceSubscription.unsubscribe();
      }
    };
    
    // Track subscription for cleanup
    this._subscriptions.add(wrapperSubscription);
    
    return wrapperSubscription;
  }
}

/**
 * FilteredStreamProxy - StreamProxy that applies filtering to results
 * Extends StreamProxy to add filtering capability
 */
class FilteredStreamProxy extends StreamProxy {
  constructor(dataSource, querySpec, predicate) {
    super(dataSource, querySpec);
    this.predicate = predicate;
  }
  
  /**
   * Get current query results with filter applied
   * @returns {Array} Filtered query results
   */
  value() {
    this._validateNotDestroyed();
    
    const results = this.dataSource.query(this.querySpec);
    
    if (!Array.isArray(results)) {
      return results;
    }
    
    // Apply filter predicate
    return results.filter(item => {
      try {
        return this.predicate(item);
      } catch (error) {
        // If predicate throws, exclude the item
        return false;
      }
    });
  }
  
  /**
   * Create subscription with filtering applied to callback
   * @param {Object|Function} querySpecOrCallback - Query specification or callback
   * @param {Function} [callback] - Callback function for updates
   * @returns {Object} Subscription object with unsubscribe method
   */
  subscribe(querySpecOrCallback, callback) {
    this._validateNotDestroyed();
    
    let querySpec;
    let callbackFn;
    
    // Handle overloaded parameters
    if (typeof querySpecOrCallback === 'function') {
      // First parameter is the callback - monitor current stream query
      callbackFn = querySpecOrCallback;
      querySpec = this.querySpec;
    } else if (callback === undefined) {
      // Single parameter that's not a function - invalid
      this._validateCallback(querySpecOrCallback);
    } else {
      // Traditional call with querySpec and callback
      querySpec = querySpecOrCallback;
      callbackFn = callback;
    }
    
    // Validate parameters
    this._validateQuerySpec(querySpec);
    this._validateCallback(callbackFn);
    
    // Create wrapped callback that applies filtering
    const filteredCallback = (results) => {
      if (Array.isArray(results)) {
        const filteredResults = results.filter(item => {
          try {
            return this.predicate(item);
          } catch (error) {
            return false;
          }
        });
        callbackFn(filteredResults);
      } else {
        callbackFn(results);
      }
    };
    
    // Create subscription through dataSource with filtered callback
    const resourceSubscription = this.dataSource.subscribe(querySpec, filteredCallback);
    
    // Create wrapper subscription that integrates with Handle's subscription tracking
    const wrapperSubscription = {
      id: resourceSubscription.id,
      unsubscribe: () => {
        this._subscriptions.delete(wrapperSubscription);
        resourceSubscription.unsubscribe();
      }
    };
    
    // Track subscription for cleanup
    this._subscriptions.add(wrapperSubscription);
    
    return wrapperSubscription;
  }
}