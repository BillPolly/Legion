/**
 * Simplified ModuleLoader for tool-system
 * Provides backward compatibility with module-loader's ModuleLoader
 * 
 * AUTOMATICALLY INSTRUMENTS ALL TOOLS FOR OBSERVABILITY
 */

import { ResourceManager } from './ResourceManager.js';
import { ModuleFactory } from './ModuleFactory.js';
import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';

export class ModuleLoader {
  constructor(options = {}) {
    this.resourceManager = options.resourceManager || new ResourceManager();
    this.moduleFactory = new ModuleFactory(this.resourceManager);
    this.modules = new Map();
    this.tools = new Map();
    this.initialized = false;
    
    // Observability configuration
    this.enableObservability = options.enableObservability !== false;
    this.tracedToolProxy = null;
    
    // Store TracedToolProxy class if available
    this.TracedToolProxy = options.TracedToolProxy || null;
  }

  /**
   * Initialize the ModuleLoader
   * Loads ResourceManager and discovers modules
   */
  async initialize() {
    if (this.initialized) return;

    // Initialize ResourceManager if it has an initialize method
    if (this.resourceManager.initialize) {
      await this.resourceManager.initialize();
    }

    // Auto-discover modules if path provided
    if (this.options?.modulePath) {
      await this.discoverModules(this.options.modulePath);
    }

    this.initialized = true;
  }

  /**
   * Load a module by name or path
   * @param {string} nameOrPath - Module name or file path
   * @param {Object} config - Optional configuration
   * @returns {Promise<Module>} Loaded module instance
   */
  async loadModule(nameOrPath, config = {}) {
    // Check if already loaded
    if (this.modules.has(nameOrPath)) {
      return this.modules.get(nameOrPath);
    }

    // Create module instance
    const module = await this.moduleFactory.create(nameOrPath, config);
    
    // Store module
    this.modules.set(nameOrPath, module);
    
    // Register module's tools
    if (module.getTools) {
      const tools = module.getTools();
      for (const tool of tools) {
        this.registerTool(tool.name || tool.constructor.name, tool);
      }
    }

    return module;
  }

  /**
   * Load a module by name, with optional class override
   * @param {string} name - Module name
   * @param {Function} ModuleClass - Optional module class
   * @returns {Promise<Module>} Module instance
   */
  async loadModuleByName(name, ModuleClass = null) {
    if (this.modules.has(name)) {
      return this.modules.get(name);
    }

    if (ModuleClass) {
      this.moduleFactory.registerModule(name, ModuleClass);
    }

    return this.loadModule(name);
  }

  /**
   * Discover and load modules from a directory
   * @param {string} modulesPath - Path to modules directory
   */
  async discoverModules(modulesPath) {
    // Find all module.json and *Module.js files
    const patterns = [
      path.join(modulesPath, '**/module.json'),
      path.join(modulesPath, '**/*Module.js')
    ];

    for (const pattern of patterns) {
      const files = await glob(pattern, {
        ignore: ['**/node_modules/**', '**/__tests__/**']
      });

      for (const file of files) {
        try {
          const moduleName = path.basename(path.dirname(file));
          await this.loadModule(file);
          console.log(`Loaded module: ${moduleName} from ${file}`);
        } catch (error) {
          console.warn(`Failed to load module from ${file}:`, error.message);
        }
      }
    }
  }

  /**
   * Register a tool (automatically wrapped with tracing if observability is enabled)
   * @param {string} name - Tool name
   * @param {Tool} tool - Tool instance
   */
  registerTool(name, tool) {
    // Wrap tool with tracing if observability is enabled
    let registeredTool = tool;
    
    if (this.enableObservability && this.TracedToolProxy) {
      registeredTool = this.TracedToolProxy.create(tool, {
        category: this.getModuleNameForTool(name)
      });
    }
    
    this.tools.set(name, registeredTool);
    
    // Also register by tool's own name if different
    if (tool.name && tool.name !== name) {
      this.tools.set(tool.name, registeredTool);
    }
  }
  
  /**
   * Get module name for a tool (for categorization)
   */
  getModuleNameForTool(toolName) {
    // Find which module contains this tool
    for (const [moduleName, module] of this.modules) {
      if (module.getTools) {
        const tools = module.getTools();
        if (tools.some(t => t.name === toolName || t.constructor.name === toolName)) {
          return moduleName;
        }
      }
    }
    return 'unknown';
  }

  /**
   * Get a tool by name
   * @param {string} name - Tool name
   * @returns {Tool} Tool instance
   */
  getTool(name) {
    return this.tools.get(name);
  }

  /**
   * Get tool by name or alias
   * @param {string} name - Tool name or alias
   * @returns {Promise<Tool>} Tool instance
   */
  async getToolByNameOrAlias(name) {
    // Check direct name first
    if (this.tools.has(name)) {
      return this.tools.get(name);
    }

    // Check all tools for matching name
    for (const [key, tool] of this.tools) {
      if (tool.name === name || tool.aliases?.includes(name)) {
        return tool;
      }
    }

    return null;
  }

  /**
   * Get all loaded modules
   * @returns {Map<string, Module>} All modules
   */
  getModules() {
    return this.modules;
  }

  /**
   * Get all registered tools
   * @returns {Map<string, Tool>} All tools
   */
  getTools() {
    return this.tools;
  }
  
  /**
   * Get all tools as array (alias for compatibility)
   * @returns {Tool[]} Array of all tools
   */
  async getAllTools() {
    return Array.from(this.tools.values());
  }
  
  /**
   * Get names of all loaded modules
   * @returns {string[]} Module names
   */
  getLoadedModuleNames() {
    return Array.from(this.modules.keys());
  }

  /**
   * Get all tool names
   * @returns {string[]} Tool names
   */
  getToolNames() {
    return Array.from(this.tools.keys());
  }

  /**
   * Execute a tool by name
   * @param {string} toolName - Tool name
   * @param {Object} input - Tool input
   * @returns {Promise<*>} Tool result
   */
  async executeTool(toolName, input) {
    const tool = await this.getToolByNameOrAlias(toolName);
    
    if (!tool) {
      throw new Error(`Tool '${toolName}' not found`);
    }

    // Execute tool - support both execute and run methods
    if (tool.execute) {
      return await tool.execute(input);
    } else if (tool.run) {
      return await tool.run(input);
    } else {
      throw new Error(`Tool '${toolName}' has no execute or run method`);
    }
  }

  /**
   * Clear all modules and tools
   */
  clear() {
    this.modules.clear();
    this.tools.clear();
    this.moduleFactory.clearCache();
  }

  /**
   * Get module metadata
   * @returns {Object} Metadata about loaded modules and tools
   */
  getMetadata() {
    return {
      modules: Array.from(this.modules.keys()),
      tools: Array.from(this.tools.keys()),
      initialized: this.initialized
    };
  }
}

// Default export
export default ModuleLoader;