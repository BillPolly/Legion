/**
 * Unit tests for LayoutConstraints
 * Tests constraint management and application for diagram layouts
 */

import { jest } from '@jest/globals';
import { LayoutConstraints } from '../../../../src/renderers/diagram/layout/LayoutConstraints.js';

describe('LayoutConstraints', () => {
  let constraints;

  beforeEach(() => {
    constraints = new LayoutConstraints();
  });

  afterEach(() => {
    if (constraints) {
      constraints.clearConstraints();
      constraints = null;
    }
  });

  describe('Basic Functionality', () => {
    test('should create constraints manager with default config', () => {
      expect(constraints).toBeDefined();
      expect(constraints.config.enforceConstraints).toBe(true);
      expect(constraints.config.maxIterations).toBe(10);
      expect(constraints.config.tolerance).toBe(1.0);
    });

    test('should accept custom configuration', () => {
      const customConstraints = new LayoutConstraints({
        enforceConstraints: false,
        maxIterations: 20,
        tolerance: 0.5,
        constraintPriority: 'low'
      });

      expect(customConstraints.config.enforceConstraints).toBe(false);
      expect(customConstraints.config.maxIterations).toBe(20);
      expect(customConstraints.config.tolerance).toBe(0.5);
      expect(customConstraints.config.constraintPriority).toBe('low');
    });

    test('should handle empty constraint application', () => {
      const layoutResult = {
        positions: new Map([
          ['A', { x: 100, y: 50 }],
          ['B', { x: 200, y: 150 }]
        ]),
        bounds: { x: 0, y: 0, width: 300, height: 200 },
        edges: new Map()
      };

      const graphData = {
        nodes: [
          { id: 'A', size: { width: 100, height: 60 } },
          { id: 'B', size: { width: 100, height: 60 } }
        ]
      };

      const result = constraints.applyConstraints(layoutResult, graphData);

      expect(result.positions.get('A')).toEqual({ x: 100, y: 50 });
      expect(result.positions.get('B')).toEqual({ x: 200, y: 150 });
    });

    test('should clear all constraints', () => {
      constraints.addPositionConstraint('A', { fixedPosition: { x: 0, y: 0 } });
      constraints.addAlignmentConstraint(['B', 'C'], { alignment: 'horizontal' });

      expect(constraints.constraints.size).toBe(2);

      constraints.clearConstraints();

      expect(constraints.constraints.size).toBe(0);
      expect(constraints.nodeConstraints.size).toBe(0);
    });
  });

  describe('Position Constraints', () => {
    test('should add fixed position constraint', () => {
      const constraintId = constraints.addPositionConstraint('A', {
        fixedPosition: { x: 100, y: 50 },
        priority: 'high'
      });

      expect(constraintId).toBeDefined();
      expect(constraints.constraints.size).toBe(1);

      const constraint = constraints.constraints.get(constraintId);
      expect(constraint.type).toBe('position');
      expect(constraint.target).toBe('A');
      expect(constraint.fixedPosition).toEqual({ x: 100, y: 50 });
      expect(constraint.priority).toBe('high');
    });

    test('should apply fixed position constraint', () => {
      constraints.addPositionConstraint('A', {
        fixedPosition: { x: 150, y: 75 }
      });

      const layoutResult = {
        positions: new Map([
          ['A', { x: 100, y: 50 }],
          ['B', { x: 200, y: 150 }]
        ]),
        bounds: { x: 0, y: 0, width: 300, height: 200 },
        edges: new Map()
      };

      const graphData = {
        nodes: [
          { id: 'A', size: { width: 100, height: 60 } },
          { id: 'B', size: { width: 100, height: 60 } }
        ]
      };

      const result = constraints.applyConstraints(layoutResult, graphData);

      expect(result.positions.get('A')).toEqual({ x: 150, y: 75 });
      expect(result.positions.get('B')).toEqual({ x: 200, y: 150 });
    });

    test('should add boundary position constraint', () => {
      constraints.addPositionConstraint('A', {
        bounds: { minX: 50, maxX: 250, minY: 25, maxY: 175 }
      });

      const layoutResult = {
        positions: new Map([
          ['A', { x: 300, y: 200 }] // Outside bounds
        ]),
        bounds: { x: 0, y: 0, width: 400, height: 300 },
        edges: new Map()
      };

      const graphData = {
        nodes: [{ id: 'A', size: { width: 100, height: 60 } }]
      };

      const result = constraints.applyConstraints(layoutResult, graphData);

      const adjustedPos = result.positions.get('A');
      expect(adjustedPos.x).toBeLessThanOrEqual(250);
      expect(adjustedPos.y).toBeLessThanOrEqual(175);
    });

    test('should handle tolerance in position constraints', () => {
      constraints.config.tolerance = 5.0;
      
      constraints.addPositionConstraint('A', {
        fixedPosition: { x: 100, y: 50 }
      });

      const layoutResult = {
        positions: new Map([
          ['A', { x: 103, y: 52 }] // Within tolerance
        ]),
        bounds: { x: 0, y: 0, width: 200, height: 100 },
        edges: new Map()
      };

      const graphData = {
        nodes: [{ id: 'A', size: { width: 100, height: 60 } }]
      };

      const result = constraints.applyConstraints(layoutResult, graphData);

      // Should not adjust since within tolerance
      expect(result.positions.get('A')).toEqual({ x: 103, y: 52 });
    });
  });

  describe('Alignment Constraints', () => {
    test('should add horizontal alignment constraint', () => {
      const constraintId = constraints.addAlignmentConstraint(
        ['A', 'B', 'C'],
        { alignment: 'horizontal', priority: 'medium' }
      );

      expect(constraintId).toBeDefined();
      expect(constraints.constraints.size).toBe(1);

      const constraint = constraints.constraints.get(constraintId);
      expect(constraint.type).toBe('alignment');
      expect(constraint.targets).toEqual(['A', 'B', 'C']);
      expect(constraint.alignment).toBe('horizontal');
    });

    test('should apply horizontal alignment constraint', () => {
      constraints.addAlignmentConstraint(['A', 'B'], { alignment: 'horizontal' });

      const layoutResult = {
        positions: new Map([
          ['A', { x: 100, y: 50 }],
          ['B', { x: 200, y: 150 }]
        ]),
        bounds: { x: 0, y: 0, width: 300, height: 200 },
        edges: new Map()
      };

      const graphData = {
        nodes: [
          { id: 'A', size: { width: 100, height: 60 } },
          { id: 'B', size: { width: 100, height: 60 } }
        ]
      };

      const result = constraints.applyConstraints(layoutResult, graphData);

      // Both nodes should have same Y coordinate (average of 50 and 150)
      const posA = result.positions.get('A');
      const posB = result.positions.get('B');
      expect(Math.abs(posA.y - posB.y)).toBeLessThan(1);
      expect(posA.y).toBeCloseTo(100, 0);
      expect(posB.y).toBeCloseTo(100, 0);
    });

    test('should apply vertical alignment constraint', () => {
      constraints.addAlignmentConstraint(['A', 'B'], { alignment: 'vertical' });

      const layoutResult = {
        positions: new Map([
          ['A', { x: 100, y: 50 }],
          ['B', { x: 200, y: 150 }]
        ]),
        bounds: { x: 0, y: 0, width: 300, height: 200 },
        edges: new Map()
      };

      const graphData = {
        nodes: [
          { id: 'A', size: { width: 100, height: 60 } },
          { id: 'B', size: { width: 100, height: 60 } }
        ]
      };

      const result = constraints.applyConstraints(layoutResult, graphData);

      // Both nodes should have same X coordinate (average of 100 and 200)
      const posA = result.positions.get('A');
      const posB = result.positions.get('B');
      expect(Math.abs(posA.x - posB.x)).toBeLessThan(1);
      expect(posA.x).toBeCloseTo(150, 0);
      expect(posB.x).toBeCloseTo(150, 0);
    });

    test('should apply center alignment constraint', () => {
      constraints.addAlignmentConstraint(['A', 'B'], { 
        alignment: 'center', 
        tolerance: 10 
      });

      const layoutResult = {
        positions: new Map([
          ['A', { x: 100, y: 100 }],
          ['B', { x: 200, y: 200 }]
        ]),
        bounds: { x: 0, y: 0, width: 300, height: 300 },
        edges: new Map()
      };

      const graphData = {
        nodes: [
          { id: 'A', size: { width: 100, height: 60 } },
          { id: 'B', size: { width: 100, height: 60 } }
        ]
      };

      const result = constraints.applyConstraints(layoutResult, graphData);

      // Nodes should move towards center point (150, 150)
      const posA = result.positions.get('A');
      const posB = result.positions.get('B');
      
      // Should be closer to center than original positions
      const originalDistanceA = Math.sqrt(Math.pow(100 - 150, 2) + Math.pow(100 - 150, 2));
      const newDistanceA = Math.sqrt(Math.pow(posA.x - 150, 2) + Math.pow(posA.y - 150, 2));
      
      expect(newDistanceA).toBeLessThan(originalDistanceA);
    });

    test('should handle alignment with tolerance', () => {
      constraints.addAlignmentConstraint(['A', 'B'], { 
        alignment: 'horizontal', 
        tolerance: 5 
      });

      const layoutResult = {
        positions: new Map([
          ['A', { x: 100, y: 100 }],
          ['B', { x: 200, y: 103 }] // Within tolerance
        ]),
        bounds: { x: 0, y: 0, width: 300, height: 200 },
        edges: new Map()
      };

      const graphData = {
        nodes: [
          { id: 'A', size: { width: 100, height: 60 } },
          { id: 'B', size: { width: 100, height: 60 } }
        ]
      };

      const result = constraints.applyConstraints(layoutResult, graphData);

      // Should not change positions since within tolerance
      expect(result.positions.get('A')).toEqual({ x: 100, y: 100 });
      expect(result.positions.get('B')).toEqual({ x: 200, y: 103 });
    });
  });

  describe('Spacing Constraints', () => {
    test('should add spacing constraint', () => {
      const constraintId = constraints.addSpacingConstraint('A', 'B', {
        minDistance: 100,
        maxDistance: 200,
        preferredDistance: 150
      });

      expect(constraintId).toBeDefined();
      expect(constraints.constraints.size).toBe(1);

      const constraint = constraints.constraints.get(constraintId);
      expect(constraint.type).toBe('spacing');
      expect(constraint.source).toBe('A');
      expect(constraint.target).toBe('B');
      expect(constraint.minDistance).toBe(100);
      expect(constraint.maxDistance).toBe(200);
    });

    test('should enforce minimum distance constraint', () => {
      constraints.addSpacingConstraint('A', 'B', { minDistance: 150 });

      const layoutResult = {
        positions: new Map([
          ['A', { x: 100, y: 100 }],
          ['B', { x: 150, y: 100 }] // Too close (distance = 50)
        ]),
        bounds: { x: 0, y: 0, width: 300, height: 200 },
        edges: new Map()
      };

      const graphData = {
        nodes: [
          { id: 'A', size: { width: 100, height: 60 } },
          { id: 'B', size: { width: 100, height: 60 } }
        ]
      };

      const result = constraints.applyConstraints(layoutResult, graphData);

      const posA = result.positions.get('A');
      const posB = result.positions.get('B');
      const distance = Math.sqrt(
        Math.pow(posB.x - posA.x, 2) + Math.pow(posB.y - posA.y, 2)
      );

      expect(distance).toBeGreaterThanOrEqual(150);
    });

    test('should enforce maximum distance constraint', () => {
      constraints.addSpacingConstraint('A', 'B', { maxDistance: 100 });

      const layoutResult = {
        positions: new Map([
          ['A', { x: 100, y: 100 }],
          ['B', { x: 300, y: 100 }] // Too far (distance = 200)
        ]),
        bounds: { x: 0, y: 0, width: 400, height: 200 },
        edges: new Map()
      };

      const graphData = {
        nodes: [
          { id: 'A', size: { width: 100, height: 60 } },
          { id: 'B', size: { width: 100, height: 60 } }
        ]
      };

      const result = constraints.applyConstraints(layoutResult, graphData);

      const posA = result.positions.get('A');
      const posB = result.positions.get('B');
      const distance = Math.sqrt(
        Math.pow(posB.x - posA.x, 2) + Math.pow(posB.y - posA.y, 2)
      );

      expect(distance).toBeLessThanOrEqual(100);
    });

    test('should handle directional spacing constraints', () => {
      constraints.addSpacingConstraint('A', 'B', { 
        minDistance: 100, 
        direction: 'horizontal' 
      });

      // This is a placeholder test - full directional support would be in a more advanced version
      expect(constraints.constraints.size).toBe(1);
      const constraint = Array.from(constraints.constraints.values())[0];
      expect(constraint.direction).toBe('horizontal');
    });
  });

  describe('Grouping Constraints', () => {
    test('should add cluster grouping constraint', () => {
      const constraintId = constraints.addGroupingConstraint(['A', 'B', 'C'], {
        groupType: 'cluster',
        padding: 30
      });

      expect(constraintId).toBeDefined();
      expect(constraints.constraints.size).toBe(1);

      const constraint = constraints.constraints.get(constraintId);
      expect(constraint.type).toBe('grouping');
      expect(constraint.targets).toEqual(['A', 'B', 'C']);
      expect(constraint.groupType).toBe('cluster');
      expect(constraint.padding).toBe(30);
    });

    test('should apply cluster grouping constraint', () => {
      constraints.addGroupingConstraint(['A', 'B'], { 
        groupType: 'cluster',
        padding: 20 
      });

      const layoutResult = {
        positions: new Map([
          ['A', { x: 50, y: 50 }],
          ['B', { x: 300, y: 300 }] // Far apart
        ]),
        bounds: { x: 0, y: 0, width: 400, height: 400 },
        edges: new Map()
      };

      const graphData = {
        nodes: [
          { id: 'A', size: { width: 100, height: 60 } },
          { id: 'B', size: { width: 100, height: 60 } }
        ]
      };

      const result = constraints.applyConstraints(layoutResult, graphData);

      // Nodes should move closer together
      const posA = result.positions.get('A');
      const posB = result.positions.get('B');
      
      const originalDistance = Math.sqrt(Math.pow(300 - 50, 2) + Math.pow(300 - 50, 2));
      const newDistance = Math.sqrt(Math.pow(posB.x - posA.x, 2) + Math.pow(posB.y - posA.y, 2));
      
      expect(newDistance).toBeLessThan(originalDistance);
    });

    test('should apply separate grouping constraint', () => {
      constraints.addGroupingConstraint(['A', 'B'], { 
        groupType: 'separate',
        padding: 100 
      });

      const layoutResult = {
        positions: new Map([
          ['A', { x: 100, y: 100 }],
          ['B', { x: 120, y: 100 }] // Too close
        ]),
        bounds: { x: 0, y: 0, width: 300, height: 200 },
        edges: new Map()
      };

      const graphData = {
        nodes: [
          { id: 'A', size: { width: 100, height: 60 } },
          { id: 'B', size: { width: 100, height: 60 } }
        ]
      };

      const result = constraints.applyConstraints(layoutResult, graphData);

      const posA = result.positions.get('A');
      const posB = result.positions.get('B');
      const distance = Math.sqrt(
        Math.pow(posB.x - posA.x, 2) + Math.pow(posB.y - posA.y, 2)
      );

      expect(distance).toBeGreaterThanOrEqual(100);
    });
  });

  describe('Layer Constraints', () => {
    test('should add layer constraint', () => {
      const constraintId = constraints.addLayerConstraint(['A', 'B'], {
        layer: 1,
        sameLayer: true,
        priority: 'high'
      });

      expect(constraintId).toBeDefined();
      expect(constraints.constraints.size).toBe(1);

      const constraint = constraints.constraints.get(constraintId);
      expect(constraint.type).toBe('layer');
      expect(constraint.targets).toEqual(['A', 'B']);
      expect(constraint.layer).toBe(1);
      expect(constraint.sameLayer).toBe(true);
    });

    test('should handle min/max layer constraints', () => {
      const constraintId = constraints.addLayerConstraint(['A'], {
        minLayer: 2,
        maxLayer: 4
      });

      const constraint = constraints.constraints.get(constraintId);
      expect(constraint.minLayer).toBe(2);
      expect(constraint.maxLayer).toBe(4);
    });
  });

  describe('Constraint Management', () => {
    test('should get constraints for specific node', () => {
      constraints.addPositionConstraint('A', { fixedPosition: { x: 0, y: 0 } });
      constraints.addAlignmentConstraint(['A', 'B'], { alignment: 'horizontal' });
      constraints.addSpacingConstraint('A', 'C', { minDistance: 50 });

      const nodeConstraints = constraints.getNodeConstraints('A');
      expect(nodeConstraints.length).toBe(3);

      const types = nodeConstraints.map(c => c.type);
      expect(types).toContain('position');
      expect(types).toContain('alignment');
      expect(types).toContain('spacing');
    });

    test('should remove constraints by ID', () => {
      const constraintId = constraints.addPositionConstraint('A', { 
        fixedPosition: { x: 0, y: 0 } 
      });

      expect(constraints.constraints.size).toBe(1);
      expect(constraints.getNodeConstraints('A').length).toBe(1);

      const removed = constraints.removeConstraint(constraintId);
      expect(removed).toBe(true);
      expect(constraints.constraints.size).toBe(0);
      expect(constraints.getNodeConstraints('A').length).toBe(0);
    });

    test('should handle removal of non-existent constraint', () => {
      const removed = constraints.removeConstraint('non-existent-id');
      expect(removed).toBe(false);
    });

    test('should provide violation report', () => {
      constraints.addPositionConstraint('A', { fixedPosition: { x: 0, y: 0 } });
      
      const report = constraints.getViolationReport();
      expect(report).toHaveProperty('totalViolations');
      expect(report).toHaveProperty('activeViolations');
      expect(report).toHaveProperty('violationsByType');
      expect(report).toHaveProperty('stats');
    });
  });

  describe('Priority and Iteration Handling', () => {
    test('should respect constraint priorities', () => {
      // Add low priority constraint first
      constraints.addPositionConstraint('A', { 
        fixedPosition: { x: 100, y: 100 },
        priority: 'low'
      });

      // Add high priority constraint second
      constraints.addPositionConstraint('A', { 
        fixedPosition: { x: 200, y: 200 },
        priority: 'high'
      });

      const sortedConstraints = constraints._getSortedConstraints();
      expect(sortedConstraints[0].priority).toBe('high');
      expect(sortedConstraints[1].priority).toBe('low');
    });

    test('should limit iterations', () => {
      const limitedConstraints = new LayoutConstraints({ maxIterations: 2 });
      
      limitedConstraints.addPositionConstraint('A', { fixedPosition: { x: 0, y: 0 } });

      const layoutResult = {
        positions: new Map([['A', { x: 100, y: 100 }]]),
        bounds: { x: 0, y: 0, width: 200, height: 200 },
        edges: new Map()
      };

      const graphData = {
        nodes: [{ id: 'A', size: { width: 100, height: 60 } }]
      };

      const result = limitedConstraints.applyConstraints(layoutResult, graphData);
      
      expect(result.metadata.constraints.stats.iterationsUsed).toBeLessThanOrEqual(2);
    });

    test('should handle constraint enforcement disabled', () => {
      const disabledConstraints = new LayoutConstraints({ enforceConstraints: false });
      
      disabledConstraints.addPositionConstraint('A', { fixedPosition: { x: 0, y: 0 } });

      const layoutResult = {
        positions: new Map([['A', { x: 100, y: 100 }]]),
        bounds: { x: 0, y: 0, width: 200, height: 200 },
        edges: new Map()
      };

      const graphData = {
        nodes: [{ id: 'A', size: { width: 100, height: 60 } }]
      };

      const result = disabledConstraints.applyConstraints(layoutResult, graphData);
      
      // Position should not change when constraints are disabled
      expect(result.positions.get('A')).toEqual({ x: 100, y: 100 });
    });
  });

  describe('Metadata and Statistics', () => {
    test('should provide comprehensive metadata', () => {
      constraints.addPositionConstraint('A', { fixedPosition: { x: 0, y: 0 } });
      constraints.addAlignmentConstraint(['B', 'C'], { alignment: 'horizontal' });

      const layoutResult = {
        positions: new Map([
          ['A', { x: 100, y: 100 }],
          ['B', { x: 200, y: 150 }],
          ['C', { x: 300, y: 250 }]
        ]),
        bounds: { x: 0, y: 0, width: 400, height: 300 },
        edges: new Map()
      };

      const graphData = {
        nodes: [
          { id: 'A', size: { width: 100, height: 60 } },
          { id: 'B', size: { width: 100, height: 60 } },
          { id: 'C', size: { width: 100, height: 60 } }
        ]
      };

      const result = constraints.applyConstraints(layoutResult, graphData);
      
      expect(result.metadata.constraints).toBeDefined();
      expect(result.metadata.constraints.totalConstraints).toBe(2);
      expect(result.metadata.constraints.constraintsByType).toHaveProperty('position');
      expect(result.metadata.constraints.constraintsByType).toHaveProperty('alignment');
      expect(result.metadata.constraints.stats).toBeDefined();
    });

    test('should track performance statistics', () => {
      constraints.addPositionConstraint('A', { fixedPosition: { x: 0, y: 0 } });

      const layoutResult = {
        positions: new Map([['A', { x: 100, y: 100 }]]),
        bounds: { x: 0, y: 0, width: 200, height: 200 },
        edges: new Map()
      };

      const graphData = {
        nodes: [{ id: 'A', size: { width: 100, height: 60 } }]
      };

      const result = constraints.applyConstraints(layoutResult, graphData);
      
      const stats = result.metadata.constraints.stats;
      expect(stats.constraintsApplied).toBeGreaterThan(0);
      expect(stats.iterationsUsed).toBeGreaterThan(0);
      expect(stats.processingTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle missing nodes gracefully', () => {
      constraints.addPositionConstraint('nonexistent', { fixedPosition: { x: 0, y: 0 } });

      const layoutResult = {
        positions: new Map([['A', { x: 100, y: 100 }]]),
        bounds: { x: 0, y: 0, width: 200, height: 200 },
        edges: new Map()
      };

      const graphData = {
        nodes: [{ id: 'A', size: { width: 100, height: 60 } }]
      };

      // Should not throw error
      expect(() => {
        constraints.applyConstraints(layoutResult, graphData);
      }).not.toThrow();
    });

    test('should handle empty positions map', () => {
      constraints.addPositionConstraint('A', { fixedPosition: { x: 0, y: 0 } });

      const layoutResult = {
        positions: new Map(),
        bounds: { x: 0, y: 0, width: 0, height: 0 },
        edges: new Map()
      };

      const graphData = { nodes: [] };

      const result = constraints.applyConstraints(layoutResult, graphData);
      expect(result.positions.size).toBe(0);
    });

    test('should handle complex multi-constraint scenarios', () => {
      // Add multiple conflicting constraints
      constraints.addPositionConstraint('A', { fixedPosition: { x: 100, y: 100 } });
      constraints.addAlignmentConstraint(['A', 'B'], { alignment: 'horizontal' });
      constraints.addSpacingConstraint('A', 'B', { minDistance: 200 });

      const layoutResult = {
        positions: new Map([
          ['A', { x: 50, y: 50 }],
          ['B', { x: 60, y: 200 }]
        ]),
        bounds: { x: 0, y: 0, width: 300, height: 300 },
        edges: new Map()
      };

      const graphData = {
        nodes: [
          { id: 'A', size: { width: 100, height: 60 } },
          { id: 'B', size: { width: 100, height: 60 } }
        ]
      };

      // Should handle multiple constraints without error
      expect(() => {
        const result = constraints.applyConstraints(layoutResult, graphData);
        expect(result.positions.size).toBe(2);
      }).not.toThrow();
    });
  });
});