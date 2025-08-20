import { Delta } from './Delta.js';

/**
 * Abstract base class for computed predicate providers per design §8
 * Provides external predicates to the engine via standardized interfaces
 */
export class ComputeProvider {
  constructor(id) {
    if (this.constructor === ComputeProvider) {
      throw new Error('ComputeProvider is abstract and cannot be instantiated');
    }
    
    if (typeof id !== 'string') {
      throw new Error('Provider ID must be a string');
    }
    
    this._id = id;
  }

  get id() {
    return this._id;
  }

  /**
   * Get the mode of this provider
   * @returns {'enumerable'|'pointwise'}
   */
  getMode() {
    throw new Error('Subclass must implement getMode()');
  }
}

/**
 * Enumerable provider per design §8.1
 * Supplies complete deltas per batch, behaves like a scan node
 */
export class EnumerableProvider extends ComputeProvider {
  constructor(id) {
    super(id);
    this._stateHandle = 0;
  }

  getMode() {
    return 'enumerable';
  }

  /**
   * Optional cold start - enumerate all current tuples
   * @returns {Set<Tuple>}
   */
  enumerate() {
    throw new Error('Subclass must implement enumerate()');
  }

  /**
   * Get delta since last state handle per design §8.1
   * @param {number} stateHandle - Previous state handle
   * @returns {{adds: Set<Tuple>, removes: Set<Tuple>}}
   */
  deltaSince(stateHandle) {
    throw new Error('Subclass must implement deltaSince()');
  }

  /**
   * Get current state handle for tracking changes
   * @returns {number}
   */
  getCurrentStateHandle() {
    return this._stateHandle;
  }

  /**
   * Advance state handle (called by engine after processing)
   */
  _advanceState() {
    this._stateHandle++;
  }
}

/**
 * Pointwise provider per design §8.2
 * Evaluates predicates on bound tuples, supports truth flips
 */
export class PointwiseProvider extends ComputeProvider {
  constructor(id) {
    super(id);
    this._stateHandle = 0;
  }

  getMode() {
    return 'pointwise';
  }

  /**
   * Evaluate many candidates and return those that are true now per design §8.2
   * @param {Set<Tuple>} candidates - Tuples to evaluate
   * @returns {Set<Tuple>} - Subset that are currently true
   */
  evalMany(candidates) {
    throw new Error('Subclass must implement evalMany()');
  }

  /**
   * Optional: Get truth flips since last state per design §8.2
   * @param {number} stateHandle - Previous state handle
   * @param {Set<Tuple>} watched - Currently watched tuples
   * @returns {{true: Set<Tuple>, false: Set<Tuple>}} - Truth transitions
   */
  flipsSince(stateHandle, watched) {
    // Default implementation: no flips
    return { true: new Set(), false: new Set() };
  }

  /**
   * Check if this provider supports flip tracking
   * @returns {boolean}
   */
  supportsFlips() {
    // Check if flipsSince is overridden
    return this.flipsSince !== PointwiseProvider.prototype.flipsSince;
  }

  /**
   * Get current state handle for tracking changes
   * @returns {number}
   */
  getCurrentStateHandle() {
    return this._stateHandle;
  }

  /**
   * Advance state handle (called by engine after processing)
   */
  _advanceState() {
    this._stateHandle++;
  }
}