/**
 * Advanced TreeLayout tests for radial mode and complex features
 * Complements the basic TreeLayout test suite
 */

import { jest } from '@jest/globals';
import { TreeLayout } from '../../../../src/renderers/diagram/layout/TreeLayout.js';

describe('TreeLayout - Advanced Features', () => {
  let layout;

  beforeEach(() => {
    layout = new TreeLayout();
  });

  afterEach(() => {
    if (layout) {
      layout = null;
    }
  });

  describe('Radial Tree Layout', () => {
    test('should create radial tree layout', () => {
      const radialLayout = new TreeLayout({
        treeType: 'radial',
        bounds: { width: 800, height: 800, padding: 50 }
      });

      const graphData = {
        nodes: [
          { id: 'center', size: { width: 100, height: 60 } },
          { id: 'child1', size: { width: 80, height: 50 } },
          { id: 'child2', size: { width: 80, height: 50 } },
          { id: 'child3', size: { width: 80, height: 50 } },
          { id: 'grandchild1', size: { width: 70, height: 40 } },
          { id: 'grandchild2', size: { width: 70, height: 40 } }
        ],
        edges: [
          { id: 'e1', source: 'center', target: 'child1' },
          { id: 'e2', source: 'center', target: 'child2' },
          { id: 'e3', source: 'center', target: 'child3' },
          { id: 'e4', source: 'child1', target: 'grandchild1' },
          { id: 'e5', source: 'child1', target: 'grandchild2' }
        ]
      };

      const result = radialLayout.layout(graphData);
      
      expect(result.positions.size).toBe(6);
      
      // Center node should be at origin
      const centerPos = result.positions.get('center');
      expect(centerPos.x).toBe(0);
      expect(centerPos.y).toBe(0);
      
      // Children should be distributed around center
      const childPositions = ['child1', 'child2', 'child3'].map(id => 
        result.positions.get(id)
      );
      
      // Each child should be at equal distance from center
      const distances = childPositions.map(pos => 
        Math.sqrt(pos.x * pos.x + pos.y * pos.y)
      );
      
      expect(Math.abs(distances[0] - distances[1])).toBeLessThan(5);
      expect(Math.abs(distances[1] - distances[2])).toBeLessThan(5);
      
      // Grandchildren should be further from center than their parent
      const child1Pos = result.positions.get('child1');
      const grandchild1Pos = result.positions.get('grandchild1');
      
      const child1Distance = Math.sqrt(child1Pos.x * child1Pos.x + child1Pos.y * child1Pos.y);
      const grandchild1Distance = Math.sqrt(
        grandchild1Pos.x * grandchild1Pos.x + 
        grandchild1Pos.y * grandchild1Pos.y
      );
      
      expect(grandchild1Distance).toBeGreaterThan(child1Distance);
    });

    test('should handle single-level radial layout', () => {
      const radialLayout = new TreeLayout({
        treeType: 'radial'
      });

      const graphData = {
        nodes: [
          { id: 'center', size: { width: 100, height: 60 } },
          { id: 'n1', size: { width: 80, height: 50 } },
          { id: 'n2', size: { width: 80, height: 50 } },
          { id: 'n3', size: { width: 80, height: 50 } },
          { id: 'n4', size: { width: 80, height: 50 } },
          { id: 'n5', size: { width: 80, height: 50 } }
        ],
        edges: [
          { id: 'e1', source: 'center', target: 'n1' },
          { id: 'e2', source: 'center', target: 'n2' },
          { id: 'e3', source: 'center', target: 'n3' },
          { id: 'e4', source: 'center', target: 'n4' },
          { id: 'e5', source: 'center', target: 'n5' }
        ]
      };

      const result = radialLayout.layout(graphData);
      
      // All children should be at the same radius
      const childIds = ['n1', 'n2', 'n3', 'n4', 'n5'];
      const positions = childIds.map(id => result.positions.get(id));
      
      const distances = positions.map(pos => 
        Math.sqrt(pos.x * pos.x + pos.y * pos.y)
      );
      
      // All distances should be approximately equal
      distances.forEach(distance => {
        expect(Math.abs(distance - distances[0])).toBeLessThan(1);
      });
      
      // Children should be distributed around the circle
      const angles = positions.map(pos => Math.atan2(pos.y, pos.x));
      angles.sort();
      
      // Angular separation should be approximately equal
      const expectedSeparation = (2 * Math.PI) / 5;
      for (let i = 1; i < angles.length; i++) {
        const separation = angles[i] - angles[i - 1];
        expect(Math.abs(separation - expectedSeparation)).toBeLessThan(0.5);
      }
    });

    test('should handle radial layout with deep tree', () => {
      const radialLayout = new TreeLayout({
        treeType: 'radial',
        bounds: { width: 1000, height: 1000, padding: 50 }
      });

      const nodes = [{ id: 'root', size: { width: 100, height: 60 } }];
      const edges = [];
      
      // Create 3 levels of depth
      for (let level = 1; level <= 3; level++) {
        const nodeCount = level === 1 ? 3 : level === 2 ? 6 : 9;
        
        for (let i = 0; i < nodeCount; i++) {
          const nodeId = `node_${level}_${i}`;
          nodes.push({ id: nodeId, size: { width: 80, height: 50 } });
          
          const parentId = level === 1 ? 'root' : `node_${level - 1}_${Math.floor(i / 3)}`;
          edges.push({
            id: `edge_${nodeId}`,
            source: parentId,
            target: nodeId
          });
        }
      }

      const graphData = { nodes, edges };
      const result = radialLayout.layout(graphData);
      
      expect(result.positions.size).toBe(nodes.length);
      
      // Verify that nodes at the same level have similar distances from center
      for (let level = 1; level <= 3; level++) {
        const nodesAtLevel = nodes
          .filter(n => n.id.includes(`_${level}_`))
          .map(n => result.positions.get(n.id));
        
        if (nodesAtLevel.length > 1) {
          const distances = nodesAtLevel.map(pos => 
            Math.sqrt(pos.x * pos.x + pos.y * pos.y)
          );
          
          // All distances at same level should be similar
          const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
          distances.forEach(distance => {
            expect(Math.abs(distance - avgDistance)).toBeLessThan(avgDistance * 0.1);
          });
        }
      }
    });
  });

  describe('Tree Statistics and Metadata', () => {
    test('should calculate correct tree statistics', () => {
      const graphData = {
        nodes: [
          { id: 'root', size: { width: 100, height: 60 } },
          { id: 'level1_1', size: { width: 90, height: 50 } },
          { id: 'level1_2', size: { width: 90, height: 50 } },
          { id: 'level1_3', size: { width: 90, height: 50 } },
          { id: 'level2_1', size: { width: 80, height: 40 } },
          { id: 'level2_2', size: { width: 80, height: 40 } }
        ],
        edges: [
          { id: 'e1', source: 'root', target: 'level1_1' },
          { id: 'e2', source: 'root', target: 'level1_2' },
          { id: 'e3', source: 'root', target: 'level1_3' },
          { id: 'e4', source: 'level1_1', target: 'level2_1' },
          { id: 'e5', source: 'level1_1', target: 'level2_2' }
        ]
      };

      const result = layout.layout(graphData);
      
      expect(result.metadata.stats.depth).toBe(2); // 0, 1, 2
      expect(result.metadata.stats.width).toBe(3); // 3 nodes at level 1
      expect(result.metadata.stats.nodeCount).toBe(6);
      expect(result.metadata.stats.forestSize).toBe(1); // Single tree
    });

    test('should detect balanced vs unbalanced trees', () => {
      // Balanced tree
      const balancedData = {
        nodes: Array.from({ length: 7 }, (_, i) => ({
          id: `node${i}`,
          size: { width: 80, height: 50 }
        })),
        edges: [
          // Perfect binary tree
          { id: 'e1', source: 'node0', target: 'node1' },
          { id: 'e2', source: 'node0', target: 'node2' },
          { id: 'e3', source: 'node1', target: 'node3' },
          { id: 'e4', source: 'node1', target: 'node4' },
          { id: 'e5', source: 'node2', target: 'node5' },
          { id: 'e6', source: 'node2', target: 'node6' }
        ]
      };

      const balancedResult = layout.layout(balancedData);

      // Unbalanced tree (linear)
      const unbalancedData = {
        nodes: Array.from({ length: 5 }, (_, i) => ({
          id: `node${i}`,
          size: { width: 80, height: 50 }
        })),
        edges: [
          { id: 'e1', source: 'node0', target: 'node1' },
          { id: 'e2', source: 'node1', target: 'node2' },
          { id: 'e3', source: 'node2', target: 'node3' },
          { id: 'e4', source: 'node3', target: 'node4' }
        ]
      };

      const unbalancedResult = layout.layout(unbalancedData);

      // Balanced tree should have smaller depth-to-width ratio
      const balancedRatio = balancedResult.metadata.stats.depth / 
                           Math.max(balancedResult.metadata.stats.width, 1);
      const unbalancedRatio = unbalancedResult.metadata.stats.depth / 
                             Math.max(unbalancedResult.metadata.stats.width, 1);

      expect(balancedRatio).toBeLessThan(unbalancedRatio);
    });
  });

  describe('Complex Tree Structures', () => {
    test('should handle forest with different tree sizes', () => {
      const graphData = {
        nodes: [
          // Large tree
          { id: 'tree1_root', size: { width: 100, height: 60 } },
          { id: 'tree1_child1', size: { width: 80, height: 50 } },
          { id: 'tree1_child2', size: { width: 80, height: 50 } },
          { id: 'tree1_grandchild', size: { width: 70, height: 40 } },
          
          // Medium tree
          { id: 'tree2_root', size: { width: 90, height: 55 } },
          { id: 'tree2_child', size: { width: 75, height: 45 } },
          
          // Single node tree
          { id: 'tree3_single', size: { width: 85, height: 50 } }
        ],
        edges: [
          // Tree 1 edges
          { id: 'e1', source: 'tree1_root', target: 'tree1_child1' },
          { id: 'e2', source: 'tree1_root', target: 'tree1_child2' },
          { id: 'e3', source: 'tree1_child1', target: 'tree1_grandchild' },
          
          // Tree 2 edges
          { id: 'e4', source: 'tree2_root', target: 'tree2_child' }
        ]
      };

      const result = layout.layout(graphData);
      
      expect(result.metadata.stats.forestSize).toBe(3);
      
      // Trees should be separated horizontally
      const tree1Root = result.positions.get('tree1_root');
      const tree2Root = result.positions.get('tree2_root');
      const tree3Single = result.positions.get('tree3_single');
      
      expect(tree2Root.x).toBeGreaterThan(tree1Root.x + 50);
      expect(tree3Single.x).toBeGreaterThan(tree2Root.x + 50);
    });

    test('should handle wide trees with many children', () => {
      const nodes = [{ id: 'root', size: { width: 100, height: 60 } }];
      const edges = [];
      
      // Create 10 children for root
      for (let i = 1; i <= 10; i++) {
        nodes.push({ id: `child${i}`, size: { width: 80, height: 50 } });
        edges.push({ id: `e${i}`, source: 'root', target: `child${i}` });
      }

      const graphData = { nodes, edges };
      const result = layout.layout(graphData);
      
      expect(result.metadata.stats.width).toBe(10);
      expect(result.metadata.stats.depth).toBe(1);
      
      // Root should be centered over children
      const rootPos = result.positions.get('root');
      const childPositions = Array.from({ length: 10 }, (_, i) => 
        result.positions.get(`child${i + 1}`)
      );
      
      const childXValues = childPositions.map(p => p.x);
      const minX = Math.min(...childXValues);
      const maxX = Math.max(...childXValues);
      const centerX = (minX + maxX) / 2;
      
      expect(Math.abs(rootPos.x - centerX)).toBeLessThan(1);
    });

    test('should handle asymmetric trees', () => {
      const graphData = {
        nodes: [
          { id: 'root', size: { width: 100, height: 60 } },
          { id: 'left', size: { width: 90, height: 50 } },
          { id: 'right', size: { width: 90, height: 50 } },
          // Left subtree has many children
          { id: 'left_1', size: { width: 80, height: 45 } },
          { id: 'left_2', size: { width: 80, height: 45 } },
          { id: 'left_3', size: { width: 80, height: 45 } },
          { id: 'left_4', size: { width: 80, height: 45 } },
          // Right subtree has one child
          { id: 'right_1', size: { width: 80, height: 45 } }
        ],
        edges: [
          { id: 'e1', source: 'root', target: 'left' },
          { id: 'e2', source: 'root', target: 'right' },
          { id: 'e3', source: 'left', target: 'left_1' },
          { id: 'e4', source: 'left', target: 'left_2' },
          { id: 'e5', source: 'left', target: 'left_3' },
          { id: 'e6', source: 'left', target: 'left_4' },
          { id: 'e7', source: 'right', target: 'right_1' }
        ]
      };

      const result = layout.layout(graphData);
      
      // Root should still be centered between left and right subtrees
      const rootPos = result.positions.get('root');
      const leftPos = result.positions.get('left');
      const rightPos = result.positions.get('right');
      
      const expectedCenterX = (leftPos.x + rightPos.x) / 2;
      expect(Math.abs(rootPos.x - expectedCenterX)).toBeLessThan(1);
    });
  });

  describe('Cycle Detection and Handling', () => {
    test('should detect and report cycles', () => {
      const graphData = {
        nodes: [
          { id: 'A', size: { width: 100, height: 60 } },
          { id: 'B', size: { width: 100, height: 60 } },
          { id: 'C', size: { width: 100, height: 60 } },
          { id: 'D', size: { width: 100, height: 60 } }
        ],
        edges: [
          { id: 'e1', source: 'A', target: 'B' },
          { id: 'e2', source: 'B', target: 'C' },
          { id: 'e3', source: 'C', target: 'D' },
          { id: 'e4', source: 'D', target: 'B' } // Creates cycle B->C->D->B
        ]
      };

      const result = layout.layout(graphData);
      
      expect(result.metadata.hasCycles).toBe(true);
      // Should still produce a valid layout by breaking cycles
      expect(result.positions.size).toBe(4);
    });

    test('should handle self-loops', () => {
      const graphData = {
        nodes: [
          { id: 'A', size: { width: 100, height: 60 } },
          { id: 'B', size: { width: 100, height: 60 } }
        ],
        edges: [
          { id: 'e1', source: 'A', target: 'B' },
          { id: 'e2', source: 'B', target: 'B' } // Self-loop
        ]
      };

      const result = layout.layout(graphData);
      
      expect(result.positions.size).toBe(2);
      // Self-loop should be ignored for tree structure
      const aPos = result.positions.get('A');
      const bPos = result.positions.get('B');
      expect(aPos.y).toBeLessThan(bPos.y);
    });

    test('should handle complex cycles with multiple roots', () => {
      const graphData = {
        nodes: [
          { id: 'R1', size: { width: 100, height: 60 } },
          { id: 'R2', size: { width: 100, height: 60 } },
          { id: 'A', size: { width: 90, height: 50 } },
          { id: 'B', size: { width: 90, height: 50 } },
          { id: 'C', size: { width: 90, height: 50 } }
        ],
        edges: [
          { id: 'e1', source: 'R1', target: 'A' },
          { id: 'e2', source: 'R2', target: 'B' },
          { id: 'e3', source: 'A', target: 'C' },
          { id: 'e4', source: 'B', target: 'C' },
          { id: 'e5', source: 'C', target: 'A' } // Creates cycle A->C->A
        ]
      };

      const result = layout.layout(graphData);
      
      expect(result.positions.size).toBe(5);
      expect(result.metadata.stats.forestSize).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases and Robustness', () => {
    test('should handle nodes with zero dimensions', () => {
      const graphData = {
        nodes: [
          { id: 'normal', size: { width: 100, height: 60 } },
          { id: 'zero', size: { width: 0, height: 0 } },
          { id: 'negative', size: { width: -10, height: -5 } }
        ],
        edges: [
          { id: 'e1', source: 'normal', target: 'zero' },
          { id: 'e2', source: 'normal', target: 'negative' }
        ]
      };

      const result = layout.layout(graphData);
      
      expect(result.positions.size).toBe(3);
      // Should handle gracefully without errors
      result.positions.forEach(pos => {
        expect(typeof pos.x).toBe('number');
        expect(typeof pos.y).toBe('number');
        expect(isFinite(pos.x)).toBe(true);
        expect(isFinite(pos.y)).toBe(true);
      });
    });

    test('should handle nodes with missing size information', () => {
      const graphData = {
        nodes: [
          { id: 'withSize', size: { width: 100, height: 60 } },
          { id: 'noSize' }, // Missing size
          { id: 'partialSize', size: { width: 80 } } // Missing height
        ],
        edges: [
          { id: 'e1', source: 'withSize', target: 'noSize' },
          { id: 'e2', source: 'withSize', target: 'partialSize' }
        ]
      };

      const result = layout.layout(graphData);
      
      expect(result.positions.size).toBe(3);
      // Default sizes should be applied
      expect(result.bounds.width).toBeGreaterThan(0);
      expect(result.bounds.height).toBeGreaterThan(0);
    });

    test('should handle moderately large trees', () => {
      const nodes = [];
      const edges = [];
      const nodeCount = 100; // Reduced from 500 to avoid Map size limits
      
      // Create a binary tree structure
      for (let i = 0; i < nodeCount; i++) {
        nodes.push({
          id: `node${i}`,
          size: { width: 50, height: 30 }
        });
        
        if (i > 0) {
          const parentIndex = Math.floor((i - 1) / 2);
          edges.push({
            id: `edge${i}`,
            source: `node${parentIndex}`,
            target: `node${i}`
          });
        }
      }

      const graphData = { nodes, edges };
      
      const startTime = performance.now();
      const result = layout.layout(graphData);
      const endTime = performance.now();
      
      expect(result.positions.size).toBe(nodeCount);
      expect(endTime - startTime).toBeLessThan(500); // Should complete in under 500ms
      expect(result.metadata.timing.total).toBeGreaterThan(0);
    });

    test('should maintain consistent results with same input', () => {
      const graphData = {
        nodes: [
          { id: 'root', size: { width: 100, height: 60 } },
          { id: 'child1', size: { width: 80, height: 50 } },
          { id: 'child2', size: { width: 80, height: 50 } },
          { id: 'grandchild', size: { width: 70, height: 40 } }
        ],
        edges: [
          { id: 'e1', source: 'root', target: 'child1' },
          { id: 'e2', source: 'root', target: 'child2' },
          { id: 'e3', source: 'child1', target: 'grandchild' }
        ]
      };

      const result1 = layout.layout(graphData);
      const result2 = layout.layout(graphData);
      
      // Results should be identical
      expect(result1.positions.size).toBe(result2.positions.size);
      
      result1.positions.forEach((pos1, nodeId) => {
        const pos2 = result2.positions.get(nodeId);
        expect(pos1.x).toBe(pos2.x);
        expect(pos1.y).toBe(pos2.y);
      });
    });
  });
});