/**
 * SubscriptionManager
 * Manages subscriptions between data sources and DOM elements
 * Part of the reactive binding system
 */

export class SubscriptionManager {
  constructor() {
    this.subscriptions = new Map();
    this.listeners = new Map();
  }

  /**
   * Subscribe to a data path
   * @param {string} path - The data path to subscribe to
   * @param {Function} callback - Callback when data changes
   * @returns {string} Subscription ID
   */
  subscribe(path, callback) {
    const id = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    if (!this.subscriptions.has(path)) {
      this.subscriptions.set(path, new Set());
    }
    
    const subscription = { id, callback };
    this.subscriptions.get(path).add(subscription);
    
    // Store reverse mapping for easy unsubscribe
    this.listeners.set(id, { path, subscription });
    
    return id;
  }

  /**
   * Unsubscribe from a subscription
   * @param {string} subscriptionId - The subscription ID to remove
   */
  unsubscribe(subscriptionId) {
    const listener = this.listeners.get(subscriptionId);
    if (listener) {
      const { path, subscription } = listener;
      const pathSubscriptions = this.subscriptions.get(path);
      if (pathSubscriptions) {
        pathSubscriptions.delete(subscription);
        if (pathSubscriptions.size === 0) {
          this.subscriptions.delete(path);
        }
      }
      this.listeners.delete(subscriptionId);
    }
  }

  /**
   * Notify all subscribers of a path
   * @param {string} path - The data path that changed
   * @param {any} value - The new value
   * @param {any} oldValue - The previous value
   */
  notify(path, value, oldValue) {
    const pathSubscriptions = this.subscriptions.get(path);
    if (pathSubscriptions) {
      for (const { callback } of pathSubscriptions) {
        try {
          callback(value, oldValue, path);
        } catch (error) {
          console.error(`Error in subscription callback for path ${path}:`, error);
        }
      }
    }
    
    // Also notify wildcard subscribers (e.g., "data.*")
    this.notifyWildcards(path, value, oldValue);
  }

  /**
   * Notify wildcard subscribers
   * @private
   */
  notifyWildcards(path, value, oldValue) {
    for (const [subscribedPath, subscriptions] of this.subscriptions) {
      if (subscribedPath.includes('*')) {
        const regex = new RegExp('^' + subscribedPath.replace(/\*/g, '.*') + '$');
        if (regex.test(path)) {
          for (const { callback } of subscriptions) {
            try {
              callback(value, oldValue, path);
            } catch (error) {
              console.error(`Error in wildcard subscription callback for path ${subscribedPath}:`, error);
            }
          }
        }
      }
    }
  }

  /**
   * Clear all subscriptions
   */
  clear() {
    this.subscriptions.clear();
    this.listeners.clear();
  }

  /**
   * Get all active subscription paths
   * @returns {string[]} Array of paths with active subscriptions
   */
  getActivePaths() {
    return Array.from(this.subscriptions.keys());
  }

  /**
   * Get subscription count for a path
   * @param {string} path - The data path
   * @returns {number} Number of subscriptions
   */
  getSubscriptionCount(path) {
    const pathSubscriptions = this.subscriptions.get(path);
    return pathSubscriptions ? pathSubscriptions.size : 0;
  }
}