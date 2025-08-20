/**
 * Batch-enabled node wrapper for optimized delta propagation
 * Wraps existing nodes with batch accumulation capabilities
 */

import { Delta } from './Delta.js';

/**
 * Batch accumulator for a single node
 */
class NodeBatchAccumulator {
  constructor() {
    this._pendingAdds = new Map(); // tupleKey -> tuple
    this._pendingRemoves = new Map(); // tupleKey -> tuple
    this._isDirty = false;
  }

  /**
   * Add delta to accumulator
   */
  accumulate(delta) {
    // Process removes first
    for (const tuple of delta.removes) {
      const key = tuple.toBytes().toString();
      
      // Cancel pending add if exists
      if (this._pendingAdds.has(key)) {
        this._pendingAdds.delete(key);
      } else {
        this._pendingRemoves.set(key, tuple);
      }
    }

    // Process adds
    for (const tuple of delta.adds) {
      const key = tuple.toBytes().toString();
      
      // Cancel pending remove if exists
      if (this._pendingRemoves.has(key)) {
        this._pendingRemoves.delete(key);
      } else {
        this._pendingAdds.set(key, tuple);
      }
    }

    this._isDirty = this._pendingAdds.size > 0 || this._pendingRemoves.size > 0;
  }

  /**
   * Get accumulated delta and clear
   */
  flush() {
    if (!this._isDirty) {
      return null;
    }

    const delta = new Delta(
      new Set(this._pendingAdds.values()),
      new Set(this._pendingRemoves.values())
    );

    this.clear();
    return delta;
  }

  /**
   * Clear accumulator
   */
  clear() {
    this._pendingAdds.clear();
    this._pendingRemoves.clear();
    this._isDirty = false;
  }

  get isDirty() {
    return this._isDirty;
  }

  get size() {
    return this._pendingAdds.size + this._pendingRemoves.size;
  }
}

/**
 * Batch-enabled node wrapper
 */
export class BatchNode {
  constructor(innerNode, options = {}) {
    this._innerNode = innerNode;
    this._accumulator = new NodeBatchAccumulator();
    this._batchSize = options.batchSize || 100;
    this._autoFlush = options.autoFlush !== false;
    this._flushCallback = options.onFlush || null;
    this._isBatching = false;
    this._statistics = {
      deltasReceived: 0,
      batchesProcessed: 0,
      tuplesProcessed: 0
    };

    // Wrap the inner node's onDeltaReceived if it exists
    if (innerNode.onDeltaReceived) {
      this._originalOnDeltaReceived = innerNode.onDeltaReceived.bind(innerNode);
      innerNode.onDeltaReceived = this.onDeltaReceived.bind(this);
    }
  }

  /**
   * Get wrapped node
   */
  get innerNode() {
    return this._innerNode;
  }

  /**
   * Start batching
   */
  startBatching() {
    this._isBatching = true;
  }

  /**
   * Stop batching and flush
   */
  stopBatching() {
    if (this._isBatching) {
      this.flush();
      this._isBatching = false;
    }
  }

  /**
   * Handle incoming delta
   */
  onDeltaReceived(sourceNode, delta) {
    this._statistics.deltasReceived++;

    if (!this._isBatching) {
      // Pass through directly
      if (this._originalOnDeltaReceived) {
        this._originalOnDeltaReceived(sourceNode, delta);
      } else {
        this._innerNode.pushDelta(delta);
      }
      return;
    }

    // Accumulate delta
    this._accumulator.accumulate(delta);
    this._statistics.tuplesProcessed += delta.adds.size + delta.removes.size;

    // Check if we should auto-flush
    if (this._autoFlush && this._accumulator.size >= this._batchSize) {
      this.flush();
    }
  }

  /**
   * Push delta directly (bypasses batching)
   */
  pushDelta(delta) {
    this._statistics.deltasReceived++;
    
    if (!this._isBatching) {
      this._innerNode.pushDelta(delta);
      return;
    }

    // Accumulate when batching
    this._accumulator.accumulate(delta);
    this._statistics.tuplesProcessed += delta.adds.size + delta.removes.size;

    if (this._autoFlush && this._accumulator.size >= this._batchSize) {
      this.flush();
    }
  }

  /**
   * Flush accumulated deltas
   */
  flush() {
    const delta = this._accumulator.flush();
    
    if (delta) {
      this._statistics.batchesProcessed++;
      
      // Process the batch through the inner node
      if (this._originalOnDeltaReceived) {
        this._originalOnDeltaReceived(this, delta);
      } else {
        this._innerNode.pushDelta(delta);
      }

      // Notify callback if set
      if (this._flushCallback) {
        this._flushCallback(delta);
      }
    }
  }

  /**
   * Clear pending batches
   */
  clear() {
    this._accumulator.clear();
  }

  /**
   * Get batch status
   */
  getBatchStatus() {
    return {
      isBatching: this._isBatching,
      isDirty: this._accumulator.isDirty,
      size: this._accumulator.size,
      batchSize: this._batchSize
    };
  }

  /**
   * Get statistics
   */
  getStatistics() {
    return { ...this._statistics };
  }

  /**
   * Reset statistics
   */
  resetStatistics() {
    this._statistics = {
      deltasReceived: 0,
      batchesProcessed: 0,
      tuplesProcessed: 0
    };
  }

  /**
   * Proxy methods to inner node
   */
  
  get id() {
    return this._innerNode.id;
  }

  get inputs() {
    return this._innerNode.inputs;
  }

  get outputs() {
    return this._innerNode.outputs;
  }

  addInput(inputNode) {
    return this._innerNode.addInput(inputNode);
  }

  addOutput(outputNode) {
    return this._innerNode.addOutput(outputNode);
  }

  processDelta(delta) {
    return this._innerNode.processDelta(delta);
  }

  reset() {
    this.clear();
    if (this._innerNode.reset) {
      this._innerNode.reset();
    }
  }

  getState() {
    const state = this._innerNode.getState ? this._innerNode.getState() : {};
    return {
      ...state,
      batch: this.getBatchStatus()
    };
  }

  getCurrentSet() {
    return this._innerNode.getCurrentSet ? this._innerNode.getCurrentSet() : null;
  }

  toString() {
    return `Batch(${this._innerNode.toString()})`;
  }
}

/**
 * Create batch-enabled wrapper for a node
 */
export function wrapWithBatch(node, options = {}) {
  return new BatchNode(node, options);
}

/**
 * Batch controller for managing multiple batch nodes
 */
export class BatchController {
  constructor() {
    this._batchNodes = new Set();
    this._isTransactionActive = false;
  }

  /**
   * Register a batch node
   */
  register(batchNode) {
    if (!(batchNode instanceof BatchNode)) {
      throw new Error('Must register a BatchNode instance');
    }
    this._batchNodes.add(batchNode);
  }

  /**
   * Unregister a batch node
   */
  unregister(batchNode) {
    this._batchNodes.delete(batchNode);
  }

  /**
   * Start batching on all nodes
   */
  startBatching() {
    for (const node of this._batchNodes) {
      node.startBatching();
    }
    this._isTransactionActive = true;
  }

  /**
   * Stop batching and flush all nodes
   */
  stopBatching() {
    for (const node of this._batchNodes) {
      node.stopBatching();
    }
    this._isTransactionActive = false;
  }

  /**
   * Flush all nodes
   */
  flush() {
    for (const node of this._batchNodes) {
      node.flush();
    }
  }

  /**
   * Clear all nodes
   */
  clear() {
    for (const node of this._batchNodes) {
      node.clear();
    }
  }

  /**
   * Execute function with batching
   */
  async executeBatched(fn) {
    this.startBatching();
    
    try {
      const result = await fn();
      this.flush();
      return result;
    } catch (error) {
      this.clear();
      throw error;
    } finally {
      this.stopBatching();
    }
  }

  /**
   * Get aggregate statistics
   */
  getStatistics() {
    const stats = {
      nodeCount: this._batchNodes.size,
      totalDeltasReceived: 0,
      totalBatchesProcessed: 0,
      totalTuplesProcessed: 0
    };

    for (const node of this._batchNodes) {
      const nodeStats = node.getStatistics();
      stats.totalDeltasReceived += nodeStats.deltasReceived;
      stats.totalBatchesProcessed += nodeStats.batchesProcessed;
      stats.totalTuplesProcessed += nodeStats.tuplesProcessed;
    }

    return stats;
  }
}