/**
 * GraphHandle - Handle for knowledge graphs
 *
 * Extends Handle to provide graph access through the Handle/DataSource pattern.
 * Supports both local use and remote access via RemoteHandle.
 *
 * Features:
 * - Query nodes and edges
 * - Add/update/remove graph elements
 * - Subscribe to graph changes
 * - Drill-down to NodeHandle/EdgeHandle
 * - Works as RemoteHandle for client-server scenarios
 */

import { Handle } from '@legion/handle';
import { NodeHandle } from './NodeHandle.js';
import { EdgeHandle } from './EdgeHandle.js';

export class GraphHandle extends Handle {
  /**
   * Create a GraphHandle
   * @param {GraphDataSource} graphDataSource - Graph data source
   */
  constructor(graphDataSource) {
    super(graphDataSource);
    this._handleType = 'GraphHandle';
    // resourceType is automatically 'graph' via Handle.resourceType getter from schema
  }

  /**
   * Get all nodes
   * @returns {Promise<Array>} Array of nodes
   */
  async getNodes() {
    return this.dataSource.query({ type: 'nodes' });
  }

  /**
   * Get all edges
   * @returns {Promise<Array>} Array of edges
   */
  async getEdges() {
    return this.dataSource.query({ type: 'edges' });
  }

  /**
   * Get specific node by ID
   * @param {string} id - Node ID
   * @returns {Promise<Object|null>} Node or null if not found
   */
  async getNode(id) {
    const results = this.dataSource.query({ type: 'node', id });
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Get specific edge by ID
   * @param {string} id - Edge ID
   * @returns {Promise<Object|null>} Edge or null if not found
   */
  async getEdge(id) {
    const results = this.dataSource.query({ type: 'edge', id });
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Add a node to the graph
   * @param {Object} nodeData - Node data
   * @returns {Promise<Object>} Update result
   */
  async addNode(nodeData) {
    return this.dataSource.update({ type: 'addNode', node: nodeData });
  }

  /**
   * Update a node
   * @param {string} id - Node ID
   * @param {Object} updates - Properties to update
   * @returns {Promise<Object>} Update result
   */
  async updateNode(id, updates) {
    return this.dataSource.update({ type: 'updateNode', id, updates });
  }

  /**
   * Remove a node
   * @param {string} id - Node ID
   * @returns {Promise<Object>} Update result
   */
  async removeNode(id) {
    return this.dataSource.update({ type: 'removeNode', id });
  }

  /**
   * Add an edge to the graph
   * @param {Object} edgeData - Edge data (must have id, source, target)
   * @returns {Promise<Object>} Update result
   */
  async addEdge(edgeData) {
    return this.dataSource.update({ type: 'addEdge', edge: edgeData });
  }

  /**
   * Update an edge
   * @param {string} id - Edge ID
   * @param {Object} updates - Properties to update
   * @returns {Promise<Object>} Update result
   */
  async updateEdge(id, updates) {
    return this.dataSource.update({ type: 'updateEdge', id, updates });
  }

  /**
   * Remove an edge
   * @param {string} id - Edge ID
   * @returns {Promise<Object>} Update result
   */
  async removeEdge(id) {
    return this.dataSource.update({ type: 'removeEdge', id });
  }

  /**
   * Find nodes matching a predicate
   * @param {Function} predicate - Filter function
   * @returns {Promise<Array>} Matching nodes
   */
  async findNodes(predicate) {
    const allNodes = this.dataSource.query({ type: 'nodes' });
    return predicate ? allNodes.filter(predicate) : allNodes;
  }

  /**
   * Find edges matching a predicate
   * @param {Function} predicate - Filter function
   * @returns {Promise<Array>} Matching edges
   */
  async findEdges(predicate) {
    const allEdges = this.dataSource.query({ type: 'edges' });
    return predicate ? allEdges.filter(predicate) : allEdges;
  }

  /**
   * Get nodes connected to a specific node
   * @param {string} nodeId - Node ID
   * @returns {Promise<Array>} Connected nodes
   */
  async getConnectedNodes(nodeId) {
    return this.dataSource.query({ type: 'connectedNodes', nodeId });
  }

  /**
   * Get edges connected to a specific node
   * @param {string} nodeId - Node ID
   * @returns {Promise<Array>} Connected edges
   */
  async getConnectedEdges(nodeId) {
    return this.dataSource.query({ type: 'connectedEdges', nodeId });
  }

  /**
   * Get graph metadata
   * @returns {Promise<Object>} Graph metadata
   */
  async getMetadata() {
    const nodes = await this.getNodes();
    const edges = await this.getEdges();

    return {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      nodeTypes: [...new Set(nodes.map(n => n.type).filter(Boolean))],
      edgeTypes: [...new Set(edges.map(e => e.type).filter(Boolean))]
    };
  }

  /**
   * Get a NodeHandle for drill-down access to a specific node
   * @param {string} id - Node ID
   * @returns {NodeHandle} Handle for the specific node
   */
  nodeHandle(id) {
    return new NodeHandle(this.dataSource, id);
  }

  /**
   * Get an EdgeHandle for drill-down access to a specific edge
   * @param {string} id - Edge ID
   * @returns {EdgeHandle} Handle for the specific edge
   */
  edgeHandle(id) {
    return new EdgeHandle(this.dataSource, id);
  }

  /**
   * Get graph data in a serializable format
   * @returns {Promise<Object>} Graph data with nodes and edges
   */
  async getData() {
    return {
      nodes: await this.getNodes(),
      edges: await this.getEdges()
    };
  }

  /**
   * Get the asset type for display
   * @returns {Promise<string>} Asset type 'graph'
   */
  async getType() {
    return 'graph';
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

    // Add GraphHandle-specific capabilities
    const customCapabilities = [
      'getNodes',
      'getEdges',
      'getNode',
      'getEdge',
      'addNode',
      'updateNode',
      'removeNode',
      'addEdge',
      'updateEdge',
      'removeEdge',
      'findNodes',
      'findEdges',
      'getConnectedNodes',
      'getConnectedEdges',
      'getMetadata',
      'getData',
      'getType',
      'nodeHandle',
      'edgeHandle'
    ];

    return {
      ...baseSerialize,
      capabilities: [...baseSerialize.capabilities, ...customCapabilities]
    };
  }

  // Note: receive() is handled by parent Handle class
  // Handle._handleRemoteCall() will call our async methods above
}
