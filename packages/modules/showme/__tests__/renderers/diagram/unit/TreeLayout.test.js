/**
 * Unit tests for TreeLayout algorithm
 * Tests hierarchical tree-based graph layouts
 */

import { jest } from '@jest/globals';
import { TreeLayout } from '../../../../src/renderers/diagram/layout/TreeLayout.js';

describe('TreeLayout', () => {
  let layout;

  beforeEach(() => {
    layout = new TreeLayout();
  });

  afterEach(() => {
    if (layout) {
      layout = null;
    }
  });

  describe('Basic Layout', () => {
    test('should create layout instance with default config', () => {
      expect(layout).toBeDefined();
      expect(layout.config.direction).toBe('vertical'); // top-to-bottom
      expect(layout.config.levelSeparation).toBe(100);
      expect(layout.config.nodeSeparation).toBe(50);
      expect(layout.config.subtreeSeparation).toBe(80);
      expect(layout.config.treeType).toBe('standard'); // standard, compact, radial
    });

    test('should accept custom configuration', () => {
      const customLayout = new TreeLayout({
        direction: 'horizontal',
        levelSeparation: 150,
        nodeSeparation: 75,
        alignment: 'center',
        treeType: 'compact'
      });

      expect(customLayout.config.direction).toBe('horizontal');
      expect(customLayout.config.levelSeparation).toBe(150);
      expect(customLayout.config.nodeSeparation).toBe(75);
      expect(customLayout.config.alignment).toBe('center');
      expect(customLayout.config.treeType).toBe('compact');
    });

    test('should layout simple parent-child tree', () => {
      const graphData = {
        nodes: [
          { id: 'root', size: { width: 100, height: 60 } },
          { id: 'child1', size: { width: 100, height: 60 } },
          { id: 'child2', size: { width: 100, height: 60 } }
        ],
        edges: [
          { id: 'e1', source: 'root', target: 'child1' },
          { id: 'e2', source: 'root', target: 'child2' }
        ]
      };

      const result = layout.layout(graphData);
      
      expect(result.positions.size).toBe(3);
      expect(result.positions.has('root')).toBe(true);
      expect(result.positions.has('child1')).toBe(true);
      expect(result.positions.has('child2')).toBe(true);
      
      const rootPos = result.positions.get('root');
      const child1Pos = result.positions.get('child1');
      const child2Pos = result.positions.get('child2');
      
      // Root should be above children (vertical layout)
      expect(rootPos.y).toBeLessThan(child1Pos.y);
      expect(rootPos.y).toBeLessThan(child2Pos.y);
      
      // Children should be at same level
      expect(child1Pos.y).toBe(child2Pos.y);
      
      // Children should be separated horizontally
      expect(Math.abs(child2Pos.x - child1Pos.x)).toBeGreaterThan(50);
    });

    test('should handle forest (multiple trees)', () => {
      const graphData = {
        nodes: [
          // Tree 1
          { id: 'root1', size: { width: 100, height: 60 } },
          { id: 'child1', size: { width: 100, height: 60 } },
          // Tree 2
          { id: 'root2', size: { width: 100, height: 60 } },
          { id: 'child2', size: { width: 100, height: 60 } }
        ],
        edges: [
          { id: 'e1', source: 'root1', target: 'child1' },
          { id: 'e2', source: 'root2', target: 'child2' }
        ]
      };

      const result = layout.layout(graphData);
      
      expect(result.positions.size).toBe(4);
      
      // Trees should be separated
      const root1Pos = result.positions.get('root1');
      const root2Pos = result.positions.get('root2');
      
      expect(Math.abs(root2Pos.x - root1Pos.x)).toBeGreaterThan(100);
    });

    test('should identify root nodes correctly', () => {
      const graphData = {
        nodes: [
          { id: 'A', size: { width: 100, height: 60 } },
          { id: 'B', size: { width: 100, height: 60 } },
          { id: 'C', size: { width: 100, height: 60 } },
          { id: 'D', size: { width: 100, height: 60 } }
        ],
        edges: [
          { id: 'e1', source: 'A', target: 'B' },
          { id: 'e2', source: 'A', target: 'C' },
          { id: 'e3', source: 'B', target: 'D' }
        ]
      };

      const result = layout.layout(graphData);
      
      // A should be at the root level
      const aPos = result.positions.get('A');
      const bPos = result.positions.get('B');
      const cPos = result.positions.get('C');
      const dPos = result.positions.get('D');
      
      expect(aPos.y).toBeLessThan(bPos.y);
      expect(aPos.y).toBeLessThan(cPos.y);
      expect(bPos.y).toBeLessThan(dPos.y);
    });
  });

  describe('Tree Balancing', () => {
    test('should balance tree with uneven subtrees', () => {
      const graphData = {
        nodes: [
          { id: 'root', size: { width: 100, height: 60 } },
          { id: 'left', size: { width: 100, height: 60 } },
          { id: 'right', size: { width: 100, height: 60 } },
          { id: 'leftChild1', size: { width: 100, height: 60 } },
          { id: 'leftChild2', size: { width: 100, height: 60 } },
          { id: 'leftChild3', size: { width: 100, height: 60 } }
        ],
        edges: [
          { id: 'e1', source: 'root', target: 'left' },
          { id: 'e2', source: 'root', target: 'right' },
          { id: 'e3', source: 'left', target: 'leftChild1' },
          { id: 'e4', source: 'left', target: 'leftChild2' },
          { id: 'e5', source: 'left', target: 'leftChild3' }
        ]
      };

      const result = layout.layout(graphData);
      
      const rootPos = result.positions.get('root');
      const leftPos = result.positions.get('left');
      const rightPos = result.positions.get('right');
      
      // Root should be centered over its children
      const childrenCenterX = (leftPos.x + rightPos.x) / 2;
      expect(Math.abs(rootPos.x - childrenCenterX)).toBeLessThan(1);
    });

    test('should handle deep trees', () => {
      const nodes = [];
      const edges = [];
      const levels = 5;
      
      // Create a binary tree
      for (let level = 0; level < levels; level++) {
        const nodesInLevel = Math.pow(2, level);
        for (let i = 0; i < nodesInLevel; i++) {
          const nodeId = `node_${level}_${i}`;
          nodes.push({
            id: nodeId,
            size: { width: 80, height: 50 }
          });
          
          if (level > 0) {
            const parentId = `node_${level - 1}_${Math.floor(i / 2)}`;
            edges.push({
              id: `edge_${nodeId}`,
              source: parentId,
              target: nodeId
            });
          }
        }
      }

      const graphData = { nodes, edges };
      const result = layout.layout(graphData);
      
      expect(result.positions.size).toBe(nodes.length);
      
      // Check that each level has correct y position
      for (let level = 0; level < levels; level++) {
        const expectedY = level * layout.config.levelSeparation;
        const nodesInLevel = Math.pow(2, level);
        
        for (let i = 0; i < nodesInLevel; i++) {
          const nodeId = `node_${level}_${i}`;
          const pos = result.positions.get(nodeId);
          expect(pos.y).toBeCloseTo(expectedY, 1);
        }
      }
    });
  });

  describe('Layout Directions', () => {
    test('should support horizontal layout (left to right)', () => {
      const horizontalLayout = new TreeLayout({
        direction: 'horizontal'
      });

      const graphData = {
        nodes: [
          { id: 'root', size: { width: 100, height: 60 } },
          { id: 'child1', size: { width: 100, height: 60 } },
          { id: 'child2', size: { width: 100, height: 60 } }
        ],
        edges: [
          { id: 'e1', source: 'root', target: 'child1' },
          { id: 'e2', source: 'root', target: 'child2' }
        ]
      };

      const result = horizontalLayout.layout(graphData);
      
      const rootPos = result.positions.get('root');
      const child1Pos = result.positions.get('child1');
      const child2Pos = result.positions.get('child2');
      
      console.log('Horizontal layout positions:', { rootPos, child1Pos, child2Pos });
      
      // Root should be to the left of children
      expect(rootPos.x).toBeLessThan(child1Pos.x);
      expect(rootPos.x).toBeLessThan(child2Pos.x);
      
      // Children should be at same x level
      expect(child1Pos.x).toBe(child2Pos.x);
      
      // Children should be separated vertically
      expect(Math.abs(child2Pos.y - child1Pos.y)).toBeGreaterThan(50);
    });

    test('should support bottom-up layout', () => {
      const bottomUpLayout = new TreeLayout({
        direction: 'vertical',
        orientation: 'bottom-up'
      });

      const graphData = {
        nodes: [
          { id: 'root', size: { width: 100, height: 60 } },
          { id: 'child', size: { width: 100, height: 60 } }
        ],
        edges: [
          { id: 'e1', source: 'root', target: 'child' }
        ]
      };

      const result = bottomUpLayout.layout(graphData);
      
      const rootPos = result.positions.get('root');
      const childPos = result.positions.get('child');
      
      // Root should be below child (inverted)
      expect(rootPos.y).toBeGreaterThan(childPos.y);
    });

    test('should support right-to-left layout', () => {
      const rtlLayout = new TreeLayout({
        direction: 'horizontal',
        orientation: 'right-to-left'
      });

      const graphData = {
        nodes: [
          { id: 'root', size: { width: 100, height: 60 } },
          { id: 'child', size: { width: 100, height: 60 } }
        ],
        edges: [
          { id: 'e1', source: 'root', target: 'child' }
        ]
      };

      const result = rtlLayout.layout(graphData);
      
      const rootPos = result.positions.get('root');
      const childPos = result.positions.get('child');
      
      // Root should be to the right of child
      expect(rootPos.x).toBeGreaterThan(childPos.x);
    });
  });

  describe('Compact Mode', () => {
    test('should reduce spacing in compact mode', () => {
      const compactLayout = new TreeLayout({
        treeType: 'compact'
      });

      const graphData = {
        nodes: [
          { id: 'root', size: { width: 100, height: 60 } },
          { id: 'A', size: { width: 100, height: 60 } },
          { id: 'B', size: { width: 100, height: 60 } },
          { id: 'C', size: { width: 100, height: 60 } },
          { id: 'D', size: { width: 100, height: 60 } }
        ],
        edges: [
          { id: 'e1', source: 'root', target: 'A' },
          { id: 'e2', source: 'root', target: 'B' },
          { id: 'e3', source: 'A', target: 'C' },
          { id: 'e4', source: 'A', target: 'D' }
        ]
      };

      const standardLayout = new TreeLayout({
        treeType: 'standard'
      });

      const compactResult = compactLayout.layout(graphData);
      const standardResult = standardLayout.layout(graphData);
      
      // Calculate bounds for both layouts
      const getWidth = (positions) => {
        const xValues = Array.from(positions.values()).map(p => p.x);
        return Math.max(...xValues) - Math.min(...xValues);
      };
      
      const compactWidth = getWidth(compactResult.positions);
      const standardWidth = getWidth(standardResult.positions);
      
      // Compact should be narrower
      expect(compactWidth).toBeLessThan(standardWidth);
    });
  });

  describe('Alignment Options', () => {
    test('should align nodes to center', () => {
      const centerLayout = new TreeLayout({
        alignment: 'center'
      });

      const graphData = {
        nodes: [
          { id: 'root', size: { width: 100, height: 60 } },
          { id: 'child1', size: { width: 100, height: 60 } },
          { id: 'child2', size: { width: 100, height: 60 } },
          { id: 'child3', size: { width: 100, height: 60 } }
        ],
        edges: [
          { id: 'e1', source: 'root', target: 'child1' },
          { id: 'e2', source: 'root', target: 'child2' },
          { id: 'e3', source: 'root', target: 'child3' }
        ]
      };

      const result = centerLayout.layout(graphData);
      
      const rootPos = result.positions.get('root');
      const childPositions = ['child1', 'child2', 'child3'].map(id => 
        result.positions.get(id)
      );
      
      // Calculate center of children
      const childrenXValues = childPositions.map(p => p.x);
      const childrenCenter = (Math.min(...childrenXValues) + Math.max(...childrenXValues)) / 2;
      
      // Root should be centered over children
      expect(Math.abs(rootPos.x - childrenCenter)).toBeLessThan(1);
    });

    test('should align nodes to left', () => {
      const leftLayout = new TreeLayout({
        alignment: 'left'
      });

      const graphData = {
        nodes: [
          { id: 'root', size: { width: 100, height: 60 } },
          { id: 'child1', size: { width: 80, height: 50 } },
          { id: 'child2', size: { width: 120, height: 70 } }
        ],
        edges: [
          { id: 'e1', source: 'root', target: 'child1' },
          { id: 'e2', source: 'root', target: 'child2' }
        ]
      };

      const result = leftLayout.layout(graphData);
      
      const rootPos = result.positions.get('root');
      const child1Pos = result.positions.get('child1');
      
      // Root should align with leftmost child
      expect(Math.abs(rootPos.x - child1Pos.x)).toBeLessThan(1);
    });
  });

  describe('Performance and Metadata', () => {
    test('should provide timing information', () => {
      const graphData = {
        nodes: [
          { id: 'root', size: { width: 100, height: 60 } },
          { id: 'child', size: { width: 100, height: 60 } }
        ],
        edges: [
          { id: 'e1', source: 'root', target: 'child' }
        ]
      };

      const result = layout.layout(graphData);
      
      expect(result.metadata).toBeDefined();
      expect(result.metadata.algorithm).toBe('tree');
      expect(result.metadata.timing).toBeDefined();
      expect(result.metadata.timing.total).toBeGreaterThanOrEqual(0);
      expect(result.metadata.stats).toBeDefined();
      expect(result.metadata.stats.depth).toBeGreaterThanOrEqual(1);
      expect(result.metadata.stats.width).toBeGreaterThanOrEqual(1);
    });

    test('should calculate correct bounds', () => {
      const graphData = {
        nodes: [
          { id: 'root', size: { width: 100, height: 60 } },
          { id: 'left', size: { width: 100, height: 60 } },
          { id: 'right', size: { width: 100, height: 60 } }
        ],
        edges: [
          { id: 'e1', source: 'root', target: 'left' },
          { id: 'e2', source: 'root', target: 'right' }
        ]
      };

      const result = layout.layout(graphData);
      
      expect(result.bounds).toBeDefined();
      expect(result.bounds.width).toBeGreaterThan(0);
      expect(result.bounds.height).toBeGreaterThan(0);
      
      // All nodes should be within bounds
      result.positions.forEach(pos => {
        expect(pos.x).toBeGreaterThanOrEqual(result.bounds.x);
        expect(pos.x).toBeLessThanOrEqual(result.bounds.x + result.bounds.width);
        expect(pos.y).toBeGreaterThanOrEqual(result.bounds.y);
        expect(pos.y).toBeLessThanOrEqual(result.bounds.y + result.bounds.height);
      });
    });

    test('should handle large trees efficiently', () => {
      const nodes = [];
      const edges = [];
      
      // Create a tree with 100 nodes
      for (let i = 0; i < 100; i++) {
        nodes.push({
          id: `node${i}`,
          size: { width: 80, height: 50 }
        });
        
        if (i > 0) {
          // Create parent-child relationship
          const parentId = `node${Math.floor((i - 1) / 3)}`; // 3 children per node
          edges.push({
            id: `edge${i}`,
            source: parentId,
            target: `node${i}`
          });
        }
      }

      const graphData = { nodes, edges };
      
      const startTime = performance.now();
      const result = layout.layout(graphData);
      const endTime = performance.now();
      
      expect(result.positions.size).toBe(100);
      expect(endTime - startTime).toBeLessThan(100); // Should complete in under 100ms
    });
  });

  describe('Error Handling', () => {
    test('should handle cyclic graphs gracefully', () => {
      const graphData = {
        nodes: [
          { id: 'A', size: { width: 100, height: 60 } },
          { id: 'B', size: { width: 100, height: 60 } },
          { id: 'C', size: { width: 100, height: 60 } }
        ],
        edges: [
          { id: 'e1', source: 'A', target: 'B' },
          { id: 'e2', source: 'B', target: 'C' },
          { id: 'e3', source: 'C', target: 'A' } // Creates cycle
        ]
      };

      const result = layout.layout(graphData);
      
      // Should still produce a layout, breaking the cycle
      expect(result.positions.size).toBe(3);
      expect(result.metadata.hasCycles).toBe(true);
    });

    test('should handle empty graphs', () => {
      const graphData = {
        nodes: [],
        edges: []
      };

      const result = layout.layout(graphData);
      
      expect(result.positions.size).toBe(0);
      expect(result.bounds.width).toBe(0);
      expect(result.bounds.height).toBe(0);
    });

    test('should handle single node', () => {
      const graphData = {
        nodes: [
          { id: 'single', size: { width: 100, height: 60 } }
        ],
        edges: []
      };

      const result = layout.layout(graphData);
      
      expect(result.positions.size).toBe(1);
      const pos = result.positions.get('single');
      expect(pos.x).toBe(0);
      expect(pos.y).toBe(0);
    });
  });
});