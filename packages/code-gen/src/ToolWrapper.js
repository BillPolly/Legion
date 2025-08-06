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

  /**
   * Convert to JSON format for ChatAgent compatibility
   */
  toJSON() {
    let inputSchema = { type: 'object', properties: {}, required: [] };
    
    // Try to get input schema from wrapped tool
    if (this.wrappedTool.inputSchema) {
      if (this.wrappedTool.inputSchema._def) {
        // It's a Zod schema - convert it
        inputSchema = this.convertZodToJsonSchema(this.wrappedTool.inputSchema);
      } else if (typeof this.wrappedTool.inputSchema === 'object' && this.wrappedTool.inputSchema.type) {
        // It's already a JSON schema
        inputSchema = this.wrappedTool.inputSchema;
      }
    }

    return {
      name: this.name,
      description: this.description,
      inputSchema: inputSchema
    };
  }

  /**
   * Convert Zod schema to JSON Schema format
   * @private
   */
  convertZodToJsonSchema(schema) {
    if (!schema || !schema._def) {
      return { type: 'object', properties: {}, required: [] };
    }
    
    const def = schema._def;
    
    // Handle ZodObject
    if (def.typeName === 'ZodObject') {
      const properties = {};
      const required = [];
      
      for (const [key, value] of Object.entries(def.shape())) {
        properties[key] = this.convertZodTypeToJsonSchema(value);
        
        // Check if field is required (not optional)
        if (!this.isZodOptional(value)) {
          required.push(key);
        }
      }
      
      return {
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined
      };
    }
    
    return this.convertZodTypeToJsonSchema(schema);
  }

  /**
   * Convert individual Zod type to JSON Schema
   * @private
   */
  convertZodTypeToJsonSchema(zodType) {
    if (!zodType || !zodType._def) {
      return { type: 'string' };
    }
    
    const def = zodType._def;
    const result = {};
    
    // Get description if available
    if (def.description) {
      result.description = def.description;
    }
    
    switch (def.typeName) {
      case 'ZodString':
        result.type = 'string';
        break;
      case 'ZodNumber':
        result.type = 'number';
        break;
      case 'ZodBoolean':
        result.type = 'boolean';
        break;
      case 'ZodArray':
        result.type = 'array';
        if (def.type) {
          result.items = this.convertZodTypeToJsonSchema(def.type);
        }
        break;
      case 'ZodObject':
        return this.convertZodToJsonSchema(zodType);
      case 'ZodOptional':
        return this.convertZodTypeToJsonSchema(def.innerType);
      case 'ZodDefault':
        const innerResult = this.convertZodTypeToJsonSchema(def.innerType);
        innerResult.default = def.defaultValue();
        return innerResult;
      default:
        result.type = 'string'; // fallback
    }
    
    return result;
  }

  /**
   * Check if a Zod type is optional
   * @private
   */
  isZodOptional(zodType) {
    if (!zodType._def) return false;
    
    // Check for ZodOptional
    if (zodType._def.typeName === 'ZodOptional') return true;
    
    // Check for ZodDefault (also makes field optional)
    if (zodType._def.typeName === 'ZodDefault') return true;
    
    return false;
  }
}

/**
 * Helper function to wrap a code-gen tool
 */
export function wrapTool(tool) {
  return new ToolWrapper(tool);
}