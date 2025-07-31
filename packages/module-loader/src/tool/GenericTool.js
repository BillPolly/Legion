import Tool from './Tool.js';
import { ResultMapper } from '../utils/ResultMapper.js';
import { z } from 'zod';

/**
 * GenericTool - A tool implementation that wraps library functions
 * This is used by module.json files to create tools from library functions
 */
export class GenericTool extends Tool {
  /**
   * @param {Object} config - Tool configuration from module.json
   * @param {*} libraryInstance - The library instance or module
   * @param {string} functionPath - Optional explicit function path
   */
  constructor(config, libraryInstance, functionPath = null) {
    // Convert JSON Schema parameters to basic Zod schema
    const zodSchema = config.parameters ? GenericTool.jsonSchemaToZod(config.parameters) : z.any();
    
    super({
      name: config.name,
      description: config.description,
      inputSchema: zodSchema
    });
    
    this.config = config;
    this.library = libraryInstance;
    this.functionPath = functionPath || config.function;
    
    // Resolve the target function
    this.targetFunction = this.resolveFunction(this.functionPath);
    
    // Create result mapper
    this.resultMapper = new ResultMapper();
  }
  
  /**
   * Resolve function from library using path
   * @param {string} path - Function path (e.g., "method", "utils.format", "methods[0]")
   * @returns {Function} The resolved function
   */
  resolveFunction(path) {
    let current = this.library;
    const parts = path.split(/[\.\[\]]+/).filter(Boolean);
    
    for (const part of parts) {
      if (current == null) {
        throw new Error(`Cannot resolve path '${path}': ${part} is null or undefined`);
      }
      
      // Handle numeric indices
      if (/^\d+$/.test(part)) {
        current = current[parseInt(part, 10)];
      } else {
        current = current[part];
      }
    }
    
    if (typeof current !== 'function') {
      throw new Error(`Function '${path}' not found or is not a function`);
    }
    
    return current;
  }
  
  /**
   * Execute the tool with validated parameters
   * @param {Object} params - Validated parameters
   * @returns {Promise<*>} Tool result
   */
  async execute(params) {
    try {
      // Emit progress
      this.progress(`Executing ${this.functionPath}`, 0);
      
      // Call the function
      const result = await this.callFunction(params);
      
      // Map the result if needed
      const mappedResult = this.mapResult(result);
      
      // Emit completion
      this.progress(`Completed ${this.functionPath}`, 100);
      
      return mappedResult;
      
    } catch (error) {
      // Re-throw to let Tool base class handle error emission
      throw error;
    }
  }
  
  /**
   * Call the target function with arguments
   * @param {Object} args - Parsed arguments
   * @returns {Promise<*>} Function result
   */
  async callFunction(args) {
    const { instanceMethod = true, async: isAsync = true } = this.config;
    
    // Convert object arguments to array for function call
    const argArray = this.prepareArguments(args);
    
    // Determine the context (this binding)
    const context = instanceMethod ? this.library : null;
    
    // Call the function
    if (isAsync) {
      return await this.targetFunction.apply(context, argArray);
    } else {
      return this.targetFunction.apply(context, argArray);
    }
  }
  
  /**
   * Prepare arguments for function call
   * @private
   */
  prepareArguments(args) {
    const { parameters } = this.config;
    
    // If no parameters defined, pass the whole args object
    if (!parameters || !parameters.properties) {
      return [args];
    }
    
    // Get the parameter names in order
    const properties = Object.keys(parameters.properties);
    
    // If we have exactly the same keys as parameters, extract them in order
    const argKeys = Object.keys(args);
    if (properties.length > 1 && argKeys.every(key => properties.includes(key))) {
      // Multiple parameters - pass as separate arguments
      return properties.map(prop => args[prop]);
    }
    
    // Otherwise, pass the whole args object
    return [args];
  }
  
  /**
   * Map function result to expected format
   * @param {*} result - Raw function result
   * @returns {*} Mapped result
   */
  mapResult(result) {
    const { resultMapping } = this.config;
    return this.resultMapper.mapResult(result, resultMapping);
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
          let fieldSchema = GenericTool.jsonSchemaToZod(propSchema);
          
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
        const itemSchema = items ? GenericTool.jsonSchemaToZod(items) : z.any();
        let arraySchema = z.array(itemSchema);
        if (jsonSchema.minItems) arraySchema = arraySchema.min(jsonSchema.minItems);
        if (jsonSchema.maxItems) arraySchema = arraySchema.max(jsonSchema.maxItems);
        return arraySchema;
        
      case 'null':
        return z.null();
        
      default:
        // Handle union types
        if (Array.isArray(type)) {
          const schemas = type.map(t => GenericTool.jsonSchemaToZod({ ...jsonSchema, type: t }));
          return z.union(schemas);
        }
        
        // Fallback to any
        return z.any();
    }
  }
}

export default GenericTool;