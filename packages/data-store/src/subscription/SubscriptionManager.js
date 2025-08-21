/**
 * SubscriptionManager for routing query outputs to clients
 * Per design §4: Subscription Manager - manages live query subscriptions
 * 
 * SubscriptionManager coordinates between the Dispatcher and client
 * subscriptions, routing query results and updates to subscribers.
 */

import { EventEmitter } from 'events';
import { Subscription, SubscriptionState } from './Subscription.js';

/**
 * Manager for live query subscriptions
 * Per design: routes query outputs to client subscriptions
 */
export class SubscriptionManager extends EventEmitter {
  constructor(dispatcher) {
    super();
    
    if (!dispatcher) {
      throw new Error('Dispatcher is required');
    }
    
    this._dispatcher = dispatcher;
    this._subscriptions = new Map(); // subscriptionId -> Subscription
    this._querySubscriptions = new Map(); // queryId -> Set<subscriptionId>
    this._activeCount = 0;
    this._nextSubscriptionId = 1;
    
    // Listen to dispatcher events
    this._setupDispatcherListeners();
  }

  /**
   * Create a new subscription
   */
  subscribe(queryId, callback, options = {}) {
    if (!queryId) {
      throw new Error('Query ID is required');
    }
    if (!callback && !options.handler) {
      throw new Error('Callback or handler is required');
    }
    
    // Generate subscription ID
    const subscriptionId = options.subscriptionId || this._generateSubscriptionId();
    
    // Check for duplicate
    if (this._subscriptions.has(subscriptionId)) {
      throw new Error(`Subscription ${subscriptionId} already exists`);
    }
    
    // Create subscription
    const subscription = new Subscription({
      subscriptionId,
      queryId,
      callback: callback || options.handler,
      filter: options.filter,
      transform: options.transform,
      metadata: options.metadata
    });
    
    // Store subscription
    this._subscriptions.set(subscriptionId, subscription);
    
    // Track by query ID
    if (!this._querySubscriptions.has(queryId)) {
      this._querySubscriptions.set(queryId, new Set());
    }
    this._querySubscriptions.get(queryId).add(subscriptionId);
    
    // Setup subscription listeners
    this._setupSubscriptionListeners(subscription);
    
    // Auto-activate if requested
    if (options.autoActivate !== false) {
      this.activateSubscription(subscriptionId);
    }
    
    this.emit('subscriptionCreated', {
      subscriptionId,
      queryId
    });
    
    return subscription;
  }

  /**
   * Unsubscribe from query
   */
  unsubscribe(subscriptionId) {
    if (!subscriptionId) {
      throw new Error('Subscription ID is required');
    }
    
    const subscription = this._subscriptions.get(subscriptionId);
    if (!subscription) {
      return false; // Already removed
    }
    
    // Check if active BEFORE cancelling
    const wasActive = subscription.isActive();
    
    // Remove from tracking BEFORE cancelling to prevent re-entrant call
    this._subscriptions.delete(subscriptionId);
    
    // Remove from query tracking
    const queryId = subscription.queryId;
    const querySubscriptions = this._querySubscriptions.get(queryId);
    if (querySubscriptions) {
      querySubscriptions.delete(subscriptionId);
      if (querySubscriptions.size === 0) {
        this._querySubscriptions.delete(queryId);
        
        // Deactivate query if no more subscriptions
        this._checkQueryDeactivation(queryId);
      }
    }
    
    // Update active count
    if (wasActive) {
      this._activeCount--;
    }
    
    // Cancel subscription AFTER removing from tracking
    subscription.cancel();
    
    this.emit('subscriptionRemoved', {
      subscriptionId,
      queryId
    });
    
    return true;
  }

  /**
   * Get subscription by ID
   */
  getSubscription(subscriptionId) {
    return this._subscriptions.get(subscriptionId);
  }

  /**
   * Get all subscriptions for a query
   */
  getQuerySubscriptions(queryId) {
    const subscriptionIds = this._querySubscriptions.get(queryId);
    if (!subscriptionIds) {
      return [];
    }
    
    return Array.from(subscriptionIds)
      .map(id => this._subscriptions.get(id))
      .filter(sub => sub !== undefined);
  }

  /**
   * Get all active subscriptions
   */
  getActiveSubscriptions() {
    return Array.from(this._subscriptions.values())
      .filter(sub => sub.isActive());
  }

  /**
   * Activate subscription
   */
  activateSubscription(subscriptionId) {
    const subscription = this._subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription ${subscriptionId} not found`);
    }
    
    // Activate subscription first
    const wasActive = subscription.isActive();
    subscription.activate();
    
    if (!wasActive) {
      this._activeCount++;
    }
    
    // Now check if query needs activation (after subscription is active)
    const queryId = subscription.queryId;
    this._checkQueryActivation(queryId);
    
    // Bootstrap with current results if query is active
    if (this._dispatcher.isQueryActive(queryId)) {
      const results = this._dispatcher.getQueryResults(queryId);
      if (results) {
        subscription.handleResults(results);
      }
    }
    
    return subscription;
  }

  /**
   * Pause subscription
   */
  pauseSubscription(subscriptionId) {
    const subscription = this._subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription ${subscriptionId} not found`);
    }
    
    const wasActive = subscription.isActive();
    subscription.pause();
    
    if (wasActive) {
      this._activeCount--;
    }
    
    // Check if query should be deactivated
    this._checkQueryDeactivation(subscription.queryId);
    
    return subscription;
  }

  /**
   * Resume subscription
   */
  resumeSubscription(subscriptionId) {
    const subscription = this._subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription ${subscriptionId} not found`);
    }
    
    // Resume subscription first
    const wasActive = subscription.isActive();
    subscription.resume();
    
    if (!wasActive && subscription.isActive()) {
      this._activeCount++;
    }
    
    // Now check if query needs activation (after subscription is active)
    const queryId = subscription.queryId;
    this._checkQueryActivation(queryId);
    
    return subscription;
  }

  /**
   * Pause all subscriptions for a query
   */
  pauseQuery(queryId) {
    const subscriptions = this.getQuerySubscriptions(queryId);
    
    subscriptions.forEach(sub => {
      if (sub.isActive()) {
        sub.pause();
        this._activeCount--;
      }
    });
    
    // Deactivate query in dispatcher
    this._checkQueryDeactivation(queryId);
    
    return subscriptions.length;
  }

  /**
   * Resume all subscriptions for a query
   */
  resumeQuery(queryId) {
    // Activate query in dispatcher
    this._checkQueryActivation(queryId);
    
    const subscriptions = this.getQuerySubscriptions(queryId);
    
    subscriptions.forEach(sub => {
      if (sub.isPaused()) {
        sub.resume();
        this._activeCount++;
      }
    });
    
    return subscriptions.length;
  }

  /**
   * Handle query results from dispatcher
   */
  handleQueryResults(queryId, results) {
    const subscriptions = this.getQuerySubscriptions(queryId);
    
    subscriptions.forEach(sub => {
      if (sub.isActive()) {
        try {
          sub.handleResults(results);
        } catch (error) {
          sub.handleError(error);
        }
      }
    });
    
    this.emit('resultsDelivered', {
      queryId,
      subscriptionCount: subscriptions.length,
      resultCount: results.length
    });
  }

  /**
   * Handle query update from dispatcher
   */
  handleQueryUpdate(queryId, update) {
    const subscriptions = this.getQuerySubscriptions(queryId);
    
    subscriptions.forEach(sub => {
      if (sub.isActive()) {
        try {
          sub.handleUpdate(update);
        } catch (error) {
          sub.handleError(error);
        }
      }
    });
    
    this.emit('updateDelivered', {
      queryId,
      subscriptionCount: subscriptions.length,
      updateType: update.type
    });
  }

  /**
   * Clear all subscriptions
   */
  clear() {
    // Cancel all subscriptions
    this._subscriptions.forEach(sub => sub.cancel());
    
    // Clear tracking
    this._subscriptions.clear();
    this._querySubscriptions.clear();
    this._activeCount = 0;
    
    this.emit('cleared');
  }

  /**
   * Get manager statistics
   */
  getStats() {
    const stats = {
      totalSubscriptions: this._subscriptions.size,
      activeSubscriptions: this._activeCount,
      pausedSubscriptions: 0,
      errorSubscriptions: 0,
      queriesWithSubscriptions: this._querySubscriptions.size,
      subscriptionsByState: {}
    };
    
    // Count by state
    this._subscriptions.forEach(sub => {
      const state = sub.state;
      stats.subscriptionsByState[state] = (stats.subscriptionsByState[state] || 0) + 1;
      
      if (sub.isPaused()) stats.pausedSubscriptions++;
      if (sub.hasError()) stats.errorSubscriptions++;
    });
    
    return stats;
  }

  /**
   * Setup dispatcher event listeners
   */
  _setupDispatcherListeners() {
    // Listen for query execution results
    this._dispatcher.on('queryExecuted', (event) => {
      if (event.results) {
        this.handleQueryResults(event.queryId, event.results);
      }
    });
    
    // Listen for delta processing results
    this._dispatcher.on('deltaProcessed', (event) => {
      // Route updates to relevant queries
      if (event.affectedQueries) {
        event.affectedQueries.forEach(queryId => {
          this.handleQueryUpdate(queryId, {
            type: 'delta',
            delta: event.delta
          });
        });
      }
    });
    
    // Listen for query deactivation
    this._dispatcher.on('queryDeactivated', (event) => {
      // Pause subscriptions for deactivated query
      this.pauseQuery(event.queryId);
    });
  }

  /**
   * Setup subscription event listeners
   */
  _setupSubscriptionListeners(subscription) {
    // Forward subscription events
    subscription.on('error', (event) => {
      this.emit('subscriptionError', {
        ...event,
        queryId: subscription.queryId
      });
    });
    
    subscription.on('cancelled', (event) => {
      // Auto-remove cancelled subscriptions if not already removed
      // This handles subscriptions cancelled directly rather than via unsubscribe
      if (this._subscriptions.has(subscription.subscriptionId)) {
        this.unsubscribe(subscription.subscriptionId);
      }
    });
  }

  /**
   * Check if query needs activation
   */
  _checkQueryActivation(queryId) {
    // Check if any active subscriptions exist
    const subscriptions = this.getQuerySubscriptions(queryId);
    const hasActive = subscriptions.some(sub => sub.isActive());
    
    if (hasActive && !this._dispatcher.isQueryActive(queryId)) {
      // Activate query in dispatcher
      try {
        this._dispatcher.activateQuery(queryId);
        return true;
      } catch (error) {
        // Query might not be registered yet
        this.emit('queryActivationFailed', {
          queryId,
          error
        });
      }
    }
    
    return false;
  }

  /**
   * Check if query should be deactivated
   */
  _checkQueryDeactivation(queryId) {
    // Check if any active subscriptions remain
    const subscriptions = this.getQuerySubscriptions(queryId);
    const hasActive = subscriptions.some(sub => sub.isActive());
    
    if (!hasActive && this._dispatcher.isQueryActive(queryId)) {
      // Deactivate query in dispatcher
      try {
        this._dispatcher.deactivateQuery(queryId);
        return true;
      } catch (error) {
        this.emit('queryDeactivationFailed', {
          queryId,
          error
        });
      }
    }
    
    return false;
  }

  /**
   * Generate unique subscription ID
   */
  _generateSubscriptionId() {
    return `sub_${Date.now()}_${this._nextSubscriptionId++}`;
  }

  /**
   * String representation
   */
  toString() {
    return `SubscriptionManager(subscriptions=${this._subscriptions.size}, active=${this._activeCount}, queries=${this._querySubscriptions.size})`;
  }
}