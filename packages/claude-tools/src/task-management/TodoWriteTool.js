/**
 * TodoWriteTool - Create and manage a structured task list
 * MVP implementation - manages an in-memory todo list
 */

import { Tool } from '@legion/tools-registry';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

// Input schema for validation
const todoWriteToolSchema = z.object({
  todos: z.array(z.object({
    content: z.string().min(1),
    status: z.enum(['pending', 'in_progress', 'completed']),
    id: z.string()
  }))
});

export class TodoWriteTool extends Tool {
  constructor() {
    super({
      name: 'TodoWrite',
      description: 'Create and manage a structured task list for your current coding session',
      inputSchema: todoWriteToolSchema,
      execute: async (input) => this.manageTodos(input),
      getMetadata: () => this.getToolMetadata()
    });
    
    // In-memory storage for MVP
    this.todoList = new Map();
  }

  /**
   * Manage todo list
   */
  async manageTodos(input) {
    try {
      const { todos } = input;

      // Clear and update the todo list
      this.todoList.clear();
      
      const processedTodos = [];
      const summary = {
        total: todos.length,
        pending: 0,
        in_progress: 0,
        completed: 0
      };

      for (const todo of todos) {
        // Ensure each todo has an ID
        const todoWithId = {
          ...todo,
          id: todo.id || uuidv4()
        };

        // Store in map
        this.todoList.set(todoWithId.id, todoWithId);
        processedTodos.push(todoWithId);

        // Update summary
        summary[todoWithId.status]++;
      }

      // Generate status message
      let statusMessage = `Todo list updated: ${summary.total} items total`;
      if (summary.in_progress > 0) {
        statusMessage += `, ${summary.in_progress} in progress`;
      }
      if (summary.completed > 0) {
        statusMessage += `, ${summary.completed} completed`;
      }
      if (summary.pending > 0) {
        statusMessage += `, ${summary.pending} pending`;
      }

      return {
        success: true,
        data: {
          todos: processedTodos,
          summary: summary,
          message: statusMessage,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'EXECUTION_ERROR',
          message: `Failed to manage todos: ${error.message}`,
          details: error.stack
        }
      };
    }
  }

  /**
   * Get current todo list (helper method for MVP)
   */
  getTodoList() {
    return Array.from(this.todoList.values());
  }

  /**
   * Get tool metadata
   */
  getToolMetadata() {
    return {
      name: 'TodoWrite',
      description: 'Create and manage a structured task list for your current coding session',
      input: {
        todos: {
          type: 'array',
          required: true,
          description: 'The updated todo list',
          items: {
            content: {
              type: 'string',
              required: true,
              description: 'Todo item content'
            },
            status: {
              type: 'string',
              required: true,
              description: 'Todo status',
              enum: ['pending', 'in_progress', 'completed']
            },
            id: {
              type: 'string',
              required: true,
              description: 'Todo unique identifier'
            }
          }
        }
      },
      output: {
        todos: {
          type: 'array',
          description: 'Processed todo list'
        },
        summary: {
          type: 'object',
          description: 'Summary of todo statuses'
        },
        message: {
          type: 'string',
          description: 'Status message'
        },
        timestamp: {
          type: 'string',
          description: 'Update timestamp'
        }
      }
    };
  }
}