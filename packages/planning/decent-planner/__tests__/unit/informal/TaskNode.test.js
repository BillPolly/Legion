/**
 * Unit tests for TaskNode structure
 */

import { describe, it, expect } from '@jest/globals';
import { TaskNode } from '../../../src/core/informal/types/TaskNode.js';

describe('TaskNode', () => {
  describe('constructor', () => {
    it('should create a valid SIMPLE task node', () => {
      const node = new TaskNode({
        id: 'task-1',
        description: 'Write to file',
        complexity: 'SIMPLE',
        reasoning: 'Can be done with file tools',
        suggestedInputs: ['content', 'path'],
        suggestedOutputs: ['file_path'],
        tools: [
          { name: 'file_write', confidence: 0.95 }
        ],
        feasible: true
      });

      expect(node.id).toBe('task-1');
      expect(node.description).toBe('Write to file');
      expect(node.complexity).toBe('SIMPLE');
      expect(node.reasoning).toBe('Can be done with file tools');
      expect(node.suggestedInputs).toEqual(['content', 'path']);
      expect(node.suggestedOutputs).toEqual(['file_path']);
      expect(node.tools).toHaveLength(1);
      expect(node.feasible).toBe(true);
    });

    it('should create a valid COMPLEX task node', () => {
      const node = new TaskNode({
        id: 'task-2',
        description: 'Build authentication system',
        complexity: 'COMPLEX',
        reasoning: 'Requires multiple subsystems',
        suggestedInputs: ['user_model'],
        suggestedOutputs: ['auth_middleware', 'jwt_config'],
        subtasks: []
      });

      expect(node.id).toBe('task-2');
      expect(node.complexity).toBe('COMPLEX');
      expect(node.subtasks).toEqual([]);
      expect(node.tools).toBeUndefined();
      expect(node.feasible).toBeUndefined();
    });

    it('should generate unique ID if not provided', () => {
      const node1 = new TaskNode({
        description: 'Task 1',
        complexity: 'SIMPLE'
      });
      
      const node2 = new TaskNode({
        description: 'Task 2',
        complexity: 'SIMPLE'
      });

      expect(node1.id).toBeDefined();
      expect(node2.id).toBeDefined();
      expect(node1.id).not.toBe(node2.id);
    });

    it('should throw error for invalid complexity', () => {
      expect(() => {
        new TaskNode({
          description: 'Invalid task',
          complexity: 'MEDIUM'
        });
      }).toThrow('Invalid complexity: MEDIUM. Must be SIMPLE or COMPLEX');
    });

    it('should throw error if SIMPLE task has subtasks', () => {
      expect(() => {
        new TaskNode({
          description: 'Invalid simple task',
          complexity: 'SIMPLE',
          subtasks: [{}]
        });
      }).toThrow('SIMPLE tasks cannot have subtasks');
    });

    it('should throw error if COMPLEX task has tools', () => {
      expect(() => {
        new TaskNode({
          description: 'Invalid complex task',
          complexity: 'COMPLEX',
          tools: [{ name: 'tool1', confidence: 0.8 }]
        });
      }).toThrow('COMPLEX tasks cannot have tools');
    });
  });

  describe('validation', () => {
    it('should validate required fields', () => {
      expect(() => {
        new TaskNode({});
      }).toThrow('description is required');

      expect(() => {
        new TaskNode({
          description: 'Test'
        });
      }).toThrow('complexity is required');
    });

    it('should validate tool structure', () => {
      expect(() => {
        new TaskNode({
          description: 'Test',
          complexity: 'SIMPLE',
          tools: [{ name: 'tool1' }] // Missing confidence
        });
      }).toThrow('Tool must have confidence score');

      expect(() => {
        new TaskNode({
          description: 'Test',
          complexity: 'SIMPLE',
          tools: [{ confidence: 0.8 }] // Missing name
        });
      }).toThrow('Tool must have name');
    });

    it('should validate confidence scores', () => {
      expect(() => {
        new TaskNode({
          description: 'Test',
          complexity: 'SIMPLE',
          tools: [{ name: 'tool1', confidence: 1.5 }]
        });
      }).toThrow('Confidence must be between 0 and 1');

      expect(() => {
        new TaskNode({
          description: 'Test',
          complexity: 'SIMPLE',
          tools: [{ name: 'tool1', confidence: -0.1 }]
        });
      }).toThrow('Confidence must be between 0 and 1');
    });
  });

  describe('methods', () => {
    it('should add subtask to COMPLEX node', () => {
      const parent = new TaskNode({
        description: 'Parent task',
        complexity: 'COMPLEX'
      });

      const child = new TaskNode({
        description: 'Child task',
        complexity: 'SIMPLE'
      });

      parent.addSubtask(child);
      expect(parent.subtasks).toHaveLength(1);
      expect(parent.subtasks[0]).toBe(child);
    });

    it('should throw when adding subtask to SIMPLE node', () => {
      const parent = new TaskNode({
        description: 'Simple task',
        complexity: 'SIMPLE'
      });

      const child = new TaskNode({
        description: 'Child task',
        complexity: 'SIMPLE'
      });

      expect(() => {
        parent.addSubtask(child);
      }).toThrow('Cannot add subtask to SIMPLE task');
    });

    it('should check if node is leaf (SIMPLE)', () => {
      const simple = new TaskNode({
        description: 'Simple task',
        complexity: 'SIMPLE'
      });

      const complex = new TaskNode({
        description: 'Complex task',
        complexity: 'COMPLEX'
      });

      expect(simple.isLeaf()).toBe(true);
      expect(complex.isLeaf()).toBe(false);
    });

    it('should convert to plain object', () => {
      const node = new TaskNode({
        id: 'task-1',
        description: 'Test task',
        complexity: 'SIMPLE',
        reasoning: 'Test reasoning',
        suggestedInputs: ['input1'],
        suggestedOutputs: ['output1'],
        tools: [{ name: 'tool1', confidence: 0.9 }],
        feasible: true
      });

      const obj = node.toObject();
      expect(obj).toEqual({
        id: 'task-1',
        description: 'Test task',
        complexity: 'SIMPLE',
        reasoning: 'Test reasoning',
        suggestedInputs: ['input1'],
        suggestedOutputs: ['output1'],
        tools: [{ name: 'tool1', confidence: 0.9 }],
        feasible: true,
        subtasks: undefined
      });
    });
  });
});