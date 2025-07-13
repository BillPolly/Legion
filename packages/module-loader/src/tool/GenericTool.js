import Tool from './Tool.js';
import ToolResult from './ToolResult.js';
import { ResultMapper } from '../utils/ResultMapper.js';

/**
 * GenericTool - A tool implementation that wraps library functions
 */
export class GenericTool extends Tool {
  /**
   * @param {Object} config - Tool configuration from module.json
   * @param {*} libraryInstance - The library instance or module
   * @param {string} functionPath - Optional explicit function path
   */
  constructor(config, libraryInstance, functionPath = null) {
    super();
    
    this.name = config.name;
    this.description = config.description;
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
   * Get tool description in OpenAI function format
   * @returns {Object} Tool description
   */
  getToolDescription() {
    const { parameters, output } = this.config;
    
    return {
      type: 'function',
      function: {
        name: this.name,
        description: this.description,
        parameters: parameters || {
          type: 'object',
          properties: {},
          required: []
        },
        output: output || {
          success: {
            type: 'object',
            properties: {
              result: { type: 'any', description: 'Function result' }
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
   * Invoke the tool
   * @param {Object} toolCall - Tool call from LLM
   * @returns {Promise<ToolResult>} The result
   */
  async invoke(toolCall) {
    try {
      // Parse arguments
      let args;
      try {
        args = this.parseArguments(toolCall.function.arguments);
      } catch (error) {
        return ToolResult.failure(`Invalid JSON arguments: ${error.message}`, {
          arguments: toolCall.function.arguments
        });
      }
      
      // Call the function
      const result = await this.callFunction(args);
      
      // Map the result if needed
      const mappedResult = this.mapResult(result);
      
      // Return success
      return ToolResult.success(mappedResult);
      
    } catch (error) {
      // Map error if needed
      const errorData = {
        functionName: this.functionPath,
        errorType: error.constructor.name,
        stack: error.stack,
        originalError: error
      };
      
      const mappedError = this.config.resultMapping 
        ? this.resultMapper.mapError(errorData, this.config.resultMapping)
        : errorData;
      
      // Return failure
      return ToolResult.failure(error.message, mappedError);
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
}

export default GenericTool;