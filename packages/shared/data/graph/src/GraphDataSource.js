/**
 * GraphDataSource - Browser-compatible in-memory knowledge graph store
 *
 * Implements the DataSource interface for knowledge graphs with nodes and edges.
 * Works both locally and as a RemoteHandle for client-server scenarios.
 *
 * Features:
 * - In-memory storage of nodes and edges
 * - Query support with pattern matching
 * - Reactive subscriptions for changes
 * - Full CRUD operations
 * - Browser-compatible (no Node dependencies)
 */

import { validateDataSourceInterface } from '@legion/handle/src/DataSource.js';

export class GraphDataSource {
  constructor(initialGraph = { nodes: [], edges: [] }) {
    // Store nodes and edges in maps for O(1) lookup
    this.nodes = new Map();
    this.edges = new Map();

    // Track subscriptions for change notifications
    this._subscriptions = new Map();
    this._subscriptionId = 0;

    // Initialize from data
    if (initialGraph.nodes) {
      initialGraph.nodes.forEach(node => {
        this.nodes.set(node.id, { ...node });
      });
    }

    if (initialGraph.edges) {
      initialGraph.edges.forEach(edge => {
        this.edges.set(edge.id, { ...edge });
      });
    }

    // Validate DataSource interface
    validateDataSourceInterface(this, 'GraphDataSource');
  }

  /**
   * REQUIRED: Execute query against the graph
   * CRITICAL: Must be synchronous - no await!
   *
   * Query patterns:
   * - { type: 'nodes' } - Get all nodes
   * - { type: 'edges' } - Get all edges
   * - { type: 'node', id: 'node-1' } - Get specific node
   * - { type: 'edge', id: 'edge-1' } - Get specific edge
   * - { type: 'connectedNodes', nodeId: 'node-1' } - Get connected nodes
   * - { type: 'connectedEdges', nodeId: 'node-1' } - Get connected edges
   * - { find: ['?node'], where: [['?node', 'type', 'Entity']] } - Pattern matching
   */
  query(querySpec) {
    if (!querySpec || typeof querySpec !== 'object') {
      throw new Error('Query specification must be an object');
    }

    // Handle type-based queries
    if (querySpec.type === 'nodes') {
      return Array.from(this.nodes.values());
    }

    if (querySpec.type === 'edges') {
      return Array.from(this.edges.values());
    }

    if (querySpec.type === 'node') {
      if (!querySpec.id) {
        throw new Error('Node query requires id');
      }
      const node = this.nodes.get(querySpec.id);
      return node ? [node] : [];
    }

    if (querySpec.type === 'edge') {
      if (!querySpec.id) {
        throw new Error('Edge query requires id');
      }
      const edge = this.edges.get(querySpec.id);
      return edge ? [edge] : [];
    }

    if (querySpec.type === 'connectedNodes') {
      return this._getConnectedNodes(querySpec.nodeId);
    }

    if (querySpec.type === 'connectedEdges') {
      return this._getConnectedEdges(querySpec.nodeId);
    }

    // Handle pattern matching queries
    if (querySpec.find && querySpec.where) {
      return this._executePatternQuery(querySpec);
    }

    throw new Error('Unsupported query specification');
  }

  /**
   * REQUIRED: Set up subscription for change notifications
   * CRITICAL: Must be synchronous - no await!
   */
  subscribe(querySpec, callback) {
    if (!querySpec || typeof querySpec !== 'object') {
      throw new Error('Query specification must be an object');
    }

    if (!callback || typeof callback !== 'function') {
      throw new Error('Callback function is required');
    }

    // Create subscription synchronously
    const subscriptionId = ++this._subscriptionId;
    const subscription = {
      id: subscriptionId,
      querySpec,
      callback,
      unsubscribe: () => {
        this._subscriptions.delete(subscriptionId);
      }
    };

    this._subscriptions.set(subscriptionId, subscription);

    return subscription;
  }

  /**
   * REQUIRED: Get resource schema for introspection
   * CRITICAL: Must be synchronous - no await!
   */
  getSchema() {
    return {
      type: 'graph',
      version: '1.0.0',
      nodes: {
        properties: {
          id: { type: 'string', required: true },
          label: { type: 'string' },
          type: { type: 'string' },
          data: { type: 'object' },
          position: {
            type: 'object',
            properties: {
              x: { type: 'number' },
              y: { type: 'number' }
            }
          },
          size: {
            type: 'object',
            properties: {
              width: { type: 'number' },
              height: { type: 'number' }
            }
          }
        }
      },
      edges: {
        properties: {
          id: { type: 'string', required: true },
          source: { type: 'string', required: true },
          target: { type: 'string', required: true },
          label: { type: 'string' },
          type: { type: 'string' },
          data: { type: 'object' }
        }
      }
    };
  }

  /**
   * OPTIONAL: Update graph data
   * CRITICAL: Must be synchronous - no await!
   */
  update(updateSpec) {
    if (!updateSpec || typeof updateSpec !== 'object') {
      throw new Error('Update specification must be an object');
    }

    let changes = [];

    // Add node
    if (updateSpec.type === 'addNode') {
      const node = updateSpec.node;
      if (!node || !node.id) {
        throw new Error('Node must have an id');
      }
      this.nodes.set(node.id, { ...node });
      changes.push({ type: 'nodeAdded', node });
    }

    // Update node
    else if (updateSpec.type === 'updateNode') {
      const { id, updates } = updateSpec;
      if (!id) {
        throw new Error('Node id is required');
      }
      const node = this.nodes.get(id);
      if (!node) {
        throw new Error(`Node ${id} not found`);
      }
      Object.assign(node, updates);
      changes.push({ type: 'nodeUpdated', node, updates });
    }

    // Remove node
    else if (updateSpec.type === 'removeNode') {
      const { id } = updateSpec;
      if (!id) {
        throw new Error('Node id is required');
      }
      const node = this.nodes.get(id);
      if (node) {
        this.nodes.delete(id);
        // Also remove connected edges
        const connectedEdges = this._getConnectedEdges(id);
        connectedEdges.forEach(edge => {
          this.edges.delete(edge.id);
          changes.push({ type: 'edgeRemoved', edge });
        });
        changes.push({ type: 'nodeRemoved', node });
      }
    }

    // Add edge
    else if (updateSpec.type === 'addEdge') {
      const edge = updateSpec.edge;
      if (!edge || !edge.id) {
        throw new Error('Edge must have an id');
      }
      if (!edge.source || !edge.target) {
        throw new Error('Edge must have source and target');
      }
      this.edges.set(edge.id, { ...edge });
      changes.push({ type: 'edgeAdded', edge });
    }

    // Update edge
    else if (updateSpec.type === 'updateEdge') {
      const { id, updates } = updateSpec;
      if (!id) {
        throw new Error('Edge id is required');
      }
      const edge = this.edges.get(id);
      if (!edge) {
        throw new Error(`Edge ${id} not found`);
      }
      Object.assign(edge, updates);
      changes.push({ type: 'edgeUpdated', edge, updates });
    }

    // Remove edge
    else if (updateSpec.type === 'removeEdge') {
      const { id } = updateSpec;
      if (!id) {
        throw new Error('Edge id is required');
      }
      const edge = this.edges.get(id);
      if (edge) {
        this.edges.delete(id);
        changes.push({ type: 'edgeRemoved', edge });
      }
    }

    else {
      throw new Error(`Unsupported update type: ${updateSpec.type}`);
    }

    // Notify subscribers synchronously
    this._notifySubscribers(changes);

    return {
      success: true,
      changes
    };
  }

  /**
   * REQUIRED: Create query builder for Handle
   * CRITICAL: Must be synchronous - no await!
   */
  queryBuilder(sourceHandle) {
    if (!sourceHandle) {
      throw new Error('Source Handle is required for query builder');
    }

    // Return a query builder with combinator methods
    const builder = {
      _sourceHandle: sourceHandle,
      _querySpec: {},

      // Get all nodes
      nodes() {
        this._querySpec = { type: 'nodes' };
        return this;
      },

      // Get all edges
      edges() {
        this._querySpec = { type: 'edges' };
        return this;
      },

      // Get specific node
      node(id) {
        this._querySpec = { type: 'node', id };
        return this;
      },

      // Get specific edge
      edge(id) {
        this._querySpec = { type: 'edge', id };
        return this;
      },

      // Get nodes connected to a node
      connectedNodes(nodeId) {
        this._querySpec = { type: 'connectedNodes', nodeId };
        return this;
      },

      // Get edges connected to a node
      connectedEdges(nodeId) {
        this._querySpec = { type: 'connectedEdges', nodeId };
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
        if (this._filter) {
          results = results.filter(this._filter);
        }
        return results;
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

  // Private helper methods

  _getConnectedNodes(nodeId) {
    const connectedEdges = this._getConnectedEdges(nodeId);
    const connectedNodeIds = new Set();

    connectedEdges.forEach(edge => {
      if (edge.source === nodeId) {
        connectedNodeIds.add(edge.target);
      }
      if (edge.target === nodeId) {
        connectedNodeIds.add(edge.source);
      }
    });

    return Array.from(connectedNodeIds).map(id => this.nodes.get(id)).filter(Boolean);
  }

  _getConnectedEdges(nodeId) {
    return Array.from(this.edges.values()).filter(edge =>
      edge.source === nodeId || edge.target === nodeId
    );
  }

  _executePatternQuery(querySpec) {
    // Simple pattern matching implementation
    // For now, support basic node property matching
    const { find, where } = querySpec;

    // Extract variables and patterns
    const results = [];

    // For each node, check if it matches all patterns
    for (const node of this.nodes.values()) {
      let match = true;
      const bindings = {};

      for (const pattern of where) {
        const [subject, predicate, object] = pattern;

        // Variable subject matches this node
        if (subject.startsWith('?')) {
          bindings[subject.substring(1)] = node;

          // Check if node has the property
          if (node[predicate] !== object) {
            match = false;
            break;
          }
        }
      }

      if (match) {
        results.push(bindings);
      }
    }

    return results;
  }

  _notifySubscribers(changes) {
    for (const subscription of this._subscriptions.values()) {
      // Check if changes match subscription query
      if (this._matchesSubscription(changes, subscription.querySpec)) {
        subscription.callback(changes);
      }
    }
  }

  _matchesSubscription(changes, querySpec) {
    // Simple matching - notify all subscribers for now
    // Can be enhanced to match specific patterns
    return true;
  }
}
