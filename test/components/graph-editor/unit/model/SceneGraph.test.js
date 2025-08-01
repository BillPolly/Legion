/**
 * Unit tests for SceneGraph class
 */

import { SceneGraph } from '../../../../../src/components/graph-editor/model/SceneGraph.js';
import { Node } from '../../../../../src/components/graph-editor/model/Node.js';

describe('SceneGraph', () => {
  describe('Construction', () => {
    it('should create an empty scene graph', () => {
      const sceneGraph = new SceneGraph();
      
      expect(sceneGraph).toBeDefined();
      expect(sceneGraph.getRoot()).toBeDefined();
      expect(sceneGraph.getNodeCount()).toBe(1); // Just the root
    });

    it('should initialize with a root node', () => {
      const sceneGraph = new SceneGraph();
      const root = sceneGraph.getRoot();
      
      expect(root).toBeInstanceOf(Node);
      expect(root.getId()).toBe('root');
      expect(root.getType()).toBe('root');
    });

    it('should maintain node map for O(1) lookup', () => {
      const sceneGraph = new SceneGraph();
      const root = sceneGraph.getRoot();
      
      expect(sceneGraph.getNodeById('root')).toBe(root);
    });
  });

  describe('Node Management', () => {
    let sceneGraph;

    beforeEach(() => {
      sceneGraph = new SceneGraph();
    });

    it('should add nodes to the graph', () => {
      const node1 = new Node({ id: 'node1', type: 'default' });
      const node2 = new Node({ id: 'node2', type: 'default' });
      
      sceneGraph.addNode(node1);
      sceneGraph.addNode(node2);
      
      expect(sceneGraph.getNodeCount()).toBe(3); // root + 2 nodes
      expect(sceneGraph.getNodeById('node1')).toBe(node1);
      expect(sceneGraph.getNodeById('node2')).toBe(node2);
    });

    it('should add nodes as children of root by default', () => {
      const node = new Node({ id: 'node1', type: 'default' });
      
      sceneGraph.addNode(node);
      
      const root = sceneGraph.getRoot();
      expect(root.getChildren()).toContain(node);
      expect(node.getParent()).toBe(root);
    });

    it('should add nodes to specific parent', () => {
      const parent = new Node({ id: 'parent', type: 'group' });
      const child = new Node({ id: 'child', type: 'default' });
      
      sceneGraph.addNode(parent);
      sceneGraph.addNode(child, parent.getId());
      
      expect(parent.getChildren()).toContain(child);
      expect(child.getParent()).toBe(parent);
    });

    it('should throw error when adding duplicate node id', () => {
      const node1 = new Node({ id: 'duplicate', type: 'default' });
      const node2 = new Node({ id: 'duplicate', type: 'default' });
      
      sceneGraph.addNode(node1);
      
      expect(() => sceneGraph.addNode(node2)).toThrow('Node with id duplicate already exists');
    });

    it('should remove nodes from the graph', () => {
      const node = new Node({ id: 'node1', type: 'default' });
      
      sceneGraph.addNode(node);
      expect(sceneGraph.getNodeCount()).toBe(2);
      
      sceneGraph.removeNode('node1');
      expect(sceneGraph.getNodeCount()).toBe(1);
      expect(sceneGraph.getNodeById('node1')).toBeUndefined();
    });

    it('should remove node and all its children', () => {
      const parent = new Node({ id: 'parent', type: 'group' });
      const child1 = new Node({ id: 'child1', type: 'default' });
      const child2 = new Node({ id: 'child2', type: 'default' });
      
      sceneGraph.addNode(parent);
      sceneGraph.addNode(child1, parent.getId());
      sceneGraph.addNode(child2, parent.getId());
      
      expect(sceneGraph.getNodeCount()).toBe(4); // root + parent + 2 children
      
      sceneGraph.removeNode('parent');
      
      expect(sceneGraph.getNodeCount()).toBe(1); // Just root
      expect(sceneGraph.getNodeById('parent')).toBeUndefined();
      expect(sceneGraph.getNodeById('child1')).toBeUndefined();
      expect(sceneGraph.getNodeById('child2')).toBeUndefined();
    });

    it('should not allow removing root node', () => {
      expect(() => sceneGraph.removeNode('root')).toThrow('Cannot remove root node');
    });

    it('should get all nodes in the graph', () => {
      const node1 = new Node({ id: 'node1', type: 'default' });
      const node2 = new Node({ id: 'node2', type: 'default' });
      
      sceneGraph.addNode(node1);
      sceneGraph.addNode(node2);
      
      const allNodes = sceneGraph.getAllNodes();
      expect(allNodes).toHaveLength(3);
      expect(allNodes).toContain(sceneGraph.getRoot());
      expect(allNodes).toContain(node1);
      expect(allNodes).toContain(node2);
    });

    it('should clear all nodes except root', () => {
      const node1 = new Node({ id: 'node1', type: 'default' });
      const node2 = new Node({ id: 'node2', type: 'default' });
      
      sceneGraph.addNode(node1);
      sceneGraph.addNode(node2);
      
      sceneGraph.clear();
      
      expect(sceneGraph.getNodeCount()).toBe(1);
      expect(sceneGraph.getRoot()).toBeDefined();
      expect(sceneGraph.getNodeById('node1')).toBeUndefined();
      expect(sceneGraph.getNodeById('node2')).toBeUndefined();
    });
  });

  describe('Change Notifications', () => {
    let sceneGraph;
    let changeEvents;

    beforeEach(() => {
      sceneGraph = new SceneGraph();
      changeEvents = [];
      sceneGraph.onChange((event) => changeEvents.push(event));
    });

    it('should notify when node is added', () => {
      const node = new Node({ id: 'node1', type: 'default' });
      
      sceneGraph.addNode(node);
      
      expect(changeEvents).toHaveLength(1);
      expect(changeEvents[0]).toEqual({
        type: 'nodeAdded',
        node: node,
        parent: sceneGraph.getRoot()
      });
    });

    it('should notify when node is removed', () => {
      const node = new Node({ id: 'node1', type: 'default' });
      
      sceneGraph.addNode(node);
      changeEvents = []; // Reset
      
      sceneGraph.removeNode('node1');
      
      expect(changeEvents).toHaveLength(1);
      expect(changeEvents[0]).toEqual({
        type: 'nodeRemoved',
        nodeId: 'node1',
        node: node
      });
    });

    it('should notify when scene is cleared', () => {
      const node1 = new Node({ id: 'node1', type: 'default' });
      const node2 = new Node({ id: 'node2', type: 'default' });
      
      sceneGraph.addNode(node1);
      sceneGraph.addNode(node2);
      changeEvents = []; // Reset
      
      sceneGraph.clear();
      
      expect(changeEvents).toHaveLength(1);
      expect(changeEvents[0]).toEqual({
        type: 'cleared'
      });
    });

    it('should support multiple listeners', () => {
      const listener1Events = [];
      const listener2Events = [];
      
      sceneGraph.onChange((event) => listener1Events.push(event));
      sceneGraph.onChange((event) => listener2Events.push(event));
      
      const node = new Node({ id: 'node1', type: 'default' });
      sceneGraph.addNode(node);
      
      expect(listener1Events).toHaveLength(1);
      expect(listener2Events).toHaveLength(1);
      expect(listener1Events[0]).toEqual(listener2Events[0]);
    });

    it('should allow removing listeners', () => {
      const listener = (event) => changeEvents.push(event);
      sceneGraph.onChange(listener);
      
      const node1 = new Node({ id: 'node1', type: 'default' });
      sceneGraph.addNode(node1);
      
      expect(changeEvents).toHaveLength(2); // Initial + new listener
      
      sceneGraph.offChange(listener);
      changeEvents = [];
      
      const node2 = new Node({ id: 'node2', type: 'default' });
      sceneGraph.addNode(node2);
      
      expect(changeEvents).toHaveLength(1); // Only initial listener
    });
  });

  describe('Batch Updates', () => {
    let sceneGraph;
    let changeEvents;

    beforeEach(() => {
      sceneGraph = new SceneGraph();
      changeEvents = [];
      sceneGraph.onChange((event) => changeEvents.push(event));
    });

    it('should batch multiple operations', () => {
      sceneGraph.beginBatch();
      
      const node1 = new Node({ id: 'node1', type: 'default' });
      const node2 = new Node({ id: 'node2', type: 'default' });
      
      sceneGraph.addNode(node1);
      sceneGraph.addNode(node2);
      sceneGraph.removeNode('node1');
      
      expect(changeEvents).toHaveLength(0); // No events during batch
      
      sceneGraph.endBatch();
      
      expect(changeEvents).toHaveLength(1);
      expect(changeEvents[0]).toEqual({
        type: 'batchUpdate',
        operations: [
          { type: 'nodeAdded', node: node1, parent: sceneGraph.getRoot() },
          { type: 'nodeAdded', node: node2, parent: sceneGraph.getRoot() },
          { type: 'nodeRemoved', nodeId: 'node1', node: node1 }
        ]
      });
    });

    it('should handle nested batches', () => {
      sceneGraph.beginBatch();
      sceneGraph.beginBatch();
      
      const node = new Node({ id: 'node1', type: 'default' });
      sceneGraph.addNode(node);
      
      sceneGraph.endBatch();
      expect(changeEvents).toHaveLength(0); // Still in outer batch
      
      sceneGraph.endBatch();
      expect(changeEvents).toHaveLength(1); // Batch complete
    });

    it('should handle batch cancellation', () => {
      sceneGraph.beginBatch();
      
      const node = new Node({ id: 'node1', type: 'default' });
      sceneGraph.addNode(node);
      
      sceneGraph.cancelBatch();
      
      expect(changeEvents).toHaveLength(0);
      expect(sceneGraph.getNodeById('node1')).toBeUndefined();
    });
  });

  describe('Dirty Tracking', () => {
    let sceneGraph;

    beforeEach(() => {
      sceneGraph = new SceneGraph();
    });

    it('should track dirty state', () => {
      expect(sceneGraph.isDirty()).toBe(false);
      
      const node = new Node({ id: 'node1', type: 'default' });
      sceneGraph.addNode(node);
      
      expect(sceneGraph.isDirty()).toBe(true);
    });

    it('should clear dirty state', () => {
      const node = new Node({ id: 'node1', type: 'default' });
      sceneGraph.addNode(node);
      
      expect(sceneGraph.isDirty()).toBe(true);
      
      sceneGraph.clearDirty();
      
      expect(sceneGraph.isDirty()).toBe(false);
    });

    it('should propagate dirty state from nodes', () => {
      const node = new Node({ id: 'node1', type: 'default' });
      sceneGraph.addNode(node);
      sceneGraph.clearDirty();
      
      expect(sceneGraph.isDirty()).toBe(false);
      
      // Simulate node becoming dirty
      node.setPosition(100, 100);
      
      expect(sceneGraph.isDirty()).toBe(true);
    });
  });
});