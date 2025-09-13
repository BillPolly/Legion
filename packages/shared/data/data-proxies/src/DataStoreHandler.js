/**
 * DataStoreHandler - Resource handler interface methods for DataStore
 * 
 * Extends DataStore with interface methods needed for proxy operations:
 * - subscribe() method for reactive subscriptions
 * - Subscription management integration with ReactiveEngine
 */

import { Subscription } from '@legion/data-store/src/subscription.js';

/**
 * Add subscribe method to DataStore prototype for proxy support
 * 
 * This method creates reactive subscriptions that automatically trigger
 * callbacks when relevant data changes in the DataStore.
 */
export function addSubscriptionInterface(DataStore) {
  /**
   * Subscribe to query results and get notified of changes
   * @param {Object} querySpec - Query specification with find and where clauses
   * @param {Function} callback - Function to call with query results and changes
   * @returns {Object} Subscription object with unsubscribe method
   */
  DataStore.prototype.subscribe = function(querySpec, callback) {
    // Validate query specification
    if (!querySpec) {
      throw new Error('Query specification is required');
    }
    
    if (typeof querySpec !== 'object') {
      throw new Error('Query specification must be an object');
    }
    
    // Validate callback
    if (!callback) {
      throw new Error('Callback function is required');
    }
    
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }
    
    // Validate query structure
    if (!querySpec.find || (Array.isArray(querySpec.find) && querySpec.find.length === 0)) {
      throw new Error('Query must have find clause');
    }
    
    if (!querySpec.where) {
      throw new Error('Query must have where clause');
    }
    
    if (!Array.isArray(querySpec.where)) {
      throw new Error('Where clause must be an array');
    }
    
    // Generate unique subscription ID
    const subscriptionId = `sub-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    
    // Create subscription instance
    const subscription = new Subscription(subscriptionId, querySpec, callback);
    
    // Register with reactive engine
    this._reactiveEngine.addSubscription(subscription);
    
    // Execute initial query and trigger callback immediately
    try {
      const initialResults = this.query(querySpec);
      // Use setTimeout to make it async like real reactive updates
      setTimeout(() => {
        if (subscription.isActive()) {
          try {
            callback(initialResults);
          } catch (error) {
            // Handle callback errors gracefully - don't let them break the system
            console.error(`Error in subscription callback (${subscriptionId}):`, error);
          }
        }
      }, 0);
    } catch (error) {
      // If initial query fails, still return subscription but don't call callback
      console.warn('Initial query failed for subscription:', error);
    }
    
    // Return subscription object with unsubscribe method
    return {
      id: subscriptionId,
      unsubscribe: () => {
        // Deactivate subscription
        subscription.deactivate();
        
        // Remove from reactive engine
        this._reactiveEngine.removeSubscription(subscriptionId);
      }
    };
  };
}

/**
 * Enhanced subscription creation with entity rooting support
 * @param {DataStore} store - DataStore instance
 * @param {Object} querySpec - Query specification
 * @param {Function} callback - Callback function
 * @param {number|null} rootEntity - Root entity ID for entity-scoped subscriptions
 * @returns {Object} Subscription object
 */
export function createSubscription(store, querySpec, callback, rootEntity = null) {
  // Generate unique subscription ID
  const subscriptionId = `sub-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
  
  // Create subscription instance with optional entity rooting
  const subscription = new Subscription(subscriptionId, querySpec, callback, rootEntity);
  
  // Register with reactive engine
  store._reactiveEngine.addSubscription(subscription);
  
  return {
    id: subscriptionId,
    subscription: subscription,
    unsubscribe: () => {
      subscription.deactivate();
      store._reactiveEngine.removeSubscription(subscriptionId);
    }
  };
}

/**
 * Initialize DataStore with subscription interface
 * @param {Function} DataStoreClass - DataStore constructor function
 */
export function initializeDataStoreHandler(DataStoreClass) {
  addSubscriptionInterface(DataStoreClass);
}