/**
 * ModuleDefinition base class
 * Defines the contract for creating module types
 */

export class ModuleDefinition {
  constructor() {
    if (new.target === ModuleDefinition) {
      throw new Error('ModuleDefinition is abstract and cannot be instantiated directly');
    }
  }

  /**
   * Create a configured Module
   * @param {Object} config - Configuration (API keys, endpoints, etc.)
   * @returns {Promise<Module>} Configured module instance
   */
  static async create(config) {
    throw new Error('Must be implemented by subclass');
  }
  
  /**
   * Get metadata about all tools in this module
   * @returns {Object} Module and tool metadata
   */
  static getMetadata() {
    throw new Error('Must be implemented by subclass');
  }
}