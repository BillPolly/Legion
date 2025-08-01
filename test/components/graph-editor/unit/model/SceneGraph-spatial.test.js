/**
 * Integration tests for SceneGraph spatial indexing
 */

import { SceneGraph } from '../../../../../src/components/graph-editor/model/SceneGraph.js';
import { Node } from '../../../../../src/components/graph-editor/model/Node.js';

describe('SceneGraph - Spatial Indexing', () => {
  let sceneGraph;

  beforeEach(() => {
    sceneGraph = new SceneGraph();
  });

  describe('Spatial Queries', () => {
    beforeEach(() => {
      // Create a grid of nodes
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          const node = new Node({
            id: `node-${row}-${col}`,
            position: { x: col * 100, y: row * 100 },
            size: { width: 50, height: 50 }
          });
          sceneGraph.addNode(node);
        }
      }
    });

    it('should find nodes at specific point', () => {
      // Point in middle of node-0-0
      const nodes = sceneGraph.getNodesAt(25, 25);
      expect(nodes).toHaveLength(1);
      expect(nodes[0].getId()).toBe('node-0-0');
    });

    it('should find no nodes at empty point', () => {
      const nodes = sceneGraph.getNodesAt(75, 75); // Gap between nodes
      expect(nodes).toHaveLength(0);
    });

    it('should find nodes in rectangle', () => {
      // Rectangle covering top-left 2x2 nodes
      const nodes = sceneGraph.getNodesInRect(0, 0, 150, 150);
      expect(nodes).toHaveLength(4);
      
      const nodeIds = nodes.map(n => n.getId()).sort();
      expect(nodeIds).toEqual(['node-0-0', 'node-0-1', 'node-1-0', 'node-1-1']);
    });

    it('should find all nodes with large rectangle', () => {
      const nodes = sceneGraph.getNodesInRect(-100, -100, 500, 500);
      expect(nodes).toHaveLength(9);
    });

    it('should handle overlapping nodes', () => {
      const overlapping = new Node({
        id: 'overlapping',
        position: { x: 20, y: 20 },
        size: { width: 60, height: 60 }
      });
      sceneGraph.addNode(overlapping);
      
      // Point where both nodes overlap
      const nodes = sceneGraph.getNodesAt(40, 40);
      expect(nodes).toHaveLength(2);
      expect(nodes.map(n => n.getId())).toContain('node-0-0');
      expect(nodes.map(n => n.getId())).toContain('overlapping');
    });
  });

  describe('Dynamic Updates', () => {
    it('should update spatial index when node moves', () => {
      const node = new Node({
        id: 'movable',
        position: { x: 0, y: 0 },
        size: { width: 50, height: 50 }
      });
      sceneGraph.addNode(node);
      
      // Verify initial position
      let nodes = sceneGraph.getNodesAt(25, 25);
      expect(nodes).toContain(node);
      
      // Move node
      node.setPosition(100, 100);
      
      // Verify old position is empty
      nodes = sceneGraph.getNodesAt(25, 25);
      expect(nodes).not.toContain(node);
      
      // Verify new position
      nodes = sceneGraph.getNodesAt(125, 125);
      expect(nodes).toContain(node);
    });

    it('should update spatial index when node resizes', () => {
      const node = new Node({
        id: 'resizable',
        position: { x: 0, y: 0 },
        size: { width: 50, height: 50 }
      });
      sceneGraph.addNode(node);
      
      // Initially not at (75, 75)
      let nodes = sceneGraph.getNodesAt(75, 75);
      expect(nodes).not.toContain(node);
      
      // Resize to cover (75, 75)
      node.setSize(100, 100);
      
      // Now should be at (75, 75)
      nodes = sceneGraph.getNodesAt(75, 75);
      expect(nodes).toContain(node);
    });

    it('should remove from spatial index when node is removed', () => {
      const node = new Node({
        id: 'removable',
        position: { x: 0, y: 0 },
        size: { width: 50, height: 50 }
      });
      sceneGraph.addNode(node);
      
      // Verify it's there
      let nodes = sceneGraph.getNodesAt(25, 25);
      expect(nodes).toContain(node);
      
      // Remove node
      sceneGraph.removeNode('removable');
      
      // Verify it's gone
      nodes = sceneGraph.getNodesAt(25, 25);
      expect(nodes).not.toContain(node);
    });

    it('should clear spatial index when clearing scene', () => {
      // Add multiple nodes
      for (let i = 0; i < 5; i++) {
        sceneGraph.addNode(new Node({
          id: `node-${i}`,
          position: { x: i * 50, y: 0 },
          size: { width: 40, height: 40 }
        }));
      }
      
      // Verify nodes exist
      let nodes = sceneGraph.getNodesInRect(0, 0, 250, 50);
      expect(nodes.length).toBeGreaterThan(0);
      
      // Clear scene
      sceneGraph.clear();
      
      // Verify spatial index is empty
      nodes = sceneGraph.getNodesInRect(0, 0, 250, 50);
      expect(nodes).toEqual([]);
    });
  });

  describe('Performance', () => {
    it('should handle many nodes efficiently', () => {
      // Add 100 nodes in a 10x10 grid
      for (let row = 0; row < 10; row++) {
        for (let col = 0; col < 10; col++) {
          const node = new Node({
            id: `node-${row}-${col}`,
            position: { x: col * 100, y: row * 100 },
            size: { width: 80, height: 80 }
          });
          sceneGraph.addNode(node);
        }
      }
      
      // Query small area should return subset
      const nodes = sceneGraph.getNodesInRect(250, 250, 100, 100);
      expect(nodes.length).toBeLessThan(10); // Much less than 100
      
      // Get stats
      const stats = sceneGraph.getSpatialIndexStats();
      expect(stats.totalObjects).toBe(100);
      expect(stats.maxDepthReached).toBeGreaterThan(0);
    });
  });

  describe('Root Node Exclusion', () => {
    it('should not include root node in spatial queries', () => {
      // Root node exists but shouldn't be in spatial index
      const nodes = sceneGraph.getNodesAt(0, 0);
      const nodeIds = nodes.map(n => n.getId());
      expect(nodeIds).not.toContain('root');
    });
  });
});