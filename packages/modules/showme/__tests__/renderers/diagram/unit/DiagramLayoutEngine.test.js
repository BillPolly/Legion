/**
 * Unit tests for DiagramLayoutEngine component
 */

import { DiagramLayoutEngine } from '../../../../src/renderers/diagram/layout/DiagramLayoutEngine.js';
import { createSampleDiagramData } from '../test-setup.js';

describe('DiagramLayoutEngine', () => {
  describe('Initialization', () => {
    test('should create with default configuration', () => {
      const engine = new DiagramLayoutEngine();
      
      expect(engine).toBeDefined();
      expect(engine.config).toBeDefined();
      expect(engine.config.algorithm).toBe('dagre');
    });

    test('should accept custom configuration', () => {
      const config = {
        algorithm: 'hierarchical',
        direction: 'LR',
        spacing: { node: 100, rank: 150 }
      };
      
      const engine = new DiagramLayoutEngine(config);
      
      expect(engine.config.algorithm).toBe('hierarchical');
      expect(engine.config.direction).toBe('LR');
      expect(engine.config.spacing.node).toBe(100);
    });
  });

  describe('Layout Computation', () => {
    test('should compute layout for simple graph', () => {
      const engine = new DiagramLayoutEngine();
      const data = createSampleDiagramData();
      
      const graphData = {
        nodes: data.nodes.map(n => ({
          ...n,
          size: { width: 120, height: 60 }
        })),
        edges: data.edges
      };
      
      const result = engine.compute(graphData);
      
      expect(result).toBeDefined();
      expect(result.positions).toBeInstanceOf(Map);
      expect(result.positions.size).toBe(graphData.nodes.length);
      expect(result.bounds).toBeDefined();
    });

    test('should position all nodes', () => {
      const engine = new DiagramLayoutEngine();
      const data = createSampleDiagramData();
      
      const graphData = {
        nodes: data.nodes.map(n => ({
          ...n,
          size: { width: 120, height: 60 }
        })),
        edges: data.edges
      };
      
      const result = engine.compute(graphData);
      
      graphData.nodes.forEach(node => {
        const position = result.positions.get(node.id);
        expect(position).toBeDefined();
        expect(position.x).toBeGreaterThanOrEqual(0);
        expect(position.y).toBeGreaterThanOrEqual(0);
      });
    });

    test('should calculate bounds correctly', () => {
      const engine = new DiagramLayoutEngine();
      const graphData = {
        nodes: [
          { id: 'n1', size: { width: 100, height: 50 } },
          { id: 'n2', size: { width: 100, height: 50 } },
          { id: 'n3', size: { width: 100, height: 50 } }
        ],
        edges: [
          { id: 'e1', source: 'n1', target: 'n2' },
          { id: 'e2', source: 'n2', target: 'n3' }
        ]
      };
      
      const result = engine.compute(graphData);
      
      expect(result.bounds.x).toBeDefined();
      expect(result.bounds.y).toBeDefined();
      expect(result.bounds.width).toBeGreaterThan(0);
      expect(result.bounds.height).toBeGreaterThan(0);
    });

    test('should handle disconnected nodes', () => {
      const engine = new DiagramLayoutEngine();
      const graphData = {
        nodes: [
          { id: 'n1', size: { width: 100, height: 50 } },
          { id: 'n2', size: { width: 100, height: 50 } },
          { id: 'n3', size: { width: 100, height: 50 } } // Disconnected
        ],
        edges: [
          { id: 'e1', source: 'n1', target: 'n2' }
        ]
      };
      
      const result = engine.compute(graphData);
      
      expect(result.positions.size).toBe(3);
      const disconnectedPos = result.positions.get('n3');
      expect(disconnectedPos).toBeDefined();
    });

    test('should handle empty graph', () => {
      const engine = new DiagramLayoutEngine();
      const graphData = {
        nodes: [],
        edges: []
      };
      
      const result = engine.compute(graphData);
      
      expect(result.positions.size).toBe(0);
      expect(result.bounds.width).toBe(0);
      expect(result.bounds.height).toBe(0);
    });

    test('should handle single node', () => {
      const engine = new DiagramLayoutEngine();
      const graphData = {
        nodes: [
          { id: 'n1', size: { width: 100, height: 50 } }
        ],
        edges: []
      };
      
      const result = engine.compute(graphData);
      
      expect(result.positions.size).toBe(1);
      const position = result.positions.get('n1');
      expect(position.x).toBe(0);
      expect(position.y).toBe(0);
    });
  });

  describe('Layout Directions', () => {
    test('should layout top-to-bottom', () => {
      const engine = new DiagramLayoutEngine({ direction: 'TB' });
      const graphData = {
        nodes: [
          { id: 'n1', size: { width: 100, height: 50 } },
          { id: 'n2', size: { width: 100, height: 50 } }
        ],
        edges: [
          { id: 'e1', source: 'n1', target: 'n2' }
        ]
      };
      
      const result = engine.compute(graphData);
      
      const pos1 = result.positions.get('n1');
      const pos2 = result.positions.get('n2');
      expect(pos2.y).toBeGreaterThan(pos1.y);
      expect(Math.abs(pos2.x - pos1.x)).toBeLessThan(10); // Should be aligned horizontally
    });

    test('should layout left-to-right', () => {
      const engine = new DiagramLayoutEngine({ direction: 'LR' });
      const graphData = {
        nodes: [
          { id: 'n1', size: { width: 100, height: 50 } },
          { id: 'n2', size: { width: 100, height: 50 } }
        ],
        edges: [
          { id: 'e1', source: 'n1', target: 'n2' }
        ]
      };
      
      const result = engine.compute(graphData);
      
      const pos1 = result.positions.get('n1');
      const pos2 = result.positions.get('n2');
      expect(pos2.x).toBeGreaterThan(pos1.x);
      expect(Math.abs(pos2.y - pos1.y)).toBeLessThan(10); // Should be aligned vertically
    });

    test('should layout bottom-to-top', () => {
      const engine = new DiagramLayoutEngine({ direction: 'BT' });
      const graphData = {
        nodes: [
          { id: 'n1', size: { width: 100, height: 50 } },
          { id: 'n2', size: { width: 100, height: 50 } }
        ],
        edges: [
          { id: 'e1', source: 'n1', target: 'n2' }
        ]
      };
      
      const result = engine.compute(graphData);
      
      const pos1 = result.positions.get('n1');
      const pos2 = result.positions.get('n2');
      expect(pos2.y).toBeLessThan(pos1.y);
    });

    test('should layout right-to-left', () => {
      const engine = new DiagramLayoutEngine({ direction: 'RL' });
      const graphData = {
        nodes: [
          { id: 'n1', size: { width: 100, height: 50 } },
          { id: 'n2', size: { width: 100, height: 50 } }
        ],
        edges: [
          { id: 'e1', source: 'n1', target: 'n2' }
        ]
      };
      
      const result = engine.compute(graphData);
      
      const pos1 = result.positions.get('n1');
      const pos2 = result.positions.get('n2');
      expect(pos2.x).toBeLessThan(pos1.x);
    });
  });

  describe('Spacing Configuration', () => {
    test('should respect node spacing', () => {
      const engine = new DiagramLayoutEngine({ 
        direction: 'LR',
        spacing: { node: 200, rank: 100 }
      });
      
      const graphData = {
        nodes: [
          { id: 'n1', size: { width: 100, height: 50 } },
          { id: 'n2', size: { width: 100, height: 50 } },
          { id: 'n3', size: { width: 100, height: 50 } }
        ],
        edges: [
          { id: 'e1', source: 'n1', target: 'n2' },
          { id: 'e2', source: 'n1', target: 'n3' }
        ]
      };
      
      const result = engine.compute(graphData);
      
      const pos2 = result.positions.get('n2');
      const pos3 = result.positions.get('n3');
      const distance = Math.abs(pos3.y - pos2.y);
      
      // Should have at least the specified spacing
      expect(distance).toBeGreaterThanOrEqual(150); // node height + spacing
    });

    test('should respect rank spacing', () => {
      const engine = new DiagramLayoutEngine({ 
        direction: 'TB',
        spacing: { node: 50, rank: 200 }
      });
      
      const graphData = {
        nodes: [
          { id: 'n1', size: { width: 100, height: 50 } },
          { id: 'n2', size: { width: 100, height: 50 } }
        ],
        edges: [
          { id: 'e1', source: 'n1', target: 'n2' }
        ]
      };
      
      const result = engine.compute(graphData);
      
      const pos1 = result.positions.get('n1');
      const pos2 = result.positions.get('n2');
      const distance = pos2.y - pos1.y;
      
      // Should have at least the specified rank spacing
      expect(distance).toBeGreaterThanOrEqual(200);
    });
  });

  describe('Complex Graphs', () => {
    test('should handle diamond pattern', () => {
      const engine = new DiagramLayoutEngine();
      const graphData = {
        nodes: [
          { id: 'top', size: { width: 100, height: 50 } },
          { id: 'left', size: { width: 100, height: 50 } },
          { id: 'right', size: { width: 100, height: 50 } },
          { id: 'bottom', size: { width: 100, height: 50 } }
        ],
        edges: [
          { id: 'e1', source: 'top', target: 'left' },
          { id: 'e2', source: 'top', target: 'right' },
          { id: 'e3', source: 'left', target: 'bottom' },
          { id: 'e4', source: 'right', target: 'bottom' }
        ]
      };
      
      const result = engine.compute(graphData);
      
      expect(result.positions.size).toBe(4);
      
      const topPos = result.positions.get('top');
      const bottomPos = result.positions.get('bottom');
      const leftPos = result.positions.get('left');
      const rightPos = result.positions.get('right');
      
      // Top should be above bottom
      expect(topPos.y).toBeLessThan(bottomPos.y);
      // Left should be left of right
      expect(leftPos.x).toBeLessThan(rightPos.x);
    });

    test('should handle tree structure', () => {
      const engine = new DiagramLayoutEngine();
      const graphData = {
        nodes: [
          { id: 'root', size: { width: 100, height: 50 } },
          { id: 'child1', size: { width: 100, height: 50 } },
          { id: 'child2', size: { width: 100, height: 50 } },
          { id: 'grandchild1', size: { width: 100, height: 50 } },
          { id: 'grandchild2', size: { width: 100, height: 50 } }
        ],
        edges: [
          { id: 'e1', source: 'root', target: 'child1' },
          { id: 'e2', source: 'root', target: 'child2' },
          { id: 'e3', source: 'child1', target: 'grandchild1' },
          { id: 'e4', source: 'child1', target: 'grandchild2' }
        ]
      };
      
      const result = engine.compute(graphData);
      
      const rootPos = result.positions.get('root');
      const child1Pos = result.positions.get('child1');
      const grandchild1Pos = result.positions.get('grandchild1');
      
      // Should maintain hierarchy
      expect(child1Pos.y).toBeGreaterThan(rootPos.y);
      expect(grandchild1Pos.y).toBeGreaterThan(child1Pos.y);
    });

    test('should handle cycles gracefully', () => {
      const engine = new DiagramLayoutEngine();
      const graphData = {
        nodes: [
          { id: 'n1', size: { width: 100, height: 50 } },
          { id: 'n2', size: { width: 100, height: 50 } },
          { id: 'n3', size: { width: 100, height: 50 } }
        ],
        edges: [
          { id: 'e1', source: 'n1', target: 'n2' },
          { id: 'e2', source: 'n2', target: 'n3' },
          { id: 'e3', source: 'n3', target: 'n1' } // Creates cycle
        ]
      };
      
      const result = engine.compute(graphData);
      
      // Should still compute positions for all nodes
      expect(result.positions.size).toBe(3);
      graphData.nodes.forEach(node => {
        const position = result.positions.get(node.id);
        expect(position).toBeDefined();
        expect(position.x).toBeGreaterThanOrEqual(0);
        expect(position.y).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid graph data', () => {
      const engine = new DiagramLayoutEngine();
      
      expect(() => {
        engine.compute(null);
      }).toThrow('Invalid graph data');
    });

    test('should handle missing nodes array', () => {
      const engine = new DiagramLayoutEngine();
      
      expect(() => {
        engine.compute({ edges: [] });
      }).toThrow('Invalid graph data');
    });

    test('should handle invalid edges', () => {
      const engine = new DiagramLayoutEngine();
      const graphData = {
        nodes: [
          { id: 'n1', size: { width: 100, height: 50 } }
        ],
        edges: [
          { id: 'e1', source: 'n1', target: 'missing' } // Invalid target
        ]
      };
      
      // Should handle gracefully and still layout the valid node
      const result = engine.compute(graphData);
      expect(result.positions.size).toBe(1);
    });
  });

  describe('Cleanup', () => {
    test('should clean up on destroy', () => {
      const engine = new DiagramLayoutEngine();
      
      engine.destroy();
      
      expect(engine.config).toBeNull();
      expect(engine.graphLib).toBeNull();
    });
  });
});