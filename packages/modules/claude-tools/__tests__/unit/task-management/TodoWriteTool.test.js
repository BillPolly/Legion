/**
 * Unit tests for TodoWriteTool
 */

import { TodoWriteTool } from '../../../src/task-management/TodoWriteTool.js';
import { jest } from '@jest/globals';

describe('TodoWriteTool', () => {
  let tool;

  beforeEach(() => {
    tool = new TodoWriteTool();
  });

  describe('constructor', () => {
    it('should create tool with correct metadata', () => {
      expect(tool.name).toBe('TodoWrite');
      expect(tool.description).toBe('Create and manage a structured task list for your current coding session');
    });

    it('should initialize empty todo list', () => {
      expect(tool.todoList).toBeDefined();
      expect(tool.todoList.size).toBe(0);
    });
  });

  describe('manageTodos', () => {
    it('should create and manage todo list', async () => {
      const input = {
        todos: [
          { content: 'Write tests', status: 'completed', id: 'test-1' },
          { content: 'Implement feature', status: 'in_progress', id: 'test-2' },
          { content: 'Update documentation', status: 'pending', id: 'test-3' }
        ]
      };

      const result = await tool.execute(input);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.todos).toHaveLength(3);
      expect(result.data.todos[0].content).toBe('Write tests');
      expect(result.data.summary.total).toBe(3);
      expect(result.data.summary.completed).toBe(1);
      expect(result.data.summary.in_progress).toBe(1);
      expect(result.data.summary.pending).toBe(1);
    });

    it('should generate IDs for todos without IDs', async () => {
      const input = {
        todos: [
          { content: 'Task without ID', status: 'pending', id: '' }
        ]
      };

      const result = await tool.execute(input);

      expect(result.success).toBe(true);
      expect(result.data.todos[0].id).toBeDefined();
      expect(result.data.todos[0].id).not.toBe('');
    });

    it('should update existing todo list', async () => {
      // First set
      const input1 = {
        todos: [
          { content: 'First task', status: 'pending', id: 'task-1' }
        ]
      };
      await tool.execute(input1);

      // Update
      const input2 = {
        todos: [
          { content: 'First task', status: 'completed', id: 'task-1' },
          { content: 'Second task', status: 'pending', id: 'task-2' }
        ]
      };
      const result = await tool.execute(input2);

      expect(result.success).toBe(true);
      expect(result.data.todos).toHaveLength(2);
      expect(result.data.summary.total).toBe(2);
      expect(result.data.summary.completed).toBe(1);
      expect(result.data.summary.pending).toBe(1);
    });

    it('should generate appropriate status message', async () => {
      const input = {
        todos: [
          { content: 'Task 1', status: 'completed', id: '1' },
          { content: 'Task 2', status: 'in_progress', id: '2' },
          { content: 'Task 3', status: 'pending', id: '3' }
        ]
      };

      const result = await tool.execute(input);

      expect(result.success).toBe(true);
      expect(result.data.message).toContain('3 items total');
      expect(result.data.message).toContain('1 in progress');
      expect(result.data.message).toContain('1 completed');
      expect(result.data.message).toContain('1 pending');
    });

    it('should handle empty todo list', async () => {
      const input = {
        todos: []
      };

      const result = await tool.execute(input);

      expect(result.success).toBe(true);
      expect(result.data.todos).toHaveLength(0);
      expect(result.data.summary.total).toBe(0);
      expect(result.data.message).toContain('0 items total');
    });

    it('should validate todo status values', async () => {
      const input = {
        todos: [
          { content: 'Invalid status', status: 'invalid', id: 'test-1' }
        ]
      };

      const result = await tool.execute(input);

      expect(result.success).toBe(false);
      // Validation error could be in data or error field
      expect(result.data || result.error).toBeDefined();
    });

    it('should validate todo content is not empty', async () => {
      const input = {
        todos: [
          { content: '', status: 'pending', id: 'test-1' }
        ]
      };

      const result = await tool.execute(input);

      expect(result.success).toBe(false);
      // Validation error could be in data or error field
      expect(result.data || result.error).toBeDefined();
    });

    it('should include timestamp in response', async () => {
      const input = {
        todos: [
          { content: 'Test task', status: 'pending', id: 'test-1' }
        ]
      };

      const result = await tool.execute(input);

      expect(result.success).toBe(true);
      expect(result.data.timestamp).toBeDefined();
      expect(new Date(result.data.timestamp)).toBeInstanceOf(Date);
    });
  });

  describe('getTodoList', () => {
    it('should return current todo list', async () => {
      const input = {
        todos: [
          { content: 'Task 1', status: 'pending', id: '1' },
          { content: 'Task 2', status: 'completed', id: '2' }
        ]
      };

      await tool.execute(input);
      const todoList = tool.getTodoList();

      expect(todoList).toBeInstanceOf(Array);
      expect(todoList).toHaveLength(2);
      expect(todoList[0].content).toBe('Task 1');
      expect(todoList[1].content).toBe('Task 2');
    });
  });

  describe('getToolMetadata', () => {
    it('should return complete metadata', () => {
      const metadata = tool.getMetadata();

      expect(metadata.name).toBe('TodoWrite');
      expect(metadata.description).toBe('Create and manage a structured task list for your current coding session');
      expect(metadata.inputSchema).toBeDefined();
      expect(metadata.inputSchema.properties).toBeDefined();
      expect(metadata.inputSchema.properties.todos).toBeDefined();
      expect(metadata.inputSchema.required).toContain('todos');
      expect(metadata.inputSchema.properties.todos.items).toBeDefined();
      expect(metadata.outputSchema).toBeDefined();
      expect(metadata.outputSchema.properties.summary).toBeDefined();
    });
  });
});