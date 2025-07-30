/**
 * ToolWrapper - Adapts code-gen tools to Legion Tool interface
 * 
 * This wrapper allows code-gen tools that use execute/emit pattern
 * to work with Legion's invoke/ToolResult pattern.
 */

import { Tool as LegionTool, ToolResult } from '@legion/module-loader';

export class ToolWrapper extends LegionTool {
  constructor(wrappedTool) {
    super();
    this.wrappedTool = wrappedTool;
    this.name = wrappedTool.name;
    this.description = wrappedTool.description;
    
    // Store events emitted during execution
    this.events = [];
  }

  /**
   * Returns the tool description in standard function calling format
   */
  getToolDescription() {
    return {
      type: 'function',
      function: {
        name: this.name,
        description: this.description,
        parameters: this.wrappedTool.inputSchema || {
          type: 'object',
          properties: {},
          required: []
        },
        output: this.wrappedTool.outputSchema || {
          success: {
            type: 'object',
            properties: {
              result: { type: 'any', description: 'Tool execution result' }
            }
          },
          failure: {
            type: 'object',
            properties: {
              error: { type: 'string', description: 'Error message' },
              details: { type: 'object', description: 'Error details' }
            }
          }
        }
      }
    };
  }

  /**
   * Invoke the wrapped tool
   */
  async invoke(toolCall) {
    // Parse arguments from the tool call
    let args;
    try {
      args = typeof toolCall.function.arguments === 'string' 
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments;
    } catch (error) {
      return ToolResult.failure('Invalid JSON arguments', {
        error: error.message,
        arguments: toolCall.function.arguments
      });
    }

    // Clear events from previous execution
    this.events = [];

    // Mock the emit function to capture events
    const originalEmit = this.wrappedTool.emit;
    this.wrappedTool.emit = (eventType, data) => {
      this.events.push({ type: eventType, data });
    };

    try {
      // Execute the wrapped tool
      const result = await this.wrappedTool.execute(args);
      
      // Restore original emit
      this.wrappedTool.emit = originalEmit;

      // Return successful result
      return ToolResult.success(result);
    } catch (error) {
      // Restore original emit
      this.wrappedTool.emit = originalEmit;

      // Return failure result
      return ToolResult.failure(error.message || 'Tool execution failed', {
        toolName: this.name,
        error: error.toString(),
        stack: error.stack,
        events: this.events
      });
    }
  }

  /**
   * Direct execute method for backward compatibility
   */
  async execute(args) {
    // Create a mock tool call
    const toolCall = {
      id: 'direct-execute',
      type: 'function',
      function: {
        name: this.name,
        arguments: args
      }
    };

    const result = await this.invoke(toolCall);
    
    if (result.success) {
      return result.data;
    } else {
      throw new Error(result.error);
    }
  }
}

/**
 * Helper function to wrap a code-gen tool
 */
export function wrapTool(tool) {
  return new ToolWrapper(tool);
}