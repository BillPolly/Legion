/**
 * ToolRegistry - Manages tool discovery, validation, and metadata
 */

export class ToolRegistry {
  constructor(moduleLoader) {
    this.moduleLoader = moduleLoader;
    this.registry = null;
  }

  /**
   * Discover all available tools
   * @returns {Map} Tool registry
   */
  discoverTools() {
    // Return cached registry if available
    if (this.registry) {
      return this.registry;
    }
    
    const registry = new Map();
    
    // Get all module instances
    const moduleInstances = this.moduleLoader.getAllModuleInstances();
    
    for (const moduleInstance of moduleInstances) {
      const moduleName = moduleInstance.name;
      const tools = moduleInstance.getTools ? moduleInstance.getTools() : [];
      
      for (const tool of tools) {
        // Check if tool has multiple functions
        if (typeof tool.getAllToolDescriptions === 'function') {
          // Tool has multiple functions, register each one
          const allDescriptions = tool.getAllToolDescriptions();
          for (const desc of allDescriptions) {
            const functionName = desc.function.name;
            const toolKey = `${moduleName}.${functionName}`;
            const toolMetadata = {
              name: functionName,
              module: moduleName,
              description: desc.function.description,
              parameters: desc.function.parameters,
              instance: tool
            };
            registry.set(toolKey, toolMetadata);
          }
        } else {
          // Tool has single function
          const toolDesc = tool.getToolDescription();
          const functionName = toolDesc.function.name;
          const toolKey = `${moduleName}.${functionName}`;
          const toolMetadata = {
            name: functionName,
            module: moduleName,
            description: toolDesc.function.description,
            parameters: toolDesc.function.parameters,
            instance: tool
          };
          registry.set(toolKey, toolMetadata);
        }
      }
    }
    
    // Cache the registry
    this.registry = registry;
    return registry;
  }

  /**
   * Get tool by name
   * @param {string} fullName - Full tool name (module.tool)
   * @returns {object|null} Tool metadata
   */
  getToolByName(fullName) {
    const tools = this.discoverTools();
    return tools.get(fullName) || null;
  }

  /**
   * Get tools by module
   * @param {string} moduleName - Module name
   * @returns {object[]} Array of tools
   */
  getToolsByModule(moduleName) {
    const tools = this.discoverTools();
    const moduleTools = [];
    
    for (const [key, tool] of tools) {
      if (tool.module === moduleName) {
        moduleTools.push(tool);
      }
    }
    
    return moduleTools;
  }

  /**
   * Validate tool name
   * @param {string} fullName - Full tool name
   * @returns {boolean} True if valid
   */
  validateToolName(fullName) {
    if (!fullName || typeof fullName !== 'string') {
      return false;
    }
    
    const parts = fullName.split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      return false;
    }
    
    const tools = this.discoverTools();
    return tools.has(fullName);
  }

  /**
   * Get tool metadata
   * @param {string} fullName - Full tool name
   * @returns {object|null} Tool metadata with examples
   */
  getToolMetadata(fullName) {
    const tool = this.getToolByName(fullName);
    if (!tool) {
      return null;
    }
    
    // Extract required parameters
    const required = tool.parameters?.required || [];
    
    // Generate examples
    const examples = this.generateToolExamples(fullName, tool);
    
    return {
      name: tool.name,
      module: tool.module,
      description: tool.description,
      parameters: tool.parameters,
      required,
      examples
    };
  }

  /**
   * Generate tool examples
   * @param {string} fullName - Full tool name
   * @param {object} tool - Tool metadata
   * @returns {string[]} Array of example commands
   */
  generateToolExamples(fullName, tool) {
    const examples = [];
    
    // Basic example with required parameters
    if (tool.parameters?.required?.length > 0) {
      const args = tool.parameters.required.map(param => {
        const propDef = tool.parameters.properties?.[param];
        if (propDef?.type === 'string') {
          return `--${param} "example value"`;
        } else if (propDef?.type === 'number') {
          return `--${param} 42`;
        } else if (propDef?.type === 'boolean') {
          return `--${param}`;
        } else {
          return `--${param} value`;
        }
      }).join(' ');
      
      examples.push(`jsenvoy ${fullName} ${args}`);
    } else {
      // No required parameters
      examples.push(`jsenvoy ${fullName}`);
    }
    
    // Example with JSON input
    if (tool.parameters?.properties) {
      const jsonExample = {};
      for (const [key, prop] of Object.entries(tool.parameters.properties)) {
        if (prop.type === 'string') {
          jsonExample[key] = 'example';
        } else if (prop.type === 'number') {
          jsonExample[key] = 123;
        } else if (prop.type === 'boolean') {
          jsonExample[key] = true;
        }
      }
      examples.push(`jsenvoy ${fullName} --json '${JSON.stringify(jsonExample)}'`);
    }
    
    return examples;
  }

  /**
   * Get all tool names
   * @returns {string[]} Sorted array of tool names
   */
  getAllToolNames() {
    const tools = this.discoverTools();
    return Array.from(tools.keys()).sort();
  }

  /**
   * Invalidate tool cache
   */
  invalidateCache() {
    this.registry = null;
  }

  /**
   * Execute a tool
   * @param {string} toolName - Tool name
   * @param {object} args - Tool arguments
   * @param {object} config - Configuration
   * @returns {any} Tool result
   */
  async executeTool(toolName, args, config = {}) {
    const tool = this.getToolByName(toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }
    
    // Pass the function name from the tool metadata
    const functionName = tool.name;
    
    // Handle timeout if configured
    const timeout = config.toolTimeout;
    if (timeout && timeout > 0) {
      return await this.executeWithTimeout(tool.instance.execute(args, functionName), timeout);
    }
    
    // Execute without timeout
    return await tool.instance.execute(args, functionName);
  }

  /**
   * Execute with timeout
   * @param {Promise} promise - Promise to execute
   * @param {number} timeoutMs - Timeout in milliseconds
   * @returns {any} Result or timeout error
   */
  async executeWithTimeout(promise, timeoutMs) {
    let timeoutId;
    
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error('Tool execution timeout'));
      }, timeoutMs);
    });
    
    try {
      const result = await Promise.race([promise, timeoutPromise]);
      clearTimeout(timeoutId);
      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Validate tool arguments
   * @param {string} toolName - Tool name
   * @param {object} args - Arguments to validate
   * @returns {object} Validation result
   */
  validateToolArguments(toolName, args) {
    const tool = this.getToolByName(toolName);
    if (!tool) {
      return { valid: false, errors: [`Tool not found: ${toolName}`] };
    }
    
    const errors = [];
    const schema = tool.parameters;
    
    if (!schema || schema.type !== 'object') {
      return { valid: true, errors: [] };
    }
    
    // Check required parameters
    if (schema.required) {
      for (const required of schema.required) {
        if (!(required in args)) {
          errors.push(`Missing required parameter: '${required}'`);
        }
      }
    }
    
    // Validate parameter types
    if (schema.properties) {
      for (const [key, value] of Object.entries(args)) {
        const propSchema = schema.properties[key];
        if (!propSchema) continue;
        
        // Check type
        const actualType = Array.isArray(value) ? 'array' : typeof value;
        if (propSchema.type && actualType !== propSchema.type) {
          errors.push(`Parameter '${key}' must be of type ${propSchema.type}, got ${actualType}`);
        }
        
        // Check enum values
        if (propSchema.enum && !propSchema.enum.includes(value)) {
          errors.push(`Parameter '${key}' must be one of: ${propSchema.enum.join(', ')}`);
        }
      }
    }
    
    return { valid: errors.length === 0, errors };
  }

  /**
   * Convert arguments to correct types
   * @param {string} toolName - Tool name
   * @param {object} args - Arguments to convert
   * @returns {object} Converted arguments
   */
  convertArguments(toolName, args) {
    const tool = this.getToolByName(toolName);
    if (!tool || !tool.parameters?.properties) {
      return args;
    }
    
    const converted = { ...args };
    
    for (const [key, value] of Object.entries(args)) {
      const propSchema = tool.parameters.properties[key];
      if (!propSchema) continue;
      
      // Convert based on expected type
      if (propSchema.type === 'number' && typeof value === 'string') {
        const num = Number(value);
        if (!isNaN(num)) {
          converted[key] = num;
        }
      } else if (propSchema.type === 'boolean' && typeof value === 'string') {
        converted[key] = value === 'true' || value === '1' || value === 'yes';
      } else if (propSchema.type === 'object' && typeof value === 'string') {
        try {
          converted[key] = JSON.parse(value);
        } catch (e) {
          // Keep as string if JSON parse fails
        }
      } else if (propSchema.type === 'array' && typeof value === 'string') {
        try {
          converted[key] = JSON.parse(value);
        } catch (e) {
          // Try comma-separated
          converted[key] = value.split(',').map(v => v.trim());
        }
      }
    }
    
    return converted;
  }
}

export default ToolRegistry;