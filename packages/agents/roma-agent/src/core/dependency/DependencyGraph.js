/**
 * DependencyGraph - Manages task dependency graph structure
 * Single responsibility: Graph data structure and traversal
 */

export class DependencyGraph {
  constructor() {
    this.nodes = new Map();
    this.edges = new Map();
  }

  /**
   * Add a node to the graph
   * @param {string} nodeId - Node identifier
   * @param {Object} nodeData - Node data
   */
  addNode(nodeId, nodeData) {
    if (!this.nodes.has(nodeId)) {
      this.nodes.set(nodeId, {
        id: nodeId,
        data: nodeData,
        dependencies: new Set(),
        dependents: new Set()
      });
    }
    return this.nodes.get(nodeId);
  }

  /**
   * Add an edge between two nodes
   * @param {string} fromId - Source node ID
   * @param {string} toId - Target node ID
   */
  addEdge(fromId, toId) {
    const fromNode = this.nodes.get(fromId);
    const toNode = this.nodes.get(toId);
    
    if (!fromNode || !toNode) {
      throw new Error(`Cannot add edge: nodes ${fromId} or ${toId} not found`);
    }
    
    fromNode.dependencies.add(toId);
    toNode.dependents.add(fromId);
    
    const edgeKey = `${fromId}->${toId}`;
    this.edges.set(edgeKey, { from: fromId, to: toId });
  }

  /**
   * Get node by ID
   * @param {string} nodeId - Node ID
   * @returns {Object|null} - Node or null
   */
  getNode(nodeId) {
    return this.nodes.get(nodeId) || null;
  }

  /**
   * Get all nodes
   * @returns {Map} - All nodes
   */
  getAllNodes() {
    return new Map(this.nodes);
  }

  /**
   * Get dependencies of a node
   * @param {string} nodeId - Node ID
   * @returns {Set} - Set of dependency IDs
   */
  getDependencies(nodeId) {
    const node = this.nodes.get(nodeId);
    return node ? new Set(node.dependencies) : new Set();
  }

  /**
   * Get dependents of a node
   * @param {string} nodeId - Node ID
   * @returns {Set} - Set of dependent IDs
   */
  getDependents(nodeId) {
    const node = this.nodes.get(nodeId);
    return node ? new Set(node.dependents) : new Set();
  }

  /**
   * Check if graph has a node
   * @param {string} nodeId - Node ID
   * @returns {boolean} - True if node exists
   */
  hasNode(nodeId) {
    return this.nodes.has(nodeId);
  }

  /**
   * Check if edge exists
   * @param {string} fromId - Source node ID
   * @param {string} toId - Target node ID
   * @returns {boolean} - True if edge exists
   */
  hasEdge(fromId, toId) {
    const node = this.nodes.get(fromId);
    return node ? node.dependencies.has(toId) : false;
  }

  /**
   * Get node count
   * @returns {number} - Number of nodes
   */
  getNodeCount() {
    return this.nodes.size;
  }

  /**
   * Get edge count
   * @returns {number} - Number of edges
   */
  getEdgeCount() {
    return this.edges.size;
  }

  /**
   * Get nodes with no dependencies (roots)
   * @returns {Array<string>} - Root node IDs
   */
  getRootNodes() {
    const roots = [];
    for (const [nodeId, node] of this.nodes) {
      if (node.dependencies.size === 0) {
        roots.push(nodeId);
      }
    }
    return roots;
  }

  /**
   * Get nodes with no dependents (leaves)
   * @returns {Array<string>} - Leaf node IDs
   */
  getLeafNodes() {
    const leaves = [];
    for (const [nodeId, node] of this.nodes) {
      if (node.dependents.size === 0) {
        leaves.push(nodeId);
      }
    }
    return leaves;
  }

  /**
   * Clear the graph
   */
  clear() {
    this.nodes.clear();
    this.edges.clear();
  }

  /**
   * Export graph structure
   * @returns {Object} - Graph structure
   */
  export() {
    const nodes = [];
    const edges = [];
    
    for (const [nodeId, node] of this.nodes) {
      nodes.push({
        id: nodeId,
        data: node.data,
        dependencies: Array.from(node.dependencies),
        dependents: Array.from(node.dependents)
      });
    }
    
    for (const [edgeKey, edge] of this.edges) {
      edges.push(edge);
    }
    
    return { nodes, edges };
  }

  /**
   * Import graph structure
   * @param {Object} data - Graph data
   */
  import(data) {
    this.clear();
    
    // First add all nodes
    for (const node of data.nodes) {
      this.addNode(node.id, node.data);
    }
    
    // Then add edges
    for (const edge of data.edges) {
      this.addEdge(edge.from, edge.to);
    }
  }
}