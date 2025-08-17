/**
 * Unit tests for LevelProcessor
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { LevelProcessor } from '../../LevelProcessor.js';
import { SyntheticTool } from '../../SyntheticTool.js';

describe('LevelProcessor', () => {
  let processor;
  let mockPlanner;
  let mockValidator;
  let mockToolFactory;

  beforeEach(() => {
    // Create mock planner
    mockPlanner = {
      makePlan: jest.fn().mockResolvedValue({
        type: 'sequence',
        children: [
          { type: 'action', tool: 'test_tool', outputVariable: 'result' }
        ]
      })
    };
    
    // Create mock validator
    mockValidator = {
      validate: jest.fn().mockResolvedValue({
        valid: true,
        errors: [],
        warnings: []
      })
    };
    
    // Create mock tool factory
    mockToolFactory = {
      createFromBT: jest.fn().mockImplementation((bt, task) => {
        return new SyntheticTool({
          name: `synthetic_${task.id}`,
          description: task.description,
          executionPlan: bt
        });
      })
    };
    
    processor = new LevelProcessor({
      planner: mockPlanner,
      validator: mockValidator,
      toolFactory: mockToolFactory
    });
  });

  describe('initialization', () => {
    it('should create processor with dependencies', () => {
      expect(processor.planner).toBe(mockPlanner);
      expect(processor.validator).toBe(mockValidator);
      expect(processor.toolFactory).toBe(mockToolFactory);
    });
  });

  describe('processNodes', () => {
    it('should process SIMPLE nodes at a level', async () => {
      const nodes = [
        {
          id: 'task1',
          description: 'Task 1',
          complexity: 'SIMPLE',
          level: 2,
          tools: ['tool1', 'tool2']
        },
        {
          id: 'task2',
          description: 'Task 2',
          complexity: 'SIMPLE',
          level: 2,
          tools: ['tool3']
        }
      ];
      
      const availableTools = [
        { name: 'tool1', description: 'Tool 1' },
        { name: 'tool2', description: 'Tool 2' },
        { name: 'tool3', description: 'Tool 3' }
      ];
      
      const result = await processor.processNodes(nodes, availableTools);
      
      expect(result.success).toBe(true);
      expect(result.processedNodes).toHaveLength(2);
      expect(result.syntheticTools).toHaveLength(2);
      expect(result.behaviorTrees).toHaveLength(2);
    });
    
    it('should skip COMPLEX nodes', async () => {
      const nodes = [
        {
          id: 'simple1',
          description: 'Simple task',
          complexity: 'SIMPLE',
          tools: ['tool1']
        },
        {
          id: 'complex1',
          description: 'Complex task',
          complexity: 'COMPLEX'
        }
      ];
      
      const availableTools = [
        { name: 'tool1', description: 'Tool 1' }
      ];
      
      const result = await processor.processNodes(nodes, availableTools);
      
      expect(result.processedNodes).toHaveLength(1);
      expect(result.skippedNodes).toHaveLength(1);
      expect(result.skippedNodes[0].id).toBe('complex1');
    });
    
    it('should handle planning failures', async () => {
      mockPlanner.makePlan.mockRejectedValueOnce(new Error('Planning failed'));
      
      const nodes = [{
        id: 'task1',
        complexity: 'SIMPLE',
        tools: ['tool1']
      }];
      
      const result = await processor.processNodes(nodes, []);
      
      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Planning failed');
    });
  });

  describe('planTask', () => {
    it('should plan a single task', async () => {
      const task = {
        id: 'task1',
        description: 'Test task',
        complexity: 'SIMPLE',
        suggestedInputs: ['input1'],
        suggestedOutputs: ['output1']
      };
      
      const tools = [
        { name: 'tool1', description: 'Tool 1' }
      ];
      
      const result = await processor.planTask(task, tools);
      
      expect(result.success).toBe(true);
      expect(result.behaviorTree).toBeDefined();
      expect(result.validation.valid).toBe(true);
      expect(mockPlanner.makePlan).toHaveBeenCalledWith(
        task.description,
        tools,
        expect.any(Object)
      );
    });
    
    it('should include context in planning', async () => {
      const task = {
        id: 'task1',
        description: 'Test task',
        parentContext: { someContext: 'value' }
      };
      
      await processor.planTask(task, [], { additionalContext: 'more' });
      
      expect(mockPlanner.makePlan).toHaveBeenCalledWith(
        task.description,
        [],
        expect.objectContaining({
          context: expect.objectContaining({
            additionalContext: 'more'
          })
        })
      );
    });
    
    it('should validate generated BT', async () => {
      const task = { id: 'task1', description: 'Test' };
      const tools = [{ name: 'tool1' }];
      
      await processor.planTask(task, tools);
      
      expect(mockValidator.validate).toHaveBeenCalled();
    });
    
    it('should handle validation failure', async () => {
      mockValidator.validate.mockResolvedValueOnce({
        valid: false,
        errors: ['Invalid BT structure'],
        warnings: []
      });
      
      const task = { id: 'task1', description: 'Test' };
      
      const result = await processor.planTask(task, []);
      
      expect(result.success).toBe(false);
      expect(result.validation.valid).toBe(false);
    });
  });

  describe('collectNodesAtDepth', () => {
    it('should collect nodes at specific depth', () => {
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
            level: 1,
            children: [
              { id: 'grandchild3', level: 2 }
            ]
          }
        ]
      };
      
      const level2Nodes = processor.collectNodesAtDepth(hierarchy, 2);
      
      expect(level2Nodes).toHaveLength(3);
      expect(level2Nodes.map(n => n.id)).toEqual([
        'grandchild1', 'grandchild2', 'grandchild3'
      ]);
    });
    
    it('should return empty array for non-existent depth', () => {
      const hierarchy = {
        id: 'root',
        level: 0
      };
      
      const nodes = processor.collectNodesAtDepth(hierarchy, 5);
      expect(nodes).toEqual([]);
    });
  });

  describe('gatherTools', () => {
    it('should combine real and synthetic tools', () => {
      const realTools = [
        { name: 'real1', type: 'real' },
        { name: 'real2', type: 'real' }
      ];
      
      const syntheticTools = [
        new SyntheticTool({
          name: 'synthetic1',
          description: 'Synthetic 1',
          executionPlan: {}
        }),
        new SyntheticTool({
          name: 'synthetic2',
          description: 'Synthetic 2',
          executionPlan: {}
        })
      ];
      
      const combined = processor.gatherTools(realTools, syntheticTools);
      
      expect(combined).toHaveLength(4);
      expect(combined.some(t => t.name === 'real1')).toBe(true);
      expect(combined.some(t => t.name === 'synthetic1')).toBe(true);
    });
    
    it('should handle empty tool sets', () => {
      const combined = processor.gatherTools([], []);
      expect(combined).toEqual([]);
    });
  });

  describe('validateLevelConsistency', () => {
    it('should validate all BTs at a level', () => {
      const plans = [
        { id: 'plan1', behaviorTree: { type: 'sequence' } },
        { id: 'plan2', behaviorTree: { type: 'action' } }
      ];
      
      const validation = processor.validateLevelConsistency(plans);
      
      expect(validation.valid).toBe(true);
      expect(validation.issues).toEqual([]);
    });
    
    it('should detect inconsistencies', () => {
      const plans = [
        { id: 'plan1', behaviorTree: { type: 'sequence' } },
        { id: 'plan2', behaviorTree: null }
      ];
      
      const validation = processor.validateLevelConsistency(plans);
      
      expect(validation.valid).toBe(false);
      expect(validation.issues).toHaveLength(1);
      expect(validation.issues[0]).toContain('plan2');
    });
  });
});