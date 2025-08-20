import { GraphEngine, ExecutionContext } from '../../src/GraphEngine.js';
import { QueryGraph, GraphNode } from '../../src/QueryGraph.js';
import { Schema } from '../../src/Schema.js';
import { Delta } from '../../src/Delta.js';
import { Tuple } from '../../src/Tuple.js';
import { ID, StringAtom, Integer } from '../../src/Atom.js';
import { EnumerableProvider } from '../../src/ComputeProvider.js';

// Test provider
class TestEnumerableProvider extends EnumerableProvider {
  constructor(id, initialData = []) {
    super(id);
    this._data = new Set(initialData);
    this._changes = [];
  }

  enumerate() {
    return new Set(this._data);
  }

  deltaSince(stateHandle) {
    if (stateHandle >= this._changes.length) {
      return { adds: new Set(), removes: new Set() };
    }

    const adds = new Set();
    const removes = new Set();

    for (let i = stateHandle; i < this._changes.length; i++) {
      const change = this._changes[i];
      if (change.type === 'add') {
        adds.add(change.tuple);
      } else {
        removes.add(change.tuple);
      }
    }

    return { adds, removes };
  }

  addTuple(tuple) {
    this._data.add(tuple);
    this._changes.push({ type: 'add', tuple });
  }

  removeTuple(tuple) {
    this._data.delete(tuple);
    this._changes.push({ type: 'remove', tuple });
  }
}

describe('ExecutionContext', () => {
  let context;

  beforeEach(() => {
    context = new ExecutionContext();
  });

  describe('constructor', () => {
    it('should initialize empty context', () => {
      expect(context.executionOrder).toEqual([]);
      expect(context.deltaCount).toBe(0);
      expect(context.relationRegistry).toBeDefined();
    });
  });

  describe('instance management', () => {
    it('should store and retrieve instances', () => {
      const mockInstance = { id: 'test' };
      
      context.setInstance('node1', mockInstance);
      
      expect(context.getInstance('node1')).toBe(mockInstance);
      expect(context.getInstance('nonexistent')).toBeUndefined();
    });
  });

  describe('execution listeners', () => {
    it('should notify execution listeners', () => {
      const listener = {
        testEvent: function(data) { this.testEventCalled = true; this.testEventData = data; },
        anotherEvent: function(data) { this.anotherEventCalled = true; }
      };

      context.addExecutionListener(listener);
      context.notifyExecution('testEvent', { data: 'test' });

      expect(listener.testEventCalled).toBe(true);
      expect(listener.testEventData).toEqual({ data: 'test' });
      expect(listener.anotherEventCalled).toBeFalsy();
    });

    it('should handle listeners without specific event handlers', () => {
      const listener = {};

      context.addExecutionListener(listener);
      
      expect(() => {
        context.notifyExecution('nonexistentEvent');
      }).not.toThrow();
    });
  });

  describe('delta counting', () => {
    it('should increment delta count', () => {
      expect(context.deltaCount).toBe(0);
      
      context.incrementDeltaCount();
      expect(context.deltaCount).toBe(1);
      
      context.incrementDeltaCount();
      expect(context.deltaCount).toBe(2);
    });
  });

  describe('reset', () => {
    it('should reset context state', () => {
      const mockInstance = { id: 'test' };
      
      context.setInstance('node1', mockInstance);
      context.incrementDeltaCount();
      context._executionOrder = ['node1'];
      
      context.reset();
      
      expect(context.getInstance('node1')).toBeUndefined();
      expect(context.deltaCount).toBe(0);
      expect(context.executionOrder).toEqual([]);
    });
  });
});

describe('GraphEngine', () => {
  let engine, graph, userSchema, orderSchema;

  beforeEach(() => {
    engine = new GraphEngine();
    graph = new QueryGraph('test-query');
    
    userSchema = new Schema([
      { name: 'user_id', type: 'ID' },
      { name: 'name', type: 'String' }
    ]);

    orderSchema = new Schema([
      { name: 'order_id', type: 'ID' },
      { name: 'user_id', type: 'ID' },
      { name: 'amount', type: 'Integer' }
    ]);
  });

  describe('graph registration', () => {
    it('should register valid graph', () => {
      const userScan = graph.scan('users', userSchema);
      graph.setOutputs([userScan]);

      const result = engine.registerGraph(graph);

      expect(result.graphId).toBe('test-query');
      expect(result.nodeCount).toBe(1);
      expect(result.executionOrder).toEqual([{ id: userScan.id, type: 'scan' }]);
      expect(engine.getGraph('test-query')).toBe(graph);
    });

    it('should reject invalid graph', () => {
      // Graph without outputs
      graph.scan('users', userSchema);

      expect(() => {
        engine.registerGraph(graph);
      }).toThrow('Graph validation failed');
    });

    it('should reject non-graph objects', () => {
      expect(() => {
        engine.registerGraph({});
      }).toThrow('Must register a QueryGraph instance');
    });
  });

  describe('execution plan building', () => {
    it('should build execution plan for simple scan', () => {
      const userScan = graph.scan('users', userSchema);
      graph.setOutputs([userScan]);

      const result = engine.registerGraph(graph);
      const context = engine.getContext('test-query');

      expect(context.getInstance(userScan.id)).toBeDefined();
      expect(context.getInstance(userScan.id).constructor.name).toBe('ScanNode');
      expect(result.executionOrder).toEqual([{ id: userScan.id, type: 'scan' }]);
    });

    it('should build execution plan for complex query', () => {
      const userScan = graph.scan('users', userSchema);
      const orderScan = graph.scan('orders', orderSchema);
      const join = graph.join(userScan, orderScan, [{ left: 0, right: 1 }]);
      const project = graph.project(join, [0, 2]);
      
      graph.setOutputs([project]);

      const result = engine.registerGraph(graph);
      const context = engine.getContext('test-query');

      expect(result.nodeCount).toBe(4);
      
      // Check that all nodes have instances
      expect(context.getInstance(userScan.id)).toBeDefined();
      expect(context.getInstance(orderScan.id)).toBeDefined();
      expect(context.getInstance(join.id)).toBeDefined();
      expect(context.getInstance(project.id)).toBeDefined();

      // Check execution order respects dependencies
      const order = result.executionOrder.map(n => n.id);
      expect(order.indexOf(userScan.id)).toBeLessThan(order.indexOf(join.id));
      expect(order.indexOf(orderScan.id)).toBeLessThan(order.indexOf(join.id));
      expect(order.indexOf(join.id)).toBeLessThan(order.indexOf(project.id));
    });

    it('should wire operator connections correctly', () => {
      const userScan = graph.scan('users', userSchema);
      const project = graph.project(userScan, [0]);
      
      graph.setOutputs([project]);
      engine.registerGraph(graph);

      const context = engine.getContext('test-query');
      const scanInstance = context.getInstance(userScan.id);
      const projectInstance = context.getInstance(project.id);

      expect(scanInstance.outputs).toContain(projectInstance);
      expect(projectInstance.inputs).toContain(scanInstance);
    });
  });

  describe('operator instance creation', () => {
    beforeEach(() => {
      const userScan = graph.scan('users', userSchema);
      graph.setOutputs([userScan]);
      engine.registerGraph(graph);
    });

    it('should create scan node instances', () => {
      const userScan = new GraphNode('users2-scan', 'scan', {
        relationName: 'users2',
        schema: userSchema,
        maintainState: true
      });
      const context = engine.getContext('test-query');
      
      const instance = engine._createOperatorInstance(userScan, context);
      
      expect(instance.constructor.name).toBe('ScanNode');
      expect(instance.id).toBe(userScan.id);
    });

    it('should create project node instances', () => {
      const projectNode = new GraphNode('test-project', 'project', { indices: [0, 1] });
      const context = engine.getContext('test-query');
      
      const instance = engine._createOperatorInstance(projectNode, context);
      
      expect(instance.constructor.name).toBe('ProjectNode');
      expect(instance.projectionIndices).toEqual([0, 1]);
    });

    it('should create join node instances', () => {
      const joinNode = new GraphNode('test-join', 'join', { 
        joinConditions: [{ left: 0, right: 1 }] 
      });
      const context = engine.getContext('test-query');
      
      const instance = engine._createOperatorInstance(joinNode, context);
      
      expect(instance.constructor.name).toBe('JoinNode');
      expect(instance._atomSpecs).toHaveLength(2);
      expect(instance._atomSpecs[0].relation).toBe('left');
      expect(instance._atomSpecs[1].relation).toBe('right');
    });

    it('should create union node instances', () => {
      const unionNode = new GraphNode('test-union', 'union', {});
      const context = engine.getContext('test-query');
      
      const instance = engine._createOperatorInstance(unionNode, context);
      
      expect(instance.constructor.name).toBe('UnionNode');
    });

    it('should create rename node instances', () => {
      const renameNode = new GraphNode('test-rename', 'rename', { 
        mapping: { 0: 'user_id' } 
      });
      const context = engine.getContext('test-query');
      
      const instance = engine._createOperatorInstance(renameNode, context);
      
      expect(instance.constructor.name).toBe('RenameNode');
      expect(instance._variableMapping.get('0')).toBe('user_id');
    });

    it('should create diff node instances', () => {
      const diffNode = new GraphNode('test-diff', 'diff', {});
      const context = engine.getContext('test-query');
      
      const instance = engine._createOperatorInstance(diffNode, context);
      
      expect(instance.constructor.name).toBe('DiffNode');
    });

    it('should create compute node instances', () => {
      const provider = new TestEnumerableProvider('test-provider');
      const computeNode = new GraphNode('test-compute', 'compute', { provider });
      const context = engine.getContext('test-query');
      
      const instance = engine._createOperatorInstance(computeNode, context);
      
      expect(instance.constructor.name).toBe('ComputeNode');
      expect(instance.provider).toBe(provider);
    });

    it('should throw error for unknown node types', () => {
      const unknownNode = new GraphNode('test-unknown', 'unknown', {});
      const context = engine.getContext('test-query');
      
      expect(() => {
        engine._createOperatorInstance(unknownNode, context);
      }).toThrow('Unknown node type: unknown');
    });
  });

  describe('cold start execution', () => {
    it('should execute cold start for scan node', () => {
      const userScan = graph.scan('users', userSchema);
      graph.setOutputs([userScan]);
      engine.registerGraph(graph);

      const results = engine.coldStart('test-query');

      expect(results[userScan.id]).toBeDefined();
      expect(results[userScan.id].nodeType).toBe('scan');
      expect(results[userScan.id].delta).toBeDefined();
      expect(results[userScan.id].currentSet).toBeDefined();
    });

    it('should execute cold start for enumerable compute node', () => {
      const provider = new TestEnumerableProvider('test-provider');
      const tuple1 = new Tuple([new ID('1'), new StringAtom('test')]);
      provider.addTuple(tuple1);
      
      const computeNode = graph.compute(provider);
      graph.setOutputs([computeNode]);
      engine.registerGraph(graph);

      const results = engine.coldStart('test-query');

      expect(results[computeNode.id]).toBeDefined();
      expect(results[computeNode.id].nodeType).toBe('compute');
      expect(results[computeNode.id].delta.adds.size).toBe(1);
    });

    it('should notify execution listeners during cold start', () => {
      const userScan = graph.scan('users', userSchema);
      graph.setOutputs([userScan]);
      engine.registerGraph(graph);

      const listener = {
        coldStartBegin: function(data) { this.coldStartBeginCalled = true; },
        nodeExecuted: function(data) { this.nodeExecutedCalled = true; },
        coldStartComplete: function(data) { this.coldStartCompleteCalled = true; }
      };

      const context = engine.getContext('test-query');
      context.addExecutionListener(listener);

      engine.coldStart('test-query');

      expect(listener.coldStartBeginCalled).toBe(true);
      expect(listener.nodeExecutedCalled).toBe(true);
      expect(listener.coldStartCompleteCalled).toBe(true);
    });

    it('should throw error for unknown graph', () => {
      expect(() => {
        engine.coldStart('nonexistent-graph');
      }).toThrow("Graph 'nonexistent-graph' not found or not built");
    });
  });

  describe('incremental updates', () => {
    beforeEach(() => {
      const userScan = graph.scan('users', userSchema);
      graph.setOutputs([userScan]);
      engine.registerGraph(graph);
    });

    it('should process incremental update', () => {
      const tuple1 = new Tuple([new ID('1'), new StringAtom('Alice')]);
      const delta = new Delta(new Set([tuple1]), new Set());

      const results = engine.processUpdate('test-query', 'users', delta);

      expect(results).toBeDefined();
      expect(Object.keys(results)).toContain(graph.outputs[0].id);
    });

    it('should increment delta count', () => {
      const context = engine.getContext('test-query');
      expect(context.deltaCount).toBe(0);

      const delta = new Delta(new Set(), new Set());
      engine.processUpdate('test-query', 'users', delta);

      expect(context.deltaCount).toBe(1);
    });

    it('should notify execution listeners during update', () => {
      const listener = {
        updateBegin: function(data) { this.updateBeginCalled = true; this.updateBeginData = data; },
        updateComplete: function(data) { this.updateCompleteCalled = true; }
      };

      const context = engine.getContext('test-query');
      context.addExecutionListener(listener);

      const delta = new Delta(new Set(), new Set());
      engine.processUpdate('test-query', 'users', delta);

      expect(listener.updateBeginCalled).toBe(true);
      expect(listener.updateBeginData.graphId).toBe('test-query');
      expect(listener.updateBeginData.relationName).toBe('users');
      expect(listener.updateCompleteCalled).toBe(true);
    });

    it('should throw error for unknown relation', () => {
      const delta = new Delta(new Set(), new Set());

      expect(() => {
        engine.processUpdate('test-query', 'nonexistent-relation', delta);
      }).toThrow("No scan node found for relation 'nonexistent-relation'");
    });
  });

  describe('state management', () => {
    beforeEach(() => {
      const userScan = graph.scan('users', userSchema);
      graph.setOutputs([userScan]);
      engine.registerGraph(graph);
    });

    it('should get output state', () => {
      const state = engine.getOutputState('test-query');

      expect(state).toBeDefined();
      expect(Object.keys(state)).toContain(graph.outputs[0].id);
    });

    it('should reset graph state', () => {
      const context = engine.getContext('test-query');
      context.incrementDeltaCount();

      engine.reset('test-query');

      expect(context.deltaCount).toBe(0);
    });

    it('should get execution statistics', () => {
      const stats = engine.getStatistics('test-query');

      expect(stats.graphId).toBe('test-query');
      expect(stats.deltaCount).toBe(0);
      expect(stats.nodeCount).toBe(1);
      expect(stats.graphStats).toBeDefined();
      expect(stats.nodeStats).toBeDefined();
    });
  });

  describe('graph lifecycle', () => {
    it('should list registered graphs', () => {
      expect(engine.listGraphs()).toEqual([]);

      const userScan = graph.scan('users', userSchema);
      graph.setOutputs([userScan]);
      engine.registerGraph(graph);

      expect(engine.listGraphs()).toEqual(['test-query']);
    });

    it('should unregister graphs', () => {
      const userScan = graph.scan('users', userSchema);
      graph.setOutputs([userScan]);
      engine.registerGraph(graph);

      expect(engine.unregisterGraph('test-query')).toBe(true);
      expect(engine.listGraphs()).toEqual([]);
      expect(engine.getGraph('test-query')).toBeUndefined();
    });

    it('should return false when unregistering nonexistent graph', () => {
      expect(engine.unregisterGraph('nonexistent')).toBe(false);
    });
  });
});