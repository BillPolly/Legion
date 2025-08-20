import { Node } from './Node.js';
import { Delta } from './Delta.js';
import { EnumerableProvider, PointwiseProvider } from './ComputeProvider.js';

/**
 * Compute node implementing computed predicates per design §7.6-7.7
 * Supports both enumerable and pointwise modes
 */
export class ComputeNode extends Node {
  constructor(id, provider) {
    super(id);

    if (!provider || typeof provider.getMode !== 'function') {
      throw new Error('Provider must be a valid ComputeProvider instance');
    }

    this._provider = provider;
    this._mode = provider.getMode();
    this._lastStateHandle = provider.getCurrentStateHandle();

    // Mode-specific state
    if (this._mode === 'enumerable') {
      // Enumerable mode: behaves like ScanNode
      this._currentSet = new Set();
    } else if (this._mode === 'pointwise') {
      // Pointwise mode: watchSet and truth map per design §7.7
      this._watchSet = new Set();
      this._truth = new Map(); // Map<tupleKey, boolean>
    } else {
      throw new Error(`Unknown provider mode: ${this._mode}`);
    }
  }

  get provider() {
    return this._provider;
  }

  get mode() {
    return this._mode;
  }

  /**
   * Process delta per design §7.6-7.7
   * For enumerable: fetch provider delta and emit
   * For pointwise: process upstream candidates
   */
  processDelta(delta) {
    if (this._mode === 'enumerable') {
      return this._processEnumerableDelta(delta);
    } else {
      return this._processPointwiseDelta(delta);
    }
  }

  /**
   * Process enumerable mode per design §7.6
   * Provider returns ΔP; node behaves like Scan(P)
   */
  _processEnumerableDelta(delta) {
    // For enumerable compute nodes, incoming delta is typically empty
    // since they act as leaf nodes. We fetch the provider's delta.
    
    const providerDelta = this._provider.deltaSince(this._lastStateHandle);

    // Update current set if maintaining state
    for (const tuple of providerDelta.removes) {
      this._currentSet.delete(tuple);
    }
    for (const tuple of providerDelta.adds) {
      this._currentSet.add(tuple);
    }

    // Create output delta from provider delta
    const outputDelta = new Delta(providerDelta.adds, providerDelta.removes);
    
    // Advance provider state and update our tracking
    this._provider._advanceState();
    this._lastStateHandle = this._provider.getCurrentStateHandle();
    
    return outputDelta;
  }

  /**
   * Process pointwise mode per design §7.7
   * Handle upstream adds/removes and truth flips
   */
  _processPointwiseDelta(delta) {
    const outputAdds = new Set();
    const outputRemoves = new Set();

    // Process removes first per §6.2
    for (const tuple of delta.removes) {
      this._processPointwiseRemove(tuple, outputAdds, outputRemoves);
    }

    // Then process adds
    for (const tuple of delta.adds) {
      this._processPointwiseAdd(tuple, outputAdds, outputRemoves);
    }

    // Handle provider flips if supported (before advancing state)
    if (this._provider.supportsFlips()) {
      this._processProviderFlips(outputAdds, outputRemoves);
    }

    // Advance provider state and update our tracking
    this._provider._advanceState();
    this._lastStateHandle = this._provider.getCurrentStateHandle();

    return new Delta(outputAdds, outputRemoves);
  }

  /**
   * Process pointwise add per design §7.7
   * Add candidates to watchSet, evaluate new candidates
   */
  _processPointwiseAdd(tuple, outputAdds, outputRemoves) {
    const tupleKey = tuple.toBytes().toString();
    
    // Add to watchSet
    this._watchSet.add(tuple);
    
    // If this is a new candidate (not previously in truth map), evaluate it
    if (!this._truth.has(tupleKey)) {
      const candidates = new Set([tuple]);
      const truthSet = this._provider.evalMany(candidates);
      
      const isTrue = truthSet.has(tuple);
      this._truth.set(tupleKey, isTrue);
      
      // If newly true, emit add
      if (isTrue) {
        outputAdds.add(tuple);
      }
    }
  }

  /**
   * Process pointwise remove per design §7.7
   * Remove from watchSet, emit remove if currently true
   */
  _processPointwiseRemove(tuple, outputAdds, outputRemoves) {
    const tupleKey = tuple.toBytes().toString();
    
    // Remove from watchSet
    this._watchSet.delete(tuple);
    
    // If currently true, emit remove and clear truth
    if (this._truth.get(tupleKey) === true) {
      outputRemoves.add(tuple);
    }
    
    // Remove from truth map
    this._truth.delete(tupleKey);
  }

  /**
   * Process provider flips per design §7.7
   * Handle truth changes from provider
   */
  _processProviderFlips(outputAdds, outputRemoves) {
    const flips = this._provider.flipsSince(this._lastStateHandle, this._watchSet);
    // Note: _lastStateHandle will be updated by the caller after advancing provider state

    // Process false flips (emit removes for currently true)
    for (const tuple of flips.false) {
      const tupleKey = tuple.toBytes().toString();
      if (this._truth.get(tupleKey) === true) {
        this._truth.set(tupleKey, false);
        outputRemoves.add(tuple);
      }
    }

    // Process true flips (emit adds for currently false)
    for (const tuple of flips.true) {
      const tupleKey = tuple.toBytes().toString();
      if (this._truth.get(tupleKey) === false) {
        this._truth.set(tupleKey, true);
        outputAdds.add(tuple);
      }
    }
  }

  /**
   * Cold start for enumerable providers per design §8.1
   */
  coldStart() {
    if (this._mode !== 'enumerable') {
      throw new Error('Cold start only supported for enumerable providers');
    }

    const initialTuples = this._provider.enumerate();
    this._currentSet = new Set(initialTuples);
    
    return new Delta(initialTuples, new Set());
  }

  /**
   * Get current set (for enumerable mode)
   */
  getCurrentSet() {
    if (this._mode !== 'enumerable') {
      throw new Error('getCurrentSet only available for enumerable mode');
    }
    return this._currentSet;
  }

  /**
   * Get watch set (for pointwise mode)
   */
  getWatchSet() {
    if (this._mode !== 'pointwise') {
      throw new Error('getWatchSet only available for pointwise mode');
    }
    return this._watchSet;
  }

  /**
   * Get truth map (for pointwise mode)
   */
  getTruthMap() {
    if (this._mode !== 'pointwise') {
      throw new Error('getTruthMap only available for pointwise mode');
    }
    return this._truth;
  }

  /**
   * Reset state
   */
  reset() {
    if (this._mode === 'enumerable') {
      this._currentSet.clear();
    } else {
      this._watchSet.clear();
      this._truth.clear();
    }
    this._lastStateHandle = this._provider.getCurrentStateHandle();
  }

  /**
   * Get state information
   */
  getState() {
    const baseState = {
      type: 'Compute',
      mode: this._mode,
      providerId: this._provider.id
    };

    if (this._mode === 'enumerable') {
      return {
        ...baseState,
        currentSetSize: this._currentSet.size,
        lastStateHandle: this._lastStateHandle
      };
    } else {
      return {
        ...baseState,
        watchSetSize: this._watchSet.size,
        truthMapSize: this._truth.size,
        lastStateHandle: this._lastStateHandle
      };
    }
  }

  toString() {
    return `Compute(${this._id}, ${this._mode}, ${this._provider.id})`;
  }

  /**
   * Handle incoming deltas from input nodes (for pointwise mode)
   */
  onDeltaReceived(sourceNode, delta) {
    this.pushDelta(delta);
  }

  /**
   * Override pushDelta to always emit for pointwise mode
   * Pointwise filters need to signal processing even with empty results
   */
  pushDelta(delta) {
    if (!(delta instanceof Delta)) {
      throw new Error('Must push a Delta instance');
    }

    // Process the delta using our implementation
    const outputDelta = this.processDelta(delta);

    // For pointwise mode, always emit (even empty deltas) to signal processing
    // For enumerable mode, follow standard Node behavior (skip empty deltas)
    const shouldEmit = this._mode === 'pointwise' || (outputDelta && !outputDelta.isEmpty());

    if (shouldEmit && outputDelta) {
      for (const outputNode of this._outputs) {
        if (outputNode._onDeltaReceived) {
          outputNode._onDeltaReceived(this, outputDelta);
        } else if (outputNode.onDeltaReceived) {
          outputNode.onDeltaReceived(this, outputDelta);
        }
      }
    }
  }
}