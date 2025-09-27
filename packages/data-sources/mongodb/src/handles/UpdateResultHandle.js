/**
 * UpdateResultHandle - Represents a MongoDB update/modification result
 * 
 * This Handle is returned immediately from update() calls and contains
 * information about the modification operation's result.
 * 
 * Pattern:
 * 1. update() returns UpdateResultHandle immediately (synchronous)
 * 2. MongoDB operation runs in background
 * 3. When result arrives, handle is populated
 * 4. Subscribers are notified of completion
 */

import { Handle } from '@legion/handle';

export class UpdateResultHandle extends Handle {
  constructor(dataSource, updateSpec) {
    super(dataSource);
    
    this.updateSpec = updateSpec;
    this._result = null;
    this._pending = true;
    this._error = null;
    this._subscribers = new Set();
    this._dataSubscribers = new Set(); // Separate set for onData callbacks
    
    // Start async update immediately
    this._executeUpdate();
  }
  
  /**
   * Get update result - returns result if available, null if pending
   * CRITICAL: Synchronous - no await!
   */
  value() {
    if (this._error) {
      throw this._error;
    }
    return this._result;
  }
  
  /**
   * Check if update is still pending
   */
  isPending() {
    return this._pending;
  }
  
  /**
   * Check if update has completed
   */
  isReady() {
    return !this._pending;
  }
  
  /**
   * Check if update resulted in error
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
   * Get result properties
   */
  get acknowledged() {
    return this._result?.acknowledged || false;
  }
  
  get modifiedCount() {
    return this._result?.modifiedCount || 0;
  }
  
  get upsertedCount() {
    return this._result?.upsertedCount || 0;
  }
  
  get matchedCount() {
    return this._result?.matchedCount || 0;
  }
  
  get deletedCount() {
    return this._result?.deletedCount || 0;
  }
  
  get insertedCount() {
    return this._result?.insertedCount || 0;
  }
  
  get insertedIds() {
    return this._result?.insertedIds || [];
  }
  
  /**
   * Subscribe to result availability
   * Callback will be invoked when result becomes available
   */
  onResult(callback) {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }
    
    this._subscribers.add(callback);
    
    // If result is already available, notify immediately
    if (!this._pending) {
      callback(this._result, this._error);
    }
    
    // Return unsubscribe function
    return () => {
      this._subscribers.delete(callback);
    };
  }
  
  /**
   * Subscribe to data availability (alias for onResult for consistency)
   * Callback will be invoked when data becomes available
   * Callback signature: (data, error) - matching QueryResultHandle
   */
  onData(callback) {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }
    
    this._dataSubscribers.add(callback);
    
    // If result is already available, notify immediately
    if (!this._pending) {
      // Pass both data and error for consistency with QueryResultHandle
      callback(this._result, this._error);
    }
    
    // Return unsubscribe function
    return () => {
      this._dataSubscribers.delete(callback);
    };
  }
  
  /**
   * Execute update asynchronously and populate handle when ready
   * @private
   */
  _executeUpdate() {
    // Import update execution modules dynamically to avoid circular deps
    const executeUpdateAsync = async () => {
      try {
        const { executeServerUpdate } = await import('../operations/serverOperations.js');
        const { executeDatabaseUpdate } = await import('../operations/databaseOperations.js');
        const { executeCollectionUpdate } = await import('../operations/collectionOperations.js');
        
        let result;
        const { level } = this.updateSpec;
        const client = this.dataSource.client;
        
        // Ensure connection
        if (!this.dataSource.connected) {
          await client.connect();
          this.dataSource.connected = true;
        }
        
        // Execute update based on level
        switch (level) {
          case 'server':
            result = await executeServerUpdate(client, this.updateSpec);
            break;
          case 'database':
            result = await executeDatabaseUpdate(client, this.updateSpec);
            break;
          case 'collection':
            result = await executeCollectionUpdate(client, this.updateSpec);
            break;
          case 'document':
            result = await executeCollectionUpdate(client, this.updateSpec);
            break;
          default:
            throw new Error(`Unsupported update level: ${level}`);
        }
        
        // Populate handle with result
        this._populate(result, null);
        
      } catch (error) {
        // Populate handle with error
        this._populate(null, error);
      }
    };
    
    // Start async execution
    executeUpdateAsync();
  }
  
  /**
   * Populate handle with result or error
   * @private
   */
  _populate(result, error) {
    this._result = result;
    this._error = error;
    this._pending = false;
    
    // Notify onResult subscribers (they expect result and error)
    for (const callback of this._subscribers) {
      try {
        callback(result, error);
      } catch (callbackError) {
        console.error('Error in UpdateResultHandle subscriber callback:', callbackError);
      }
    }
    
    // Notify onData subscribers (they expect both result and error like onResult)
    for (const callback of this._dataSubscribers) {
      try {
        callback(result, error);
      } catch (callbackError) {
        console.error('Error in UpdateResultHandle onData callback:', callbackError);
      }
    }
  }
}