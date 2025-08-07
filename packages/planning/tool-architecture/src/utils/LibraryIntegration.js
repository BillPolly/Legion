/**
 * Library Integration Patterns
 * Utilities for wrapping Node.js built-in modules and NPM packages
 */

import { Tool } from '../modules/Tool.js';
import { HandleManager, generateHandle } from './HandleManager.js';

/**
 * NodeModuleWrapper - Wraps Node.js built-in modules
 */
export class NodeModuleWrapper {
  constructor(moduleName, moduleObj, options = {}) {
    this.moduleName = moduleName;
    this.module = moduleObj;
    this.options = options;
    this.handleManager = new HandleManager();
  }

  /**
   * Create tools from module methods
   * @returns {Object} Map of tool names to Tool instances
   */
  createTools() {
    const tools = {};
    const methods = this.discoverMethods();

    for (const methodName of methods) {
      // Skip if excluded
      if (this.options.exclude && this.options.exclude.includes(methodName)) {
        continue;
      }

      // Skip if not included (when include list is specified)
      if (this.options.include && !this.options.include.includes(methodName)) {
        continue;
      }

      const method = this.getMethodAtPath(methodName);
      if (typeof method !== 'function') {
        continue;
      }

      // Determine method type
      const methodType = this.detectMethodType(method, methodName);
      
      // Create wrapped tool
      tools[methodName.replace(/\./g, '_')] = this.createToolForMethod(
        methodName,
        method,
        methodType
      );
    }

    return tools;
  }

  /**
   * Discover all methods in the module
   * @returns {Array<string>} Method names (including nested)
   */
  discoverMethods() {
    const methods = [];

    const discover = (obj, prefix = '') => {
      for (const key of Object.keys(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        const value = obj[key];

        if (typeof value === 'function') {
          methods.push(fullKey);
        } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          // Recurse into nested objects
          discover(value, fullKey);
        }
      }
    };

    discover(this.module);
    return methods;
  }

  /**
   * Get method at a nested path
   * @param {string} path - Dot-separated path
   * @returns {Function|undefined} The method
   */
  getMethodAtPath(path) {
    const parts = path.split('.');
    let current = this.module;

    for (const part of parts) {
      current = current[part];
      if (!current) return undefined;
    }

    return current;
  }

  /**
   * Detect the type of method (callback, promise, sync)
   * @param {Function} method - The method to analyze
   * @param {string} name - Method name
   * @returns {string} Method type
   */
  detectMethodType(method, name) {
    // Check if it's a streaming method
    if (this.options.streamMethods && this.options.streamMethods.includes(name)) {
      return 'stream';
    }

    // Check method name patterns
    if (name.endsWith('Sync')) {
      return 'sync';
    }

    if (name.includes('promises')) {
      return 'promise';
    }

    // Default to callback for Node.js built-ins
    return 'callback';
  }

  /**
   * Create a tool for a specific method
   * @param {string} name - Method name
   * @param {Function} method - The method
   * @param {string} type - Method type
   * @returns {Tool} Created tool
   */
  createToolForMethod(name, method, type) {
    // Get the parent object for binding context
    const parent = this.getParentObject(name);
    const execute = this.createExecutor(method, type, parent);
    
    return new Tool({
      name: name.replace(/\./g, '_'),
      execute,
      getMetadata: () => ({
        description: `Wrapped method ${name} from ${this.moduleName}`,
        module: this.moduleName,
        type,
        input: {},
        output: {}
      })
    });
  }
  
  /**
   * Get parent object for a method path
   * @param {string} path - Dot-separated path
   * @returns {Object} Parent object
   */
  getParentObject(path) {
    const parts = path.split('.');
    if (parts.length === 1) {
      return this.module; // Top-level method
    }
    
    // Navigate to parent
    let current = this.module;
    for (let i = 0; i < parts.length - 1; i++) {
      current = current[parts[i]];
    }
    return current;
  }

  /**
   * Create executor function based on method type
   * @param {Function} method - The method to wrap
   * @param {string} type - Method type
   * @param {Object} parent - Parent object for binding
   * @returns {Function} Executor function
   */
  createExecutor(method, type, parent) {
    switch (type) {
      case 'callback':
        return async (input) => {
          return new Promise((resolve, reject) => {
            // Extract arguments from input
            const args = this.extractArguments(input);
            
            // Add callback as last argument
            args.push((error, result) => {
              if (error) {
                reject(error);
              } else {
                resolve(result);
              }
            });

            // Call the method with proper context
            method.apply(parent, args);
          });
        };

      case 'promise':
        return async (input) => {
          const args = this.extractArguments(input);
          return await method.apply(parent, args);
        };

      case 'sync':
        return async (input) => {
          const args = this.extractArguments(input);
          return method.apply(parent, args);
        };

      case 'stream':
        return async (input) => {
          const args = this.extractArguments(input);
          const stream = method.apply(parent, args);
          
          // Create and register a handle for the stream
          const handle = generateHandle('stream', { resource: stream });
          this.handleManager.register(handle);
          
          return {
            type: 'stream',
            handle: handle._id
          };
        };

      default:
        return async (input) => {
          const args = this.extractArguments(input);
          return await method.apply(parent, args);
        };
    }
  }

  /**
   * Extract arguments from input object
   * @param {Object} input - Input object
   * @returns {Array} Arguments array
   */
  extractArguments(input) {
    // Common patterns for Node.js methods
    if (input.path !== undefined) return [input.path];
    if (input.command !== undefined) return [input.command];
    if (input.sql !== undefined) return [input.sql];
    if (input.data !== undefined) return [input.data];
    
    // Check for ordered arguments
    if (input.args && Array.isArray(input.args)) {
      return input.args;
    }

    // Default to pass the whole input if no specific pattern matches
    return [input];
  }
}

/**
 * NPMPackageWrapper - Wraps NPM packages
 */
export class NPMPackageWrapper {
  constructor(packageName, packageObj, options = {}) {
    this.packageName = packageName;
    this.package = packageObj;
    this.options = options;
    this.instance = null;
    this.pool = null;
  }

  /**
   * Create an instance of the package
   * @returns {Promise<Object>} Package instance
   */
  async createInstance() {
    // Return singleton if configured
    if (this.options.singleton && this.instance) {
      return this.instance;
    }

    let instance;

    // Create via factory function
    if (this.options.factory) {
      const factory = this.package[this.options.factory];
      if (!factory) {
        throw new Error(`Factory method ${this.options.factory} not found`);
      }
      instance = factory(this.options.factoryConfig || {});
    }
    // Create via constructor
    else if (this.options.constructor) {
      const Constructor = this.package[this.options.constructor];
      if (!Constructor) {
        throw new Error(`Constructor ${this.options.constructor} not found`);
      }
      instance = new Constructor(this.options.constructorConfig || {});
    }
    // Direct use if package is already an instance
    else {
      instance = this.package;
    }

    // Call initialization method if specified
    if (this.options.initMethod && instance[this.options.initMethod]) {
      await instance[this.options.initMethod]();
    }

    // Store singleton if configured
    if (this.options.singleton) {
      this.instance = instance;
    }

    return instance;
  }

  /**
   * Create tools from instance methods
   * @param {Object} instance - Package instance
   * @returns {Object} Map of tool names to Tool instances
   */
  createTools(instance) {
    const tools = {};

    // Get all methods from the instance
    let methods = [];
    
    // Get methods from prototype if it exists
    if (Object.getPrototypeOf(instance) && Object.getPrototypeOf(instance) !== Object.prototype) {
      methods = methods.concat(
        Object.getOwnPropertyNames(Object.getPrototypeOf(instance))
          .filter(name => name !== 'constructor')
      );
    }
    
    // Get own methods
    methods = methods.concat(
      Object.getOwnPropertyNames(instance)
        .filter(name => typeof instance[name] === 'function')
    );
    
    // Remove duplicates
    methods = [...new Set(methods)];

    for (const methodName of methods) {
      // Skip if method doesn't exist on instance
      if (typeof instance[methodName] !== 'function') {
        continue;
      }
      const method = instance[methodName].bind(instance);
      
      // Apply transforms if configured
      let execute = async (input) => {
        let processedInput = input;
        let result;

        // Apply input transform
        const transforms = this.options.methodTransforms?.[methodName];
        if (transforms?.inputTransform) {
          processedInput = transforms.inputTransform(input);
        }

        // Call the method
        if (this.options.eventEmitter && (methodName === 'on' || methodName === 'emit')) {
          // Special handling for event emitters
          result = method(processedInput);
        } else {
          result = await method(processedInput);
        }

        // Apply output transform
        if (transforms?.outputTransform) {
          result = transforms.outputTransform(result);
        }

        return result;
      };

      tools[methodName] = new Tool({
        name: methodName,
        execute,
        getMetadata: () => ({
          description: `Method ${methodName} from ${this.packageName}`,
          package: this.packageName,
          input: {},
          output: {}
        })
      });
    }

    return tools;
  }

  /**
   * Clean up instance resources
   * @param {Object} instance - Package instance
   */
  async cleanup(instance) {
    if (this.options.cleanupMethod && instance[this.options.cleanupMethod]) {
      await instance[this.options.cleanupMethod]();
    }
  }

  /**
   * Create a connection pool
   * @returns {Promise<Object>} Pool object
   */
  async createPool() {
    if (this.pool) {
      return this.pool;
    }

    const poolConfig = this.options.pooling || { min: 2, max: 10 };
    const instances = [];

    // Create minimum instances
    for (let i = 0; i < poolConfig.min; i++) {
      instances.push(await this.createInstance());
    }

    this.pool = {
      size: instances.length,
      instances,
      available: [...instances],
      inUse: [],
      
      acquire: async () => {
        if (this.pool.available.length > 0) {
          const instance = this.pool.available.pop();
          this.pool.inUse.push(instance);
          return instance;
        }
        
        // Create new instance if under max
        if (this.pool.size < poolConfig.max) {
          const newInstance = await this.createInstance();
          this.pool.instances.push(newInstance);
          this.pool.inUse.push(newInstance);
          this.pool.size++;
          return newInstance;
        }
        
        throw new Error('Pool exhausted');
      },
      
      async release(instance) {
        const index = this.inUse.indexOf(instance);
        if (index !== -1) {
          this.inUse.splice(index, 1);
          this.available.push(instance);
        }
      }
    };

    return this.pool;
  }
}

/**
 * Helper function to wrap built-in module
 * @param {string} moduleName - Module name
 * @param {Object} moduleObj - Module object (for testing) or null to require
 * @returns {Promise<Object>} Tools from the module
 */
export async function wrapBuiltinModule(moduleName, moduleObj = null) {
  const module = moduleObj || await import(moduleName);
  const wrapper = new NodeModuleWrapper(moduleName, module);
  return wrapper.createTools();
}

/**
 * Helper function to wrap NPM package
 * @param {string} packageName - Package name
 * @param {Object} packageObj - Package object
 * @param {Object} options - Wrapper options
 * @returns {Promise<Object>} Tools from the package
 */
export async function wrapNPMPackage(packageName, packageObj, options = {}) {
  const wrapper = new NPMPackageWrapper(packageName, packageObj, options);
  const instance = await wrapper.createInstance();
  return wrapper.createTools(instance);
}

/**
 * Auto-detect and create module from library
 * @param {string} name - Library name
 * @param {Object} library - Library object
 * @param {Object} options - Options
 * @returns {Promise<Object>} Tools from the library
 */
export async function createModuleFromLibrary(name, library, options = {}) {
  // Check if options specify constructor or factory (as own properties)
  if (options && (Object.hasOwn(options, 'constructor') || Object.hasOwn(options, 'factory'))) {
    // Use NPM package wrapper
    return await wrapNPMPackage(name, library, options);
  }
  
  // Check if it looks like a class-based package
  const classKeys = Object.keys(library).filter(key => {
    const val = library[key];
    if (typeof val !== 'function') return false;
    
    // Check for ES6 class syntax or constructor function
    const isES6Class = val.toString().startsWith('class ');
    const hasPrototypeMethods = val.prototype && 
                                Object.getOwnPropertyNames(val.prototype).length > 1;
    const followsClassNaming = key[0] === key[0].toUpperCase() && key !== 'Object';
    
    return isES6Class || (hasPrototypeMethods && followsClassNaming);
  });

  if (classKeys.length > 0) {
    // Use the first valid class found
    const className = classKeys[0];
    return await wrapNPMPackage(name, library, { ...options, constructor: className });
  } else {
    // Use Node module wrapper
    return await wrapBuiltinModule(name, library);
  }
}