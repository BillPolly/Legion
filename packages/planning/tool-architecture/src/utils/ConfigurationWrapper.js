/**
 * Configuration-driven tool creation utilities
 * Enables creating tools from declarative configuration
 */

import { Tool } from '../modules/Tool.js';

/**
 * Parse tool configuration
 * @param {Object} config - Tool configuration
 * @returns {Object} Parsed configuration
 */
export function parseToolConfiguration(config) {
  if (!config.name) {
    throw new Error('Tool configuration must have a name');
  }

  const parsed = {
    name: config.name,
    description: config.description || 'No description provided',
    input: config.input,
    output: config.output
  };

  // Copy over method reference if present
  if (config.method) {
    parsed.method = config.method;
  }

  // Copy over parameter mapping if present
  if (config.parameterMapping) {
    parsed.parameterMapping = config.parameterMapping;
  }

  // Copy over transforms if present
  if (config.inputTransform) {
    parsed.inputTransform = config.inputTransform;
  }

  if (config.outputTransform) {
    parsed.outputTransform = config.outputTransform;
  }

  // Copy execute function if present
  if (config.execute) {
    parsed.execute = config.execute;
  }

  // Copy schemas if present
  if (config.inputSchema) {
    parsed.inputSchema = config.inputSchema;
  }

  if (config.outputSchema) {
    parsed.outputSchema = config.outputSchema;
  }

  return parsed;
}

/**
 * Validate data against a schema
 * @param {any} data - Data to validate
 * @param {Object} schema - Schema to validate against
 * @param {Object} options - Validation options
 * @returns {boolean|any} True if valid, false if invalid, or data with defaults applied
 */
export function validateToolSchema(data, schema, options = {}) {
  if (!schema) return true;

  // Handle type checking
  if (schema.type) {
    const dataType = Array.isArray(data) ? 'array' : typeof data;
    
    if (schema.type === 'array' && !Array.isArray(data)) {
      return false;
    } else if (schema.type === 'object' && (dataType !== 'object' || data === null || Array.isArray(data))) {
      return false;
    } else if (schema.type !== 'array' && schema.type !== 'object' && dataType !== schema.type) {
      return false;
    }
  }

  // Handle array validation
  if (schema.type === 'array' && schema.items) {
    for (const item of data) {
      if (!validateToolSchema(item, schema.items)) {
        return false;
      }
    }
  }

  // Handle object validation
  if (schema.type === 'object' && schema.properties) {
    let result = options.applyDefaults ? { ...data } : data;

    for (const [key, propSchema] of Object.entries(schema.properties)) {
      // Check required fields
      if (propSchema.required && !(key in data)) {
        return false;
      }

      // Apply defaults if requested
      if (options.applyDefaults && propSchema.default !== undefined && !(key in result)) {
        result[key] = propSchema.default;
      }

      // Validate property if present
      if (key in data) {
        // Nested object validation
        if (propSchema.type === 'object' && propSchema.properties) {
          if (!validateToolSchema(data[key], propSchema)) {
            return false;
          }
        } else if (propSchema.type) {
          const propType = typeof data[key];
          if (propSchema.type !== propType) {
            return false;
          }
        }
      }
    }

    return options.applyDefaults ? result : true;
  }

  return true;
}

/**
 * Generate a tool from configuration
 * @param {Object} config - Tool configuration
 * @returns {Tool} Generated tool
 */
export function generateToolFromConfig(config) {
  const parsed = parseToolConfiguration(config);

  // Create execute function based on configuration
  let executeFunc;

  if (parsed.execute) {
    // Direct execute function provided
    executeFunc = async (input) => {
      // Apply input transform if present
      let processedInput = input;
      if (parsed.inputTransform) {
        processedInput = parsed.inputTransform(input);
      }

      // Validate input if schema present
      if (parsed.inputSchema) {
        const valid = validateToolSchema(processedInput, parsed.inputSchema);
        if (!valid) {
          throw new Error('Input validation failed');
        }
      }

      // Execute the function
      let result = await parsed.execute(processedInput);

      // Apply output transform if present
      if (parsed.outputTransform) {
        result = parsed.outputTransform(result);
      }

      return result;
    };
  } else if (parsed.method && config.source) {
    // Method binding from source object
    const method = config.source[parsed.method];
    if (!method) {
      throw new Error(`Method ${parsed.method} not found on source object`);
    }

    executeFunc = async (input) => {
      return method.call(config.source, input);
    };
  } else {
    throw new Error('Tool configuration must have either execute function or method+source');
  }

  // Create metadata function
  const getMetadata = () => {
    const metadata = {
      description: parsed.description
    };

    if (parsed.input || parsed.inputSchema) {
      metadata.input = parsed.input || parsed.inputSchema;
    }

    if (parsed.output || parsed.outputSchema) {
      metadata.output = parsed.output || parsed.outputSchema;
    }

    return metadata;
  };

  return new Tool({
    name: parsed.name,
    execute: executeFunc,
    getMetadata
  });
}

/**
 * Generate metadata from schema configuration
 * @param {Object} config - Configuration with schemas
 * @returns {Object} Generated metadata
 */
export function generateMetadataFromSchema(config) {
  const metadata = {
    description: config.description || 'No description provided'
  };

  if (config.inputSchema) {
    metadata.input = config.inputSchema;
  }

  if (config.outputSchema) {
    metadata.output = config.outputSchema;
  }

  if (config.examples) {
    metadata.examples = config.examples;
  }

  if (config.tags) {
    metadata.tags = config.tags;
  }

  if (config.category) {
    metadata.category = config.category;
  }

  return metadata;
}

/**
 * ConfigurationWrapper class for creating tools from configuration
 */
export class ConfigurationWrapper {
  constructor(config) {
    this.config = config;
    this.source = config.source;
    this.defaults = config.defaults || {};
    this.schema = config.schema;
  }

  /**
   * Validate the configuration
   */
  validate() {
    if (this.schema) {
      const valid = validateToolSchema(this.config, { 
        type: 'object', 
        properties: this.schema 
      });
      
      if (!valid) {
        throw new Error('Configuration validation failed');
      }
    }
  }

  /**
   * Create tools from configuration
   * @returns {Object} Map of tool names to Tool instances
   */
  createTools() {
    const tools = {};

    if (!this.config.tools) {
      return tools;
    }

    for (const [toolName, toolConfig] of Object.entries(this.config.tools)) {
      const mergedConfig = {
        name: toolName,
        ...this.defaults,
        ...toolConfig
      };

      // If source is provided at wrapper level, use it
      if (this.source && toolConfig.method) {
        mergedConfig.source = this.source;
      }

      // Generate tool with enhanced metadata
      const tool = generateToolFromConfig(mergedConfig);

      // Override getMetadata to include defaults
      const originalGetMetadata = tool.getMetadata.bind(tool);
      tool.getMetadata = () => {
        const metadata = originalGetMetadata();
        
        // Add defaults to metadata
        if (this.defaults.timeout) {
          metadata.timeout = this.defaults.timeout;
        }
        if (this.defaults.retries) {
          metadata.retries = this.defaults.retries;
        }

        return metadata;
      };

      tools[toolName] = tool;
    }

    return tools;
  }

  /**
   * Create tools with async initialization
   * @returns {Promise<Object>} Map of tool names to Tool instances
   */
  async createToolsAsync() {
    const tools = {};

    if (!this.config.tools) {
      return tools;
    }

    for (const [toolName, toolConfig] of Object.entries(this.config.tools)) {
      const mergedConfig = {
        name: toolName,
        ...this.defaults,
        ...toolConfig
      };

      // Handle async initialization if present
      let state = {};
      if (toolConfig.initialize) {
        state = await toolConfig.initialize();
      }

      // Create execute function with state
      if (toolConfig.execute && state) {
        const originalExecute = toolConfig.execute;
        mergedConfig.execute = async function(input) {
          return originalExecute.call({ state }, input);
        };
      }

      tools[toolName] = generateToolFromConfig(mergedConfig);
    }

    return tools;
  }
}