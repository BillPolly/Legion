import { Tool } from '../modules/Tool.js'; import { Module } from '../compatibility.js';
import { z } from 'zod';

/**
 * JSON parsing tool with event support
 */
class JsonParseTool extends Tool {
  constructor() {
    super({
      name: 'json_parse',
      description: 'Parse JSON string into JavaScript object',
      inputSchema: z.object({
        json_string: z.string().describe('The JSON string to parse'),
        reviver: z.string().optional().describe('Optional reviver function code (advanced use)')
      })
    });
  }

  async execute(params) {
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
      inputSchema: z.object({
        object: z.any().describe('The object to stringify'),
        indent: z.number().optional().default(2).describe('Number of spaces for indentation (0 for compact)'),
        sort_keys: z.boolean().optional().default(false).describe('Whether to sort object keys alphabetically')
      })
    });
  }

  async execute(params) {
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

/**
 * JSON validation tool with event support
 */
class JsonValidateTool extends Tool {
  constructor() {
    super({
      name: 'json_validate',
      description: 'Validate if a string is valid JSON and provide detailed error information',
      inputSchema: z.object({
        json_string: z.string().describe('The JSON string to validate')
      })
    });
  }

  async execute(params) {
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

/**
 * JSON path extraction tool with event support
 */
class JsonExtractTool extends Tool {
  constructor() {
    super({
      name: 'json_extract',
      description: 'Extract a value from a JSON object using dot notation path',
      inputSchema: z.object({
        json_object: z.any().describe('The JSON object to extract from'),
        path: z.string().describe('Dot notation path (e.g., "user.address.city" or "items[0].name")'),
        default_value: z.any().optional().describe('Default value if path not found')
      })
    });
  }

  async execute(params) {
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