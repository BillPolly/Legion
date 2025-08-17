/**
 * Unit tests for FormalPlanner orchestrator
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { FormalPlanner } from '../../FormalPlanner.js';
import { SyntheticTool } from '../../SyntheticTool.js';
import { FormalPlanResult } from '../../FormalPlanResult.js';

describe('FormalPlanner', () => {
  let planner;
  let mockDependencies;

  beforeEach(() => {
    // Create mock dependencies
    mockDependencies = {
      planner: {
        makePlan: jest.fn().mockResolvedValue({
          type: 'sequence',
          children: [{ type: 'action', tool: 'test_tool' }]
        })
      },
      validator: {
        validate: jest.fn().mockResolvedValue({
          valid: true,
          errors: [],
          warnings: []
        })
      },
      toolFactory: {
        createFromBT: jest.fn().mockImplementation((bt, task) => {
          return new SyntheticTool({
            name: `synthetic_${task.id}`,
            description: task.description,
            executionPlan: bt
          });
        })
      },
      artifactMapper: {
        mapChildArtifacts: jest.fn().mockReturnValue({}),
        createAggregateArtifact: jest.fn().mockReturnValue({ aggregated: true })
      },
      toolRegistry: {
        searchTools: jest.fn().mockResolvedValue([
          { name: 'tool1', confidence: 0.9 },
          { name: 'tool2', confidence: 0.8 }
        ]),
        getTool: jest.fn().mockResolvedValue({ name: 'tool1', execute: jest.fn() })
      }
    };
    
    planner = new FormalPlanner(mockDependencies);
  });

  describe('initialization', () => {
    it('should create planner with dependencies', () => {
      expect(planner.planner).toBe(mockDependencies.planner);
      expect(planner.validator).toBe(mockDependencies.validator);
      expect(planner.toolFactory).toBe(mockDependencies.toolFactory);
      expect(planner.artifactMapper).toBe(mockDependencies.artifactMapper);
      expect(planner.toolRegistry).toBe(mockDependencies.toolRegistry);
    });
  });

  describe('synthesize', () => {
    it('should synthesize a simple two-level hierarchy', async () => {
      const taskHierarchy = {
        id: 'root',
        description: 'Root task',
        complexity: 'COMPLEX',
        level: 0,
        children: [
          {
            id: 'child1',
            description: 'Child 1',
            complexity: 'SIMPLE',
            level: 1,
            tools: ['tool1']
          },
          {
            id: 'child2',
            description: 'Child 2',
            complexity: 'SIMPLE',
            level: 1,
            tools: ['tool2']
          }
        ]
      };
      
      const result = await planner.synthesize(taskHierarchy);
      
      expect(result).toBeInstanceOf(FormalPlanResult);
      expect(result.success).toBe(true);
      expect(Object.keys(result.syntheticTools)).toHaveLength(2);
      expect(result.rootBT).toBeDefined();
    });
    
    it('should handle empty hierarchy', async () => {
      const result = await planner.synthesize(null);
      
      expect(result.success).toBe(false);
      expect(result.errors).toContain('No task hierarchy provided');
    });
    
    it('should handle single-level hierarchy', async () => {
      const taskHierarchy = {
        id: 'single',
        description: 'Single task',
        complexity: 'SIMPLE',
        level: 0,
        tools: ['tool1']
      };
      
      const result = await planner.synthesize(taskHierarchy);
      
      expect(result.success).toBe(true);
      expect(result.rootBT).toBeDefined();
      expect(Object.keys(result.syntheticTools)).toHaveLength(0);
    });
  });

  describe('traverseBottomUp', () => {
    it('should identify levels in bottom-up order', () => {
      const hierarchy = {
        id: 'root',
        level: 0,
        children: [
          {
            id: 'child1',
            level: 1,
            children: [
              { id: 'grandchild1', level: 2 },
              { id: 'grandchild2', level: 2 }
            ]
          },
          {
            id: 'child2',
            level: 1
          }
        ]
      };
      
      const levels = planner.traverseBottomUp(hierarchy);
      
      expect(levels).toEqual([2, 1, 0]);
    });
    
    it('should handle single node', () => {
      const hierarchy = { id: 'single', level: 0 };
      
      const levels = planner.traverseBottomUp(hierarchy);
      
      expect(levels).toEqual([0]);
    });
  });

  describe('processLevel', () => {
    it('should process all nodes at a level', async () => {
      const hierarchy = {
        id: 'root',
        level: 0,
        children: [
          { id: 'child1', level: 1, complexity: 'SIMPLE', tools: ['tool1'], description: 'Child 1' },
          { id: 'child2', level: 1, complexity: 'SIMPLE', tools: ['tool2'], description: 'Child 2' }
        ]
      };
      
      const syntheticTools = [];
      const result = await planner.processLevel(hierarchy, 1, syntheticTools);
      
      // Check what we got back
      if (result.processedNodes.length === 0 && result.errors.length > 0) {
        console.log('Errors in processLevel:', result.errors);
      }
      
      expect(result.processedNodes).toHaveLength(2);
      expect(result.syntheticTools).toHaveLength(2);
      // syntheticTools array is not mutated by processLevel itself
      expect(syntheticTools).toHaveLength(0);
    });
    
    it('should skip COMPLEX nodes', async () => {
      const hierarchy = {
        id: 'root',
        level: 0,
        children: [
          { id: 'simple', level: 1, complexity: 'SIMPLE', tools: ['tool1'], description: 'Simple task' },
          { id: 'complex', level: 1, complexity: 'COMPLEX', description: 'Complex task' }
        ]
      };
      
      const syntheticTools = [];
      const result = await planner.processLevel(hierarchy, 1, syntheticTools);
      
      expect(result.processedNodes).toHaveLength(1);
      expect(result.skippedNodes).toHaveLength(1);
    });
  });

  describe('buildRootBT', () => {
    it('should build root BT using synthetic tools', async () => {
      const hierarchy = {
        id: 'root',
        description: 'Root task',
        complexity: 'COMPLEX'
      };
      
      const syntheticTools = [
        new SyntheticTool({
          name: 'synthetic1',
          description: 'Tool 1',
          executionPlan: {}
        })
      ];
      
      const rootBT = await planner.buildRootBT(hierarchy, syntheticTools);
      
      expect(rootBT).toBeDefined();
      expect(mockDependencies.planner.makePlan).toHaveBeenCalledWith(
        'Root task',
        expect.any(Array),
        expect.any(Object)
      );
    });
  });

  describe('aggregateResults', () => {
    it('should aggregate results from all levels', () => {
      const levelResults = [
        {
          level: 2,
          processedNodes: ['node1'],
          syntheticTools: [{ name: 'tool1' }],
          behaviorTrees: [{ type: 'action' }]
        },
        {
          level: 1,
          processedNodes: ['node2'],
          syntheticTools: [{ name: 'tool2' }],
          behaviorTrees: [{ type: 'sequence' }]
        }
      ];
      
      const rootBT = { type: 'root' };
      
      const result = planner.aggregateResults(levelResults, rootBT);
      
      expect(result).toBeInstanceOf(FormalPlanResult);
      expect(result.rootBT).toBe(rootBT);
      expect(Object.keys(result.syntheticTools)).toHaveLength(2);
      expect(result.levelPlans).toHaveLength(2);
    });
  });

  describe('error handling', () => {
    it('should handle planning failures', async () => {
      mockDependencies.planner.makePlan.mockRejectedValueOnce(
        new Error('Planning failed')
      );
      
      const hierarchy = {
        id: 'root',
        complexity: 'SIMPLE',
        level: 0
      };
      
      const result = await planner.synthesize(hierarchy);
      
      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('Planning failed'))).toBe(true);
    });
    
    it('should handle validation failures', async () => {
      mockDependencies.validator.validate.mockResolvedValueOnce({
        valid: false,
        errors: ['Invalid BT'],
        warnings: []
      });
      
      const hierarchy = {
        id: 'root',
        complexity: 'SIMPLE',
        level: 0
      };
      
      const result = await planner.synthesize(hierarchy);
      
      expect(result.success).toBe(false);
      // The error message should mention validation
      const hasValidationError = result.errors.some(e => 
        e.toLowerCase().includes('validation') || e.toLowerCase().includes('invalid')
      );
      expect(hasValidationError).toBe(true);
    });
    
    it('should provide meaningful error messages', async () => {
      const hierarchy = {
        id: 'root',
        complexity: 'COMPLEX',
        level: 0,
        children: [
          { id: 'child1', complexity: 'SIMPLE', level: 1, tools: ['tool1'] }
        ]
      };
      
      mockDependencies.toolFactory.createFromBT.mockImplementationOnce(() => {
        throw new Error('Failed to create synthetic tool');
      });
      
      const result = await planner.synthesize(hierarchy);
      
      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('Failed to create synthetic tool'))).toBe(true);
    });
  });
});