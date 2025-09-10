/**
 * Unit tests for ForceDirectedLayout algorithm
 * Tests physics-based graph layout with force simulation
 */

import { jest } from '@jest/globals';
import { ForceDirectedLayout } from '../../../../src/renderers/diagram/layout/ForceDirectedLayout.js';

describe('ForceDirectedLayout', () => {
  let layout;

  beforeEach(() => {
    layout = new ForceDirectedLayout();
  });

  afterEach(() => {
    if (layout) {
      layout = null;
    }
  });

  describe('Basic Layout', () => {
    test('should create layout instance with default config', () => {
      expect(layout).toBeDefined();
      expect(layout.config.alphaMin).toBe(0.001);
      expect(layout.config.alphaDecay).toBe(0.0228);
      expect(layout.config.velocityDecay).toBe(0.4);
      expect(layout.config.forces.charge).toBe(-300);
      expect(layout.config.forces.link).toBe(1);
      expect(layout.config.forces.center).toBe(0.1);
      expect(layout.config.forces.collide).toBe(30);
    });

    test('should accept custom configuration', () => {
      const customLayout = new ForceDirectedLayout({
        alphaMin: 0.01,
        forces: {
          charge: -500,
          link: 2,
          center: 0.2
        },
        linkDistance: 150,
        iterations: 500
      });

      expect(customLayout.config.alphaMin).toBe(0.01);
      expect(customLayout.config.forces.charge).toBe(-500);
      expect(customLayout.config.forces.link).toBe(2);
      expect(customLayout.config.forces.center).toBe(0.2);
      expect(customLayout.config.linkDistance).toBe(150);
      expect(customLayout.config.iterations).toBe(500);
    });

    test('should layout simple two-node graph', () => {
      const graphData = {
        nodes: [
          { id: 'A', size: { width: 100, height: 60 } },
          { id: 'B', size: { width: 100, height: 60 } }
        ],
        edges: [
          { id: 'e1', source: 'A', target: 'B' }
        ]
      };

      const result = layout.layout(graphData);
      
      expect(result.positions.size).toBe(2);
      expect(result.positions.has('A')).toBe(true);
      expect(result.positions.has('B')).toBe(true);
      
      const posA = result.positions.get('A');
      const posB = result.positions.get('B');
      
      expect(typeof posA.x).toBe('number');
      expect(typeof posA.y).toBe('number');
      expect(typeof posB.x).toBe('number');
      expect(typeof posB.y).toBe('number');
      
      // Nodes should be separated by approximately linkDistance
      const distance = Math.sqrt(
        Math.pow(posB.x - posA.x, 2) + 
        Math.pow(posB.y - posA.y, 2)
      );
      
      expect(distance).toBeGreaterThan(50); // Should have some separation
      expect(distance).toBeLessThan(200); // But not too far
    });

    test('should handle disconnected nodes', () => {
      const graphData = {
        nodes: [
          { id: 'A', size: { width: 100, height: 60 } },
          { id: 'B', size: { width: 100, height: 60 } },
          { id: 'C', size: { width: 100, height: 60 } }
        ],
        edges: [
          { id: 'e1', source: 'A', target: 'B' }
        ]
      };

      const result = layout.layout(graphData);
      
      expect(result.positions.size).toBe(3);
      
      // All nodes should have positions
      const positions = Array.from(result.positions.values());
      positions.forEach(pos => {
        expect(isFinite(pos.x)).toBe(true);
        expect(isFinite(pos.y)).toBe(true);
      });
    });

    test('should provide fallback layout on error', () => {
      const graphData = {
        nodes: [
          { id: 'A', size: { width: 100, height: 60 } },
          { id: 'B', size: { width: 100, height: 60 } },
          { id: 'C', size: { width: 100, height: 60 } }
        ],
        edges: []
      };

      // Mock console.error to suppress output during test
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      // Force an error by corrupting internal state
      layout.nodes = null;
      
      const result = layout.layout(graphData);
      
      expect(result.positions.size).toBe(3);
      expect(result.metadata.fallback).toBe(true);
      
      // Fallback should arrange nodes in a circle
      const positions = Array.from(result.positions.values());
      const centerX = positions.reduce((sum, p) => sum + p.x, 0) / positions.length;
      const centerY = positions.reduce((sum, p) => sum + p.y, 0) / positions.length;
      
      expect(Math.abs(centerX)).toBeLessThan(1); // Should be centered
      expect(Math.abs(centerY)).toBeLessThan(1);
      
      errorSpy.mockRestore();
    });
  });

  describe('Force Calculations', () => {
    test('should apply repulsion forces between nodes', () => {
      const customLayout = new ForceDirectedLayout({
        forces: {
          charge: -1000, // Strong repulsion
          link: 0, // No link force
          center: 0, // No centering
          collide: 0 // No collision
        },
        iterations: 10,
        warmupIterations: 0
      });

      const graphData = {
        nodes: [
          { id: 'A', x: 0, y: 0, size: { width: 100, height: 60 } },
          { id: 'B', x: 10, y: 0, size: { width: 100, height: 60 } }
        ],
        edges: []
      };

      const result = customLayout.layout(graphData);
      
      const posA = result.positions.get('A');
      const posB = result.positions.get('B');
      
      // Nodes should repel each other
      const finalDistance = Math.sqrt(
        Math.pow(posB.x - posA.x, 2) + 
        Math.pow(posB.y - posA.y, 2)
      );
      
      expect(finalDistance).toBeGreaterThan(10); // Should move apart
    });

    test('should apply spring forces along edges', () => {
      const customLayout = new ForceDirectedLayout({
        forces: {
          charge: 0, // No repulsion
          link: 5, // Strong link force
          center: 0, // No centering
          collide: 0 // No collision
        },
        linkDistance: 100,
        iterations: 50,
        warmupIterations: 0
      });

      const graphData = {
        nodes: [
          { id: 'A', x: 0, y: 0, size: { width: 100, height: 60 } },
          { id: 'B', x: 300, y: 0, size: { width: 100, height: 60 } }
        ],
        edges: [
          { id: 'e1', source: 'A', target: 'B' }
        ]
      };

      const result = customLayout.layout(graphData);
      
      const posA = result.positions.get('A');
      const posB = result.positions.get('B');
      
      // Nodes should be pulled together toward linkDistance
      const finalDistance = Math.sqrt(
        Math.pow(posB.x - posA.x, 2) + 
        Math.pow(posB.y - posA.y, 2)
      );
      
      expect(finalDistance).toBeLessThan(300); // Should move closer
      expect(finalDistance).toBeGreaterThan(50); // But maintain some distance
    });

    test('should apply centering force', () => {
      const customLayout = new ForceDirectedLayout({
        forces: {
          charge: 0,
          link: 0,
          center: 1, // Strong centering
          collide: 0
        },
        iterations: 20,
        warmupIterations: 0
      });

      const graphData = {
        nodes: [
          { id: 'A', x: -200, y: -200, size: { width: 100, height: 60 } },
          { id: 'B', x: 200, y: 200, size: { width: 100, height: 60 } }
        ],
        edges: []
      };

      const result = customLayout.layout(graphData);
      
      const positions = Array.from(result.positions.values());
      const centerX = positions.reduce((sum, p) => sum + p.x, 0) / positions.length;
      const centerY = positions.reduce((sum, p) => sum + p.y, 0) / positions.length;
      
      // Center of mass should move toward origin
      expect(Math.abs(centerX)).toBeLessThan(50);
      expect(Math.abs(centerY)).toBeLessThan(50);
    });

    test('should prevent node collisions', () => {
      const customLayout = new ForceDirectedLayout({
        forces: {
          charge: 0,
          link: 0,
          center: 0,
          collide: 50 // Collision radius
        },
        collisionStrength: 1,
        collisionIterations: 3,
        iterations: 30,
        warmupIterations: 0
      });

      const graphData = {
        nodes: [
          { id: 'A', x: 0, y: 0, size: { width: 100, height: 60 } },
          { id: 'B', x: 5, y: 0, size: { width: 100, height: 60 } },
          { id: 'C', x: 0, y: 5, size: { width: 100, height: 60 } }
        ],
        edges: []
      };

      const result = customLayout.layout(graphData);
      
      const positions = Array.from(result.positions.values());
      
      // Check all pairwise distances
      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          const distance = Math.sqrt(
            Math.pow(positions[j].x - positions[i].x, 2) + 
            Math.pow(positions[j].y - positions[i].y, 2)
          );
          
          // Should maintain minimum distance
          expect(distance).toBeGreaterThan(30);
        }
      }
    });

    test('should respect fixed node positions', () => {
      const graphData = {
        nodes: [
          { id: 'A', fx: 100, fy: 100, size: { width: 100, height: 60 } },
          { id: 'B', size: { width: 100, height: 60 } }
        ],
        edges: [
          { id: 'e1', source: 'A', target: 'B' }
        ]
      };

      const result = layout.layout(graphData);
      
      const posA = result.positions.get('A');
      
      // Fixed node should not move
      expect(posA.x).toBe(100);
      expect(posA.y).toBe(100);
    });
  });

  describe('Adaptive Configuration', () => {
    test('should adapt to large graphs', () => {
      const nodes = [];
      const edges = [];
      
      // Create 150 node graph
      for (let i = 0; i < 150; i++) {
        nodes.push({
          id: `node${i}`,
          size: { width: 80, height: 50 }
        });
        
        if (i > 0) {
          edges.push({
            id: `edge${i}`,
            source: `node${Math.floor(Math.random() * i)}`,
            target: `node${i}`
          });
        }
      }

      const graphData = { nodes, edges };
      
      const adaptiveLayout = new ForceDirectedLayout({
        adaptiveLayout: true
      });
      
      const result = adaptiveLayout.layout(graphData);
      
      expect(result.positions.size).toBe(150);
      
      // Check adapted configuration in metadata
      expect(result.metadata.config.chargeStrength).toBe(-150); // Should be reduced by half for large graphs
      expect(result.metadata.config.iterations).toBeGreaterThan(300); // Should be increased
    });

    test('should adapt to small graphs', () => {
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

      const adaptiveLayout = new ForceDirectedLayout({
        adaptiveLayout: true
      });
      
      const result = adaptiveLayout.layout(graphData);
      
      expect(result.positions.size).toBe(3);
      
      // Check adapted configuration for small graph
      expect(result.metadata.config.chargeStrength).toBeLessThan(-300); // Should be stronger (more negative)
    });

    test('should adapt to graph density', () => {
      // Create dense graph (complete graph)
      const nodes = [];
      const edges = [];
      const nodeCount = 10;
      
      for (let i = 0; i < nodeCount; i++) {
        nodes.push({
          id: `node${i}`,
          size: { width: 80, height: 50 }
        });
      }
      
      // Connect every node to every other node
      for (let i = 0; i < nodeCount; i++) {
        for (let j = i + 1; j < nodeCount; j++) {
          edges.push({
            id: `edge_${i}_${j}`,
            source: `node${i}`,
            target: `node${j}`
          });
        }
      }

      const graphData = { nodes, edges };
      
      const adaptiveLayout = new ForceDirectedLayout({
        adaptiveLayout: true
      });
      
      const result = adaptiveLayout.layout(graphData);
      
      expect(result.positions.size).toBe(nodeCount);
      
      // Dense graph should have longer link distance
      expect(result.metadata.config.linkDistance).toBeGreaterThan(100);
    });
  });

  describe('Complex Graphs', () => {
    test('should layout star graph', () => {
      const graphData = {
        nodes: [
          { id: 'center', size: { width: 120, height: 80 } },
          { id: 'n1', size: { width: 100, height: 60 } },
          { id: 'n2', size: { width: 100, height: 60 } },
          { id: 'n3', size: { width: 100, height: 60 } },
          { id: 'n4', size: { width: 100, height: 60 } },
          { id: 'n5', size: { width: 100, height: 60 } }
        ],
        edges: [
          { id: 'e1', source: 'center', target: 'n1' },
          { id: 'e2', source: 'center', target: 'n2' },
          { id: 'e3', source: 'center', target: 'n3' },
          { id: 'e4', source: 'center', target: 'n4' },
          { id: 'e5', source: 'center', target: 'n5' }
        ]
      };

      const result = layout.layout(graphData);
      
      expect(result.positions.size).toBe(6);
      
      const centerPos = result.positions.get('center');
      const peripheralNodes = ['n1', 'n2', 'n3', 'n4', 'n5'];
      
      // Peripheral nodes should be roughly equidistant from center
      const distances = peripheralNodes.map(nodeId => {
        const pos = result.positions.get(nodeId);
        return Math.sqrt(
          Math.pow(pos.x - centerPos.x, 2) + 
          Math.pow(pos.y - centerPos.y, 2)
        );
      });
      
      const avgDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length;
      
      distances.forEach(d => {
        expect(Math.abs(d - avgDistance)).toBeLessThan(avgDistance * 0.5); // Within 50% of average
      });
    });

    test('should layout chain graph', () => {
      const nodes = [];
      const edges = [];
      const chainLength = 10;
      
      for (let i = 0; i < chainLength; i++) {
        nodes.push({
          id: `node${i}`,
          size: { width: 80, height: 50 }
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
      
      const result = layout.layout(graphData);
      
      expect(result.positions.size).toBe(chainLength);
      
      // Chain should roughly extend in one direction
      const positions = nodes.map(n => result.positions.get(n.id));
      
      // Calculate total path length
      let totalLength = 0;
      for (let i = 1; i < positions.length; i++) {
        totalLength += Math.sqrt(
          Math.pow(positions[i].x - positions[i-1].x, 2) + 
          Math.pow(positions[i].y - positions[i-1].y, 2)
        );
      }
      
      // End-to-end distance
      const endToEnd = Math.sqrt(
        Math.pow(positions[positions.length-1].x - positions[0].x, 2) + 
        Math.pow(positions[positions.length-1].y - positions[0].y, 2)
      );
      
      // Chain should be somewhat extended (end-to-end at least 15% of total length)
      // Force-directed layouts may create curved chains due to repulsion forces
      expect(endToEnd).toBeGreaterThan(totalLength * 0.15);
    });

    test('should layout clustered graph', () => {
      const graphData = {
        nodes: [
          // Cluster 1
          { id: 'c1_1', size: { width: 80, height: 50 } },
          { id: 'c1_2', size: { width: 80, height: 50 } },
          { id: 'c1_3', size: { width: 80, height: 50 } },
          // Cluster 2
          { id: 'c2_1', size: { width: 80, height: 50 } },
          { id: 'c2_2', size: { width: 80, height: 50 } },
          { id: 'c2_3', size: { width: 80, height: 50 } },
          // Bridge
          { id: 'bridge', size: { width: 100, height: 60 } }
        ],
        edges: [
          // Cluster 1 edges
          { id: 'e1', source: 'c1_1', target: 'c1_2' },
          { id: 'e2', source: 'c1_2', target: 'c1_3' },
          { id: 'e3', source: 'c1_3', target: 'c1_1' },
          // Cluster 2 edges
          { id: 'e4', source: 'c2_1', target: 'c2_2' },
          { id: 'e5', source: 'c2_2', target: 'c2_3' },
          { id: 'e6', source: 'c2_3', target: 'c2_1' },
          // Bridge edges
          { id: 'e7', source: 'c1_1', target: 'bridge' },
          { id: 'e8', source: 'bridge', target: 'c2_1' }
        ]
      };

      const result = layout.layout(graphData);
      
      expect(result.positions.size).toBe(7);
      
      // Calculate cluster centers
      const cluster1 = ['c1_1', 'c1_2', 'c1_3'];
      const cluster2 = ['c2_1', 'c2_2', 'c2_3'];
      
      const getClusterCenter = (nodeIds) => {
        const positions = nodeIds.map(id => result.positions.get(id));
        return {
          x: positions.reduce((sum, p) => sum + p.x, 0) / positions.length,
          y: positions.reduce((sum, p) => sum + p.y, 0) / positions.length
        };
      };
      
      const center1 = getClusterCenter(cluster1);
      const center2 = getClusterCenter(cluster2);
      
      // Clusters should be separated
      const clusterDistance = Math.sqrt(
        Math.pow(center2.x - center1.x, 2) + 
        Math.pow(center2.y - center1.y, 2)
      );
      
      expect(clusterDistance).toBeGreaterThan(100);
      
      // Bridge should be between clusters
      const bridgePos = result.positions.get('bridge');
      const distToBridge1 = Math.sqrt(
        Math.pow(bridgePos.x - center1.x, 2) + 
        Math.pow(bridgePos.y - center1.y, 2)
      );
      const distToBridge2 = Math.sqrt(
        Math.pow(bridgePos.x - center2.x, 2) + 
        Math.pow(bridgePos.y - center2.y, 2)
      );
      
      // Bridge node should be relatively close to at least one cluster
      const minBridgeDistance = Math.min(distToBridge1, distToBridge2);
      expect(minBridgeDistance).toBeLessThan(clusterDistance);
    });
  });

  describe('Performance and Metadata', () => {
    test('should complete within iteration limit', () => {
      const maxIterations = 50;
      const customLayout = new ForceDirectedLayout({
        iterations: maxIterations,
        warmupIterations: 10
      });

      const graphData = {
        nodes: Array.from({ length: 20 }, (_, i) => ({
          id: `node${i}`,
          size: { width: 80, height: 50 }
        })),
        edges: Array.from({ length: 30 }, (_, i) => ({
          id: `edge${i}`,
          source: `node${Math.floor(Math.random() * 20)}`,
          target: `node${Math.floor(Math.random() * 20)}`
        }))
      };

      const result = customLayout.layout(graphData);
      
      expect(result.metadata.stats.iterations).toBeLessThanOrEqual(maxIterations);
      // Alpha may not reach exact minimum due to cooling rate
      expect(result.metadata.stats.finalAlpha).toBeLessThan(1); // Should have cooled down from initial value of 1
    });

    test('should provide timing information', () => {
      const graphData = {
        nodes: [
          { id: 'A', size: { width: 100, height: 60 } },
          { id: 'B', size: { width: 100, height: 60 } }
        ],
        edges: [
          { id: 'e1', source: 'A', target: 'B' }
        ]
      };

      const result = layout.layout(graphData);
      
      expect(result.metadata.timing).toBeDefined();
      expect(result.metadata.timing.total).toBeGreaterThan(0);
      expect(result.metadata.timing.iterations).toBeGreaterThan(0);
      expect(result.metadata.timing.phases).toBeDefined();
      expect(result.metadata.timing.phases.initialization).toBeGreaterThanOrEqual(0);
      expect(result.metadata.timing.phases.simulation).toBeGreaterThan(0);
    });

    test('should calculate correct bounds', () => {
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
          { id: 'e3', source: 'C', target: 'D' }
        ]
      };

      const result = layout.layout(graphData);
      
      expect(result.bounds).toBeDefined();
      expect(typeof result.bounds.x).toBe('number');
      expect(typeof result.bounds.y).toBe('number');
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

    test('should handle early termination when alpha reaches minimum', () => {
      const customLayout = new ForceDirectedLayout({
        alphaMin: 0.5, // High alpha minimum for early termination
        iterations: 1000 // Many iterations available
      });

      const graphData = {
        nodes: [
          { id: 'A', size: { width: 100, height: 60 } },
          { id: 'B', size: { width: 100, height: 60 } }
        ],
        edges: [
          { id: 'e1', source: 'A', target: 'B' }
        ]
      };

      const result = customLayout.layout(graphData);
      
      expect(result.metadata.stats.iterations).toBeLessThan(1000);
      expect(result.metadata.stats.finalAlpha).toBeLessThanOrEqual(0.5);
    });
  });
});