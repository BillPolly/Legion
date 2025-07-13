import ResourceManager from '../resources/ResourceManager.js';
import { JsonModuleLoader } from './JsonModuleLoader.js';
import { GenericModule } from './GenericModule.js';
import path from 'path';
import fs from 'fs/promises';

/**
 * Factory for creating modules with dependency injection
 */
class ModuleFactory {
  /**
   * @param {ResourceManager} resourceManager - The resource manager to use for dependency resolution
   */
  constructor(resourceManager) {
    if (!resourceManager) {
      throw new Error('ResourceManager is required');
    }
    
    if (!(resourceManager instanceof ResourceManager)) {
      throw new Error('Invalid ResourceManager instance');
    }
    
    this.resourceManager = resourceManager;
    this.jsonLoader = new JsonModuleLoader();
  }

  /**
   * Create a module instance with resolved dependencies
   * @param {Class} ModuleClass - The module class to instantiate
   * @returns {Module} The instantiated module
   */
  createModule(ModuleClass) {
    // Get declared dependencies
    const requiredResources = ModuleClass.dependencies || [];
    
    // Resolve dependencies from ResourceManager
    const resolvedDependencies = {};
    requiredResources.forEach(resourceName => {
      resolvedDependencies[resourceName] = this.resourceManager.get(resourceName);
    });
    
    // Construct module with resolved dependencies
    return new ModuleClass(resolvedDependencies);
  }

  /**
   * Create multiple modules at once
   * @param {Array<Class>} moduleClasses - Array of module classes to instantiate
   * @returns {Array<Module>} Array of instantiated modules
   */
  createAllModules(moduleClasses) {
    return moduleClasses.map(ModuleClass => this.createModule(ModuleClass));
  }

  /**
   * Create a module from a module.json file
   * @param {string} jsonPath - Path to the module.json file
   * @returns {Promise<GenericModule>} The instantiated module
   */
  async createJsonModule(jsonPath) {
    try {
      // Read and parse the module configuration
      const config = await this.jsonLoader.readModuleJson(jsonPath);
      
      // Validate the configuration
      const validation = await this.jsonLoader.validateConfiguration(config);
      if (!validation.valid) {
        throw new Error(`Invalid module configuration: ${validation.errors.join(', ')}`);
      }
      
      // Add metadata about file location
      config._metadata = {
        path: jsonPath,
        directory: path.dirname(jsonPath)
      };
      
      // Resolve dependencies from ResourceManager
      const resolvedDependencies = {};
      if (config.dependencies && Array.isArray(config.dependencies)) {
        config.dependencies.forEach(dep => {
          // Handle both string and object dependency formats
          const depName = typeof dep === 'string' ? dep : dep.name;
          resolvedDependencies[depName] = this.resourceManager.get(depName);
        });
      }
      
      // Create and return the GenericModule
      return new GenericModule(config, resolvedDependencies);
      
    } catch (error) {
      // Enhance error message
      if (error.code === 'ENOENT') {
        throw new Error(`Module file not found: ${jsonPath}`);
      } else if (error.message.includes('JSON')) {
        throw new Error(`Invalid JSON in module file ${jsonPath}: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Automatically create a module from a directory
   * Tries Module.js first, then falls back to module.json
   * @param {string} moduleDir - Directory containing the module
   * @returns {Promise<Module>} The instantiated module
   */
  async createModuleAuto(moduleDir) {
    const moduleJsPath = path.join(moduleDir, 'Module.js');
    const moduleJsonPath = path.join(moduleDir, 'module.json');
    
    // Try Module.js first
    try {
      await fs.access(moduleJsPath);
      // Dynamic import of the module
      const { default: ModuleClass } = await import(moduleJsPath);
      return this.createModule(ModuleClass);
    } catch (error) {
      // If Module.js doesn't exist, try module.json
      if (error.code === 'ENOENT' || error.code === 'MODULE_NOT_FOUND') {
        try {
          return await this.createJsonModule(moduleJsonPath);
        } catch (jsonError) {
          // Neither exists
          throw new Error(
            `No module found in ${moduleDir}. Expected Module.js or module.json`
          );
        }
      }
      // Re-throw other errors
      throw error;
    }
  }
}

export { ModuleFactory };