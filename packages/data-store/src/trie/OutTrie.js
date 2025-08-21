/**
 * OutTrie for forward traversal (src -> dst)
 * Per design §2: Out/In Tries Infrastructure for LFTJ kernel support
 * 
 * OutTrie stores relationships for forward traversal: given a source,
 * find all destinations. Used for kernel queries like R[X, ?Y].
 */

import { TrieNode } from './TrieNode.js';

/**
 * OutTrie represents a trie for forward relationship traversal
 * Per design §2.2: OutTrie for src -> dst queries
 */
export class OutTrie {
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
   * Per design: Store edge as path src -> dst with edge as witness
   */
  insert(edge) {
    if (!edge) {
      throw new Error('Edge is required');
    }
    if (edge.src === undefined || edge.dst === undefined) {
      throw new Error('Edge must have src and dst');
    }

    // Navigate to src node (depth 1)
    const srcNode = this._root.addChild(edge.src);
    
    // Navigate to dst node (depth 2)
    const dstNode = srcNode.addChild(edge.dst);
    
    // Mark as complete path and add edge as witness
    dstNode.markAsLeaf();
    
    // Check if this is a new edge using edge equality
    const existingWitnesses = dstNode.getWitnesses();
    const hadWitness = existingWitnesses.some(w => w.equals && w.equals(edge));
    
    if (!hadWitness) {
      dstNode.addWitness(edge);
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

    // Find src node
    const srcNode = this._root.getChild(edge.src);
    if (!srcNode) {
      return; // Edge doesn't exist
    }

    // Find dst node
    const dstNode = srcNode.getChild(edge.dst);
    if (!dstNode) {
      return; // Edge doesn't exist
    }

    // Find and remove witness using edge equality
    const witnesses = dstNode.getWitnesses();
    const witnessToRemove = witnesses.find(w => w.equals && w.equals(edge));
    
    if (witnessToRemove) {
      dstNode.removeWitness(witnessToRemove);
      this._size--;
    }

    // Clean up nodes if they become empty
    this._cleanupEmptyNodes(srcNode, dstNode, edge.src, edge.dst);
  }

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
   * Clean up empty nodes after removal
   */
  _cleanupEmptyNodes(srcNode, dstNode, src, dst) {
    // If destination node has no witnesses, unmark as leaf and remove if possible
    if (!dstNode.hasWitnesses()) {
      // Unmark as leaf if no witnesses remain
      dstNode._isLeaf = false;
      
      // Now check if it can be removed
      if (dstNode.canBeRemoved()) {
        srcNode.removeChild(dst);
      }
    }

    // If source node has no children, it can be removed
    if (srcNode.canBeRemoved()) {
      this._root.removeChild(src);
    }
  }

  /**
   * String representation for debugging
   */
  toString() {
    return `OutTrie(${this._relationName}, edges=${this._size}, sources=${this._root.getChildCount()})`;
  }

  /**
   * Get detailed tree representation
   */
  toTreeString() {
    return this._root.toTreeString();
  }
}