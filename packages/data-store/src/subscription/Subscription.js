/**
 * Subscription class for live query results
 * Per design §4: Subscription Manager - client bindings for query outputs
 * 
 * Subscriptions represent client connections to live query results,
 * managing the lifecycle of result delivery and updates.
 */

import { EventEmitter } from 'events';

/**
 * Subscription states
 */
export const SubscriptionState = {
  PENDING: 'pending',       // Created but not activated
  ACTIVE: 'active',         // Receiving updates
  PAUSED: 'paused',        // Temporarily suspended
  CANCELLED: 'cancelled',   // Permanently terminated
  ERROR: 'error'           // Failed state
};

/**
 * Subscription for live query results
 * Per design: manages client binding to query outputs
 */
export class Subscription extends EventEmitter {
  constructor(options = {}) {
    super();
    
    if (!options.subscriptionId) {
      throw new Error('Subscription ID is required');
    }
    if (!options.queryId) {
      throw new Error('Query ID is required');
    }
    if (!options.callback && !options.handler) {
      throw new Error('Callback or handler is required');
    }
    
    this._subscriptionId = options.subscriptionId;
    this._queryId = options.queryId;
    this._callback = options.callback || options.handler;
    this._state = SubscriptionState.PENDING;
    this._filter = options.filter || null;
    this._transform = options.transform || null;
    this._metadata = options.metadata || {};
    this._createdAt = Date.now();
    this._activatedAt = null;
    this._lastUpdateAt = null;
    this._updateCount = 0;
    this._errorCount = 0;
    this._lastError = null;
    this._results = new Map(); // Current result set
    this._pendingUpdates = []; // Queued updates
  }

  /**
   * Get subscription ID
   */
  get subscriptionId() {
    return this._subscriptionId;
  }

  /**
   * Get associated query ID
   */
  get queryId() {
    return this._queryId;
  }

  /**
   * Get current state
   */
  get state() {
    return this._state;
  }

  /**
   * Check if subscription is active
   */
  isActive() {
    return this._state === SubscriptionState.ACTIVE;
  }

  /**
   * Check if subscription is paused
   */
  isPaused() {
    return this._state === SubscriptionState.PAUSED;
  }

  /**
   * Check if subscription is cancelled
   */
  isCancelled() {
    return this._state === SubscriptionState.CANCELLED;
  }

  /**
   * Check if subscription has error
   */
  hasError() {
    return this._state === SubscriptionState.ERROR;
  }

  /**
   * Get subscription statistics
   */
  getStats() {
    return {
      subscriptionId: this._subscriptionId,
      queryId: this._queryId,
      state: this._state,
      createdAt: this._createdAt,
      activatedAt: this._activatedAt,
      lastUpdateAt: this._lastUpdateAt,
      updateCount: this._updateCount,
      errorCount: this._errorCount,
      resultCount: this._results.size,
      pendingUpdateCount: this._pendingUpdates.length
    };
  }

  /**
   * Activate subscription
   */
  activate() {
    if (this._state === SubscriptionState.CANCELLED) {
      throw new Error('Cannot activate cancelled subscription');
    }
    if (this._state === SubscriptionState.ACTIVE) {
      return this; // Already active
    }
    
    this._state = SubscriptionState.ACTIVE;
    this._activatedAt = Date.now();
    this.emit('activated', { subscriptionId: this._subscriptionId });
    
    // Process any pending updates
    this._processPendingUpdates();
    
    return this;
  }

  /**
   * Pause subscription
   */
  pause() {
    if (this._state !== SubscriptionState.ACTIVE) {
      throw new Error('Can only pause active subscription');
    }
    
    this._state = SubscriptionState.PAUSED;
    this.emit('paused', { subscriptionId: this._subscriptionId });
    
    return this;
  }

  /**
   * Resume subscription
   */
  resume() {
    if (this._state !== SubscriptionState.PAUSED) {
      throw new Error('Can only resume paused subscription');
    }
    
    this._state = SubscriptionState.ACTIVE;
    this.emit('resumed', { subscriptionId: this._subscriptionId });
    
    // Process any pending updates
    this._processPendingUpdates();
    
    return this;
  }

  /**
   * Cancel subscription
   */
  cancel() {
    if (this._state === SubscriptionState.CANCELLED) {
      return this; // Already cancelled
    }
    
    this._state = SubscriptionState.CANCELLED;
    this._pendingUpdates = [];
    this._results.clear();
    this.emit('cancelled', { subscriptionId: this._subscriptionId });
    
    return this;
  }

  /**
   * Handle query results (initial bootstrap)
   */
  handleResults(results) {
    if (!Array.isArray(results)) {
      throw new Error('Results must be an array');
    }
    
    // Clear existing results for bootstrap
    this._results.clear();
    
    // Apply filter if present
    let filteredResults = results;
    if (this._filter) {
      filteredResults = results.filter(this._filter);
    }
    
    // Apply transform if present
    let transformedResults = filteredResults;
    if (this._transform) {
      transformedResults = filteredResults.map(this._transform);
    }
    
    // Store results
    transformedResults.forEach(result => {
      const key = this._getResultKey(result);
      this._results.set(key, result);
    });
    
    // Deliver to callback
    this._deliverResults({
      type: 'bootstrap',
      results: Array.from(this._results.values()),
      timestamp: Date.now()
    });
    
    return this;
  }

  /**
   * Handle incremental update
   */
  handleUpdate(update) {
    if (!update) {
      throw new Error('Update is required');
    }
    
    // Queue update if not active
    if (this._state !== SubscriptionState.ACTIVE) {
      this._pendingUpdates.push(update);
      return this;
    }
    
    // Process update based on type
    const processedUpdate = this._processUpdate(update);
    
    // Only deliver if update passed processing (e.g., filter)
    if (processedUpdate !== null) {
      this._deliverResults({
        type: 'update',
        update: processedUpdate,
        timestamp: Date.now()
      });
    }
    
    return this;
  }

  /**
   * Handle error
   */
  handleError(error, skipCallback = false) {
    this._errorCount++;
    this._lastError = error;
    
    // Transition to error state after threshold
    if (this._errorCount > 3) {
      this._state = SubscriptionState.ERROR;
    }
    
    this.emit('error', {
      subscriptionId: this._subscriptionId,
      error: error,
      errorCount: this._errorCount
    });
    
    // Deliver error to callback (unless this error came from the callback)
    if (this._callback && !skipCallback) {
      try {
        this._callback({
          type: 'error',
          error: error,
          timestamp: Date.now()
        });
      } catch (callbackError) {
        // Prevent infinite recursion if callback throws
        this.emit('error', {
          subscriptionId: this._subscriptionId,
          error: callbackError,
          errorCount: this._errorCount
        });
      }
    }
    
    return this;
  }

  /**
   * Get current results
   */
  getResults() {
    return Array.from(this._results.values());
  }

  /**
   * Clear results
   */
  clearResults() {
    this._results.clear();
    this._updateCount = 0;
    this._lastUpdateAt = null;
    return this;
  }

  /**
   * Process single update
   */
  _processUpdate(update) {
    // Handle different update types
    if (update.type === 'add') {
      const key = this._getResultKey(update.data);
      
      // Apply filter
      if (this._filter && !this._filter(update.data)) {
        return null;
      }
      
      // Apply transform
      const data = this._transform ? this._transform(update.data) : update.data;
      
      this._results.set(key, data);
      return { type: 'add', data };
      
    } else if (update.type === 'remove') {
      const key = this._getResultKey(update.data);
      
      if (this._results.has(key)) {
        const data = this._results.get(key);
        this._results.delete(key);
        return { type: 'remove', data };
      }
      return null;
      
    } else if (update.type === 'modify') {
      // For modify, we need to find the existing item by key
      // The update.data should have an identifying field (like id)
      let foundKey = null;
      let oldData = null;
      
      // Try to find matching item
      for (const [key, value] of this._results.entries()) {
        // If we have a key function, use it to compare
        if (this._metadata.keyFunction) {
          if (this._metadata.keyFunction(value) === this._metadata.keyFunction(update.data)) {
            foundKey = key;
            oldData = value;
            break;
          }
        } else if (value.id !== undefined && update.data.id !== undefined && value.id === update.data.id) {
          // Default: match by id field if available
          foundKey = key;
          oldData = value;
          break;
        } else if (key === this._getResultKey(update.data)) {
          // Fallback to key match
          foundKey = key;
          oldData = value;
          break;
        }
      }
      
      if (foundKey !== null) {
        // Apply filter
        if (this._filter && !this._filter(update.data)) {
          // Item no longer matches filter, remove it
          this._results.delete(foundKey);
          return { type: 'remove', data: oldData };
        }
        
        // Apply transform
        const data = this._transform ? this._transform(update.data) : update.data;
        
        // Update with new key if changed
        const newKey = this._getResultKey(data);
        if (newKey !== foundKey) {
          this._results.delete(foundKey);
        }
        this._results.set(newKey, data);
        
        return { type: 'modify', oldData, newData: data };
      }
      return null;
    }
    
    return update;
  }

  /**
   * Process pending updates
   */
  _processPendingUpdates() {
    if (this._pendingUpdates.length === 0) {
      return;
    }
    
    const updates = this._pendingUpdates.splice(0);
    const processedUpdates = [];
    
    for (const update of updates) {
      const processed = this._processUpdate(update);
      if (processed) {
        processedUpdates.push(processed);
      }
    }
    
    if (processedUpdates.length > 0) {
      this._deliverResults({
        type: 'batch_update',
        updates: processedUpdates,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Deliver results to callback
   */
  _deliverResults(payload) {
    this._updateCount++;
    this._lastUpdateAt = Date.now();
    
    if (this._callback) {
      try {
        this._callback(payload);
      } catch (error) {
        // Pass true to skip callback to prevent recursion
        this.handleError(error, true);
      }
    }
    
    this.emit('update', payload);
  }

  /**
   * Get result key for deduplication
   */
  _getResultKey(result) {
    // Use provided key function or default to JSON
    if (this._metadata.keyFunction) {
      return this._metadata.keyFunction(result);
    }
    
    // Default: use entire object as key
    return JSON.stringify(result);
  }

  /**
   * Get subscription metadata
   */
  getMetadata() {
    return { ...this._metadata };
  }

  /**
   * Set subscription metadata
   */
  setMetadata(key, value) {
    this._metadata[key] = value;
    return this;
  }

  /**
   * String representation
   */
  toString() {
    return `Subscription(${this._subscriptionId} -> ${this._queryId}, state=${this._state}, results=${this._results.size})`;
  }
}