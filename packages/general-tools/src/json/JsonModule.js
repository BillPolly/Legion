import { Tool, ToolResult, Module } from '@legion/module-loader';

/**
 * JSON parsing tool with event support
 */
class JsonParseTool extends Tool {
  constructor() {
    super();
    this.name = 'json_parse';
    this.description = 'Parse JSON string into JavaScript object';
  }

  getToolDescription() {
    return {
      type: 'function',
      function: {
        name: 'json_parse',
        description: 'Parse a JSON string into a JavaScript object',
        parameters: {
          type: 'object',
          properties: {
            json_string: {
              type: 'string',
              description: 'The JSON string to parse'
            },
            reviver: {
              type: 'string',
              description: 'Optional reviver function code (advanced use)',
              optional: true
            }
          },
          required: ['json_string']
        }
      }
    };
  }

  async invoke(toolCall) {
    try {
      const args = this.parseArguments(toolCall.function.arguments);
      this.validateRequiredParameters(args, ['json_string']);

      this.emitProgress('Parsing JSON string', {
        length: args.json_string.length
      });

      const result = JSON.parse(args.json_string);

      this.emitInfo('JSON parsed successfully', {
        type: typeof result,
        isArray: Array.isArray(result),
        keys: result && typeof result === 'object' ? Object.keys(result).length : 0
      });

      return ToolResult.success({
        parsed: result,
        result: result,
        type: typeof result,
        isArray: Array.isArray(result)
      });
    } catch (error) {
      this.emitError(`JSON parsing failed: ${error.message}`, {
        error: error.message,
        position: error.message.match(/position (\d+)/) ? 
          parseInt(error.message.match(/position (\d+)/)[1]) : null
      });

      return ToolResult.failure(error.message, {
        error: 'JSON_PARSE_ERROR',
        details: error.message
      });
    }
  }
}

/**
 * JSON stringify tool with event support
 */
class JsonStringifyTool extends Tool {
  constructor() {
    super();
    this.name = 'json_stringify';
    this.description = 'Convert JavaScript object to JSON string';
  }

  getToolDescription() {
    return {
      type: 'function',
      function: {
        name: 'json_stringify',
        description: 'Convert a JavaScript object to a JSON string',
        parameters: {
          type: 'object',
          properties: {
            object: {
              type: 'any',
              description: 'The object to stringify'
            },
            indent: {
              type: 'integer',
              description: 'Number of spaces for indentation (0 for compact)',
              default: 2
            },
            sort_keys: {
              type: 'boolean',
              description: 'Whether to sort object keys alphabetically',
              default: false
            }
          },
          required: ['object']
        }
      }
    };
  }

  async invoke(toolCall) {
    try {
      const args = this.parseArguments(toolCall.function.arguments);
      this.validateRequiredParameters(args, ['object']);

      this.emitProgress('Stringifying object to JSON', {
        type: typeof args.object,
        indent: args.indent || 2
      });

      let result;
      if (args.sort_keys) {
        // Sort keys if requested
        const replacer = (key, value) => {
          if (value && typeof value === 'object' && !Array.isArray(value)) {
            return Object.keys(value).sort().reduce((sorted, key) => {
              sorted[key] = value[key];
              return sorted;
            }, {});
          }
          return value;
        };
        result = JSON.stringify(args.object, replacer, args.indent || 2);
      } else {
        result = JSON.stringify(args.object, null, args.indent || 2);
      }

      this.emitInfo('JSON stringified successfully', {
        length: result.length,
        lines: result.split('\n').length
      });

      return ToolResult.success({
        json: result,
        json_string: result,
        length: result.length
      });
    } catch (error) {
      this.emitError(`JSON stringify failed: ${error.message}`, {
        error: error.message,
        type: error.name
      });

      return ToolResult.failure(error.message, {
        error: 'JSON_STRINGIFY_ERROR',
        details: error.message
      });
    }
  }
}

/**
 * JSON validation tool with event support
 */
class JsonValidateTool extends Tool {
  constructor() {
    super();
    this.name = 'json_validate';
    this.description = 'Validate if a string is valid JSON';
  }

  getToolDescription() {
    return {
      type: 'function',
      function: {
        name: 'json_validate',
        description: 'Validate if a string is valid JSON and provide detailed error information',
        parameters: {
          type: 'object',
          properties: {
            json_string: {
              type: 'string',
              description: 'The JSON string to validate'
            }
          },
          required: ['json_string']
        }
      }
    };
  }

  async invoke(toolCall) {
    try {
      const args = this.parseArguments(toolCall.function.arguments);
      this.validateRequiredParameters(args, ['json_string']);

      this.emitProgress('Validating JSON string', {
        length: args.json_string.length
      });

      try {
        const parsed = JSON.parse(args.json_string);
        
        this.emitInfo('JSON is valid', {
          type: typeof parsed,
          isArray: Array.isArray(parsed)
        });

        return ToolResult.success({
          valid: true,
          isValid: true,
          type: typeof parsed,
          isArray: Array.isArray(parsed),
          message: 'Valid JSON'
        });
      } catch (parseError) {
        // Extract error details
        const errorMatch = parseError.message.match(/position (\d+)/);
        const position = errorMatch ? parseInt(errorMatch[1]) : null;
        
        let line = 1;
        let column = 1;
        if (position !== null) {
          for (let i = 0; i < position && i < args.json_string.length; i++) {
            if (args.json_string[i] === '\n') {
              line++;
              column = 1;
            } else {
              column++;
            }
          }
        }

        this.emitWarning('JSON validation failed', {
          error: parseError.message,
          position,
          line,
          column
        });

        return ToolResult.success({
          valid: false,
          isValid: false,
          error: parseError.message,
          position,
          line,
          column,
          message: `Invalid JSON: ${parseError.message}`
        });
      }
    } catch (error) {
      this.emitError(`Validation error: ${error.message}`, {
        error: error.message
      });

      return ToolResult.failure(error.message, {
        error: 'VALIDATION_ERROR',
        details: error.message
      });
    }
  }
}

/**
 * JSON path extraction tool with event support
 */
class JsonExtractTool extends Tool {
  constructor() {
    super();
    this.name = 'json_extract';
    this.description = 'Extract value from JSON using dot notation path';
  }

  getToolDescription() {
    return {
      type: 'function',
      function: {
        name: 'json_extract',
        description: 'Extract a value from a JSON object using dot notation path',
        parameters: {
          type: 'object',
          properties: {
            json_object: {
              type: 'any',
              description: 'The JSON object to extract from'
            },
            path: {
              type: 'string',
              description: 'Dot notation path (e.g., "user.address.city" or "items[0].name")'
            },
            default_value: {
              type: 'any',
              description: 'Default value if path not found',
              optional: true
            }
          },
          required: ['json_object', 'path']
        }
      }
    };
  }

  async invoke(toolCall) {
    try {
      const args = this.parseArguments(toolCall.function.arguments);
      this.validateRequiredParameters(args, ['json_object', 'path']);

      this.emitProgress(`Extracting value at path: ${args.path}`, {
        path: args.path
      });

      // Parse array notation
      const pathSegments = args.path.split('.').flatMap(segment => {
        const arrayMatch = segment.match(/^(\w+)\[(\d+)\]$/);
        if (arrayMatch) {
          return [arrayMatch[1], parseInt(arrayMatch[2])];
        }
        return segment;
      });

      // Navigate through the object
      let current = args.json_object;
      for (const segment of pathSegments) {
        if (current === null || current === undefined) {
          break;
        }
        current = current[segment];
      }

      const found = current !== undefined;
      const result = found ? current : (args.default_value !== undefined ? args.default_value : null);

      if (found) {
        this.emitInfo(`Value found at path: ${args.path}`, {
          path: args.path,
          type: typeof result
        });
      } else {
        this.emitWarning(`Value not found at path: ${args.path}`, {
          path: args.path,
          usingDefault: args.default_value !== undefined
        });
      }

      return ToolResult.success({
        value: result,
        found,
        path: args.path
      });
    } catch (error) {
      this.emitError(`Extract failed: ${error.message}`, {
        error: error.message,
        path: args.path
      });

      return ToolResult.failure(error.message, {
        error: 'EXTRACT_ERROR',
        details: error.message
      });
    }
  }
}

/**
 * JSON module providing JSON manipulation tools with event support
 */
class JsonModule extends Module {
  static dependencies = [];

  constructor({} = {}) {
    super();
    this.name = 'json';
    this.description = 'JSON manipulation and validation tools for parsing, stringifying, and extracting data from JSON structures';
    
    // Register all JSON tools
    this.tools = [
      new JsonParseTool(),
      new JsonStringifyTool(),
      new JsonValidateTool(),
      new JsonExtractTool()
    ];
  }
}

export default JsonModule;
export { JsonModule, JsonParseTool, JsonStringifyTool, JsonValidateTool, JsonExtractTool };