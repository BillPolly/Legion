/**
 * TrieNode for prefix-based indexing
 * Per design §2: Out/In Tries Infrastructure for LFTJ kernel support
 * 
 * Implements trie nodes for efficient prefix traversal as required by the
 * Leapfrog Triejoin algorithm. Each node maintains sorted children and
 * witness sets for exact matches.
 */

/**
 * TrieNode represents a node in the prefix trie structure
 * Per design §2.1: Supports prefix-based traversal for kernel operations
 */
export class TrieNode {
  constructor(value = null) {
    this._value = value;           // The value at this node (null for root/intermediate)
    this._children = new Map();    // value -> TrieNode (sorted by insertion order for now)
    this._witnesses = new Set();   // Set of complete tuples/edges that pass through this node
    this._isLeaf = false;          // True if this node represents a complete path
    this._depth = 0;               // Depth in the trie (0 for root)
  }

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

  /**
   * Mark this node as a leaf (complete path)
   */
  markAsLeaf() {
    this._isLeaf = true;
  }

  /**
   * Set the depth of this node
   */
  setDepth(depth) {
    this._depth = depth;
  }

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
   * Add or get child node for given value
   * Creates new child if it doesn't exist
   */
  addChild(value) {
    if (!this._children.has(value)) {
      const child = new TrieNode(value);
      child.setDepth(this._depth + 1);
      this._children.set(value, child);
    }
    return this._children.get(value);
  }

  /**
   * Remove child node for given value
   * Returns true if child was removed, false if it didn't exist
   */
  removeChild(value) {
    return this._children.delete(value);
  }

  /**
   * Get all children as Map
   */
  getAllChildren() {
    return new Map(this._children);
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
   * Add witness (complete tuple) to this node
   * Per design: Witnesses track complete tuples that pass through this prefix
   */
  addWitness(witness) {
    if (!witness) {
      throw new Error('Witness is required');
    }
    this._witnesses.add(witness);
  }

  /**
   * Remove witness from this node
   */
  removeWitness(witness) {
    return this._witnesses.delete(witness);
  }

  /**
   * Check if witness exists at this node
   */
  hasWitness(witness) {
    return this._witnesses.has(witness);
  }

  /**
   * Get all witnesses at this node
   */
  getWitnesses() {
    return Array.from(this._witnesses);
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

  /**
   * Clear all witnesses from this node
   */
  clearWitnesses() {
    this._witnesses.clear();
  }

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

  /**
   * Check if this node can be safely removed
   * A node can be removed if it has no witnesses and no children
   */
  canBeRemoved() {
    return !this.hasWitnesses() && !this.hasChildren() && !this.isLeaf;
  }

  /**
   * Get string representation for debugging
   */
  toString() {
    const childCount = this.getChildCount();
    const witnessCount = this.getWitnessCount();
    const leafMarker = this.isLeaf ? ' [LEAF]' : '';
    
    return `TrieNode(value=${this._value}, depth=${this._depth}, children=${childCount}, witnesses=${witnessCount}${leafMarker})`;
  }

  /**
   * Get detailed tree representation (for debugging)
   */
  toTreeString(indent = 0) {
    const prefix = '  '.repeat(indent);
    let result = `${prefix}${this.toString()}\n`;
    
    const childValues = this.getChildValues();
    for (const childValue of childValues) {
      const child = this._children.get(childValue);
      result += child.toTreeString(indent + 1);
    }
    
    return result;
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
}