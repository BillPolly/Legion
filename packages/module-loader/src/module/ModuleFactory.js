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
    this.eventListeners = new Map(); // Store event listeners for modules
  }

  /**
   * Create a module instance with resolved dependencies
   * @param {Class} ModuleClass - The module class to instantiate
   * @returns {Promise<Module>} The instantiated module
   */
  async createModule(ModuleClass) {
    // Check if module uses Async Resource Manager Pattern (has static create method)
    if (typeof ModuleClass.create === 'function') {
      const module = await ModuleClass.create(this.resourceManager);
      this._attachEventListeners(module);
      return module;
    }
    
    // Fallback to traditional constructor pattern
    // Get declared dependencies
    const requiredResources = ModuleClass.dependencies || [];
    
    // Resolve dependencies from ResourceManager
    const resolvedDependencies = {};
    requiredResources.forEach(resourceName => {
      // Try to get as env variable first (e.g., env.GITHUB_PAT), then as direct resource
      try {
        resolvedDependencies[resourceName] = this.resourceManager.get(`env.${resourceName}`);
      } catch (error) {
        // Fallback to direct resource name if env.RESOURCE_NAME doesn't exist
        resolvedDependencies[resourceName] = this.resourceManager.get(resourceName);
      }
    });
    
    // Construct module with resolved dependencies
    const module = new ModuleClass(resolvedDependencies);
    
    // Attach any registered event listeners
    this._attachEventListeners(module);
    
    return module;
  }

  /**
   * Create multiple modules at once
   * @param {Array<Class>} moduleClasses - Array of module classes to instantiate
   * @returns {Promise<Array<Module>>} Array of instantiated modules
   */
  async createAllModules(moduleClasses) {
    const modulePromises = moduleClasses.map(ModuleClass => this.createModule(ModuleClass));
    return await Promise.all(modulePromises);
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
      if (config.dependencies) {
        // Handle object format (new style)
        if (typeof config.dependencies === 'object' && !Array.isArray(config.dependencies)) {
          Object.keys(config.dependencies).forEach(depName => {
            // Get environment variable - no fallback, must exist as env.DEPNAME
            const value = this.resourceManager.get(`env.${depName}`);
            resolvedDependencies[depName] = value;
          });
        }
        // Handle array format (old style) 
        else if (Array.isArray(config.dependencies)) {
          config.dependencies.forEach(dep => {
            const depName = typeof dep === 'string' ? dep : dep.name;
            // Get environment variable - no fallback, must exist as env.DEPNAME
            const value = this.resourceManager.get(`env.${depName}`);
            resolvedDependencies[depName] = value;
          });
        }
      }
      
      // Create and return the GenericModule
      const module = new GenericModule(config, resolvedDependencies);
      
      // Attach any registered event listeners
      this._attachEventListeners(module);
      
      return module;
      
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

  /**
   * Register an event listener for all modules created by this factory
   * @param {string} eventType - Event type to listen for ('progress', 'warning', 'error', 'info', 'event')
   * @param {Function} listener - Event listener function
   */
  addEventListener(eventType, listener) {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType).push(listener);
  }

  /**
   * Remove an event listener
   * @param {string} eventType - Event type
   * @param {Function} listener - Event listener function to remove
   */
  removeEventListener(eventType, listener) {
    if (this.eventListeners.has(eventType)) {
      const listeners = this.eventListeners.get(eventType);
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Remove all event listeners for a specific event type
   * @param {string} eventType - Event type to clear
   */
  removeAllEventListeners(eventType) {
    if (eventType) {
      this.eventListeners.delete(eventType);
    } else {
      this.eventListeners.clear();
    }
  }

  /**
   * Attach registered event listeners to a module instance
   * @private
   * @param {Module} module - Module instance to attach listeners to
   */
  _attachEventListeners(module) {
    // Check if module extends EventEmitter (has 'on' method)
    if (typeof module.on === 'function') {
      for (const [eventType, listeners] of this.eventListeners) {
        listeners.forEach(listener => {
          module.on(eventType, listener);
        });
      }
    }
  }
}

export { ModuleFactory };