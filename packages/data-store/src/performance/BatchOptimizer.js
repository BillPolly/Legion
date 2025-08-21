/**
 * BatchOptimizer for write performance
 * Optimizes batch processing for the DataStore
 * 
 * Features:
 * - Write coalescing
 * - Batch size optimization
 * - Delta deduplication
 * - Adaptive batching based on load
 */

import { EventEmitter } from 'events';

/**
 * Batch optimizer for write operations
 */
export class BatchOptimizer extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this._options = {
      minBatchSize: options.minBatchSize || 10,
      maxBatchSize: options.maxBatchSize || 1000,
      batchTimeout: options.batchTimeout || 10, // ms
      adaptiveBatching: options.adaptiveBatching !== false,
      deduplication: options.deduplication !== false,
      coalescing: options.coalescing !== false
    };
    
    // Current batch
    this._currentBatch = [];
    this._batchTimer = null;
    this._processing = false;
    
    // Adaptive batching state
    this._currentBatchSize = this._options.minBatchSize;
    this._lastBatchTime = Date.now();
    this._throughput = 0;
    
    // Statistics
    this._stats = {
      totalBatches: 0,
      totalWrites: 0,
      duplicatesRemoved: 0,
      writesCoalesced: 0,
      averageBatchSize: 0,
      averageLatency: 0
    };
  }

  /**
   * Add write to batch
   */
  addWrite(operation) {
    if (!operation) {
      throw new Error('Write operation is required');
    }
    
    // Add to current batch
    this._currentBatch.push({
      ...operation,
      timestamp: Date.now()
    });
    
    // Check if we should flush
    if (this._shouldFlush()) {
      this.flush();
    } else if (!this._batchTimer) {
      // Start timer for timeout-based flush
      this._batchTimer = setTimeout(() => {
        this.flush();
      }, this._options.batchTimeout);
    }
  }

  /**
   * Add multiple writes
   */
  addWrites(operations) {
    if (!Array.isArray(operations)) {
      throw new Error('Operations must be an array');
    }
    
    for (const op of operations) {
      this._currentBatch.push({
        ...op,
        timestamp: Date.now()
      });
    }
    
    if (this._shouldFlush()) {
      this.flush();
    }
  }

  /**
   * Flush current batch
   */
  async flush() {
    if (this._processing || this._currentBatch.length === 0) {
      return;
    }
    
    // Clear timer
    if (this._batchTimer) {
      clearTimeout(this._batchTimer);
      this._batchTimer = null;
    }
    
    this._processing = true;
    const startTime = Date.now();
    
    try {
      // Get batch to process
      const batch = this._currentBatch;
      this._currentBatch = [];
      
      // Optimize batch
      const optimizedBatch = this._optimizeBatch(batch);
      
      // Update statistics
      this._updateStatistics(batch.length, optimizedBatch.length, startTime);
      
      // Emit batch for processing
      this.emit('batch', optimizedBatch);
      
      // Adapt batch size if enabled
      if (this._options.adaptiveBatching) {
        this._adaptBatchSize(optimizedBatch.length, Date.now() - startTime);
      }
      
      return optimizedBatch;
      
    } finally {
      this._processing = false;
    }
  }

  /**
   * Optimize a batch of operations
   */
  _optimizeBatch(batch) {
    let optimized = batch;
    
    // Apply deduplication
    if (this._options.deduplication) {
      optimized = this._deduplicateBatch(optimized);
    }
    
    // Apply coalescing
    if (this._options.coalescing) {
      optimized = this._coalesceBatch(optimized);
    }
    
    // Sort by operation type for better cache locality
    optimized.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type.localeCompare(b.type);
      }
      return a.timestamp - b.timestamp;
    });
    
    return optimized;
  }

  /**
   * Remove duplicate operations
   */
  _deduplicateBatch(batch) {
    const seen = new Set();
    const deduplicated = [];
    let duplicatesRemoved = 0;
    
    // Process in reverse order to keep latest operations
    for (let i = batch.length - 1; i >= 0; i--) {
      const op = batch[i];
      const key = this._getOperationKey(op);
      
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.unshift(op);
      } else {
        duplicatesRemoved++;
      }
    }
    
    this._stats.duplicatesRemoved += duplicatesRemoved;
    
    if (duplicatesRemoved > 0) {
      this.emit('duplicatesRemoved', { count: duplicatesRemoved });
    }
    
    return deduplicated;
  }

  /**
   * Coalesce related operations
   */
  _coalesceBatch(batch) {
    const coalesced = [];
    const groups = new Map();
    
    // Group operations by key
    for (const op of batch) {
      const key = this._getCoalescingKey(op);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(op);
    }
    
    // Coalesce each group
    let writesCoalesced = 0;
    for (const [key, ops] of groups.entries()) {
      if (ops.length > 1) {
        // Coalesce multiple operations on same entity
        const merged = this._mergeOperations(ops);
        coalesced.push(merged);
        writesCoalesced += ops.length - 1;
      } else {
        coalesced.push(ops[0]);
      }
    }
    
    this._stats.writesCoalesced += writesCoalesced;
    
    if (writesCoalesced > 0) {
      this.emit('writesCoalesced', { count: writesCoalesced });
    }
    
    return coalesced;
  }

  /**
   * Get unique key for operation
   */
  _getOperationKey(op) {
    if (op.type === 'add' || op.type === 'remove') {
      return `${op.type}:${op.edge?.type}:${JSON.stringify(op.edge?.src)}:${JSON.stringify(op.edge?.dst)}`;
    }
    return `${op.type}:${JSON.stringify(op)}`;
  }

  /**
   * Get coalescing key for operation
   */
  _getCoalescingKey(op) {
    if (op.edge) {
      return `${op.edge.type}:${JSON.stringify(op.edge.src)}`;
    }
    return this._getOperationKey(op);
  }

  /**
   * Merge multiple operations
   */
  _mergeOperations(ops) {
    // For now, just take the latest operation
    // In a real system, you'd merge based on operation semantics
    const latest = ops[ops.length - 1];
    
    // If there are both adds and removes, handle specially
    const hasAdd = ops.some(op => op.type === 'add');
    const hasRemove = ops.some(op => op.type === 'remove');
    
    if (hasAdd && hasRemove) {
      // Cancel out add/remove pairs
      const adds = ops.filter(op => op.type === 'add');
      const removes = ops.filter(op => op.type === 'remove');
      
      if (adds.length === removes.length) {
        // Complete cancellation - return no-op
        return {
          type: 'noop',
          timestamp: latest.timestamp
        };
      }
      
      // Return the dominant operation
      return adds.length > removes.length ? adds[adds.length - 1] : removes[removes.length - 1];
    }
    
    return latest;
  }

  /**
   * Check if batch should be flushed
   */
  _shouldFlush() {
    // Check size threshold
    if (this._currentBatch.length >= this._currentBatchSize) {
      return true;
    }
    
    // Check if batch is getting old
    if (this._currentBatch.length > 0) {
      const oldestWrite = this._currentBatch[0];
      const age = Date.now() - oldestWrite.timestamp;
      if (age > this._options.batchTimeout * 2) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Adapt batch size based on performance
   */
  _adaptBatchSize(processedSize, processingTime) {
    const throughput = processedSize / (processingTime || 1);
    
    // Smooth throughput measurement
    this._throughput = this._throughput * 0.7 + throughput * 0.3;
    
    // Adjust batch size based on throughput
    if (throughput > this._throughput * 1.2) {
      // Performance is good, increase batch size
      this._currentBatchSize = Math.min(
        this._currentBatchSize * 1.1,
        this._options.maxBatchSize
      );
    } else if (throughput < this._throughput * 0.8) {
      // Performance degraded, reduce batch size
      this._currentBatchSize = Math.max(
        this._currentBatchSize * 0.9,
        this._options.minBatchSize
      );
    }
    
    this._currentBatchSize = Math.floor(this._currentBatchSize);
  }

  /**
   * Update statistics
   */
  _updateStatistics(originalSize, optimizedSize, startTime) {
    this._stats.totalBatches++;
    this._stats.totalWrites += originalSize;
    
    // Update average batch size
    const alpha = 0.1; // Exponential moving average factor
    this._stats.averageBatchSize = 
      this._stats.averageBatchSize * (1 - alpha) + optimizedSize * alpha;
    
    // Update average latency
    const latency = Date.now() - startTime;
    this._stats.averageLatency = 
      this._stats.averageLatency * (1 - alpha) + latency * alpha;
    
    this.emit('statistics', {
      batchSize: optimizedSize,
      latency: latency,
      reduction: originalSize - optimizedSize
    });
  }

  /**
   * Get optimization statistics
   */
  getStatistics() {
    return {
      ...this._stats,
      currentBatchSize: this._currentBatchSize,
      pendingWrites: this._currentBatch.length,
      throughput: this._throughput,
      optimizationRate: this._stats.totalWrites > 0 
        ? (this._stats.duplicatesRemoved + this._stats.writesCoalesced) / this._stats.totalWrites
        : 0
    };
  }

  /**
   * Reset statistics
   */
  resetStatistics() {
    this._stats = {
      totalBatches: 0,
      totalWrites: 0,
      duplicatesRemoved: 0,
      writesCoalesced: 0,
      averageBatchSize: 0,
      averageLatency: 0
    };
    this._throughput = 0;
  }

  /**
   * Clear pending writes
   */
  clear() {
    if (this._batchTimer) {
      clearTimeout(this._batchTimer);
      this._batchTimer = null;
    }
    
    this._currentBatch = [];
    this._processing = false;
    
    this.emit('cleared');
  }

  /**
   * Get current configuration
   */
  getConfiguration() {
    return {
      ...this._options,
      currentBatchSize: this._currentBatchSize
    };
  }

  /**
   * Update configuration
   */
  updateConfiguration(options) {
    Object.assign(this._options, options);
    
    if (options.minBatchSize || options.maxBatchSize) {
      // Ensure current batch size is within new bounds
      this._currentBatchSize = Math.max(
        this._options.minBatchSize,
        Math.min(this._currentBatchSize, this._options.maxBatchSize)
      );
    }
    
    this.emit('configurationUpdated', this._options);
  }
}

/**
 * Create a batch optimizer
 */
export function createBatchOptimizer(options = {}) {
  return new BatchOptimizer(options);
}