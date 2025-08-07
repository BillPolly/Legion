/**
 * ModuleManagerNode - Manages module loading/unloading operations
 * 
 * Handles module lifecycle operations including loading, unloading,
 * and listing modules within BT workflows.
 */

import { BehaviorTreeNode, NodeStatus } from '../../../../shared/actor-BT/src/core/BehaviorTreeNode.js';

export class ModuleManagerNode extends BehaviorTreeNode {
  static getTypeName() {
    return 'module_manager';
  }

  constructor(config, toolRegistry, executor) {
    super(config, toolRegistry, executor);
    
    this.action = config.action || 'load'; // load, unload, list
    this.moduleName = config.moduleName || config.module;
    this.force = config.force || false;
    this.validateModule = config.validateModule !== false;
  }

  async executeNode(context) {
    try {
      // Get module loader from context
      const moduleLoader = context.moduleLoader;
      if (!moduleLoader) {
        return this.createFailureResult('ModuleLoader not available in context');
      }

      // Determine action to perform
      const action = this.action || context.action || context.message?.action;
      
      switch (action) {
        case 'load':
          return await this.handleModuleLoad(moduleLoader, context);
          
        case 'unload':
          return await this.handleModuleUnload(moduleLoader, context);
          
        case 'list':
          return await this.handleModuleList(moduleLoader, context);
          
        default:
          return this.createFailureResult(`Unknown module action: ${action}`);
      }
      
    } catch (error) {
      return this.createFailureResult(`Module management failed: ${error.message}`, error);
    }
  }

  /**
   * Handle module loading
   */
  async handleModuleLoad(moduleLoader, context) {
    const moduleName = this.moduleName || context.moduleName || context.message?.moduleName;
    
    if (!moduleName) {
      return this.createFailureResult('No module name specified for loading');
    }

    try {
      // Check if module is already loaded
      if (moduleLoader.hasModule && moduleLoader.hasModule(moduleName) && !this.force) {
        return this.createSuccessResult({
          action: 'load',
          moduleName,
          status: 'already_loaded',
          message: `Module ${moduleName} is already loaded`
        });
      }

      // Load the module
      await moduleLoader.loadModuleByName(moduleName);
      
      // Get loaded tools count if available
      let toolsCount = 0;
      if (moduleLoader.getModuleTools) {
        const tools = await moduleLoader.getModuleTools(moduleName);
        toolsCount = tools ? tools.length : 0;
      }

      return this.createSuccessResult({
        action: 'load',
        moduleName,
        status: 'loaded',
        toolsCount,
        message: `Successfully loaded module ${moduleName}`
      });

    } catch (error) {
      return this.createFailureResult(`Failed to load module ${moduleName}: ${error.message}`, error);
    }
  }

  /**
   * Handle module unloading
   */
  async handleModuleUnload(moduleLoader, context) {
    const moduleName = this.moduleName || context.moduleName || context.message?.moduleName;
    
    if (!moduleName) {
      return this.createFailureResult('No module name specified for unloading');
    }

    try {
      // Check if module is loaded
      if (moduleLoader.hasModule && !moduleLoader.hasModule(moduleName)) {
        return this.createSuccessResult({
          action: 'unload',
          moduleName,
          status: 'not_loaded',
          message: `Module ${moduleName} is not loaded`
        });
      }

      // Unload the module
      if (moduleLoader.unloadModule) {
        await moduleLoader.unloadModule(moduleName);
      } else {
        // Fallback: remove from tool registry
        if (this.toolRegistry && this.toolRegistry.removeModule) {
          this.toolRegistry.removeModule(moduleName);
        }
      }

      return this.createSuccessResult({
        action: 'unload',
        moduleName,
        status: 'unloaded',
        message: `Successfully unloaded module ${moduleName}`
      });

    } catch (error) {
      return this.createFailureResult(`Failed to unload module ${moduleName}: ${error.message}`, error);
    }
  }

  /**
   * Handle module listing
   */
  async handleModuleList(moduleLoader, context) {
    try {
      const modules = [];
      
      // Get loaded modules
      if (moduleLoader.getLoadedModules) {
        const loadedModules = await moduleLoader.getLoadedModules();
        modules.push(...loadedModules.map(name => ({
          name,
          status: 'loaded',
          type: 'loaded'
        })));
      }
      
      // Get available modules if possible
      if (moduleLoader.getAvailableModules) {
        const availableModules = await moduleLoader.getAvailableModules();
        const loadedNames = modules.map(m => m.name);
        
        availableModules
          .filter(name => !loadedNames.includes(name))
          .forEach(name => modules.push({
            name,
            status: 'available',
            type: 'available'
          }));
      }

      return this.createSuccessResult({
        action: 'list',
        modules,
        count: modules.length,
        loadedCount: modules.filter(m => m.status === 'loaded').length,
        availableCount: modules.filter(m => m.status === 'available').length
      });

    } catch (error) {
      return this.createFailureResult(`Failed to list modules: ${error.message}`, error);
    }
  }

  /**
   * Create success result
   */
  createSuccessResult(data) {
    return {
      status: NodeStatus.SUCCESS,
      data: {
        moduleManagement: true,
        ...data
      }
    };
  }

  /**
   * Create failure result
   */
  createFailureResult(message, error = null) {
    return {
      status: NodeStatus.FAILURE,
      data: {
        moduleManagement: false,
        error: message,
        details: error ? {
          message: error.message,
          stack: error.stack
        } : undefined
      }
    };
  }

  /**
   * Get node metadata
   */
  getMetadata() {
    return {
      ...super.getMetadata(),
      nodeType: 'module_manager',
      purpose: 'Module lifecycle management',
      actions: ['load', 'unload', 'list'],
      capabilities: [
        'module_loading',
        'module_unloading',
        'module_listing',
        'dependency_checking'
      ]
    };
  }
}