import ResourceManager from '../resources/ResourceManager.js';

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
}

export { ModuleFactory };