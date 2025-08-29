/**
 * ModuleService - Single Responsibility for Module Management
 * 
 * Handles only module-related operations:
 * - Module discovery
 * - Module loading  
 * - Module registration
 * - Module validation
 * 
 * Clean Architecture: Application Layer Service
 * Depends only on abstractions, not concretions
 */

export class ModuleService {
  constructor(dependencies) {
    // Minimal dependencies - only what we actually use
    this.moduleDiscovery = dependencies.moduleDiscovery;
    this.moduleLoader = dependencies.moduleLoader;
    this.moduleCache = dependencies.moduleCache;
    this.databaseService = dependencies.databaseService; // NEW: For Phase 2 tool persistence
    this.eventBus = dependencies.eventBus;
    
    // Store discovered modules for later loading
    this.discoveredModules = [];
  }

  /**
   * Discover modules from filesystem paths
   * Single responsibility: Only module discovery
   */
  async discoverModules(searchPaths) {
    if (!searchPaths?.length) {
      throw new Error('Search paths are required for module discovery');
    }

    // ModuleDiscovery.discoverModules takes a single path, so process each path
    const allModules = [];
    const errors = [];
    
    for (const searchPath of searchPaths) {
      try {
        const modules = await this.moduleDiscovery.discoverModules(searchPath);
        allModules.push(...modules);
      } catch (error) {
        errors.push({ path: searchPath, error: error.message });
      }
    }
    
    // Store discovered modules for later loading
    this.discoveredModules = allModules;
    
    this.eventBus.emit('modules:discovered', {
      count: allModules.length,
      modules: allModules
    });

    return {
      discovered: allModules.length,
      modules: allModules,
      errors: errors
    };
  }

  /**
   * Load a single module by name
   * Single responsibility: Only module loading
   */
  async loadModule(moduleName, moduleConfig) {
    // Check cache first
    const cachedModule = await this.moduleCache.get(moduleName);
    if (cachedModule) {
      return { success: true, cached: true, module: cachedModule };
    }

    try {
      const modulePath = this._extractModulePath(moduleConfig);
      const moduleInstance = await this.moduleLoader.loadModule(modulePath);
      
      // Validation removed - moduleValidator dependency not provided
      
      await this.moduleCache.set(moduleName, moduleInstance);
      
      // PHASE 2: Save tools to database (the actual repository)
      const moduleTools = moduleInstance.getTools();
      if (moduleTools && moduleTools.length > 0 && this.databaseService) {
        try {
          await this.databaseService.saveTools(moduleTools, moduleName);
          console.log(`[ModuleService] Saved ${moduleTools.length} tools from ${moduleName} to database`);
        } catch (error) {
          console.log(`[ModuleService] Failed to save tools for ${moduleName}:`, error.message);
          // Don't fail module loading if tool saving fails
        }
      }
      
      this.eventBus.emit('module:loaded', {
        name: moduleName,
        toolCount: moduleInstance.getTools().length
      });

      return { 
        success: true, 
        cached: false,
        module: moduleInstance,
        toolCount: moduleInstance.getTools().length 
      };

    } catch (error) {
      this.eventBus.emit('module:load-failed', {
        name: moduleName,
        error: error.message
      });
      
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  /**
   * Load multiple modules
   * Single responsibility: Orchestrate multiple module loads
   */
  async loadMultipleModules(moduleNames, options = {}) {
    const results = {
      loaded: 0,
      failed: 0,
      errors: [],
      modules: []
    };

    for (const moduleName of moduleNames) {
      // For module-centric approach, we assume moduleName is actually the path
      // or we try to resolve it from discovered modules
      let moduleConfig = {};
      
      // Try to find the module path from discovered modules if available
      try {
        const discoveredModules = await this.moduleDiscovery.getAllModuleNames?.() || [];
        // This would need to be enhanced to actually return module info, not just names
        moduleConfig = { path: moduleName }; // Fallback: assume moduleName is path
      } catch (error) {
        moduleConfig = { path: moduleName }; // Fallback: assume moduleName is path
      }
      
      const result = await this.loadModule(moduleName, moduleConfig);
      
      if (result.success) {
        results.loaded++;
        results.modules.push({
          name: moduleName,
          toolCount: result.toolCount
        });
      } else {
        results.failed++;
        results.errors.push({
          module: moduleName,
          error: result.error
        });
      }
    }

    this.eventBus.emit('modules:batch-loaded', results);
    return results;
  }

  /**
   * Load all registered modules
   * Single responsibility: Load all known modules
   */
  async loadAllModules(options = {}) {
    if (this.discoveredModules.length === 0) {
      return {
        loaded: 0,
        failed: 0,
        errors: ['No modules discovered - call discoverModules first'],
        modules: []
      };
    }

    // Extract module names and paths from discovered modules
    const moduleConfigs = this.discoveredModules.map(module => ({
      name: module.name,
      path: module.path
    }));

    const results = {
      loaded: 0,
      failed: 0,
      errors: [],
      modules: []
    };

    for (const moduleConfig of moduleConfigs) {
      const result = await this.loadModule(moduleConfig.name, { path: moduleConfig.path });
      
      if (result.success) {
        results.loaded++;
        results.modules.push({
          name: moduleConfig.name,
          toolCount: result.toolCount
        });
      } else {
        results.failed++;
        results.errors.push({
          module: moduleConfig.name,
          error: result.error
        });
      }
    }

    this.eventBus.emit('modules:batch-loaded', results);
    return results;
  }

  /**
   * Get module by name
   * Single responsibility: Module retrieval
   */
  async getModule(moduleName) {
    // Try cache first
    const cachedModule = await this.moduleCache.get(moduleName);
    if (cachedModule) {
      return cachedModule;
    }

    // Try to load if not cached
    const result = await this.loadModule(moduleName);
    if (result.success) {
      return result.module;
    }

    throw new Error(`Module not found: ${moduleName}`);
  }

  /**
   * Clear module from cache and registry
   * Single responsibility: Module cleanup
   */
  async clearModule(moduleName) {
    await this.moduleCache.remove(moduleName);
    // moduleRepository dependency not provided - cannot remove from repository
    
    this.eventBus.emit('module:cleared', { name: moduleName });
    
    return { success: true };
  }

  /**
   * Get module statistics
   * Single responsibility: Module metrics
   */
   async getModuleStatistics() {
    try {
      // Get list of loaded modules from cache
      const loadedModuleNames = [];
      
      // Check discovered modules that are actually cached/loaded
      for (const module of this.discoveredModules) {
        try {
          const cached = await this.moduleCache.get(module.name);
          if (cached) {
            loadedModuleNames.push(module.name);
          }
        } catch (error) {
          // Continue checking other modules
          continue;
        }
      }
      
      return {
        totalDiscovered: this.discoveredModules.length,
        totalLoaded: loadedModuleNames.length,
        loadedModules: loadedModuleNames,
        discoveredModules: this.discoveredModules.map(m => m.name)
      };
    } catch (error) {
      throw new Error(`Failed to get module statistics: ${error.message}`);
    }
  }

  /**
   * Extract module path from config
   * Private helper - single responsibility
   */
  _extractModulePath(moduleConfig) {
    if (typeof moduleConfig === 'string') {
      return moduleConfig;
    }
    
    if (moduleConfig?.path) {
      return moduleConfig.path;
    }
    
    throw new Error('Invalid module config: path is required');
  }
}