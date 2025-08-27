/**
 * TodoWriteTool - Create and manage a structured task list
 * MVP implementation - manages an in-memory todo list
 */

import { Tool } from '@legion/tools-registry';
import { v4 as uuidv4 } from 'uuid';

export class TodoWriteTool extends Tool {
  constructor() {
    super({
      name: 'TodoWrite',
      description: 'Create and manage a structured task list to track progress and organize complex tasks',
      schema: {
        input: {
          type: 'object',
          properties: {
            todos: {
              type: 'array',
              minItems: 1,
              description: 'The updated todo list',
              items: {
                type: 'object',
                properties: {
                  content: {
                    type: 'string',
                    minLength: 1,
                    description: 'Todo item content'
                  },
                  status: {
                    type: 'string',
                    enum: ['pending', 'in_progress', 'completed'],
                    description: 'Todo status'
                  },
                  id: {
                    type: 'string',
                    description: 'Todo unique identifier'
                  }
                },
                required: ['content', 'status', 'id']
              }
            }
          },
          required: ['todos']
        },
        output: {
          type: 'object',
          properties: {
            todos: {
              type: 'array',
              description: 'Processed todo list with guaranteed unique IDs',
              items: {
                type: 'object',
                properties: {
                  content: {
                    type: 'string',
                    description: 'Todo item content'
                  },
                  status: {
                    type: 'string',
                    enum: ['pending', 'in_progress', 'completed'],
                    description: 'Todo status'
                  },
                  id: {
                    type: 'string',
                    description: 'Todo unique identifier'
                  }
                }
              }
            },
            summary: {
              type: 'object',
              description: 'Summary of todo statuses',
              properties: {
                total: {
                  type: 'integer',
                  description: 'Total number of todos'
                },
                pending: {
                  type: 'integer',
                  description: 'Number of pending todos'
                },
                in_progress: {
                  type: 'integer',
                  description: 'Number of in-progress todos'
                },
                completed: {
                  type: 'integer',
                  description: 'Number of completed todos'
                }
              }
            },
            message: {
              type: 'string',
              description: 'Status message describing the update'
            },
            timestamp: {
              type: 'string',
              description: 'Update timestamp (ISO string)'
            }
          },
          required: ['todos', 'summary', 'message', 'timestamp']
        }
      }
    });
    
    // In-memory storage for MVP
    this.todoList = new Map();
  }

  async execute(input) {
    return await this.manageTodos(input);
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

}