import { Tuple } from './Tuple.js';

/**
 * Delta implementation per design §6
 * ΔR = {adds ⊆ R, removes ⊆ R} with normalization logic
 */
export class Delta {
  constructor(adds = new Set(), removes = new Set()) {
    if (!(adds instanceof Set)) {
      throw new Error('Adds must be a Set');
    }
    if (!(removes instanceof Set)) {
      throw new Error('Removes must be a Set');
    }

    // Validate all elements are Tuples
    for (const tuple of adds) {
      if (!(tuple instanceof Tuple)) {
        throw new Error('All delta elements must be Tuple instances');
      }
    }
    for (const tuple of removes) {
      if (!(tuple instanceof Tuple)) {
        throw new Error('All delta elements must be Tuple instances');
      }
    }

    this._adds = new Set(adds);
    this._removes = new Set(removes);
    Object.freeze(this);
  }

  get adds() {
    return this._adds;
  }

  get removes() {
    return this._removes;
  }

  isEmpty() {
    return this._adds.size === 0 && this._removes.size === 0;
  }

  /**
   * Normalization per design §6.1
   * 1. Deduplicate within adds and removes (Set semantics handle this automatically)
   * 2. Cancel opposites: adds := adds - removes, removes := removes - adds
   */
  normalize() {
    // Find intersections for cancellation
    const toCancel = new Set();
    for (const tuple of this._adds) {
      if (this._removes.has(tuple)) {
        toCancel.add(tuple);
      }
    }

    // Create new sets with cancellations removed
    const newAdds = new Set();
    const newRemoves = new Set();

    for (const tuple of this._adds) {
      if (!toCancel.has(tuple)) {
        newAdds.add(tuple);
      }
    }

    for (const tuple of this._removes) {
      if (!toCancel.has(tuple)) {
        newRemoves.add(tuple);
      }
    }

    return new Delta(newAdds, newRemoves);
  }

  /**
   * Merge two deltas by combining their adds and removes
   */
  merge(other) {
    if (!(other instanceof Delta)) {
      throw new Error('Can only merge with another Delta');
    }

    const newAdds = new Set([...this._adds, ...other._adds]);
    const newRemoves = new Set([...this._removes, ...other._removes]);
    
    return new Delta(newAdds, newRemoves);
  }

  /**
   * Get all tuples (adds and removes combined)
   */
  getAllTuples() {
    return new Set([...this._adds, ...this._removes]);
  }

  /**
   * Create delta with only adds
   */
  static fromAdds(adds) {
    return new Delta(adds, new Set());
  }

  /**
   * Create delta with only removes
   */
  static fromRemoves(removes) {
    return new Delta(new Set(), removes);
  }

  /**
   * String representation for debugging
   */
  toString() {
    const addsStr = Array.from(this._adds).map(t => `+${t.toString()}`);
    const removesStr = Array.from(this._removes).map(t => `-${t.toString()}`);
    return `Delta{${[...addsStr, ...removesStr].join(', ')}}`;
  }
}