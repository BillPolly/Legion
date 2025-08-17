/**
 * Unit tests for SyntheticTool class
 */

import { describe, it, expect } from '@jest/globals';
import { SyntheticTool } from '../../SyntheticTool.js';

describe('SyntheticTool', () => {
  describe('creation', () => {
    it('should create a synthetic tool with required fields', () => {
      const tool = new SyntheticTool({
        name: 'task_create_database',
        description: 'Create database with schema',
        inputSchema: {
          config: { type: 'object', required: true },
          name: { type: 'string', required: true }
        },
        outputSchema: {
          connection: { type: 'object' },
          schema: { type: 'object' }
        },
        executionPlan: {
          type: 'sequence',
          children: []
        }
      });

      expect(tool.name).toBe('task_create_database');
      expect(tool.description).toBe('Create database with schema');
      expect(tool.type).toBe('synthetic');
      expect(tool.inputSchema).toBeDefined();
      expect(tool.outputSchema).toBeDefined();
      expect(tool.executionPlan).toBeDefined();
    });

    it('should generate unique ID', () => {
      const tool1 = new SyntheticTool({
        name: 'tool1',
        description: 'Test tool 1',
        executionPlan: {}
      });
      
      const tool2 = new SyntheticTool({
        name: 'tool2',
        description: 'Test tool 2',
        executionPlan: {}
      });

      expect(tool1.id).toBeDefined();
      expect(tool2.id).toBeDefined();
      expect(tool1.id).not.toBe(tool2.id);
    });

    it('should set default values', () => {
      const tool = new SyntheticTool({
        name: 'minimal_tool',
        description: 'Minimal tool',
        executionPlan: { type: 'action' }
      });

      expect(tool.type).toBe('synthetic');
      expect(tool.inputSchema).toEqual({});
      expect(tool.outputSchema).toEqual({});
      expect(tool.metadata).toBeDefined();
      expect(tool.metadata.createdAt).toBeDefined();
    });

    it('should throw error for missing required fields', () => {
      expect(() => new SyntheticTool({})).toThrow('name is required');
      
      expect(() => new SyntheticTool({
        name: 'test'
      })).toThrow('description is required');
      
      expect(() => new SyntheticTool({
        name: 'test',
        description: 'test'
      })).toThrow('executionPlan is required');
    });
  });

  describe('validation', () => {
    it('should validate tool structure', () => {
      const tool = new SyntheticTool({
        name: 'valid_tool',
        description: 'Valid tool',
        inputSchema: {
          param1: { type: 'string', required: true }
        },
        outputSchema: {
          result: { type: 'object' }
        },
        executionPlan: {
          type: 'sequence',
          children: []
        }
      });

      const validation = tool.validate();
      expect(validation.valid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    it('should detect invalid execution plan', () => {
      const tool = new SyntheticTool({
        name: 'invalid_tool',
        description: 'Invalid tool',
        executionPlan: {
          // Missing type
          children: []
        }
      });

      const validation = tool.validate();
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Execution plan missing type');
    });

    it('should validate schema consistency', () => {
      const tool = new SyntheticTool({
        name: 'tool',
        description: 'Tool with schemas',
        inputSchema: {
          input1: { type: 'invalid_type' }
        },
        outputSchema: {
          output1: { type: 'string' }
        },
        executionPlan: { type: 'action' }
      });

      const validation = tool.validate();
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('Invalid type'))).toBe(true);
    });
  });

  describe('interface', () => {
    it('should provide tool interface compatible with real tools', () => {
      const tool = new SyntheticTool({
        name: 'compatible_tool',
        description: 'Compatible with real tools',
        inputSchema: {
          text: { type: 'string', required: true }
        },
        outputSchema: {
          processed: { type: 'string' }
        },
        executionPlan: { type: 'action' }
      });

      // Should have interface similar to real tools
      expect(tool.name).toBeDefined();
      expect(tool.description).toBeDefined();
      expect(tool.inputSchema).toBeDefined();
      expect(tool.outputSchema).toBeDefined();
      expect(tool.type).toBe('synthetic');
    });

    it('should be JSON serializable', () => {
      const tool = new SyntheticTool({
        name: 'serializable_tool',
        description: 'Can be serialized',
        inputSchema: { param: { type: 'string' } },
        outputSchema: { result: { type: 'object' } },
        executionPlan: {
          type: 'sequence',
          children: [
            { type: 'action', tool: 'some_tool' }
          ]
        }
      });

      const json = JSON.stringify(tool);
      const parsed = JSON.parse(json);
      
      expect(parsed.name).toBe('serializable_tool');
      expect(parsed.type).toBe('synthetic');
      expect(parsed.executionPlan).toBeDefined();
    });
  });

  describe('metadata', () => {
    it('should track source task information', () => {
      const tool = new SyntheticTool({
        name: 'tracked_tool',
        description: 'Tool with source tracking',
        executionPlan: { type: 'action' },
        metadata: {
          sourceTaskId: 'task-123',
          sourceTaskDescription: 'Original task',
          level: 2,
          parentTaskId: 'parent-456'
        }
      });

      expect(tool.metadata.sourceTaskId).toBe('task-123');
      expect(tool.metadata.level).toBe(2);
      expect(tool.metadata.parentTaskId).toBe('parent-456');
    });

    it('should include creation timestamp', () => {
      const before = Date.now();
      const tool = new SyntheticTool({
        name: 'timed_tool',
        description: 'Tool with timestamp',
        executionPlan: { type: 'action' }
      });
      const after = Date.now();

      expect(tool.metadata.createdAt).toBeGreaterThanOrEqual(before);
      expect(tool.metadata.createdAt).toBeLessThanOrEqual(after);
    });
  });
});