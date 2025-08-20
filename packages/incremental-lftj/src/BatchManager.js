/**
 * Batch Manager for optimized delta propagation
 * Accumulates deltas and propagates them in batches
 */

import { Delta } from './Delta.js';

/**
 * Batch entry tracking pending deltas for a relation
 */
class BatchEntry {
  constructor(relationName) {
    this._relationName = relationName;
    this._pendingAdds = new Map(); // tupleKey -> tuple
    this._pendingRemoves = new Map(); // tupleKey -> tuple
    this._isDirty = false;
  }

  /**
   * Add delta to the batch
   */
  addDelta(delta) {
    // Process removes first (removes cancel adds)
    for (const tuple of delta.removes) {
      const key = tuple.toBytes().toString();
      
      // If this was a pending add, cancel it
      if (this._pendingAdds.has(key)) {
        this._pendingAdds.delete(key);
      } else {
        // Otherwise, add to pending removes
        this._pendingRemoves.set(key, tuple);
      }
    }

    // Process adds
    for (const tuple of delta.adds) {
      const key = tuple.toBytes().toString();
      
      // If this was a pending remove, cancel it
      if (this._pendingRemoves.has(key)) {
        this._pendingRemoves.delete(key);
      } else {
        // Otherwise, add to pending adds
        this._pendingAdds.set(key, tuple);
      }
    }

    this._isDirty = this._pendingAdds.size > 0 || this._pendingRemoves.size > 0;
  }

  /**
   * Get accumulated delta
   */
  getDelta() {
    if (!this._isDirty) {
      return new Delta(new Set(), new Set());
    }

    return new Delta(
      new Set(this._pendingAdds.values()),
      new Set(this._pendingRemoves.values())
    );
  }

  /**
   * Clear batch
   */
  clear() {
    this._pendingAdds.clear();
    this._pendingRemoves.clear();
    this._isDirty = false;
  }

  get isDirty() {
    return this._isDirty;
  }

  get relationName() {
    return this._relationName;
  }

  get size() {
    return this._pendingAdds.size + this._pendingRemoves.size;
  }
}

/**
 * Batch manager for accumulating and propagating deltas
 */
export class BatchManager {
  constructor(options = {}) {
    this._batches = new Map(); // graphId -> Map(relationName -> BatchEntry)
    this._batchSize = options.batchSize || 1000;
    this._autoFlush = options.autoFlush !== false;
    this._flushInterval = options.flushInterval || 100; // ms
    this._flushTimer = null;
    this._flushCallback = null;
    this._transactionDepth = 0;
    this._statistics = {
      totalBatches: 0,
      totalDeltas: 0,
      totalFlushes: 0,
      averageBatchSize: 0
    };
  }

  /**
   * Set flush callback
   */
  onFlush(callback) {
    this._flushCallback = callback;
  }

  /**
   * Begin a transaction (delays flushing)
   */
  beginTransaction() {
    this._transactionDepth++;
    this._cancelScheduledFlush();
  }

  /**
   * End a transaction (may trigger flush)
   */
  endTransaction() {
    if (this._transactionDepth > 0) {
      this._transactionDepth--;
    }

    if (this._transactionDepth === 0 && this._autoFlush) {
      // Check if any batches need flushing
      for (const [graphId, relationBatches] of this._batches) {
        for (const batch of relationBatches.values()) {
          if (batch.size >= this._batchSize) {
            this.flush(graphId);
            break;
          }
        }
      }
    }
  }

  /**
   * Add delta to batch
   */
  addDelta(graphId, relationName, delta) {
    if (!this._batches.has(graphId)) {
      this._batches.set(graphId, new Map());
    }

    const relationBatches = this._batches.get(graphId);
    
    if (!relationBatches.has(relationName)) {
      relationBatches.set(relationName, new BatchEntry(relationName));
    }

    const batch = relationBatches.get(relationName);
    batch.addDelta(delta);

    this._statistics.totalDeltas++;

    // Check if we should auto-flush
    if (this._autoFlush && this._transactionDepth === 0) {
      if (batch.size >= this._batchSize) {
        // Flush immediately if batch is full
        this.flush(graphId);
      } else if (batch.isDirty) {
        // Schedule a flush
        this._scheduleFlush(graphId);
      }
    }
  }

  /**
   * Schedule a flush
   */
  _scheduleFlush(graphId) {
    if (this._flushTimer) {
      return; // Already scheduled
    }

    this._flushTimer = setTimeout(() => {
      this._flushTimer = null;
      if (this._transactionDepth === 0) {
        this.flush(graphId);
      }
    }, this._flushInterval);
  }

  /**
   * Cancel scheduled flush
   */
  _cancelScheduledFlush() {
    if (this._flushTimer) {
      clearTimeout(this._flushTimer);
      this._flushTimer = null;
    }
  }

  /**
   * Flush batches for a graph
   */
  flush(graphId) {
    const relationBatches = this._batches.get(graphId);
    if (!relationBatches || relationBatches.size === 0) {
      return [];
    }

    const flushedBatches = [];
    let totalSize = 0;

    for (const [relationName, batch] of relationBatches) {
      if (batch.isDirty) {
        const delta = batch.getDelta();
        flushedBatches.push({
          graphId,
          relationName,
          delta
        });
        
        totalSize += batch.size;
        batch.clear();
        this._statistics.totalBatches++;
      }
    }

    if (flushedBatches.length > 0) {
      this._statistics.totalFlushes++;
      this._statistics.averageBatchSize = 
        (this._statistics.averageBatchSize * (this._statistics.totalFlushes - 1) + totalSize) 
        / this._statistics.totalFlushes;

      // Notify callback if set
      if (this._flushCallback) {
        this._flushCallback(flushedBatches);
      }
    }

    this._cancelScheduledFlush();
    return flushedBatches;
  }

  /**
   * Flush all batches
   */
  flushAll() {
    const allFlushed = [];
    
    for (const graphId of this._batches.keys()) {
      const flushed = this.flush(graphId);
      allFlushed.push(...flushed);
    }

    return allFlushed;
  }

  /**
   * Get batch status
   */
  getBatchStatus(graphId, relationName = null) {
    const relationBatches = this._batches.get(graphId);
    if (!relationBatches) {
      return null;
    }

    if (relationName) {
      const batch = relationBatches.get(relationName);
      return batch ? {
        relationName: batch.relationName,
        size: batch.size,
        isDirty: batch.isDirty
      } : null;
    }

    // Return status for all relations
    const status = {};
    for (const [relName, batch] of relationBatches) {
      status[relName] = {
        size: batch.size,
        isDirty: batch.isDirty
      };
    }
    return status;
  }

  /**
   * Clear all batches without flushing
   */
  clear(graphId = null) {
    if (graphId) {
      const relationBatches = this._batches.get(graphId);
      if (relationBatches) {
        for (const batch of relationBatches.values()) {
          batch.clear();
        }
      }
    } else {
      // Clear all
      for (const relationBatches of this._batches.values()) {
        for (const batch of relationBatches.values()) {
          batch.clear();
        }
      }
    }

    this._cancelScheduledFlush();
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
      totalBatches: 0,
      totalDeltas: 0,
      totalFlushes: 0,
      averageBatchSize: 0
    };
  }

  /**
   * Destroy batch manager
   */
  destroy() {
    this._cancelScheduledFlush();
    this.clear();
    this._flushCallback = null;
  }
}

/**
 * Transaction helper for batch operations
 */
export class BatchTransaction {
  constructor(batchManager) {
    this._batchManager = batchManager;
    this._isActive = false;
  }

  /**
   * Begin transaction
   */
  begin() {
    if (this._isActive) {
      throw new Error('Transaction already active');
    }
    
    this._batchManager.beginTransaction();
    this._isActive = true;
  }

  /**
   * Commit transaction
   */
  commit() {
    if (!this._isActive) {
      throw new Error('No active transaction');
    }
    
    this._batchManager.endTransaction();
    this._isActive = false;
  }

  /**
   * Rollback transaction (clears pending batches)
   */
  rollback(graphId = null) {
    if (!this._isActive) {
      throw new Error('No active transaction');
    }
    
    this._batchManager.clear(graphId);
    this._batchManager.endTransaction();
    this._isActive = false;
  }

  /**
   * Execute function within transaction
   */
  async execute(fn) {
    this.begin();
    
    try {
      const result = await fn();
      this.commit();
      return result;
    } catch (error) {
      this.rollback();
      throw error;
    }
  }
}