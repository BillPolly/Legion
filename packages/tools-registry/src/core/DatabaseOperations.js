/**
 * DatabaseOperations - Manages loading and clearing of modules/tools
 * 
 * Provides controlled operations for loading modules from filesystem,
 * clearing them from database, and managing the module/tool lifecycle.
 * 
 * No mocks, no fallbacks - real implementation only.
 */

import path from 'path';
import fs from 'fs';
import { ModuleLoader } from './ModuleLoader.js';
import { ModuleDiscovery } from './ModuleDiscovery.js';
import { DatabaseStorage } from './DatabaseStorage.js';
import { 
  DatabaseOperationError,
  ModuleNotFoundError,
  ModuleLoadError
} from '../errors/index.js';

export class DatabaseOperations {
  constructor(options = {}) {
    this.options = {
      verbose: false,
      ...options
    };
    
    this.databaseStorage = options.databaseStorage || new DatabaseStorage(options);
    this.moduleLoader = options.moduleLoader || new ModuleLoader(options);
    this.moduleDiscovery = options.moduleDiscovery || new ModuleDiscovery({ 
      databaseStorage: this.databaseStorage,
      ...options 
    });
    
    // Pass resourceManager to components that need it
    if (options.resourceManager) {
      this.resourceManager = options.resourceManager;
      this.moduleLoader.resourceManager = options.resourceManager;
    }
    
    this.monorepoRoot = this.findMonorepoRoot();
  }
  
  /**
   * Load a single module and its tools
   * @param {string} modulePath - Path to module file
   * @returns {Object} Result with module, tools, and success status
   */
  async loadModule(modulePath) {
    try {
      // Load the module instance
      const moduleInstance = await this.moduleLoader.loadModule(modulePath);
      
      // Get module metadata
      const metadata = await this.moduleLoader.getModuleMetadata(moduleInstance);
      
      // Get module info for database storage
      const moduleInfo = this.moduleDiscovery.getModuleInfo(
        path.isAbsolute(modulePath) ? modulePath : path.resolve(this.monorepoRoot, modulePath)
      );
      
      // Combine metadata and info
      const moduleData = {
        ...moduleInfo,
        ...metadata,
        loaded: true,
        loadedAt: new Date().toISOString()
      };
      
      // Save loaded module to modules collection
      await this.databaseStorage.saveLoadedModule(moduleData);
      
      // Get and save tools
      const tools = await this.moduleLoader.getTools(moduleInstance);
      let savedToolsCount = 0;
      
      if (tools && tools.length > 0) {
        // Save tools to database, removing execute function for storage
        const toolsForStorage = tools.map(tool => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema || null,
          outputSchema: tool.outputSchema || null,
          category: tool.category || null,
          tags: tool.tags || null,
          examples: tool.examples || null,
          // Don't save the execute function to database
        }));
        
        savedToolsCount = await this.databaseStorage.saveTools(toolsForStorage, metadata.name);
      }
      
      return {
        module: moduleData,
        tools: tools,
        success: true,
        toolsCount: savedToolsCount
      };
      
    } catch (error) {
      if (this.options.verbose) {
        console.error(`Failed to load module ${modulePath}: ${error.message}`);
      }
      
      return {
        success: false,
        error: error.message,
        module: null,
        tools: []
      };
    }
  }
  
  /**
   * Load a module by name from discovered modules
   * @param {string} moduleName - Name of module to load
   * @returns {Object} Result with module and tools
   */
  async loadModuleByName(moduleName) {
    try {
      // First check if already loaded in modules collection
      let moduleDoc = await this.databaseStorage.findModule(moduleName);
      
      // If not loaded, check module-registry (discovered modules)
      if (!moduleDoc) {
        moduleDoc = await this.databaseStorage.findDiscoveredModule(moduleName);
      }
      
      if (!moduleDoc) {
        return {
          success: false,
          error: `Module not found: ${moduleName}`,
          module: null,
          tools: []
        };
      }
      
      // Load module from its path
      return await this.loadModule(moduleDoc.path);
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        module: null,
        tools: []
      };
    }
  }
  
  /**
   * Load all discovered modules
   * @returns {Object} Result with loaded and failed counts
   */
  async loadAllModules() {
    // Load from module-registry (discovered modules)
    const modules = await this.databaseStorage.findDiscoveredModules();
    const loaded = [];
    const failed = [];
    
    for (const moduleDoc of modules) {
      const result = await this.loadModule(moduleDoc.path);
      
      if (result.success) {
        loaded.push({
          name: result.module.name,
          toolsCount: result.toolsCount
        });
      } else {
        failed.push({
          name: moduleDoc.name,
          error: result.error
        });
      }
    }
    
    return {
      loaded: loaded,
      failed: failed,
      total: modules.length
    };
  }
  
  /**
   * Clear a specific module and its tools
   * @param {string} moduleName - Name of module to clear
   * @returns {Object} Result with deletion counts
   */
  async clearModule(moduleName) {
    try {
      const modulesCollection = this.databaseStorage.getCollection('modules');
      const toolsCollection = this.databaseStorage.getCollection('tools');
      
      // Delete module
      const moduleResult = await modulesCollection.deleteMany({ name: moduleName });
      
      // Delete associated tools
      const toolsResult = await toolsCollection.deleteMany({ moduleName: moduleName });
      
      return {
        modulesDeleted: moduleResult.deletedCount,
        toolsDeleted: toolsResult.deletedCount
      };
      
    } catch (error) {
      throw new DatabaseOperationError(
        `Failed to clear module ${moduleName}`,
        'clear',
        { moduleName },
        error
      );
    }
  }
  
  /**
   * Clear all modules and tools
   * @returns {Object} Result with deletion counts
   */
  async clearAllModules() {
    try {
      const modulesCollection = this.databaseStorage.getCollection('modules');
      const toolsCollection = this.databaseStorage.getCollection('tools');
      
      // Delete all modules
      const moduleResult = await modulesCollection.deleteMany({});
      
      // Delete all tools
      const toolsResult = await toolsCollection.deleteMany({});
      
      return {
        modulesDeleted: moduleResult.deletedCount,
        toolsDeleted: toolsResult.deletedCount
      };
      
    } catch (error) {
      throw new DatabaseOperationError(
        'Failed to clear all modules',
        'clearAll',
        {},
        error
      );
    }
  }
  
  /**
   * Discover and load modules from the monorepo
   * @param {string} directory - Optional directory to search (defaults to monorepo root)
   * @returns {Object} Result with discovered, loaded, and failed counts
   */
  async discoverAndLoad(directory = null) {
    try {
      // Discover modules
      const discoveredModules = directory 
        ? await this.moduleDiscovery.discoverModules(directory)
        : await this.moduleDiscovery.discoverInMonorepo();
      
      // Don't save discovered modules separately - loadModule will handle saving
      
      // Load each module
      const loaded = [];
      const failed = [];
      
      for (const module of discoveredModules) {
        const result = await this.loadModule(module.path);
        
        if (result.success) {
          loaded.push({
            name: result.module.name,
            toolsCount: result.toolsCount
          });
        } else {
          failed.push({
            name: module.name,
            error: result.error
          });
        }
      }
      
      return {
        discovered: discoveredModules.length,
        loaded: loaded,
        failed: failed
      };
      
    } catch (error) {
      throw new DatabaseOperationError(
        'Failed to discover and load modules',
        'discoverAndLoad',
        { directory },
        error
      );
    }
  }
  
  /**
   * Get database statistics
   * @returns {Object} Statistics for modules and tools
   */
  async getStatistics() {
    try {
      const modulesCollection = this.databaseStorage.getCollection('modules');
      const registryCollection = this.databaseStorage.getCollection('module-registry');
      const toolsCollection = this.databaseStorage.getCollection('tools');
      
      const moduleCount = await modulesCollection.countDocuments();
      const registryCount = await registryCollection.countDocuments();
      const toolCount = await toolsCollection.countDocuments();
      
      // Get loaded vs discovered counts
      const loadedModules = await modulesCollection.countDocuments({ loaded: true });
      
      return {
        modules: {
          count: moduleCount,
          loaded: loadedModules,
          discovered: registryCount  // From module-registry
        },
        tools: {
          count: toolCount
        }
      };
      
    } catch (error) {
      throw new DatabaseOperationError(
        'Failed to get statistics',
        'getStatistics',
        {},
        error
      );
    }
  }
  
  /**
   * Load all modules from a specific package
   * @param {string} packageName - Package name
   * @returns {Object} Result with loaded and failed modules
   */
  async loadModulesFromPackage(packageName) {
    try {
      // Look in module-registry (discovered modules) first
      const registryCollection = this.databaseStorage.getCollection('module-registry');
      const modules = await registryCollection.find({ packageName }).toArray();
      
      const loaded = [];
      const failed = [];
      
      for (const moduleDoc of modules) {
        const result = await this.loadModule(moduleDoc.path);
        
        if (result.success) {
          loaded.push({
            name: result.module.name,
            toolsCount: result.toolsCount
          });
        } else {
          failed.push({
            name: moduleDoc.name,
            error: result.error
          });
        }
      }
      
      return {
        loaded: loaded,
        failed: failed,
        total: modules.length
      };
      
    } catch (error) {
      throw new DatabaseOperationError(
        `Failed to load modules from package ${packageName}`,
        'loadFromPackage',
        { packageName },
        error
      );
    }
  }
  
  /**
   * Clear all modules from a specific package
   * @param {string} packageName - Package name
   * @returns {Object} Result with deletion counts
   */
  async clearModulesFromPackage(packageName) {
    try {
      const modulesCollection = this.databaseStorage.getCollection('modules');
      const toolsCollection = this.databaseStorage.getCollection('tools');
      
      // Find modules in package
      const modules = await modulesCollection.find({ packageName }).toArray();
      const moduleNames = modules.map(m => m.name);
      
      // Delete modules
      const moduleResult = await modulesCollection.deleteMany({ packageName });
      
      // Delete associated tools
      let toolsDeleted = 0;
      for (const moduleName of moduleNames) {
        const result = await toolsCollection.deleteMany({ moduleName });
        toolsDeleted += result.deletedCount;
      }
      
      return {
        modulesDeleted: moduleResult.deletedCount,
        toolsDeleted: toolsDeleted
      };
      
    } catch (error) {
      throw new DatabaseOperationError(
        `Failed to clear modules from package ${packageName}`,
        'clearFromPackage',
        { packageName },
        error
      );
    }
  }
  
  /**
   * Refresh a module by reloading it
   * @param {string} moduleName - Name of module to refresh
   * @returns {Object} Result with module and tools
   */
  async refreshModule(moduleName) {
    try {
      // First check if already loaded in modules collection
      let moduleDoc = await this.databaseStorage.findModule(moduleName);
      
      // If not loaded, check module-registry (discovered modules)
      if (!moduleDoc) {
        moduleDoc = await this.databaseStorage.findDiscoveredModule(moduleName);
      }
      
      if (!moduleDoc) {
        return {
          success: false,
          error: `Module not found: ${moduleName}`,
          module: null,
          tools: []
        };
      }
      
      // Clear old tools first
      const toolsCollection = this.databaseStorage.getCollection('tools');
      await toolsCollection.deleteMany({ moduleName });
      
      // Clear module cache if it exists
      if (this.moduleLoader.moduleCache.has(moduleDoc.path)) {
        this.moduleLoader.moduleCache.delete(moduleDoc.path);
      }
      
      // Reload module
      return await this.loadModule(moduleDoc.path);
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        module: null,
        tools: []
      };
    }
  }
  
  /**
   * Find the monorepo root directory
   */
  findMonorepoRoot() {
    let currentDir = process.cwd();
    
    while (currentDir !== path.dirname(currentDir)) {
      // Check for package.json with workspaces
      const packageJsonPath = path.join(currentDir, 'package.json');
      
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        if (packageJson.name === '@legion/monorepo' || 
            (packageJson.workspaces && packageJson.workspaces.includes('packages/*'))) {
          return currentDir;
        }
      } catch (error) {
        // Continue searching up
      }
      
      currentDir = path.dirname(currentDir);
    }
    
    // Default to process.cwd() if not found
    return process.cwd();
  }
}