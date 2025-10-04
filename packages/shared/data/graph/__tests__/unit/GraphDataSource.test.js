/**
 * Unit tests for GraphDataSource
 *
 * Tests the browser-compatible in-memory graph store implementation
 * of the DataSource interface.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { GraphDataSource } from '../../src/GraphDataSource.js';

describe('GraphDataSource', () => {
  let graphDataSource;
  let sampleGraph;

  beforeEach(() => {
    sampleGraph = {
      nodes: [
        { id: 'node1', label: 'Node 1', type: 'Entity', data: { value: 100 } },
        { id: 'node2', label: 'Node 2', type: 'Entity', data: { value: 200 } },
        { id: 'node3', label: 'Node 3', type: 'Concept', data: { value: 300 } }
      ],
      edges: [
        { id: 'edge1', source: 'node1', target: 'node2', type: 'connects', label: 'Edge 1' },
        { id: 'edge2', source: 'node2', target: 'node3', type: 'relates', label: 'Edge 2' }
      ]
    };

    graphDataSource = new GraphDataSource(sampleGraph);
  });

  describe('Constructor and Initialization', () => {
    it('should create empty graph when no data provided', () => {
      const emptyGraph = new GraphDataSource();
      const nodes = emptyGraph.query({ type: 'nodes' });
      const edges = emptyGraph.query({ type: 'edges' });

      expect(nodes).toEqual([]);
      expect(edges).toEqual([]);
    });

    it('should initialize with provided nodes', () => {
      const nodes = graphDataSource.query({ type: 'nodes' });
      expect(nodes).toHaveLength(3);
      expect(nodes[0].id).toBe('node1');
      expect(nodes[1].id).toBe('node2');
      expect(nodes[2].id).toBe('node3');
    });

    it('should initialize with provided edges', () => {
      const edges = graphDataSource.query({ type: 'edges' });
      expect(edges).toHaveLength(2);
      expect(edges[0].id).toBe('edge1');
      expect(edges[1].id).toBe('edge2');
    });

    it('should validate DataSource interface', () => {
      // Should not throw - validation happens in constructor
      expect(() => new GraphDataSource()).not.toThrow();
    });
  });

  describe('Query Operations - Nodes', () => {
    it('should query all nodes', () => {
      const nodes = graphDataSource.query({ type: 'nodes' });
      expect(nodes).toHaveLength(3);
      expect(nodes.map(n => n.id)).toEqual(['node1', 'node2', 'node3']);
    });

    it('should query specific node by id', () => {
      const results = graphDataSource.query({ type: 'node', id: 'node1' });
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('node1');
      expect(results[0].label).toBe('Node 1');
    });

    it('should return empty array for non-existent node', () => {
      const results = graphDataSource.query({ type: 'node', id: 'nonexistent' });
      expect(results).toEqual([]);
    });

    it('should throw error when node query missing id', () => {
      expect(() => {
        graphDataSource.query({ type: 'node' });
      }).toThrow('Node query requires id');
    });
  });

  describe('Query Operations - Edges', () => {
    it('should query all edges', () => {
      const edges = graphDataSource.query({ type: 'edges' });
      expect(edges).toHaveLength(2);
      expect(edges.map(e => e.id)).toEqual(['edge1', 'edge2']);
    });

    it('should query specific edge by id', () => {
      const results = graphDataSource.query({ type: 'edge', id: 'edge1' });
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('edge1');
      expect(results[0].source).toBe('node1');
      expect(results[0].target).toBe('node2');
    });

    it('should return empty array for non-existent edge', () => {
      const results = graphDataSource.query({ type: 'edge', id: 'nonexistent' });
      expect(results).toEqual([]);
    });

    it('should throw error when edge query missing id', () => {
      expect(() => {
        graphDataSource.query({ type: 'edge' });
      }).toThrow('Edge query requires id');
    });
  });

  describe('Query Operations - Connected Elements', () => {
    it('should get nodes connected to a specific node', () => {
      const connectedNodes = graphDataSource.query({ type: 'connectedNodes', nodeId: 'node2' });
      expect(connectedNodes).toHaveLength(2);

      const connectedIds = connectedNodes.map(n => n.id).sort();
      expect(connectedIds).toEqual(['node1', 'node3']);
    });

    it('should get edges connected to a specific node', () => {
      const connectedEdges = graphDataSource.query({ type: 'connectedEdges', nodeId: 'node2' });
      expect(connectedEdges).toHaveLength(2);

      const edgeIds = connectedEdges.map(e => e.id).sort();
      expect(edgeIds).toEqual(['edge1', 'edge2']);
    });

    it('should return empty array for node with no connections', () => {
      // Add isolated node
      graphDataSource.update({ type: 'addNode', node: { id: 'isolated', label: 'Isolated' } });

      const connectedNodes = graphDataSource.query({ type: 'connectedNodes', nodeId: 'isolated' });
      const connectedEdges = graphDataSource.query({ type: 'connectedEdges', nodeId: 'isolated' });

      expect(connectedNodes).toEqual([]);
      expect(connectedEdges).toEqual([]);
    });
  });

  describe('Update Operations - Nodes', () => {
    it('should add new node', () => {
      const newNode = { id: 'node4', label: 'Node 4', type: 'Entity' };
      const result = graphDataSource.update({ type: 'addNode', node: newNode });

      expect(result.success).toBe(true);
      expect(result.changes).toHaveLength(1);
      expect(result.changes[0].type).toBe('nodeAdded');

      const nodes = graphDataSource.query({ type: 'nodes' });
      expect(nodes).toHaveLength(4);
    });

    it('should throw error when adding node without id', () => {
      expect(() => {
        graphDataSource.update({ type: 'addNode', node: { label: 'No ID' } });
      }).toThrow('Node must have an id');
    });

    it('should update existing node', () => {
      const result = graphDataSource.update({
        type: 'updateNode',
        id: 'node1',
        updates: { label: 'Updated Label', data: { value: 999 } }
      });

      expect(result.success).toBe(true);
      expect(result.changes[0].type).toBe('nodeUpdated');

      const nodeResults = graphDataSource.query({ type: 'node', id: 'node1' });
      expect(nodeResults[0].label).toBe('Updated Label');
      expect(nodeResults[0].data.value).toBe(999);
    });

    it('should throw error when updating non-existent node', () => {
      expect(() => {
        graphDataSource.update({ type: 'updateNode', id: 'nonexistent', updates: {} });
      }).toThrow('Node nonexistent not found');
    });

    it('should remove node', () => {
      const result = graphDataSource.update({ type: 'removeNode', id: 'node1' });

      expect(result.success).toBe(true);

      const nodes = graphDataSource.query({ type: 'nodes' });
      expect(nodes).toHaveLength(2);
      expect(nodes.map(n => n.id)).toEqual(['node2', 'node3']);
    });

    it('should remove connected edges when removing node', () => {
      const result = graphDataSource.update({ type: 'removeNode', id: 'node2' });

      expect(result.success).toBe(true);
      expect(result.changes.some(c => c.type === 'edgeRemoved')).toBe(true);

      const edges = graphDataSource.query({ type: 'edges' });
      expect(edges).toHaveLength(0); // Both edges were connected to node2
    });
  });

  describe('Update Operations - Edges', () => {
    it('should add new edge', () => {
      const newEdge = { id: 'edge3', source: 'node1', target: 'node3', type: 'links' };
      const result = graphDataSource.update({ type: 'addEdge', edge: newEdge });

      expect(result.success).toBe(true);
      expect(result.changes[0].type).toBe('edgeAdded');

      const edges = graphDataSource.query({ type: 'edges' });
      expect(edges).toHaveLength(3);
    });

    it('should throw error when adding edge without id', () => {
      expect(() => {
        graphDataSource.update({ type: 'addEdge', edge: { source: 'node1', target: 'node2' } });
      }).toThrow('Edge must have an id');
    });

    it('should throw error when adding edge without source or target', () => {
      expect(() => {
        graphDataSource.update({ type: 'addEdge', edge: { id: 'edge3', source: 'node1' } });
      }).toThrow('Edge must have source and target');
    });

    it('should update existing edge', () => {
      const result = graphDataSource.update({
        type: 'updateEdge',
        id: 'edge1',
        updates: { label: 'Updated Edge', type: 'newType' }
      });

      expect(result.success).toBe(true);
      expect(result.changes[0].type).toBe('edgeUpdated');

      const edgeResults = graphDataSource.query({ type: 'edge', id: 'edge1' });
      expect(edgeResults[0].label).toBe('Updated Edge');
      expect(edgeResults[0].type).toBe('newType');
    });

    it('should throw error when updating non-existent edge', () => {
      expect(() => {
        graphDataSource.update({ type: 'updateEdge', id: 'nonexistent', updates: {} });
      }).toThrow('Edge nonexistent not found');
    });

    it('should remove edge', () => {
      const result = graphDataSource.update({ type: 'removeEdge', id: 'edge1' });

      expect(result.success).toBe(true);

      const edges = graphDataSource.query({ type: 'edges' });
      expect(edges).toHaveLength(1);
      expect(edges[0].id).toBe('edge2');
    });
  });

  describe('Subscription', () => {
    it('should create subscription with callback', () => {
      const callback = jest.fn();
      const subscription = graphDataSource.subscribe({ type: 'nodes' }, callback);

      expect(subscription).toBeDefined();
      expect(subscription.id).toBeDefined();
      expect(subscription.unsubscribe).toBeInstanceOf(Function);
    });

    it('should notify subscribers on node add', () => {
      const callback = jest.fn();
      graphDataSource.subscribe({ type: 'nodes' }, callback);

      graphDataSource.update({ type: 'addNode', node: { id: 'node4', label: 'Node 4' } });

      expect(callback).toHaveBeenCalled();
      expect(callback.mock.calls[0][0]).toEqual([{ type: 'nodeAdded', node: { id: 'node4', label: 'Node 4' } }]);
    });

    it('should notify subscribers on node update', () => {
      const callback = jest.fn();
      graphDataSource.subscribe({ type: 'nodes' }, callback);

      graphDataSource.update({ type: 'updateNode', id: 'node1', updates: { label: 'Updated' } });

      expect(callback).toHaveBeenCalled();
      expect(callback.mock.calls[0][0][0].type).toBe('nodeUpdated');
    });

    it('should notify subscribers on edge add', () => {
      const callback = jest.fn();
      graphDataSource.subscribe({ type: 'edges' }, callback);

      graphDataSource.update({ type: 'addEdge', edge: { id: 'edge3', source: 'node1', target: 'node3' } });

      expect(callback).toHaveBeenCalled();
      expect(callback.mock.calls[0][0][0].type).toBe('edgeAdded');
    });

    it('should allow unsubscribe', () => {
      const callback = jest.fn();
      const subscription = graphDataSource.subscribe({ type: 'nodes' }, callback);

      subscription.unsubscribe();

      graphDataSource.update({ type: 'addNode', node: { id: 'node4', label: 'Node 4' } });

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('Schema', () => {
    it('should return graph schema', () => {
      const schema = graphDataSource.getSchema();

      expect(schema.type).toBe('graph');
      expect(schema.version).toBe('1.0.0');
      expect(schema.nodes).toBeDefined();
      expect(schema.edges).toBeDefined();
      expect(schema.nodes.properties.id).toBeDefined();
      expect(schema.edges.properties.source).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should throw error for invalid query spec', () => {
      expect(() => graphDataSource.query(null)).toThrow('Query specification must be an object');
      expect(() => graphDataSource.query('invalid')).toThrow('Query specification must be an object');
    });

    it('should throw error for unsupported query type', () => {
      expect(() => {
        graphDataSource.query({ type: 'unsupported' });
      }).toThrow('Unsupported query specification');
    });

    it('should throw error for invalid update spec', () => {
      expect(() => graphDataSource.update(null)).toThrow('Update specification must be an object');
    });

    it('should throw error for unsupported update type', () => {
      expect(() => {
        graphDataSource.update({ type: 'unsupported' });
      }).toThrow('Unsupported update type');
    });
  });
});
