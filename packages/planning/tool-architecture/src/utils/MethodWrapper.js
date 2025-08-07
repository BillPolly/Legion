/**
 * Method Wrapping utilities
 * Utilities for wrapping existing methods with parameter mapping and output transformation
 */

/**
 * Extract parameter names from a function
 * @param {Function} func - Function to extract parameters from
 * @returns {Array<string>} Parameter names
 */
function getParameterNames(func) {
  const funcStr = func.toString();
  const match = funcStr.match(/\(([^)]*)\)/);
  if (!match) return [];
  
  return match[1]
    .split(',')
    .map(param => param.trim())
    .filter(param => param)
    .map(param => param.split('=')[0].trim()); // Handle default values
}

/**
 * Wrap a synchronous method
 * @param {Object} obj - Object containing the method
 * @param {string} methodName - Name of the method to wrap
 * @param {Object} options - Wrapping options
 * @returns {Function} Wrapped async function
 */
export function wrapMethod(obj, methodName, options = {}) {
  const method = obj[methodName];
  
  if (typeof method !== 'function') {
    throw new Error(`${methodName} is not a function`);
  }

  return async function(input) {
    let args;
    
    // Apply parameter mapping if provided
    if (options.parameterMapper) {
      args = options.parameterMapper(input);
    } else {
      // Default: pass the input object as-is
      args = [input];
    }
    
    // Call the method with proper context
    let result = method.apply(obj, args);
    
    // Await if result is a promise
    if (result && typeof result.then === 'function') {
      result = await result;
    }
    
    // Apply output transformation if provided
    if (options.outputTransformer) {
      result = await options.outputTransformer(result);
    }
    
    return result;
  };
}

/**
 * Wrap an async method
 * @param {Object} obj - Object containing the method
 * @param {string} methodName - Name of the method to wrap
 * @param {Object} options - Wrapping options
 * @returns {Function} Wrapped async function
 */
export function wrapAsyncMethod(obj, methodName, options = {}) {
  // wrapMethod already handles async methods
  return wrapMethod(obj, methodName, options);
}

/**
 * Create a parameter mapper function
 * @param {Object|Function} mapping - Mapping configuration or function
 * @returns {Function} Parameter mapper function
 */
export function createParameterMapper(mapping) {
  if (typeof mapping === 'function') {
    return mapping;
  }
  
  return function(input) {
    const args = [];
    
    for (const [key, config] of Object.entries(mapping)) {
      if (typeof config === 'number') {
        // Simple index mapping
        args[config] = input[key];
      } else if (typeof config === 'object' && config.index !== undefined) {
        // Complex mapping with default
        args[config.index] = input[key] !== undefined ? input[key] : config.default;
      }
    }
    
    return args;
  };
}

/**
 * Create an output transformer function
 * @param {Function} transformer - Transformation function
 * @returns {Function} Output transformer function
 */
export function createOutputTransformer(transformer) {
  return transformer;
}

/**
 * MethodWrapper class for configuration-driven method wrapping
 */
export class MethodWrapper {
  constructor(sourceObject) {
    this.sourceObject = sourceObject;
  }

  /**
   * Wrap methods based on configuration
   * @param {Object} config - Configuration for each method
   * @returns {Object} Wrapped methods
   */
  wrapFromConfig(config) {
    const wrapped = {};
    
    for (const [methodName, methodConfig] of Object.entries(config)) {
      if (typeof this.sourceObject[methodName] !== 'function') {
        continue;
      }
      
      const options = {};
      
      if (methodConfig.parameterMapping) {
        options.parameterMapper = createParameterMapper(methodConfig.parameterMapping);
      }
      
      if (methodConfig.outputTransform) {
        options.outputTransformer = createOutputTransformer(methodConfig.outputTransform);
      }
      
      wrapped[methodName] = wrapMethod(this.sourceObject, methodName, options);
    }
    
    return wrapped;
  }

  /**
   * Wrap all methods of the source object
   * @param {Object} defaultOptions - Default options for all methods
   * @returns {Object} Wrapped methods
   */
  wrapAll(defaultOptions = {}) {
    const wrapped = {};
    
    // Get all method names
    const methodNames = Object.getOwnPropertyNames(this.sourceObject)
      .filter(name => typeof this.sourceObject[name] === 'function' && name !== 'constructor');
    
    for (const methodName of methodNames) {
      wrapped[methodName] = wrapMethod(this.sourceObject, methodName, defaultOptions);
    }
    
    return wrapped;
  }
}