import { Node } from './Node.js';
import { Schema } from './Schema.js';

/**
 * Scan operator per design §4.1 and §7.1
 * Exposes an input relation R
 */
export class ScanNode extends Node {
  constructor(id, relationName, schema, maintainState = false) {
    super(id);

    if (typeof relationName !== 'string') {
      throw new Error('Relation name must be a string');
    }
    if (!(schema instanceof Schema)) {
      throw new Error('Schema must be a Schema instance');
    }

    this._relationName = relationName;
    this._schema = schema;
    this._maintainState = maintainState;
    this._currentSet = maintainState ? new Set() : null;
  }

  get relationName() {
    return this._relationName;
  }

  get schema() {
    return this._schema;
  }

  get maintainsState() {
    return this._maintainState;
  }

  /**
   * Process delta per design §7.1:
   * Emit ΔR as received (after dedup) and (optionally) update S_R
   */
  processDelta(delta) {
    // Normalize delta per §6.1
    const normalizedDelta = delta.normalize();

    // Update current set if maintaining state
    if (this._maintainState && this._currentSet) {
      // Apply: S_R := (S_R - removes) ∪ adds
      for (const tuple of normalizedDelta.removes) {
        this._currentSet.delete(tuple);
      }
      for (const tuple of normalizedDelta.adds) {
        this._currentSet.add(tuple);
      }
    }

    // Emit normalized delta
    return normalizedDelta;
  }

  /**
   * Get current set (if maintaining state)
   */
  getCurrentSet() {
    return this._currentSet;
  }

  /**
   * Reset state
   */
  reset() {
    if (this._maintainState && this._currentSet) {
      this._currentSet.clear();
    }
  }

  /**
   * Get state information
   */
  getState() {
    return {
      type: 'Scan',
      relationName: this._relationName,
      maintainsState: this._maintainState,
      currentSetSize: this._currentSet ? this._currentSet.size : null
    };
  }

  toString() {
    return `Scan(${this._id}, ${this._relationName})`;
  }
}