import { Node } from './Node.js';
import { Delta } from './Delta.js';

/**
 * Union operator per design §4.1 and §7.2
 * Disjunction of two or more inputs with same schema
 */
export class UnionNode extends Node {
  constructor(id) {
    super(id);

    // State: U[outTuple] → count (# of inputs that currently contribute)
    this._unionCounts = new Map();
    this._pendingDelta = new Delta();
  }

  /**
   * Override to handle input deltas with proper source tracking
   */
  onDeltaReceived(sourceNode, delta) {
    const inputIndex = this._getInputIndex(sourceNode);
    if (inputIndex === -1) {
      throw new Error(`Unknown input node: ${sourceNode.id}`);
    }

    this._processInputDelta(inputIndex, delta);
    this._emitPendingDeltas();
  }

  /**
   * Get index of input node
   */
  _getInputIndex(sourceNode) {
    return this._inputs.findIndex(input => input === sourceNode);
  }

  /**
   * Process delta from specific input per design §7.2
   */
  _processInputDelta(inputIndex, delta) {
    const outputAdds = new Map();
    const outputRemoves = new Map();

    // Process removes first
    for (const tuple of delta.removes) {
      const key = tuple.toBytes().toString();
      const currentCount = this._unionCounts.get(key) || 0;
      
      if (currentCount > 0) {
        const newCount = currentCount - 1;
        if (newCount === 0) {
          this._unionCounts.delete(key);
          outputRemoves.set(key, tuple);
        } else {
          this._unionCounts.set(key, newCount);
        }
      }
    }

    // Process adds
    for (const tuple of delta.adds) {
      const key = tuple.toBytes().toString();
      const currentCount = this._unionCounts.get(key) || 0;
      const newCount = currentCount + 1;
      
      if (currentCount === 0) {
        // 0→1 transition: emit add
        outputAdds.set(key, tuple);
      }
      this._unionCounts.set(key, newCount);
    }

    // Accumulate output delta
    this._pendingDelta = this._pendingDelta.merge(new Delta(
      new Set(outputAdds.values()), 
      new Set(outputRemoves.values())
    ));
  }

  /**
   * Emit accumulated deltas to outputs
   */
  _emitPendingDeltas() {
    if (!this._pendingDelta.isEmpty()) {
      // Emit to all outputs
      for (const outputNode of this._outputs) {
        if (outputNode._onDeltaReceived) {
          outputNode._onDeltaReceived(this, this._pendingDelta);
        } else if (outputNode.onDeltaReceived) {
          outputNode.onDeltaReceived(this, this._pendingDelta);
        }
      }
      
      this._pendingDelta = new Delta();
    }
  }

  /**
   * Process delta - not used directly for Union, but required by base class
   */
  processDelta(delta) {
    // Union processes deltas through onDeltaReceived mechanism
    // This method is not used directly
    return new Delta();
  }

  /**
   * Reset state
   */
  reset() {
    this._unionCounts.clear();
    this._pendingDelta = new Delta();
  }

  /**
   * Get current set of union tuples
   */
  getCurrentSet() {
    // For integration testing, return a set with count information
    const currentSet = new Set();
    for (const [tupleKey, count] of this._unionCounts) {
      if (count > 0) {
        currentSet.add(`tuple_${tupleKey.substring(0, 8)}`); // Simplified representation
      }
    }
    return currentSet;
  }

  /**
   * Get state information
   */
  getState() {
    return {
      type: 'Union',
      inputCount: this._inputs.length,
      unionCounts: new Map(this._unionCounts)
    };
  }

  toString() {
    return `Union(${this._id}, ${this._inputs.length} inputs)`;
  }
}