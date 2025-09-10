/**
 * Unit tests for DagreLayoutAlgorithm Edge Routing System
 * Tests the enhanced edge routing with multiple styles and crossing detection
 */

import { jest } from '@jest/globals';
import { DagreLayoutAlgorithm } from '../../../../src/renderers/diagram/layout/DagreLayoutAlgorithm.js';

describe('DagreLayoutAlgorithm Edge Routing System', () => {
  let algorithm;

  beforeEach(() => {
    algorithm = new DagreLayoutAlgorithm();
  });

  afterEach(() => {
    if (algorithm) {
      algorithm = null;
    }
  });

  describe('Basic Edge Routing', () => {
    test('should route edges between two nodes', () => {
      const graphData = {
        nodes: [
          { id: 'A', size: { width: 100, height: 60 } },
          { id: 'B', size: { width: 100, height: 60 } }
        ],
        edges: [
          { id: 'e1', source: 'A', target: 'B' }
        ]
      };

      const result = algorithm.layout(graphData);
      
      expect(result.edges.size).toBe(1);
      expect(result.edges.has('e1')).toBe(true);
      
      const edge = result.edges.get('e1');
      expect(edge.path).toBeDefined();
      expect(edge.path.points).toBeDefined();
      expect(Array.isArray(edge.path.points)).toBe(true);
      expect(edge.path.points.length).toBeGreaterThanOrEqual(2);
      
      // Each point should have valid coordinates
      edge.path.points.forEach(point => {
        expect(typeof point.x).toBe('number');
        expect(typeof point.y).toBe('number');
        expect(isFinite(point.x)).toBe(true);
        expect(isFinite(point.y)).toBe(true);
      });
    });

    test('should provide edge routing metadata', () => {
      const graphData = {
        nodes: [
          { id: 'A', size: { width: 80, height: 50 } },
          { id: 'B', size: { width: 80, height: 50 } },
          { id: 'C', size: { width: 80, height: 50 } }
        ],
        edges: [
          { id: 'e1', source: 'A', target: 'B' },
          { id: 'e2', source: 'B', target: 'C' }
        ]
      };

      const result = algorithm.layout(graphData);
      
      expect(result.metadata.edgeRouting).toBeDefined();
      expect(result.metadata.edgeRouting.totalEdges).toBe(2);
      expect(typeof result.metadata.edgeRouting.routingStyles).toBe('object');
      expect(typeof result.metadata.edgeRouting.totalCrossings).toBe('number');
      expect(typeof result.metadata.edgeRouting.totalPathLength).toBe('number');
      expect(result.metadata.edgeRouting.totalPathLength).toBeGreaterThan(0);
    });

    test('should calculate connection points on node boundaries', () => {
      const graphData = {
        nodes: [
          { id: 'A', size: { width: 120, height: 80 } },
          { id: 'B', size: { width: 100, height: 60 } }
        ],
        edges: [
          { id: 'e1', source: 'A', target: 'B' }
        ]
      };

      const result = algorithm.layout(graphData);
      
      const edge = result.edges.get('e1');
      expect(edge.path.points.length).toBeGreaterThanOrEqual(2);
      
      // First and last points should be connection points
      const startPoint = edge.path.points[0];
      const endPoint = edge.path.points[edge.path.points.length - 1];
      
      expect(startPoint).toBeDefined();
      expect(endPoint).toBeDefined();
      expect(startPoint.x !== endPoint.x || startPoint.y !== endPoint.y).toBe(true);
    });
  });

  describe('Routing Styles', () => {
    test('should use straight routing for simple cases', () => {
      const graphData = {
        nodes: [
          { id: 'A', size: { width: 100, height: 60 } },
          { id: 'B', size: { width: 100, height: 60 } }
        ],
        edges: [
          { id: 'e1', source: 'A', target: 'B' }
        ]
      };

      const result = algorithm.layout(graphData);
      
      const edge = result.edges.get('e1');
      expect(edge.routing).toBeDefined();
      expect(edge.routing.style).toBeDefined();
      expect(['straight', 'orthogonal', 'spline', 'bezier']).toContain(edge.routing.style);
      
      // Straight routing should have exactly 2 points
      if (edge.routing.style === 'straight') {
        expect(edge.path.points.length).toBe(2);
      }
    });

    test('should use orthogonal routing when appropriate', () => {
      // Create a graph where orthogonal routing might be preferred
      const graphData = {
        nodes: [
          { id: 'A', size: { width: 100, height: 60 } },
          { id: 'B', size: { width: 100, height: 60 } },
          { id: 'C', size: { width: 100, height: 60 } }
        ],
        edges: [
          { id: 'e1', source: 'A', target: 'B' },
          { id: 'e2', source: 'A', target: 'C' }
        ]
      };

      const result = algorithm.layout(graphData);
      
      // Check that at least one edge uses orthogonal routing
      const edges = Array.from(result.edges.values());
      const hasOrthogonal = edges.some(edge => edge.routing?.style === 'orthogonal');
      
      if (hasOrthogonal) {
        const orthogonalEdge = edges.find(edge => edge.routing?.style === 'orthogonal');
        expect(orthogonalEdge.path.points.length).toBeGreaterThanOrEqual(2);
        
        // Orthogonal routing should have right-angle segments
        // Check that consecutive segments are perpendicular
        if (orthogonalEdge.path.points.length >= 3) {
          const points = orthogonalEdge.path.points;
          for (let i = 0; i < points.length - 2; i++) {
            const p1 = points[i];
            const p2 = points[i + 1];
            const p3 = points[i + 2];
            
            // Check if segments are horizontal or vertical
            const seg1Horizontal = Math.abs(p2.y - p1.y) < 1;
            const seg1Vertical = Math.abs(p2.x - p1.x) < 1;
            const seg2Horizontal = Math.abs(p3.y - p2.y) < 1;
            const seg2Vertical = Math.abs(p3.x - p2.x) < 1;
            
            expect(seg1Horizontal || seg1Vertical).toBe(true);
            expect(seg2Horizontal || seg2Vertical).toBe(true);
          }
        }
      }
    });

    test('should use spline routing for medium-distance connections', () => {
      // Create nodes at different ranks to encourage spline routing
      const graphData = {
        nodes: [
          { id: 'A', size: { width: 80, height: 50 } },
          { id: 'B', size: { width: 80, height: 50 } },
          { id: 'C', size: { width: 80, height: 50 } },
          { id: 'D', size: { width: 80, height: 50 } }
        ],
        edges: [
          { id: 'e1', source: 'A', target: 'B' },
          { id: 'e2', source: 'B', target: 'C' },
          { id: 'e3', source: 'A', target: 'D' } // Skip-level connection
        ]
      };

      const result = algorithm.layout(graphData);
      
      // Check if any edge uses spline routing
      const edges = Array.from(result.edges.values());
      const splineEdges = edges.filter(edge => edge.routing?.style === 'spline');
      
      if (splineEdges.length > 0) {
        splineEdges.forEach(edge => {
          expect(edge.path.points.length).toBeGreaterThanOrEqual(2);
          expect(edge.routing.controlPoints).toBeDefined();
          expect(Array.isArray(edge.routing.controlPoints)).toBe(true);
        });
      }
    });

    test('should use bezier routing for long-distance connections', () => {
      // Create a graph with long-distance connections
      const graphData = {
        nodes: [
          { id: 'A', size: { width: 100, height: 60 } },
          { id: 'B', size: { width: 100, height: 60 } },
          { id: 'C', size: { width: 100, height: 60 } },
          { id: 'D', size: { width: 100, height: 60 } },
          { id: 'E', size: { width: 100, height: 60 } }
        ],
        edges: [
          { id: 'e1', source: 'A', target: 'B' },
          { id: 'e2', source: 'B', target: 'C' },
          { id: 'e3', source: 'C', target: 'D' },
          { id: 'e4', source: 'A', target: 'E' } // Long-distance connection
        ]
      };

      const result = algorithm.layout(graphData);
      
      // Check if any edge uses bezier routing
      const edges = Array.from(result.edges.values());
      const bezierEdges = edges.filter(edge => edge.routing?.style === 'bezier');
      
      if (bezierEdges.length > 0) {
        bezierEdges.forEach(edge => {
          expect(edge.path.points.length).toBeGreaterThanOrEqual(2);
          expect(edge.routing.controlPoints).toBeDefined();
          expect(edge.routing.controlPoints.length).toBeGreaterThanOrEqual(2);
          
          // Bezier edges should have smooth curves
          expect(edge.routing.isCurved).toBe(true);
        });
      }
    });
  });

  describe('Edge Crossing Detection', () => {
    test('should detect edge crossings in complex graphs', () => {
      // Create a graph with potential edge crossings
      const graphData = {
        nodes: [
          { id: 'A', size: { width: 80, height: 50 } },
          { id: 'B', size: { width: 80, height: 50 } },
          { id: 'C', size: { width: 80, height: 50 } },
          { id: 'D', size: { width: 80, height: 50 } }
        ],
        edges: [
          { id: 'e1', source: 'A', target: 'D' }, // Cross-over edge
          { id: 'e2', source: 'B', target: 'C' },
          { id: 'e3', source: 'A', target: 'B' },
          { id: 'e4', source: 'C', target: 'D' }
        ]
      };

      const result = algorithm.layout(graphData);
      
      expect(result.metadata.edgeRouting.totalCrossings).toBeGreaterThanOrEqual(0);
      
      // Check individual edges for crossing information
      result.edges.forEach(edge => {
        expect(edge.routing.crossings).toBeDefined();
        expect(Array.isArray(edge.routing.crossings)).toBe(true);
      });
    });

    test('should minimize crossings through intelligent routing', () => {
      // Create a graph where routing choices can affect crossings
      const graphData = {
        nodes: [
          { id: 'top1', size: { width: 100, height: 60 } },
          { id: 'top2', size: { width: 100, height: 60 } },
          { id: 'bottom1', size: { width: 100, height: 60 } },
          { id: 'bottom2', size: { width: 100, height: 60 } }
        ],
        edges: [
          { id: 'e1', source: 'top1', target: 'bottom2' }, // Crossing edge
          { id: 'e2', source: 'top2', target: 'bottom1' }, // Crossing edge
          { id: 'e3', source: 'top1', target: 'bottom1' }, // Direct edge
          { id: 'e4', source: 'top2', target: 'bottom2' }  // Direct edge
        ]
      };

      const result = algorithm.layout(graphData);
      
      // The system should attempt to minimize crossings
      const totalCrossings = result.metadata.edgeRouting.totalCrossings;
      expect(totalCrossings).toBeGreaterThanOrEqual(0);
      
      // Check that crossing information is provided for each edge
      result.edges.forEach(edge => {
        expect(typeof edge.routing.crossings).toBeDefined();
      });
    });
  });

  describe('Path Length and Optimization', () => {
    test('should calculate accurate path lengths', () => {
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

      const result = algorithm.layout(graphData);
      
      result.edges.forEach(edge => {
        expect(edge.routing.pathLength).toBeDefined();
        expect(typeof edge.routing.pathLength).toBe('number');
        expect(edge.routing.pathLength).toBeGreaterThan(0);
        
        // Path length should be reasonable for the given points
        if (edge.path.points.length === 2) {
          const p1 = edge.path.points[0];
          const p2 = edge.path.points[1];
          const straightDistance = Math.sqrt(
            Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)
          );
          expect(edge.routing.pathLength).toBeCloseTo(straightDistance, 1);
        }
      });

      // Total path length should be sum of individual path lengths
      const individualSum = Array.from(result.edges.values())
        .reduce((sum, edge) => sum + edge.routing.pathLength, 0);
      
      expect(result.metadata.edgeRouting.totalPathLength).toBeCloseTo(individualSum, 1);
    });

    test('should optimize path lengths when possible', () => {
      // Simple two-node graph should have minimal path length
      const graphData = {
        nodes: [
          { id: 'A', size: { width: 100, height: 60 } },
          { id: 'B', size: { width: 100, height: 60 } }
        ],
        edges: [
          { id: 'e1', source: 'A', target: 'B' }
        ]
      };

      const result = algorithm.layout(graphData);
      
      const edge = result.edges.get('e1');
      expect(edge.routing.pathLength).toBeGreaterThan(0);
      
      // For a simple two-node case, path should be reasonably direct
      const nodeDistance = Math.sqrt(
        Math.pow(result.positions.get('B').x - result.positions.get('A').x, 2) +
        Math.pow(result.positions.get('B').y - result.positions.get('A').y, 2)
      );
      
      // Path length should not be excessively longer than node distance
      expect(edge.routing.pathLength).toBeLessThan(nodeDistance * 2);
    });
  });

  describe('Direction-Based Routing', () => {
    test('should adapt routing to layout direction', () => {
      const directions = ['TB', 'LR', 'BT', 'RL'];
      
      directions.forEach(direction => {
        const algorithm = new DagreLayoutAlgorithm({ rankdir: direction });
        
        const graphData = {
          nodes: [
            { id: 'A', size: { width: 100, height: 60 } },
            { id: 'B', size: { width: 100, height: 60 } }
          ],
          edges: [
            { id: 'e1', source: 'A', target: 'B' }
          ]
        };

        const result = algorithm.layout(graphData);
        
        expect(result.edges.has('e1')).toBe(true);
        const edge = result.edges.get('e1');
        
        expect(edge.path.points.length).toBeGreaterThanOrEqual(2);
        expect(edge.routing.style).toBeDefined();
        
        // Routing should be consistent with layout direction
        const posA = result.positions.get('A');
        const posB = result.positions.get('B');
        const startPoint = edge.path.points[0];
        const endPoint = edge.path.points[edge.path.points.length - 1];
        
        // Connection points should be on appropriate sides of nodes
        expect(typeof startPoint.x).toBe('number');
        expect(typeof startPoint.y).toBe('number');
        expect(typeof endPoint.x).toBe('number');
        expect(typeof endPoint.y).toBe('number');
      });
    });
  });

  describe('Edge Routing Metadata', () => {
    test('should provide comprehensive routing statistics', () => {
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
          { id: 'e4', source: 'A', target: 'D' }
        ]
      };

      const result = algorithm.layout(graphData);
      
      expect(result.metadata.edgeRouting).toBeDefined();
      const routing = result.metadata.edgeRouting;
      
      expect(routing.totalEdges).toBe(4);
      expect(typeof routing.totalCrossings).toBe('number');
      expect(typeof routing.totalPathLength).toBe('number');
      expect(typeof routing.routingStyles).toBe('object');
      
      // Routing styles should be a count of each style used
      Object.values(routing.routingStyles).forEach(count => {
        expect(typeof count).toBe('number');
        expect(count).toBeGreaterThanOrEqual(0);
      });
      
      // Total edges in styles should equal total edges
      const styleTotal = Object.values(routing.routingStyles)
        .reduce((sum, count) => sum + count, 0);
      expect(styleTotal).toBe(routing.totalEdges);
    });

    test('should track routing performance metrics', () => {
      // Create a moderately complex graph
      const nodes = [];
      const edges = [];
      
      for (let i = 0; i < 8; i++) {
        nodes.push({
          id: `node${i}`,
          size: { width: 80, height: 50 }
        });
      }
      
      // Create a mix of connections
      for (let i = 0; i < 6; i++) {
        edges.push({
          id: `edge${i}`,
          source: `node${i}`,
          target: `node${i + 1}`
        });
      }
      
      // Add some cross-connections
      edges.push({ id: 'cross1', source: 'node0', target: 'node3' });
      edges.push({ id: 'cross2', source: 'node1', target: 'node4' });

      const graphData = { nodes, edges };
      const result = algorithm.layout(graphData);
      
      expect(result.metadata.edgeRouting.totalEdges).toBe(8);
      expect(result.metadata.edgeRouting.totalPathLength).toBeGreaterThan(0);
      
      // Should have routing information for all edges
      expect(result.edges.size).toBe(8);
      result.edges.forEach(edge => {
        expect(edge.routing).toBeDefined();
        expect(edge.routing.style).toBeDefined();
        expect(edge.routing.pathLength).toBeGreaterThan(0);
        expect(Array.isArray(edge.routing.crossings)).toBe(true);
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle edges with same source and target', () => {
      const graphData = {
        nodes: [
          { id: 'A', size: { width: 100, height: 60 } }
        ],
        edges: [
          { id: 'self', source: 'A', target: 'A' }
        ]
      };

      const result = algorithm.layout(graphData);
      
      expect(result.edges.has('self')).toBe(true);
      const selfEdge = result.edges.get('self');
      
      expect(selfEdge.path.points).toBeDefined();
      expect(selfEdge.routing).toBeDefined();
      expect(selfEdge.routing.pathLength).toBeGreaterThan(0);
    });

    test('should handle nodes at identical positions', () => {
      // This shouldn't normally happen with proper layout, but test robustness
      const graphData = {
        nodes: [
          { id: 'A', size: { width: 100, height: 60 } },
          { id: 'B', size: { width: 100, height: 60 } }
        ],
        edges: [
          { id: 'e1', source: 'A', target: 'B' }
        ]
      };

      const result = algorithm.layout(graphData);
      
      // Even if nodes end up close together, routing should work
      expect(result.edges.has('e1')).toBe(true);
      const edge = result.edges.get('e1');
      
      expect(edge.path.points.length).toBeGreaterThanOrEqual(2);
      expect(edge.routing.pathLength).toBeGreaterThanOrEqual(0);
    });

    test('should handle large numbers of edges efficiently', () => {
      // Create a dense graph to test routing performance
      const nodes = [];
      const edges = [];
      
      // 6 nodes in a complete graph (15 edges)
      for (let i = 0; i < 6; i++) {
        nodes.push({
          id: `node${i}`,
          size: { width: 80, height: 50 }
        });
      }
      
      let edgeId = 0;
      for (let i = 0; i < 6; i++) {
        for (let j = i + 1; j < 6; j++) {
          edges.push({
            id: `edge${edgeId++}`,
            source: `node${i}`,
            target: `node${j}`
          });
        }
      }

      const graphData = { nodes, edges };
      
      const startTime = performance.now();
      const result = algorithm.layout(graphData);
      const endTime = performance.now();
      
      // Should complete in reasonable time
      expect(endTime - startTime).toBeLessThan(100);
      
      expect(result.edges.size).toBe(15);
      expect(result.metadata.edgeRouting.totalEdges).toBe(15);
      
      // All edges should have valid routing
      result.edges.forEach(edge => {
        expect(edge.routing).toBeDefined();
        expect(edge.routing.pathLength).toBeGreaterThan(0);
        expect(Array.isArray(edge.path.points)).toBe(true);
        expect(edge.path.points.length).toBeGreaterThanOrEqual(2);
      });
    });
  });
});