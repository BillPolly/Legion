/**
 * Subscription system for managing reactive queries
 */

// Private state for subscription instances
const subscriptionStates = new WeakMap();

/**
 * Subscription - Represents a reactive query subscription
 */
export class Subscription {
  constructor(id, query, callback, rootEntity = null) {
    // Validate parameters
    if (!id) {
      throw new Error('Subscription ID is required');
    }
    
    if (!query) {
      throw new Error('Query is required');
    }
    
    if (!callback) {
      throw new Error('Callback is required');
    }
    
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }
    
    // Store public properties
    this.id = id;
    this.query = query;
    this.callback = callback;
    this.rootEntity = rootEntity;
    
    // Initialize private state
    subscriptionStates.set(this, {
      isActive: true,
      lastResults: null,
      metadata: null
    });
    
    // Freeze the instance
    Object.freeze(this);
  }

  /**
   * Check if this subscription is active
   */
  isActive() {
    const state = subscriptionStates.get(this);
    return state ? state.isActive : false;
  }

  /**
   * Check if this is an entity-rooted subscription
   */
  isEntityRooted() {
    return this.rootEntity !== null && this.rootEntity !== undefined;
  }

  /**
   * Deactivate this subscription
   */
  deactivate() {
    const state = subscriptionStates.get(this);
    if (state) {
      state.isActive = false;
    }
  }

  /**
   * Notify this subscription with new results
   * @param {Array} results - Query results
   * @param {Object} changes - Change information
   */
  notify(results, changes = {}) {
    if (!this.isActive()) {
      return; // Don't notify deactivated subscriptions
    }

    try {
      this.callback(results, changes);
    } catch (error) {
      // Don't let callback errors break the notification system
      console.error(`Error in subscription callback (${this.id}):`, error);
    }
  }

  /**
   * Get metadata about this subscription's query
   */
  getQueryMetadata() {
    const state = subscriptionStates.get(this);
    if (!state) return { variables: [], attributes: [] };

    // Cache metadata calculation
    if (!state.metadata) {
      state.metadata = this._calculateMetadata();
    }
    
    return state.metadata;
  }

  /**
   * Calculate query metadata (variables and attributes)
   * @private
   */
  _calculateMetadata() {
    const variables = new Set();
    const attributes = new Set();
    
    if (this.query.find) {
      // Extract variables from find clause
      const findVars = Array.isArray(this.query.find) ? this.query.find : [this.query.find];
      findVars.forEach(item => {
        if (typeof item === 'string' && item.startsWith('?')) {
          variables.add(item);
        }
        // Handle aggregation functions like ['(count ?e)']
        if (Array.isArray(item) && item.length > 0) {
          const fnStr = item[0];
          if (typeof fnStr === 'string') {
            const varMatches = fnStr.match(/\?\w+/g);
            if (varMatches) {
              varMatches.forEach(v => variables.add(v));
            }
          }
        }
      });
    }
    
    if (this.query.where) {
      // Extract variables and attributes from where clauses
      this.query.where.forEach(clause => {
        if (Array.isArray(clause) && clause.length >= 3) {
          const [e, a, v] = clause;
          
          // Extract variables
          if (typeof e === 'string' && e.startsWith('?')) variables.add(e);
          if (typeof a === 'string' && a.startsWith('?')) variables.add(a);
          if (typeof v === 'string' && v.startsWith('?')) variables.add(v);
          
          // Extract attributes
          if (typeof a === 'string' && a.startsWith(':')) attributes.add(a);
        }
      });
    }
    
    return {
      variables: Array.from(variables),
      attributes: Array.from(attributes)
    };
  }
}

/**
 * SubscriptionRegistry - Manages a collection of subscriptions
 */
export class SubscriptionRegistry {
  constructor() {
    this.subscriptions = new Map(); // id -> subscription
    this.byEntity = new Map(); // entityId -> Set(subscriptions)
    this.byAttribute = new Map(); // attribute -> Set(subscriptions)
  }

  /**
   * Register a new subscription
   * @param {Subscription} subscription - Subscription to register
   */
  register(subscription) {
    if (this.subscriptions.has(subscription.id)) {
      throw new Error(`Subscription with ID '${subscription.id}' already exists`);
    }
    
    this.subscriptions.set(subscription.id, subscription);
    
    // Index by entity if it's entity-rooted
    if (subscription.isEntityRooted()) {
      if (!this.byEntity.has(subscription.rootEntity)) {
        this.byEntity.set(subscription.rootEntity, new Set());
      }
      this.byEntity.get(subscription.rootEntity).add(subscription);
    } else {
      // Index non-entity-rooted subscriptions under null key
      if (!this.byEntity.has(null)) {
        this.byEntity.set(null, new Set());
      }
      this.byEntity.get(null).add(subscription);
    }
    
    // Index by attributes
    const metadata = subscription.getQueryMetadata();
    metadata.attributes.forEach(attr => {
      if (!this.byAttribute.has(attr)) {
        this.byAttribute.set(attr, new Set());
      }
      this.byAttribute.get(attr).add(subscription);
    });
  }

  /**
   * Unregister a subscription
   * @param {string} subscriptionId - ID of subscription to remove
   * @returns {Subscription|undefined} Removed subscription or undefined
   */
  unregister(subscriptionId) {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return undefined;
    
    // Remove from main registry
    this.subscriptions.delete(subscriptionId);
    
    // Remove from entity index
    const entityKey = subscription.isEntityRooted() ? subscription.rootEntity : null;
    if (this.byEntity.has(entityKey)) {
      this.byEntity.get(entityKey).delete(subscription);
      if (this.byEntity.get(entityKey).size === 0) {
        this.byEntity.delete(entityKey);
      }
    }
    
    // Remove from attribute indexes
    const metadata = subscription.getQueryMetadata();
    metadata.attributes.forEach(attr => {
      if (this.byAttribute.has(attr)) {
        this.byAttribute.get(attr).delete(subscription);
        if (this.byAttribute.get(attr).size === 0) {
          this.byAttribute.delete(attr);
        }
      }
    });
    
    return subscription;
  }

  /**
   * Get subscription by ID
   * @param {string} subscriptionId - Subscription ID
   * @returns {Subscription|undefined} Subscription or undefined
   */
  get(subscriptionId) {
    return this.subscriptions.get(subscriptionId);
  }

  /**
   * Get all subscriptions
   * @returns {Array<Subscription>} Array of all subscriptions
   */
  getAll() {
    return Array.from(this.subscriptions.values());
  }

  /**
   * Get subscription count
   * @returns {number} Number of registered subscriptions
   */
  size() {
    return this.subscriptions.size;
  }

  /**
   * Find subscriptions by entity ID
   * @param {number|null} entityId - Entity ID or null for general subscriptions
   * @returns {Array<Subscription>} Subscriptions for the entity
   */
  findByEntity(entityId) {
    const entitySet = this.byEntity.get(entityId);
    return entitySet ? Array.from(entitySet) : [];
  }

  /**
   * Find subscriptions that involve a specific attribute
   * @param {string} attribute - Attribute name (e.g., ':user/name')
   * @returns {Array<Subscription>} Subscriptions involving the attribute
   */
  findByAttribute(attribute) {
    const attrSet = this.byAttribute.get(attribute);
    return attrSet ? Array.from(attrSet) : [];
  }

  /**
   * Clean up deactivated subscriptions
   * @returns {number} Number of subscriptions removed
   */
  cleanup() {
    let removedCount = 0;
    
    // Find deactivated subscriptions
    const toRemove = [];
    for (const subscription of this.subscriptions.values()) {
      if (!subscription.isActive()) {
        toRemove.push(subscription.id);
      }
    }
    
    // Remove deactivated subscriptions
    toRemove.forEach(id => {
      if (this.unregister(id)) {
        removedCount++;
      }
    });
    
    return removedCount;
  }
}