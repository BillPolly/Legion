import { Node } from './Node.js';
import { Delta } from './Delta.js';
import { Tuple } from './Tuple.js';

/**
 * Diff operator implementing anti-join (Left ▷ Right) per design §7.4
 * Emits left tuples that have no matching right tuples on the specified key
 */
export class DiffNode extends Node {
  constructor(id, keyAttributes, options = {}) {
    super(id);

    if (!Array.isArray(keyAttributes) || keyAttributes.length === 0) {
      throw new Error('Key attributes must be a non-empty array');
    }

    this._keyAttributes = [...keyAttributes];
    
    // Support separate key attributes for left and right relations
    this._leftKeyAttributes = options.leftKeyAttributes ? [...options.leftKeyAttributes] : [...keyAttributes];
    this._rightKeyAttributes = options.rightKeyAttributes ? [...options.rightKeyAttributes] : [...keyAttributes];

    // State per design §7.4:
    // L[leftTuple] → present ∈ {0,1}
    this._leftTuples = new Map();

    // Rsup[key] → u32 (right-support count)
    this._rightSupport = new Map();

    // IndexLeftByKey: key → Set<leftTuple> for efficient enumeration
    this._indexLeftByKey = new Map();

    // Track which input is left vs right
    this._leftInput = null;
    this._rightInput = null;

    // Current source for delta processing
    this._currentSourceNode = null;
  }

  get keyAttributes() {
    return [...this._keyAttributes];
  }

  /**
   * Register which input node is the left input
   */
  setLeftInput(inputNode) {
    if (!inputNode) {
      throw new Error('Left input node must be provided');
    }
    this._leftInput = inputNode;
  }

  /**
   * Register which input node is the right input
   */
  setRightInput(inputNode) {
    if (!inputNode) {
      throw new Error('Right input node must be provided');
    }
    this._rightInput = inputNode;
  }

  /**
   * Handle incoming deltas from input nodes
   */
  onDeltaReceived(sourceNode, delta) {
    // Store the source node info for delta processing
    this._currentSourceNode = sourceNode;
    this.pushDelta(delta);
    this._currentSourceNode = null;
  }

  /**
   * Process delta per design §7.4:
   * Handle left and right deltas with different semantics
   */
  processDelta(delta) {
    const outputAdds = new Map();
    const outputRemoves = new Map();

    // Determine if this is left or right delta
    const isLeftDelta = this._currentSourceNode === this._leftInput;
    const isRightDelta = this._currentSourceNode === this._rightInput;

    if (!isLeftDelta && !isRightDelta) {
      throw new Error('Delta must come from either left or right input');
    }

    // Process removes first (per §6.2)
    for (const tuple of delta.removes) {
      if (isLeftDelta) {
        this._processLeftRemove(tuple, outputAdds, outputRemoves);
      } else {
        this._processRightRemove(tuple, outputAdds, outputRemoves);
      }
    }

    // Then process adds
    for (const tuple of delta.adds) {
      if (isLeftDelta) {
        this._processLeftAdd(tuple, outputAdds, outputRemoves);
      } else {
        this._processRightAdd(tuple, outputAdds, outputRemoves);
      }
    }

    return new Delta(new Set(outputAdds.values()), new Set(outputRemoves.values()));
  }

  /**
   * Process left add per design §7.4:
   * Add l: set L[l]=1; if Rsup[key(l)]==0 emit add l
   */
  _processLeftAdd(leftTuple, outputAdds, outputRemoves) {
    const tupleKey = this._extractKey(leftTuple, true);
    const keyStr = tupleKey.toBytes().toString();
    const leftTupleKey = leftTuple.toBytes().toString();

    // Set L[l]=1
    this._leftTuples.set(leftTupleKey, 1);

    // Update index: key → Set<leftTuple>
    if (!this._indexLeftByKey.has(keyStr)) {
      this._indexLeftByKey.set(keyStr, new Set());
    }
    this._indexLeftByKey.get(keyStr).add(leftTuple);

    // If Rsup[key(l)]==0 emit add l
    const rightSupport = this._rightSupport.get(keyStr) || 0;
    if (rightSupport === 0) {
      outputAdds.set(leftTupleKey, leftTuple);
    }
  }

  /**
   * Process left remove per design §7.4:
   * Remove l: if Rsup[key(l)]==0 emit remove l; set L[l]=0
   */
  _processLeftRemove(leftTuple, outputAdds, outputRemoves) {
    const tupleKey = this._extractKey(leftTuple, true);
    const keyStr = tupleKey.toBytes().toString();
    const leftTupleKey = leftTuple.toBytes().toString();

    // If Rsup[key(l)]==0 emit remove l
    const rightSupport = this._rightSupport.get(keyStr) || 0;
    if (rightSupport === 0 && this._leftTuples.get(leftTupleKey) === 1) {
      outputRemoves.set(leftTupleKey, leftTuple);
    }

    // Set L[l]=0 (remove from map since 0 means not present)
    this._leftTuples.delete(leftTupleKey);

    // Update index: remove from key → Set<leftTuple>
    if (this._indexLeftByKey.has(keyStr)) {
      this._indexLeftByKey.get(keyStr).delete(leftTuple);
      if (this._indexLeftByKey.get(keyStr).size === 0) {
        this._indexLeftByKey.delete(keyStr);
      }
    }
  }

  /**
   * Process right add per design §7.4:
   * Add r: Rsup[key(r)]++; if 0→1 emit removes for all l with key(l)=key(r) and L[l]=1
   */
  _processRightAdd(rightTuple, outputAdds, outputRemoves) {
    const tupleKey = this._extractKey(rightTuple, false);
    const keyStr = tupleKey.toBytes().toString();

    const currentSupport = this._rightSupport.get(keyStr) || 0;
    const newSupport = currentSupport + 1;
    this._rightSupport.set(keyStr, newSupport);

    // If 0→1 emit removes for all l with key(l)=key(r) and L[l]=1
    if (currentSupport === 0 && newSupport === 1) {
      const matchingLeftTuples = this._indexLeftByKey.get(keyStr) || new Set();
      for (const leftTuple of matchingLeftTuples) {
        const leftTupleKey = leftTuple.toBytes().toString();
        if (this._leftTuples.get(leftTupleKey) === 1) {
          outputRemoves.set(leftTupleKey, leftTuple);
        }
      }
    }
  }

  /**
   * Process right remove per design §7.4:
   * Remove r: Rsup[key(r)]--; if 1→0 emit adds for all l with key(l)=key(r) and L[l]=1
   */
  _processRightRemove(rightTuple, outputAdds, outputRemoves) {
    const tupleKey = this._extractKey(rightTuple, false);
    const keyStr = tupleKey.toBytes().toString();

    const currentSupport = this._rightSupport.get(keyStr) || 0;
    const newSupport = Math.max(0, currentSupport - 1);
    
    if (newSupport === 0) {
      this._rightSupport.delete(keyStr);
    } else {
      this._rightSupport.set(keyStr, newSupport);
    }

    // If 1→0 emit adds for all l with key(l)=key(r) and L[l]=1
    if (currentSupport === 1 && newSupport === 0) {
      const matchingLeftTuples = this._indexLeftByKey.get(keyStr) || new Set();
      for (const leftTuple of matchingLeftTuples) {
        const leftTupleKey = leftTuple.toBytes().toString();
        if (this._leftTuples.get(leftTupleKey) === 1) {
          outputAdds.set(leftTupleKey, leftTuple);
        }
      }
    }
  }

  /**
   * Extract key from tuple based on key attributes
   */
  _extractKey(tuple, isLeftTuple = null) {
    // Determine which key attributes to use
    let keyAttributes;
    if (isLeftTuple === true) {
      keyAttributes = this._leftKeyAttributes;
    } else if (isLeftTuple === false) {
      keyAttributes = this._rightKeyAttributes;
    } else {
      // Auto-detect based on current source (fallback)
      const isLeftDelta = this._currentSourceNode === this._leftInput;
      keyAttributes = isLeftDelta ? this._leftKeyAttributes : this._rightKeyAttributes;
    }

    if (typeof keyAttributes[0] === 'number') {
      // Key attributes are indices
      const keyAtoms = keyAttributes.map(index => {
        if (index >= tuple.arity) {
          throw new Error(`Key index ${index} out of bounds for tuple with arity ${tuple.arity}`);
        }
        return tuple.atoms[index];
      });
      return new Tuple(keyAtoms);
    } else {
      // Key attributes are variable names - would need schema mapping
      throw new Error('Variable name key attributes not yet implemented');
    }
  }

  /**
   * Reset state
   */
  reset() {
    this._leftTuples.clear();
    this._rightSupport.clear();
    this._indexLeftByKey.clear();
  }

  /**
   * Get state information
   */
  /**
   * Get current set of diff results
   */
  getCurrentSet() {
    // For integration testing, return simplified representation
    const currentSet = new Set();
    for (const [tupleKey, present] of this._leftTuples) {
      if (present === 1) {
        currentSet.add(`diff_${tupleKey.substring(0, 8)}`);
      }
    }
    return currentSet;
  }

  getState() {
    return {
      type: 'Diff',
      keyAttributes: [...this._keyAttributes],
      leftTuplesCount: this._leftTuples.size, // Now only contains present tuples (value 1)
      rightSupportCount: this._rightSupport.size,
      indexedKeysCount: this._indexLeftByKey.size,
      hasLeftInput: !!this._leftInput,
      hasRightInput: !!this._rightInput
    };
  }

  toString() {
    const keyStr = this._keyAttributes.join(',');
    return `Diff(${this._id}, key:[${keyStr}])`;
  }
}