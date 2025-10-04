/**
 * EdgeHandle - Handle for individual graph edges
 *
 * Provides drill-down access to a specific edge in a knowledge graph.
 * Supports both local use and remote access via RemoteHandle.
 *
 * Features:
 * - Get/update edge data
 * - Query source and target nodes
 * - Delete edge
 * - Works as RemoteHandle for client-server scenarios
 */

import { Handle } from '@legion/handle';

/**
 * EdgeDataSource - Wraps GraphDataSource to provide single-edge access
 *
 * This internal DataSource implementation provides the synchronous dispatcher
 * interface for a single edge within a graph.
 */
class EdgeDataSource {
  constructor(graphDataSource, edgeId) {
    this.graphDataSource = graphDataSource;
    this.edgeId = edgeId;
  }

  /**
   * REQUIRED: Execute query against the edge
   * CRITICAL: Must be synchronous - no await!
   */
  query(querySpec) {
    if (!querySpec || typeof querySpec !== 'object') {
      throw new Error('Query specification must be an object');
    }

    // Get edge data
    if (querySpec.type === 'data' || !querySpec.type) {
      const results = this.graphDataSource.query({ type: 'edge', id: this.edgeId });
      return results.length > 0 ? results[0] : null;
    }

    // Get source node
    if (querySpec.type === 'sourceNode') {
      const edge = this.query({ type: 'data' });
      if (!edge) return null;
      const results = this.graphDataSource.query({ type: 'node', id: edge.source });
      return results.length > 0 ? results[0] : null;
    }

    // Get target node
    if (querySpec.type === 'targetNode') {
      const edge = this.query({ type: 'data' });
      if (!edge) return null;
      const results = this.graphDataSource.query({ type: 'node', id: edge.target });
      return results.length > 0 ? results[0] : null;
    }

    // Get specific property
    if (querySpec.type === 'property') {
      const edge = this.query({ type: 'data' });
      return edge ? edge[querySpec.property] : undefined;
    }

    throw new Error('Unsupported query specification');
  }

  /**
   * REQUIRED: Set up subscription for change notifications
   * CRITICAL: Must be synchronous - no await!
   */
  subscribe(querySpec, callback) {
    if (!callback || typeof callback !== 'function') {
      throw new Error('Callback function is required');
    }

    // Subscribe to edge changes in the parent graph
    const edgeQuery = { type: 'edge', id: this.edgeId };
    return this.graphDataSource.subscribe(edgeQuery, callback);
  }

  /**
   * REQUIRED: Get resource schema for introspection
   * CRITICAL: Must be synchronous - no await!
   */
  getSchema() {
    const graphSchema = this.graphDataSource.getSchema();
    return {
      type: 'edge',
      version: '1.0.0',
      edgeId: this.edgeId,
      properties: graphSchema.edges.properties
    };
  }

  /**
   * OPTIONAL: Update edge data
   * CRITICAL: Must be synchronous - no await!
   */
  update(updateSpec) {
    if (!updateSpec || typeof updateSpec !== 'object') {
      throw new Error('Update specification must be an object');
    }

    // Update edge properties
    if (updateSpec.type === 'update' || !updateSpec.type) {
      return this.graphDataSource.update({
        type: 'updateEdge',
        id: this.edgeId,
        updates: updateSpec.updates || updateSpec
      });
    }

    // Delete edge
    if (updateSpec.type === 'delete') {
      return this.graphDataSource.update({
        type: 'removeEdge',
        id: this.edgeId
      });
    }

    throw new Error(`Unsupported update type: ${updateSpec.type}`);
  }

  /**
   * REQUIRED: Create query builder for Handle
   * CRITICAL: Must be synchronous - no await!
   */
  queryBuilder(sourceHandle) {
    if (!sourceHandle) {
      throw new Error('Source Handle is required for query builder');
    }

    // Return a query builder for edge operations
    const builder = {
      _sourceHandle: sourceHandle,
      _querySpec: {},

      // Get edge data
      data() {
        this._querySpec = { type: 'data' };
        return this;
      },

      // Get source node
      sourceNode() {
        this._querySpec = { type: 'sourceNode' };
        return this;
      },

      // Get target node
      targetNode() {
        this._querySpec = { type: 'targetNode' };
        return this;
      },

      // Get specific property
      property(name) {
        this._querySpec = { type: 'property', property: name };
        return this;
      },

      // Execute query and return results
      toArray() {
        const results = this._sourceHandle.dataSource.query(this._querySpec);
        return Array.isArray(results) ? results : [results];
      },

      // Get first result
      first() {
        const results = this.toArray();
        return results.length > 0 ? results[0] : null;
      },

      // Get count
      count() {
        return this.toArray().length;
      }
    };

    return builder;
  }
}

export class EdgeHandle extends Handle {
  /**
   * Create an EdgeHandle
   * @param {GraphDataSource} graphDataSource - Parent graph data source
   * @param {string} edgeId - ID of the edge this handle represents
   */
  constructor(graphDataSource, edgeId) {
    const edgeDataSource = new EdgeDataSource(graphDataSource, edgeId);
    super(edgeDataSource);
    this._handleType = 'EdgeHandle';
    this.edgeId = edgeId;
  }

  /**
   * Get the edge's data
   * @returns {Promise<Object|null>} Edge data or null if not found
   */
  async getData() {
    return this.dataSource.query({ type: 'data' });
  }

  /**
   * Update the edge's properties
   * @param {Object} updates - Properties to update
   * @returns {Promise<Object>} Update result
   */
  async update(updates) {
    return this.dataSource.update({ type: 'update', updates });
  }

  /**
   * Get a specific property value
   * @param {string} propertyName - Property name
   * @returns {Promise<*>} Property value
   */
  async getProperty(propertyName) {
    return this.dataSource.query({ type: 'property', property: propertyName });
  }

  /**
   * Get the source node of this edge
   * @returns {Promise<Object|null>} Source node data
   */
  async getSourceNode() {
    return this.dataSource.query({ type: 'sourceNode' });
  }

  /**
   * Get the target node of this edge
   * @returns {Promise<Object|null>} Target node data
   */
  async getTargetNode() {
    return this.dataSource.query({ type: 'targetNode' });
  }

  /**
   * Delete this edge from the graph
   * @returns {Promise<Object>} Delete result
   */
  async delete() {
    return this.dataSource.update({ type: 'delete' });
  }

  /**
   * Serialize Handle for transmission to client
   * Returns metadata needed for RemoteHandle creation
   * @returns {Object} Serialization data
   */
  serialize() {
    // Get base capabilities from parent Handle class
    const baseSerialize = super.serialize ? super.serialize() : {
      __type: 'RemoteHandle',
      handleType: this._handleType || this.constructor.name,
      schema: this.dataSource.getSchema(),
      capabilities: ['query', 'subscribe', 'getSchema', 'queryBuilder']
    };

    // Add EdgeHandle-specific capabilities
    const customCapabilities = [
      'getData',
      'update',
      'getProperty',
      'getSourceNode',
      'getTargetNode',
      'delete'
    ];

    return {
      ...baseSerialize,
      edgeId: this.edgeId,
      capabilities: [...baseSerialize.capabilities, ...customCapabilities]
    };
  }

  // Note: receive() is handled by parent Handle class
  // Handle._handleRemoteCall() will call our async methods above
}
