/**
 * Store class for managing edge collections
 * Per design §1: Store maintains binary relationship instances with set semantics
 */

import { Edge } from './Edge.js';
import { RelationshipType, RelationshipTypeRegistry } from './RelationshipType.js';

/**
 * Store manages collections of edges (binary relationships) with set semantics
 * Per design §1.1: Only primitive is binary relationship instance (type, src, dst)
 */
export class Store {
  constructor() {
    this._relationshipTypes = new RelationshipTypeRegistry();
    this._edges = new Map(); // canonical key -> Edge for proper equality semantics
    this._edgesByType = new Map(); // typeName -> Set<Edge>
    this._edgesBySource = new Map(); // src -> Set<Edge>
    this._edgesByDestination = new Map(); // dst -> Set<Edge>
  }

  /**
   * Generate canonical key for edge to handle value equality
   */
  _getEdgeKey(edge) {
    return `${edge.type}:${JSON.stringify(edge.src)}:${JSON.stringify(edge.dst)}`;
  }

  /**
   * Define a relationship type with forward and backward attribute names
   * Per design §1.1: Every relationship type R has two attribute names
   */
  defineRelationType(forwardName, backwardName) {
    return this._relationshipTypes.registerType(forwardName, backwardName);
  }

  /**
   * Check if relationship type is defined
   */
  hasRelationType(typeName) {
    return this._relationshipTypes.hasType(typeName);
  }

  /**
   * Get relationship type by name
   */
  getRelationType(typeName) {
    return this._relationshipTypes.getType(typeName);
  }

  /**
   * Get all relationship type names
   */
  getTypeNames() {
    return this._relationshipTypes.getTypeNames();
  }

  /**
   * Get count of defined relationship types
   */
  getTypeCount() {
    return this._relationshipTypes.getTypeNames().length;
  }

  /**
   * Check if attribute name is defined
   */
  hasAttribute(attributeName) {
    return this._relationshipTypes.hasAttribute(attributeName);
  }

  /**
   * Get attribute by name
   */
  getAttributeByName(attributeName) {
    return this._relationshipTypes.getAttributeByName(attributeName);
  }

  /**
   * Add an edge to the store
   * Per design: Set semantics - no duplicates
   */
  addEdge(edge) {
    if (!edge) {
      throw new Error('Edge is required');
    }
    if (!(edge instanceof Edge)) {
      throw new Error('Must be an Edge instance');
    }

    // Validate that relationship type is defined
    if (!this.hasRelationType(edge.type)) {
      throw new Error(`Relationship type '${edge.type}' not found`);
    }

    // Set semantics - check if already exists using canonical key
    const edgeKey = this._getEdgeKey(edge);
    if (this._edges.has(edgeKey)) {
      return; // Duplicate, ignore
    }

    // Add to global map
    this._edges.set(edgeKey, edge);

    // Add to type index
    if (!this._edgesByType.has(edge.type)) {
      this._edgesByType.set(edge.type, new Set());
    }
    this._edgesByType.get(edge.type).add(edge);

    // Add to source index
    if (!this._edgesBySource.has(edge.src)) {
      this._edgesBySource.set(edge.src, new Set());
    }
    this._edgesBySource.get(edge.src).add(edge);

    // Add to destination index
    if (!this._edgesByDestination.has(edge.dst)) {
      this._edgesByDestination.set(edge.dst, new Set());
    }
    this._edgesByDestination.get(edge.dst).add(edge);
  }

  /**
   * Add edge with convenience method
   */
  addEdgeByComponents(type, src, dst) {
    const edge = new Edge(type, src, dst);
    this.addEdge(edge);
    return edge;
  }

  /**
   * Add multiple edges
   */
  addEdges(edges) {
    if (!edges) {
      throw new Error('Edges array is required');
    }
    if (!Array.isArray(edges)) {
      throw new Error('Must be an array');
    }

    for (const edge of edges) {
      if (!(edge instanceof Edge)) {
        throw new Error('All elements must be Edge instances');
      }
      this.addEdge(edge);
    }
  }

  /**
   * Remove an edge from the store
   */
  removeEdge(edge) {
    if (!edge) {
      throw new Error('Edge is required');
    }
    if (!(edge instanceof Edge)) {
      throw new Error('Must be an Edge instance');
    }

    // Check if edge exists using canonical key
    const edgeKey = this._getEdgeKey(edge);
    if (!this._edges.has(edgeKey)) {
      return; // Non-existent, ignore
    }

    // Get the actual edge instance from the map for index cleanup
    const actualEdge = this._edges.get(edgeKey);
    
    // Remove from global map
    this._edges.delete(edgeKey);

    // Remove from type index using the actual edge instance
    const typeSet = this._edgesByType.get(actualEdge.type);
    if (typeSet) {
      typeSet.delete(actualEdge);
      if (typeSet.size === 0) {
        this._edgesByType.delete(actualEdge.type);
      }
    }

    // Remove from source index using the actual edge instance
    const sourceSet = this._edgesBySource.get(actualEdge.src);
    if (sourceSet) {
      sourceSet.delete(actualEdge);
      if (sourceSet.size === 0) {
        this._edgesBySource.delete(actualEdge.src);
      }
    }

    // Remove from destination index using the actual edge instance
    const destSet = this._edgesByDestination.get(actualEdge.dst);
    if (destSet) {
      destSet.delete(actualEdge);
      if (destSet.size === 0) {
        this._edgesByDestination.delete(actualEdge.dst);
      }
    }
  }

  /**
   * Remove edge with convenience method
   */
  removeEdgeByComponents(type, src, dst) {
    const edge = new Edge(type, src, dst);
    this.removeEdge(edge);
  }

  /**
   * Remove multiple edges
   */
  removeEdges(edges) {
    if (!edges) {
      throw new Error('Edges array is required');
    }
    if (!Array.isArray(edges)) {
      throw new Error('Must be an array');
    }

    for (const edge of edges) {
      if (!(edge instanceof Edge)) {
        throw new Error('All elements must be Edge instances');
      }
      this.removeEdge(edge);
    }
  }

  /**
   * Check if edge exists in store
   */
  hasEdge(edge) {
    if (!(edge instanceof Edge)) {
      return false;
    }
    const edgeKey = this._getEdgeKey(edge);
    return this._edges.has(edgeKey);
  }

  /**
   * Get all edges in store
   */
  getAllEdges() {
    return Array.from(this._edges.values());
  }

  /**
   * Get edges by type
   */
  getEdgesByType(typeName) {
    const typeSet = this._edgesByType.get(typeName);
    return typeSet ? Array.from(typeSet) : [];
  }

  /**
   * Get edges by source
   */
  getEdgesBySource(src) {
    const sourceSet = this._edgesBySource.get(src);
    return sourceSet ? Array.from(sourceSet) : [];
  }

  /**
   * Get edges by destination
   */
  getEdgesByDestination(dst) {
    const destSet = this._edgesByDestination.get(dst);
    return destSet ? Array.from(destSet) : [];
  }

  /**
   * Get edges by type and source
   */
  getEdgesByTypeAndSource(typeName, src) {
    const edges = this.getEdgesBySource(src);
    return edges.filter(edge => edge.type === typeName);
  }

  /**
   * Get edges by type and destination
   */
  getEdgesByTypeAndDestination(typeName, dst) {
    const edges = this.getEdgesByDestination(dst);
    return edges.filter(edge => edge.type === typeName);
  }

  /**
   * Get total edge count
   */
  getEdgeCount() {
    return this._edges.size;
  }

  /**
   * Check if store is empty
   */
  isEmpty() {
    return this._edges.size === 0;
  }

  /**
   * Clear all edges (keep relationship types)
   */
  clearEdges() {
    this._edges.clear();
    this._edgesByType.clear();
    this._edgesBySource.clear();
    this._edgesByDestination.clear();
  }

  /**
   * Clear edges of specific type
   */
  clearEdgesByType(typeName) {
    const edges = this.getEdgesByType(typeName);
    this.removeEdges(edges);
  }

  /**
   * Reset store completely (edges and relationship types)
   */
  reset() {
    this.clearEdges();
    this._relationshipTypes.clear();
  }

  /**
   * Get store statistics
   */
  getStatistics() {
    const uniqueSources = new Set();
    const uniqueDestinations = new Set();

    for (const edge of this._edges.values()) {
      uniqueSources.add(edge.src);
      uniqueDestinations.add(edge.dst);
    }

    return {
      edgeCount: this._edges.size,
      typeCount: this.getTypeCount(),
      attributeCount: this._relationshipTypes.getAttributeNames().length,
      uniqueSourceCount: uniqueSources.size,
      uniqueDestinationCount: uniqueDestinations.size
    };
  }

  /**
   * Get detailed statistics by type
   */
  getStatisticsByType() {
    const stats = {};

    for (const typeName of this.getTypeNames()) {
      const edges = this.getEdgesByType(typeName);
      const sources = new Set();
      const destinations = new Set();

      for (const edge of edges) {
        sources.add(edge.src);
        destinations.add(edge.dst);
      }

      stats[typeName] = {
        edgeCount: edges.length,
        uniqueSourceCount: sources.size,
        uniqueDestinationCount: destinations.size
      };
    }

    return stats;
  }
}