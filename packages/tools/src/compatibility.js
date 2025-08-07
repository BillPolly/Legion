/**
 * Compatibility layer for migration from module-loader
 * 
 * This file provides backward compatibility with @legion/module-loader API
 * to enable gradual migration to @legion/tool-core
 */

import { ModuleInstance } from './modules/ModuleInstance.js';
import { Tool } from './modules/Tool.js';
import { EventEmitter } from 'events';

/**
 * Module class - compatibility alias for ModuleInstance
 * @deprecated Use ModuleInstance directly
 */
export class Module extends ModuleInstance {
  constructor(name = '', dependencies = {}) {
    // Handle both old style (name, deps) and new style (definition, config)
    if (typeof name === 'string') {
      super({ name }, dependencies);
    } else {
      super(name, dependencies);
    }
    
    // Old module-loader compatibility
    this.name = this.name || name;
    this.dependencies = this.config || dependencies;
    this.tools = [];
    this.toolMap = new Map();
  }
  
  /**
   * Register a tool (old module-loader style)
   */
  registerTool(name, tool) {
    // Handle both new style (single arg) and old style (name, tool) calls
    if (typeof name === 'object' && name.name) {
      tool = name;
      name = tool.name;
    }
    
    // Store in old-style arrays for compatibility
    this.tools.push(tool);
    this.toolMap.set(name, tool);
    
    // Also register in new style
    super.registerTool(name, tool);
    
    return this;
  }
  
  /**
   * Get tools array (old style)
   */
  getTools() {
    return this.tools;
  }
  
  /**
   * Get tool by name (old style)
   */
  getTool(name) {
    return this.toolMap.get(name) || super.getTool(name);
  }
}

/**
 * ToolResult class for compatibility
 */
export class ToolResult {
  constructor(success, data, error = null) {
    this.success = success;
    this.data = data;
    this.error = error;
  }
  
  static success(data) {
    return {
      success: true,
      data: data,
      error: null
    };
  }
  
  static failure(message, data = {}) {
    return {
      success: false,
      data: data,
      error: message
    };
  }
  
  isSuccess() {
    return this.success;
  }
  
  isFailure() {
    return !this.success;
  }
}

/**
 * Enhanced Tool class with module-loader compatibility
 */
export class CompatTool extends Tool {
  constructor(config) {
    // Handle both old and new config styles
    const newConfig = {
      name: config.name,
      execute: config.execute || config.run,
      getMetadata: config.getMetadata,
      schema: config.schema,
      inputSchema: config.inputSchema
    };
    
    // Handle Zod schemas from module-loader
    if (config.inputSchema && config.inputSchema._def) {
      // This is a Zod schema, wrap it
      newConfig.schema = {
        validate: (data) => {
          try {
            const result = config.inputSchema.parse(data);
            return { valid: true, data: result };
          } catch (error) {
            return { valid: false, errors: error.errors };
          }
        }
      };
      newConfig.inputSchema = null;
    }
    
    super(newConfig);
    
    // Add old-style properties
    this.description = config.description;
    this.inputSchema = config.inputSchema;
  }
  
  /**
   * Old-style run method
   */
  async run(input) {
    return this.execute(input);
  }
  
  // Progress event helpers that match old API exactly
  progress(message, percentage, data) {
    this.emit('event', {
      type: 'progress',
      tool: this.name,
      message,
      data: { percentage, ...data },
      timestamp: new Date().toISOString()
    });
    // Also emit new style
    super.progress(message, percentage, data);
  }
  
  info(message, data) {
    this.emit('event', {
      type: 'info',
      tool: this.name,
      message,
      data,
      timestamp: new Date().toISOString()
    });
    super.info(message, data);
  }
  
  warning(message, data) {
    this.emit('event', {
      type: 'warning',
      tool: this.name,
      message,
      data,
      timestamp: new Date().toISOString()
    });
    super.warning(message, data);
  }
  
  error(message, data) {
    this.emit('event', {
      type: 'error',
      tool: this.name,
      message,
      data,
      timestamp: new Date().toISOString()
    });
    super.error(message, data);
  }
}

/**
 * ResourceManager compatibility wrapper
 */
export class CompatResourceManager {
  constructor(resourceManager) {
    this.rm = resourceManager;
  }
  
  get(name) {
    // Handle dot notation like 'env.API_KEY'
    const parts = name.split('.');
    let value = this.rm;
    for (const part of parts) {
      value = value[part];
      if (value === undefined) {
        throw new Error(`Resource '${name}' not found`);
      }
    }
    return value;
  }
  
  has(name) {
    try {
      this.get(name);
      return true;
    } catch {
      return false;
    }
  }
  
  register(name, value) {
    // Handle dot notation
    const parts = name.split('.');
    if (parts.length === 1) {
      this.rm[name] = value;
    } else {
      // Create nested structure
      let target = this.rm;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!target[parts[i]]) {
          target[parts[i]] = {};
        }
        target = target[parts[i]];
      }
      target[parts[parts.length - 1]] = value;
    }
  }
}