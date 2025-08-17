/**
 * Unit tests for SyntheticToolFactory
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { SyntheticToolFactory } from '../../SyntheticToolFactory.js';
import { SyntheticTool } from '../../SyntheticTool.js';

describe('SyntheticToolFactory', () => {
  let factory;

  beforeEach(() => {
    factory = new SyntheticToolFactory();
  });

  describe('creation', () => {
    it('should create factory instance', () => {
      expect(factory).toBeDefined();
      expect(factory.toolCounter).toBe(0);
    });
  });

  describe('createFromBT', () => {
    it('should create synthetic tool from behavior tree', () => {
      const bt = {
        type: 'sequence',
        id: 'create-db',
        description: 'Create database',
        children: [
          { type: 'action', tool: 'create_schema', outputVariable: 'schema' },
          { type: 'action', tool: 'run_migrations' }
        ]
      };

      const taskNode = {
        id: 'task-123',
        description: 'Create and configure database',
        suggestedInputs: ['config', 'credentials'],
        suggestedOutputs: ['connection', 'schema']
      };

      const tool = factory.createFromBT(bt, taskNode);

      expect(tool).toBeInstanceOf(SyntheticTool);
      expect(tool.name).toContain('task_');
      expect(tool.description).toBe('Create and configure database');
      expect(tool.executionPlan).toBe(bt);
      expect(tool.metadata.sourceTaskId).toBe('task-123');
    });

    it('should generate unique tool names', () => {
      const bt = { type: 'action', tool: 'test' };
      const task1 = { id: 't1', description: 'Task 1' };
      const task2 = { id: 't2', description: 'Task 2' };

      const tool1 = factory.createFromBT(bt, task1);
      const tool2 = factory.createFromBT(bt, task2);

      expect(tool1.name).not.toBe(tool2.name);
      expect(factory.toolCounter).toBe(2);
    });

    it('should handle missing task description', () => {
      const bt = { type: 'sequence', children: [] };
      const task = { id: 'task-1' };

      const tool = factory.createFromBT(bt, task);
      expect(tool.description).toContain('Synthetic tool for task-1');
    });

    it('should include level in metadata', () => {
      const bt = { type: 'action' };
      const task = {
        id: 'task-1',
        description: 'Test task',
        level: 2
      };

      const tool = factory.createFromBT(bt, task);
      expect(tool.metadata.level).toBe(2);
    });
  });

  describe('extractInterface', () => {
    it('should extract interface from BT artifacts', () => {
      const bt = {
        type: 'sequence',
        children: [
          { 
            type: 'action', 
            tool: 'read_config',
            params: { url: '{{context.inputs.database_url}}' },
            outputVariable: 'config'
          },
          {
            type: 'action',
            tool: 'create_connection',
            params: { 
              config: '{{context.artifacts.config}}',
              creds: '{{context.inputs.credentials}}'
            },
            outputVariable: 'connection'
          },
          {
            type: 'action',
            tool: 'create_schema',
            outputVariable: 'schema'
          }
        ]
      };

      const interface_ = factory.extractInterface(bt);

      // Should extract inputs from BT parameter references
      expect(interface_.inputs).toContain('database_url');
      expect(interface_.inputs).toContain('credentials');
      // Should extract outputs from outputVariables
      expect(interface_.outputs).toContain('connection');
      expect(interface_.outputs).toContain('schema');
      expect(interface_.outputs).toContain('config');
    });

    it('should extract outputs from BT outputVariables', () => {
      const bt = {
        type: 'sequence',
        children: [
          { type: 'action', outputVariable: 'var1' },
          { type: 'action', outputVariable: 'var2' },
          { type: 'action' } // No output
        ]
      };

      const interface_ = factory.extractInterface(bt, {});
      expect(interface_.outputs).toContain('var1');
      expect(interface_.outputs).toContain('var2');
      expect(interface_.outputs).toHaveLength(2);
    });

    it('should handle nested BT structures', () => {
      const bt = {
        type: 'sequence',
        children: [
          {
            type: 'parallel',
            children: [
              { type: 'action', outputVariable: 'parallel1' },
              { type: 'action', outputVariable: 'parallel2' }
            ]
          },
          {
            type: 'selector',
            children: [
              { type: 'action', outputVariable: 'selector1' }
            ]
          }
        ]
      };

      const interface_ = factory.extractInterface(bt, {});
      expect(interface_.outputs).toContain('parallel1');
      expect(interface_.outputs).toContain('parallel2');
      expect(interface_.outputs).toContain('selector1');
    });

    it('should deduplicate outputs', () => {
      const bt = {
        type: 'sequence',
        children: [
          { type: 'action', outputVariable: 'duplicate' },
          { type: 'action', outputVariable: 'duplicate' },
          { type: 'action', outputVariable: 'unique' }
        ]
      };

      const interface_ = factory.extractInterface(bt, {});
      expect(interface_.outputs).toEqual(['duplicate', 'unique']);
    });
  });

  describe('generateMetadata', () => {
    it('should generate metadata from task and BT', () => {
      const task = {
        id: 'task-456',
        description: 'Process data',
        level: 3,
        parentId: 'parent-123'
      };

      const bt = {
        type: 'sequence',
        id: 'bt-789',
        children: []
      };

      const metadata = factory.generateMetadata(task, bt);

      expect(metadata.sourceTaskId).toBe('task-456');
      expect(metadata.sourceTaskDescription).toBe('Process data');
      expect(metadata.level).toBe(3);
      expect(metadata.parentTaskId).toBe('parent-123');
      expect(metadata.btId).toBe('bt-789');
      expect(metadata.createdAt).toBeDefined();
    });

    it('should handle missing optional fields', () => {
      const task = { id: 'minimal' };
      const bt = { type: 'action' };

      const metadata = factory.generateMetadata(task, bt);

      expect(metadata.sourceTaskId).toBe('minimal');
      expect(metadata.level).toBeUndefined();
      expect(metadata.parentTaskId).toBeUndefined();
      expect(metadata.btId).toBeUndefined();
    });
  });

  describe('createExecutor', () => {
    it('should create executor function for BT', () => {
      const bt = {
        type: 'sequence',
        children: [
          { type: 'action', tool: 'test_tool' }
        ]
      };

      const executor = factory.createExecutor(bt);

      expect(typeof executor).toBe('function');
      expect(executor.name).toBe('executeSyntheticTool');
    });

    it('should create executor that returns the BT', () => {
      const bt = {
        type: 'action',
        tool: 'some_tool',
        params: { param1: 'value1' }
      };

      const executor = factory.createExecutor(bt);
      const result = executor({ input: 'test' });

      expect(result.behaviorTree).toBe(bt);
      expect(result.inputs).toEqual({ input: 'test' });
    });
  });

  describe('generateSchemas', () => {
    it('should generate input/output schemas from interface', () => {
      const interface_ = {
        inputs: ['config', 'credentials'],
        outputs: ['connection', 'schema']
      };

      const schemas = factory.generateSchemas(interface_);

      expect(schemas.inputSchema).toBeDefined();
      expect(schemas.outputSchema).toBeDefined();
      expect(schemas.inputSchema.config).toEqual({ type: 'object', required: false });
      expect(schemas.inputSchema.credentials).toEqual({ type: 'object', required: false });
      expect(schemas.outputSchema.connection).toEqual({ type: 'object' });
      expect(schemas.outputSchema.schema).toEqual({ type: 'object' });
    });

    it('should handle empty interface', () => {
      const interface_ = {
        inputs: [],
        outputs: []
      };

      const schemas = factory.generateSchemas(interface_);

      expect(schemas.inputSchema).toEqual({});
      expect(schemas.outputSchema).toEqual({});
    });
  });

  describe('full tool creation', () => {
    it('should create complete synthetic tool', () => {
      const bt = {
        type: 'sequence',
        id: 'process-data',
        description: 'Process CSV data',
        children: [
          {
            type: 'action',
            tool: 'read_csv',
            params: { file: '{{context.inputs.filepath}}' },
            outputVariable: 'data'
          },
          {
            type: 'action',
            tool: 'transform_data',
            params: { data: '{{context.artifacts.data}}' },
            outputVariable: 'transformed'
          },
          {
            type: 'action',
            tool: 'write_output',
            params: { data: '{{context.artifacts.transformed}}' },
            outputVariable: 'result'
          }
        ]
      };

      const task = {
        id: 'task-csv',
        description: 'Process CSV file and transform data',
        level: 2
      };

      const tool = factory.createFromBT(bt, task);

      // Validate tool structure
      expect(tool.name).toMatch(/^task_\d+_task-csv$/);
      expect(tool.description).toBe('Process CSV file and transform data');
      expect(tool.type).toBe('synthetic');
      
      // Validate interface extraction (from actual BT, not hints)
      expect(tool.inputSchema.filepath).toBeDefined();
      expect(tool.outputSchema.result).toBeDefined();
      expect(tool.outputSchema.transformed).toBeDefined();
      expect(tool.outputSchema.data).toBeDefined(); // intermediate output
      
      // Validate metadata
      expect(tool.metadata.sourceTaskId).toBe('task-csv');
      expect(tool.metadata.level).toBe(2);
      
      // Validate it's a valid SyntheticTool
      const validation = tool.validate();
      if (!validation.valid) {
        console.log('Validation errors:', validation.errors);
      }
      expect(validation.valid).toBe(true);
    });
  });
});