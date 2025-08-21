/**
 * Dispatcher for coordinating between store and LFTJ kernel
 * Per design §3: Dispatcher Implementation for incremental query processing
 * 
 * The Dispatcher manages delta propagation from the store to the kernel,
 * coordinates operator DAG execution, and handles subscription management
 * for reactive query processing.
 */

import { EventEmitter } from 'events';

/**
 * Dispatcher coordinates between Store/TrieManager and LFTJ kernel
 * Per design §3.1: Core dispatcher for incremental query processing
 */
export class Dispatcher extends EventEmitter {
  constructor(store, trieManager) {
    super();
    
    if (!store) {
      throw new Error('Store is required');
    }
    if (!trieManager) {
      throw new Error('TrieManager is required');
    }
    
    this._store = store;
    this._trieManager = trieManager;
    this._subscriptions = new Map(); // queryId -> subscription
    this._deltaQueue = []; // Queue of pending deltas
    this._operatorDAG = new Map(); // queryId -> operator graph
    this._isProcessing = false;
    this._processingPromise = null;
  }

  /**
   * Get the store instance
   */
  get store() {
    return this._store;
  }

  /**
   * Get the trie manager instance
   */
  get trieManager() {
    return this._trieManager;
  }

  /**
   * Register a query and create its operator DAG
   * Per design: Queries are compiled into operator DAGs for execution
   */
  registerQuery(queryId, querySpec) {
    if (!queryId) {
      throw new Error('Query ID is required');
    }
    if (!querySpec) {
      throw new Error('Query specification is required');
    }
    if (this._subscriptions.has(queryId)) {
      throw new Error(`Query '${queryId}' is already registered`);
    }

    // Create subscription record
    const subscription = {
      queryId,
      querySpec,
      isActive: false,
      lastResults: new Set(),
      operators: []
    };

    this._subscriptions.set(queryId, subscription);
    
    // Compile query into operator DAG
    this._compileQuery(queryId, querySpec);
    
    this.emit('queryRegistered', { queryId, querySpec });
    
    return subscription;
  }

  /**
   * Unregister a query and clean up its resources
   */
  unregisterQuery(queryId) {
    if (!this._subscriptions.has(queryId)) {
      return false;
    }

    const subscription = this._subscriptions.get(queryId);
    subscription.isActive = false;
    
    this._subscriptions.delete(queryId);
    this._operatorDAG.delete(queryId);
    
    this.emit('queryUnregistered', { queryId });
    
    return true;
  }

  /**
   * Activate a query for incremental processing
   */
  activateQuery(queryId) {
    const subscription = this._subscriptions.get(queryId);
    if (!subscription) {
      throw new Error(`Query '${queryId}' not found`);
    }

    subscription.isActive = true;
    
    // Perform initial query execution
    this._executeQuery(queryId);
    
    this.emit('queryActivated', { queryId });
  }

  /**
   * Deactivate a query (stop incremental processing)
   */
  deactivateQuery(queryId) {
    const subscription = this._subscriptions.get(queryId);
    if (!subscription) {
      throw new Error(`Query '${queryId}' not found`);
    }

    subscription.isActive = false;
    this.emit('queryDeactivated', { queryId });
  }

  /**
   * Process a delta (edge addition/removal)
   * Per design: Deltas trigger incremental updates to active queries
   */
  processDelta(delta) {
    if (!delta) {
      throw new Error('Delta is required');
    }

    // Validate delta structure
    this._validateDelta(delta);

    // Add to delta queue
    this._deltaQueue.push({
      ...delta,
      timestamp: Date.now(),
      processed: false
    });

    // Start processing if not already running
    this._scheduleProcessing();
  }

  /**
   * Process multiple deltas in batch
   */
  processDeltas(deltas) {
    if (!Array.isArray(deltas)) {
      throw new Error('Deltas must be an array');
    }

    deltas.forEach(delta => this.processDelta(delta));
  }

  /**
   * Get current query results
   */
  getQueryResults(queryId) {
    const subscription = this._subscriptions.get(queryId);
    if (!subscription) {
      throw new Error(`Query '${queryId}' not found`);
    }

    return Array.from(subscription.lastResults);
  }

  /**
   * Check if query is registered
   */
  hasQuery(queryId) {
    return this._subscriptions.has(queryId);
  }

  /**
   * Check if query is active
   */
  isQueryActive(queryId) {
    const subscription = this._subscriptions.get(queryId);
    return subscription ? subscription.isActive : false;
  }

  /**
   * Get all registered query IDs
   */
  getQueryIds() {
    return Array.from(this._subscriptions.keys());
  }

  /**
   * Get number of pending deltas
   */
  getPendingDeltaCount() {
    return this._deltaQueue.filter(d => !d.processed).length;
  }

  /**
   * Check if dispatcher is currently processing
   */
  isProcessing() {
    return this._isProcessing;
  }

  /**
   * Wait for current processing to complete
   */
  async waitForProcessing() {
    if (this._processingPromise) {
      await this._processingPromise;
    }
  }

  /**
   * Clear all pending deltas
   */
  clearDeltas() {
    this._deltaQueue = [];
    this.emit('deltasCleared');
  }

  /**
   * Get dispatcher statistics
   */
  getStatistics() {
    const activeQueries = Array.from(this._subscriptions.values())
      .filter(s => s.isActive).length;
    
    const pendingDeltas = this.getPendingDeltaCount();
    const processedDeltas = this._deltaQueue.filter(d => d.processed).length;

    return {
      totalQueries: this._subscriptions.size,
      activeQueries,
      pendingDeltas,
      processedDeltas,
      totalDeltas: this._deltaQueue.length,
      isProcessing: this._isProcessing
    };
  }

  /**
   * Reset dispatcher state
   */
  reset() {
    this._subscriptions.clear();
    this._deltaQueue = [];
    this._operatorDAG.clear();
    this._isProcessing = false;
    this._processingPromise = null;
    
    this.emit('reset');
  }

  /**
   * Compile query specification into operator DAG
   * Per design: Query compilation creates executable operator graph
   */
  _compileQuery(queryId, querySpec) {
    // Basic query compilation - will be expanded in later phases
    const operators = [];
    
    // For now, create placeholder operators based on query type
    if (querySpec.type === 'join') {
      operators.push({
        type: 'leapfrog-join',
        relations: querySpec.relations || [],
        variables: querySpec.variables || []
      });
    } else if (querySpec.type === 'select') {
      operators.push({
        type: 'selection',
        relation: querySpec.relation,
        constraints: querySpec.constraints || []
      });
    }

    this._operatorDAG.set(queryId, operators);
    
    // Update subscription with operators
    const subscription = this._subscriptions.get(queryId);
    subscription.operators = operators;
  }

  /**
   * Execute a query and update results
   */
  _executeQuery(queryId) {
    const subscription = this._subscriptions.get(queryId);
    if (!subscription || !subscription.isActive) {
      return;
    }

    // Basic query execution - will be expanded in later phases
    const results = new Set();
    
    // For simple selection queries, use store directly
    if (subscription.querySpec.type === 'select') {
      const edges = this._store.getEdgesByType(subscription.querySpec.relation);
      edges.forEach(edge => {
        if (this._matchesConstraints(edge, subscription.querySpec.constraints || [])) {
          results.add(edge);
        }
      });
    }

    // Update results and emit if changed
    const oldResults = subscription.lastResults;
    subscription.lastResults = results;
    
    if (!this._setsEqual(oldResults, results)) {
      this.emit('queryResultsChanged', {
        queryId,
        results: Array.from(results),
        oldResults: Array.from(oldResults)
      });
    }
  }

  /**
   * Check if edge matches query constraints
   */
  _matchesConstraints(edge, constraints) {
    return constraints.every(constraint => {
      const { field, operator, value } = constraint;
      const edgeValue = edge[field];
      
      switch (operator) {
        case '=':
        case 'eq':
          return edgeValue === value;
        case '!=':
        case 'ne':
          return edgeValue !== value;
        default:
          return true;
      }
    });
  }

  /**
   * Check if two sets are equal
   */
  _setsEqual(set1, set2) {
    if (set1.size !== set2.size) {
      return false;
    }
    
    for (const item of set1) {
      if (!set2.has(item)) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Validate delta structure
   */
  _validateDelta(delta) {
    if (!delta.type) {
      throw new Error('Delta must have type (add/remove)');
    }
    if (delta.type !== 'add' && delta.type !== 'remove') {
      throw new Error('Delta type must be "add" or "remove"');
    }
    if (!delta.edge) {
      throw new Error('Delta must have edge');
    }
    if (!delta.edge.type || delta.edge.src === undefined || delta.edge.dst === undefined) {
      throw new Error('Delta edge must have type, src, and dst');
    }
  }

  /**
   * Schedule delta processing
   */
  _scheduleProcessing() {
    if (this._isProcessing) {
      return; // Already processing
    }

    // Start processing immediately but asynchronously
    this._processingPromise = this._processDeltas();
  }

  /**
   * Process all pending deltas
   */
  async _processDeltas() {
    if (this._isProcessing) {
      return;
    }

    this._isProcessing = true;
    this.emit('processingStarted');

    try {
      // Keep processing until no more pending deltas
      while (true) {
        const pendingDeltas = this._deltaQueue.filter(d => !d.processed);
        
        if (pendingDeltas.length === 0) {
          break; // No more deltas to process
        }
        
        for (const delta of pendingDeltas) {
          await this._processSingleDelta(delta);
          delta.processed = true;
        }
      }

      // Clean up old processed deltas (keep last 100)
      if (this._deltaQueue.length > 100) {
        this._deltaQueue = this._deltaQueue.slice(-100);
      }

    } finally {
      this._isProcessing = false;
      this._processingPromise = null;
      this.emit('processingCompleted');
    }
  }

  /**
   * Process a single delta
   */
  async _processSingleDelta(delta) {
    this.emit('deltaProcessing', { delta });

    // Apply delta to store first (only if relation type exists)
    let deltaApplied = false;
    
    if (delta.type === 'add') {
      if (this._store.hasRelationType(delta.edge.type)) {
        this._store.addEdge(delta.edge);
        deltaApplied = true;
      }
      // Only insert to trie manager if the relation type is registered
      if (this._trieManager.hasRelationType(delta.edge.type)) {
        this._trieManager.insertEdge(delta.edge.type, delta.edge);
      }
    } else if (delta.type === 'remove') {
      if (this._store.hasRelationType(delta.edge.type)) {
        this._store.removeEdge(delta.edge);
        deltaApplied = true;
      }
      // Only remove from trie manager if the relation type is registered
      if (this._trieManager.hasRelationType(delta.edge.type)) {
        this._trieManager.removeEdge(delta.edge.type, delta.edge);
      }
    }

    // Only process queries if delta was actually applied
    if (!deltaApplied) {
      this.emit('deltaProcessed', { delta });
      return;
    }

    // Apply delta to affected queries
    for (const [queryId, subscription] of this._subscriptions) {
      if (!subscription.isActive) {
        continue;
      }

      // Check if delta affects this query
      if (this._deltaAffectsQuery(delta, subscription.querySpec)) {
        // Re-execute query incrementally
        this._executeQuery(queryId);
      }
    }

    this.emit('deltaProcessed', { delta });
  }

  /**
   * Check if a delta affects a specific query
   */
  _deltaAffectsQuery(delta, querySpec) {
    // Simple heuristic: delta affects query if edge type matches
    if (querySpec.type === 'select' && querySpec.relation === delta.edge.type) {
      return true;
    }
    
    if (querySpec.type === 'join' && querySpec.relations?.includes(delta.edge.type)) {
      return true;
    }

    return false;
  }

  /**
   * String representation for debugging
   */
  toString() {
    const stats = this.getStatistics();
    return `Dispatcher(queries=${stats.totalQueries}, active=${stats.activeQueries}, pending=${stats.pendingDeltas})`;
  }
}