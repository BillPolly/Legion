/**
 * ImmutableTrieManager - Immutable coordinator for trie pairs per relationship type
 * Per design §3.3: Immutable TrieManager with copy-on-write semantics
 * 
 * Manages immutable OutTrie and InTrie pairs for each relationship type,
 * ensuring they stay synchronized while providing unified access.
 */

import { RelationshipType } from '../RelationshipType.js';
import { Edge } from '../Edge.js';
import { ImmutableOutTrie } from './ImmutableOutTrie.js';
import { ImmutableInTrie } from './ImmutableInTrie.js';


/**
 * Immutable trie manager with copy-on-write semantics
 * All mutations return new instances, never modify existing state
 */
export class ImmutableTrieManager {
  constructor(
    outTries = new Map(),        // relationName -> ImmutableOutTrie
    inTries = new Map(),         // relationName -> ImmutableInTrie
    relationNames = new Set()    // Set of all relation names
  ) {
    // Validate constructor parameters
    this._validateConstructorParams(outTries, inTries, relationNames);

    this._outTries = this._freezeMap(outTries);
    this._inTries = this._freezeMap(inTries);
    this._relationNames = this._freezeSet(relationNames);
    
    // Make completely immutable
    Object.freeze(this);
  }

  // === IMMUTABLE MUTATION METHODS ===

  /**
   * Create new manager with added relationship type (pure function)
   * Returns new ImmutableTrieManager, never mutates this
   */
  withAddedRelationType(relationshipType) {
    this._validateRelationshipType(relationshipType);
    
    const relationName = relationshipType.forwardName;
    
    // Early return if already exists
    if (this._relationNames.has(relationName)) {
      return this; // Immutable - can return same instance
    }
    
    // Create new trie pair
    const outTrie = new ImmutableOutTrie(relationName);
    const inTrie = new ImmutableInTrie(relationName);
    
    // Copy-on-write: only copy what changes
    const newOutTries = new Map(this._outTries);
    const newInTries = new Map(this._inTries);
    const newRelationNames = new Set(this._relationNames);
    
    newOutTries.set(relationName, outTrie);
    newInTries.set(relationName, inTrie);
    newRelationNames.add(relationName);
    
    // Create new manager with updated state
    return new ImmutableTrieManager(
      newOutTries,
      newInTries,
      newRelationNames
    );
  }

  /**
   * Create new manager with added edge (pure function)
   * Adds edge to both out and in tries for synchronization
   */
  withAddedEdge(edge) {
    this._validateEdge(edge);
    
    const relationName = edge.type;
    
    // Validate relation type exists
    if (!this._relationNames.has(relationName)) {
      throw new Error(`Relation type ${relationName} not found`);
    }
    
    // Get current tries
    const currentOutTrie = this._outTries.get(relationName);
    const currentInTrie = this._inTries.get(relationName);
    
    // Early return if edge already exists
    if (currentOutTrie.contains(edge) && currentInTrie.contains(edge)) {
      return this; // No change needed
    }
    
    // Add edge to both tries (returns new immutable instances)
    const newOutTrie = currentOutTrie.withAddedEdge(edge);
    const newInTrie = currentInTrie.withAddedEdge(edge);
    
    // Copy-on-write: update only the affected tries
    const newOutTries = new Map(this._outTries);
    const newInTries = new Map(this._inTries);
    
    newOutTries.set(relationName, newOutTrie);
    newInTries.set(relationName, newInTrie);
    
    return new ImmutableTrieManager(
      newOutTries,
      newInTries,
      this._relationNames  // Unchanged, can reuse
    );
  }

  /**
   * Create new manager with removed edge (pure function)
   * Removes edge from both out and in tries for synchronization
   */
  withRemovedEdge(edge) {
    this._validateEdge(edge);
    
    const relationName = edge.type;
    
    // Validate relation type exists
    if (!this._relationNames.has(relationName)) {
      throw new Error(`Relation type ${relationName} not found`);
    }
    
    // Get current tries
    const currentOutTrie = this._outTries.get(relationName);
    const currentInTrie = this._inTries.get(relationName);
    
    // Early return if edge doesn't exist
    if (!currentOutTrie.contains(edge) && !currentInTrie.contains(edge)) {
      return this; // No change needed
    }
    
    // Remove edge from both tries (returns new immutable instances)
    const newOutTrie = currentOutTrie.withRemovedEdge(edge);
    const newInTrie = currentInTrie.withRemovedEdge(edge);
    
    // Copy-on-write: update only the affected tries
    const newOutTries = new Map(this._outTries);
    const newInTries = new Map(this._inTries);
    
    newOutTries.set(relationName, newOutTrie);
    newInTries.set(relationName, newInTrie);
    
    return new ImmutableTrieManager(
      newOutTries,
      newInTries,
      this._relationNames  // Unchanged, can reuse
    );
  }

  // === READ-ONLY ACCESSORS ===

  /**
   * Check if relation type is registered
   */
  hasRelationType(relationName) {
    if (relationName === null || relationName === undefined) {
      throw new Error('Relation name is required');
    }
    return this._relationNames.has(relationName);
  }

  /**
   * Get all registered relation names (sorted)
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
   * Check if out trie exists for relation type
   */
  hasOutTrie(relationName) {
    return this._outTries.has(relationName);
  }

  /**
   * Check if in trie exists for relation type
   */
  hasInTrie(relationName) {
    return this._inTries.has(relationName);
  }

  /**
   * Get OutTrie for a relation type
   */
  getOutTrie(relationName) {
    const trie = this._outTries.get(relationName);
    if (!trie) {
      throw new Error(`Relation type ${relationName} not found`);
    }
    return trie;
  }

  /**
   * Get InTrie for a relation type
   */
  getInTrie(relationName) {
    const trie = this._inTries.get(relationName);
    if (!trie) {
      throw new Error(`Relation type ${relationName} not found`);
    }
    return trie;
  }

  /**
   * Check if an edge exists (checks both tries for consistency)
   */
  containsEdge(relationName, edge) {
    this._validateEdge(edge);
    
    if (!this._relationNames.has(relationName)) {
      throw new Error(`Relation type ${relationName} not found`);
    }
    
    const outTrie = this._outTries.get(relationName);
    const inTrie = this._inTries.get(relationName);
    
    // Both tries should be consistent
    const inOut = outTrie.contains(edge);
    const inIn = inTrie.contains(edge);
    
    if (inOut !== inIn) {
      throw new Error(`Trie consistency error: OutTrie=${inOut}, InTrie=${inIn} for edge ${edge.toString()}`);
    }
    
    return inOut;
  }

  /**
   * Get edge count for a relation type
   */
  getEdgeCount(relationName) {
    if (!this._relationNames.has(relationName)) {
      throw new Error(`Relation type ${relationName} not found`);
    }
    
    const outTrie = this._outTries.get(relationName);
    const inTrie = this._inTries.get(relationName);
    
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

  // === NAVIGATION METHODS ===

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

  // === LEAPFROG OPERATIONS ===

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

  // === VALIDATION AND STATISTICS ===

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
    return `ImmutableTrieManager(relations=${this.getRelationCount()}, totalEdges=${this.getStatistics().totalEdgeCount})`;
  }

  // === PRIVATE METHODS ===

  /**
   * Validate constructor parameters
   */
  _validateConstructorParams(outTries, inTries, relationNames) {
    if (!(outTries instanceof Map)) {
      throw new Error('outTries must be a Map');
    }
    if (!(inTries instanceof Map)) {
      throw new Error('inTries must be a Map');
    }
    if (!(relationNames instanceof Set)) {
      throw new Error('relationNames must be a Set');
    }
  }

  /**
   * Validate relationship type parameter
   */
  _validateRelationshipType(relationshipType) {
    if (relationshipType === null || relationshipType === undefined) {
      throw new Error('RelationshipType is required');
    }
    if (!(relationshipType instanceof RelationshipType)) {
      throw new Error('Must be a RelationshipType instance');
    }
  }

  /**
   * Validate edge parameter
   */
  _validateEdge(edge) {
    if (edge === null || edge === undefined) {
      throw new Error('Edge is required');
    }
    if (!(edge instanceof Edge)) {
      throw new Error('Must be an Edge instance');
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
}