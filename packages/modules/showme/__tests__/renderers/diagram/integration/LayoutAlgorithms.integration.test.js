/**
 * Integration tests for all layout algorithms
 * Tests that different layout algorithms can be used interchangeably
 */

import { jest } from '@jest/globals';
import { DagreLayoutAlgorithm } from '../../../../src/renderers/diagram/layout/DagreLayoutAlgorithm.js';
import { ForceDirectedLayout } from '../../../../src/renderers/diagram/layout/ForceDirectedLayout.js';
import { EnhancedForceDirectedLayout } from '../../../../src/renderers/diagram/layout/ForceDirectedLayout.enhanced.js';

describe('Layout Algorithms Integration', () => {
  const testGraphData = {
    nodes: [
      { id: 'A', size: { width: 100, height: 60 } },
      { id: 'B', size: { width: 100, height: 60 } },
      { id: 'C', size: { width: 100, height: 60 } },
      { id: 'D', size: { width: 100, height: 60 } },
      { id: 'E', size: { width: 100, height: 60 } }
    ],
    edges: [
      { id: 'e1', source: 'A', target: 'B' },
      { id: 'e2', source: 'A', target: 'C' },
      { id: 'e3', source: 'B', target: 'D' },
      { id: 'e4', source: 'C', target: 'E' },
      { id: 'e5', source: 'D', target: 'E' }
    ]
  };

  describe('Common Interface', () => {
    test('all layout algorithms should have layout() method', () => {
      const dagre = new DagreLayoutAlgorithm();
      const force = new ForceDirectedLayout();
      const enhanced = new EnhancedForceDirectedLayout();
      
      expect(typeof dagre.layout).toBe('function');
      expect(typeof force.layout).toBe('function');
      expect(typeof enhanced.layout).toBe('function');
    });

    test('all layout algorithms should return consistent result structure', () => {
      const algorithms = [
        new DagreLayoutAlgorithm(),
        new ForceDirectedLayout({ iterations: 50 }),
        new EnhancedForceDirectedLayout({ iterations: 50 })
      ];

      algorithms.forEach((algorithm, index) => {
        const result = algorithm.layout(testGraphData);
        
        // Common result structure
        expect(result).toHaveProperty('positions');
        expect(result).toHaveProperty('bounds');
        expect(result).toHaveProperty('metadata');
        
        // Positions should be a Map
        expect(result.positions).toBeInstanceOf(Map);
        expect(result.positions.size).toBe(5);
        
        // All nodes should have positions
        testGraphData.nodes.forEach(node => {
          expect(result.positions.has(node.id)).toBe(true);
          const pos = result.positions.get(node.id);
          expect(typeof pos.x).toBe('number');
          expect(typeof pos.y).toBe('number');
          expect(isFinite(pos.x)).toBe(true);
          expect(isFinite(pos.y)).toBe(true);
        });
        
        // Bounds should be defined
        expect(typeof result.bounds.x).toBe('number');
        expect(typeof result.bounds.y).toBe('number');
        expect(result.bounds.width).toBeGreaterThan(0);
        expect(result.bounds.height).toBeGreaterThan(0);
        
        // Metadata should contain algorithm info
        expect(result.metadata).toBeDefined();
        expect(result.metadata.algorithm).toBeDefined();
      });
    });
  });

  describe('Algorithm Comparison', () => {
    test('Dagre should produce hierarchical layout', () => {
      const dagre = new DagreLayoutAlgorithm();
      const result = dagre.layout(testGraphData);
      
      // In a hierarchical layout, A should be at the top
      const posA = result.positions.get('A');
      const posB = result.positions.get('B');
      const posC = result.positions.get('C');
      
      // A should be above B and C (smaller y value in top-to-bottom layout)
      expect(posA.y).toBeLessThan(posB.y);
      expect(posA.y).toBeLessThan(posC.y);
      
      expect(result.metadata.algorithm).toBe('dagre');
    });

    test('Force-directed should minimize edge crossings', () => {
      const force = new ForceDirectedLayout({
        iterations: 100,
        forces: {
          charge: -500,
          link: 2
        }
      });
      const result = force.layout(testGraphData);
      
      // Force-directed layouts should spread nodes
      const positions = Array.from(result.positions.values());
      let totalDistance = 0;
      let count = 0;
      
      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          const dist = Math.sqrt(
            Math.pow(positions[j].x - positions[i].x, 2) +
            Math.pow(positions[j].y - positions[i].y, 2)
          );
          totalDistance += dist;
          count++;
        }
      }
      
      const avgDistance = totalDistance / count;
      expect(avgDistance).toBeGreaterThan(50); // Nodes should be spread out
      
      expect(result.metadata.algorithm).toBe('force-directed');
    });

    test('Enhanced force-directed should support hierarchical mode', () => {
      const enhanced = new EnhancedForceDirectedLayout({
        iterations: 100,
        enhancedForces: {
          hierarchical: true,
          hierarchyStrength: 0.5,
          hierarchyDirection: 'vertical'
        }
      });
      
      const result = enhanced.layout(testGraphData);
      
      // Should still produce valid layout
      expect(result.positions.size).toBe(5);
      expect(result.metadata.algorithm).toBe('force-directed');
      
      // Enhanced features should be in config
      expect(result.metadata.config.enhancedForces).toBeDefined();
      expect(result.metadata.config.enhancedForces.hierarchical).toBe(true);
    });
  });

  describe('Performance Comparison', () => {
    test('should complete layouts within reasonable time', () => {
      const largeGraph = {
        nodes: [],
        edges: []
      };
      
      // Create a larger graph (50 nodes)
      for (let i = 0; i < 50; i++) {
        largeGraph.nodes.push({
          id: `node${i}`,
          size: { width: 80, height: 50 }
        });
        
        if (i > 0) {
          // Create tree structure
          const parentIndex = Math.floor((i - 1) / 2);
          largeGraph.edges.push({
            id: `edge${i}`,
            source: `node${parentIndex}`,
            target: `node${i}`
          });
        }
      }
      
      const algorithms = [
        { name: 'Dagre', instance: new DagreLayoutAlgorithm() },
        { name: 'Force-Directed', instance: new ForceDirectedLayout({ iterations: 50 }) },
        { name: 'Enhanced Force', instance: new EnhancedForceDirectedLayout({ 
          iterations: 50,
          enhancedForces: { useBarnesHut: true }
        })}
      ];
      
      algorithms.forEach(({ name, instance }) => {
        const startTime = performance.now();
        const result = instance.layout(largeGraph);
        const endTime = performance.now();
        
        expect(result.positions.size).toBe(50);
        expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
        
        console.log(`${name} completed in ${(endTime - startTime).toFixed(2)}ms`);
      });
    });
  });

  describe('Edge Cases', () => {
    test('all algorithms should handle empty graph', () => {
      const emptyGraph = { nodes: [], edges: [] };
      
      const algorithms = [
        new DagreLayoutAlgorithm(),
        new ForceDirectedLayout(),
        new EnhancedForceDirectedLayout()
      ];
      
      algorithms.forEach(algorithm => {
        const result = algorithm.layout(emptyGraph);
        expect(result.positions.size).toBe(0);
        expect(result.metadata).toBeDefined();
      });
    });

    test('all algorithms should handle single node', () => {
      const singleNode = {
        nodes: [{ id: 'single', size: { width: 100, height: 60 } }],
        edges: []
      };
      
      const algorithms = [
        new DagreLayoutAlgorithm(),
        new ForceDirectedLayout(),
        new EnhancedForceDirectedLayout()
      ];
      
      algorithms.forEach(algorithm => {
        const result = algorithm.layout(singleNode);
        expect(result.positions.size).toBe(1);
        expect(result.positions.has('single')).toBe(true);
        
        const pos = result.positions.get('single');
        expect(isFinite(pos.x)).toBe(true);
        expect(isFinite(pos.y)).toBe(true);
      });
    });

    test('all algorithms should handle disconnected components', () => {
      const disconnected = {
        nodes: [
          { id: 'A1', size: { width: 100, height: 60 } },
          { id: 'B1', size: { width: 100, height: 60 } },
          { id: 'A2', size: { width: 100, height: 60 } },
          { id: 'B2', size: { width: 100, height: 60 } }
        ],
        edges: [
          { id: 'e1', source: 'A1', target: 'B1' },
          { id: 'e2', source: 'A2', target: 'B2' }
        ]
      };
      
      const algorithms = [
        new DagreLayoutAlgorithm(),
        new ForceDirectedLayout({ iterations: 50 }),
        new EnhancedForceDirectedLayout({ iterations: 50 })
      ];
      
      algorithms.forEach(algorithm => {
        const result = algorithm.layout(disconnected);
        expect(result.positions.size).toBe(4);
        
        // All nodes should have valid positions
        result.positions.forEach(pos => {
          expect(isFinite(pos.x)).toBe(true);
          expect(isFinite(pos.y)).toBe(true);
        });
      });
    });
  });
});