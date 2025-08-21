/**
 * DataStore - Main integration class
 * Per design §15.1: Store I/O Integration - complete kernel integration
 * 
 * DataStore integrates all components into a unified system:
 * - Store model for binary relationships
 * - Trie infrastructure for indexing  
 * - Dispatcher for delta processing
 * - Query compilation pipeline
 * - Subscription management
 * - Client-facing QueryAPI
 */

import { EventEmitter } from 'events';
import { Store } from './Store.js';
import { TrieManager } from './trie/TrieManager.js';
import { Dispatcher } from './kernel/Dispatcher.js';
import { SubscriptionManager } from './subscription/SubscriptionManager.js';
import { GraphSpecBuilder } from './query/GraphSpecBuilder.js';
import { QueryAPI } from './api/QueryAPI.js';
import { Edge } from './Edge.js';

/**
 * Main DataStore class integrating all components
 * Per design: complete integration with kernel batch processing
 */
export class DataStore extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this._options = {
      enableKernel: false, // Start with simple mode, upgrade to kernel later
      batchSize: 100,
      ...options
    };
    
    // Initialize core components
    this._store = new Store();
    this._trieManager = new TrieManager();
    this._dispatcher = new Dispatcher(this._store, this._trieManager);
    this._subscriptionManager = new SubscriptionManager(this._dispatcher);
    this._queryCompiler = new GraphSpecBuilder();
    this._queryAPI = new QueryAPI(
      this._store, 
      this._dispatcher, 
      this._subscriptionManager, 
      this._queryCompiler
    );
    
    // State tracking
    this._relations = new Map(); // relationName -> schema
    this._activeGraphs = new Map(); // graphId -> graphSpec
    this._writeBuffer = []; // Buffered writes for batching
    this._isInitialized = false;
    
    // Setup event forwarding
    this._setupEventForwarding();
    
    // Initialize the system
    this.initialize();
  }

  /**
   * Initialize the DataStore system
   */
  async initialize() {
    if (this._isInitialized) {
      return;
    }
    
    try {
      // Setup store listeners for write events
      this._setupStoreListeners();
      
      // Setup dispatcher for delta processing
      this._setupDispatcherIntegration();
      
      // Initialize kernel integration if enabled
      if (this._options.enableKernel) {
        await this._initializeKernelIntegration();
      }
      
      this._isInitialized = true;
      this.emit('initialized');
      
    } catch (error) {
      this.emit('initializationError', error);
      throw error;
    }
  }

  /**
   * Define a relationship type
   * Per design: binary relationships with forward/backward attributes
   */
  defineRelationType(forwardName, backwardName, schema = {}) {
    if (!forwardName) {
      throw new Error('Forward name is required');
    }
    if (!backwardName) {
      throw new Error('Backward name is required');
    }
    
    // Define in the store
    this._store.defineRelationType(forwardName, backwardName);
    
    // Register relation schema for kernel integration
    this._relations.set(forwardName, {
      forwardName,
      backwardName,
      schema: {
        arity: 2, // Binary relationships
        types: ['any', 'any'], // Default to any types
        ...schema
      }
    });
    
    // Also register the backward relation
    this._relations.set(backwardName, {
      forwardName: backwardName,
      backwardName: forwardName,
      schema: {
        arity: 2,
        types: ['any', 'any'], // Swapped types
        ...schema
      }
    });
    
    this.emit('relationDefined', {
      forwardName,
      backwardName,
      schema
    });
    
    return this;
  }

  /**
   * Add an edge (write operation)
   * Per design: writes surface as batches of deltas
   */
  addEdge(type, src, dst, metadata = {}) {
    if (typeof type === 'object' && type instanceof Edge) {
      // Handle Edge instance
      const edge = type;
      return this._addEdgeInstance(edge);
    }
    
    // Create edge from parameters
    const edge = new Edge(type, src, dst);
    
    // Store metadata separately if needed (Edge instances are immutable)
    if (Object.keys(metadata).length > 0) {
      // For now, we'll store metadata in a separate map
      // This could be extended to support metadata in the future
      this._edgeMetadata = this._edgeMetadata || new Map();
      const edgeKey = `${type}:${JSON.stringify(src)}:${JSON.stringify(dst)}`;
      this._edgeMetadata.set(edgeKey, metadata);
    }
    
    return this._addEdgeInstance(edge);
  }

  /**
   * Remove an edge
   */
  removeEdge(type, src, dst) {
    if (typeof type === 'object' && type instanceof Edge) {
      const edge = type;
      return this._removeEdgeInstance(edge);
    }
    
    const edge = new Edge(type, src, dst);
    return this._removeEdgeInstance(edge);
  }

  /**
   * Submit a query and get subscription
   * Per design §15.3: submitPathQuery(spec, projection) → subscriptionId
   */
  submitQuery(spec, projection, options = {}) {
    return this._queryAPI.submitPathQuery(spec, projection, options);
  }

  /**
   * Unsubscribe from query
   * Per design §15.3: unsubscribe(subscriptionId)
   */
  unsubscribe(subscriptionId) {
    return this._queryAPI.unsubscribe(subscriptionId);
  }

  /**
   * Get change stream for subscription
   * Per design §15.3: onChange(subscriptionId) → stream of {adds, removes}
   */
  onChange(subscriptionId) {
    return this._queryAPI.onChange(subscriptionId);
  }

  /**
   * Get all edges of a specific type
   */
  getEdges(type, constraints = []) {
    let edges = this._store.getEdgesByType(type);
    
    // Apply constraints if provided
    if (constraints.length > 0) {
      edges = edges.filter(edge => {
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
            case '>':
            case 'gt':
              return edgeValue > value;
            case '<':
            case 'lt':
              return edgeValue < value;
            case '>=':
            case 'gte':
              return edgeValue >= value;
            case '<=':
            case 'lte':
              return edgeValue <= value;
            default:
              return true; // Unknown operator, skip constraint
          }
        });
      });
    }
    
    return edges;
  }

  /**
   * Get subscription information
   */
  getSubscription(subscriptionId) {
    return this._queryAPI.getSubscription(subscriptionId);
  }

  /**
   * Get all active subscriptions
   */
  getActiveSubscriptions() {
    return this._queryAPI.getActiveSubscriptions();
  }

  /**
   * Get DataStore statistics
   */
  getStats() {
    const storeStats = {
      edges: this._store.getEdgeCount(),
      relationTypes: this._store.getTypeCount(),
      relations: this._relations.size
    };
    
    const dispatcherStats = this._dispatcher.getStatistics();
    const queryAPIStats = this._queryAPI.getStats();
    
    return {
      store: storeStats,
      dispatcher: dispatcherStats,
      queryAPI: queryAPIStats,
      writeBuffer: this._writeBuffer.length,
      activeGraphs: this._activeGraphs.size,
      initialized: this._isInitialized,
      kernelEnabled: this._options.enableKernel
    };
  }

  /**
   * Flush any pending writes
   */
  async flush() {
    if (this._writeBuffer.length === 0) {
      return;
    }
    
    const batch = this._writeBuffer.splice(0);
    await this._processBatch(batch);
    
    this.emit('flushed', { batchSize: batch.length });
  }

  /**
   * Clear all data and subscriptions
   */
  async clear() {
    // Clear subscriptions first
    this._queryAPI.clear();
    
    // Clear dispatcher state
    this._dispatcher.clearDeltas();
    
    // Clear store data
    this._store.reset();
    
    // Clear internal state
    this._relations.clear();
    this._activeGraphs.clear();
    this._writeBuffer = [];
    
    this.emit('cleared');
  }

  /**
   * Close the DataStore and cleanup resources
   */
  async close() {
    try {
      // Flush any pending writes
      await this.flush();
      
      // Clear all data
      await this.clear();
      
      this._isInitialized = false;
      this.emit('closed');
      
    } catch (error) {
      this.emit('closeError', error);
      throw error;
    }
  }

  // === KERNEL INTEGRATION ===

  /**
   * Define a kernel relation
   * Per design §15.1: defineRelation(name, schema)
   */
  defineKernelRelation(name, schema) {
    if (!this._options.enableKernel) {
      throw new Error('Kernel integration not enabled');
    }
    
    // This would integrate with the actual LFTJ kernel
    // For now, just track the relation
    this._relations.set(name, schema);
    
    this.emit('kernelRelationDefined', { name, schema });
    return this;
  }

  /**
   * Define a kernel graph
   * Per design §15.1: defineGraph(graphId, graphSpec)
   */
  defineKernelGraph(graphId, graphSpec) {
    if (!this._options.enableKernel) {
      throw new Error('Kernel integration not enabled');
    }
    
    this._activeGraphs.set(graphId, graphSpec);
    
    this.emit('kernelGraphDefined', { graphId, graphSpec });
    return this;
  }

  /**
   * Activate a kernel graph
   * Per design §15.1: activateGraph(graphId)
   */
  activateKernelGraph(graphId) {
    if (!this._options.enableKernel) {
      throw new Error('Kernel integration not enabled');
    }
    
    const graphSpec = this._activeGraphs.get(graphId);
    if (!graphSpec) {
      throw new Error(`Graph ${graphId} not defined`);
    }
    
    // This would call the actual kernel
    this.emit('kernelGraphActivated', { graphId, graphSpec });
    return this;
  }

  /**
   * Push batch to kernel
   * Per design §15.1: pushBatch({ relName → Δ }) → { outputName → Δ }
   */
  async pushBatchToKernel(batch) {
    if (!this._options.enableKernel) {
      throw new Error('Kernel integration not enabled');
    }
    
    // This would integrate with the actual LFTJ kernel
    // For now, simulate the kernel response
    const outputDeltas = {};
    
    // Process through dispatcher
    for (const delta of batch) {
      this._dispatcher.processDelta(delta);
    }
    
    await this._dispatcher.waitForProcessing();
    
    this.emit('batchPushedToKernel', { 
      inputBatch: batch, 
      outputDeltas 
    });
    
    return outputDeltas;
  }

  // === PRIVATE METHODS ===

  /**
   * Add edge instance
   */
  _addEdgeInstance(edge) {
    // Add to store
    this._store.addEdge(edge);
    
    // Create delta for batch processing
    const delta = {
      type: 'add',
      edge: edge,
      timestamp: Date.now()
    };
    
    // Add to write buffer for batching
    this._writeBuffer.push(delta);
    
    // Process batch if size threshold reached
    if (this._writeBuffer.length >= this._options.batchSize) {
      // Process asynchronously to avoid blocking
      setImmediate(() => this.flush());
    }
    
    this.emit('edgeAdded', { edge, delta });
    return edge;
  }

  /**
   * Remove edge instance
   */
  _removeEdgeInstance(edge) {
    // Remove from store
    this._store.removeEdge(edge);
    
    // Create delta
    const delta = {
      type: 'remove',
      edge: edge,
      timestamp: Date.now()
    };
    
    // Add to write buffer
    this._writeBuffer.push(delta);
    
    // Process batch if threshold reached
    if (this._writeBuffer.length >= this._options.batchSize) {
      setImmediate(() => this.flush());
    }
    
    this.emit('edgeRemoved', { edge, delta });
    return true;
  }

  /**
   * Process a batch of deltas
   */
  async _processBatch(batch) {
    if (batch.length === 0) {
      return;
    }
    
    try {
      // Send batch to dispatcher for processing
      for (const delta of batch) {
        this._dispatcher.processDelta(delta);
      }
      
      // Wait for dispatcher to complete processing
      await this._dispatcher.waitForProcessing();
      
      // If kernel is enabled, push batch there too
      if (this._options.enableKernel) {
        await this.pushBatchToKernel(batch);
      }
      
      this.emit('batchProcessed', { 
        batchSize: batch.length,
        timestamp: Date.now()
      });
      
    } catch (error) {
      this.emit('batchProcessingError', { batch, error });
      throw error;
    }
  }

  /**
   * Initialize kernel integration
   */
  async _initializeKernelIntegration() {
    // This would initialize the actual LFTJ kernel
    // For now, just emit initialization event
    this.emit('kernelInitialized');
  }

  /**
   * Setup store event listeners
   */
  _setupStoreListeners() {
    // Store doesn't emit events directly - we emit from DataStore methods
    // This is a placeholder for future store event integration
  }

  /**
   * Setup dispatcher integration
   */
  _setupDispatcherIntegration() {
    // Forward dispatcher events
    this._dispatcher.on('queryExecuted', (event) => {
      this.emit('queryExecuted', event);
    });
    
    this._dispatcher.on('deltaProcessed', (event) => {
      this.emit('deltaProcessed', event);
    });
    
    this._dispatcher.on('processingStarted', (event) => {
      this.emit('processingStarted', event);
    });
    
    this._dispatcher.on('processingCompleted', (event) => {
      this.emit('processingCompleted', event);
    });
  }

  /**
   * Setup event forwarding from all components
   */
  _setupEventForwarding() {
    // Forward QueryAPI events
    this._queryAPI.on('subscriptionCreated', (event) => {
      this.emit('subscriptionCreated', event);
    });
    
    this._queryAPI.on('subscriptionRemoved', (event) => {
      this.emit('subscriptionRemoved', event);
    });
    
    this._queryAPI.on('queryError', (event) => {
      this.emit('queryError', event);
    });
    
    // Forward SubscriptionManager events
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
    return `DataStore(edges=${stats.store.edges}, relations=${stats.store.relations}, subscriptions=${stats.queryAPI.totalSubscriptions}, initialized=${stats.initialized})`;
  }
}

// Export default instance creation helper
export function createDataStore(options = {}) {
  return new DataStore(options);
}