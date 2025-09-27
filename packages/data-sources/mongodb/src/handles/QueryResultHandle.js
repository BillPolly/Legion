/**
 * QueryResultHandle - Represents a MongoDB query result that may be pending
 * 
 * This Handle is returned immediately from query() calls with the correct prototype
 * based on the query type. The actual data is populated asynchronously via callbacks.
 * 
 * Pattern:
 * 1. query() returns QueryResultHandle immediately (synchronous)
 * 2. Handle has correct structure/prototype from schema
 * 3. MongoDB operation runs in background
 * 4. When data arrives, handle is populated via _populate() callback
 * 5. Subscribers are notified of changes
 */

import { Handle } from '@legion/handle';

export class QueryResultHandle extends Handle {
  constructor(dataSource, querySpec) {
    super(dataSource);
    
    this.querySpec = querySpec;
    this._data = null;
    this._pending = true;
    this._error = null;
    this._subscribers = new Set();
    
    // Determine result type from query spec to set prototype
    this._resultType = this._determineResultType(querySpec);
    
    // Start async query immediately
    this._executeQuery();
  }
  
  /**
   * Get current value - returns data if available, null if pending
   * CRITICAL: Synchronous - no await!
   */
  value() {
    if (this._error) {
      throw this._error;
    }
    return this._data;
  }
  
  /**
   * Check if query is still pending
   */
  isPending() {
    return this._pending;
  }
  
  /**
   * Check if query has completed
   */
  isReady() {
    return !this._pending;
  }
  
  /**
   * Check if query resulted in error
   */
  hasError() {
    return this._error !== null;
  }
  
  /**
   * Get error if one occurred
   */
  getError() {
    return this._error;
  }
  
  /**
   * Execute query - delegate to parent implementation
   */
  query(subQuerySpec) {
    // Query the current data
    if (this._pending) {
      throw new Error('Cannot query pending result - subscribe for updates or wait');
    }
    
    if (this._error) {
      throw this._error;
    }
    
    // Delegate to data source with current data as context
    return this.dataSource.query({
      ...subQuerySpec,
      context: this._data
    });
  }
  
  /**
   * Subscribe to data changes
   * Callback will be invoked when data becomes available
   */
  onData(callback) {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }
    
    this._subscribers.add(callback);
    
    // If data is already available, notify immediately
    if (!this._pending) {
      callback(this._data, this._error);
    }
    
    // Return unsubscribe function
    return () => {
      this._subscribers.delete(callback);
    };
  }
  
  /**
   * Subscribe to errors
   * Callback will be invoked if an error occurs
   */
  onError(callback) {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }
    
    // Store error callback
    this._errorCallback = callback;
    
    // If error already occurred, notify immediately
    if (this._error) {
      callback(this._error);
    }
    
    // Return unsubscribe function
    return () => {
      this._errorCallback = null;
    };
  }
  
  /**
   * Determine result type from query spec
   * @private
   */
  _determineResultType(querySpec) {
    const { operation, level } = querySpec;
    
    // Map operation to result type
    if (operation === 'find' || operation === 'aggregate') {
      return 'array';
    }
    
    if (operation === 'findOne') {
      return 'document';
    }
    
    if (operation === 'count' || operation === 'countDocuments') {
      return 'number';
    }
    
    if (operation === 'distinct') {
      return 'array';
    }
    
    // Server operations
    if (level === 'server') {
      if (operation === 'listDatabases') return 'array';
      if (operation === 'serverStatus') return 'object';
    }
    
    // Database operations
    if (level === 'database') {
      if (operation === 'listCollections') return 'array';
      if (operation === 'stats') return 'object';
    }
    
    return 'object'; // Default
  }
  
  /**
   * Execute query asynchronously and populate handle when ready
   * @private
   */
  _executeQuery() {
    // Import query execution modules dynamically to avoid circular deps
    const executeQueryAsync = async () => {
      try {
        const { executeServerQuery } = await import('../operations/serverOperations.js');
        const { executeDatabaseQuery } = await import('../operations/databaseOperations.js');
        const { executeCollectionQuery } = await import('../operations/collectionOperations.js');
        
        let result;
        const { level } = this.querySpec;
        const client = this.dataSource.client;
        
        // Ensure connection
        if (!this.dataSource.connected) {
          await client.connect();
          this.dataSource.connected = true;
        }
        
        // Execute query based on level
        switch (level) {
          case 'server':
            result = await executeServerQuery(client, this.querySpec);
            break;
          case 'database':
            result = await executeDatabaseQuery(client, this.querySpec);
            break;
          case 'collection':
            result = await executeCollectionQuery(client, this.querySpec);
            break;
          default:
            throw new Error(`Unsupported query level: ${level}`);
        }
        
        // Populate handle with result
        this._populate(result, null);
        
      } catch (error) {
        // Populate handle with error
        this._populate(null, error);
      }
    };
    
    // Start async execution
    executeQueryAsync();
  }
  
  /**
   * Populate handle with data or error
   * @private
   */
  _populate(data, error) {
    this._data = data;
    this._error = error;
    this._pending = false;
    
    // If there's an error, only notify error callbacks
    if (error) {
      // Notify error callback if registered
      if (this._errorCallback) {
        try {
          this._errorCallback(error);
        } catch (callbackError) {
          console.error('Error in QueryResultHandle error callback:', callbackError);
        }
      }
      // For backward compatibility, still notify data subscribers with error as second param
      // but they should check for error
      for (const callback of this._subscribers) {
        try {
          callback(null, error);
        } catch (callbackError) {
          console.error('Error in QueryResultHandle subscriber callback:', callbackError);
        }
      }
    } else {
      // Only notify data subscribers when there's actual data
      for (const callback of this._subscribers) {
        try {
          callback(data, null);
        } catch (callbackError) {
          console.error('Error in QueryResultHandle subscriber callback:', callbackError);
        }
      }
    }
  }
}