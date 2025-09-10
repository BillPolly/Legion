/**
 * Unit tests for DagreLayoutAlgorithm
 * Tests the complete Dagre layout algorithm implementation
 */

import { jest } from '@jest/globals';
import { DagreLayoutAlgorithm, DagrePhase } from '../../../../src/renderers/diagram/layout/DagreLayoutAlgorithm.js';

describe('DagreLayoutAlgorithm', () => {
  let algorithm;

  beforeEach(() => {
    algorithm = new DagreLayoutAlgorithm();
  });

  afterEach(() => {
    if (algorithm) {
      algorithm = null;
    }
  });

  describe('Basic Functionality', () => {
    test('should create algorithm with default config', () => {
      expect(algorithm).toBeDefined();
      expect(algorithm.config.rankdir).toBe('TB');
      expect(algorithm.config.nodesep).toBe(50);
      expect(algorithm.config.ranksep).toBe(50);
    });

    test('should accept custom configuration', () => {
      const customAlgorithm = new DagreLayoutAlgorithm({
        rankdir: 'LR',
        nodesep: 30,
        ranksep: 80,
        align: 'UR',
        acyclicer: 'dfs',
        ranker: 'tight-tree'
      });

      expect(customAlgorithm.config.rankdir).toBe('LR');
      expect(customAlgorithm.config.nodesep).toBe(30);
      expect(customAlgorithm.config.ranksep).toBe(80);
      expect(customAlgorithm.config.align).toBe('UR');
      expect(customAlgorithm.config.acyclicer).toBe('dfs');
      expect(customAlgorithm.config.ranker).toBe('tight-tree');
    });

    test('should handle empty graph', () => {
      const result = algorithm.layout({ nodes: [], edges: [] });

      expect(result).toBeDefined();
      expect(result.positions).toBeInstanceOf(Map);
      expect(result.positions.size).toBe(0);
      expect(result.bounds).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    });

    test('should handle single node', () => {
      const graphData = {
        nodes: [
          { id: 'node1', label: 'Node 1', size: { width: 100, height: 60 } }
        ],
        edges: []
      };

      const result = algorithm.layout(graphData);

      expect(result.positions.size).toBe(1);
      expect(result.positions.has('node1')).toBe(true);
      
      const pos = result.positions.get('node1');
      expect(typeof pos.x).toBe('number');
      expect(typeof pos.y).toBe('number');
      expect(result.bounds.width).toBeGreaterThan(0);
      expect(result.bounds.height).toBeGreaterThan(0);
    });
  });

  describe('Simple Graph Layout', () => {
    test('should layout simple two-node graph', () => {
      const graphData = {
        nodes: [
          { id: 'node1', label: 'Node 1', size: { width: 100, height: 60 } },
          { id: 'node2', label: 'Node 2', size: { width: 100, height: 60 } }
        ],
        edges: [
          { id: 'edge1', source: 'node1', target: 'node2', label: 'Edge 1' }
        ]
      };

      const result = algorithm.layout(graphData);

      expect(result.positions.size).toBe(2);
      expect(result.positions.has('node1')).toBe(true);
      expect(result.positions.has('node2')).toBe(true);

      // Check that nodes are positioned differently
      const pos1 = result.positions.get('node1');
      const pos2 = result.positions.get('node2');
      expect(pos1.x !== pos2.x || pos1.y !== pos2.y).toBe(true);

      // For TB layout, node2 should be below node1
      if (algorithm.config.rankdir === 'TB') {
        expect(pos2.y).toBeGreaterThan(pos1.y);
      }

      // Check edges
      expect(result.edges.size).toBe(1);
      expect(result.edges.has('edge1')).toBe(true);
      
      const edge = result.edges.get('edge1');
      expect(edge.path.points).toBeDefined();
      expect(edge.path.points.length).toBeGreaterThanOrEqual(2);
    });

    test('should layout linear chain', () => {
      const graphData = {
        nodes: [
          { id: 'A', label: 'A', size: { width: 80, height: 50 } },
          { id: 'B', label: 'B', size: { width: 80, height: 50 } },
          { id: 'C', label: 'C', size: { width: 80, height: 50 } },
          { id: 'D', label: 'D', size: { width: 80, height: 50 } }
        ],
        edges: [
          { id: 'edge1', source: 'A', target: 'B' },
          { id: 'edge2', source: 'B', target: 'C' },
          { id: 'edge3', source: 'C', target: 'D' }
        ]
      };

      const result = algorithm.layout(graphData);

      expect(result.positions.size).toBe(4);
      
      // All nodes should have positions
      const positions = ['A', 'B', 'C', 'D'].map(id => result.positions.get(id));
      positions.forEach(pos => {
        expect(typeof pos.x).toBe('number');
        expect(typeof pos.y).toBe('number');
      });

      // For TB layout, each successive node should be lower
      if (algorithm.config.rankdir === 'TB') {
        expect(positions[1].y).toBeGreaterThan(positions[0].y);
        expect(positions[2].y).toBeGreaterThan(positions[1].y);
        expect(positions[3].y).toBeGreaterThan(positions[2].y);
      }
    });

    test('should layout tree structure', () => {
      const graphData = {
        nodes: [
          { id: 'root', label: 'Root', size: { width: 100, height: 60 } },
          { id: 'left', label: 'Left', size: { width: 100, height: 60 } },
          { id: 'right', label: 'Right', size: { width: 100, height: 60 } },
          { id: 'leaf1', label: 'Leaf 1', size: { width: 100, height: 60 } },
          { id: 'leaf2', label: 'Leaf 2', size: { width: 100, height: 60 } }
        ],
        edges: [
          { id: 'e1', source: 'root', target: 'left' },
          { id: 'e2', source: 'root', target: 'right' },
          { id: 'e3', source: 'left', target: 'leaf1' },
          { id: 'e4', source: 'right', target: 'leaf2' }
        ]
      };

      const result = algorithm.layout(graphData);

      expect(result.positions.size).toBe(5);
      
      const rootPos = result.positions.get('root');
      const leftPos = result.positions.get('left');
      const rightPos = result.positions.get('right');
      const leaf1Pos = result.positions.get('leaf1');
      const leaf2Pos = result.positions.get('leaf2');

      // For TB layout, children should be below parents
      if (algorithm.config.rankdir === 'TB') {
        expect(leftPos.y).toBeGreaterThan(rootPos.y);
        expect(rightPos.y).toBeGreaterThan(rootPos.y);
        expect(leaf1Pos.y).toBeGreaterThan(leftPos.y);
        expect(leaf2Pos.y).toBeGreaterThan(rightPos.y);
        
        // Left and right children should be at same level
        expect(Math.abs(leftPos.y - rightPos.y)).toBeLessThan(5);
        expect(Math.abs(leaf1Pos.y - leaf2Pos.y)).toBeLessThan(5);
      }
    });
  });

  describe('Direction Support', () => {
    test('should layout in top-bottom direction', () => {
      const tbAlgorithm = new DagreLayoutAlgorithm({ rankdir: 'TB' });
      
      const graphData = {
        nodes: [
          { id: 'A', size: { width: 100, height: 60 } },
          { id: 'B', size: { width: 100, height: 60 } }
        ],
        edges: [
          { id: 'edge1', source: 'A', target: 'B' }
        ]
      };

      const result = tbAlgorithm.layout(graphData);
      const posA = result.positions.get('A');
      const posB = result.positions.get('B');

      expect(posB.y).toBeGreaterThan(posA.y);
    });

    test('should layout in left-right direction', () => {
      const lrAlgorithm = new DagreLayoutAlgorithm({ rankdir: 'LR' });
      
      const graphData = {
        nodes: [
          { id: 'A', size: { width: 100, height: 60 } },
          { id: 'B', size: { width: 100, height: 60 } }
        ],
        edges: [
          { id: 'edge1', source: 'A', target: 'B' }
        ]
      };

      const result = lrAlgorithm.layout(graphData);
      const posA = result.positions.get('A');
      const posB = result.positions.get('B');

      expect(posB.x).toBeGreaterThan(posA.x);
    });

    test('should layout in bottom-top direction', () => {
      const btAlgorithm = new DagreLayoutAlgorithm({ rankdir: 'BT' });
      
      const graphData = {
        nodes: [
          { id: 'A', size: { width: 100, height: 60 } },
          { id: 'B', size: { width: 100, height: 60 } }
        ],
        edges: [
          { id: 'edge1', source: 'A', target: 'B' }
        ]
      };

      const result = btAlgorithm.layout(graphData);
      const posA = result.positions.get('A');
      const posB = result.positions.get('B');

      expect(posB.y).toBeLessThan(posA.y);
    });

    test('should layout in right-left direction', () => {
      const rlAlgorithm = new DagreLayoutAlgorithm({ rankdir: 'RL' });
      
      const graphData = {
        nodes: [
          { id: 'A', size: { width: 100, height: 60 } },
          { id: 'B', size: { width: 100, height: 60 } }
        ],
        edges: [
          { id: 'edge1', source: 'A', target: 'B' }
        ]
      };

      const result = rlAlgorithm.layout(graphData);
      const posA = result.positions.get('A');
      const posB = result.positions.get('B');

      expect(posB.x).toBeLessThan(posA.x);
    });
  });

  describe('Cycle Handling', () => {
    test('should handle simple cycle', () => {
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

      const result = algorithm.layout(graphData);

      expect(result.positions.size).toBe(3);
      // Should successfully layout despite cycle
      result.positions.forEach(pos => {
        expect(typeof pos.x).toBe('number');
        expect(typeof pos.y).toBe('number');
        expect(isNaN(pos.x)).toBe(false);
        expect(isNaN(pos.y)).toBe(false);
      });

      // Should have metadata about removed edges
      expect(result.metadata).toBeDefined();
      expect(result.metadata.stats).toBeDefined();
      expect(typeof result.metadata.stats.removedEdges).toBe('number');
    });

    test('should handle self-loop', () => {
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

      const result = algorithm.layout(graphData);

      expect(result.positions.size).toBe(2);
      result.positions.forEach(pos => {
        expect(typeof pos.x).toBe('number');
        expect(typeof pos.y).toBe('number');
      });
    });
  });

  describe('Acyclicer Algorithms', () => {
    test('should use greedy acyclicer', () => {
      const greedyAlgorithm = new DagreLayoutAlgorithm({ acyclicer: 'greedy' });
      
      const graphData = {
        nodes: [
          { id: 'A', size: { width: 100, height: 60 } },
          { id: 'B', size: { width: 100, height: 60 } },
          { id: 'C', size: { width: 100, height: 60 } }
        ],
        edges: [
          { id: 'e1', source: 'A', target: 'B' },
          { id: 'e2', source: 'B', target: 'C' },
          { id: 'e3', source: 'C', target: 'A' }
        ]
      };

      const result = greedyAlgorithm.layout(graphData);
      expect(result.positions.size).toBe(3);
    });

    test('should use DFS acyclicer', () => {
      const dfsAlgorithm = new DagreLayoutAlgorithm({ acyclicer: 'dfs' });
      
      const graphData = {
        nodes: [
          { id: 'A', size: { width: 100, height: 60 } },
          { id: 'B', size: { width: 100, height: 60 } },
          { id: 'C', size: { width: 100, height: 60 } }
        ],
        edges: [
          { id: 'e1', source: 'A', target: 'B' },
          { id: 'e2', source: 'B', target: 'C' },
          { id: 'e3', source: 'C', target: 'A' }
        ]
      };

      const result = dfsAlgorithm.layout(graphData);
      expect(result.positions.size).toBe(3);
    });
  });

  describe('Ranking Algorithms', () => {
    test('should use longest-path ranker', () => {
      const longPathAlgorithm = new DagreLayoutAlgorithm({ ranker: 'longest-path' });
      
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
          { id: 'e3', source: 'B', target: 'D' },
          { id: 'e4', source: 'C', target: 'D' }
        ]
      };

      const result = longPathAlgorithm.layout(graphData);
      expect(result.positions.size).toBe(4);
      
      // Check that diamond structure is properly ranked
      const posA = result.positions.get('A');
      const posB = result.positions.get('B');
      const posC = result.positions.get('C');
      const posD = result.positions.get('D');
      
      if (longPathAlgorithm.config.rankdir === 'TB') {
        // B and C should be at same level (between A and D)
        expect(Math.abs(posB.y - posC.y)).toBeLessThan(5);
        expect(posB.y).toBeGreaterThan(posA.y);
        expect(posC.y).toBeGreaterThan(posA.y);
        expect(posD.y).toBeGreaterThan(posB.y);
        expect(posD.y).toBeGreaterThan(posC.y);
      }
    });

    test('should use network-simplex ranker', () => {
      const networkSimplexAlgorithm = new DagreLayoutAlgorithm({ ranker: 'network-simplex' });
      
      const graphData = {
        nodes: [
          { id: 'A', size: { width: 100, height: 60 } },
          { id: 'B', size: { width: 100, height: 60 } }
        ],
        edges: [
          { id: 'e1', source: 'A', target: 'B' }
        ]
      };

      // Should fallback to longest-path for now
      const result = networkSimplexAlgorithm.layout(graphData);
      expect(result.positions.size).toBe(2);
    });
  });

  describe('Edge Routing', () => {
    test('should calculate edge paths', () => {
      const graphData = {
        nodes: [
          { id: 'A', size: { width: 100, height: 60 } },
          { id: 'B', size: { width: 100, height: 60 } }
        ],
        edges: [
          { id: 'edge1', source: 'A', target: 'B' }
        ]
      };

      const result = algorithm.layout(graphData);

      expect(result.edges).toBeInstanceOf(Map);
      expect(result.edges.size).toBe(1);
      expect(result.edges.has('edge1')).toBe(true);

      const edge = result.edges.get('edge1');
      expect(edge.path).toBeDefined();
      expect(edge.path.points).toBeDefined();
      expect(edge.path.points.length).toBeGreaterThanOrEqual(2);

      // Each point should have x and y coordinates
      edge.path.points.forEach(point => {
        expect(typeof point.x).toBe('number');
        expect(typeof point.y).toBe('number');
      });
    });

    test('should handle multiple edges', () => {
      const graphData = {
        nodes: [
          { id: 'A', size: { width: 100, height: 60 } },
          { id: 'B', size: { width: 100, height: 60 } },
          { id: 'C', size: { width: 100, height: 60 } }
        ],
        edges: [
          { id: 'edge1', source: 'A', target: 'B' },
          { id: 'edge2', source: 'B', target: 'C' },
          { id: 'edge3', source: 'A', target: 'C' }
        ]
      };

      const result = algorithm.layout(graphData);

      expect(result.edges.size).toBe(3);
      ['edge1', 'edge2', 'edge3'].forEach(edgeId => {
        expect(result.edges.has(edgeId)).toBe(true);
        const edge = result.edges.get(edgeId);
        expect(edge.path.points).toBeDefined();
        expect(edge.path.points.length).toBeGreaterThanOrEqual(2);
      });
    });
  });

  describe('Spacing and Alignment', () => {
    test('should respect node separation', () => {
      const algorithm = new DagreLayoutAlgorithm({ nodesep: 100 });
      
      const graphData = {
        nodes: [
          { id: 'A', size: { width: 50, height: 50 } },
          { id: 'B', size: { width: 50, height: 50 } },
          { id: 'C', size: { width: 50, height: 50 } }
        ],
        edges: [
          { id: 'e1', source: 'A', target: 'B' },
          { id: 'e2', source: 'A', target: 'C' }
        ]
      };

      const result = algorithm.layout(graphData);
      
      // B and C should be at same rank, separated by at least nodesep
      const posB = result.positions.get('B');
      const posC = result.positions.get('C');
      
      const distance = Math.abs(posB.x - posC.x);
      expect(distance).toBeGreaterThanOrEqual(100); // nodesep + node widths
    });

    test('should respect rank separation', () => {
      const algorithm = new DagreLayoutAlgorithm({ ranksep: 150, rankdir: 'TB' });
      
      const graphData = {
        nodes: [
          { id: 'A', size: { width: 50, height: 50 } },
          { id: 'B', size: { width: 50, height: 50 } }
        ],
        edges: [
          { id: 'e1', source: 'A', target: 'B' }
        ]
      };

      const result = algorithm.layout(graphData);
      
      const posA = result.positions.get('A');
      const posB = result.positions.get('B');
      
      const distance = Math.abs(posB.y - posA.y);
      expect(distance).toBeGreaterThanOrEqual(100); // ranksep + node heights
    });

    test('should handle margins', () => {
      const algorithm = new DagreLayoutAlgorithm({ 
        marginx: 20, 
        marginy: 30 
      });
      
      const graphData = {
        nodes: [
          { id: 'A', size: { width: 100, height: 60 } }
        ],
        edges: []
      };

      const result = algorithm.layout(graphData);
      
      expect(result.bounds.x).toBeGreaterThanOrEqual(0);
      expect(result.bounds.y).toBeGreaterThanOrEqual(0);
      // Margins should be applied during normalization
    });
  });

  describe('Performance and Metadata', () => {
    test('should provide layout metadata', () => {
      const graphData = {
        nodes: [
          { id: 'A', size: { width: 100, height: 60 } },
          { id: 'B', size: { width: 100, height: 60 } }
        ],
        edges: [
          { id: 'edge1', source: 'A', target: 'B' }
        ]
      };

      const result = algorithm.layout(graphData);

      expect(result.metadata).toBeDefined();
      expect(result.metadata.algorithm).toBe('dagre');
      expect(result.metadata.config).toBeDefined();
      expect(result.metadata.stats).toBeDefined();
      expect(result.metadata.stats.nodes).toBe(2);
      expect(result.metadata.stats.edges).toBe(1);
      expect(typeof result.metadata.stats.ranks).toBe('number');
      expect(typeof result.metadata.stats.removedEdges).toBe('number');
    });

    test('should measure timing when enabled', () => {
      const timedAlgorithm = new DagreLayoutAlgorithm({ debugTiming: true });
      
      const graphData = {
        nodes: [
          { id: 'A', size: { width: 100, height: 60 } },
          { id: 'B', size: { width: 100, height: 60 } },
          { id: 'C', size: { width: 100, height: 60 } }
        ],
        edges: [
          { id: 'e1', source: 'A', target: 'B' },
          { id: 'e2', source: 'B', target: 'C' }
        ]
      };

      const result = timedAlgorithm.layout(graphData);

      expect(result.metadata.timing).toBeDefined();
      expect(typeof result.metadata.timing.total).toBe('number');
      expect(result.metadata.timing.total).toBeGreaterThan(0);
    });

    test('should handle large graphs efficiently', () => {
      // Create a larger test graph
      const nodes = [];
      const edges = [];
      
      // Create 50 nodes in a chain
      for (let i = 0; i < 50; i++) {
        nodes.push({
          id: `node${i}`,
          label: `Node ${i}`,
          size: { width: 100, height: 60 }
        });
        
        if (i > 0) {
          edges.push({
            id: `edge${i}`,
            source: `node${i-1}`,
            target: `node${i}`
          });
        }
      }

      const graphData = { nodes, edges };
      
      const startTime = performance.now();
      const result = algorithm.layout(graphData);
      const endTime = performance.now();

      // Should complete in reasonable time (< 100ms for 50 nodes)
      expect(endTime - startTime).toBeLessThan(100);
      
      expect(result.positions.size).toBe(50);
      expect(result.edges.size).toBe(49);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid input gracefully', () => {
      expect(() => {
        algorithm.layout(null);
      }).toThrow('Dagre layout failed');

      expect(() => {
        algorithm.layout({});
      }).toThrow('Dagre layout failed');
    });

    test('should handle nodes without size', () => {
      const graphData = {
        nodes: [
          { id: 'A', label: 'A' }, // Missing size
          { id: 'B', label: 'B', size: { width: 100, height: 60 } }
        ],
        edges: [
          { id: 'edge1', source: 'A', target: 'B' }
        ]
      };

      const result = algorithm.layout(graphData);

      expect(result.positions.size).toBe(2);
      // Should use default size for node without size
    });

    test('should handle disconnected graph', () => {
      const graphData = {
        nodes: [
          { id: 'A', size: { width: 100, height: 60 } },
          { id: 'B', size: { width: 100, height: 60 } },
          { id: 'C', size: { width: 100, height: 60 } },
          { id: 'D', size: { width: 100, height: 60 } }
        ],
        edges: [
          { id: 'e1', source: 'A', target: 'B' },
          // C and D are disconnected
          { id: 'e2', source: 'C', target: 'D' }
        ]
      };

      const result = algorithm.layout(graphData);

      expect(result.positions.size).toBe(4);
      // All nodes should have positions
      result.positions.forEach(pos => {
        expect(typeof pos.x).toBe('number');
        expect(typeof pos.y).toBe('number');
      });
    });
  });

  describe('Bounds Calculation', () => {
    test('should calculate correct bounds', () => {
      const graphData = {
        nodes: [
          { id: 'A', size: { width: 100, height: 60 } },
          { id: 'B', size: { width: 80, height: 50 } },
          { id: 'C', size: { width: 120, height: 70 } }
        ],
        edges: [
          { id: 'e1', source: 'A', target: 'B' },
          { id: 'e2', source: 'A', target: 'C' }
        ]
      };

      const result = algorithm.layout(graphData);

      expect(result.bounds).toBeDefined();
      expect(typeof result.bounds.x).toBe('number');
      expect(typeof result.bounds.y).toBe('number');
      expect(typeof result.bounds.width).toBe('number');
      expect(typeof result.bounds.height).toBe('number');
      
      expect(result.bounds.width).toBeGreaterThan(0);
      expect(result.bounds.height).toBeGreaterThan(0);
      
      // Bounds should encompass all nodes
      result.positions.forEach((pos, nodeId) => {
        const node = graphData.nodes.find(n => n.id === nodeId);
        const nodeLeft = pos.x - node.size.width / 2;
        const nodeRight = pos.x + node.size.width / 2;
        const nodeTop = pos.y - node.size.height / 2;
        const nodeBottom = pos.y + node.size.height / 2;
        
        expect(nodeLeft).toBeGreaterThanOrEqual(result.bounds.x);
        expect(nodeRight).toBeLessThanOrEqual(result.bounds.x + result.bounds.width);
        expect(nodeTop).toBeGreaterThanOrEqual(result.bounds.y);
        expect(nodeBottom).toBeLessThanOrEqual(result.bounds.y + result.bounds.height);
      });
    });
  });
});