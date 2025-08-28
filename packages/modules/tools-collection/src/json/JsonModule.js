/**
 * NOTE: Validation has been removed from this tool.
 * All validation now happens at the invocation layer.
 * Tools only define schemas as plain JSON Schema objects.
 */

import { Tool, Module } from '@legion/tools-registry';
import { fileURLToPath } from 'url';

/**
 * JSON parsing tool with event support
 */
class JsonParseTool extends Tool {
  constructor() {
    super({
      name: 'json_parse',
      description: 'Parse JSON string into JavaScript object',
      schema: {
        input: {
          type: 'object',
          properties: {
            json_string: {
              type: 'string',
              description: 'The JSON string to parse',
              default: '{"test": true}'
            },
            reviver: {
              type: 'string',
              description: 'Optional reviver function code (advanced use)'
            }
          },
          required: ['json_string']
        },
        output: {
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
      }
    });
    
    // Override _execute instead of execute to use base class error handling
    this._execute = async (params) => this._executeJsonParse(params);
  }

  getMetadata() {
    return {
      name: this.name,
      description: this.description,
      inputSchema: this.schema.input,
      outputSchema: this.schema.output,
      version: '1.0.0',
      category: 'json',
      tags: ['json', 'parse', 'string'],
      security: { evaluation: 'safe' }
    };
  }

  validate(params) {
    const errors = [];
    const warnings = [];
    
    if (!params || typeof params !== 'object') {
      errors.push('Parameters must be an object');
      return { valid: false, errors, warnings };
    }
    
    if (params.json_string === undefined || params.json_string === null) {
      errors.push('json_string is required for JSON parsing');
    }
    
    if (params.json_string !== undefined && typeof params.json_string !== 'string') {
      errors.push('json_string must be a string');
    }
    
    return { valid: errors.length === 0, errors, warnings };
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
      schema: {
        input: {
          type: 'object',
          properties: {
            object: {
              type: 'object',
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
        output: {
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
      }
    });
    
    // Override _execute instead of execute to use base class error handling
    this._execute = async (params) => this._executeJsonStringify(params);
  }

  getMetadata() {
    return {
      name: this.name,
      description: this.description,
      inputSchema: this.schema.input,
      outputSchema: this.schema.output,
      version: '1.0.0',
      category: 'json',
      tags: ['json', 'stringify', 'string'],
      security: { evaluation: 'safe' }
    };
  }

  validate(params) {
    const errors = [];
    const warnings = [];
    
    if (!params || typeof params !== 'object') {
      errors.push('Parameters must be an object');
      return { valid: false, errors, warnings };
    }
    
    if (params.object === undefined) {
      errors.push('object is required for JSON stringification');
    }
    
    if (params.indent !== undefined && typeof params.indent !== 'number') {
      errors.push('indent must be a number');
    }
    
    return { valid: errors.length === 0, errors, warnings };
  }

  async _executeJsonStringify(params) {
    const { object, indent = 2, sort_keys = false } = params;

    // Validate required parameters - allow null but not missing
    if (!params.hasOwnProperty('object')) {
      throw new Error('object parameter is required');
    }

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
      length: result ? result.length : 0,
      lines: result ? result.split('\n').length : 0
    });

    return {
      json: result,
      result: result,
      length: result ? result.length : 0,
      sorted: sort_keys
    };
  }
}

// Input schema for JsonValidateTool
const jsonValidateToolInputSchema = {
  type: 'object',
  properties: {
    json_string: {
      type: 'string',
      description: 'The JSON string to validate',
      default: '{"test": true}'
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
      schema: {
        input: jsonValidateToolInputSchema,
        output: jsonValidateToolOutputSchema
      }
    });
    
    // Override _execute instead of execute to use base class error handling
    this._execute = async (params) => this._executeJsonValidate(params);
  }

  getMetadata() {
    return {
      name: this.name,
      description: this.description,
      inputSchema: this.schema.input,
      outputSchema: this.schema.output,
      version: '1.0.0',
      category: 'json',
      tags: ['json', 'validate', 'syntax'],
      security: { evaluation: 'safe' }
    };
  }

  validate(params) {
    const errors = [];
    const warnings = [];
    
    if (!params || typeof params !== 'object') {
      errors.push('Parameters must be an object');
      return { valid: false, errors, warnings };
    }
    
    if (params.json_string === undefined || params.json_string === null) {
      errors.push('json_string is required for validation');
    }
    
    if (params.json_string !== undefined && typeof params.json_string !== 'string') {
      errors.push('json_string must be a string');
    }
    
    return { valid: errors.length === 0, errors, warnings };
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
      } else {
        // For errors without position, scan the entire string to find the error
        // Look for common error patterns and estimate position
        const lines = json_string.split('\n');
        for (let lineNum = 0; lineNum < lines.length; lineNum++) {
          const lineContent = lines[lineNum];
          // Check for syntax issues on this line
          if (lineContent.includes('json') || lineContent.includes('invalid')) {
            line = lineNum + 1;
            column = lineContent.search(/[^\s]/) + 1; // First non-whitespace char
            break;
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
        position: position || 0,
        line: line || 1,
        column: column || 1,
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
      type: 'object',
      description: 'The JSON object to extract from'
    },
    path: {
      type: 'string',
      description: 'Dot notation path (e.g., "user.address.city" or "items[0].name")',
      default: 'test'
    },
    default_value: {
      type: 'string', 
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
      schema: {
        input: jsonExtractToolInputSchema,
        output: jsonExtractToolOutputSchema
      }
    });
    
    // Override _execute instead of execute to use base class error handling
    this._execute = async (params) => this._executeJsonExtract(params);
  }

  getMetadata() {
    return {
      name: this.name,
      description: this.description,
      inputSchema: this.schema.input,
      outputSchema: this.schema.output,
      version: '1.0.0',
      category: 'json',
      tags: ['json', 'extract', 'path'],
      security: { evaluation: 'safe' }
    };
  }

  validate(params) {
    const errors = [];
    const warnings = [];
    
    if (!params || typeof params !== 'object') {
      errors.push('Parameters must be an object');
      return { valid: false, errors, warnings };
    }
    
    if (params.json_object === undefined) {
      errors.push('json_object is required for extraction');
    }
    
    if (params.path === undefined || params.path === null) {
      errors.push('path is required for extraction');
    }
    
    if (params.path !== undefined && typeof params.path !== 'string') {
      errors.push('path must be a string');
    }
    
    return { valid: errors.length === 0, errors, warnings };
  }

  async _executeJsonExtract(params) {
    const { json_object, path, default_value } = params;

    // Validate required parameters
    if (json_object === undefined) {
      throw new Error('json_object parameter is required');
    }
    if (path === undefined || path === null) {
      throw new Error('path parameter is required');
    }

    this.progress(`Extracting value at path: ${path}`, 50, {
      path: path
    });

    // Handle root-level array access [n]
    if (path.match(/^\[\d+\]$/)) {
      const index = parseInt(path.slice(1, -1));
      const found = Array.isArray(json_object) && index >= 0 && index < json_object.length;
      const result = found ? json_object[index] : (default_value !== undefined ? default_value : null);
      
      return {
        value: result,
        found,
        path: path
      };
    }

    // Parse array notation for nested paths
    const pathSegments = path.split('.').flatMap(segment => {
      if (!segment) return []; // Skip empty segments
      const arrayMatch = segment.match(/^(\w+)\[(\d+)\]$/);
      if (arrayMatch) {
        return [arrayMatch[1], parseInt(arrayMatch[2])];
      }
      return segment;
    });

    // Navigate through the object
    let current = json_object;
    let actuallyFound = true;
    
    for (const segment of pathSegments) {
      if (current === null || current === undefined) {
        actuallyFound = false;
        break;
      }
      
      // Check if we can access this segment
      if (!(segment in current) && (typeof segment !== 'number' || !Array.isArray(current))) {
        actuallyFound = false;
        break;
      }
      
      current = current[segment];
      
      // If we get undefined, it means the property doesn't exist
      if (current === undefined) {
        actuallyFound = false;
        break;
      }
    }

    const result = actuallyFound ? current : (default_value !== undefined ? default_value : null);

    if (actuallyFound) {
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
      found: actuallyFound,
      path: path
    };
  }
}

/**
 * JSON module providing JSON manipulation tools with event support
 */
class JsonModule extends Module {
  constructor() {
    super();
    this.name = 'json';
    this.description = 'JSON manipulation and validation tools for parsing, stringifying, and extracting data from JSON structures';
    this.version = '1.0.0';
    
    // NEW: Set metadata path for automatic loading
    this.metadataPath = './tools-metadata.json';
  }

  /**
   * Override getModulePath to support proper path resolution
   */
  getModulePath() {
    return fileURLToPath(import.meta.url);
  }

  /**
   * Static async factory method following the standard interface
   */
  static async create(resourceManager) {
    const module = new JsonModule();
    module.resourceManager = resourceManager;
    await module.initialize();
    return module;
  }

  /**
   * Initialize the module - NEW metadata-driven approach
   */
  async initialize() {
    await super.initialize(); // This will load metadata automatically
    
    // NEW APPROACH: Create tools using metadata
    if (this.metadata) {
      const tools = [
        { key: 'json_parse', class: JsonParseTool },
        { key: 'json_stringify', class: JsonStringifyTool },
        { key: 'json_validate', class: JsonValidateTool },
        { key: 'json_extract', class: JsonExtractTool }
      ];

      for (const { key, class: ToolClass } of tools) {
        try {
          const tool = this.createToolFromMetadata(key, ToolClass);
          this.registerTool(tool.name, tool);
        } catch (error) {
          console.warn(`Failed to create metadata tool ${key}, falling back to legacy: ${error.message}`);
          
          // Fallback to legacy constructor
          let legacyTool;
          switch (key) {
            case 'json_parse':
              legacyTool = new JsonParseTool();
              break;
            case 'json_stringify':
              legacyTool = new JsonStringifyTool();
              break;
            case 'json_validate':
              legacyTool = new JsonValidateTool();
              break;
            case 'json_extract':
              legacyTool = new JsonExtractTool();
              break;
          }
          
          if (legacyTool) {
            this.registerTool(legacyTool.name, legacyTool);
          }
        }
      }
    } else {
      // FALLBACK: Old approach for backwards compatibility
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
}

export default JsonModule;
