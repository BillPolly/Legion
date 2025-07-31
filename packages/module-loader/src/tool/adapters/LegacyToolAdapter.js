import Tool from '../Tool.js';
import { z } from 'zod';

/**
 * LegacyToolAdapter - Adapts old-style tools (with execute method) to new Tool
 * 
 * This adapter wraps tools that follow the old pattern (name, description, inputSchema
 * properties with execute method) and makes them work as Tool instances.
 * This allows gradual migration of existing tools.
 * 
 * @example
 * ```javascript
 * // Old tool with properties
 * const oldTool = {
 *   name: 'old_tool',
 *   description: 'An old-style tool',
 *   inputSchema: { type: 'object', properties: {...} },
 *   execute: async (params) => { ... }
 * };
 * 
 * // Wrap it to use as Tool
 * const adaptedTool = new LegacyToolAdapter(oldTool);
 * 
 * // Now it works with the new system
 * adaptedTool.on('event', (event) => console.log(event));
 * const result = await adaptedTool.run(params);
 * ```
 */
export class LegacyToolAdapter extends Tool {
  /**
   * Create an adapter for a legacy tool
   * @param {Object} legacyTool - The legacy tool to adapt
   * @param {string} legacyTool.name - Tool name
   * @param {string} legacyTool.description - Tool description
   * @param {Object} legacyTool.inputSchema - JSON Schema or Zod schema
   * @param {Function} legacyTool.execute - Execute function
   */
  constructor(legacyTool) {
    // Convert JSON Schema to Zod if needed
    const inputSchema = LegacyToolAdapter.convertSchema(legacyTool.inputSchema);
    
    super({
      name: legacyTool.name,
      description: legacyTool.description,
      inputSchema
    });
    
    this.legacyTool = legacyTool;
  }
  
  /**
   * Execute the legacy tool
   * @param {Object} params - Validated parameters
   * @returns {Promise<*>} Tool result
   */
  async execute(params) {
    try {
      // Emit start event
      this.emit('event', {
        type: 'progress',
        message: `Executing ${this.name}`,
        data: { phase: 'start' }
      });
      
      // Call the legacy tool's execute method
      const result = await this.legacyTool.execute(params);
      
      // Emit completion event
      this.emit('event', {
        type: 'progress',
        message: `Completed ${this.name}`,
        data: { phase: 'complete' }
      });
      
      return result;
      
    } catch (error) {
      // Re-throw to let Tool handle error emission
      throw error;
    }
  }
  
  /**
   * Convert a schema to Zod format
   * @param {Object|z.ZodSchema} schema - JSON Schema or Zod schema
   * @returns {z.ZodSchema} Zod schema
   */
  static convertSchema(schema) {
    // If already a Zod schema, return it
    if (schema && schema._def) {
      return schema;
    }
    
    // If no schema, return z.any()
    if (!schema) {
      return z.any();
    }
    
    // Convert JSON Schema to Zod
    return LegacyToolAdapter.jsonSchemaToZod(schema);
  }
  
  /**
   * Convert JSON Schema to Zod schema
   * This is a basic converter that handles common cases
   * 
   * @param {Object} jsonSchema - JSON Schema object
   * @returns {z.ZodSchema} Zod schema
   */
  static jsonSchemaToZod(jsonSchema) {
    const { type, properties, required = [], items, enum: enumValues } = jsonSchema;
    
    switch (type) {
      case 'object':
        if (!properties) {
          return z.object({});
        }
        
        const shape = {};
        for (const [key, propSchema] of Object.entries(properties)) {
          let fieldSchema = LegacyToolAdapter.jsonSchemaToZod(propSchema);
          
          // Add description if available
          if (propSchema.description) {
            fieldSchema = fieldSchema.describe(propSchema.description);
          }
          
          // Make optional if not in required array
          if (!required.includes(key)) {
            fieldSchema = fieldSchema.optional();
          }
          
          // Add default if specified
          if ('default' in propSchema) {
            fieldSchema = fieldSchema.default(propSchema.default);
          }
          
          shape[key] = fieldSchema;
        }
        
        return z.object(shape);
        
      case 'string':
        let stringSchema = z.string();
        if (jsonSchema.minLength) stringSchema = stringSchema.min(jsonSchema.minLength);
        if (jsonSchema.maxLength) stringSchema = stringSchema.max(jsonSchema.maxLength);
        if (jsonSchema.pattern) stringSchema = stringSchema.regex(new RegExp(jsonSchema.pattern));
        if (enumValues) return z.enum(enumValues);
        return stringSchema;
        
      case 'number':
      case 'integer':
        let numberSchema = type === 'integer' ? z.number().int() : z.number();
        if (jsonSchema.minimum !== undefined) numberSchema = numberSchema.min(jsonSchema.minimum);
        if (jsonSchema.maximum !== undefined) numberSchema = numberSchema.max(jsonSchema.maximum);
        return numberSchema;
        
      case 'boolean':
        return z.boolean();
        
      case 'array':
        const itemSchema = items ? LegacyToolAdapter.jsonSchemaToZod(items) : z.any();
        let arraySchema = z.array(itemSchema);
        if (jsonSchema.minItems) arraySchema = arraySchema.min(jsonSchema.minItems);
        if (jsonSchema.maxItems) arraySchema = arraySchema.max(jsonSchema.maxItems);
        return arraySchema;
        
      case 'null':
        return z.null();
        
      default:
        // Handle union types
        if (Array.isArray(type)) {
          const schemas = type.map(t => LegacyToolAdapter.jsonSchemaToZod({ ...jsonSchema, type: t }));
          return z.union(schemas);
        }
        
        // Fallback to any
        return z.any();
    }
  }
}

/**
 * Helper function to adapt a legacy tool
 * @param {Object} legacyTool - The legacy tool to adapt
 * @returns {LegacyToolAdapter} The adapted tool
 */
export function adaptLegacyTool(legacyTool) {
  return new LegacyToolAdapter(legacyTool);
}

export default LegacyToolAdapter;