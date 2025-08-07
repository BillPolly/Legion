/**
 * Additional compatibility exports for complete module-loader replacement
 */

import { Module, Tool } from './compatibility.js';
import { ModuleInstance } from './modules/ModuleInstance.js';
import { ModuleLoader } from './ModuleLoader.js';
import { ResourceManager } from './ResourceManager.js';

/**
 * GenericTool - Base tool with common functionality
 */
export class GenericTool extends Tool {
  constructor(config) {
    super(config);
    this.config = config;
  }
}

/**
 * GenericModule - Base module with common functionality
 */
export class GenericModule extends Module {
  constructor(name, dependencies) {
    super(name, dependencies);
  }
}

/**
 * OpenAIToolAdapter - Adapter for OpenAI function calling
 */
export class OpenAIToolAdapter {
  constructor(tool) {
    this.tool = tool;
  }

  toOpenAIFunction() {
    return {
      name: this.tool.name,
      description: this.tool.description || 'No description',
      parameters: this.tool.inputSchema || {
        type: 'object',
        properties: {}
      }
    };
  }

  async execute(args) {
    return await this.tool.execute(args);
  }
}

/**
 * LegacyToolAdapter - Adapter for legacy tools
 */
export class LegacyToolAdapter {
  constructor(legacyTool) {
    this.legacyTool = legacyTool;
  }

  async execute(input) {
    // Adapt legacy tool execution
    if (this.legacyTool.run) {
      return await this.legacyTool.run(input);
    }
    if (this.legacyTool.execute) {
      return await this.legacyTool.execute(input);
    }
    throw new Error('Legacy tool has no run or execute method');
  }
}

/**
 * Adapt a legacy tool to new interface
 */
export function adaptLegacyTool(legacyTool) {
  return new LegacyToolAdapter(legacyTool);
}

/**
 * ModuleManager - Manages module lifecycle
 */
export class ModuleManager {
  constructor(moduleLoader) {
    this.moduleLoader = moduleLoader || new ModuleLoader();
    this.modules = new Map();
  }

  async loadModule(name, config) {
    const module = await this.moduleLoader.loadModule(name, config);
    this.modules.set(name, module);
    return module;
  }

  getModule(name) {
    return this.modules.get(name);
  }

  getAllModules() {
    return Array.from(this.modules.values());
  }
}

/**
 * ModuleRegistry - Registry of available modules
 */
export class ModuleRegistry {
  constructor() {
    this.registry = new Map();
  }

  register(name, moduleClass) {
    this.registry.set(name, moduleClass);
  }

  get(name) {
    return this.registry.get(name);
  }

  getAll() {
    return Array.from(this.registry.entries());
  }

  has(name) {
    return this.registry.has(name);
  }
}

/**
 * JsonModuleLoader - Load modules from JSON definitions
 */
export class JsonModuleLoader {
  constructor(resourceManager) {
    this.resourceManager = resourceManager || new ResourceManager();
  }

  async load(jsonPath) {
    const fs = await import('fs/promises');
    const content = await fs.readFile(jsonPath, 'utf-8');
    const definition = JSON.parse(content);
    
    return this.createFromDefinition(definition);
  }

  createFromDefinition(definition) {
    const { Module } = require('./compatibility.js');
    
    class JsonModule extends Module {
      constructor() {
        super(definition.name, definition.config || {});
        
        // Add tools from definition
        if (definition.tools) {
          for (const toolDef of definition.tools) {
            this.registerTool(this.createTool(toolDef));
          }
        }
      }

      createTool(toolDef) {
        return new Tool({
          name: toolDef.name,
          description: toolDef.description,
          inputSchema: toolDef.schema,
          execute: toolDef.execute || (async (input) => ({
            success: true,
            data: input
          }))
        });
      }
    }

    return new JsonModule();
  }
}

/**
 * Helper to get singleton ResourceManager
 */
let globalResourceManager;

export async function getResourceManager() {
  if (!globalResourceManager) {
    globalResourceManager = new ResourceManager();
    
    // Initialize if needed (load .env, etc)
    if (globalResourceManager.initialize) {
      await globalResourceManager.initialize();
    }
  }
  
  return globalResourceManager;
}