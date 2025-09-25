/**
 * SchemaNotificationSystem - Reactive notifications for schema changes
 * 
 * Provides a centralized system for managing schema change notifications:
 * - Broadcast schema changes to multiple listeners
 * - Filter notifications by entity type or attribute
 * - Support for both global and scoped subscriptions
 * - Automatic cleanup on unsubscribe
 */

export class SchemaNotificationSystem {
  constructor() {
    // Map of subscription ID to subscription details
    this.subscriptions = new Map();
    
    // Map of entity type to set of subscription IDs
    this.typeSubscriptions = new Map();
    
    // Set of global subscription IDs (receive all changes)
    this.globalSubscriptions = new Set();
    
    // Counter for generating unique subscription IDs
    this._subscriptionIdCounter = 0;
    
    // Queue for batching notifications
    this._notificationQueue = [];
    this._isProcessingQueue = false;
  }
  
  /**
   * Subscribe to schema changes
   * @param {Object} options - Subscription options
   * @param {string} options.entityType - Filter by entity type (optional)
   * @param {string} options.attributeName - Filter by attribute (optional)
   * @param {Function} options.callback - Callback function
   * @param {boolean} options.immediate - Execute immediately or batch
   * @returns {Object} Subscription object with unsubscribe method
   */
  subscribe(options) {
    if (!options.callback || typeof options.callback !== 'function') {
      throw new Error('Callback function is required');
    }
    
    const subscriptionId = ++this._subscriptionIdCounter;
    
    const subscription = {
      id: subscriptionId,
      entityType: options.entityType || null,
      attributeName: options.attributeName || null,
      callback: options.callback,
      immediate: options.immediate !== false, // Default to immediate
      createdAt: Date.now()
    };
    
    // Store subscription
    this.subscriptions.set(subscriptionId, subscription);
    
    // Index by entity type if specified
    if (subscription.entityType) {
      if (!this.typeSubscriptions.has(subscription.entityType)) {
        this.typeSubscriptions.set(subscription.entityType, new Set());
      }
      this.typeSubscriptions.get(subscription.entityType).add(subscriptionId);
    } else {
      // Global subscription
      this.globalSubscriptions.add(subscriptionId);
    }
    
    // Return unsubscribe function
    return {
      unsubscribe: () => this.unsubscribe(subscriptionId)
    };
  }
  
  /**
   * Unsubscribe from schema changes
   * @param {number} subscriptionId - Subscription ID to remove
   */
  unsubscribe(subscriptionId) {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      return; // Already unsubscribed
    }
    
    // Remove from indices
    if (subscription.entityType) {
      const typeSet = this.typeSubscriptions.get(subscription.entityType);
      if (typeSet) {
        typeSet.delete(subscriptionId);
        if (typeSet.size === 0) {
          this.typeSubscriptions.delete(subscription.entityType);
        }
      }
    } else {
      this.globalSubscriptions.delete(subscriptionId);
    }
    
    // Remove subscription
    this.subscriptions.delete(subscriptionId);
  }
  
  /**
   * Notify subscribers of a schema change
   * @param {Object} change - Schema change event
   * @param {string} change.type - Type of change
   * @param {string} change.entityType - Entity type affected
   * @param {string} change.attributeName - Attribute affected (optional)
   * @param {*} change.spec - Change specification
   * @param {number} change.version - New schema version
   * @param {Object} change.metadata - Additional metadata
   */
  notify(change) {
    if (!change || !change.type) {
      throw new Error('Change event must have a type');
    }
    
    // Find matching subscriptions
    const matchingSubscriptions = this._findMatchingSubscriptions(change);
    
    // Process notifications
    for (const subscription of matchingSubscriptions) {
      if (subscription.immediate) {
        // Execute immediately
        this._executeCallback(subscription, change);
      } else {
        // Queue for batch processing
        this._queueNotification(subscription, change);
      }
    }
    
    // Process queue if needed
    if (this._notificationQueue.length > 0 && !this._isProcessingQueue) {
      this._processBatchedNotifications();
    }
  }
  
  /**
   * Find subscriptions that match the change
   * @param {Object} change - Schema change event
   * @returns {Array<Object>} Matching subscriptions
   * @private
   */
  _findMatchingSubscriptions(change) {
    const matching = [];
    
    // Add global subscriptions
    for (const id of this.globalSubscriptions) {
      const subscription = this.subscriptions.get(id);
      if (subscription) {
        matching.push(subscription);
      }
    }
    
    // Add type-specific subscriptions
    if (change.entityType) {
      const typeSet = this.typeSubscriptions.get(change.entityType);
      if (typeSet) {
        for (const id of typeSet) {
          const subscription = this.subscriptions.get(id);
          if (subscription) {
            // Check attribute filter if specified
            if (!subscription.attributeName || 
                subscription.attributeName === change.attributeName) {
              matching.push(subscription);
            }
          }
        }
      }
    }
    
    return matching;
  }
  
  /**
   * Execute callback with error handling
   * @param {Object} subscription - Subscription object
   * @param {Object} change - Change event
   * @private
   */
  _executeCallback(subscription, change) {
    try {
      subscription.callback(change);
    } catch (error) {
      console.error('Schema notification callback error:', error);
      // Don't unsubscribe on error - let subscriber handle it
    }
  }
  
  /**
   * Queue notification for batch processing
   * @param {Object} subscription - Subscription object
   * @param {Object} change - Change event
   * @private
   */
  _queueNotification(subscription, change) {
    this._notificationQueue.push({ subscription, change });
  }
  
  /**
   * Process batched notifications
   * @private
   */
  _processBatchedNotifications() {
    if (this._isProcessingQueue || this._notificationQueue.length === 0) {
      return;
    }
    
    this._isProcessingQueue = true;
    
    // Use microtask to batch notifications in same event loop tick
    queueMicrotask(() => {
      const queue = this._notificationQueue.splice(0);
      
      // Group by subscription for efficiency
      const grouped = new Map();
      for (const { subscription, change } of queue) {
        if (!grouped.has(subscription.id)) {
          grouped.set(subscription.id, {
            subscription,
            changes: []
          });
        }
        grouped.get(subscription.id).changes.push(change);
      }
      
      // Execute batched callbacks
      for (const { subscription, changes } of grouped.values()) {
        try {
          // Call with array of changes for batch mode
          subscription.callback(changes);
        } catch (error) {
          console.error('Batched schema notification error:', error);
        }
      }
      
      this._isProcessingQueue = false;
      
      // Check if more notifications queued during processing
      if (this._notificationQueue.length > 0) {
        this._processBatchedNotifications();
      }
    });
  }
  
  /**
   * Get subscription statistics
   * @returns {Object} Statistics about subscriptions
   */
  getStats() {
    return {
      totalSubscriptions: this.subscriptions.size,
      globalSubscriptions: this.globalSubscriptions.size,
      typeSubscriptions: this.typeSubscriptions.size,
      queuedNotifications: this._notificationQueue.length,
      subscriptionsByType: Object.fromEntries(
        Array.from(this.typeSubscriptions.entries()).map(([type, set]) => 
          [type, set.size]
        )
      )
    };
  }
  
  /**
   * Clear all subscriptions
   */
  clear() {
    this.subscriptions.clear();
    this.typeSubscriptions.clear();
    this.globalSubscriptions.clear();
    this._notificationQueue = [];
    this._subscriptionIdCounter = 0;
  }
  
  /**
   * Create a filtered view of the notification system
   * @param {string} entityType - Entity type to filter by
   * @returns {Object} Filtered notification interface
   */
  createFilteredView(entityType) {
    return {
      subscribe: (callback, options = {}) => {
        return this.subscribe({
          ...options,
          entityType,
          callback
        });
      },
      
      notify: (change) => {
        this.notify({
          ...change,
          entityType
        });
      }
    };
  }
}

/**
 * Factory function to create a SchemaNotificationSystem
 * @returns {SchemaNotificationSystem} New notification system instance
 */
export function createSchemaNotificationSystem() {
  return new SchemaNotificationSystem();
}