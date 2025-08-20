import { QueryGraph, GraphNode } from './QueryGraph.js';
import { ScanNode } from './ScanNode.js';
import { ProjectNode } from './ProjectNode.js';
import { JoinNode } from './JoinNode.js';
import { UnionNode } from './UnionNode.js';
import { RenameNode } from './RenameNode.js';
import { DiffNode } from './DiffNode.js';
import { ComputeNode } from './ComputeNode.js';
import { Delta } from './Delta.js';
import { RelationRegistry } from './RelationRegistry.js';

/**
 * Execution context for tracking graph execution state
 */
export class ExecutionContext {
  constructor() {
    this._nodeInstances = new Map(); // GraphNode.id -> actual operator instance
    this._executionOrder = [];
    this._relationRegistry = new RelationRegistry();
    this._executionListeners = [];
    this._deltaCount = 0;
  }

  get relationRegistry() {
    return this._relationRegistry;
  }

  get executionOrder() {
    return [...this._executionOrder];
  }

  get deltaCount() {
    return this._deltaCount;
  }

  /**
   * Get operator instance for a graph node
   */
  getInstance(graphNodeId) {
    return this._nodeInstances.get(graphNodeId);
  }

  /**
   * Set operator instance for a graph node
   */
  setInstance(graphNodeId, instance) {
    this._nodeInstances.set(graphNodeId, instance);
  }

  /**
   * Add execution listener
   */
  addExecutionListener(listener) {
    this._executionListeners.push(listener);
  }

  /**
   * Notify execution listeners
   */
  notifyExecution(event, data = {}) {
    for (const listener of this._executionListeners) {
      if (listener[event]) {
        listener[event](data);
      }
    }
  }

  /**
   * Increment delta counter
   */
  incrementDeltaCount() {
    this._deltaCount++;
  }

  /**
   * Reset execution state
   */
  reset() {
    this._nodeInstances.clear();
    this._executionOrder = [];
    this._deltaCount = 0;
  }
}

/**
 * Graph execution engine for incremental LFTJ queries
 */
export class GraphEngine {
  constructor() {
    this._graphs = new Map(); // graph.id -> QueryGraph
    this._contexts = new Map(); // graph.id -> ExecutionContext
  }

  /**
   * Register a query graph for execution
   */
  registerGraph(graph) {
    if (!(graph instanceof QueryGraph)) {
      throw new Error('Must register a QueryGraph instance');
    }

    // Validate graph before registration
    const validation = graph.validate();
    if (!validation.isValid) {
      throw new Error(`Graph validation failed: ${validation.errors.join(', ')}`);
    }

    this._graphs.set(graph.id, graph);
    this._contexts.set(graph.id, new ExecutionContext());

    return this.buildExecutionPlan(graph.id);
  }

  /**
   * Get registered graph
   */
  getGraph(graphId) {
    return this._graphs.get(graphId);
  }

  /**
   * Get execution context
   */
  getContext(graphId) {
    return this._contexts.get(graphId);
  }

  /**
   * Build execution plan for a graph
   */
  buildExecutionPlan(graphId) {
    const graph = this._graphs.get(graphId);
    if (!graph) {
      throw new Error(`Graph '${graphId}' not found`);
    }

    const context = this._contexts.get(graphId);
    context.reset();

    // Get topological execution order
    const executionOrder = graph.getExecutionOrder();
    context._executionOrder = executionOrder;

    // Create operator instances
    for (const graphNode of executionOrder) {
      const instance = this._createOperatorInstance(graphNode, context);
      context.setInstance(graphNode.id, instance);
      graphNode.executionNode = instance;
    }

    // Wire operator connections
    for (const graphNode of executionOrder) {
      this._wireConnections(graphNode, context);
    }

    context.notifyExecution('planBuilt', {
      graphId,
      nodeCount: executionOrder.length,
      executionOrder: executionOrder.map(n => n.id)
    });

    return {
      graphId,
      nodeCount: executionOrder.length,
      executionOrder: executionOrder.map(n => ({ id: n.id, type: n.type }))
    };
  }

  /**
   * Safely get current set from an instance
   */
  _safeGetCurrentSet(instance) {
    if (!instance.getCurrentSet) {
      return null;
    }
    
    try {
      return instance.getCurrentSet();
    } catch (error) {
      // Some operators (like pointwise ComputeNode) don't support getCurrentSet
      return null;
    }
  }

  /**
   * Create operator instance from graph node
   */
  _createOperatorInstance(graphNode, context) {
    const { type, config } = graphNode;

    switch (type) {
      case 'scan':
        return new ScanNode(
          graphNode.id,
          config.relationName,
          config.schema,
          config.maintainState !== false
        );

      case 'project':
        return new ProjectNode(graphNode.id, config.indices);

      case 'join':
        // For now, create a simplified join with minimal parameters
        // TODO: Enhance to support full LFTJ variable order and atom specs
        const variableOrder = ['?x', '?y']; // Simplified
        const atomSpecs = [
          { relation: 'left', variables: ['?x'] },
          { relation: 'right', variables: ['?y'] }
        ];
        const iteratorFactory = context.relationRegistry;
        return new JoinNode(graphNode.id, variableOrder, atomSpecs, iteratorFactory);

      case 'union':
        return new UnionNode(graphNode.id);

      case 'rename':
        return new RenameNode(graphNode.id, config.mapping);

      case 'diff':
        // DiffNode requires key attributes - use all attributes by default
        const keyAttributes = [0]; // Simplified: use first attribute as key
        return new DiffNode(graphNode.id, keyAttributes);

      case 'compute':
        return new ComputeNode(graphNode.id, config.provider);

      default:
        throw new Error(`Unknown node type: ${type}`);
    }
  }

  /**
   * Wire connections between operator instances
   */
  _wireConnections(graphNode, context) {
    const instance = context.getInstance(graphNode.id);

    // Connect inputs
    for (const inputGraphNode of graphNode.inputs) {
      const inputInstance = context.getInstance(inputGraphNode.id);
      inputInstance.addOutput(instance);
    }
  }

  /**
   * Execute cold start for a graph
   */
  coldStart(graphId) {
    const graph = this._graphs.get(graphId);
    const context = this._contexts.get(graphId);

    if (!graph || !context) {
      throw new Error(`Graph '${graphId}' not found or not built`);
    }

    context.notifyExecution('coldStartBegin', { graphId });

    const results = new Map(); // nodeId -> Delta

    // Execute nodes in topological order
    for (const graphNode of context.executionOrder) {
      const instance = context.getInstance(graphNode.id);
      
      try {
        let delta;
        
        if (graphNode.type === 'scan') {
          // Scan nodes start with empty delta (no cold start method)
          delta = new Delta(new Set(), new Set());
        } else if (graphNode.type === 'compute' && instance.mode === 'enumerable') {
          // Enumerable compute nodes can perform cold start
          delta = instance.coldStart();
        } else {
          // Other nodes start with empty delta
          delta = new Delta(new Set(), new Set());
        }

        results.set(graphNode.id, delta);
        context.notifyExecution('nodeExecuted', {
          graphId,
          nodeId: graphNode.id,
          nodeType: graphNode.type,
          delta: {
            adds: delta.adds.size,
            removes: delta.removes.size
          }
        });

      } catch (error) {
        context.notifyExecution('nodeError', {
          graphId,
          nodeId: graphNode.id,
          error: error.message
        });
        throw error;
      }
    }

    // Collect results from output nodes
    const outputResults = {};
    for (const outputNode of graph.outputs) {
      const instance = context.getInstance(outputNode.id);
      outputResults[outputNode.id] = {
        nodeType: outputNode.type,
        delta: results.get(outputNode.id),
        currentSet: this._safeGetCurrentSet(instance)
      };
    }

    context.notifyExecution('coldStartComplete', { 
      graphId,
      outputResults: Object.keys(outputResults)
    });

    return outputResults;
  }

  /**
   * Process incremental update for a relation
   */
  processUpdate(graphId, relationName, delta) {
    const graph = this._graphs.get(graphId);
    const context = this._contexts.get(graphId);

    if (!graph || !context) {
      throw new Error(`Graph '${graphId}' not found or not built`);
    }

    // Find scan node for this relation
    const scanNode = graph.nodes.find(n => 
      n.type === 'scan' && n.config.relationName === relationName
    );

    if (!scanNode) {
      throw new Error(`No scan node found for relation '${relationName}'`);
    }

    context.incrementDeltaCount();
    context.notifyExecution('updateBegin', {
      graphId,
      relationName,
      deltaCount: context.deltaCount,
      delta: {
        adds: delta.adds.size,
        removes: delta.removes.size
      }
    });

    // Push delta to scan node
    const scanInstance = context.getInstance(scanNode.id);
    scanInstance.pushDelta(delta);

    // Collect results from output nodes
    const outputResults = {};
    for (const outputNode of graph.outputs) {
      const instance = context.getInstance(outputNode.id);
      outputResults[outputNode.id] = {
        nodeType: outputNode.type,
        currentSet: this._safeGetCurrentSet(instance)
      };
    }

    context.notifyExecution('updateComplete', {
      graphId,
      relationName,
      deltaCount: context.deltaCount,
      outputResults: Object.keys(outputResults)
    });

    return outputResults;
  }

  /**
   * Get current state of all output nodes
   */
  getOutputState(graphId) {
    const graph = this._graphs.get(graphId);
    const context = this._contexts.get(graphId);

    if (!graph || !context) {
      throw new Error(`Graph '${graphId}' not found or not built`);
    }

    const outputState = {};
    for (const outputNode of graph.outputs) {
      const instance = context.getInstance(outputNode.id);
      outputState[outputNode.id] = {
        nodeType: outputNode.type,
        currentSet: this._safeGetCurrentSet(instance),
        state: instance.getState ? instance.getState() : null
      };
    }

    return outputState;
  }

  /**
   * Reset execution state for a graph
   */
  reset(graphId) {
    const context = this._contexts.get(graphId);
    if (!context) {
      throw new Error(`Graph '${graphId}' not found`);
    }

    // Reset all operator instances
    for (const instance of context._nodeInstances.values()) {
      if (instance.reset) {
        instance.reset();
      }
    }

    context._deltaCount = 0;
    context.notifyExecution('graphReset', { graphId });
  }

  /**
   * Get execution statistics for a graph
   */
  getStatistics(graphId) {
    const graph = this._graphs.get(graphId);
    const context = this._contexts.get(graphId);

    if (!graph || !context) {
      throw new Error(`Graph '${graphId}' not found`);
    }

    const nodeStats = {};
    for (const graphNode of graph.nodes) {
      const instance = context.getInstance(graphNode.id);
      nodeStats[graphNode.id] = {
        type: graphNode.type,
        state: instance.getState ? instance.getState() : null
      };
    }

    return {
      graphId,
      deltaCount: context.deltaCount,
      nodeCount: graph.nodes.length,
      graphStats: graph.getStatistics(),
      nodeStats
    };
  }

  /**
   * Unregister a graph
   */
  unregisterGraph(graphId) {
    if (this._graphs.has(graphId)) {
      this.reset(graphId);
      this._graphs.delete(graphId);
      this._contexts.delete(graphId);
      return true;
    }
    return false;
  }

  /**
   * List all registered graphs
   */
  listGraphs() {
    return Array.from(this._graphs.keys());
  }
}