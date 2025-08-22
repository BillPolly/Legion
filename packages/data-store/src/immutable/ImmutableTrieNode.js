/**
 * ImmutableTrieNode - Immutable trie node for prefix-based indexing
 * Per design §3.2: Immutable TrieNode with copy-on-write semantics
 * 
 * Immutable version of TrieNode that supports efficient prefix traversal
 * for Leapfrog Triejoin operations. Every mutation returns a new instance.
 */

/**
 * Immutable trie node with copy-on-write semantics
 * All mutations return new instances, never modify existing state
 */
export class ImmutableTrieNode {
  constructor(
    value = null,
    depth = 0,
    children = new Map(),      // value -> ImmutableTrieNode
    witnesses = new Set(),     // Set of complete tuples/edges
    isLeaf = false             // True if this represents a complete path
  ) {
    // Validate constructor parameters
    this._validateConstructorParams(value, depth, children, witnesses, isLeaf);

    this._value = value;
    this._depth = depth;
    this._children = this._freezeMap(children);
    this._witnesses = this._freezeSet(witnesses);
    this._isLeaf = isLeaf;
    
    // Make completely immutable
    Object.freeze(this);
  }

  // === CORE PROPERTIES ===

  /**
   * Get the value at this node
   */
  get value() {
    return this._value;
  }

  /**
   * Get the depth of this node
   */
  get depth() {
    return this._depth;
  }

  /**
   * Check if this is a leaf node (complete path)
   */
  get isLeaf() {
    return this._isLeaf;
  }

  // === IMMUTABLE MUTATION METHODS ===

  /**
   * Create new node with added child (pure function)
   * Returns new ImmutableTrieNode, never mutates this
   */
  withAddedChild(childValue) {
    this._validateChildValue(childValue);
    
    // Early return if child already exists
    if (this._children.has(childValue)) {
      return this; // Immutable - can return same instance
    }
    
    // Create new child node
    const newChild = new ImmutableTrieNode(childValue, this._depth + 1);
    
    // Copy-on-write: only copy what changes
    const newChildren = new Map(this._children);
    newChildren.set(childValue, newChild);
    
    // Create new node with updated children
    return new ImmutableTrieNode(
      this._value,
      this._depth,
      newChildren,
      this._witnesses,  // Unchanged, can reuse
      this._isLeaf
    );
  }

  /**
   * Create new node with updated child (pure function)
   * Replaces existing child with new instance
   */
  withUpdatedChild(childValue, newChild) {
    this._validateChildValue(childValue);
    this._validateChildNode(newChild);
    
    // Validate child exists
    if (!this._children.has(childValue)) {
      throw new Error(`Child ${childValue} does not exist`);
    }
    
    // Validate child properties
    if (newChild.value !== childValue) {
      throw new Error('Child value mismatch: expected ' + childValue + ', got ' + newChild.value);
    }
    if (newChild.depth !== this._depth + 1) {
      throw new Error('Child depth mismatch: expected ' + (this._depth + 1) + ', got ' + newChild.depth);
    }
    
    // Early return if child is same instance
    if (this._children.get(childValue) === newChild) {
      return this; // No change needed
    }
    
    // Copy-on-write: update children
    const newChildren = new Map(this._children);
    newChildren.set(childValue, newChild);
    
    return new ImmutableTrieNode(
      this._value,
      this._depth,
      newChildren,
      this._witnesses,  // Unchanged, can reuse
      this._isLeaf
    );
  }

  /**
   * Create new node with added witness (pure function)
   */
  withAddedWitness(witness) {
    this._validateWitness(witness);
    
    // Early return if witness already exists
    if (this._witnesses.has(witness)) {
      return this; // Immutable - can return same instance
    }
    
    // Copy-on-write: only copy what changes
    const newWitnesses = new Set(this._witnesses);
    newWitnesses.add(witness);
    
    return new ImmutableTrieNode(
      this._value,
      this._depth,
      this._children,   // Unchanged, can reuse
      newWitnesses,
      this._isLeaf
    );
  }

  /**
   * Create new node with removed witness (pure function)
   */
  withRemovedWitness(witness) {
    this._validateWitness(witness);
    
    // Early return if witness doesn't exist
    if (!this._witnesses.has(witness)) {
      return this; // No change needed
    }
    
    // Copy-on-write: create new witness set
    const newWitnesses = new Set(this._witnesses);
    newWitnesses.delete(witness);
    
    return new ImmutableTrieNode(
      this._value,
      this._depth,
      this._children,   // Unchanged, can reuse
      newWitnesses,
      this._isLeaf
    );
  }

  /**
   * Create new node with leaf marking (pure function)
   */
  withLeafMarking(isLeaf) {
    // Early return if no change needed
    if (this._isLeaf === isLeaf) {
      return this; // No change needed
    }
    
    return new ImmutableTrieNode(
      this._value,
      this._depth,
      this._children,   // Unchanged, can reuse
      this._witnesses,  // Unchanged, can reuse
      isLeaf
    );
  }

  // === READ-ONLY ACCESSORS ===

  /**
   * Get all child values in sorted order
   * Per design: Leapfrog requires sorted access to children
   */
  getChildValues() {
    return Array.from(this._children.keys()).sort((a, b) => this._compareValues(a, b));
  }

  /**
   * Get child node for given value
   */
  getChild(value) {
    return this._children.get(value);
  }

  /**
   * Check if child exists for given value
   */
  hasChild(value) {
    return this._children.has(value);
  }

  /**
   * Get all children as immutable Map
   */
  getAllChildren() {
    return this._children;
  }

  /**
   * Get number of children
   */
  getChildCount() {
    return this._children.size;
  }

  /**
   * Check if this node has any children
   */
  hasChildren() {
    return this._children.size > 0;
  }

  /**
   * Get all witnesses as array
   */
  getWitnesses() {
    return Array.from(this._witnesses);
  }

  /**
   * Check if witness exists at this node
   */
  hasWitness(witness) {
    return this._witnesses.has(witness);
  }

  /**
   * Get witness count
   */
  getWitnessCount() {
    return this._witnesses.size;
  }

  /**
   * Check if this node has any witnesses
   */
  hasWitnesses() {
    return this._witnesses.size > 0;
  }

  // === LEAPFROG NAVIGATION METHODS ===

  /**
   * Find child with value >= given value (for leapfrog seek operation)
   * Per design: Leapfrog requires efficient seek to next valid value
   */
  seekChild(targetValue) {
    const childValues = this.getChildValues();
    
    // Binary search for first value >= targetValue
    let left = 0;
    let right = childValues.length - 1;
    let result = null;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const midValue = childValues[mid];
      
      if (this._compareValues(midValue, targetValue) >= 0) {
        result = midValue;
        right = mid - 1;
      } else {
        left = mid + 1;
      }
    }

    return result ? this._children.get(result) : null;
  }

  /**
   * Get next child value after given value (for leapfrog next operation)
   */
  getNextChildValue(currentValue) {
    const childValues = this.getChildValues();
    const currentIndex = childValues.indexOf(currentValue);
    
    if (currentIndex === -1 || currentIndex >= childValues.length - 1) {
      return null;
    }
    
    return childValues[currentIndex + 1];
  }

  /**
   * Get minimum child value (for leapfrog min operation)
   */
  getMinChildValue() {
    const childValues = this.getChildValues();
    return childValues.length > 0 ? childValues[0] : null;
  }

  /**
   * Get maximum child value (for leapfrog max operation)
   */
  getMaxChildValue() {
    const childValues = this.getChildValues();
    return childValues.length > 0 ? childValues[childValues.length - 1] : null;
  }

  // === UTILITY METHODS ===

  /**
   * Check if this node can be safely removed
   * A node can be removed if it has no witnesses and no children
   */
  canBeRemoved() {
    return !this.hasWitnesses() && !this.hasChildren() && !this.isLeaf;
  }

  /**
   * Collect statistics about this subtree
   */
  getStatistics() {
    let nodeCount = 1;
    let leafCount = this.isLeaf ? 1 : 0;
    let witnessCount = this.getWitnessCount();
    let maxDepth = this.depth;

    for (const child of this._children.values()) {
      const childStats = child.getStatistics();
      nodeCount += childStats.nodeCount;
      leafCount += childStats.leafCount;
      witnessCount += childStats.witnessCount;
      maxDepth = Math.max(maxDepth, childStats.maxDepth);
    }

    return {
      nodeCount,
      leafCount,
      witnessCount,
      maxDepth,
      minDepth: this.depth
    };
  }

  /**
   * Validate trie structure integrity
   * Returns array of issues found (empty if valid)
   */
  validateStructure() {
    const issues = [];

    // Check depth consistency
    for (const [value, child] of this._children) {
      if (child.value !== value) {
        issues.push(`Child value mismatch: expected ${value}, got ${child.value}`);
      }
      if (child.depth !== this.depth + 1) {
        issues.push(`Child depth incorrect: expected ${this.depth + 1}, got ${child.depth}`);
      }

      // Recursively validate children
      const childIssues = child.validateStructure();
      issues.push(...childIssues);
    }

    return issues;
  }

  /**
   * Get string representation for debugging
   */
  toString() {
    const childCount = this.getChildCount();
    const witnessCount = this.getWitnessCount();
    const leafMarker = this.isLeaf ? ' [LEAF]' : '';
    
    return `ImmutableTrieNode(value=${this._value}, depth=${this._depth}, children=${childCount}, witnesses=${witnessCount}${leafMarker})`;
  }

  // === PRIVATE METHODS ===

  /**
   * Validate constructor parameters
   */
  _validateConstructorParams(value, depth, children, witnesses, isLeaf) {
    if (typeof depth !== 'number' || depth < 0) {
      throw new Error('Depth must be a non-negative number');
    }
    if (!(children instanceof Map)) {
      throw new Error('Children must be a Map');
    }
    if (!(witnesses instanceof Set)) {
      throw new Error('Witnesses must be a Set');
    }
    if (typeof isLeaf !== 'boolean') {
      throw new Error('isLeaf must be a boolean');
    }
  }

  /**
   * Validate child value parameter
   */
  _validateChildValue(childValue) {
    if (childValue === undefined) {
      throw new Error('Child value is required');
    }
  }

  /**
   * Validate child node parameter
   */
  _validateChildNode(childNode) {
    if (!(childNode instanceof ImmutableTrieNode)) {
      throw new Error('Child must be an ImmutableTrieNode instance');
    }
  }

  /**
   * Validate witness parameter
   */
  _validateWitness(witness) {
    if (witness === null || witness === undefined) {
      throw new Error('Witness is required');
    }
  }

  /**
   * Create truly immutable map wrapper
   */
  _freezeMap(map) {
    const frozenMap = new Map(map);
    
    // Override mutating methods to throw errors
    const mutatingMethods = ['set', 'delete', 'clear'];
    mutatingMethods.forEach(method => {
      frozenMap[method] = () => {
        throw new Error(`Cannot ${method} on immutable Map`);
      };
    });
    
    Object.freeze(frozenMap);
    return frozenMap;
  }

  /**
   * Create truly immutable set wrapper
   */
  _freezeSet(set) {
    const frozenSet = new Set(set);
    
    // Override mutating methods to throw errors
    const mutatingMethods = ['add', 'delete', 'clear'];
    mutatingMethods.forEach(method => {
      frozenSet[method] = () => {
        throw new Error(`Cannot ${method} on immutable Set`);
      };
    });
    
    Object.freeze(frozenSet);
    return frozenSet;
  }

  /**
   * Compare two values for sorting
   * Handles mixed types consistently
   */
  _compareValues(a, b) {
    // Handle null/undefined - they sort first
    const aIsNullish = a === null || a === undefined;
    const bIsNullish = b === null || b === undefined;
    
    if (aIsNullish && bIsNullish) {
      // Both nullish: null comes before undefined
      if (a === null && b === undefined) return -1;
      if (a === undefined && b === null) return 1;
      return 0;
    }
    
    if (aIsNullish) return -1; // null/undefined sorts first
    if (bIsNullish) return 1;

    // Same type comparison
    if (typeof a === typeof b) {
      if (a < b) return -1;
      if (a > b) return 1;
      return 0;
    }

    // Mixed type: numbers before strings before others
    const aType = typeof a;
    const bType = typeof b;
    
    if (aType === 'number' && bType !== 'number') return -1;
    if (bType === 'number' && aType !== 'number') return 1;
    
    if (aType === 'string' && bType !== 'string' && bType !== 'number') return -1;
    if (bType === 'string' && aType !== 'string' && aType !== 'number') return 1;

    // Fallback: convert to strings for consistent ordering
    const aStr = String(a);
    const bStr = String(b);
    if (aStr < bStr) return -1;
    if (aStr > bStr) return 1;
    return 0;
  }
}