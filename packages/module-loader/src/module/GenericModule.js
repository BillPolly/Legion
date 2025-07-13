import { Module } from './Module.js';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

/**
 * GenericModule - A module implementation that can wrap any JavaScript library
 */
export class GenericModule extends Module {
  /**
   * @param {Object} config - Module configuration from module.json
   * @param {Object} dependencies - Resolved dependencies
   */
  constructor(config, dependencies = {}) {
    super();
    
    this.config = config;
    this.dependencies = dependencies;
    this.name = config.name;
    this.library = null;
    this.instance = null;
    this.tools = [];
    this._initialized = false;
    
    // Initialize the module asynchronously
    this._initPromise = this.initialize();
  }
  
  /**
   * Initialize the module by loading and setting up the library
   */
  async initialize() {
    if (this._initialized) {
      return;
    }
    
    this.library = this.loadLibrary();
    this.instance = this.initializeLibrary(this.dependencies);
    this.tools = await this.createTools();
    this._initialized = true;
  }
  
  /**
   * Load the library package
   * @returns {*} The loaded library
   */
  loadLibrary() {
    const { package: packageName } = this.config;
    
    try {
      // In test environment, always try CommonJS first to respect Jest mocks
      if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
        if (packageName.startsWith('.') || packageName.startsWith('/')) {
          // Local module - resolve relative to module.json location
          const modulePath = path.resolve(
            this.config._metadata?.directory || __dirname,
            packageName
          );
          return require(modulePath);
        } else {
          // npm package - use require to respect Jest mocks
          return require(packageName);
        }
      }
      
      // Production: Try to load as CommonJS first
      if (packageName.startsWith('.') || packageName.startsWith('/')) {
        // Local module - resolve relative to module.json location
        const modulePath = path.resolve(
          this.config._metadata?.directory || __dirname,
          packageName
        );
        return require(modulePath);
      } else {
        // npm package
        return require(packageName);
      }
    } catch (error) {
      // If CommonJS fails, try ES modules
      if (error.code === 'ERR_REQUIRE_ESM' || error.message.includes('ES Module')) {
        return this.loadESModule(packageName);
      }
      
      // Re-throw with more context
      const enhancedError = new Error(
        `Failed to load library '${packageName}' for module '${this.name}': ${error.message}`
      );
      enhancedError.cause = error;
      throw enhancedError;
    }
  }
  
  /**
   * Load ES module
   * @private
   */
  async loadESModule(packageName) {
    try {
      if (packageName.startsWith('.') || packageName.startsWith('/')) {
        const modulePath = path.resolve(
          this.config._metadata?.directory || __dirname,
          packageName
        );
        const module = await import(modulePath);
        return module.default || module;
      } else {
        // In test environment, try CommonJS first to respect mocks
        if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
          try {
            return require(packageName);
          } catch (requireError) {
            // Fall back to ES import if require fails
            const module = await import(packageName);
            return module.default || module;
          }
        } else {
          const module = await import(packageName);
          return module.default || module;
        }
      }
    } catch (error) {
      throw new Error(`Failed to load ES module '${packageName}': ${error.message}`);
    }
  }
  
  /**
   * Initialize the library instance based on type
   * @param {Object} dependencies - Resolved dependencies
   * @returns {*} The initialized library instance
   */
  initializeLibrary(dependencies) {
    const { type, initialization = {} } = this.config;
    
    switch (type) {
      case 'static':
        // No initialization needed - use library directly
        return this.library;
        
      case 'constructor':
        return this.initializeConstructor(dependencies, initialization);
        
      case 'factory':
        return this.initializeFactory(dependencies, initialization);
        
      case 'singleton':
        return this.initializeSingleton(dependencies, initialization);
        
      default:
        throw new Error(`Unknown library type: ${type}`);
    }
  }
  
  /**
   * Initialize library using constructor pattern
   * @private
   */
  initializeConstructor(dependencies, init) {
    const config = this.resolveConfig(init.config || {}, dependencies);
    
    try {
      // Check if it's a class or function
      if (typeof this.library === 'function') {
        return new this.library(config);
      }
      
      // If library exports a specific constructor
      if (init.className && this.library[init.className]) {
        const Constructor = this.library[init.className];
        return new Constructor(config);
      }
      
      throw new Error('No constructor found in library');
    } catch (error) {
      throw new Error(
        `Failed to initialize ${this.name} with constructor: ${error.message}`
      );
    }
  }
  
  /**
   * Initialize library using factory pattern
   * @private
   */
  initializeFactory(dependencies, init) {
    const config = this.resolveConfig(init.config || {}, dependencies);
    const method = init.method || 'create';
    
    try {
      if (init.treatAsConstructor && typeof this.library === 'function') {
        // Some factories are actually constructors (like moment)
        return this.library(config);
      }
      
      if (typeof this.library[method] === 'function') {
        return this.library[method](config);
      }
      
      if (typeof this.library === 'function') {
        // Library itself is the factory
        return this.library(config);
      }
      
      throw new Error(`Factory method '${method}' not found`);
    } catch (error) {
      throw new Error(
        `Failed to initialize ${this.name} with factory: ${error.message}`
      );
    }
  }
  
  /**
   * Initialize library using singleton pattern
   * @private
   */
  initializeSingleton(dependencies, init) {
    const method = init.method || 'getInstance';
    
    try {
      if (typeof this.library[method] === 'function') {
        return this.library[method]();
      }
      
      // Some singletons are just the exported object
      return this.library;
    } catch (error) {
      throw new Error(
        `Failed to initialize ${this.name} as singleton: ${error.message}`
      );
    }
  }
  
  /**
   * Resolve configuration with dependency injection
   * @private
   */
  resolveConfig(config, dependencies) {
    const resolved = {};
    
    for (const [key, value] of Object.entries(config)) {
      if (typeof value === 'string' && value.startsWith('${') && value.endsWith('}')) {
        // Resolve dependency reference
        const depKey = value.slice(2, -1);
        resolved[key] = dependencies[depKey];
      } else if (typeof value === 'object' && value !== null) {
        // Recursively resolve nested objects
        resolved[key] = this.resolveConfig(value, dependencies);
      } else {
        resolved[key] = value;
      }
    }
    
    return resolved;
  }
  
  /**
   * Create tool instances from configuration
   * @returns {Array} Array of tool instances
   */
  async createTools() {
    const { tools = [] } = this.config;
    const toolInstances = [];
    
    // Dynamic import for ES modules
    const { GenericTool } = await import('../tool/GenericTool.js');
    
    for (const toolConfig of tools) {
      try {
        const tool = new GenericTool(toolConfig, this.instance);
        toolInstances.push(tool);
      } catch (error) {
        console.warn(
          `Failed to create tool '${toolConfig.name}' in module '${this.name}': ${error.message}`
        );
        if (this.config._metadata?.strict) {
          throw error;
        }
      }
    }
    
    return toolInstances;
  }

  /**
   * Get the tools for this module, ensuring initialization is complete
   * @returns {Promise<Array>} Array of tool instances
   */
  async getTools() {
    await this._initPromise;
    return this.tools;
  }

  /**
   * Check if module is fully initialized
   * @returns {boolean} True if initialized
   */
  isInitialized() {
    return this._initialized;
  }
}

export default GenericModule;