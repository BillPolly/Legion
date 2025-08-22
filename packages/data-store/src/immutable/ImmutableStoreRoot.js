/**
 * ImmutableStoreRoot - Immutable root of all store state
 * Per design §3.1: Single source of truth with atomic transitions
 * 
 * Immutable root containing all store data with copy-on-write semantics.
 * Every mutation returns a new root instance, never modifies existing state.
 */

import { Edge } from '../Edge.js';
import { RelationshipType } from '../RelationshipType.js';
import { ImmutableTrieManager } from './ImmutableTrieManager.js';

/**
 * Immutable root of all store state
 * Single source of truth with atomic transitions
 */
export class ImmutableStoreRoot {
  constructor(
    edges = new Map(),           // edgeKey -> Edge
    edgesByType = new Map(),     // type -> Set<Edge>  
    edgesBySource = new Map(),   // src -> Set<Edge>
    edgesByDestination = new Map(), // dst -> Set<Edge>
    relationshipTypes = new Map(), // type -> RelationshipType
    trieManager = null,          // ImmutableTrieManager
    metadata = {}                // Version info, stats, etc.
  ) {
    // Validate constructor parameters
    this._validateConstructorParams(edges, edgesByType, edgesBySource, edgesByDestination, relationshipTypes);

    this._edges = this._freezeMap(edges);
    this._edgesByType = this._freezeMapOfSets(edgesByType);
    this._edgesBySource = this._freezeMapOfSets(edgesBySource);
    this._edgesByDestination = this._freezeMapOfSets(edgesByDestination);
    this._relationshipTypes = this._freezeMap(relationshipTypes);
    this._trieManager = trieManager || new ImmutableTrieManager();
    this._metadata = Object.freeze({
      version: metadata.version || this._generateTimestamp(),
      edgeCount: edges.size,
      ...metadata
    });
    
    // Make completely immutable
    Object.freeze(this);
  }

  /**
   * Create new root with added edge (pure function)
   * Returns new ImmutableStoreRoot, never mutates this
   */
  withAddedEdge(edge) {
    this._validateEdge(edge);
    
    const edgeKey = this._getEdgeKey(edge);
    
    // Early return if no change needed
    if (this._edges.has(edgeKey)) {
      return this; // Immutable - can return same instance
    }
    
    // Copy-on-write: only copy what changes
    const newEdges = new Map(this._edges);
    newEdges.set(edgeKey, edge);
    
    // Update type index with copy-on-write
    const newEdgesByType = new Map(this._edgesByType);
    if (!newEdgesByType.has(edge.type)) {
      newEdgesByType.set(edge.type, new Set());
    } else {
      // Copy existing set before modifying
      newEdgesByType.set(edge.type, new Set(newEdgesByType.get(edge.type)));
    }
    newEdgesByType.get(edge.type).add(edge);
    
    // Update source index
    const newEdgesBySource = new Map(this._edgesBySource);
    if (!newEdgesBySource.has(edge.src)) {
      newEdgesBySource.set(edge.src, new Set());
    } else {
      newEdgesBySource.set(edge.src, new Set(newEdgesBySource.get(edge.src)));
    }
    newEdgesBySource.get(edge.src).add(edge);
    
    // Update destination index  
    const newEdgesByDestination = new Map(this._edgesByDestination);
    if (!newEdgesByDestination.has(edge.dst)) {
      newEdgesByDestination.set(edge.dst, new Set());
    } else {
      newEdgesByDestination.set(edge.dst, new Set(newEdgesByDestination.get(edge.dst)));
    }
    newEdgesByDestination.get(edge.dst).add(edge);
    
    // Update trie manager (returns new immutable instance)
    // TODO: Implement when ImmutableTrieManager is available
    const newTrieManager = this._trieManager 
      ? this._trieManager.withAddedEdge(edge)
      : null;
    
    // Create new root with updated state
    return new ImmutableStoreRoot(
      newEdges,
      newEdgesByType,
      newEdgesBySource,
      newEdgesByDestination,
      this._relationshipTypes, // Unchanged, can reuse
      newTrieManager,
      { 
        version: this._generateTimestamp(),
        operation: 'addEdge', 
        edge: edge.toString() 
      }
    );
  }

  /**
   * Create new root with removed edge (pure function)
   */
  withRemovedEdge(edge) {
    this._validateEdge(edge);
    
    const edgeKey = this._getEdgeKey(edge);
    
    // Early return if edge doesn't exist
    if (!this._edges.has(edgeKey)) {
      return this; // No change needed
    }
    
    // Copy-on-write for all affected structures
    const newEdges = new Map(this._edges);
    newEdges.delete(edgeKey);
    
    // Remove from type index
    const newEdgesByType = new Map(this._edgesByType);
    const typeSet = newEdgesByType.get(edge.type);
    if (typeSet) {
      const newTypeSet = new Set(typeSet);
      // Need to find the actual edge in the set to delete (by value, not reference)
      for (const e of newTypeSet) {
        if (e.equals(edge)) {
          newTypeSet.delete(e);
          break;
        }
      }
      if (newTypeSet.size === 0) {
        newEdgesByType.delete(edge.type);
      } else {
        newEdgesByType.set(edge.type, newTypeSet);
      }
    }
    
    // Remove from source index
    const newEdgesBySource = new Map(this._edgesBySource);
    const sourceSet = newEdgesBySource.get(edge.src);
    if (sourceSet) {
      const newSourceSet = new Set(sourceSet);
      // Need to find the actual edge in the set to delete (by value, not reference)
      for (const e of newSourceSet) {
        if (e.equals(edge)) {
          newSourceSet.delete(e);
          break;
        }
      }
      if (newSourceSet.size === 0) {
        newEdgesBySource.delete(edge.src);
      } else {
        newEdgesBySource.set(edge.src, newSourceSet);
      }
    }
    
    // Remove from destination index
    const newEdgesByDestination = new Map(this._edgesByDestination);
    const destSet = newEdgesByDestination.get(edge.dst);
    if (destSet) {
      const newDestSet = new Set(destSet);
      // Need to find the actual edge in the set to delete (by value, not reference)
      for (const e of newDestSet) {
        if (e.equals(edge)) {
          newDestSet.delete(e);
          break;
        }
      }
      if (newDestSet.size === 0) {
        newEdgesByDestination.delete(edge.dst);
      } else {
        newEdgesByDestination.set(edge.dst, newDestSet);
      }
    }
    
    // Update trie manager
    // TODO: Implement when ImmutableTrieManager is available
    const newTrieManager = this._trieManager
      ? this._trieManager.withRemovedEdge(edge)
      : null;
    
    return new ImmutableStoreRoot(
      newEdges,
      newEdgesByType,
      newEdgesBySource,
      newEdgesByDestination,
      this._relationshipTypes,
      newTrieManager,
      { 
        version: this._generateTimestamp(),
        operation: 'removeEdge', 
        edge: edge.toString() 
      }
    );
  }

  /**
   * Create new root with added relationship type
   */
  withAddedRelationType(relationshipType) {
    this._validateRelationshipType(relationshipType);
    
    // Early return if already exists
    if (this._relationshipTypes.has(relationshipType.forwardName)) {
      return this; // No change needed
    }
    
    const newTypes = new Map(this._relationshipTypes);
    newTypes.set(relationshipType.forwardName, relationshipType);
    
    // TODO: Update trie manager when available
    const newTrieManager = this._trieManager
      ? this._trieManager.withAddedRelationType(relationshipType)
      : null;
    
    return new ImmutableStoreRoot(
      this._edges,
      this._edgesByType,
      this._edgesBySource,
      this._edgesByDestination,
      newTypes,
      newTrieManager,
      { 
        version: this._generateTimestamp(),
        operation: 'addRelationType', 
        type: relationshipType.forwardName 
      }
    );
  }

  // === READ-ONLY ACCESSORS ===

  /**
   * Get all edges (immutable map)
   */
  getEdges() { 
    return this._edges; 
  }

  /**
   * Get edges by type (immutable set)
   */
  getEdgesByType(type) { 
    return this._edgesByType.get(type) || this._createImmutableEmptySet(); 
  }

  /**
   * Get edges by source (immutable set)
   */
  getEdgesBySource(src) { 
    return this._edgesBySource.get(src) || this._createImmutableEmptySet(); 
  }

  /**
   * Get edges by destination (immutable set)
   */
  getEdgesByDestination(dst) { 
    return this._edgesByDestination.get(dst) || this._createImmutableEmptySet(); 
  }

  /**
   * Get all relationship types (immutable map)
   */
  getRelationshipTypes() { 
    return this._relationshipTypes; 
  }

  /**
   * Get count of relationship types
   */
  getRelationTypeCount() {
    return this._relationshipTypes.size;
  }

  /**
   * Get trie manager (when available)
   */
  getTrieManager() { 
    return this._trieManager; 
  }

  /**
   * Get metadata
   */
  getMetadata() { 
    return this._metadata; 
  }
  
  /**
   * Check if edge exists
   */
  hasEdge(edge) {
    this._validateEdge(edge);
    return this._edges.has(this._getEdgeKey(edge)); 
  }
  
  /**
   * Check if relationship type exists
   */
  hasRelationType(typeName) {
    if (typeName === null || typeName === undefined) {
      throw new Error('Type name is required');
    }
    return this._relationshipTypes.has(typeName);
  }
  
  /**
   * Get total edge count
   */
  getEdgeCount() {
    return this._edges.size;
  }

  // === PRIVATE METHODS ===

  /**
   * Generate canonical key for edge to handle value equality
   */
  _getEdgeKey(edge) {
    return `${edge.type}:${JSON.stringify(edge.src)}:${JSON.stringify(edge.dst)}`;
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
   * Validate constructor parameters
   */
  _validateConstructorParams(edges, edgesByType, edgesBySource, edgesByDestination, relationshipTypes) {
    if (!(edges instanceof Map)) {
      throw new Error('edges must be a Map');
    }
    if (!(edgesByType instanceof Map)) {
      throw new Error('edgesByType must be a Map');
    }
    if (!(edgesBySource instanceof Map)) {
      throw new Error('edgesBySource must be a Map');
    }
    if (!(edgesByDestination instanceof Map)) {
      throw new Error('edgesByDestination must be a Map');
    }
    if (!(relationshipTypes instanceof Map)) {
      throw new Error('relationshipTypes must be a Map');
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
   * Freeze a map of sets and return immutable version
   */
  _freezeMapOfSets(mapOfSets) {
    const frozenMap = new Map();
    for (const [key, set] of mapOfSets) {
      const frozenSet = new Set(set);
      
      // Override Set mutating methods to throw errors
      const mutatingMethods = ['add', 'delete', 'clear'];
      mutatingMethods.forEach(method => {
        frozenSet[method] = () => {
          throw new Error(`Cannot ${method} on immutable Set`);
        };
      });
      
      Object.freeze(frozenSet);
      frozenMap.set(key, frozenSet);
    }
    
    // Override Map mutating methods to throw errors
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
   * Create immutable empty set
   */
  _createImmutableEmptySet() {
    const emptySet = new Set();
    
    // Override mutating methods to throw errors
    const mutatingMethods = ['add', 'delete', 'clear'];
    mutatingMethods.forEach(method => {
      emptySet[method] = () => {
        throw new Error(`Cannot ${method} on immutable Set`);
      };
    });
    
    Object.freeze(emptySet);
    return emptySet;
  }

  /**
   * Generate unique timestamp for versioning
   */
  _generateTimestamp() {
    // Ensure each timestamp is unique and monotonic
    const now = Date.now();
    const nanoTime = process.hrtime.bigint();
    // Combine millisecond time with high resolution nanoseconds
    return Number(nanoTime);
  }
}