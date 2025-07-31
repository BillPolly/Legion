import ToolResult from '../ToolResult.js';
import { z } from 'zod';

/**
 * OpenAIToolAdapter - Adapts Tool instances to OpenAI function calling format
 * 
 * This adapter wraps tools that extend Tool and provides the OpenAI
 * function calling interface (getToolDescription, invoke) that the LLM expects.
 * 
 * @example
 * ```javascript
 * const tool = new MyTool();
 * const openAITool = new OpenAIToolAdapter(tool);
 * 
 * // Now the tool can be used with OpenAI function calling
 * const description = openAITool.getToolDescription();
 * const result = await openAITool.invoke(toolCall);
 * ```
 */
export class OpenAIToolAdapter {
  /**
   * Create an adapter for a Tool
   * @param {Tool} tool - The Tool instance to adapt
   */
  constructor(tool) {
    this.tool = tool;
    this.name = tool.name;
    this.description = tool.description;
    
    // Store reference to module for legacy compatibility
    this.module = null;
  }
  
  /**
   * Set the parent module (for legacy compatibility)
   * @param {Module} module - The parent module
   */
  setModule(module) {
    this.module = module;
  }
  
  /**
   * Get the tool description in OpenAI function calling format
   * @returns {Object} Tool description
   */
  getToolDescription() {
    const { inputSchema } = this.tool;
    
    // Convert Zod schema to JSON Schema format
    let parameters = {
      type: 'object',
      properties: {},
      required: []
    };
    
    // If we have a Zod schema, try to extract its structure
    if (inputSchema && inputSchema._def) {
      try {
        parameters = this.zodToJsonSchema(inputSchema);
      } catch (error) {
        // Fallback if conversion fails
        console.warn(`Failed to convert Zod schema for ${this.name}:`, error.message);
      }
    }
    
    return {
      type: 'function',
      function: {
        name: this.name,
        description: this.description,
        parameters,
        // Output schema for compatibility
        output: {
          success: {
            type: 'object',
            properties: {
              result: { 
                type: 'any', 
                description: 'The result of the tool execution' 
              }
            }
          },
          failure: {
            type: 'object',
            properties: {
              error: { 
                type: 'string', 
                description: 'Error message if execution failed' 
              },
              details: { 
                type: 'object', 
                description: 'Additional error details' 
              }
            }
          }
        }
      }
    };
  }
  
  /**
   * Invoke the tool using OpenAI function calling format
   * @param {Object} toolCall - The tool call from OpenAI
   * @returns {Promise<ToolResult>} Tool result
   */
  async invoke(toolCall) {
    try {
      // Parse arguments
      let args;
      try {
        args = JSON.parse(toolCall.function.arguments);
      } catch (error) {
        return ToolResult.failure(`Invalid JSON arguments: ${error.message}`, {
          arguments: toolCall.function.arguments
        });
      }
      
      // Execute the Tool
      const result = await this.tool.run(args);
      
      // Return success result
      return ToolResult.success({ result });
      
    } catch (error) {
      // Handle validation errors specially
      if (error.name === 'ValidationError') {
        return ToolResult.failure(error.message, {
          errorType: 'validation_error',
          zodErrors: error.zodErrors
        });
      }
      
      // Return failure result
      return ToolResult.failure(error.message, {
        errorType: error.constructor.name,
        stack: error.stack
      });
    }
  }
  
  /**
   * Convert a basic Zod schema to JSON Schema format
   * This is a simplified conversion that handles common cases
   * 
   * @param {z.ZodSchema} zodSchema - The Zod schema
   * @returns {Object} JSON Schema representation
   */
  zodToJsonSchema(zodSchema) {
    const def = zodSchema._def;
    
    // Handle z.object()
    if (def.typeName === 'ZodObject') {
      const properties = {};
      const required = [];
      
      for (const [key, value] of Object.entries(def.shape())) {
        properties[key] = this.zodFieldToJsonSchema(value);
        
        // Check if field is required (not optional)
        if (!value.isOptional()) {
          required.push(key);
        }
      }
      
      return {
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined
      };
    }
    
    // Fallback for non-object schemas
    return {
      type: 'object',
      properties: {
        value: this.zodFieldToJsonSchema(zodSchema)
      },
      required: ['value']
    };
  }
  
  /**
   * Convert a single Zod field to JSON Schema
   * @param {z.ZodSchema} field - The Zod field
   * @returns {Object} JSON Schema for the field
   */
  zodFieldToJsonSchema(field) {
    const def = field._def;
    const schema = {};
    
    // Get description if available
    if (def.description) {
      schema.description = def.description;
    }
    
    // Map Zod types to JSON Schema types
    switch (def.typeName) {
      case 'ZodString':
        schema.type = 'string';
        if (def.checks) {
          for (const check of def.checks) {
            if (check.kind === 'min') schema.minLength = check.value;
            if (check.kind === 'max') schema.maxLength = check.value;
            if (check.kind === 'regex') schema.pattern = check.regex.source;
          }
        }
        break;
        
      case 'ZodNumber':
        schema.type = 'number';
        if (def.checks) {
          for (const check of def.checks) {
            if (check.kind === 'min') schema.minimum = check.value;
            if (check.kind === 'max') schema.maximum = check.value;
            if (check.kind === 'int') schema.type = 'integer';
          }
        }
        break;
        
      case 'ZodBoolean':
        schema.type = 'boolean';
        break;
        
      case 'ZodArray':
        schema.type = 'array';
        schema.items = this.zodFieldToJsonSchema(def.type);
        break;
        
      case 'ZodEnum':
        schema.enum = def.values;
        break;
        
      case 'ZodOptional':
        return this.zodFieldToJsonSchema(def.innerType);
        
      case 'ZodDefault':
        const innerSchema = this.zodFieldToJsonSchema(def.innerType);
        innerSchema.default = def.defaultValue();
        return innerSchema;
        
      case 'ZodRecord':
        schema.type = 'object';
        schema.additionalProperties = this.zodFieldToJsonSchema(def.valueType);
        break;
        
      default:
        // Fallback for unknown types
        schema.type = 'any';
        break;
    }
    
    return schema;
  }
}

export default OpenAIToolAdapter;