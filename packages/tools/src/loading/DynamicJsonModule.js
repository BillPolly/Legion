/**
 * Dynamic JSON Module
 * 
 * Simple class that takes a module.json file and creates tools dynamically.
 * Converts JSON tool definitions to executable functions with minimal complexity.
 */

import { Module } from '../modules/Module.js';
import { Tool } from '../modules/Tool.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * Dynamic tool created from JSON definition
 */
class DynamicTool extends Tool {
  constructor(toolDefinition) {
    super({
      name: toolDefinition.name,
      description: toolDefinition.description,
      inputSchema: toolDefinition.parameters || toolDefinition.inputSchema
    });
    
    // Create the execute function from the JSON function string
    if (typeof toolDefinition.function === 'string') {
      // Extract function body from string
      const funcBody = toolDefinition.function.replace(/^async\s+function\s+\w+\s*\([^)]*\)\s*{/, '')
                                              .replace(/}$/, '');
      // Create async function
      this.executeFunc = new Function('params', `
        return (async () => {
          ${funcBody}
        })();
      `);
    } else {
      // If no function provided, return a default response
      this.executeFunc = async (params) => ({
        success: true,
        message: `Tool ${this.name} executed`,
        params
      });
    }
  }

  async execute(params) {
    try {
      return await this.executeFunc.call(this, params);
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

/**
 * Module that loads tools from a JSON file
 */
export class DynamicJsonModule extends Module {
  constructor(config = {}) {
    super();
    this.name = config.name || 'dynamic-json-module';
    this.description = config.description || 'Dynamically loaded JSON module';
    this.jsonPath = config.jsonPath;
    this.tools = {}; // Dictionary pattern
    this.initialized = false;
  }

  /**
   * Static factory method to create and initialize a module from JSON
   */
  static async createFromJson(jsonPath, monorepoRoot) {
    const fullPath = path.isAbsolute(jsonPath) 
      ? jsonPath 
      : path.join(monorepoRoot, jsonPath, 'module.json');
    
    // Read and parse the JSON file
    const jsonContent = await fs.readFile(fullPath, 'utf-8');
    const moduleDefinition = JSON.parse(jsonContent);
    
    // Create the module instance
    const module = new DynamicJsonModule({
      name: moduleDefinition.name,
      description: moduleDefinition.description,
      jsonPath: fullPath
    });
    
    // Load tools from the definition
    module.loadTools(moduleDefinition);
    module.initialized = true;
    
    return module;
  }

  /**
   * Load tools from the module definition
   */
  loadTools(moduleDefinition) {
    if (!moduleDefinition.tools || !Array.isArray(moduleDefinition.tools)) {
      return;
    }
    
    // Create tools and register them in dictionary
    moduleDefinition.tools.forEach(toolDef => {
      const tool = new DynamicTool(toolDef);
      this.registerTool(tool.name, tool);
    });
  }

  /**
   * Get module metadata
   */
  getMetadata() {
    return {
      name: this.name,
      description: this.description,
      type: 'json',
      toolCount: Object.keys(this.tools).length,
      jsonPath: this.jsonPath
    };
  }
}

export default DynamicJsonModule;