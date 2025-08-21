/**
 * TrieManager for coordinating tries per relationship type
 * Per design §2: Out/In Tries Infrastructure for LFTJ kernel support
 * 
 * TrieManager maintains OutTrie and InTrie pairs for each relationship type,
 * ensuring they stay synchronized and providing unified access to both
 * forward and backward traversal capabilities.
 */

import { OutTrie } from './OutTrie.js';
import { InTrie } from './InTrie.js';

/**
 * TrieManager coordinates OutTrie and InTrie pairs for relationship types
 * Per design §2.4: TrieManager for unified trie coordination
 */
export class TrieManager {
  constructor() {
    this._outTries = new Map();    // relationName -> OutTrie
    this._inTries = new Map();     // relationName -> InTrie
    this._relationNames = new Set(); // Set of all relation names
  }

  /**
   * Register a relationship type and create its trie pair
   * Per design: Each relationship type gets both OutTrie and InTrie
   */
  registerRelationType(relationName, backwardRelationName = null) {
    if (!relationName) {
      throw new Error('Relation name is required');
    }
    if (typeof relationName !== 'string') {
      throw new Error('Relation name must be a string');
    }
    if (this._relationNames.has(relationName)) {
      throw new Error(`Relation type '${relationName}' is already registered`);
    }

    // Use backward relation name if provided, otherwise derive it
    const backwardName = backwardRelationName || `${relationName}_inv`;

    // Create trie pair
    const outTrie = new OutTrie(relationName);
    const inTrie = new InTrie(backwardName);

    // Register tries
    this._outTries.set(relationName, outTrie);
    this._inTries.set(relationName, inTrie);
    this._relationNames.add(relationName);

    return { outTrie, inTrie };
  }

  /**
   * Check if relation type is registered
   */
  hasRelationType(relationName) {
    return this._relationNames.has(relationName);
  }

  /**
   * Get OutTrie for a relation type
   */
  getOutTrie(relationName) {
    const trie = this._outTries.get(relationName);
    if (!trie) {
      throw new Error(`Relation type '${relationName}' not found`);
    }
    return trie;
  }

  /**
   * Get InTrie for a relation type
   */
  getInTrie(relationName) {
    const trie = this._inTries.get(relationName);
    if (!trie) {
      throw new Error(`Relation type '${relationName}' not found`);
    }
    return trie;
  }

  /**
   * Get both tries for a relation type
   */
  getTriePair(relationName) {
    return {
      outTrie: this.getOutTrie(relationName),
      inTrie: this.getInTrie(relationName)
    };
  }

  /**
   * Insert an edge into both tries (maintains synchronization)
   * Per design: Edges must be kept in sync between OutTrie and InTrie
   */
  insertEdge(relationName, edge) {
    if (!edge) {
      throw new Error('Edge is required');
    }
    if (edge.type !== relationName) {
      throw new Error(`Edge type '${edge.type}' does not match relation name '${relationName}'`);
    }

    const outTrie = this.getOutTrie(relationName);
    const inTrie = this.getInTrie(relationName);

    // Insert into both tries
    outTrie.insert(edge);
    inTrie.insert(edge);
  }

  /**
   * Remove an edge from both tries (maintains synchronization)
   */
  removeEdge(relationName, edge) {
    if (!edge) {
      throw new Error('Edge is required');
    }

    const outTrie = this.getOutTrie(relationName);
    const inTrie = this.getInTrie(relationName);

    // Remove from both tries
    outTrie.remove(edge);
    inTrie.remove(edge);
  }

  /**
   * Check if an edge exists (checks both tries for consistency)
   */
  containsEdge(relationName, edge) {
    if (!edge) {
      return false;
    }

    const outTrie = this.getOutTrie(relationName);
    const inTrie = this.getInTrie(relationName);

    // Both tries should be consistent
    const inOut = outTrie.contains(edge);
    const inIn = inTrie.contains(edge);

    if (inOut !== inIn) {
      throw new Error(`Trie consistency error: OutTrie=${inOut}, InTrie=${inIn} for edge ${edge.toString()}`);
    }

    return inOut;
  }

  /**
   * Get all destinations for a source (forward traversal)
   */
  getDestinationsForSource(relationName, src) {
    const outTrie = this.getOutTrie(relationName);
    return outTrie.getDestinationsForSource(src);
  }

  /**
   * Get all sources for a destination (backward traversal)
   */
  getSourcesForDestination(relationName, dst) {
    const inTrie = this.getInTrie(relationName);
    return inTrie.getSourcesForDestination(dst);
  }

  /**
   * Get all edges for a source
   */
  getEdgesForSource(relationName, src) {
    const outTrie = this.getOutTrie(relationName);
    return outTrie.getEdgesForSource(src);
  }

  /**
   * Get all edges for a destination
   */
  getEdgesForDestination(relationName, dst) {
    const inTrie = this.getInTrie(relationName);
    return inTrie.getEdgesForDestination(dst);
  }

  /**
   * Get all sources in a relation
   */
  getAllSources(relationName) {
    const outTrie = this.getOutTrie(relationName);
    return outTrie.getAllSources();
  }

  /**
   * Get all destinations in a relation
   */
  getAllDestinations(relationName) {
    const inTrie = this.getInTrie(relationName);
    return inTrie.getAllDestinations();
  }

  /**
   * Get all edges for a relation type
   */
  getAllEdges(relationName) {
    const outTrie = this.getOutTrie(relationName);
    return outTrie.getAllEdges();
  }

  /**
   * Get edge count for a relation type
   */
  getEdgeCount(relationName) {
    const outTrie = this.getOutTrie(relationName);
    const inTrie = this.getInTrie(relationName);

    // Sizes should be consistent
    if (outTrie.size !== inTrie.size) {
      throw new Error(`Trie size inconsistency: OutTrie=${outTrie.size}, InTrie=${inTrie.size}`);
    }

    return outTrie.size;
  }

  /**
   * Check if a relation type is empty
   */
  isEmpty(relationName) {
    return this.getEdgeCount(relationName) === 0;
  }

  /**
   * Clear all edges for a relation type
   */
  clearRelationType(relationName) {
    const outTrie = this.getOutTrie(relationName);
    const inTrie = this.getInTrie(relationName);

    outTrie.clear();
    inTrie.clear();
  }

  /**
   * Remove a relation type completely
   */
  removeRelationType(relationName) {
    if (!this.hasRelationType(relationName)) {
      return; // Silently handle non-existent types
    }

    this._outTries.delete(relationName);
    this._inTries.delete(relationName);
    this._relationNames.delete(relationName);
  }

  /**
   * Get all registered relation names
   */
  getRelationNames() {
    return Array.from(this._relationNames).sort();
  }

  /**
   * Get count of registered relation types
   */
  getRelationCount() {
    return this._relationNames.size;
  }

  /**
   * Clear all relation types
   */
  clear() {
    this._outTries.clear();
    this._inTries.clear();
    this._relationNames.clear();
  }

  /**
   * Leapfrog operations for forward traversal
   */
  seekForward(relationName, src, targetDst) {
    const outTrie = this.getOutTrie(relationName);
    return outTrie.seek(src, targetDst);
  }

  nextForward(relationName, src, currentDst) {
    const outTrie = this.getOutTrie(relationName);
    return outTrie.next(src, currentDst);
  }

  minForward(relationName, src) {
    const outTrie = this.getOutTrie(relationName);
    return outTrie.min(src);
  }

  maxForward(relationName, src) {
    const outTrie = this.getOutTrie(relationName);
    return outTrie.max(src);
  }

  /**
   * Leapfrog operations for backward traversal
   */
  seekBackward(relationName, dst, targetSrc) {
    const inTrie = this.getInTrie(relationName);
    return inTrie.seek(dst, targetSrc);
  }

  nextBackward(relationName, dst, currentSrc) {
    const inTrie = this.getInTrie(relationName);
    return inTrie.next(dst, currentSrc);
  }

  minBackward(relationName, dst) {
    const inTrie = this.getInTrie(relationName);
    return inTrie.min(dst);
  }

  maxBackward(relationName, dst) {
    const inTrie = this.getInTrie(relationName);
    return inTrie.max(dst);
  }

  /**
   * Validate consistency between OutTrie and InTrie
   */
  validateConsistency(relationName = null) {
    const issues = [];
    const relationsToCheck = relationName ? [relationName] : this.getRelationNames();

    for (const relName of relationsToCheck) {
      if (!this.hasRelationType(relName)) {
        issues.push(`Relation type '${relName}' not found`);
        continue;
      }

      const outTrie = this.getOutTrie(relName);
      const inTrie = this.getInTrie(relName);

      // Check size consistency
      if (outTrie.size !== inTrie.size) {
        issues.push(`Size mismatch for '${relName}': OutTrie=${outTrie.size}, InTrie=${inTrie.size}`);
      }

      // Check edge consistency
      const outEdges = outTrie.getAllEdges();
      const inEdges = inTrie.getAllEdges();

      for (const edge of outEdges) {
        if (!inTrie.contains(edge)) {
          issues.push(`Edge missing from InTrie: ${edge.toString()}`);
        }
      }

      for (const edge of inEdges) {
        if (!outTrie.contains(edge)) {
          issues.push(`Edge missing from OutTrie: ${edge.toString()}`);
        }
      }

      // Validate individual trie structures
      const outIssues = outTrie.validateStructure();
      const inIssues = inTrie.validateStructure();

      issues.push(...outIssues.map(issue => `OutTrie ${relName}: ${issue}`));
      issues.push(...inIssues.map(issue => `InTrie ${relName}: ${issue}`));
    }

    return issues;
  }

  /**
   * Get comprehensive statistics
   */
  getStatistics() {
    const relationStats = {};
    let totalEdges = 0;
    let totalSources = new Set();
    let totalDestinations = new Set();

    for (const relationName of this.getRelationNames()) {
      const outTrie = this.getOutTrie(relationName);
      const inTrie = this.getInTrie(relationName);

      const stats = {
        edgeCount: outTrie.size,
        sourceCount: outTrie.getAllSources().length,
        destinationCount: inTrie.getAllDestinations().length,
        outTrieStats: outTrie.getStatistics(),
        inTrieStats: inTrie.getStatistics()
      };

      relationStats[relationName] = stats;
      totalEdges += stats.edgeCount;

      // Collect unique sources and destinations across all relations
      outTrie.getAllSources().forEach(src => totalSources.add(src));
      inTrie.getAllDestinations().forEach(dst => totalDestinations.add(dst));
    }

    return {
      relationCount: this.getRelationCount(),
      totalEdgeCount: totalEdges,
      totalUniqueSourceCount: totalSources.size,
      totalUniqueDestinationCount: totalDestinations.size,
      relationStats
    };
  }

  /**
   * String representation for debugging
   */
  toString() {
    return `TrieManager(relations=${this.getRelationCount()}, totalEdges=${this.getStatistics().totalEdgeCount})`;
  }

  /**
   * Get detailed representation for debugging
   */
  toDetailedString() {
    let result = this.toString() + '\n';
    
    for (const relationName of this.getRelationNames()) {
      const outTrie = this.getOutTrie(relationName);
      const inTrie = this.getInTrie(relationName);
      
      result += `  ${relationName}:\n`;
      result += `    OutTrie: ${outTrie.toString()}\n`;
      result += `    InTrie: ${inTrie.toString()}\n`;
    }

    return result;
  }
}