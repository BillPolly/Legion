/**
 * StreamProxy Class
 * Represents computed/aggregate values that change over time
 * Part of the unified proxy architecture where all queries return proxy objects
 */

import { q } from '../../datascript/index.js';

export class StreamProxy {
  constructor(store, currentValue, querySpec, dataStoreProxy = null) {
    // Validate required parameters
    if (!store) {
      throw new Error('StreamProxy requires store parameter');
    }
    
    if (currentValue === undefined && arguments.length < 2) {
      throw new Error('StreamProxy requires currentValue parameter');
    }
    
    if (!querySpec) {
      throw new Error('StreamProxy requires querySpec parameter');
    }
    
    // Validate store is a proper DataStore instance
    if (!store.db || typeof store.db !== 'function') {
      throw new Error('StreamProxy requires valid DataStore instance');
    }
    
    this.store = store;
    this._currentValue = currentValue;
    this._querySpec = querySpec;
    this._dataStoreProxy = dataStoreProxy;
    this._subscribers = new Set();
    this._subscriptionCleanup = null;
    
    // Set up reactive subscription to underlying data changes
    this._setupReactiveSubscription();
  }

  /**
   * Get the query specification this proxy is bound to
   * @returns {Object} Query specification object
   */
  get querySpec() {
    return this._querySpec;
  }

  /**
   * Get current scalar value (number, string, boolean, etc.)
   * Returns immutable copy for complex values
   * For entity IDs, returns EntityProxy objects
   */
  value() {
    if (this._currentValue === null || this._currentValue === undefined) {
      return this._currentValue;
    }
    
    // Check if this is an entity ID by examining the query and value
    if (typeof this._currentValue === 'number' && this._isEntityQuery()) {
      // Use DataStoreProxy to create EntityProxy, if available
      if (this._dataStoreProxy && this._dataStoreProxy.getProxy) {
        return this._dataStoreProxy.getProxy(this._currentValue);
      }
      // Fallback: return the entity ID as-is 
      return this._currentValue;
    }
    
    // For primitive types, return as-is
    if (typeof this._currentValue !== 'object') {
      return this._currentValue;
    }
    
    // For complex objects, return deep copy to maintain immutability
    return this._deepCopy(this._currentValue);
  }

  /**
   * Transform/filter the stream through additional querying
   * Returns appropriate proxy type based on query result
   */
  query(querySpec) {
    this._validateQuerySpec(querySpec);
    this._checkStoreAvailability();
    
    // Bind current value to query context if needed
    const boundQuery = this._bindContextVariables(querySpec);
    
    // Execute query
    const results = q(boundQuery, this.store.db());
    
    // Determine appropriate proxy type for results
    const proxyType = this._determineProxyType(querySpec, results);
    return this._createProxy(proxyType, boundQuery, results);
  }

  /**
   * Subscribe to reactive updates of the value
   * Returns unsubscribe function
   */
  subscribe(callback) {
    this._checkStoreAvailability();
    
    if (!callback) {
      throw new Error('Callback function is required');
    }
    
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }
    
    this._subscribers.add(callback);
    
    // Return unsubscribe function
    return () => {
      this._subscribers.delete(callback);
    };
  }

  /**
   * Set up reactive subscription to underlying data changes
   * @private
   */
  _setupReactiveSubscription() {
    if (!this.store.subscribe) {
      return; // Store doesn't support subscriptions
    }
    
    // Subscribe to changes that might affect our query
    this._subscriptionCleanup = this.store.subscribe(this._querySpec, (newResults) => {
      // Extract new value from results
      const newValue = this._extractValueFromResults(newResults);
      
      // Only update if value actually changed
      if (this._hasValueChanged(this._currentValue, newValue)) {
        this._currentValue = newValue;
        this._notifySubscribers(newValue);
      }
    });
  }

  /**
   * Validate query specification
   * @private
   */
  _validateQuerySpec(querySpec) {
    if (!querySpec) {
      throw new Error('Query spec is required');
    }
    
    if (!querySpec.find) {
      throw new Error('Query spec must have find clause');
    }
    
    if (!Array.isArray(querySpec.find) || querySpec.find.length === 0) {
      throw new Error('Query spec find clause cannot be empty');
    }
    
    if (!querySpec.where) {
      throw new Error('Query spec must have where clause');
    }
  }

  /**
   * Check if store is available for operations
   * @private
   */
  _checkStoreAvailability() {
    if (!this.store || !this.store.db) {
      throw new Error('DataStore is not available');
    }
    
    try {
      this.store.db();
    } catch (error) {
      throw new Error('Cannot subscribe: DataStore is not available');
    }
  }

  /**
   * Bind context variables in query spec
   * @private
   */
  _bindContextVariables(querySpec) {
    // Deep copy to avoid modifying original
    const boundQuery = JSON.parse(JSON.stringify(querySpec));
    
    // Replace ?current-value with actual current value
    this._replaceVariableInQuery(boundQuery, '?current-value', this._currentValue);
    
    return boundQuery;
  }

  /**
   * Replace variable occurrences in query structure
   * @private
   */
  _replaceVariableInQuery(obj, variable, value) {
    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        if (obj[i] === variable) {
          obj[i] = value;
        } else if (typeof obj[i] === 'object') {
          this._replaceVariableInQuery(obj[i], variable, value);
        }
      }
    } else if (typeof obj === 'object' && obj !== null) {
      for (const key in obj) {
        if (obj[key] === variable) {
          obj[key] = value;
        } else if (typeof obj[key] === 'object') {
          this._replaceVariableInQuery(obj[key], variable, value);
        }
      }
    }
  }

  /**
   * Determine appropriate proxy type for query results
   * @private
   */
  _determineProxyType(querySpec, results) {
    const findClause = querySpec.find;
    
    // Single aggregate function → StreamProxy
    if (findClause.length === 1 && Array.isArray(findClause[0])) {
      return 'StreamProxy';
    }
    
    // Single variable → Check if entity ID or value
    if (findClause.length === 1) {
      // For now, assume single values are streams
      // This will be refined in later phases with proper entity detection
      return 'StreamProxy';
    }
    
    // Multiple variables → CollectionProxy (will be implemented in Step 1.2)
    return 'CollectionProxy';
  }

  /**
   * Create appropriate proxy type
   * @private
   */
  _createProxy(proxyType, querySpec, results) {
    const value = this._extractValueFromResults(results);
    
    if (proxyType === 'StreamProxy') {
      return new StreamProxy(this.store, value, querySpec);
    }
    
    // For now, return StreamProxy for all types until CollectionProxy is implemented
    return new StreamProxy(this.store, value, querySpec);
  }

  /**
   * Extract value from DataScript query results
   * @private
   */
  _extractValueFromResults(results) {
    if (!results || results.length === 0) {
      return null;
    }
    
    // Single result with single value
    if (results.length === 1 && results[0].length === 1) {
      return results[0][0];
    }
    
    // Multiple results or multiple values - return first value for now
    // This will be refined in later phases
    return results[0] ? results[0][0] : null;
  }

  /**
   * Check if value has actually changed
   * @private
   */
  _hasValueChanged(oldValue, newValue) {
    // Handle null/undefined cases
    if (oldValue === null && newValue === null) return false;
    if (oldValue === undefined && newValue === undefined) return false;
    if (oldValue === null || newValue === null) return true;
    if (oldValue === undefined || newValue === undefined) return true;
    
    // For primitive types
    if (typeof oldValue !== 'object' && typeof newValue !== 'object') {
      return oldValue !== newValue;
    }
    
    // For complex types, use JSON comparison (simple but sufficient for MVP)
    return JSON.stringify(oldValue) !== JSON.stringify(newValue);
  }

  /**
   * Notify all subscribers of value change
   * @private
   */
  _notifySubscribers(newValue) {
    this._subscribers.forEach(callback => {
      try {
        callback(newValue);
      } catch (error) {
        console.error('StreamProxy subscriber callback error:', error);
      }
    });
  }

  /**
   * Check if this StreamProxy represents the result of an entity query
   * @private
   */
  _isEntityQuery() {
    if (!this._querySpec || !this._querySpec.find || !this._querySpec.where) {
      return false;
    }
    
    const findClause = this._querySpec.find;
    const whereClause = this._querySpec.where;
    
    // Must have exactly one find variable
    if (!Array.isArray(findClause) || findClause.length !== 1) {
      return false;
    }
    
    const findVar = findClause[0];
    
    // Must be a variable (not aggregate expression)
    if (typeof findVar !== 'string' || !findVar.startsWith('?')) {
      return false;
    }
    
    // Check if the variable appears as an entity (first position) in where clauses
    // OR if it appears as a value in reference attribute clauses
    for (const clause of whereClause) {
      if (Array.isArray(clause) && clause.length === 3) {
        const [entity, attribute, value] = clause;
        
        // Variable appears as entity (first position)
        if (entity === findVar) {
          return true;
        }
        
        // Variable appears as value in reference attribute
        if (value === findVar) {
          // Check if attribute is a reference type in the schema
          if (this.store && this.store.schema && attribute) {
            const schemaInfo = this.store.schema[attribute];
            if (schemaInfo && schemaInfo.valueType === 'ref') {
              return true;
            }
          }
        }
      }
    }
    
    return false;
  }

  /**
   * Create deep copy of value to maintain immutability
   * @private
   */
  _deepCopy(obj) {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    
    // Handle Date objects specially
    if (obj instanceof Date) {
      return new Date(obj.getTime());
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this._deepCopy(item));
    }
    
    const copy = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        copy[key] = this._deepCopy(obj[key]);
      }
    }
    
    return copy;
  }


  /**
   * Clean up subscriptions and resources
   */
  destroy() {
    if (this._subscriptionCleanup) {
      this._subscriptionCleanup();
      this._subscriptionCleanup = null;
    }
    
    this._subscribers.clear();
  }
}