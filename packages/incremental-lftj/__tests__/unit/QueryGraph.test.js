import { QueryGraph, GraphNode } from '../../src/QueryGraph.js';
import { Schema } from '../../src/Schema.js';
import { EnumerableProvider } from '../../src/ComputeProvider.js';

// Test provider
class TestProvider extends EnumerableProvider {
  constructor(id) {
    super(id);
  }

  enumerate() {
    return new Set();
  }

  deltaSince() {
    return { adds: new Set(), removes: new Set() };
  }
}

describe('GraphNode', () => {
  describe('constructor', () => {
    it('should create graph node with valid parameters', () => {
      const node = new GraphNode('test-node', 'scan', { relationName: 'users' });

      expect(node.id).toBe('test-node');
      expect(node.type).toBe('scan');
      expect(node.config).toEqual({ relationName: 'users' });
      expect(node.inputs).toEqual([]);
      expect(node.outputs).toEqual([]);
    });

    it('should throw error for invalid ID', () => {
      expect(() => {
        new GraphNode(123, 'scan');
      }).toThrow('Node ID must be a string');
    });
  });

  describe('connections', () => {
    let node1, node2, node3;

    beforeEach(() => {
      node1 = new GraphNode('node1', 'scan');
      node2 = new GraphNode('node2', 'project');
      node3 = new GraphNode('node3', 'union');
    });

    it('should add input connections', () => {
      node2.addInput(node1);

      expect(node2.inputs).toContain(node1);
      expect(node1.outputs).toContain(node2);
    });

    it('should add output connections', () => {
      node1.addOutput(node2);

      expect(node1.outputs).toContain(node2);
      expect(node2.inputs).toContain(node1);
    });

    it('should prevent duplicate connections', () => {
      node1.addOutput(node2);
      node1.addOutput(node2); // Duplicate

      expect(node1.outputs).toEqual([node2]);
      expect(node2.inputs).toEqual([node1]);
    });

    it('should throw error for invalid connection types', () => {
      expect(() => {
        node1.addInput({});
      }).toThrow('Input must be a GraphNode instance');

      expect(() => {
        node1.addOutput('invalid');
      }).toThrow('Output must be a GraphNode instance');
    });
  });

  describe('depth calculation', () => {
    it('should return 0 for leaf nodes', () => {
      const leaf = new GraphNode('leaf', 'scan');
      expect(leaf.getDepth()).toBe(0);
    });

    it('should calculate depth correctly for simple chain', () => {
      const node1 = new GraphNode('node1', 'scan');
      const node2 = new GraphNode('node2', 'project');
      const node3 = new GraphNode('node3', 'union');

      node2.addInput(node1);
      node3.addInput(node2);

      expect(node1.getDepth()).toBe(0);
      expect(node2.getDepth()).toBe(1);
      expect(node3.getDepth()).toBe(2);
    });

    it('should calculate depth correctly for multiple inputs', () => {
      const scan1 = new GraphNode('scan1', 'scan');
      const scan2 = new GraphNode('scan2', 'scan');
      const project1 = new GraphNode('project1', 'project');
      const join = new GraphNode('join', 'join');

      project1.addInput(scan1);
      join.addInput(project1);
      join.addInput(scan2);

      expect(scan1.getDepth()).toBe(0);
      expect(scan2.getDepth()).toBe(0);
      expect(project1.getDepth()).toBe(1);
      expect(join.getDepth()).toBe(2);
    });
  });

  describe('toString', () => {
    it('should produce readable string representation', () => {
      const node = new GraphNode('test-id', 'join');
      expect(node.toString()).toBe('GraphNode(test-id, join)');
    });
  });
});

describe('QueryGraph', () => {
  let graph;

  beforeEach(() => {
    graph = new QueryGraph('test-graph');
  });

  describe('constructor', () => {
    it('should create graph with valid ID', () => {
      expect(graph.id).toBe('test-graph');
      expect(graph.nodes).toEqual([]);
      expect(graph.relations).toEqual([]);
      expect(graph.outputs).toEqual([]);
    });

    it('should throw error for invalid ID', () => {
      expect(() => {
        new QueryGraph(42);
      }).toThrow('Graph ID must be a string');
    });
  });

  describe('node management', () => {
    it('should add nodes successfully', () => {
      const node = new GraphNode('test-node', 'scan');
      graph.addNode(node);

      expect(graph.nodes).toContain(node);
      expect(graph.getNode('test-node')).toBe(node);
    });

    it('should prevent duplicate node IDs', () => {
      const node1 = new GraphNode('duplicate-id', 'scan');
      const node2 = new GraphNode('duplicate-id', 'project');

      graph.addNode(node1);

      expect(() => {
        graph.addNode(node2);
      }).toThrow("Node with ID 'duplicate-id' already exists");
    });

    it('should throw error for invalid node types', () => {
      expect(() => {
        graph.addNode({});
      }).toThrow('Must add a GraphNode instance');
    });
  });

  describe('query building methods', () => {
    const userSchema = new Schema([
      { name: 'id', type: 'ID' },
      { name: 'name', type: 'String' }
    ]);

    it('should create scan nodes', () => {
      const scanNode = graph.scan('users', userSchema);

      expect(scanNode.type).toBe('scan');
      expect(scanNode.config.relationName).toBe('users');
      expect(scanNode.config.schema).toBe(userSchema);
      expect(graph.relations).toContain('users');
    });

    it('should create project nodes', () => {
      const scanNode = graph.scan('users', userSchema);
      const projectNode = graph.project(scanNode, [0, 1]);

      expect(projectNode.type).toBe('project');
      expect(projectNode.config.indices).toEqual([0, 1]);
      expect(projectNode.inputs).toContain(scanNode);
    });

    it('should create join nodes', () => {
      const scan1 = graph.scan('users', userSchema);
      const scan2 = graph.scan('orders', userSchema);
      const joinNode = graph.join(scan1, scan2, [{ left: 0, right: 0 }]);

      expect(joinNode.type).toBe('join');
      expect(joinNode.config.joinConditions).toEqual([{ left: 0, right: 0 }]);
      expect(joinNode.inputs).toContain(scan1);
      expect(joinNode.inputs).toContain(scan2);
    });

    it('should create union nodes', () => {
      const scan1 = graph.scan('users1', userSchema);
      const scan2 = graph.scan('users2', userSchema);
      const unionNode = graph.union([scan1, scan2]);

      expect(unionNode.type).toBe('union');
      expect(unionNode.inputs).toContain(scan1);
      expect(unionNode.inputs).toContain(scan2);
    });

    it('should create rename nodes', () => {
      const scanNode = graph.scan('users', userSchema);
      const renameNode = graph.rename(scanNode, { 0: 'user_id' });

      expect(renameNode.type).toBe('rename');
      expect(renameNode.config.mapping).toEqual({ 0: 'user_id' });
      expect(renameNode.inputs).toContain(scanNode);
    });

    it('should create diff nodes', () => {
      const scan1 = graph.scan('all_users', userSchema);
      const scan2 = graph.scan('banned_users', userSchema);
      const diffNode = graph.diff(scan1, scan2);

      expect(diffNode.type).toBe('diff');
      expect(diffNode.inputs).toContain(scan1);
      expect(diffNode.inputs).toContain(scan2);
    });

    it('should create compute nodes', () => {
      const provider = new TestProvider('test-provider');
      const computeNode = graph.compute(provider);

      expect(computeNode.type).toBe('compute');
      expect(computeNode.config.provider).toBe(provider);
    });
  });

  describe('execution order', () => {
    it('should return topological order for simple chain', () => {
      const userSchema = new Schema([{ name: 'id', type: 'ID' }]);
      
      const scan = graph.scan('users', userSchema);
      const project = graph.project(scan, [0]);
      
      const order = graph.getExecutionOrder();
      
      expect(order).toEqual([scan, project]);
    });

    it('should return topological order for join', () => {
      const userSchema = new Schema([{ name: 'id', type: 'ID' }]);
      
      const scan1 = graph.scan('users', userSchema);
      const scan2 = graph.scan('orders', userSchema);
      const join = graph.join(scan1, scan2, []);
      
      const order = graph.getExecutionOrder();
      
      // scan1 and scan2 should come before join
      expect(order.indexOf(scan1)).toBeLessThan(order.indexOf(join));
      expect(order.indexOf(scan2)).toBeLessThan(order.indexOf(join));
    });

    it('should detect cycles', () => {
      const node1 = new GraphNode('node1', 'scan');
      const node2 = new GraphNode('node2', 'project');
      
      graph.addNode(node1);
      graph.addNode(node2);
      
      // Create a cycle
      node1.addInput(node2);
      node2.addInput(node1);
      
      expect(() => {
        graph.getExecutionOrder();
      }).toThrow("Cycle detected in query graph at node 'node1'");
    });
  });

  describe('validation', () => {
    it('should validate correct graph', () => {
      const userSchema = new Schema([{ name: 'id', type: 'ID' }]);
      
      const scan = graph.scan('users', userSchema);
      const project = graph.project(scan, [0]);
      graph.setOutputs([project]);
      
      const validation = graph.validate();
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    it('should detect missing outputs', () => {
      const userSchema = new Schema([{ name: 'id', type: 'ID' }]);
      graph.scan('users', userSchema);
      
      const validation = graph.validate();
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Graph must have at least one output node');
    });

    it('should validate node configurations', () => {
      const node = new GraphNode('invalid-project', 'project', {});
      graph.addNode(node);
      graph.setOutputs([node]);
      
      const validation = graph.validate();
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(e => e.includes('Project node requires'))).toBe(true);
    });
  });

  describe('output management', () => {
    it('should set single output', () => {
      const userSchema = new Schema([{ name: 'id', type: 'ID' }]);
      const scan = graph.scan('users', userSchema);
      
      graph.setOutputs(scan);
      
      expect(graph.outputs).toEqual([scan]);
    });

    it('should set multiple outputs', () => {
      const userSchema = new Schema([{ name: 'id', type: 'ID' }]);
      const scan1 = graph.scan('users', userSchema);
      const scan2 = graph.scan('orders', userSchema);
      
      graph.setOutputs([scan1, scan2]);
      
      expect(graph.outputs).toEqual([scan1, scan2]);
    });

    it('should validate output nodes belong to graph', () => {
      const externalNode = new GraphNode('external', 'scan');
      
      expect(() => {
        graph.setOutputs([externalNode]);
      }).toThrow("Output node 'external' is not in this graph");
    });
  });

  describe('statistics', () => {
    it('should provide graph statistics', () => {
      const userSchema = new Schema([{ name: 'id', type: 'ID' }]);
      
      const scan1 = graph.scan('users', userSchema);
      const scan2 = graph.scan('orders', userSchema);
      const join = graph.join(scan1, scan2, []);
      const project = graph.project(join, [0]);
      
      graph.setOutputs([project]);
      
      const stats = graph.getStatistics();
      
      expect(stats.totalNodes).toBe(4);
      expect(stats.nodeTypes.scan).toBe(2);
      expect(stats.nodeTypes.join).toBe(1);
      expect(stats.nodeTypes.project).toBe(1);
      expect(stats.maxDepth).toBe(2);
      expect(stats.outputCount).toBe(1);
      expect(stats.relationCount).toBe(2);
    });
  });

  describe('toString', () => {
    it('should produce readable string representation', () => {
      expect(graph.toString()).toBe('QueryGraph(test-graph, 0 nodes)');
      
      const userSchema = new Schema([{ name: 'id', type: 'ID' }]);
      graph.scan('users', userSchema);
      
      expect(graph.toString()).toBe('QueryGraph(test-graph, 1 nodes)');
    });
  });
});