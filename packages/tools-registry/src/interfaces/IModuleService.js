/**
 * IModuleService - Interface for Module Management
 * 
 * Clean Architecture: Application Layer Interface
 * Defines contract for module operations without implementation details
 */

export class IModuleService {
  /**
   * Discover modules from filesystem paths
   * @param {string[]} searchPaths - Paths to search for modules
   * @returns {Promise<Object>} Discovery result with module count and list
   */
  async discoverModules(searchPaths) {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * Load a single module by name
   * @param {string} moduleName - Name of module to load
   * @param {Object|string} moduleConfig - Module configuration or path
   * @returns {Promise<Object>} Load result with success status and module info
   */
  async loadModule(moduleName, moduleConfig) {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * Load multiple modules
   * @param {string[]} moduleNames - Names of modules to load
   * @param {Object} options - Loading options
   * @returns {Promise<Object>} Batch load result with counts and errors
   */
  async loadMultipleModules(moduleNames, options = {}) {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * Load all registered modules
   * @param {Object} options - Loading options
   * @returns {Promise<Object>} Load all result
   */
  async loadAllModules(options = {}) {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * Get module by name
   * @param {string} moduleName - Name of module
   * @returns {Promise<Object>} Module instance
   */
  async getModule(moduleName) {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * Clear module from cache and registry
   * @param {string} moduleName - Name of module to clear
   * @returns {Promise<Object>} Clear result
   */
  async clearModule(moduleName) {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * Get module statistics
   * @returns {Promise<Object>} Module statistics
   */
  async getModuleStatistics() {
    throw new Error('Method must be implemented by concrete class');
  }
}