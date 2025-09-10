/**
 * Unit tests for DiagramLayoutEngine constraint integration
 * Tests the integration of LayoutConstraints with the main layout engine
 */

import { jest } from '@jest/globals';
import { DiagramLayoutEngine } from '../../../../src/renderers/diagram/layout/DiagramLayoutEngine.js';

describe('DiagramLayoutEngine Constraint Integration', () => {
  let engine;

  beforeEach(() => {
    engine = new DiagramLayoutEngine();
  });

  afterEach(() => {
    if (engine) {
      engine.destroy();
      engine = null;
    }
  });

  describe('Basic Constraint Integration', () => {
    test('should initialize with constraint system enabled by default', () => {
      expect(engine.constraints).toBeDefined();
      expect(engine.config.constraints.enforceConstraints).toBe(true);
      expect(engine.config.constraints.maxIterations).toBe(10);
      expect(engine.config.constraints.tolerance).toBe(1.0);
    });

    test('should allow disabling constraint enforcement', () => {
      const disabledEngine = new DiagramLayoutEngine({
        constraints: {
          enforceConstraints: false
        }
      });

      expect(disabledEngine.config.constraints.enforceConstraints).toBe(false);
      disabledEngine.destroy();
    });

    test('should accept custom constraint configuration', () => {
      const customEngine = new DiagramLayoutEngine({
        constraints: {
          enforceConstraints: true,
          allowPartialViolations: true,
          constraintPriority: 'high',
          maxIterations: 20,
          tolerance: 0.5
        }
      });

      expect(customEngine.config.constraints.enforceConstraints).toBe(true);
      expect(customEngine.config.constraints.allowPartialViolations).toBe(true);
      expect(customEngine.config.constraints.constraintPriority).toBe('high');
      expect(customEngine.config.constraints.maxIterations).toBe(20);
      expect(customEngine.config.constraints.tolerance).toBe(0.5);
      
      customEngine.destroy();
    });
  });

  describe('Position Constraint Integration', () => {
    test('should apply position constraints after layout', () => {
      const graphData = {
        nodes: [
          { id: 'A', size: { width: 100, height: 60 } },
          { id: 'B', size: { width: 100, height: 60 } }
        ],
        edges: [
          { id: 'e1', source: 'A', target: 'B' }
        ]
      };

      // Add a position constraint before layout
      engine.constraints.addPositionConstraint('A', {
        fixedPosition: { x: 250, y: 150 },
        priority: 'high'
      });

      const result = engine.compute(graphData);
      
      expect(result.positions.get('A')).toEqual({ x: 250, y: 150 });
      expect(result.metadata.constraints).toBeDefined();
      expect(result.metadata.constraints.totalConstraints).toBe(1);
      expect(result.metadata.constraints.stats.constraintsApplied).toBeGreaterThan(0);
    });

    test('should handle boundary position constraints', () => {
      const graphData = {
        nodes: [
          { id: 'A', size: { width: 100, height: 60 } },
          { id: 'B', size: { width: 100, height: 60 } }
        ],
        edges: [
          { id: 'e1', source: 'A', target: 'B' }
        ]
      };

      engine.constraints.addPositionConstraint('A', {
        bounds: { minX: 0, maxX: 200, minY: 0, maxY: 100 }
      });

      const result = engine.compute(graphData);
      
      const posA = result.positions.get('A');
      expect(posA.x).toBeGreaterThanOrEqual(0);
      expect(posA.x).toBeLessThanOrEqual(200);
      expect(posA.y).toBeGreaterThanOrEqual(0);
      expect(posA.y).toBeLessThanOrEqual(100);
    });

    test('should respect constraint priorities', () => {
      const graphData = {
        nodes: [
          { id: 'A', size: { width: 100, height: 60 } }
        ],
        edges: []
      };

      // Add two conflicting position constraints with different priorities
      engine.constraints.addPositionConstraint('A', {
        fixedPosition: { x: 100, y: 100 },
        priority: 'low'
      });

      engine.constraints.addPositionConstraint('A', {
        fixedPosition: { x: 200, y: 200 },
        priority: 'high'
      });

      const result = engine.compute(graphData);
      
      // High priority constraint should be closer to winning position
      const finalPos = result.positions.get('A');
      const distanceToHigh = Math.sqrt(Math.pow(finalPos.x - 200, 2) + Math.pow(finalPos.y - 200, 2));
      const distanceToLow = Math.sqrt(Math.pow(finalPos.x - 100, 2) + Math.pow(finalPos.y - 100, 2));
      
      expect(distanceToHigh).toBeLessThanOrEqual(distanceToLow);
    });
  });

  describe('Alignment Constraint Integration', () => {
    test('should apply horizontal alignment constraints', () => {
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

      engine.constraints.addAlignmentConstraint(['A', 'B', 'C'], {
        alignment: 'horizontal',
        priority: 'high'
      });

      const result = engine.compute(graphData);
      
      const posA = result.positions.get('A');
      const posB = result.positions.get('B');
      const posC = result.positions.get('C');

      // All nodes should have approximately the same Y coordinate
      expect(Math.abs(posA.y - posB.y)).toBeLessThan(2);
      expect(Math.abs(posB.y - posC.y)).toBeLessThan(2);
      expect(Math.abs(posA.y - posC.y)).toBeLessThan(2);
    });

    test('should apply vertical alignment constraints', () => {
      const graphData = {
        nodes: [
          { id: 'A', size: { width: 100, height: 60 } },
          { id: 'B', size: { width: 100, height: 60 } }
        ],
        edges: []
      };

      engine.constraints.addAlignmentConstraint(['A', 'B'], {
        alignment: 'vertical',
        priority: 'medium'
      });

      const result = engine.compute(graphData);
      
      const posA = result.positions.get('A');
      const posB = result.positions.get('B');

      // Both nodes should have approximately the same X coordinate
      expect(Math.abs(posA.x - posB.x)).toBeLessThan(2);
    });
  });

  describe('Spacing Constraint Integration', () => {
    test('should enforce minimum distance constraints', () => {
      const graphData = {
        nodes: [
          { id: 'A', size: { width: 100, height: 60 } },
          { id: 'B', size: { width: 100, height: 60 } }
        ],
        edges: [
          { id: 'e1', source: 'A', target: 'B' }
        ]
      };

      const minDistance = 200;
      engine.constraints.addSpacingConstraint('A', 'B', {
        minDistance: minDistance
      });

      const result = engine.compute(graphData);
      
      const posA = result.positions.get('A');
      const posB = result.positions.get('B');
      const actualDistance = Math.sqrt(
        Math.pow(posB.x - posA.x, 2) + Math.pow(posB.y - posA.y, 2)
      );

      expect(actualDistance).toBeGreaterThanOrEqual(minDistance - 5); // Allow small tolerance
    });

    test('should enforce maximum distance constraints', () => {
      const graphData = {
        nodes: [
          { id: 'A', size: { width: 100, height: 60 } },
          { id: 'B', size: { width: 100, height: 60 } }
        ],
        edges: [
          { id: 'e1', source: 'A', target: 'B' }
        ]
      };

      const maxDistance = 150;
      engine.constraints.addSpacingConstraint('A', 'B', {
        maxDistance: maxDistance
      });

      const result = engine.compute(graphData);
      
      const posA = result.positions.get('A');
      const posB = result.positions.get('B');
      const actualDistance = Math.sqrt(
        Math.pow(posB.x - posA.x, 2) + Math.pow(posB.y - posA.y, 2)
      );

      expect(actualDistance).toBeLessThanOrEqual(maxDistance + 5); // Allow small tolerance
    });
  });

  describe('Grouping Constraint Integration', () => {
    test('should apply cluster grouping constraints', () => {
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

      engine.constraints.addGroupingConstraint(['A', 'B'], {
        groupType: 'cluster',
        padding: 50
      });

      const result = engine.compute(graphData);
      
      const posA = result.positions.get('A');
      const posB = result.positions.get('B');
      const posC = result.positions.get('C');

      // A and B should be closer to each other than to C
      const distanceAB = Math.sqrt(Math.pow(posB.x - posA.x, 2) + Math.pow(posB.y - posA.y, 2));
      const distanceAC = Math.sqrt(Math.pow(posC.x - posA.x, 2) + Math.pow(posC.y - posA.y, 2));
      const distanceBC = Math.sqrt(Math.pow(posC.x - posB.x, 2) + Math.pow(posC.y - posB.y, 2));

      expect(distanceAB).toBeLessThan(Math.min(distanceAC, distanceBC));
    });

    test('should apply separate grouping constraints', () => {
      const graphData = {
        nodes: [
          { id: 'A', size: { width: 100, height: 60 } },
          { id: 'B', size: { width: 100, height: 60 } }
        ],
        edges: []
      };

      const minSeparation = 150;
      engine.constraints.addGroupingConstraint(['A', 'B'], {
        groupType: 'separate',
        padding: minSeparation
      });

      const result = engine.compute(graphData);
      
      const posA = result.positions.get('A');
      const posB = result.positions.get('B');
      const distance = Math.sqrt(
        Math.pow(posB.x - posA.x, 2) + Math.pow(posB.y - posA.y, 2)
      );

      expect(distance).toBeGreaterThanOrEqual(minSeparation - 10); // Allow small tolerance
    });
  });

  describe('Complex Multi-Constraint Scenarios', () => {
    test('should handle multiple constraint types simultaneously', () => {
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

      // Mix different constraint types
      engine.constraints.addPositionConstraint('A', {
        fixedPosition: { x: 0, y: 0 },
        priority: 'high'
      });

      engine.constraints.addAlignmentConstraint(['B', 'C'], {
        alignment: 'horizontal',
        priority: 'medium'
      });

      engine.constraints.addSpacingConstraint('C', 'D', {
        minDistance: 120,
        priority: 'medium'
      });

      const result = engine.compute(graphData);
      
      // Check that all constraints are reflected in the result
      expect(result.positions.get('A')).toEqual({ x: 0, y: 0 });
      
      const posB = result.positions.get('B');
      const posC = result.positions.get('C');
      expect(Math.abs(posB.y - posC.y)).toBeLessThan(5);
      
      const posD = result.positions.get('D');
      const distanceCD = Math.sqrt(
        Math.pow(posD.x - posC.x, 2) + Math.pow(posD.y - posC.y, 2)
      );
      expect(distanceCD).toBeGreaterThanOrEqual(115); // Allow tolerance

      expect(result.metadata.constraints.totalConstraints).toBe(3);
    });

    test('should handle conflicting constraints gracefully', () => {
      const graphData = {
        nodes: [
          { id: 'A', size: { width: 100, height: 60 } },
          { id: 'B', size: { width: 100, height: 60 } }
        ],
        edges: [
          { id: 'e1', source: 'A', target: 'B' }
        ]
      };

      // Add conflicting constraints
      engine.constraints.addPositionConstraint('A', {
        fixedPosition: { x: 0, y: 0 },
        priority: 'high'
      });

      engine.constraints.addSpacingConstraint('A', 'B', {
        maxDistance: 50, // This may conflict with layout
        priority: 'medium'
      });

      engine.constraints.addPositionConstraint('B', {
        fixedPosition: { x: 200, y: 0 }, // Too far for maxDistance
        priority: 'high'
      });

      // Should not throw error, but handle gracefully
      expect(() => {
        const result = engine.compute(graphData);
        expect(result.positions.size).toBe(2);
        expect(result.metadata.constraints.totalConstraints).toBe(3);
      }).not.toThrow();
    });
  });

  describe('Constraint Performance and Iteration Control', () => {
    test('should respect maxIterations limit', () => {
      const constrainedEngine = new DiagramLayoutEngine({
        constraints: {
          maxIterations: 3
        }
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

      constrainedEngine.constraints.addPositionConstraint('A', {
        fixedPosition: { x: 100, y: 100 }
      });

      const result = constrainedEngine.compute(graphData);
      
      expect(result.metadata.constraints.stats.iterationsUsed).toBeLessThanOrEqual(3);
      constrainedEngine.destroy();
    });

    test('should provide performance statistics', () => {
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

      engine.constraints.addPositionConstraint('A', { fixedPosition: { x: 0, y: 0 } });
      engine.constraints.addAlignmentConstraint(['B', 'C'], { alignment: 'horizontal' });

      const result = engine.compute(graphData);
      
      expect(result.metadata.constraints.stats).toBeDefined();
      expect(result.metadata.constraints.stats.constraintsApplied).toBeGreaterThan(0);
      expect(result.metadata.constraints.stats.iterationsUsed).toBeGreaterThan(0);
      expect(result.metadata.constraints.stats.processingTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Constraint System Integration with Different Algorithms', () => {
    test('should work with dagre algorithm', () => {
      const dagreEngine = new DiagramLayoutEngine({
        algorithm: 'dagre'
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

      dagreEngine.constraints.addPositionConstraint('A', {
        fixedPosition: { x: 150, y: 75 }
      });

      const result = dagreEngine.compute(graphData);
      
      expect(result.positions.get('A')).toEqual({ x: 150, y: 75 });
      expect(result.metadata.constraints).toBeDefined();
      
      dagreEngine.destroy();
    });

    test('should work with hierarchical fallback algorithm', () => {
      const fallbackEngine = new DiagramLayoutEngine({
        algorithm: 'hierarchical'
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

      fallbackEngine.constraints.addAlignmentConstraint(['A', 'B'], {
        alignment: 'vertical'
      });

      const result = fallbackEngine.compute(graphData);
      
      const posA = result.positions.get('A');
      const posB = result.positions.get('B');
      expect(Math.abs(posA.x - posB.x)).toBeLessThan(2);
      
      fallbackEngine.destroy();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle empty constraint set', () => {
      const graphData = {
        nodes: [
          { id: 'A', size: { width: 100, height: 60 } }
        ],
        edges: []
      };

      const result = engine.compute(graphData);
      
      expect(result.positions.size).toBe(1);
      expect(result.metadata.constraints.totalConstraints).toBe(0);
    });

    test('should handle constraints on non-existent nodes', () => {
      const graphData = {
        nodes: [
          { id: 'A', size: { width: 100, height: 60 } }
        ],
        edges: []
      };

      engine.constraints.addPositionConstraint('nonexistent', {
        fixedPosition: { x: 100, y: 100 }
      });

      expect(() => {
        const result = engine.compute(graphData);
        expect(result.positions.size).toBe(1);
      }).not.toThrow();
    });

    test('should handle disabled constraint enforcement', () => {
      const disabledEngine = new DiagramLayoutEngine({
        constraints: {
          enforceConstraints: false
        }
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

      disabledEngine.constraints.addPositionConstraint('A', {
        fixedPosition: { x: 999, y: 999 } // Should be ignored
      });

      const result = disabledEngine.compute(graphData);
      
      // Position should not be the constrained one
      expect(result.positions.get('A')).not.toEqual({ x: 999, y: 999 });
      
      disabledEngine.destroy();
    });
  });
});