/**
 * NOTE: Validation has been removed from this tool.
 * All validation now happens at the invocation layer.
 * Tools only define schemas as plain JSON Schema objects.
 */

import { Tool, Module } from '@legion/tools-registry';

/**
 * JSON parsing tool with event support
 */
class JsonParseTool extends Tool {
  constructor() {
    super({
      name: 'json_parse',
      description: 'Parse JSON string into JavaScript object',
      inputSchema: {
        type: 'object',
        properties: {
          json_string: {
            type: 'string',
            description: 'The JSON string to parse'
          },
          reviver: {
            type: 'string',
            description: 'Optional reviver function code (advanced use)'
          }
        },
        required: ['json_string']
      },
      outputSchema: {
        type: 'object',
        properties: {
          parsed: {
            description: 'The parsed JavaScript object'
          },
          result: {
            description: 'The parsed JavaScript object (duplicate for compatibility)'
          },
          type: {
            type: 'string',
            description: 'The type of the parsed result'
          },
          isArray: {
            type: 'boolean',
            description: 'Whether the parsed result is an array'
          }
        },
        required: ['parsed', 'result', 'type', 'isArray']
      }
    });
    
    // Override _execute instead of execute to use base class error handling
    this._execute = async (params) => this._executeJsonParse(params);
  }

  async _executeJsonParse(params) {
    const { json_string, reviver } = params;

    this.progress('Parsing JSON string', 50, {
      length: json_string.length
    });

    const result = JSON.parse(json_string, reviver);

    this.info('JSON parsed successfully', {
      type: typeof result,
      isArray: Array.isArray(result),
      keys: result && typeof result === 'object' ? Object.keys(result).length : 0
    });

    return {
      parsed: result,
      result: result,
      type: typeof result,
      isArray: Array.isArray(result)
    };
  }
}

/**
 * JSON stringify tool with event support
 */
class JsonStringifyTool extends Tool {
  constructor() {
    super({
      name: 'json_stringify',
      description: 'Convert JavaScript object to JSON string',
      inputSchema: {
        type: 'object',
        properties: {
          object: {
            description: 'The object to stringify'
          },
          indent: {
            type: 'number',
            default: 2,
            description: 'Number of spaces for indentation (0 for compact)'
          },
          sort_keys: {
            type: 'boolean',
            default: false,
            description: 'Whether to sort object keys alphabetically'
          }
        },
        required: ['object']
      },
      outputSchema: {
        type: 'object',
        properties: {
          json: {
            type: 'string',
            description: 'The stringified JSON'
          },
          result: {
            type: 'string',
            description: 'The stringified JSON (duplicate for compatibility)'
          },
          length: {
            type: 'number',
            description: 'Length of the JSON string'
          },
          sorted: {
            type: 'boolean',
            description: 'Whether keys were sorted'
          }
        },
        required: ['json', 'result', 'length', 'sorted']
      }
    });
    
    // Override _execute instead of execute to use base class error handling
    this._execute = async (params) => this._executeJsonStringify(params);
  }

  async _executeJsonStringify(params) {
    const { object, indent, sort_keys } = params;

    this.progress('Stringifying object to JSON', 50, {
      type: typeof object,
      indent: indent
    });

    let result;
    if (sort_keys) {
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
      result = JSON.stringify(object, replacer, indent);
    } else {
      result = JSON.stringify(object, null, indent);
    }

    this.info('JSON stringified successfully', {
      length: result.length,
      lines: result.split('\n').length
    });

    return {
      json: result,
      json_string: result,
      length: result.length
    };
  }
}

// Input schema for JsonValidateTool
const jsonValidateToolInputSchema = {
  type: 'object',
  properties: {
    json_string: {
      type: 'string',
      description: 'The JSON string to validate'
    }
  },
  required: ['json_string']
};

// Output schema for JsonValidateTool
const jsonValidateToolOutputSchema = {
  type: 'object',
  properties: {
    valid: {
      type: 'boolean',
      description: 'Whether the JSON string is valid'
    },
    isValid: {
      type: 'boolean',
      description: 'Whether the JSON string is valid (duplicate for compatibility)'
    },
    type: {
      type: 'string',
      description: 'Type of the parsed result'
    },
    isArray: {
      type: 'boolean',
      description: 'Whether the parsed result is an array'
    },
    message: {
      type: 'string',
      description: 'Success or error message'
    },
    error: {
      type: 'string',
      description: 'Error message if validation failed'
    },
    position: {
      type: 'number',
      description: 'Position of error in string'
    },
    line: {
      type: 'number',
      description: 'Line number of error'
    },
    column: {
      type: 'number',
      description: 'Column number of error'
    }
  },
  required: ['valid', 'isValid', 'message']
};

/**
 * JSON validation tool with event support
 */
class JsonValidateTool extends Tool {
  constructor() {
    super({
      name: 'json_validate',
      description: 'Validate if a string is valid JSON and provide detailed error information',
      inputSchema: jsonValidateToolInputSchema,
      outputSchema: jsonValidateToolOutputSchema
    });
    
    // Override _execute instead of execute to use base class error handling
    this._execute = async (params) => this._executeJsonValidate(params);
  }

  async _executeJsonValidate(params) {
    const { json_string } = params;

    this.progress('Validating JSON string', 50, {
      length: json_string.length
    });

    try {
      const parsed = JSON.parse(json_string);
      
      this.info('JSON is valid', {
        type: typeof parsed,
        isArray: Array.isArray(parsed)
      });

      return {
        valid: true,
        isValid: true,
        type: typeof parsed,
        isArray: Array.isArray(parsed),
        message: 'Valid JSON'
      };
    } catch (parseError) {
      // Extract error details
      const errorMatch = parseError.message.match(/position (\d+)/);
      const position = errorMatch ? parseInt(errorMatch[1]) : null;
      
      let line = 1;
      let column = 1;
      if (position !== null) {
        for (let i = 0; i < position && i < json_string.length; i++) {
          if (json_string[i] === '\n') {
            line++;
            column = 1;
          } else {
            column++;
          }
        }
      }

      this.warning('JSON validation failed', {
        error: parseError.message,
        position,
        line,
        column
      });

      return {
        valid: false,
        isValid: false,
        error: parseError.message,
        position,
        line,
        column,
        message: `Invalid JSON: ${parseError.message}`
      };
    }
  }
}

// Input schema for JsonExtractTool
const jsonExtractToolInputSchema = {
  type: 'object',
  properties: {
    json_object: {
      description: 'The JSON object to extract from'
    },
    path: {
      type: 'string',
      description: 'Dot notation path (e.g., "user.address.city" or "items[0].name")'
    },
    default_value: {
      description: 'Default value if path not found'
    }
  },
  required: ['json_object', 'path']
};

// Output schema for JsonExtractTool
const jsonExtractToolOutputSchema = {
  type: 'object',
  properties: {
    value: {
      description: 'The extracted value'
    },
    found: {
      type: 'boolean',
      description: 'Whether the value was found at the specified path'
    },
    path: {
      type: 'string',
      description: 'The path that was searched'
    }
  },
  required: ['value', 'found', 'path']
};

/**
 * JSON path extraction tool with event support
 */
class JsonExtractTool extends Tool {
  constructor() {
    super({
      name: 'json_extract',
      description: 'Extract a value from a JSON object using dot notation path',
      inputSchema: jsonExtractToolInputSchema,
      outputSchema: jsonExtractToolOutputSchema
    });
    
    // Override _execute instead of execute to use base class error handling
    this._execute = async (params) => this._executeJsonExtract(params);
  }

  async _executeJsonExtract(params) {
    const { json_object, path, default_value } = params;

    this.progress(`Extracting value at path: ${path}`, 50, {
      path: path
    });

    // Parse array notation
    const pathSegments = path.split('.').flatMap(segment => {
      const arrayMatch = segment.match(/^(\w+)\[(\d+)\]$/);
      if (arrayMatch) {
        return [arrayMatch[1], parseInt(arrayMatch[2])];
      }
      return segment;
    });

    // Navigate through the object
    let current = json_object;
    for (const segment of pathSegments) {
      if (current === null || current === undefined) {
        break;
      }
      current = current[segment];
    }

    const found = current !== undefined;
    const result = found ? current : (default_value !== undefined ? default_value : null);

    if (found) {
      this.info(`Value found at path: ${path}`, {
        path: path,
        type: typeof result
      });
    } else {
      this.warning(`Value not found at path: ${path}`, {
        path: path,
        usingDefault: default_value !== undefined
      });
    }

    return {
      value: result,
      found,
      path: path
    };
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
    
    // Initialize tools dictionary
    this.tools = {};
    
    // Create and register all JSON tools
    const jsonParseTool = new JsonParseTool();
    const jsonStringifyTool = new JsonStringifyTool();
    const jsonValidateTool = new JsonValidateTool();
    const jsonExtractTool = new JsonExtractTool();
    
    this.registerTool(jsonParseTool.name, jsonParseTool);
    this.registerTool(jsonStringifyTool.name, jsonStringifyTool);
    this.registerTool(jsonValidateTool.name, jsonValidateTool);
    this.registerTool(jsonExtractTool.name, jsonExtractTool);
  }
}

export default JsonModule;
export { JsonModule, JsonParseTool, JsonStringifyTool, JsonValidateTool, JsonExtractTool };