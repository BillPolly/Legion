/**
 * NodeHandle - Handle for individual graph nodes
 *
 * Provides drill-down access to a specific node in a knowledge graph.
 * Supports both local use and remote access via RemoteHandle.
 *
 * Features:
 * - Get/update node data
 * - Query connected nodes and edges
 * - Delete node
 * - Works as RemoteHandle for client-server scenarios
 */

import { Handle } from '@legion/handle';

/**
 * NodeDataSource - Wraps GraphDataSource to provide single-node access
 *
 * This internal DataSource implementation provides the synchronous dispatcher
 * interface for a single node within a graph.
 */
class NodeDataSource {
  constructor(graphDataSource, nodeId) {
    this.graphDataSource = graphDataSource;
    this.nodeId = nodeId;
  }

  /**
   * REQUIRED: Execute query against the node
   * CRITICAL: Must be synchronous - no await!
   */
  query(querySpec) {
    if (!querySpec || typeof querySpec !== 'object') {
      throw new Error('Query specification must be an object');
    }

    // Get node data
    if (querySpec.type === 'data' || !querySpec.type) {
      const results = this.graphDataSource.query({ type: 'node', id: this.nodeId });
      return results.length > 0 ? results[0] : null;
    }

    // Get connected edges
    if (querySpec.type === 'connectedEdges') {
      return this.graphDataSource.query({ type: 'connectedEdges', nodeId: this.nodeId });
    }

    // Get connected nodes
    if (querySpec.type === 'connectedNodes') {
      return this.graphDataSource.query({ type: 'connectedNodes', nodeId: this.nodeId });
    }

    // Get specific property
    if (querySpec.type === 'property') {
      const node = this.query({ type: 'data' });
      return node ? node[querySpec.property] : undefined;
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

    // Subscribe to node changes in the parent graph
    const nodeQuery = { type: 'node', id: this.nodeId };
    return this.graphDataSource.subscribe(nodeQuery, callback);
  }

  /**
   * REQUIRED: Get resource schema for introspection
   * CRITICAL: Must be synchronous - no await!
   */
  getSchema() {
    const graphSchema = this.graphDataSource.getSchema();
    return {
      type: 'node',
      version: '1.0.0',
      nodeId: this.nodeId,
      properties: graphSchema.nodes.properties
    };
  }

  /**
   * OPTIONAL: Update node data
   * CRITICAL: Must be synchronous - no await!
   */
  update(updateSpec) {
    if (!updateSpec || typeof updateSpec !== 'object') {
      throw new Error('Update specification must be an object');
    }

    // Update node properties
    if (updateSpec.type === 'update' || !updateSpec.type) {
      return this.graphDataSource.update({
        type: 'updateNode',
        id: this.nodeId,
        updates: updateSpec.updates || updateSpec
      });
    }

    // Delete node
    if (updateSpec.type === 'delete') {
      return this.graphDataSource.update({
        type: 'removeNode',
        id: this.nodeId
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

    // Return a query builder for node operations
    const builder = {
      _sourceHandle: sourceHandle,
      _querySpec: {},

      // Get node data
      data() {
        this._querySpec = { type: 'data' };
        return this;
      },

      // Get connected edges
      connectedEdges() {
        this._querySpec = { type: 'connectedEdges' };
        return this;
      },

      // Get connected nodes
      connectedNodes() {
        this._querySpec = { type: 'connectedNodes' };
        return this;
      },

      // Get specific property
      property(name) {
        this._querySpec = { type: 'property', property: name };
        return this;
      },

      // Filter results
      where(predicate) {
        this._filter = predicate;
        return this;
      },

      // Execute query and return results
      toArray() {
        let results = this._sourceHandle.dataSource.query(this._querySpec);
        if (Array.isArray(results) && this._filter) {
          results = results.filter(this._filter);
        }
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

export class NodeHandle extends Handle {
  /**
   * Create a NodeHandle
   * @param {GraphDataSource} graphDataSource - Parent graph data source
   * @param {string} nodeId - ID of the node this handle represents
   */
  constructor(graphDataSource, nodeId) {
    const nodeDataSource = new NodeDataSource(graphDataSource, nodeId);
    super(nodeDataSource);
    this._handleType = 'NodeHandle';
    this.nodeId = nodeId;
  }

  /**
   * Get the node's data
   * @returns {Promise<Object|null>} Node data or null if not found
   */
  async getData() {
    return this.dataSource.query({ type: 'data' });
  }

  /**
   * Update the node's properties
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
   * Get edges connected to this node
   * @returns {Promise<Array>} Connected edges
   */
  async getConnectedEdges() {
    return this.dataSource.query({ type: 'connectedEdges' });
  }

  /**
   * Get nodes connected to this node
   * @returns {Promise<Array>} Connected nodes
   */
  async getConnectedNodes() {
    return this.dataSource.query({ type: 'connectedNodes' });
  }

  /**
   * Delete this node from the graph
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

    // Add NodeHandle-specific capabilities
    const customCapabilities = [
      'getData',
      'update',
      'getProperty',
      'getConnectedEdges',
      'getConnectedNodes',
      'delete'
    ];

    return {
      ...baseSerialize,
      nodeId: this.nodeId,
      capabilities: [...baseSerialize.capabilities, ...customCapabilities]
    };
  }

  // Note: receive() is handled by parent Handle class
  // Handle._handleRemoteCall() will call our async methods above
}
