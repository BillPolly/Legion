/**
 * Batch-enabled Graph Engine for optimized delta propagation
 * Extends GraphEngine with batch processing capabilities
 */

import { GraphEngine } from './GraphEngine.js';
import { BatchManager, BatchTransaction } from './BatchManager.js';

/**
 * Batch-enabled execution engine
 */
export class BatchGraphEngine extends GraphEngine {
  constructor(options = {}) {
    super();
    
    this._batchManager = new BatchManager({
      batchSize: options.batchSize || 1000,
      autoFlush: options.autoFlush !== false,
      flushInterval: options.flushInterval || 100
    });

    this._batchMode = options.batchMode !== false;
    this._pendingResults = new Map(); // graphId -> accumulated results
    
    // Set up flush callback
    this._batchManager.onFlush((batches) => {
      this._processBatches(batches);
    });
  }

  /**
   * Enable or disable batch mode
   */
  setBatchMode(enabled) {
    if (!enabled && this._batchMode) {
      // Flush pending batches when disabling
      this._batchManager.flushAll();
    }
    this._batchMode = enabled;
  }

  /**
   * Process update with optional batching
   */
  processUpdate(graphId, relationName, delta) {
    if (!this._batchMode) {
      // Direct processing without batching
      return super.processUpdate(graphId, relationName, delta);
    }

    // Add to batch
    this._batchManager.addDelta(graphId, relationName, delta);
    
    // Return pending results if any
    const pendingResults = this._pendingResults.get(graphId);
    if (pendingResults) {
      // Clear and return accumulated results
      this._pendingResults.delete(graphId);
      return pendingResults;
    }

    // Return empty results (will be populated on flush)
    return {};
  }

  /**
   * Process accumulated batches
   */
  _processBatches(batches) {
    // Group batches by graph
    const batchesByGraph = new Map();
    
    for (const batch of batches) {
      if (!batchesByGraph.has(batch.graphId)) {
        batchesByGraph.set(batch.graphId, []);
      }
      batchesByGraph.get(batch.graphId).push(batch);
    }

    // Process each graph's batches
    for (const [graphId, graphBatches] of batchesByGraph) {
      const results = this._processGraphBatches(graphId, graphBatches);
      
      // Store results for retrieval
      if (Object.keys(results).length > 0) {
        this._pendingResults.set(graphId, results);
      }
    }
  }

  /**
   * Process batches for a single graph
   */
  _processGraphBatches(graphId, batches) {
    const graph = this._graphs.get(graphId);
    const context = this._contexts.get(graphId);

    if (!graph || !context) {
      throw new Error(`Graph '${graphId}' not found or not built`);
    }

    // Increment delta count once for the batch
    context.incrementDeltaCount();
    
    context.notifyExecution('batchUpdateBegin', {
      graphId,
      batchCount: batches.length,
      deltaCount: context.deltaCount
    });

    // Process all batches through scan nodes
    for (const batch of batches) {
      const scanNode = graph.nodes.find(n => 
        n.type === 'scan' && n.config.relationName === batch.relationName
      );

      if (!scanNode) {
        console.warn(`No scan node found for relation '${batch.relationName}'`);
        continue;
      }

      const scanInstance = context.getInstance(scanNode.id);
      scanInstance.pushDelta(batch.delta);
    }

    // Collect results from output nodes
    const outputResults = {};
    for (const outputNode of graph.outputs) {
      const instance = context.getInstance(outputNode.id);
      outputResults[outputNode.id] = {
        nodeType: outputNode.type,
        currentSet: this._safeGetCurrentSet(instance)
      };
    }

    context.notifyExecution('batchUpdateComplete', {
      graphId,
      batchCount: batches.length,
      deltaCount: context.deltaCount,
      outputResults: Object.keys(outputResults)
    });

    return outputResults;
  }

  /**
   * Begin a batch transaction
   */
  beginTransaction() {
    this._batchManager.beginTransaction();
  }

  /**
   * End a batch transaction
   */
  endTransaction() {
    this._batchManager.endTransaction();
  }

  /**
   * Create a transaction helper
   */
  createTransaction() {
    return new BatchTransaction(this._batchManager);
  }

  /**
   * Execute function within a transaction
   */
  async executeInTransaction(fn) {
    const transaction = this.createTransaction();
    return transaction.execute(fn);
  }

  /**
   * Flush pending batches for a graph
   */
  flush(graphId = null) {
    if (graphId) {
      return this._batchManager.flush(graphId);
    } else {
      return this._batchManager.flushAll();
    }
  }

  /**
   * Clear pending batches without processing
   */
  clearBatches(graphId = null) {
    this._batchManager.clear(graphId);
    if (graphId) {
      this._pendingResults.delete(graphId);
    } else {
      this._pendingResults.clear();
    }
  }

  /**
   * Get batch status
   */
  getBatchStatus(graphId, relationName = null) {
    return this._batchManager.getBatchStatus(graphId, relationName);
  }

  /**
   * Get batch statistics
   */
  getBatchStatistics() {
    return this._batchManager.getStatistics();
  }

  /**
   * Reset batch statistics
   */
  resetBatchStatistics() {
    this._batchManager.resetStatistics();
  }

  /**
   * Override reset to also clear batches
   */
  reset(graphId) {
    super.reset(graphId);
    this.clearBatches(graphId);
  }

  /**
   * Override unregister to clear batches
   */
  unregisterGraph(graphId) {
    this.clearBatches(graphId);
    return super.unregisterGraph(graphId);
  }

  /**
   * Destroy engine
   */
  destroy() {
    this._batchManager.destroy();
    this._pendingResults.clear();
  }
}

/**
 * Utility class for batch updates
 */
export class BatchUpdater {
  constructor(engine, graphId) {
    this._engine = engine;
    this._graphId = graphId;
    this._updates = [];
  }

  /**
   * Add update to batch
   */
  add(relationName, delta) {
    this._updates.push({ relationName, delta });
    return this;
  }

  /**
   * Execute all updates in a transaction
   */
  async execute() {
    return this._engine.executeInTransaction(async () => {
      const results = [];
      
      for (const update of this._updates) {
        const result = this._engine.processUpdate(
          this._graphId, 
          update.relationName, 
          update.delta
        );
        results.push(result);
      }

      // Flush to get final results
      this._engine.flush(this._graphId);
      
      return results;
    });
  }

  /**
   * Clear pending updates
   */
  clear() {
    this._updates = [];
  }
}