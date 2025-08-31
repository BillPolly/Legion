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
   * Discover modules from filesystem paths using proper workflow
   * Single responsibility: find file → get path → load MODULE object → validate → store
   */
  async discoverModules(searchPaths) {
    let discoveryResult;
    const errors = [];
    
    if (!searchPaths?.length) {
      // Use discoverAndValidate for complete workflow: discover → load → validate
      discoveryResult = await this.moduleDiscovery.discoverAndValidate();
    } else {
      // For specific search paths, discover and validate each path
      const allModules = [];
      for (const searchPath of searchPaths) {
        try {
          const modules = await this.moduleDiscovery.discoverModules(searchPath);
          allModules.push(...modules);
        } catch (error) {
          errors.push({ path: searchPath, error: error.message });
        }
      }
      
      // Now validate the discovered modules using the proper workflow
      const results = {
        discovered: allModules.length,
        validated: [],
        invalid: [],
        summary: { total: allModules.length, valid: 0, invalid: 0 }
      };
      
      console.log(`[ModuleService] Starting validation of ${allModules.length} modules...`);
      let moduleIndex = 0;
      
      for (const module of allModules) {
        try {
          moduleIndex++;
          
          // TEMPORARY: Skip problematic modules that cause hangs during initialization
          const skipModules = ['RailwayModule']; // ConanTheDeployerModule circular dependency fixed
          if (skipModules.includes(module.name)) {
            console.log(`[ModuleService] SKIPPING ${module.name} (problematic initialization)`);
            results.invalid.push({
              ...module,
              validation: { valid: false, errors: ['Module causes hang during initialization'], toolsCount: 0 }
            });
            results.summary.invalid++;
            continue;
          }
          
          console.log(`[ModuleService] Loading module ${moduleIndex}/${allModules.length}: ${module.name}...`);
          const loadStart = Date.now();
          
          // Use reusable loading function: find file → get path → load MODULE object
          const moduleObject = await this.moduleLoader.loadModule(module.path);
          console.log(`[ModuleService]   Loaded in ${Date.now() - loadStart}ms`);
          
          // Validate the loaded MODULE object (not the path)
          const validation = await this.moduleDiscovery.validateModule(moduleObject);
          console.log(`[ModuleService]   Valid: ${validation.valid}, Tools: ${validation.toolsCount}`);
          
          const moduleResult = {
            ...module,
            validation,
            moduleObject // Keep the loaded MODULE object
          };
          
          if (validation.valid) {
            results.validated.push(moduleResult);
            results.summary.valid++;
          } else {
            results.invalid.push(moduleResult);
            results.summary.invalid++;
          }
        } catch (loadError) {
          const validation = {
            valid: false,
            score: 0,
            toolsCount: 0,
            errors: [`Failed to load module: ${loadError.message}`],
            warnings: [],
            metadata: null
          };
          
          results.invalid.push({
            ...module,
            validation
          });
          results.summary.invalid++;
        }
      }
      
      discoveryResult = results;
    }
    
    // CRITICAL: Discovery process - ONLY writes to module-registry collection
    // DO NOT CONFUSE: 
    // - module-registry collection = discovered modules (written HERE during discovery)
    // - modules collection = loaded/active modules (written during LOAD process only)
    // - tools collection = actual tool instances (written during LOAD process only)
    
    const discoveredModules = []; // Renamed to avoid confusion with loaded modules
    for (const moduleResult of [...discoveryResult.validated, ...discoveryResult.invalid]) {
      try {
        // Create module document with validation results and tool count
        const moduleDoc = {
          name: moduleResult.name,
          path: moduleResult.path,
          relativePath: moduleResult.relativePath,
          packageName: moduleResult.packageName,
          discoveredAt: moduleResult.discoveredAt,
          toolsCount: moduleResult.validation?.toolsCount || 0,
          valid: moduleResult.validation?.valid || false,
          score: moduleResult.validation?.score || 0,
          lastUpdated: new Date().toISOString(),
          status: 'discovered'
        };
        
        // WRITES TO: module-registry collection (tracks discovered modules)
        // DOES NOT WRITE TO: modules collection (that's for loaded modules)
        // DOES NOT WRITE TO: tools collection (that's for loaded tools)
        const savedModule = await this.databaseService.saveDiscoveredModule(moduleDoc);
        discoveredModules.push({
          ...moduleResult,
          _id: savedModule._id,
          toolsCount: moduleDoc.toolsCount
        });
      } catch (error) {
        console.log(`[ModuleService] Failed to save discovered module ${moduleResult.name}:`, error.message);
        // Still include the module even if save fails, but without _id
        discoveredModules.push(moduleResult);
        errors.push({ module: moduleResult.name, error: error.message });
      }
    }
    
    // Store discovered modules with their database _id and MODULE objects for later loading
    // These are stored in memory for the load process to use later
    this.discoveredModules = discoveredModules;
    
    // Calculate total tools discovered (not loaded, just discovered)
    const totalTools = discoveredModules.reduce((sum, module) => sum + (module.toolsCount || 0), 0);
    
    this.eventBus.emit('modules:discovered', {
      count: discoveredModules.length,
      tools: totalTools,
      modules: discoveredModules
    });

    return {
      discovered: discoveredModules.length,
      tools: totalTools,
      modules: discoveredModules,
      valid: discoveryResult.summary?.valid || 0,
      invalid: discoveryResult.summary?.invalid || 0,
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
      return { 
        success: true, 
        cached: true, 
        module: cachedModule,
        toolsLoaded: cachedModule.getTools ? cachedModule.getTools().length : 0
      };
    }

    try {
      // If no moduleConfig provided, look it up from discovered modules
      let moduleId = null;
      let modulePath = null;
      
      if (!moduleConfig || !moduleConfig.path) {
        // Look up the module from the database
        if (!this.databaseService) {
          throw new Error(`Database service not available - cannot load module ${moduleName}`);
        }
        
        const discoveredModule = await this.databaseService.getCollection('module-registry')
          .findOne({ name: moduleName });
          
        if (!discoveredModule) {
          throw new Error(`Module ${moduleName} not found in database - run discovery first`);
        }
        modulePath = discoveredModule.path;
        moduleId = discoveredModule._id; // Use the database record's ID
      } else {
        modulePath = this._extractModulePath(moduleConfig);
        moduleId = moduleConfig._id; // Use provided ID if available
      }
      
      const moduleInstance = await this.moduleLoader.loadModule(modulePath);
      
      // Get module instance's actual name for consistency
      const actualModuleName = moduleInstance.name || moduleInstance.getName?.() || moduleName;
      
      // Add the module ID to the instance for later use
      moduleInstance._id = moduleId;
      
      // Cache module by its _id as the PRIMARY key
      // Convert ObjectId to string for proper cache key behavior
      if (moduleId) {
        const cacheKey = moduleId.toString(); // Convert ObjectId to string
        console.log(`[ModuleService] Caching with ID '${cacheKey}' (converted from ${typeof moduleId})`);
        await this.moduleCache.set(cacheKey, moduleInstance);
        console.log(`[ModuleService] Cached module with ID '${cacheKey}' (name: ${moduleName})`);
        
        // CACHE ALL MODULE TOOLS when module is cached
        const moduleTools = moduleInstance.getTools();
        if (moduleTools && moduleTools.length > 0 && this.toolService) {
          console.log(`[ModuleService] Caching ${moduleTools.length} tools from ${moduleName}`);
          for (const tool of moduleTools) {
            await this.toolService.cacheToolDirect(tool.name, tool);
          }
          console.log(`[ModuleService] Cached all tools from ${moduleName}`);
        }
        
        // Immediately test the cache to see if it's working
        const testRetrieve = await this.moduleCache.get(cacheKey);
        console.log(`[ModuleService] Immediate cache test for ID '${cacheKey}': ${testRetrieve ? 'FOUND' : 'NOT FOUND'}`);
      } else {
        console.log(`[ModuleService] WARNING: Module ${moduleName} has no _id - cannot cache by ID`);
        // Fallback to caching by name for modules without ID (shouldn't happen)
        await this.moduleCache.set(moduleName, moduleInstance);
      }
      
      // PHASE 2: Save tools to database with proper module ID reference
      const moduleTools = moduleInstance.getTools();
      if (moduleTools && moduleTools.length > 0 && this.databaseService) {
        try {
          // Pass both module name and ID for proper linking
          await this.databaseService.saveTools(moduleTools, moduleName, moduleId);
          console.log(`[ModuleService] Saved ${moduleTools.length} tools from ${moduleName} (ID: ${moduleId}) to database`);
          
          // Update toolsCount in module-registry now that we know the actual count
          if (moduleId) {
            await this.databaseService.updateModuleToolsCount(moduleId, moduleTools.length);
            console.log(`[ModuleService] Updated toolsCount to ${moduleTools.length} for ${moduleName}`);
          }
        } catch (error) {
          console.log(`[ModuleService] Failed to save tools for ${moduleName}:`, error.message);
          // Don't fail module loading if tool saving fails
        }
      } else if (moduleId && this.databaseService) {
        // Even if no tools, update the count to 0
        try {
          await this.databaseService.updateModuleToolsCount(moduleId, 0);
          console.log(`[ModuleService] Updated toolsCount to 0 for ${moduleName}`);
        } catch (error) {
          console.log(`[ModuleService] Failed to update toolsCount for ${moduleName}:`, error.message);
        }
      }
      
      // PHASE 3: Save loaded module to modules collection (separate from module-registry!)
      if (moduleId && this.databaseService) {
        try {
          const moduleRecord = {
            name: moduleName,
            moduleId: moduleId,
            path: moduleConfig.path || moduleFromDb?.path,
            toolsCount: moduleInstance.getTools().length
          };
          await this.databaseService.saveLoadedModule(moduleRecord);
          console.log(`[ModuleService] Saved loaded module ${moduleName} to modules collection`);
        } catch (error) {
          console.log(`[ModuleService] Failed to save loaded module ${moduleName}:`, error.message);
          // Don't fail module loading if this save fails
        }
      }
      
      this.eventBus.emit('module:loaded', {
        name: moduleName,
        moduleId: moduleId,
        toolCount: moduleInstance.getTools().length
      });

      return { 
        success: true, 
        cached: false,
        module: moduleInstance,
        moduleId: moduleId,
        toolCount: moduleInstance.getTools().length,
        toolsLoaded: moduleInstance.getTools().length 
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
      successful: 0,  // Changed from 'loaded' to 'successful' for API consistency
      failed: 0,
      errors: [],
      modules: []
    };

    for (const moduleName of moduleNames) {
      // Use getModule which has proper database lookup logic
      try {
        const moduleInstance = await this.getModule(moduleName);
        results.successful++;  // Changed from 'loaded' to 'successful'
        results.modules.push({
          name: moduleName,
          toolCount: moduleInstance.getTools ? moduleInstance.getTools().length : 0
        });
      } catch (error) {
        results.failed++;
        results.errors.push({
          module: moduleName,
          error: error.message
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
    if (!this.databaseService) {
      return {
        loaded: 0,
        failed: 0,
        errors: ['Database service not available'],
        modules: []
      };
    }

    // Get all discovered modules from database
    const discoveredModules = await this.databaseService.getCollection('module-registry')
      .find({ status: 'discovered' }).toArray();
      
    if (discoveredModules.length === 0) {
      return {
        loaded: 0,
        failed: 0,
        errors: ['No modules found in database - run discovery first'],
        modules: []
      };
    }

    const results = {
      loaded: 0,
      failed: 0,
      errors: [],
      modules: []
    };

    for (const moduleRecord of discoveredModules) {
      // Load the actual module using its path from the database record
      const result = await this.loadModule(moduleRecord.name, moduleRecord);
      
      if (result.success) {
        results.loaded++;
        results.modules.push({
          name: moduleRecord.name,
          toolCount: result.toolCount
        });
      } else {
        results.failed++;
        results.errors.push({
          module: moduleRecord.name,
          error: result.error
        });
      }
    }

    this.eventBus.emit('modules:batch-loaded', results);
    return results;
  }

  /**
   * Get module by ID from module-registry
   * Single responsibility: Module retrieval by database _id
   * This is the PRIMARY method for retrieving modules
   */
  async getModuleById(moduleId) {
    if (!moduleId) {
      throw new Error('Module ID is required');
    }

    // Check cache by ID (convert ObjectId to string)
    const cacheKey = typeof moduleId === 'object' ? moduleId.toString() : moduleId;
    const cachedModule = await this.moduleCache.get(cacheKey);
    if (cachedModule) {
      return cachedModule;
    }

    // Look for module in module-registry by _id
    if (!this.databaseService) {
      throw new Error('Database service not available - cannot load module');
    }

    const moduleFromDb = await this.databaseService.findDiscoveredModuleById(moduleId);
    if (!moduleFromDb) {
      throw new Error(`Module not found with ID: ${moduleId}`);
    }

    console.log(`[ModuleService] Found module in module-registry: name=${moduleFromDb.name}, _id=${moduleFromDb._id}`);
    
    // Load the module from its path
    const result = await this.loadModule(moduleFromDb.name, moduleFromDb);
    if (!result.success) {
      throw new Error(`Failed to load module ${moduleFromDb.name}: ${result.error}`);
    }

    // Cache by ID for future retrievals (convert ObjectId to string)
    const resultCacheKey = typeof moduleId === 'object' ? moduleId.toString() : moduleId;
    await this.moduleCache.set(resultCacheKey, result.module);
    
    return result.module;
  }

  /**
   * Get module by name - loads from database only, NO DISCOVERY, NO FALLBACKS
   */
  async getModule(moduleNameOrId) {
    // Try cache first
    const cachedModule = await this.moduleCache.get(moduleNameOrId);
    if (cachedModule) {
      return cachedModule;
    }

    // Check loaded modules collection in database
    let moduleRecord = await this.databaseService.findModuleByName(moduleNameOrId);
    
    // If not in loaded modules, check module-registry collection  
    if (!moduleRecord) {
      moduleRecord = await this.databaseService.findDiscoveredModule(moduleNameOrId);
    }
    
    // If not found in database, FAIL IMMEDIATELY - no discovery, no fallbacks
    if (!moduleRecord) {
      throw new Error(`Module not found in database: ${moduleNameOrId}`);
    }

    // Load the module class instance from filesystem using database record
    const result = await this.loadModule(moduleRecord.name, moduleRecord);
    if (!result.success) {
      throw new Error(`Failed to load module ${moduleRecord.name}: ${result.error}`);
    }

    // Cache the loaded module instance
    await this.moduleCache.set(moduleNameOrId, result.module);
    
    return result.module;
  }

  /**
   * Clear module from cache and registry
   * Single responsibility: Module cleanup
   */
  async clearModule(moduleName) {
    // Find the module in discovered modules to get its _id
    const discoveredModule = this.discoveredModules.find(m => m.name === moduleName);
    
    // Clear from cache by _id (primary key, convert ObjectId to string)
    if (discoveredModule && discoveredModule._id) {
      const cacheKey = discoveredModule._id.toString();
      await this.moduleCache.remove(cacheKey);
    }
    
    // Also try clearing by name for backwards compatibility
    await this.moduleCache.remove(moduleName);
    
    this.eventBus.emit('module:cleared', { name: moduleName });
    
    return { success: true };
  }

  /**
   * Get module statistics
   * Single responsibility: Module metrics from DATABASE, not memory cache
   */
   async getModuleStatistics() {
    try {
      // CRITICAL: Get counts from CORRECT collections
      // 1. module-registry collection = discovered modules
      const discoveredModules = await this.databaseService.findDiscoveredModules({});
      const discoveredCount = discoveredModules.length;
      
      // Calculate total tools discovered from module-registry
      let totalToolsDiscovered = 0;
      for (const module of discoveredModules) {
        totalToolsDiscovered += module.toolsCount || 0;
      }
      
      // 2. modules collection = loaded/active modules (NOT module-registry!)
      const loadedModulesCollection = await this.databaseService.getCollection('modules');
      const loadedModules = await loadedModulesCollection.find({}).toArray();
      const loadedCount = loadedModules.length;
      
      return {
        // From module-registry collection (discovered modules)
        totalDiscovered: discoveredCount,
        totalToolsDiscovered: totalToolsDiscovered,
        discoveredModules: discoveredModules.map(m => m.name),
        
        // From modules collection (loaded/active modules)
        totalLoaded: loadedCount, // Count from modules collection, NOT module-registry
        loadedModules: loadedModules.map(m => m.name) // Names from modules collection
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