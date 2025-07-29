/**
 * ModuleHandler - Handles module operations for Aiur sessions
 * 
 * This replaces the removed module management tools by providing direct
 * integration with Legion's ModuleManager for module operations.
 */

import { EventEmitter } from 'events';

export class ModuleHandler extends EventEmitter {
  constructor(moduleManager, logManager) {
    super();
    this.moduleManager = moduleManager;
    this.logManager = logManager;
  }

  /**
   * Create module handler instance
   */
  static async create(resourceManager) {
    const moduleManager = resourceManager.get('moduleManager');
    const logManager = resourceManager.get('logManager');
    
    console.log('[ModuleHandler.create] Getting moduleManager from resourceManager:', {
      hasModuleManager: resourceManager.has('moduleManager'),
      moduleManagerExists: !!moduleManager
    });
    
    if (!moduleManager) {
      throw new Error('ModuleManager not found in ResourceManager');
    }
    
    return new ModuleHandler(moduleManager, logManager);
  }

  /**
   * List available modules
   */
  async listModules(filter) {
    try {
      const available = this.moduleManager.getAvailableModules();
      const loaded = this.moduleManager.getLoadedModules();
      
      // Create a map of loaded module names for quick lookup
      const loadedNames = new Set(loaded.map(m => m.name));
      
      // Filter if requested
      let filteredAvailable = available;
      if (filter) {
        const regex = new RegExp(filter, 'i');
        filteredAvailable = available.filter(m => 
          regex.test(m.name) || regex.test(m.description || '')
        );
      }
      
      // Format response
      return {
        success: true,
        available: filteredAvailable.map(m => ({
          name: m.name,
          description: m.description || 'No description',
          type: m.type || 'unknown',
          status: loadedNames.has(m.name) ? 'loaded' : 'available',
          toolCount: m.toolCount || 0
        })),
        loaded: loaded.map(m => ({
          name: m.name,
          description: m.instance?.description || 'No description',
          toolCount: m.instance?.getTools ? m.instance.getTools().length : 0,
          status: 'loaded'
        })),
        total: {
          available: filteredAvailable.length,
          loaded: loaded.length
        }
      };
    } catch (error) {
      await this.logManager.logError(error, {
        source: 'ModuleHandler',
        operation: 'list-modules',
        filter
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check if a module is already loaded
   */
  async isModuleLoaded(moduleName) {
    try {
      const loadedModules = this.moduleManager.getLoadedModules();
      return loadedModules.some(module => module.name === moduleName);
    } catch (error) {
      console.error(`Error checking if module ${moduleName} is loaded:`, error);
      return false;
    }
  }

  /**
   * Load a module
   */
  async loadModule(moduleName) {
    try {
      await this.logManager.logInfo('Loading module', {
        source: 'ModuleHandler',
        operation: 'load-module',
        module: moduleName
      });
      
      // Debug: Check ModuleManager before loading
      console.log(`[ModuleHandler] Before loading ${moduleName}:`, {
        moduleManagerExists: !!this.moduleManager,
        currentLoadedCount: this.moduleManager.getLoadedModules().length
      });
      
      // Load the module through ModuleManager
      const moduleInstance = await this.moduleManager.loadModule(moduleName);
      
      if (!moduleInstance) {
        throw new Error(`Failed to load module: ${moduleName}`);
      }
      
      // Debug: Check ModuleManager after loading
      console.log(`[ModuleHandler] After loading ${moduleName}:`, {
        moduleInstanceExists: !!moduleInstance,
        newLoadedCount: this.moduleManager.getLoadedModules().length,
        loadedModules: this.moduleManager.getLoadedModules().map(m => m.name || 'unnamed')
      });
      
      // Get tools from the loaded module
      const toolsResult = moduleInstance.getTools();
      // Handle both synchronous arrays and async promises
      const tools = toolsResult && typeof toolsResult.then === 'function' 
        ? await toolsResult 
        : toolsResult;
      const toolCount = tools ? tools.length : 0;
      
      await this.logManager.logInfo('Module loaded successfully', {
        source: 'ModuleHandler',
        operation: 'load-module-success',
        module: moduleName,
        toolCount
      });
      
      // Emit event to notify ToolDefinitionProvider of module change
      console.log(`[ModuleHandler] Emitting module-loaded event for: ${moduleName}`);
      this.emit('module-loaded', moduleName, { toolCount, tools });
      
      return {
        success: true,
        message: `Module '${moduleName}' loaded successfully`,
        module: {
          name: moduleName,
          toolCount,
          tools: tools ? tools.map(t => t.name || 'unnamed') : []
        }
      };
    } catch (error) {
      await this.logManager.logError(error, {
        source: 'ModuleHandler',
        operation: 'load-module-error',
        module: moduleName
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Unload a module
   */
  async unloadModule(moduleName) {
    try {
      const result = await this.moduleManager.unloadModule(moduleName);
      
      if (result && result.success) {
        // Emit event to notify ToolDefinitionProvider of module change
        console.log(`[ModuleHandler] Emitting module-unloaded event for: ${moduleName}`);
        this.emit('module-unloaded', moduleName);
        
        return {
          success: true,
          message: `Module '${moduleName}' unloaded successfully`
        };
      } else {
        return {
          success: false,
          error: result?.error || 'Failed to unload module'
        };
      }
    } catch (error) {
      await this.logManager.logError(error, {
        source: 'ModuleHandler',
        operation: 'unload-module',
        module: moduleName
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get module information
   */
  async getModuleInfo(moduleName) {
    try {
      // Check if module is loaded
      const loaded = this.moduleManager.getLoadedModules();
      const loadedModule = loaded.find(m => m.name === moduleName);
      
      if (loadedModule) {
        let tools = [];
        if (loadedModule.instance.getTools) {
          const toolsResult = loadedModule.instance.getTools();
          tools = toolsResult && typeof toolsResult.then === 'function' 
            ? await toolsResult 
            : toolsResult;
        }
          
        return {
          success: true,
          module: {
            name: moduleName,
            status: 'loaded',
            description: loadedModule.instance.description || 'No description',
            toolCount: tools.length,
            tools: tools.map(t => ({
              name: t.name || 'unnamed',
              description: t.description || 'No description'
            }))
          }
        };
      }
      
      // Check available modules
      const available = this.moduleManager.getAvailableModules();
      const availableModule = available.find(m => m.name === moduleName);
      
      if (availableModule) {
        return {
          success: true,
          module: {
            name: moduleName,
            status: 'available',
            description: availableModule.description || 'No description',
            type: availableModule.type || 'unknown',
            toolCount: availableModule.toolCount || 0
          }
        };
      }
      
      return {
        success: false,
        error: `Module '${moduleName}' not found`
      };
    } catch (error) {
      await this.logManager.logError(error, {
        source: 'ModuleHandler',
        operation: 'get-module-info',
        module: moduleName
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get tools for a specific module
   */
  async getModuleTools(moduleName) {
    try {
      console.log(`[ModuleHandler.getModuleTools] Getting tools for module: ${moduleName}`);
      const info = await this.moduleManager.getModuleInfo(moduleName);
      console.log(`[ModuleHandler.getModuleTools] Module info:`, info);
      
      if (!info) {
        console.log(`[ModuleHandler.getModuleTools] Module '${moduleName}' not found`);
        return {
          success: false,
          error: `Module '${moduleName}' not found`
        };
      }
      
      const result = {
        success: true,
        module: moduleName,
        status: info.status,
        toolCount: info.tools ? info.tools.length : 0,
        tools: info.tools || []
      };
      
      console.log(`[ModuleHandler.getModuleTools] Returning result:`, result);
      return result;
    } catch (error) {
      await this.logManager.logError(error, {
        source: 'ModuleHandler',
        operation: 'get-module-tools',
        module: moduleName
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Discover modules in specified directories
   */
  async discoverModules(directories) {
    try {
      const results = await this.moduleManager.discoverModules(directories);
      
      return {
        success: true,
        discovered: results,
        message: `Discovered ${results.length} modules`
      };
    } catch (error) {
      await this.logManager.logError(error, {
        source: 'ModuleHandler',
        operation: 'discover-modules',
        directories
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default ModuleHandler;