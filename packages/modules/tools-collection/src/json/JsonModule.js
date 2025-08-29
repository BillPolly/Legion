/**
 * NOTE: Validation has been removed from this tool.
 * All validation now happens at the invocation layer.
 * Tools only define schemas as plain JSON Schema objects.
 */

import { Tool, Module } from '@legion/tools-registry';
import { fileURLToPath } from 'url';

/**
 * JSON parsing tool with event support
 * NEW: Pure logic implementation - metadata comes from module.json
 */
class JsonParseTool extends Tool {
  // NEW PATTERN: constructor(module, toolName)
  constructor(module, toolName) {
    super(module, toolName);
  }

  /**
   * Pure business logic - no metadata, no validation
   * Base Tool class handles all validation using metadata
   */
  async _execute(params) {
    return this._executeJsonParse(params);
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
 * NEW: Pure logic implementation - metadata comes from module.json
 */
class JsonStringifyTool extends Tool {
  // NEW PATTERN: constructor(module, toolName)
  constructor(module, toolName) {
    super(module, toolName);
  }

  /**
   * Pure business logic - no metadata, no validation
   * Base Tool class handles all validation using metadata
   */
  async _execute(params) {
    return this._executeJsonStringify(params);
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


/**
 * JSON validation tool with event support
 * NEW: Pure logic implementation - metadata comes from module.json
 */
class JsonValidateTool extends Tool {
  // NEW PATTERN: constructor(module, toolName)
  constructor(module, toolName) {
    super(module, toolName);
  }

  /**
   * Pure business logic - no metadata, no validation
   * Base Tool class handles all validation using metadata
   */
  async _execute(params) {
    return this._executeJsonValidate(params);
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


/**
 * JSON path extraction tool with event support
 * NEW: Pure logic implementation - metadata comes from module.json
 */
class JsonExtractTool extends Tool {
  // NEW PATTERN: constructor(module, toolName)
  constructor(module, toolName) {
    super(module, toolName);
  }

  /**
   * Pure business logic - no metadata, no validation
   * Base Tool class handles all validation using metadata
   */
  async _execute(params) {
    return this._executeJsonExtract(params);
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
    this.metadataPath = './module.json';
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
    
    // Create tools using metadata
    const jsonParseTool = this.createToolFromMetadata('json_parse', JsonParseTool);
    this.registerTool(jsonParseTool.name, jsonParseTool);
    
    const jsonStringifyTool = this.createToolFromMetadata('json_stringify', JsonStringifyTool);
    this.registerTool(jsonStringifyTool.name, jsonStringifyTool);
    
    const jsonValidateTool = this.createToolFromMetadata('json_validate', JsonValidateTool);
    this.registerTool(jsonValidateTool.name, jsonValidateTool);
    
    const jsonExtractTool = this.createToolFromMetadata('json_extract', JsonExtractTool);
    this.registerTool(jsonExtractTool.name, jsonExtractTool);
  }
}

export default JsonModule;
