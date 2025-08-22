/**
 * ImmutableInTrie - Immutable trie for backward traversal (dst -> src)
 * Per design §3.4: Immutable InTrie with copy-on-write semantics
 * 
 * Immutable version of InTrie that stores relationships for backward traversal.
 * Every mutation returns a new instance, never modifies existing state.
 */

import { ImmutableTrieNode } from './ImmutableTrieNode.js';
import { Edge } from '../Edge.js';

/**
 * Immutable InTrie with copy-on-write semantics
 * All mutations return new instances, never modify existing state
 */
export class ImmutableInTrie {
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
   * Returns new ImmutableInTrie, never mutates this
   * Note: InTrie stores dst -> src (reversed from OutTrie)
   */
  withAddedEdge(edge) {
    this._validateEdge(edge);
    
    // Check if edge already exists
    if (this.contains(edge)) {
      return this; // Immutable - can return same instance
    }
    
    // Navigate to dst node (depth 1) - note: reversed for InTrie
    let newRoot = this._root;
    if (!newRoot.hasChild(edge.dst)) {
      newRoot = newRoot.withAddedChild(edge.dst);
    }
    const dstNode = newRoot.getChild(edge.dst);
    
    // Navigate to src node (depth 2) - note: reversed for InTrie
    let updatedDstNode = dstNode;
    if (!dstNode.hasChild(edge.src)) {
      updatedDstNode = dstNode.withAddedChild(edge.src);
      newRoot = newRoot.withUpdatedChild(edge.dst, updatedDstNode);
    }
    
    // Get the src node and add witness
    const srcNode = updatedDstNode.getChild(edge.src);
    
    // Mark as leaf and add witness if not already present
    let finalSrcNode = srcNode;
    if (!finalSrcNode.isLeaf) {
      finalSrcNode = finalSrcNode.withLeafMarking(true);
    }
    
    // Check if witness already exists using edge equality
    const existingWitnesses = finalSrcNode.getWitnesses();
    const hadWitness = existingWitnesses.some(w => w.equals && w.equals(edge));
    
    if (!hadWitness) {
      finalSrcNode = finalSrcNode.withAddedWitness(edge);
      
      // Update the tree structure
      const finalDstNode = updatedDstNode.withUpdatedChild(edge.src, finalSrcNode);
      const finalRoot = newRoot.withUpdatedChild(edge.dst, finalDstNode);
      
      return new ImmutableInTrie(
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
    
    // Find dst node (first level in InTrie)
    const dstNode = this._root.getChild(edge.dst);
    if (!dstNode) {
      return this; // Edge doesn't exist
    }
    
    // Find src node (second level in InTrie)
    const srcNode = dstNode.getChild(edge.src);
    if (!srcNode) {
      return this; // Edge doesn't exist
    }
    
    // Find and remove witness using edge equality
    const witnesses = srcNode.getWitnesses();
    const witnessToRemove = witnesses.find(w => w.equals && w.equals(edge));
    
    if (!witnessToRemove) {
      return this; // Witness doesn't exist
    }
    
    // Remove witness from src node
    let newSrcNode = srcNode.withRemovedWitness(witnessToRemove);
    let newDstNode = dstNode;
    let newRoot = this._root;
    
    // Clean up empty nodes
    if (!newSrcNode.hasWitnesses()) {
      // Unmark as leaf if no witnesses remain
      newSrcNode = newSrcNode.withLeafMarking(false);
      
      // Remove src node if it can be removed
      if (newSrcNode.canBeRemoved()) {
        // Create new dst node without this src child
        const newDstChildren = new Map();
        for (const [childValue, childNode] of dstNode.getAllChildren()) {
          if (childValue !== edge.src) {
            newDstChildren.set(childValue, childNode);
          }
        }
        newDstNode = new ImmutableTrieNode(
          dstNode.value,
          dstNode.depth,
          newDstChildren,
          new Set(dstNode.getWitnesses()),
          dstNode.isLeaf
        );
      } else {
        newDstNode = dstNode.withUpdatedChild(edge.src, newSrcNode);
      }
    } else {
      newDstNode = dstNode.withUpdatedChild(edge.src, newSrcNode);
    }
    
    // Check if dst node can be removed
    if (newDstNode.canBeRemoved()) {
      // Create new root without this dst child
      const newRootChildren = new Map();
      for (const [childValue, childNode] of this._root.getAllChildren()) {
        if (childValue !== edge.dst) {
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
      newRoot = this._root.withUpdatedChild(edge.dst, newDstNode);
    }
    
    return new ImmutableInTrie(
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

    const dstNode = this._root.getChild(edge.dst);
    if (!dstNode) {
      return false;
    }

    const srcNode = dstNode.getChild(edge.src);
    if (!srcNode) {
      return false;
    }

    const witnesses = srcNode.getWitnesses();
    return witnesses.some(w => w.equals && w.equals(edge));
  }

  /**
   * Get all sources for a given destination
   * Per design: Core operation for backward traversal
   */
  getSourcesForDestination(dst) {
    const dstNode = this._root.getChild(dst);
    if (!dstNode) {
      return [];
    }

    return dstNode.getChildValues();
  }

  /**
   * Get all edges for a given destination
   */
  getEdgesForDestination(dst) {
    const dstNode = this._root.getChild(dst);
    if (!dstNode) {
      return [];
    }

    const edges = [];
    for (const src of dstNode.getChildValues()) {
      const srcNode = dstNode.getChild(src);
      edges.push(...srcNode.getWitnesses());
    }

    return edges;
  }

  /**
   * Get all destinations in the trie
   */
  getAllDestinations() {
    return this._root.getChildValues();
  }

  /**
   * Get all edges in the trie
   */
  getAllEdges() {
    const edges = [];
    
    for (const dst of this._root.getChildValues()) {
      const dstNode = this._root.getChild(dst);
      for (const src of dstNode.getChildValues()) {
        const srcNode = dstNode.getChild(src);
        edges.push(...srcNode.getWitnesses());
      }
    }

    return edges;
  }

  /**
   * Check if destination exists in trie
   */
  hasDestination(dst) {
    return this._root.hasChild(dst);
  }

  /**
   * Check if destination-source pair exists
   */
  hasPath(dst, src) {
    const dstNode = this._root.getChild(dst);
    if (!dstNode) {
      return false;
    }

    return dstNode.hasChild(src);
  }

  /**
   * Get witness count for a destination-source pair
   */
  getWitnessCount(dst, src) {
    const dstNode = this._root.getChild(dst);
    if (!dstNode) {
      return 0;
    }

    const srcNode = dstNode.getChild(src);
    if (!srcNode) {
      return 0;
    }

    return srcNode.getWitnessCount();
  }

  // === LEAPFROG OPERATIONS ===

  /**
   * Seek operation for leapfrog join
   * Find first source >= target for given destination
   */
  seek(dst, targetSrc) {
    const dstNode = this._root.getChild(dst);
    if (!dstNode) {
      return null;
    }

    const srcNode = dstNode.seekChild(targetSrc);
    return srcNode ? srcNode.value : null;
  }

  /**
   * Next operation for leapfrog join
   * Get next source after current for given destination
   */
  next(dst, currentSrc) {
    const dstNode = this._root.getChild(dst);
    if (!dstNode) {
      return null;
    }

    return dstNode.getNextChildValue(currentSrc);
  }

  /**
   * Min operation for leapfrog join
   * Get minimum source for given destination
   */
  min(dst) {
    const dstNode = this._root.getChild(dst);
    if (!dstNode) {
      return null;
    }

    return dstNode.getMinChildValue();
  }

  /**
   * Max operation for leapfrog join
   * Get maximum source for given destination
   */
  max(dst) {
    const dstNode = this._root.getChild(dst);
    if (!dstNode) {
      return null;
    }

    return dstNode.getMaxChildValue();
  }

  // === VALIDATION AND STATISTICS ===

  /**
   * Get statistics about the trie
   */
  getStatistics() {
    const rootStats = this._root.getStatistics();
    const destinationCount = this._root.getChildCount();
    
    let sourceCount = 0;
    let totalPaths = 0;
    
    for (const dst of this._root.getChildValues()) {
      const dstNode = this._root.getChild(dst);
      sourceCount += dstNode.getChildCount();
      totalPaths += dstNode.getChildCount();
    }

    return {
      relationName: this._relationName,
      edgeCount: this._size,
      destinationCount,
      sourceCount,
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
    
    // Additional InTrie-specific validations
    let witnessCount = 0;
    for (const dst of this._root.getChildValues()) {
      const dstNode = this._root.getChild(dst);
      if (dstNode.depth !== 1) {
        issues.push(`Destination node depth should be 1, got ${dstNode.depth}`);
      }
      
      for (const src of dstNode.getChildValues()) {
        const srcNode = dstNode.getChild(src);
        if (srcNode.depth !== 2) {
          issues.push(`Source node depth should be 2, got ${srcNode.depth}`);
        }
        if (!srcNode.isLeaf) {
          issues.push(`Source node should be marked as leaf`);
        }
        witnessCount += srcNode.getWitnessCount();
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
    return `ImmutableInTrie(${this._relationName}, edges=${this._size}, destinations=${this._root.getChildCount()})`;
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