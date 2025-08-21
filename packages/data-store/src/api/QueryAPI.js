/**
 * QueryAPI - Client-facing query interface
 * Per design §15.3: Query API (Client → Host)
 * 
 * Provides high-level interface for clients to:
 * - Submit path queries with predicates
 * - Manage subscriptions 
 * - Receive live query results
 */

import { EventEmitter } from 'events';
import { PathQuery } from '../query/PathQuery.js';
import { GraphSpecBuilder } from '../query/GraphSpecBuilder.js';

/**
 * QueryAPI for client interactions
 * Per design: submitPathQuery, unsubscribe, onChange streaming
 */
export class QueryAPI extends EventEmitter {
  constructor(store, dispatcher, subscriptionManager, queryCompiler) {
    super();
    
    if (!store) {
      throw new Error('Store is required');
    }
    if (!dispatcher) {
      throw new Error('Dispatcher is required');
    }
    if (!subscriptionManager) {
      throw new Error('SubscriptionManager is required');
    }
    if (!queryCompiler) {
      throw new Error('QueryCompiler is required');
    }
    
    this._store = store;
    this._dispatcher = dispatcher;
    this._subscriptionManager = subscriptionManager;
    this._queryCompiler = queryCompiler;
    this._nextQueryId = 1;
    this._queryCache = new Map(); // querySpec -> queryId mapping
    this._subscriptionQueries = new Map(); // subscriptionId -> queryId
    
    // Setup event forwarding
    this._setupEventForwarding();
  }

  /**
   * Submit path query and return subscription ID
   * Per design: submitPathQuery(spec, projection) → subscriptionId
   */
  submitPathQuery(spec, projection, options = {}) {
    if (!spec) {
      throw new Error('Query spec is required');
    }
    if (!projection) {
      throw new Error('Projection is required');
    }
    
    try {
      // Normalize query spec
      const normalizedSpec = this._normalizeQuerySpec(spec);
      const queryKey = this._getQueryKey(normalizedSpec, projection, options);
      
      // Check cache for existing query
      let queryId = this._queryCache.get(queryKey);
      
      if (!queryId) {
        // Compile new query
        queryId = this._generateQueryId();
        const graphSpec = this._compilePathQuery(normalizedSpec, projection, queryId);
        
        // Register with dispatcher
        this._dispatcher.registerQuery(queryId, graphSpec);
        
        // Cache the query
        this._queryCache.set(queryKey, queryId);
      }
      
      // Create subscription
      const subscription = this._subscriptionManager.subscribe(
        queryId,
        (payload) => this._handleQueryResult(payload, subscription.subscriptionId),
        {
          filter: options.filter,
          transform: options.transform,
          metadata: { 
            querySpec: normalizedSpec,
            projection: projection,
            ...options.metadata
          }
        }
      );
      
      // Track subscription -> query mapping
      this._subscriptionQueries.set(subscription.subscriptionId, queryId);
      
      // Emit subscription created event
      this.emit('subscriptionCreated', {
        subscriptionId: subscription.subscriptionId,
        queryId: queryId,
        spec: normalizedSpec,
        projection: projection
      });
      
      return subscription.subscriptionId;
      
    } catch (error) {
      this.emit('queryError', {
        error: error,
        spec: spec,
        projection: projection
      });
      throw error;
    }
  }

  /**
   * Unsubscribe from query
   * Per design: unsubscribe(subscriptionId)
   */
  unsubscribe(subscriptionId) {
    if (!subscriptionId) {
      throw new Error('Subscription ID is required');
    }
    
    const queryId = this._subscriptionQueries.get(subscriptionId);
    
    // Remove subscription
    const result = this._subscriptionManager.unsubscribe(subscriptionId);
    
    if (result) {
      // Clean up tracking
      this._subscriptionQueries.delete(subscriptionId);
      
      // Check if query can be garbage collected
      if (queryId) {
        this._maybeGarbageCollectQuery(queryId);
      }
      
      this.emit('subscriptionRemoved', {
        subscriptionId: subscriptionId,
        queryId: queryId
      });
    }
    
    return result;
  }

  /**
   * Get change stream for subscription
   * Per design: onChange(subscriptionId) → stream of {adds, removes}
   */
  onChange(subscriptionId) {
    if (!subscriptionId) {
      throw new Error('Subscription ID is required');
    }
    
    const subscription = this._subscriptionManager.getSubscription(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription ${subscriptionId} not found`);
    }
    
    // Return event emitter for this subscription's changes
    const changeStream = new EventEmitter();
    
    // Forward subscription events to change stream
    const handleUpdate = (payload) => {
      if (payload.type === 'bootstrap') {
        changeStream.emit('data', {
          type: 'bootstrap',
          adds: payload.results,
          removes: [],
          timestamp: payload.timestamp
        });
      } else if (payload.type === 'update') {
        const adds = payload.update.type === 'add' ? [payload.update.data] : [];
        const removes = payload.update.type === 'remove' ? [payload.update.data] : [];
        const modifies = payload.update.type === 'modify' ? 
          { removes: [payload.update.oldData], adds: [payload.update.newData] } : null;
        
        changeStream.emit('data', {
          type: 'update',
          adds: modifies ? modifies.adds : adds,
          removes: modifies ? modifies.removes : removes,
          timestamp: payload.timestamp
        });
      } else if (payload.type === 'batch_update') {
        const adds = [];
        const removes = [];
        
        payload.updates.forEach(update => {
          if (update.type === 'add') adds.push(update.data);
          else if (update.type === 'remove') removes.push(update.data);
          else if (update.type === 'modify') {
            removes.push(update.oldData);
            adds.push(update.newData);
          }
        });
        
        changeStream.emit('data', {
          type: 'batch_update',
          adds: adds,
          removes: removes,
          timestamp: payload.timestamp
        });
      } else if (payload.type === 'error') {
        changeStream.emit('error', payload.error);
      }
    };
    
    subscription.on('update', handleUpdate);
    
    // Cleanup when stream is closed
    changeStream.on('close', () => {
      subscription.off('update', handleUpdate);
    });
    
    return changeStream;
  }

  /**
   * Get subscription information
   */
  getSubscription(subscriptionId) {
    const subscription = this._subscriptionManager.getSubscription(subscriptionId);
    if (!subscription) {
      return null;
    }
    
    const queryId = this._subscriptionQueries.get(subscriptionId);
    const metadata = subscription.getMetadata();
    
    return {
      subscriptionId: subscription.subscriptionId,
      queryId: queryId,
      state: subscription.state,
      querySpec: metadata.querySpec,
      projection: metadata.projection,
      isActive: subscription.isActive(),
      stats: subscription.getStats()
    };
  }

  /**
   * List all active subscriptions
   */
  getActiveSubscriptions() {
    return this._subscriptionManager.getActiveSubscriptions()
      .map(sub => this.getSubscription(sub.subscriptionId))
      .filter(info => info !== null);
  }

  /**
   * Pause subscription
   */
  pauseSubscription(subscriptionId) {
    return this._subscriptionManager.pauseSubscription(subscriptionId);
  }

  /**
   * Resume subscription
   */
  resumeSubscription(subscriptionId) {
    return this._subscriptionManager.resumeSubscription(subscriptionId);
  }

  /**
   * Get API statistics
   */
  getStats() {
    const subscriptionStats = this._subscriptionManager.getStats();
    
    return {
      ...subscriptionStats,
      cachedQueries: this._queryCache.size,
      activeQueries: this._getActiveQueryCount()
    };
  }

  /**
   * Clear all subscriptions and queries
   */
  clear() {
    // Clear all subscriptions
    this._subscriptionManager.clear();
    
    // Clear tracking maps
    this._subscriptionQueries.clear();
    this._queryCache.clear();
    
    this.emit('cleared');
  }

  /**
   * Normalize query specification
   */
  _normalizeQuerySpec(spec) {
    // Basic validation and normalization
    if (typeof spec === 'string') {
      // Simple string query - convert to object
      return { path: spec };
    }
    
    if (typeof spec === 'object' && spec !== null) {
      // Copy to avoid mutation
      const normalized = { ...spec };
      
      // Ensure required fields
      if (!normalized.path && !normalized.steps && !normalized.relation) {
        throw new Error('Query spec must have path, steps, or relation');
      }
      
      return normalized;
    }
    
    throw new Error('Query spec must be a string or object');
  }

  /**
   * Generate cache key for query
   */
  _getQueryKey(spec, projection, options = {}) {
    // Include filter and transform in cache key since they affect query behavior
    const cacheKey = { 
      spec, 
      projection,
      hasFilter: !!options.filter,
      hasTransform: !!options.transform
    };
    return JSON.stringify(cacheKey);
  }

  /**
   * Compile path query to GraphSpec
   */
  _compilePathQuery(spec, projection, queryId) {
    // Use existing query compiler infrastructure
    try {
      return this._queryCompiler.compilePathQuery(spec, projection, queryId);
    } catch (error) {
      // Fallback for simple queries
      return this._compileSimpleQuery(spec, projection, queryId);
    }
  }

  /**
   * Fallback compiler for simple queries
   */
  _compileSimpleQuery(spec, projection, queryId) {
    // Simple select query fallback
    if (spec.relation || (spec.path && typeof spec.path === 'string')) {
      const relation = spec.relation || spec.path;
      
      return {
        type: 'select',
        relation: relation,
        constraints: spec.constraints || [],
        projection: projection
      };
    }
    
    throw new Error('Cannot compile query spec to GraphSpec');
  }

  /**
   * Handle query result from subscription
   */
  _handleQueryResult(payload, subscriptionId) {
    // Forward to onChange listeners via events
    this.emit('queryResult', {
      subscriptionId: subscriptionId,
      payload: payload
    });
  }

  /**
   * Maybe garbage collect unused query
   */
  _maybeGarbageCollectQuery(queryId) {
    // Check if query has any active subscriptions
    const subscriptions = this._subscriptionManager.getQuerySubscriptions(queryId);
    
    if (subscriptions.length === 0) {
      // No subscriptions left, can deactivate query
      if (this._dispatcher.isQueryActive(queryId)) {
        this._dispatcher.deactivateQuery(queryId);
      }
      
      // Remove from cache
      for (const [key, id] of this._queryCache.entries()) {
        if (id === queryId) {
          this._queryCache.delete(key);
          break;
        }
      }
      
      this.emit('queryGarbageCollected', { queryId });
    }
  }

  /**
   * Generate unique query ID
   */
  _generateQueryId() {
    return `query_${Date.now()}_${this._nextQueryId++}`;
  }

  /**
   * Count active queries
   */
  _getActiveQueryCount() {
    let count = 0;
    for (const queryId of this._queryCache.values()) {
      if (this._dispatcher.isQueryActive(queryId)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Setup event forwarding from subscription manager
   */
  _setupEventForwarding() {
    // Forward subscription manager events
    this._subscriptionManager.on('subscriptionError', (event) => {
      this.emit('subscriptionError', event);
    });
    
    this._subscriptionManager.on('resultsDelivered', (event) => {
      this.emit('resultsDelivered', event);
    });
    
    this._subscriptionManager.on('updateDelivered', (event) => {
      this.emit('updateDelivered', event);
    });
  }

  /**
   * String representation
   */
  toString() {
    const stats = this.getStats();
    return `QueryAPI(subscriptions=${stats.totalSubscriptions}, queries=${stats.cachedQueries})`;
  }
}