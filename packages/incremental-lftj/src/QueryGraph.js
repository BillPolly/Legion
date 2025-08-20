/**
 * Query Graph representation for incremental LFTJ engine
 * Provides high-level interface for building and executing queries
 */

/**
 * Graph node descriptor for query planning
 */
export class GraphNode {
  constructor(id, type, config = {}) {
    if (typeof id !== 'string') {
      throw new Error('Node ID must be a string');
    }
    
    this._id = id;
    this._type = type;
    this._config = { ...config };
    this._inputs = [];
    this._outputs = [];
    this._executionNode = null; // Will hold the actual operator instance
  }

  get id() {
    return this._id;
  }

  get type() {
    return this._type;
  }

  get config() {
    return { ...this._config };
  }

  get inputs() {
    return [...this._inputs];
  }

  get outputs() {
    return [...this._outputs];
  }

  get executionNode() {
    return this._executionNode;
  }

  set executionNode(node) {
    this._executionNode = node;
  }

  /**
   * Add input dependency
   */
  addInput(inputNode) {
    if (!(inputNode instanceof GraphNode)) {
      throw new Error('Input must be a GraphNode instance');
    }
    
    if (!this._inputs.includes(inputNode)) {
      this._inputs.push(inputNode);
      inputNode._addOutput(this);
    }
  }

  /**
   * Add output dependency
   */
  addOutput(outputNode) {
    if (!(outputNode instanceof GraphNode)) {
      throw new Error('Output must be a GraphNode instance');
    }
    
    if (!this._outputs.includes(outputNode)) {
      this._outputs.push(outputNode);
      outputNode._addInput(this);
    }
  }

  _addInput(inputNode) {
    if (!this._inputs.includes(inputNode)) {
      this._inputs.push(inputNode);
    }
  }

  _addOutput(outputNode) {
    if (!this._outputs.includes(outputNode)) {
      this._outputs.push(outputNode);
    }
  }

  /**
   * Get topological depth (max distance from leaf nodes)
   */
  getDepth() {
    if (this._inputs.length === 0) {
      return 0; // Leaf node
    }

    let maxInputDepth = -1;
    for (const input of this._inputs) {
      maxInputDepth = Math.max(maxInputDepth, input.getDepth());
    }

    return maxInputDepth + 1;
  }

  toString() {
    return `GraphNode(${this._id}, ${this._type})`;
  }
}

/**
 * Query graph for incremental LFTJ queries
 */
export class QueryGraph {
  constructor(id) {
    if (typeof id !== 'string') {
      throw new Error('Graph ID must be a string');
    }

    this._id = id;
    this._nodes = new Map(); // id -> GraphNode
    this._relations = new Map(); // relation name -> GraphNode
    this._outputs = []; // Output nodes for this graph
  }

  get id() {
    return this._id;
  }

  get nodes() {
    return Array.from(this._nodes.values());
  }

  get relations() {
    return Array.from(this._relations.keys());
  }

  get outputs() {
    return [...this._outputs];
  }

  /**
   * Add a node to the graph
   */
  addNode(node) {
    if (!(node instanceof GraphNode)) {
      throw new Error('Must add a GraphNode instance');
    }

    if (this._nodes.has(node.id)) {
      throw new Error(`Node with ID '${node.id}' already exists`);
    }

    this._nodes.set(node.id, node);
    return node;
  }

  /**
   * Get node by ID
   */
  getNode(id) {
    return this._nodes.get(id);
  }

  /**
   * Create and add a scan node for a relation
   */
  scan(relationName, schema, nodeId = null) {
    const id = nodeId || `scan_${relationName}`;
    const node = new GraphNode(id, 'scan', {
      relationName,
      schema,
      maintainState: true
    });

    this.addNode(node);
    this._relations.set(relationName, node);
    return node;
  }

  /**
   * Create and add a projection node
   */
  project(inputNode, indices, nodeId = null) {
    const id = nodeId || `project_${inputNode.id}`;
    const node = new GraphNode(id, 'project', { indices });

    this.addNode(node);
    node.addInput(inputNode);
    return node;
  }

  /**
   * Create and add a join node
   */
  join(leftInput, rightInput, joinConditions, nodeId = null) {
    const id = nodeId || `join_${leftInput.id}_${rightInput.id}`;
    const node = new GraphNode(id, 'join', { joinConditions });

    this.addNode(node);
    node.addInput(leftInput);
    node.addInput(rightInput);
    return node;
  }

  /**
   * Create and add a union node
   */
  union(inputNodes, nodeId = null) {
    const inputIds = inputNodes.map(n => n.id).join('_');
    const id = nodeId || `union_${inputIds}`;
    const node = new GraphNode(id, 'union', {});

    this.addNode(node);
    for (const inputNode of inputNodes) {
      node.addInput(inputNode);
    }
    return node;
  }

  /**
   * Create and add a rename node
   */
  rename(inputNode, mapping, nodeId = null) {
    const id = nodeId || `rename_${inputNode.id}`;
    const node = new GraphNode(id, 'rename', { mapping });

    this.addNode(node);
    node.addInput(inputNode);
    return node;
  }

  /**
   * Create and add a diff node
   */
  diff(leftInput, rightInput, nodeId = null) {
    const id = nodeId || `diff_${leftInput.id}_${rightInput.id}`;
    const node = new GraphNode(id, 'diff', {});

    this.addNode(node);
    node.addInput(leftInput);
    node.addInput(rightInput);
    return node;
  }

  /**
   * Create and add a compute node
   */
  compute(provider, nodeId = null) {
    const id = nodeId || `compute_${provider.id}`;
    const node = new GraphNode(id, 'compute', { provider });

    this.addNode(node);
    return node;
  }

  /**
   * Mark nodes as outputs of this graph
   */
  setOutputs(outputNodes) {
    if (!Array.isArray(outputNodes)) {
      outputNodes = [outputNodes];
    }

    for (const node of outputNodes) {
      if (!(node instanceof GraphNode)) {
        throw new Error('Output must be a GraphNode instance');
      }
      if (!this._nodes.has(node.id)) {
        throw new Error(`Output node '${node.id}' is not in this graph`);
      }
    }

    this._outputs = [...outputNodes];
  }

  /**
   * Get execution order using topological sort
   */
  getExecutionOrder() {
    const visited = new Set();
    const visiting = new Set();
    const order = [];

    const visit = (node) => {
      if (visiting.has(node.id)) {
        throw new Error(`Cycle detected in query graph at node '${node.id}'`);
      }
      if (visited.has(node.id)) {
        return;
      }

      visiting.add(node.id);

      // Visit all input dependencies first
      for (const input of node.inputs) {
        visit(input);
      }

      visiting.delete(node.id);
      visited.add(node.id);
      order.push(node);
    };

    // Start from all nodes (ensures we catch disconnected components)
    for (const node of this._nodes.values()) {
      if (!visited.has(node.id)) {
        visit(node);
      }
    }

    return order;
  }

  /**
   * Validate the graph structure
   */
  validate() {
    const errors = [];

    // Check for cycles
    try {
      this.getExecutionOrder();
    } catch (error) {
      errors.push(error.message);
    }

    // Check that all nodes have valid configurations
    for (const node of this._nodes.values()) {
      try {
        this._validateNodeConfig(node);
      } catch (error) {
        errors.push(`Node '${node.id}': ${error.message}`);
      }
    }

    // Check that output nodes are specified
    if (this._outputs.length === 0) {
      errors.push('Graph must have at least one output node');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  _validateNodeConfig(node) {
    const { type, config } = node;

    switch (type) {
      case 'scan':
        if (!config.relationName || !config.schema) {
          throw new Error('Scan node requires relationName and schema');
        }
        break;

      case 'project':
        if (!Array.isArray(config.indices) || config.indices.length === 0) {
          throw new Error('Project node requires non-empty indices array');
        }
        if (node.inputs.length !== 1) {
          throw new Error('Project node requires exactly one input');
        }
        break;

      case 'join':
        if (!Array.isArray(config.joinConditions)) {
          throw new Error('Join node requires joinConditions array');
        }
        if (node.inputs.length !== 2) {
          throw new Error('Join node requires exactly two inputs');
        }
        break;

      case 'union':
        if (node.inputs.length < 2) {
          throw new Error('Union node requires at least two inputs');
        }
        break;

      case 'rename':
        if (!config.mapping || typeof config.mapping !== 'object') {
          throw new Error('Rename node requires mapping object');
        }
        if (node.inputs.length !== 1) {
          throw new Error('Rename node requires exactly one input');
        }
        break;

      case 'diff':
        if (node.inputs.length !== 2) {
          throw new Error('Diff node requires exactly two inputs');
        }
        break;

      case 'compute':
        if (!config.provider) {
          throw new Error('Compute node requires provider');
        }
        break;

      default:
        throw new Error(`Unknown node type: ${type}`);
    }
  }

  /**
   * Get statistics about the graph
   */
  getStatistics() {
    const nodeTypes = {};
    let maxDepth = 0;

    for (const node of this._nodes.values()) {
      nodeTypes[node.type] = (nodeTypes[node.type] || 0) + 1;
      maxDepth = Math.max(maxDepth, node.getDepth());
    }

    return {
      totalNodes: this._nodes.size,
      nodeTypes,
      maxDepth,
      outputCount: this._outputs.length,
      relationCount: this._relations.size
    };
  }

  toString() {
    return `QueryGraph(${this._id}, ${this._nodes.size} nodes)`;
  }
}