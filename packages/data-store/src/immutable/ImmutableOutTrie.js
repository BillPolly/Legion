/**
 * ImmutableOutTrie - Immutable trie for forward traversal (src -> dst)
 * Per design §3.4: Immutable OutTrie with copy-on-write semantics
 * 
 * Immutable version of OutTrie that stores relationships for forward traversal.
 * Every mutation returns a new instance, never modifies existing state.
 */

import { ImmutableTrieNode } from './ImmutableTrieNode.js';
import { Edge } from '../Edge.js';

/**
 * Immutable OutTrie with copy-on-write semantics
 * All mutations return new instances, never modify existing state
 */
export class ImmutableOutTrie {
  constructor(
    relationName,
    root = new ImmutableTrieNode(),
    size = 0
  ) {
    // Validate constructor parameters
    this._validateConstructorParams(relationName, root, size);

    this._relationName = relationName;
    this._root = root;
    this._size = size;
    
    // Make completely immutable
    Object.freeze(this);
  }

  // === CORE PROPERTIES ===

  /**
   * Get the relation name this trie represents
   */
  get relationName() {
    return this._relationName;
  }

  /**
   * Get the root node
   */
  get root() {
    return this._root;
  }

  /**
   * Get the number of edges stored in this trie
   */
  get size() {
    return this._size;
  }

  /**
   * Check if trie is empty
   */
  isEmpty() {
    return this._size === 0;
  }

  // === IMMUTABLE MUTATION METHODS ===

  /**
   * Create new trie with added edge (pure function)
   * Returns new ImmutableOutTrie, never mutates this
   */
  withAddedEdge(edge) {
    this._validateEdge(edge);
    
    // Check if edge already exists
    if (this.contains(edge)) {
      return this; // Immutable - can return same instance
    }
    
    // Navigate to src node (depth 1)
    let newRoot = this._root;
    if (!newRoot.hasChild(edge.src)) {
      newRoot = newRoot.withAddedChild(edge.src);
    }
    const srcNode = newRoot.getChild(edge.src);
    
    // Navigate to dst node (depth 2)
    let updatedSrcNode = srcNode;
    if (!srcNode.hasChild(edge.dst)) {
      updatedSrcNode = srcNode.withAddedChild(edge.dst);
      newRoot = newRoot.withUpdatedChild(edge.src, updatedSrcNode);
    }
    
    // Get the dst node and add witness
    const dstNode = updatedSrcNode.getChild(edge.dst);
    
    // Mark as leaf and add witness if not already present
    let finalDstNode = dstNode;
    if (!finalDstNode.isLeaf) {
      finalDstNode = finalDstNode.withLeafMarking(true);
    }
    
    // Check if witness already exists using edge equality
    const existingWitnesses = finalDstNode.getWitnesses();
    const hadWitness = existingWitnesses.some(w => w.equals && w.equals(edge));
    
    if (!hadWitness) {
      finalDstNode = finalDstNode.withAddedWitness(edge);
      
      // Update the tree structure
      const finalSrcNode = updatedSrcNode.withUpdatedChild(edge.dst, finalDstNode);
      const finalRoot = newRoot.withUpdatedChild(edge.src, finalSrcNode);
      
      return new ImmutableOutTrie(
        this._relationName,
        finalRoot,
        this._size + 1
      );
    }
    
    return this; // Witness already exists
  }

  /**
   * Create new trie with removed edge (pure function)
   */
  withRemovedEdge(edge) {
    this._validateEdge(edge);
    
    // Check if edge exists
    if (!this.contains(edge)) {
      return this; // No change needed
    }
    
    // Find src node
    const srcNode = this._root.getChild(edge.src);
    if (!srcNode) {
      return this; // Edge doesn't exist
    }
    
    // Find dst node
    const dstNode = srcNode.getChild(edge.dst);
    if (!dstNode) {
      return this; // Edge doesn't exist
    }
    
    // Find and remove witness using edge equality
    const witnesses = dstNode.getWitnesses();
    const witnessToRemove = witnesses.find(w => w.equals && w.equals(edge));
    
    if (!witnessToRemove) {
      return this; // Witness doesn't exist
    }
    
    // Remove witness from dst node
    let newDstNode = dstNode.withRemovedWitness(witnessToRemove);
    let newSrcNode = srcNode;
    let newRoot = this._root;
    
    // Clean up empty nodes
    if (!newDstNode.hasWitnesses()) {
      // Unmark as leaf if no witnesses remain
      newDstNode = newDstNode.withLeafMarking(false);
      
      // Remove dst node if it can be removed
      if (newDstNode.canBeRemoved()) {
        // Create a new src node without this dst child
        const newSrcChildren = new Map();
        for (const [childValue, childNode] of srcNode.getAllChildren()) {
          if (childValue !== edge.dst) {
            newSrcChildren.set(childValue, childNode);
          }
        }
        newSrcNode = new ImmutableTrieNode(
          srcNode.value,
          srcNode.depth,
          newSrcChildren,
          new Set(srcNode.getWitnesses()),
          srcNode.isLeaf
        );
      } else {
        newSrcNode = srcNode.withUpdatedChild(edge.dst, newDstNode);
      }
    } else {
      newSrcNode = srcNode.withUpdatedChild(edge.dst, newDstNode);
    }
    
    // Check if src node can be removed
    if (newSrcNode.canBeRemoved()) {
      // Create new root without this src child
      const newRootChildren = new Map();
      for (const [childValue, childNode] of this._root.getAllChildren()) {
        if (childValue !== edge.src) {
          newRootChildren.set(childValue, childNode);
        }
      }
      newRoot = new ImmutableTrieNode(
        this._root.value,
        this._root.depth,
        newRootChildren,
        new Set(this._root.getWitnesses()),
        this._root.isLeaf
      );
    } else {
      newRoot = this._root.withUpdatedChild(edge.src, newSrcNode);
    }
    
    return new ImmutableOutTrie(
      this._relationName,
      newRoot,
      this._size - 1
    );
  }

  // === READ-ONLY ACCESSORS ===

  /**
   * Check if an edge exists in the trie
   */
  contains(edge) {
    if (!edge || edge.src === undefined || edge.dst === undefined) {
      return false;
    }

    const srcNode = this._root.getChild(edge.src);
    if (!srcNode) {
      return false;
    }

    const dstNode = srcNode.getChild(edge.dst);
    if (!dstNode) {
      return false;
    }

    const witnesses = dstNode.getWitnesses();
    return witnesses.some(w => w.equals && w.equals(edge));
  }

  /**
   * Get all destinations for a given source
   * Per design: Core operation for forward traversal
   */
  getDestinationsForSource(src) {
    const srcNode = this._root.getChild(src);
    if (!srcNode) {
      return [];
    }

    return srcNode.getChildValues();
  }

  /**
   * Get all edges for a given source
   */
  getEdgesForSource(src) {
    const srcNode = this._root.getChild(src);
    if (!srcNode) {
      return [];
    }

    const edges = [];
    for (const dst of srcNode.getChildValues()) {
      const dstNode = srcNode.getChild(dst);
      edges.push(...dstNode.getWitnesses());
    }

    return edges;
  }

  /**
   * Get all sources in the trie
   */
  getAllSources() {
    return this._root.getChildValues();
  }

  /**
   * Get all edges in the trie
   */
  getAllEdges() {
    const edges = [];
    
    for (const src of this._root.getChildValues()) {
      const srcNode = this._root.getChild(src);
      for (const dst of srcNode.getChildValues()) {
        const dstNode = srcNode.getChild(dst);
        edges.push(...dstNode.getWitnesses());
      }
    }

    return edges;
  }

  /**
   * Check if source exists in trie
   */
  hasSource(src) {
    return this._root.hasChild(src);
  }

  /**
   * Check if source-destination pair exists
   */
  hasPath(src, dst) {
    const srcNode = this._root.getChild(src);
    if (!srcNode) {
      return false;
    }

    return srcNode.hasChild(dst);
  }

  /**
   * Get witness count for a source-destination pair
   */
  getWitnessCount(src, dst) {
    const srcNode = this._root.getChild(src);
    if (!srcNode) {
      return 0;
    }

    const dstNode = srcNode.getChild(dst);
    if (!dstNode) {
      return 0;
    }

    return dstNode.getWitnessCount();
  }

  // === LEAPFROG OPERATIONS ===

  /**
   * Seek operation for leapfrog join
   * Find first destination >= target for given source
   */
  seek(src, targetDst) {
    const srcNode = this._root.getChild(src);
    if (!srcNode) {
      return null;
    }

    const dstNode = srcNode.seekChild(targetDst);
    return dstNode ? dstNode.value : null;
  }

  /**
   * Next operation for leapfrog join
   * Get next destination after current for given source
   */
  next(src, currentDst) {
    const srcNode = this._root.getChild(src);
    if (!srcNode) {
      return null;
    }

    return srcNode.getNextChildValue(currentDst);
  }

  /**
   * Min operation for leapfrog join
   * Get minimum destination for given source
   */
  min(src) {
    const srcNode = this._root.getChild(src);
    if (!srcNode) {
      return null;
    }

    return srcNode.getMinChildValue();
  }

  /**
   * Max operation for leapfrog join
   * Get maximum destination for given source
   */
  max(src) {
    const srcNode = this._root.getChild(src);
    if (!srcNode) {
      return null;
    }

    return srcNode.getMaxChildValue();
  }

  // === VALIDATION AND STATISTICS ===

  /**
   * Get statistics about the trie
   */
  getStatistics() {
    const rootStats = this._root.getStatistics();
    const sourceCount = this._root.getChildCount();
    
    let destinationCount = 0;
    let totalPaths = 0;
    
    for (const src of this._root.getChildValues()) {
      const srcNode = this._root.getChild(src);
      destinationCount += srcNode.getChildCount();
      totalPaths += srcNode.getChildCount();
    }

    return {
      relationName: this._relationName,
      edgeCount: this._size,
      sourceCount,
      destinationCount,
      totalPaths,
      nodeCount: rootStats.nodeCount,
      maxDepth: rootStats.maxDepth
    };
  }

  /**
   * Validate trie structure
   */
  validateStructure() {
    const issues = this._root.validateStructure();
    
    // Additional OutTrie-specific validations
    let witnessCount = 0;
    for (const src of this._root.getChildValues()) {
      const srcNode = this._root.getChild(src);
      if (srcNode.depth !== 1) {
        issues.push(`Source node depth should be 1, got ${srcNode.depth}`);
      }
      
      for (const dst of srcNode.getChildValues()) {
        const dstNode = srcNode.getChild(dst);
        if (dstNode.depth !== 2) {
          issues.push(`Destination node depth should be 2, got ${dstNode.depth}`);
        }
        if (!dstNode.isLeaf) {
          issues.push(`Destination node should be marked as leaf`);
        }
        witnessCount += dstNode.getWitnessCount();
      }
    }

    if (witnessCount !== this._size) {
      issues.push(`Size mismatch: expected ${this._size}, counted ${witnessCount}`);
    }

    return issues;
  }

  /**
   * String representation for debugging
   */
  toString() {
    return `ImmutableOutTrie(${this._relationName}, edges=${this._size}, sources=${this._root.getChildCount()})`;
  }

  // === PRIVATE METHODS ===

  /**
   * Validate constructor parameters
   */
  _validateConstructorParams(relationName, root, size) {
    if (!relationName) {
      throw new Error('Relation name is required');
    }
    if (typeof relationName !== 'string') {
      throw new Error('Relation name must be a string');
    }
    if (!(root instanceof ImmutableTrieNode)) {
      throw new Error('Root must be an ImmutableTrieNode instance');
    }
    if (typeof size !== 'number' || size < 0) {
      throw new Error('Size must be a non-negative number');
    }
  }

  /**
   * Validate edge parameter
   */
  _validateEdge(edge) {
    if (!edge) {
      throw new Error('Edge is required');
    }
    if (!(edge instanceof Edge)) {
      throw new Error('Must be an Edge instance');
    }
    if (edge.src === undefined || edge.dst === undefined) {
      throw new Error('Edge must have src and dst');
    }
  }
}