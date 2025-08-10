/**
 * JsonModule - Dynamic module created from JSON definition
 * 
 * This class creates modules dynamically from module.json definitions,
 * providing the bridge between JSON configuration and actual module execution.
 */

import { ModuleInstance } from './ModuleInstance.js';
import { Tool } from './Tool.js';
import path from 'path';
import { pathToFileURL } from 'url';

export class JsonModule extends ModuleInstance {
  constructor(definition, config, resourceManager) {
    super(definition, config);
    this.resourceManager = resourceManager;
    this.definition = definition;
    this.moduleImplementation = null;
  }

  /**
   * Initialize the JSON module by loading its implementation
   */
  async initialize() {
    await super.initialize();
    
    // Load the actual module implementation if specified
    if (this.definition.package) {
      await this.loadModuleImplementation();
    }
    
    // Create tools from definition
    await this.createToolsFromDefinition();
  }

  /**
   * Load the actual module implementation (class/instance)
   */
  async loadModuleImplementation() {
    const packagePath = this.definition.package;
    const basePath = this.definition.basePath || process.cwd();
    const fullPath = path.resolve(basePath, packagePath);
    
    try {
      const moduleUrl = pathToFileURL(fullPath).href;
      const loadedModule = await import(moduleUrl);
      
      // Get the module class or instance
      // For CommonJS modules, the export becomes the default
      // For ES modules, look for default export or named export
      let ModuleClass;
      
      if (loadedModule.default) {
        ModuleClass = loadedModule.default;
      } else if (this.definition.initialization?.className && loadedModule[this.definition.initialization.className]) {
        ModuleClass = loadedModule[this.definition.initialization.className];
      } else {
        // Try to find the first export that looks like a class constructor
        const exports = Object.values(loadedModule);
        ModuleClass = exports.find(exp => typeof exp === 'function' && exp.prototype && exp.prototype.constructor === exp);
      }
      
      if (!ModuleClass) {
        const availableExports = Object.keys(loadedModule);
        throw new Error(`Could not find module class in ${packagePath}. Available exports: ${availableExports.join(', ')}`);
      }

      // Instantiate the module with resolved config
      const resolvedConfig = this.resolveConfig(this.definition.initialization?.config || {});
      
      if (this.definition.initialization?.treatAsConstructor || this.definition.type === 'constructor') {
        this.moduleImplementation = new ModuleClass(resolvedConfig);
      } else {
        // Try static create method first
        if (ModuleClass.create && typeof ModuleClass.create === 'function') {
          this.moduleImplementation = await ModuleClass.create(this.resourceManager, resolvedConfig);
        } else {
          this.moduleImplementation = new ModuleClass(resolvedConfig, this.resourceManager);
        }
      }

      // Call initialize if it exists
      if (this.moduleImplementation.initialize && typeof this.moduleImplementation.initialize === 'function') {
        await this.moduleImplementation.initialize();
      }

    } catch (error) {
      // Log the error but don't emit an error event that could cause unhandled exceptions
      console.error(`Failed to load module implementation from ${packagePath}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create tools from JSON definition
   */
  async createToolsFromDefinition() {
    if (!this.definition.tools || !Array.isArray(this.definition.tools)) {
      return;
    }

    for (const toolDef of this.definition.tools) {
      try {
        const tool = await this.createToolFromDefinition(toolDef);
        this.registerTool(toolDef.name, tool);
      } catch (error) {
        console.error(`Failed to create tool ${toolDef.name}: ${error.message}`);
        throw error;
      }
    }
  }

  /**
   * Create a single tool from its JSON definition
   */
  async createToolFromDefinition(toolDef) {
    // Create the execute function that will call the actual module method
    const executeFunction = async (input) => {
      try {
        this.progress(`Executing tool ${toolDef.name}`, 10);
        
        // Validate the tool definition
        if (!toolDef.function) {
          throw new Error(`Tool ${toolDef.name} has no function defined`);
        }

        let result;
        
        if (toolDef.instanceMethod && this.moduleImplementation) {
          // Call instance method
          const method = this.moduleImplementation[toolDef.function];
          if (!method || typeof method !== 'function') {
            throw new Error(`Method ${toolDef.function} not found on module implementation`);
          }
          
          this.progress(`Calling ${toolDef.function} on module instance`, 50);
          
          if (toolDef.async !== false) {
            result = await method.call(this.moduleImplementation, input);
          } else {
            result = method.call(this.moduleImplementation, input);
          }
        } else if (this.moduleImplementation) {
          // Call static method
          const method = this.moduleImplementation.constructor[toolDef.function] || 
                         this.moduleImplementation[toolDef.function];
          
          if (!method || typeof method !== 'function') {
            throw new Error(`Static method ${toolDef.function} not found on module`);
          }
          
          this.progress(`Calling static ${toolDef.function}`, 50);
          
          if (toolDef.async !== false) {
            result = await method.call(this.moduleImplementation, input);
          } else {
            result = method.call(this.moduleImplementation, input);
          }
        } else {
          throw new Error(`No module implementation loaded for tool ${toolDef.name}`);
        }

        this.progress(`Tool ${toolDef.name} execution complete`, 90);

        // Apply result mapping if specified
        if (toolDef.resultMapping) {
          result = this.applyResultMapping(result, toolDef.resultMapping);
        }

        this.progress(`Tool ${toolDef.name} finished`, 100);

        // Ensure result is in standard format
        return this.normalizeResult(result);

      } catch (error) {
        // Don't emit error event here - just return the error in correct format
        // The Tool class will handle it properly
        return {
          success: false,
          error: error.message,
          data: null
        };
      }
    };

    // Create the Tool instance
    return new Tool({
      name: toolDef.name,
      description: toolDef.description || `Tool ${toolDef.name}`,
      inputSchema: toolDef.parameters,
      execute: executeFunction
    });
  }

  /**
   * Resolve configuration by substituting environment variables
   */
  resolveConfig(config) {
    if (!config || typeof config !== 'object') {
      return config;
    }

    const resolved = {};
    
    for (const [key, value] of Object.entries(config)) {
      if (typeof value === 'string' && value.includes('${') && value.includes('}')) {
        // Substitute environment variables
        const envVar = value.match(/\$\{([^}]+)\}/)?.[1];
        if (envVar && this.resourceManager) {
          // Try ResourceManager first, then fall back to process.env
          const resolvedValue = this.resourceManager.get(`env.${envVar}`) || process.env[envVar] || value;
          resolved[key] = resolvedValue;
        } else {
          resolved[key] = value;
        }
      } else if (typeof value === 'object') {
        resolved[key] = this.resolveConfig(value);
      } else {
        resolved[key] = value;
      }
    }

    return resolved;
  }

  /**
   * Apply result mapping using JSONPath-like expressions
   * This is a simplified implementation - in production would use proper JSONPath library
   */
  applyResultMapping(result, mapping) {
    if (!mapping || typeof mapping !== 'object') {
      return result;
    }

    const mapped = {};

    for (const [key, path] of Object.entries(mapping)) {
      if (key === 'success' && typeof path === 'object') {
        // Success result mapping
        for (const [successKey, successPath] of Object.entries(path)) {
          mapped[successKey] = this.extractValue(result, successPath);
        }
      } else {
        mapped[key] = this.extractValue(result, path);
      }
    }

    return mapped;
  }

  /**
   * Simple JSONPath-like value extraction
   */
  extractValue(obj, path) {
    if (!path || typeof path !== 'string') {
      return obj;
    }

    // Handle JSONPath expressions like "$.property" or "$.nested.value"
    if (path.startsWith('$.')) {
      const parts = path.slice(2).split('.');
      let current = obj;
      
      for (const part of parts) {
        if (current && typeof current === 'object' && part in current) {
          current = current[part];
        } else {
          return undefined;
        }
      }
      
      return current;
    }

    // Handle direct property access
    if (obj && typeof obj === 'object' && path in obj) {
      return obj[path];
    }

    return undefined;
  }

  /**
   * Normalize result to standard format
   */
  normalizeResult(result) {
    // If result is already in standard format with success field
    if (result && typeof result === 'object' && 'success' in result) {
      return result;
    }

    // If result is null/undefined, treat as failure
    if (result == null) {
      return {
        success: false,
        error: 'Tool returned null/undefined result',
        data: null
      };
    }

    // Otherwise wrap as success
    return {
      success: true,
      data: result
    };
  }

  /**
   * Get module metadata
   */
  getMetadata() {
    return {
      name: this.definition.name,
      type: 'json',
      version: this.definition.version,
      description: this.definition.description,
      tools: this.definition.tools?.map(t => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters
      })) || [],
      dependencies: Object.keys(this.definition.dependencies || {}),
      hasImplementation: !!this.moduleImplementation
    };
  }
}