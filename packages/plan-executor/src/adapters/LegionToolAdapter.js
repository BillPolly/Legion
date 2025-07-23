/**
 * LegionToolAdapter - Wraps our debugging tools to make them Legion-compatible
 * 
 * This adapter converts our property-based tools to the method-based Legion interface
 * without requiring us to rewrite all our tools and tests.
 */

import { Tool, ToolResult } from '@legion/module-loader';

export class LegionToolAdapter extends Tool {
  constructor(wrappedTool) {
    super();
    this.wrappedTool = wrappedTool;
    
    // Delegate properties from the wrapped tool
    this.name = wrappedTool.name;
    this.description = wrappedTool.description;
  }

  // Delegate any missing methods or properties to the wrapped tool
  get inputSchema() {
    return this.wrappedTool.inputSchema;
  }
  
  // Provide execute method for backward compatibility
  async execute(params) {
    return this.wrappedTool.execute(params);
  }

  // Delegate method calls and property access to wrapped tool
  _getExecutionContext() {
    if (this.wrappedTool._getExecutionContext) {
      return this.wrappedTool._getExecutionContext();
    }
    return null;
  }

  getToolDescription() {
    return {
      type: 'function',
      function: {
        name: this.wrappedTool.name,
        description: this.wrappedTool.description,
        parameters: this.wrappedTool.inputSchema,
        output: {
          success: {
            type: 'object',
            description: 'Successful execution result',
            properties: {
              success: { type: 'boolean', const: true }
            }
          },
          failure: {
            type: 'object',
            description: 'Failed execution result',
            properties: {
              success: { type: 'boolean', const: false },
              error: { type: 'string', description: 'Error message' }
            }
          }
        }
      }
    };
  }

  async invoke(toolCall) {
    try {
      // Parse the arguments from the tool call
      const args = this.parseArguments(toolCall.function.arguments);
      
      // Execute the wrapped tool's execute method
      const result = await this.wrappedTool.execute(args);
      
      // Convert the result to ToolResult format
      if (result.success !== false) {
        // If success is not explicitly false, treat as success
        return ToolResult.success(result);
      } else {
        // Handle explicit failures
        return ToolResult.failure(result.error || 'Tool execution failed', result);
      }
    } catch (error) {
      return ToolResult.failure(error.message, { originalError: error.name });
    }
  }
}