/**
 * ModuleLoader - Standardized loading of Legion modules using async factory pattern
 * 
 * Handles both async factory pattern modules and legacy modules consistently.
 */

import { LLMPlannerModule } from '@legion/llm-planner';
import { PlanExecutorModule } from '@legion/plan-executor';
import FileModule from '../../../general-tools/src/file/FileModule.js';
import { LegionModuleAdapter } from '../tools/LegionModuleAdapter.js';

export class ModuleLoader {
  constructor(toolRegistry, handleRegistry) {
    this.toolRegistry = toolRegistry;
    this.handleRegistry = handleRegistry;
    this.legionAdapter = null;
    this.loadedModules = new Map();
  }

  /**
   * Static async factory method following the ResourceManager pattern
   * @param {ResourceManager} resourceManager - ResourceManager instance
   * @returns {Promise<ModuleLoader>} Initialized ModuleLoader instance
   */
  static async create(resourceManager) {
    const toolRegistry = resourceManager.get('toolRegistry');
    const handleRegistry = resourceManager.get('handleRegistry');
    
    const loader = new ModuleLoader(toolRegistry, handleRegistry);
    await loader.initialize(resourceManager);
    
    return loader;
  }

  /**
   * Initialize the module loader
   * @param {ResourceManager} resourceManager - ResourceManager instance
   */
  async initialize(resourceManager) {
    // Create LegionModuleAdapter to bridge Legion tools to MCP
    this.legionAdapter = new LegionModuleAdapter(this.toolRegistry, this.handleRegistry);
    await this.legionAdapter.initialize();
    
    // Store reference to resource manager for module creation
    this.resourceManager = resourceManager;
  }

  /**
   * Load all configured modules
   * @returns {Promise<Array>} Array of loaded module information
   */
  async loadAllModules() {
    const loadedModules = [];

    try {
      // Load modules using async factory pattern where available
      const asyncFactoryModules = [
        {
          name: 'LLMPlannerModule',
          factory: () => LLMPlannerModule.create(this.legionAdapter.resourceManager)
        }
      ];

      for (const moduleConfig of asyncFactoryModules) {
        try {
          const moduleInstance = await moduleConfig.factory();
          const result = await this._loadModuleInstance(moduleInstance);
          loadedModules.push(result);
          console.error(`Loaded module: ${result.moduleName}`);
        } catch (error) {
          console.error(`Failed to load ${moduleConfig.name}:`, error.message);
        }
      }

      // Load legacy modules using old pattern
      const legacyModules = [
        {
          module: PlanExecutorModule,
          dependencies: {
            resourceManager: this.legionAdapter.resourceManager,
            moduleFactory: this.legionAdapter.moduleFactory
          }
        },
        {
          module: FileModule,
          dependencies: {
            basePath: process.cwd(),
            encoding: 'utf8',
            createDirectories: true,
            permissions: 0o755
          }
        }
      ];

      for (const config of legacyModules) {
        try {
          const result = await this.legionAdapter.loadModule(config.module, config.dependencies);
          loadedModules.push(result);
          console.error(`Loaded module: ${result.moduleName}`);
        } catch (error) {
          console.error(`Failed to load module ${config.module.name}:`, error.message);
        }
      }

      console.error(`Total modules loaded: ${loadedModules.length}`);
      return loadedModules;

    } catch (error) {
      console.error('Failed to load modules:', error);
      return [];
    }
  }

  /**
   * Load a module instance that was created using async factory pattern
   * @param {Object} moduleInstance - Already instantiated module
   * @returns {Promise<Object>} Module load result
   * @private
   */
  async _loadModuleInstance(moduleInstance) {
    // Register the tools from the created module
    const tools = moduleInstance.getTools();
    const registeredTools = [];

    for (const tool of tools) {
      const mcpTools = this.legionAdapter._convertToMCPTools(tool, moduleInstance);
      const toolsToRegister = Array.isArray(mcpTools) ? mcpTools : [mcpTools];
      
      for (const mcpTool of toolsToRegister) {
        this.toolRegistry.registerTool(mcpTool);
        registeredTools.push(mcpTool.name);
      }
    }
    
    // Store the loaded module
    this.legionAdapter.loadedModules.set(moduleInstance.name, moduleInstance);
    this.loadedModules.set(moduleInstance.name, moduleInstance);
    
    return {
      moduleName: moduleInstance.name,
      toolsRegistered: registeredTools.length,
      tools: registeredTools
    };
  }

  /**
   * Get all tool definitions from loaded modules
   * @returns {Array} Array of MCP tool definitions
   */
  getModuleToolDefinitions() {
    const allTools = this.toolRegistry.getAllTools();
    
    // Filter for tools from loaded modules (have legion-module tag)
    const moduleTools = allTools.filter(tool => 
      tool.tags && tool.tags.includes('legion-module')
    );

    // Convert to MCP tool definitions
    return moduleTools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }));
  }

  /**
   * Check if a tool is from a loaded module
   * @param {string} toolName - Name of the tool
   * @returns {boolean} True if it's a module tool
   */
  isModuleTool(toolName) {
    const tool = this.toolRegistry.getTool(toolName);
    return tool && tool.tags && tool.tags.includes('legion-module');
  }

  /**
   * Execute a tool from a loaded module
   * @param {string} toolName - Name of the tool
   * @param {Object} resolvedArgs - Already resolved arguments
   * @returns {Promise<Object>} Tool execution result
   */
  async executeModuleTool(toolName, resolvedArgs) {
    const registeredTool = this.toolRegistry.getTool(toolName);
    
    if (!registeredTool) {
      throw new Error(`Tool ${toolName} not found in registry`);
    }

    let result;
    
    // Check if it's a multi-function tool
    if (registeredTool.functions) {
      // Find the specific function
      const func = registeredTool.functions.find(f => f.name === toolName);
      if (func) {
        result = await func.execute(resolvedArgs);
      } else {
        throw new Error(`Function ${toolName} not found in multi-function tool`);
      }
    } else if (registeredTool.execute) {
      // Single function tool
      result = await registeredTool.execute(resolvedArgs);
    } else {
      throw new Error(`Tool ${toolName} has no execute method`);
    }

    return result;
  }

  /**
   * Get loaded modules information
   * @returns {Array} Array of loaded module info
   */
  getLoadedModulesInfo() {
    return Array.from(this.loadedModules.entries()).map(([name, module]) => ({
      name,
      description: module.description || 'No description',
      toolCount: module.getTools ? module.getTools().length : 0
    }));
  }
}