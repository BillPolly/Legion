/**
 * Unit tests for ValidatedSubtree
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ValidatedSubtree } from '../../src/core/ValidatedSubtree.js';

describe('ValidatedSubtree', () => {
  let mockValidator;
  
  beforeEach(() => {
    mockValidator = {
      validate: jest.fn().mockResolvedValue({ valid: true, errors: [] })
    };
  });
  
  describe('constructor', () => {
    it('should initialize with task node properties', () => {
      const taskNode = {
        id: 'task-1',
        description: 'Test task',
        level: 2,
        complexity: 'SIMPLE',
        suggestedInputs: ['input1', 'input2'],
        suggestedOutputs: ['output1', 'output2']
      };
      
      const subtree = new ValidatedSubtree(taskNode, null, { valid: false });
      
      expect(subtree.id).toBe('task-1');
      expect(subtree.description).toBe('Test task');
      expect(subtree.level).toBe(2);
      expect(subtree.complexity).toBe('SIMPLE');
      expect(subtree.inputs.has('input1')).toBe(true);
      expect(subtree.inputs.has('input2')).toBe(true);
      expect(subtree.outputs.has('output1')).toBe(true);
      expect(subtree.outputs.has('output2')).toBe(true);
    });
  });
  
  describe('addChild', () => {
    it('should add child and update parent reference', () => {
      const parent = new ValidatedSubtree(
        { id: 'parent', description: 'Parent', complexity: 'COMPLEX' },
        null,
        { valid: false }
      );
      
      const child = new ValidatedSubtree(
        { 
          id: 'child', 
          description: 'Child',
          complexity: 'SIMPLE',
          suggestedInputs: ['childInput'],
          suggestedOutputs: ['childOutput']
        },
        null,
        { valid: false }
      );
      
      parent.addChild(child);
      
      expect(parent.children).toContain(child);
      expect(child.parent).toBe(parent);
    });
    
    it('should aggregate external inputs from children', () => {
      const parent = new ValidatedSubtree(
        { id: 'parent', description: 'Parent', complexity: 'COMPLEX' },
        null,
        { valid: false }
      );
      
      const child1 = new ValidatedSubtree(
        {
          id: 'child1',
          description: 'Child 1',
          complexity: 'SIMPLE',
          suggestedInputs: ['externalInput'],
          suggestedOutputs: ['intermediateData']
        },
        null,
        { valid: false }
      );
      
      const child2 = new ValidatedSubtree(
        {
          id: 'child2',
          description: 'Child 2',
          complexity: 'SIMPLE',
          suggestedInputs: ['intermediateData'],
          suggestedOutputs: ['finalOutput']
        },
        null,
        { valid: false }
      );
      
      parent.addChild(child1);
      parent.addChild(child2);
      
      const contract = parent.getContract();
      
      // External input should bubble up
      expect(contract.inputs).toContain('externalInput');
      // Internal data flow should be marked as internal
      expect(contract.internal).toContain('intermediateData');
      // All outputs should be present
      expect(contract.outputs).toContain('intermediateData');
      expect(contract.outputs).toContain('finalOutput');
    });
  });
  
  describe('composeBehaviorTree', () => {
    it('should return existing BT for simple tasks', () => {
      const existingBT = { type: 'action', tool: 'test_tool' };
      const subtree = new ValidatedSubtree(
        { id: 'simple', description: 'Simple', complexity: 'SIMPLE' },
        existingBT,
        { valid: true }
      );
      
      const composed = subtree.composeBehaviorTree();
      
      expect(composed).toBe(existingBT);
    });
    
    it('should compose sequence for dependent children', () => {
      const parent = new ValidatedSubtree(
        { id: 'parent', description: 'Parent', complexity: 'COMPLEX' },
        null,
        { valid: false }
      );
      
      const child1 = new ValidatedSubtree(
        {
          id: 'child1',
          description: 'Producer',
          complexity: 'SIMPLE',
          suggestedInputs: [],
          suggestedOutputs: ['data']
        },
        { type: 'action', id: 'action1', tool: 'tool1' },
        { valid: true }
      );
      
      const child2 = new ValidatedSubtree(
        {
          id: 'child2',
          description: 'Consumer',
          complexity: 'SIMPLE',
          suggestedInputs: ['data'],
          suggestedOutputs: ['result']
        },
        { type: 'action', id: 'action2', tool: 'tool2' },
        { valid: true }
      );
      
      parent.addChild(child1);
      parent.addChild(child2);
      
      const composed = parent.composeBehaviorTree();
      
      expect(composed.type).toBe('sequence');
      expect(composed.children).toHaveLength(2);
      expect(composed.children[0].id).toBe('action1');
      expect(composed.children[1].id).toBe('action2');
    });
    
    it('should compose parallel for independent children', () => {
      const parent = new ValidatedSubtree(
        { id: 'parent', description: 'Parent', complexity: 'COMPLEX' },
        null,
        { valid: false }
      );
      
      const child1 = new ValidatedSubtree(
        {
          id: 'child1',
          description: 'Task 1',
          complexity: 'SIMPLE',
          suggestedInputs: ['input1'],
          suggestedOutputs: ['output1']
        },
        { type: 'action', id: 'action1', tool: 'tool1' },
        { valid: true }
      );
      
      const child2 = new ValidatedSubtree(
        {
          id: 'child2',
          description: 'Task 2',
          complexity: 'SIMPLE',
          suggestedInputs: ['input2'],
          suggestedOutputs: ['output2']
        },
        { type: 'action', id: 'action2', tool: 'tool2' },
        { valid: true }
      );
      
      parent.addChild(child1);
      parent.addChild(child2);
      
      const composed = parent.composeBehaviorTree();
      
      expect(composed.type).toBe('parallel');
      expect(composed.children).toHaveLength(2);
      expect(composed.successPolicy).toBe('all');
    });
  });
  
  describe('validate', () => {
    it('should validate simple task BT', async () => {
      const bt = { type: 'action', tool: 'test_tool' };
      const subtree = new ValidatedSubtree(
        { id: 'simple', description: 'Simple', complexity: 'SIMPLE' },
        bt,
        { valid: false }
      );
      
      const tools = [{ name: 'test_tool' }];
      const validation = await subtree.validate(mockValidator, tools);
      
      expect(mockValidator.validate).toHaveBeenCalledWith(bt, tools);
      expect(subtree.isValid).toBe(true);
      expect(validation.valid).toBe(true);
    });
    
    it('should validate complex task by validating all children', async () => {
      const parent = new ValidatedSubtree(
        { id: 'parent', description: 'Parent', complexity: 'COMPLEX' },
        null,
        { valid: false }
      );
      
      const child1 = new ValidatedSubtree(
        { id: 'child1', description: 'Child 1', complexity: 'SIMPLE' },
        { type: 'action', tool: 'tool1' },
        { valid: false }
      );
      
      const child2 = new ValidatedSubtree(
        { id: 'child2', description: 'Child 2', complexity: 'SIMPLE' },
        { type: 'action', tool: 'tool2' },
        { valid: false }
      );
      
      parent.addChild(child1);
      parent.addChild(child2);
      
      const tools = [{ name: 'tool1' }, { name: 'tool2' }];
      const validation = await parent.validate(mockValidator, tools);
      
      // Should validate children and composed tree
      expect(mockValidator.validate).toHaveBeenCalledTimes(3);
      expect(parent.isValid).toBe(true);
    });
    
    it('should fail validation if any child fails', async () => {
      const parent = new ValidatedSubtree(
        { id: 'parent', description: 'Parent', complexity: 'COMPLEX' },
        null,
        { valid: false }
      );
      
      const child1 = new ValidatedSubtree(
        { id: 'child1', description: 'Child 1', complexity: 'SIMPLE' },
        { type: 'action', tool: 'tool1' },
        { valid: false }
      );
      
      const child2 = new ValidatedSubtree(
        { id: 'child2', description: 'Child 2', complexity: 'SIMPLE' },
        { type: 'action', tool: 'invalid_tool' },
        { valid: false }
      );
      
      parent.addChild(child1);
      parent.addChild(child2);
      
      // Make second child validation fail
      mockValidator.validate
        .mockResolvedValueOnce({ valid: true, errors: [] })
        .mockResolvedValueOnce({ valid: false, errors: ['Invalid tool'] });
      
      const tools = [{ name: 'tool1' }];
      const validation = await parent.validate(mockValidator, tools);
      
      expect(parent.isValid).toBe(false);
      expect(validation.errors).toContain('One or more child subtrees failed validation');
    });
  });
  
  describe('toExecutionPlan', () => {
    it('should create execution plan for simple task', () => {
      const subtree = new ValidatedSubtree(
        {
          id: 'simple',
          description: 'Simple task',
          complexity: 'SIMPLE',
          level: 2,
          suggestedInputs: ['input'],
          suggestedOutputs: ['output']
        },
        { type: 'action', tool: 'tool' },
        { valid: true }
      );
      
      const plan = subtree.toExecutionPlan();
      
      expect(plan).toHaveLength(1);
      expect(plan[0].taskId).toBe('simple');
      expect(plan[0].description).toBe('Simple task');
      expect(plan[0].behaviorTree.type).toBe('action');
      expect(plan[0].inputs).toEqual(['input']);
      expect(plan[0].outputs).toEqual(['output']);
      expect(plan[0].level).toBe(2);
    });
    
    it('should create flat execution plan for complex task', () => {
      const parent = new ValidatedSubtree(
        { id: 'parent', description: 'Parent', complexity: 'COMPLEX' },
        null,
        { valid: false }
      );
      
      const child1 = new ValidatedSubtree(
        {
          id: 'child1',
          description: 'Child 1',
          complexity: 'SIMPLE',
          level: 2
        },
        { type: 'action', tool: 'tool1' },
        { valid: true }
      );
      
      const child2 = new ValidatedSubtree(
        {
          id: 'child2',
          description: 'Child 2',
          complexity: 'SIMPLE',
          level: 2
        },
        { type: 'action', tool: 'tool2' },
        { valid: true }
      );
      
      parent.addChild(child1);
      parent.addChild(child2);
      
      const plan = parent.toExecutionPlan();
      
      expect(plan).toHaveLength(2);
      expect(plan[0].taskId).toBe('child1');
      expect(plan[1].taskId).toBe('child2');
    });
  });
  
  describe('getTotalTasks', () => {
    it('should return 1 for simple task', () => {
      const subtree = new ValidatedSubtree(
        { id: 'simple', description: 'Simple', complexity: 'SIMPLE' },
        null,
        { valid: false }
      );
      
      expect(subtree.getTotalTasks()).toBe(1);
    });
    
    it('should count all descendant simple tasks', () => {
      const root = new ValidatedSubtree(
        { id: 'root', description: 'Root', complexity: 'COMPLEX' },
        null,
        { valid: false }
      );
      
      const branch = new ValidatedSubtree(
        { id: 'branch', description: 'Branch', complexity: 'COMPLEX' },
        null,
        { valid: false }
      );
      
      const leaf1 = new ValidatedSubtree(
        { id: 'leaf1', description: 'Leaf 1', complexity: 'SIMPLE' },
        null,
        { valid: false }
      );
      
      const leaf2 = new ValidatedSubtree(
        { id: 'leaf2', description: 'Leaf 2', complexity: 'SIMPLE' },
        null,
        { valid: false }
      );
      
      const leaf3 = new ValidatedSubtree(
        { id: 'leaf3', description: 'Leaf 3', complexity: 'SIMPLE' },
        null,
        { valid: false }
      );
      
      branch.addChild(leaf1);
      branch.addChild(leaf2);
      root.addChild(branch);
      root.addChild(leaf3);
      
      expect(root.getTotalTasks()).toBe(3);
    });
  });
  
  describe('topological sort', () => {
    it('should detect circular dependencies', () => {
      const parent = new ValidatedSubtree(
        { id: 'parent', description: 'Parent', complexity: 'COMPLEX' },
        null,
        { valid: false }
      );
      
      const child1 = new ValidatedSubtree(
        {
          id: 'child1',
          description: 'Child 1',
          complexity: 'SIMPLE',
          suggestedInputs: ['output2'],
          suggestedOutputs: ['output1']
        },
        null,
        { valid: false }
      );
      
      const child2 = new ValidatedSubtree(
        {
          id: 'child2',
          description: 'Child 2',
          complexity: 'SIMPLE',
          suggestedInputs: ['output1'],
          suggestedOutputs: ['output2']
        },
        null,
        { valid: false }
      );
      
      parent.addChild(child1);
      parent.addChild(child2);
      
      expect(() => parent.composeBehaviorTree()).toThrow('Circular dependency');
    });
  });
});