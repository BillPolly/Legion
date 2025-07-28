/**
 * ModuleLoader - Standardized loading of Legion modules using ModuleManager
 * 
 * Uses the centralized ModuleManager for dynamic module discovery and loading.
 */

import { ModuleManager, ModuleFactory } from '@legion/module-loader';
import path from 'path';
import ModuleManagerModule from '../../../general-tools/src/module-manager/ModuleManagerModule.js';
import { LegionModuleAdapter } from '../tools/LegionModuleAdapter.js';

export class ModuleLoader {
  constructor(toolRegistry, handleRegistry) {
    this.toolRegistry = toolRegistry;
    this.handleRegistry = handleRegistry;
    this.legionAdapter = null;
    this.loadedModules = new Map();
    this.moduleManager = null;
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
    
    // Create ModuleFactory and ModuleManager
    const moduleFactory = new ModuleFactory(this.legionAdapter.resourceManager);
    this.moduleManager = new ModuleManager(moduleFactory, {
      searchDepth: 3,
      autoDiscover: false // We'll discover manually
    });
    
    // First, load the ModuleManagerModule to make module management tools available
    try {
      const moduleManagerModule = new ModuleManagerModule({ ResourceManager: this.legionAdapter.resourceManager });
      await this._loadModuleInstance(moduleManagerModule);
      console.log('[ModuleLoader] Loaded ModuleManagerModule - module management tools now available');
    } catch (error) {
      console.error('[ModuleLoader] Failed to load ModuleManagerModule:', error);
    }
  }

  /**
   * Load all configured modules
   * @returns {Promise<Array>} Array of loaded module information
   */
  async loadAllModules() {
    const loadedModules = [];
    const errorBroadcastService = this._getErrorBroadcastService();
    const logManager = this.legionAdapter.resourceManager.has('logManager') ? 
      this.legionAdapter.resourceManager.get('logManager') : null;

    try {
      // Define directories to search for modules - navigate up to Legion root
      const currentPath = process.cwd();
      // If we're in aiur-debug-ui, go up to Legion root
      const basePath = currentPath.includes('aiur-debug-ui') 
        ? path.resolve(currentPath, '../../../')
        : currentPath;
        
      const moduleDirectories = [
        path.join(basePath, 'packages/general-tools/src'),
        path.join(basePath, 'packages/apps'),
        path.join(basePath, 'packages/code-gen')
      ];

      // Discover available modules
      console.log('[ModuleLoader] Discovering modules in:', moduleDirectories);
      const discovered = await this.moduleManager.discoverModules(moduleDirectories);
      console.log(`[ModuleLoader] Discovered ${discovered.size} modules`);

      // Define modules to auto-load
      const autoLoadModules = [
        'llm-planner',     // LLMPlannerModule
        'plan-executor',   // PlanExecutorModule
        'file',           // FileModule
        'context'         // Context management tools
      ];

      // Load specified modules
      for (const moduleName of autoLoadModules) {
        try {
          if (this.moduleManager.isModuleLoaded(moduleName)) {
            console.log(`[ModuleLoader] Module '${moduleName}' already loaded`);
            continue;
          }

          const moduleInstance = await this.moduleManager.loadModule(moduleName);
          const result = await this._loadModuleInstance(moduleInstance);
          loadedModules.push(result);
          
          if (logManager) {
            logManager.logInfo(`Loaded module: ${result.moduleName}`, {
              source: 'ModuleLoader',
              operation: 'load-module',
              moduleName: result.moduleName
            });
          }
        } catch (error) {
          console.error(`[ModuleLoader] Failed to load module '${moduleName}':`, error.message);
          
          if (logManager) {
            logManager.logError(error, {
              source: 'ModuleLoader',
              operation: 'load-module-failed',
              moduleName: moduleName
            });
          }
          
          if (errorBroadcastService) {
            errorBroadcastService.captureModuleError(error, moduleName);
          }
          // Continue loading other modules
        }
      }

      // Log statistics
      const stats = this.moduleManager.getStats();
      console.log('[ModuleLoader] Module loading complete:', {
        discovered: stats.totalDiscovered,
        loaded: stats.totalLoaded,
        available: stats.totalAvailable
      });

      if (logManager) {
        logManager.logInfo(`Module loading complete`, {
          source: 'ModuleLoader',
          operation: 'load-all-modules-complete',
          stats: stats
        });
      }

      return loadedModules;

    } catch (error) {
      console.error('[ModuleLoader] Critical error during module loading:', error);
      
      if (logManager) {
        logManager.logError(error, {
          source: 'ModuleLoader',
          operation: 'load-all-modules-critical-error',
          severity: 'critical'
        });
      }
      
      if (errorBroadcastService) {
        errorBroadcastService.captureError({
          error,
          errorType: 'module-load',
          severity: 'critical',
          source: 'ModuleLoader',
          context: {
            operation: 'loadAllModules',
            phase: 'critical-failure'
          }
        });
      }
      
      return loadedModules; // Return what we managed to load
    }
  }

  /**
   * Load a module instance that was created using async factory pattern
   * @param {Object} moduleInstance - Already instantiated module
   * @returns {Promise<Object>} Module load result
   * @private
   */
  async _loadModuleInstance(moduleInstance) {
    // Initialize the module if it has an initialize method
    if (typeof moduleInstance.initialize === 'function') {
      try {
        await moduleInstance.initialize();
      } catch (error) {
        console.warn(`[ModuleLoader] Failed to initialize module ${moduleInstance.name}:`, error);
      }
    }
    
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
    const errorBroadcastService = this._getErrorBroadcastService();
    
    try {
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
    } catch (error) {
      // Capture and broadcast the error
      if (errorBroadcastService) {
        errorBroadcastService.captureToolError(error, toolName, resolvedArgs);
      }
      
      // Re-throw to maintain original behavior
      throw error;
    }
  }

  /**
   * Get loaded modules information
   * @returns {Array} Array of loaded module info
   */
  getLoadedModulesInfo() {
    const loadedModules = this.moduleManager.getLoadedModules();
    return loadedModules.map(entry => {
      const module = entry.instance;
      return {
        name: entry.name,
        description: module?.description || module?.getDescription?.() || 'No description',
        toolCount: module?.getTools ? module.getTools().length : 0,
        type: entry.metadata?.type || 'unknown',
        status: entry.metadata?.status || 'loaded'
      };
    });
  }

  /**
   * Get error broadcast service if available
   * @private
   * @returns {ErrorBroadcastService|null}
   */
  _getErrorBroadcastService() {
    try {
      // Try to get from resource manager if available
      if (this.resourceManager) {
        return this.resourceManager.get('errorBroadcastService');
      }
    } catch (error) {
      // Service not available yet
    }
    return null;
  }
}