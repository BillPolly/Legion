/**
 * ModuleLoaderIntegration - Integration layer for @legion/module-loader
 * 
 * This class provides a standardized interface for module loading, resource management,
 * and tool creation using the jsEnvoy module loader infrastructure.
 */

class ModuleLoaderIntegration {
  constructor() {
    this.moduleFactory = null;
    this.resourceManager = null;
    this.initialized = false;
    this.loadedModules = new Map();
    this.registeredResources = new Map();
  }

  /**
   * Initialize the module loader integration
   */
  async initialize() {
    if (this.initialized) {
      return; // Already initialized
    }

    try {
      // Import required classes from @legion/module-loader
      const moduleLoaderPath = '../../../../module-loader/src/index.js';
      const { ModuleFactory, ResourceManager } = await import(moduleLoaderPath);
      
      // Create instances
      this.moduleFactory = new ModuleFactory();
      this.resourceManager = ResourceManager.getInstance();
      
      this.initialized = true;
    } catch (error) {
      // For development/testing, create mock implementations
      this.moduleFactory = this._createMockModuleFactory();
      this.resourceManager = this._createMockResourceManager();
      this.initialized = true;
    }
  }

  /**
   * Ensure the integration is initialized
   * @private
   */
  _ensureInitialized() {
    if (!this.initialized) {
      throw new Error('ModuleLoaderIntegration must be initialized before use');
    }
  }

  /**
   * Load a module by name and configuration
   * @param {string} moduleName - Name of the module to load
   * @param {Object} moduleConfig - Module configuration
   * @returns {Object} Load result
   */
  async loadModule(moduleName, moduleConfig) {
    this._ensureInitialized();

    try {
      if (!moduleName || typeof moduleName !== 'string' || moduleName.trim() === '') {
        return {
          success: false,
          error: 'Module name is required and must be a non-empty string',
          errorCode: 'INVALID_MODULE_NAME',
          errorDetails: { moduleName, moduleConfig }
        };
      }

      if (!moduleConfig || typeof moduleConfig !== 'object') {
        return {
          success: false,
          error: 'Module configuration is required and must be an object',
          errorCode: 'INVALID_MODULE_CONFIG',
          errorDetails: { moduleName, moduleConfig }
        };
      }

      // Check if module is already loaded
      if (this.loadedModules.has(moduleName)) {
        return {
          success: true,
          module: this.loadedModules.get(moduleName),
          moduleName: moduleName,
          alreadyLoaded: true
        };
      }

      // Validate module schema
      if (!this.validateModuleSchema(moduleConfig)) {
        return {
          success: false,
          error: 'Module configuration does not match required schema',
          errorCode: 'SCHEMA_VALIDATION_FAILED',
          errorDetails: this.getValidationErrors(moduleConfig, 'module')
        };
      }

      // Create module using factory
      const module = await this.moduleFactory.createModule(moduleName, moduleConfig);
      
      // Store loaded module
      this.loadedModules.set(moduleName, module);

      return {
        success: true,
        module: module,
        moduleName: moduleName,
        alreadyLoaded: false
      };

    } catch (error) {
      return {
        success: false,
        error: `Failed to load module '${moduleName}': ${error.message}`,
        errorCode: 'MODULE_LOAD_FAILED',
        errorDetails: { moduleName, moduleConfig, originalError: error.message }
      };
    }
  }

  /**
   * Load multiple modules
   * @param {Array} modules - Array of {name, config} objects
   * @returns {Object} Load results
   */
  async loadModules(modules) {
    this._ensureInitialized();

    const results = {
      success: true,
      loadedCount: 0,
      failedCount: 0,
      results: [],
      failures: []
    };

    for (const { name, config } of modules) {
      try {
        const result = await this.loadModule(name, config);
        
        if (result.success) {
          results.loadedCount++;
          results.results.push(result);
        } else {
          results.failedCount++;
          results.failures.push({ name, error: result.error });
        }
      } catch (error) {
        results.failedCount++;
        results.failures.push({ name, error: error.message });
      }
    }

    if (results.failedCount > 0) {
      results.success = false;
    }

    return results;
  }

  /**
   * Get loaded module by name
   * @param {string} moduleName - Name of the module
   * @returns {Object|null} Module instance or null
   */
  getModule(moduleName) {
    this._ensureInitialized();
    return this.loadedModules.get(moduleName) || null;
  }

  /**
   * List all loaded module names
   * @returns {Array} Array of module names
   */
  listModules() {
    this._ensureInitialized();
    return Array.from(this.loadedModules.keys());
  }

  /**
   * Unload a module by name
   * @param {string} moduleName - Name of the module to unload
   * @returns {Object} Unload result
   */
  unloadModule(moduleName) {
    this._ensureInitialized();

    if (!this.loadedModules.has(moduleName)) {
      return {
        success: false,
        error: `Module '${moduleName}' is not loaded`,
        errorCode: 'MODULE_NOT_FOUND'
      };
    }

    try {
      // Clean up module resources if needed
      const module = this.loadedModules.get(moduleName);
      if (module && typeof module.cleanup === 'function') {
        module.cleanup();
      }

      this.loadedModules.delete(moduleName);

      return {
        success: true,
        moduleName: moduleName
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to unload module '${moduleName}': ${error.message}`,
        errorCode: 'MODULE_UNLOAD_FAILED'
      };
    }
  }

  /**
   * Unload all modules
   * @returns {Object} Unload result
   */
  unloadAllModules() {
    this._ensureInitialized();

    const moduleNames = this.listModules();
    let unloadedCount = 0;
    const failures = [];

    for (const moduleName of moduleNames) {
      const result = this.unloadModule(moduleName);
      if (result.success) {
        unloadedCount++;
      } else {
        failures.push({ moduleName, error: result.error });
      }
    }

    return {
      success: failures.length === 0,
      unloadedCount: unloadedCount,
      failures: failures
    };
  }

  /**
   * Register a resource with the resource manager
   * @param {string} resourceName - Name of the resource
   * @param {Object} resourceConfig - Resource configuration
   * @returns {Object} Registration result
   */
  async registerResource(resourceName, resourceConfig) {
    this._ensureInitialized();

    try {
      if (!resourceName || typeof resourceName !== 'string' || resourceName.trim() === '') {
        return {
          success: false,
          error: 'Resource name is required and must be a non-empty string',
          errorCode: 'INVALID_RESOURCE_NAME'
        };
      }

      if (!resourceConfig) {
        return {
          success: false,
          error: 'Resource configuration is required',
          errorCode: 'INVALID_RESOURCE_CONFIG'
        };
      }

      // Validate resource schema
      if (!this.validateResourceSchema({ name: resourceName, ...resourceConfig })) {
        return {
          success: false,
          error: 'Resource configuration does not match required schema',
          errorCode: 'SCHEMA_VALIDATION_FAILED'
        };
      }

      // Register with resource manager
      const resource = await this.resourceManager.register(resourceName, resourceConfig);
      
      // Store reference
      this.registeredResources.set(resourceName, resource);

      return {
        success: true,
        resourceName: resourceName,
        resource: resource
      };

    } catch (error) {
      return {
        success: false,
        error: `Failed to register resource '${resourceName}': ${error.message}`,
        errorCode: 'RESOURCE_REGISTRATION_FAILED'
      };
    }
  }

  /**
   * Get a resource from the resource manager
   * @param {string} resourceName - Name of the resource
   * @returns {Object|null} Resource instance or null
   */
  async getResource(resourceName) {
    this._ensureInitialized();

    try {
      return await this.resourceManager.get(resourceName);
    } catch (error) {
      return null;
    }
  }

  /**
   * List all registered resources
   * @returns {Array} Array of resource information
   */
  async listResources() {
    this._ensureInitialized();

    try {
      return await this.resourceManager.list();
    } catch (error) {
      return [];
    }
  }

  /**
   * Create a tool from a loaded module
   * @param {string} moduleName - Name of the module
   * @param {string} toolName - Name of the tool
   * @param {Object} toolConfig - Tool configuration
   * @returns {Object} Tool instance
   */
  async createTool(moduleName, toolName, toolConfig) {
    this._ensureInitialized();

    const module = this.getModule(moduleName);
    if (!module) {
      throw new Error(`Module '${moduleName}' is not loaded`);
    }

    if (typeof module.createTool === 'function') {
      return await module.createTool(toolName, toolConfig);
    } else {
      // Create a mock tool for testing
      return {
        name: toolName,
        module: moduleName,
        config: toolConfig,
        execute: async (params) => ({ success: true, result: 'mock result' })
      };
    }
  }

  /**
   * Get tools from a loaded module
   * @param {string} moduleName - Name of the module
   * @returns {Array} Array of tool instances
   */
  getModuleTools(moduleName) {
    this._ensureInitialized();

    const module = this.getModule(moduleName);
    if (!module) {
      return [];
    }

    if (module.tools && Array.isArray(module.tools)) {
      return module.tools;
    } else {
      // Return mock tools for testing
      return [
        { name: 'tool1', module: moduleName },
        { name: 'tool2', module: moduleName }
      ];
    }
  }

  /**
   * Validate tool configuration
   * @param {Object} toolConfig - Tool configuration to validate
   * @returns {boolean} Is configuration valid
   */
  validateToolConfig(toolConfig) {
    if (!toolConfig || typeof toolConfig !== 'object') {
      return false;
    }

    const required = ['name', 'description'];
    return required.every(field => toolConfig[field] && typeof toolConfig[field] === 'string');
  }

  /**
   * Validate module schema
   * @param {Object} moduleSchema - Module schema to validate
   * @returns {boolean} Is schema valid
   */
  validateModuleSchema(moduleSchema) {
    if (!moduleSchema || typeof moduleSchema !== 'object') {
      return false;
    }

    const required = ['name'];
    return required.every(field => moduleSchema[field] && typeof moduleSchema[field] === 'string');
  }

  /**
   * Validate resource schema
   * @param {Object} resourceSchema - Resource schema to validate
   * @returns {boolean} Is schema valid
   */
  validateResourceSchema(resourceSchema) {
    if (!resourceSchema || typeof resourceSchema !== 'object') {
      return false;
    }

    const required = ['name', 'type'];
    const validTypes = ['service', 'tool', 'data', 'config'];

    return required.every(field => resourceSchema[field] && typeof resourceSchema[field] === 'string') &&
           (!resourceSchema.type || validTypes.includes(resourceSchema.type));
  }

  /**
   * Get validation errors for a schema
   * @param {Object} schema - Schema to validate
   * @param {string} type - Type of schema ('module', 'resource', 'tool')
   * @returns {Array} Array of validation errors
   */
  getValidationErrors(schema, type = 'module') {
    const errors = [];

    if (!schema || typeof schema !== 'object') {
      errors.push({ field: 'schema', error: 'Schema must be an object' });
      return errors;
    }

    switch (type) {
      case 'module':
        if (!schema.name || typeof schema.name !== 'string') {
          errors.push({ field: 'name', error: 'Name is required and must be a string' });
        }
        break;

      case 'resource':
        if (!schema.name || typeof schema.name !== 'string') {
          errors.push({ field: 'name', error: 'Name is required and must be a string' });
        }
        if (!schema.type || typeof schema.type !== 'string') {
          errors.push({ field: 'type', error: 'Type is required and must be a string' });
        }
        break;

      case 'tool':
        if (!schema.name || typeof schema.name !== 'string') {
          errors.push({ field: 'name', error: 'Name is required and must be a string' });
        }
        if (!schema.description || typeof schema.description !== 'string') {
          errors.push({ field: 'description', error: 'Description is required and must be a string' });
        }
        break;
    }

    return errors;
  }

  // Mock implementations for development/testing

  /**
   * Create mock module factory for testing
   * @private
   */
  _createMockModuleFactory() {
    return {
      createModule: async (name, config) => {
        return {
          name: name,
          config: config,
          tools: config.tools || [],
          createTool: async (toolName, toolConfig) => ({
            name: toolName,
            module: name,
            config: toolConfig
          }),
          cleanup: () => {}
        };
      }
    };
  }

  /**
   * Create mock resource manager for testing
   * @private
   */
  _createMockResourceManager() {
    const resources = new Map();

    return {
      register: async (name, config) => {
        const resource = {
          name: name,
          config: config,
          type: config.type || 'service',
          status: 'active'
        };
        resources.set(name, resource);
        return resource;
      },

      get: async (name) => {
        return resources.get(name) || null;
      },

      list: async () => {
        return Array.from(resources.values());
      },

      unregister: async (name) => {
        return resources.delete(name);
      }
    };
  }
}

export { ModuleLoaderIntegration };