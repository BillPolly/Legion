/**
 * InTrie for backward traversal (dst -> src)
 * Per design §2: Out/In Tries Infrastructure for LFTJ kernel support
 * 
 * InTrie stores relationships for backward traversal: given a destination,
 * find all sources. Used for kernel queries like R[?X, Y].
 */

import { TrieNode } from './TrieNode.js';

/**
 * InTrie represents a trie for backward relationship traversal
 * Per design §2.3: InTrie for dst -> src queries
 */
export class InTrie {
  constructor(relationName) {
    if (!relationName) {
      throw new Error('Relation name is required');
    }
    if (typeof relationName !== 'string') {
      throw new Error('Relation name must be a string');
    }
    
    this._relationName = relationName;
    this._root = new TrieNode();
    this._size = 0; // Number of complete paths (edges)
  }

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

  /**
   * Insert an edge into the trie
   * Per design: Store edge as path dst -> src with edge as witness
   */
  insert(edge) {
    if (!edge) {
      throw new Error('Edge is required');
    }
    if (edge.src === undefined || edge.dst === undefined) {
      throw new Error('Edge must have src and dst');
    }

    // Navigate to dst node (depth 1) - note: reversed for InTrie
    const dstNode = this._root.addChild(edge.dst);
    
    // Navigate to src node (depth 2) - note: reversed for InTrie
    const srcNode = dstNode.addChild(edge.src);
    
    // Mark as complete path and add edge as witness
    srcNode.markAsLeaf();
    
    // Check if this is a new edge using edge equality
    const existingWitnesses = srcNode.getWitnesses();
    const hadWitness = existingWitnesses.some(w => w.equals && w.equals(edge));
    
    if (!hadWitness) {
      srcNode.addWitness(edge);
      this._size++;
    }
  }

  /**
   * Remove an edge from the trie
   */
  remove(edge) {
    if (!edge) {
      throw new Error('Edge is required');
    }
    if (edge.src === undefined || edge.dst === undefined) {
      throw new Error('Edge must have src and dst');
    }

    // Find dst node (first level in InTrie)
    const dstNode = this._root.getChild(edge.dst);
    if (!dstNode) {
      return; // Edge doesn't exist
    }

    // Find src node (second level in InTrie)
    const srcNode = dstNode.getChild(edge.src);
    if (!srcNode) {
      return; // Edge doesn't exist
    }

    // Find and remove witness using edge equality
    const witnesses = srcNode.getWitnesses();
    const witnessToRemove = witnesses.find(w => w.equals && w.equals(edge));
    
    if (witnessToRemove) {
      srcNode.removeWitness(witnessToRemove);
      this._size--;
    }

    // Clean up nodes if they become empty
    this._cleanupEmptyNodes(dstNode, srcNode, edge.dst, edge.src);
  }

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

  /**
   * Clear all edges from the trie
   */
  clear() {
    this._root = new TrieNode();
    this._size = 0;
  }

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
   * Clean up empty nodes after removal
   */
  _cleanupEmptyNodes(dstNode, srcNode, dst, src) {
    // If source node has no witnesses, unmark as leaf and remove if possible
    if (!srcNode.hasWitnesses()) {
      // Unmark as leaf if no witnesses remain
      srcNode._isLeaf = false;
      
      // Now check if it can be removed
      if (srcNode.canBeRemoved()) {
        dstNode.removeChild(src);
      }
    }

    // If destination node has no children, it can be removed
    if (dstNode.canBeRemoved()) {
      this._root.removeChild(dst);
    }
  }

  /**
   * String representation for debugging
   */
  toString() {
    return `InTrie(${this._relationName}, edges=${this._size}, destinations=${this._root.getChildCount()})`;
  }

  /**
   * Get detailed tree representation
   */
  toTreeString() {
    return this._root.toTreeString();
  }
}