/**
 * High-level API for the Incremental LFTJ Engine
 * Provides a user-friendly interface for building and executing incremental queries
 */

import { BatchGraphEngine } from './BatchGraphEngine.js';
import { QueryBuilder } from './QueryBuilder.js';
import { Schema } from './Schema.js';
import { Delta } from './Delta.js';
import { Tuple } from './Tuple.js';
import { Atom, ID, StringAtom, Integer, Float, BooleanAtom, SymbolAtom } from './Atom.js';
import { EnumerableProvider, PointwiseProvider } from './ComputeProvider.js';
import { RelationRegistry } from './RelationRegistry.js';

/**
 * Query handle for managing registered queries
 */
export class QueryHandle {
  constructor(queryId, engine, graph, parentEngine = null) {
    this._queryId = queryId;
    this._engine = engine;
    this._graph = graph;
    this._parentEngine = parentEngine; // Reference to IncrementalLFTJ instance
    this._subscriptions = new Map();
    this._nextSubscriptionId = 1;
    this._isActive = true;
  }

  get id() {
    return this._queryId;
  }

  get isActive() {
    return this._isActive;
  }

  /**
   * Subscribe to query results
   */
  subscribe(callback, options = {}) {
    if (!this._isActive) {
      throw new Error('Cannot subscribe to inactive query');
    }

    const subscriptionId = this._nextSubscriptionId++;
    const subscription = {
      id: subscriptionId,
      callback,
      includeDeltas: options.includeDeltas || false,
      includeStats: options.includeStats || false
    };

    this._subscriptions.set(subscriptionId, subscription);

    // Return unsubscribe function
    return () => {
      this._subscriptions.delete(subscriptionId);
    };
  }

  /**
   * Notify subscribers of results
   */
  _notifySubscribers(results, delta = null, stats = null) {
    for (const subscription of this._subscriptions.values()) {
      const notification = { results };
      
      if (subscription.includeDeltas && delta) {
        notification.delta = delta;
      }
      
      if (subscription.includeStats && stats) {
        notification.stats = stats;
      }

      try {
        subscription.callback(notification);
      } catch (error) {
        console.error(`Subscription ${subscription.id} error:`, error);
      }
    }
  }

  /**
   * Get current results
   */
  getResults() {
    if (!this._isActive) {
      throw new Error('Query is not active');
    }

    return this._engine.getOutputState(this._queryId);
  }

  /**
   * Get query statistics
   */
  getStatistics() {
    if (!this._isActive) {
      throw new Error('Query is not active');
    }

    return this._engine.getStatistics(this._queryId);
  }

  /**
   * Reset query state
   */
  reset() {
    if (!this._isActive) {
      throw new Error('Query is not active');
    }

    this._engine.reset(this._queryId);
  }

  /**
   * Deactivate query
   */
  deactivate() {
    if (this._isActive) {
      this._engine.unregisterGraph(this._queryId);
      this._subscriptions.clear();
      this._isActive = false;
      
      // Remove from parent engine's queries map if available
      if (this._parentEngine && this._parentEngine._queries) {
        this._parentEngine._queries.delete(this._queryId);
      }
    }
  }
}

/**
 * Main API class for Incremental LFTJ
 */
export class IncrementalLFTJ {
  constructor(options = {}) {
    this._engine = new BatchGraphEngine({
      batchSize: options.batchSize || 1000,
      autoFlush: options.autoFlush !== false,
      flushInterval: options.flushInterval || 100,
      batchMode: options.batchMode !== false
    });

    this._queries = new Map();
    this._relations = new Map();
    this._providers = new Map();
    this._globalSubscriptions = new Set();
    
    // Set up global flush callback
    this._engine._batchManager.onFlush((batches) => {
      this._onBatchFlush(batches);
    });

    // Configuration
    this._config = {
      autoRegisterRelations: options.autoRegisterRelations !== false,
      validateSchemas: options.validateSchemas !== false,
      enableStatistics: options.enableStatistics !== false
    };
  }

  /**
   * Define a relation schema
   */
  defineRelation(name, schema) {
    if (this._relations.has(name)) {
      throw new Error(`Relation '${name}' already defined`);
    }

    // Convert schema if needed
    if (!(schema instanceof Schema)) {
      if (Array.isArray(schema)) {
        schema = new Schema(schema);
      } else if (typeof schema === 'object') {
        const specs = Object.entries(schema).map(([name, type]) => ({ name, type }));
        schema = new Schema(specs);
      } else {
        throw new Error('Invalid schema format');
      }
    }

    this._relations.set(name, schema);
    return this;
  }

  /**
   * Register a compute provider
   */
  registerProvider(name, provider) {
    if (this._providers.has(name)) {
      throw new Error(`Provider '${name}' already registered`);
    }

    if (!(provider instanceof EnumerableProvider) && !(provider instanceof PointwiseProvider)) {
      throw new Error('Provider must extend EnumerableProvider or PointwiseProvider');
    }

    this._providers.set(name, provider);
    return this;
  }

  /**
   * Build a query using the fluent API
   */
  query(queryId = null) {
    return new QueryBuilder(queryId);
  }

  /**
   * Register and execute a query
   */
  register(query, options = {}) {
    let queryGraph;
    
    if (query instanceof QueryBuilder) {
      queryGraph = query.build();
    } else if (query.nodes && query.outputs) {
      // Assume it's already a QueryGraph
      queryGraph = query;
    } else {
      throw new Error('Query must be a QueryBuilder or QueryGraph instance');
    }

    const queryId = queryGraph.id;
    
    if (this._queries.has(queryId)) {
      throw new Error(`Query '${queryId}' already registered`);
    }

    // Validate relation schemas if enabled
    if (this._config.validateSchemas) {
      this._validateQuerySchemas(queryGraph);
    }

    // Register with engine
    this._engine.registerGraph(queryGraph);

    // Perform cold start if requested
    if (options.coldStart !== false) {
      this._engine.coldStart(queryId);
    }

    // Create query handle with reference to this engine
    const handle = new QueryHandle(queryId, this._engine, queryGraph, this);
    this._queries.set(queryId, handle);

    return handle;
  }

  /**
   * Insert tuples into a relation
   */
  insert(relationName, tuples) {
    // Check if it's a single tuple (not an array of tuples)
    const isSingleTuple = !Array.isArray(tuples) || 
      (Array.isArray(tuples) && tuples.length > 0 && !Array.isArray(tuples[0]) && !(tuples[0] instanceof Tuple));
    
    if (isSingleTuple && !Array.isArray(tuples)) {
      tuples = [tuples];
    } else if (isSingleTuple && Array.isArray(tuples) && !(tuples[0] instanceof Tuple)) {
      // It's a single tuple represented as an array of values
      tuples = [tuples];
    }

    const tuplesToAdd = this._normalizeTuples(relationName, tuples);
    const delta = new Delta(new Set(tuplesToAdd), new Set());

    return this._applyDelta(relationName, delta);
  }

  /**
   * Delete tuples from a relation
   */
  delete(relationName, tuples) {
    // Check if it's a single tuple (not an array of tuples)
    const isSingleTuple = !Array.isArray(tuples) || 
      (Array.isArray(tuples) && tuples.length > 0 && !Array.isArray(tuples[0]) && !(tuples[0] instanceof Tuple));
    
    if (isSingleTuple && !Array.isArray(tuples)) {
      tuples = [tuples];
    } else if (isSingleTuple && Array.isArray(tuples) && !(tuples[0] instanceof Tuple)) {
      // It's a single tuple represented as an array of values
      tuples = [tuples];
    }

    const tuplesToRemove = this._normalizeTuples(relationName, tuples);
    const delta = new Delta(new Set(), new Set(tuplesToRemove));

    return this._applyDelta(relationName, delta);
  }

  /**
   * Update tuples (delete old, insert new)
   */
  update(relationName, oldTuples, newTuples) {
    // Handle single tuples for oldTuples
    const isOldSingleTuple = !Array.isArray(oldTuples) || 
      (Array.isArray(oldTuples) && oldTuples.length > 0 && !Array.isArray(oldTuples[0]) && !(oldTuples[0] instanceof Tuple));
    
    if (isOldSingleTuple && !Array.isArray(oldTuples)) {
      oldTuples = [oldTuples];
    } else if (isOldSingleTuple && Array.isArray(oldTuples) && !(oldTuples[0] instanceof Tuple)) {
      oldTuples = [oldTuples];
    }

    // Handle single tuples for newTuples
    const isNewSingleTuple = !Array.isArray(newTuples) || 
      (Array.isArray(newTuples) && newTuples.length > 0 && !Array.isArray(newTuples[0]) && !(newTuples[0] instanceof Tuple));
    
    if (isNewSingleTuple && !Array.isArray(newTuples)) {
      newTuples = [newTuples];
    } else if (isNewSingleTuple && Array.isArray(newTuples) && !(newTuples[0] instanceof Tuple)) {
      newTuples = [newTuples];
    }

    const tuplesToRemove = this._normalizeTuples(relationName, oldTuples);
    const tuplesToAdd = this._normalizeTuples(relationName, newTuples);
    const delta = new Delta(new Set(tuplesToAdd), new Set(tuplesToRemove));

    return this._applyDelta(relationName, delta);
  }

  /**
   * Apply a delta to a relation
   */
  applyDelta(relationName, delta) {
    if (!(delta instanceof Delta)) {
      throw new Error('Delta must be a Delta instance');
    }

    return this._applyDelta(relationName, delta);
  }

  /**
   * Begin a transaction
   */
  beginTransaction() {
    this._engine.beginTransaction();
    return this;
  }

  /**
   * End a transaction
   */
  endTransaction() {
    this._engine.endTransaction();
    return this;
  }

  /**
   * Execute function in transaction
   */
  async transaction(fn) {
    return this._engine.executeInTransaction(fn);
  }

  /**
   * Flush all pending batches
   */
  flush() {
    this._engine.flush();
    return this;
  }

  /**
   * Get a registered query
   */
  getQuery(queryId) {
    return this._queries.get(queryId);
  }

  /**
   * List all registered queries
   */
  listQueries() {
    return Array.from(this._queries.keys());
  }

  /**
   * Deactivate a query
   */
  deactivateQuery(queryId) {
    const handle = this._queries.get(queryId);
    if (handle) {
      handle.deactivate();
      this._queries.delete(queryId);
    }
  }

  /**
   * Subscribe to global events
   */
  onUpdate(callback) {
    this._globalSubscriptions.add(callback);
    
    return () => {
      this._globalSubscriptions.delete(callback);
    };
  }

  /**
   * Get engine statistics
   */
  getStatistics() {
    return {
      queries: this._queries.size,
      relations: this._relations.size,
      providers: this._providers.size,
      batch: this._engine.getBatchStatistics()
    };
  }

  /**
   * Reset engine state
   */
  reset() {
    for (const handle of this._queries.values()) {
      handle.deactivate();
    }
    this._queries.clear();
    this._engine.destroy();
  }

  /**
   * Create atom from value
   */
  static atom(value, type = null) {
    if (type) {
      switch (type) {
        case 'ID': return new ID(value);
        case 'String': return new StringAtom(value);
        case 'Integer': return new Integer(value);
        case 'Float': return new Float(value);
        case 'Boolean': return new BooleanAtom(value);
        case 'Symbol': return new SymbolAtom(value);
        default: throw new Error(`Unknown atom type: ${type}`);
      }
    }

    // Auto-detect type
    if (typeof value === 'string') {
      return new StringAtom(value);
    } else if (typeof value === 'number') {
      return Number.isInteger(value) ? new Integer(value) : new Float(value);
    } else if (typeof value === 'boolean') {
      return new BooleanAtom(value);
    } else if (typeof value === 'symbol') {
      return new SymbolAtom(value.toString());
    } else {
      return new ID(String(value));
    }
  }

  /**
   * Create tuple from values
   */
  static tuple(values) {
    const atoms = values.map(v => {
      if (v instanceof Atom) {
        return v;
      }
      return IncrementalLFTJ.atom(v);
    });
    return new Tuple(atoms);
  }

  // Private methods

  /**
   * Validate query schemas
   */
  _validateQuerySchemas(graph) {
    for (const node of graph.nodes) {
      if (node.type === 'scan' && node.config.relationName) {
        const relationName = node.config.relationName;
        if (!this._relations.has(relationName)) {
          if (this._config.autoRegisterRelations && node.config.schema) {
            this._relations.set(relationName, node.config.schema);
          } else {
            throw new Error(`Relation '${relationName}' not defined`);
          }
        }
      }
    }
  }

  /**
   * Normalize tuples
   */
  _normalizeTuples(relationName, tuples) {
    const schema = this._relations.get(relationName);
    
    // Check if relation exists
    if (!schema && !this._config.autoRegisterRelations) {
      throw new Error(`Relation '${relationName}' not defined`);
    }
    
    return tuples.map(tuple => {
      if (tuple instanceof Tuple) {
        if (schema && this._config.validateSchemas) {
          schema.validateTuple(tuple.atoms.map(a => a.toString()));
        }
        return tuple;
      }

      // Convert array to tuple
      if (Array.isArray(tuple)) {
        return IncrementalLFTJ.tuple(tuple);
      }

      // Convert object to tuple based on schema
      if (typeof tuple === 'object' && schema) {
        const values = schema.variables.map(varName => tuple[varName]);
        return IncrementalLFTJ.tuple(values);
      }

      throw new Error('Invalid tuple format');
    });
  }

  /**
   * Apply delta to all relevant queries
   */
  _applyDelta(relationName, delta) {
    const results = new Map();

    for (const [queryId, handle] of this._queries) {
      if (!handle.isActive) continue;

      // Check if query uses this relation
      const graph = this._engine.getGraph(queryId);
      const usesRelation = graph.nodes.some(n => 
        n.type === 'scan' && n.config.relationName === relationName
      );

      if (usesRelation) {
        const queryResults = this._engine.processUpdate(queryId, relationName, delta);
        results.set(queryId, queryResults);

        // Notify subscribers
        const stats = this._config.enableStatistics ? 
          this._engine.getStatistics(queryId) : null;
        handle._notifySubscribers(queryResults, delta, stats);
      }
    }

    // Notify global subscribers
    for (const callback of this._globalSubscriptions) {
      try {
        callback({ relationName, delta, affectedQueries: Array.from(results.keys()) });
      } catch (error) {
        console.error('Global subscription error:', error);
      }
    }

    return results;
  }

  /**
   * Handle batch flush events
   */
  _onBatchFlush(batches) {
    // Group by query and notify
    const batchesByQuery = new Map();
    
    for (const batch of batches) {
      if (!batchesByQuery.has(batch.graphId)) {
        batchesByQuery.set(batch.graphId, []);
      }
      batchesByQuery.get(batch.graphId).push(batch);
    }

    for (const [queryId, queryBatches] of batchesByQuery) {
      const handle = this._queries.get(queryId);
      if (handle && handle.isActive) {
        const results = this._engine.getOutputState(queryId);
        const stats = this._config.enableStatistics ? 
          this._engine.getStatistics(queryId) : null;
        
        // Aggregate deltas from batches
        let aggregatedDelta = null;
        if (queryBatches.length > 0) {
          const allAdds = new Set();
          const allRemoves = new Set();
          
          for (const batch of queryBatches) {
            if (batch.delta) {
              for (const tuple of batch.delta.adds) {
                allAdds.add(tuple);
              }
              for (const tuple of batch.delta.removes) {
                allRemoves.add(tuple);
              }
            }
          }
          
          if (allAdds.size > 0 || allRemoves.size > 0) {
            aggregatedDelta = new Delta(allAdds, allRemoves);
          }
        }
        
        handle._notifySubscribers(results, aggregatedDelta, stats);
      }
    }
  }
}

// Re-export commonly used classes
export { 
  QueryBuilder, 
  Schema, 
  Delta, 
  Tuple,
  ID, 
  StringAtom, 
  Integer, 
  Float, 
  BooleanAtom, 
  SymbolAtom,
  EnumerableProvider,
  PointwiseProvider
};