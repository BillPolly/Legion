/**
 * StandardizedComponentAPI - Base class for all planning interface components
 * Provides consistent API structure, error handling, validation, and lifecycle management
 */

import { APIResponse, BaseComponentAPI } from '../interfaces/ComponentAPI.js';

/**
 * API Method wrapper for validation and error handling
 */
export function apiMethod(originalMethod) {
  return function(...args) {
    try {
      // Pre-validation
      if (this.validateState && typeof this.validateState === 'function') {
        const validationResult = this.validateState();
        if (!validationResult.success) {
          return APIResponse.error(`Validation failed: ${validationResult.error}`);
        }
      }
      
      // Call original method
      const result = originalMethod.apply(this, args);
      
      // Handle async methods
      if (result && typeof result.then === 'function') {
        return result.catch(error => {
          this.setLastError(error);
          return APIResponse.error(error.message);
        });
      }
      
      // Handle synchronous methods that don't return APIResponse
      if (!(result instanceof APIResponse)) {
        return APIResponse.success(result);
      }
      
      return result;
    } catch (error) {
      this.setLastError(error);
      return APIResponse.error(error.message);
    }
  };
}

/**
 * State Validation wrapper
 */
export function validateState(requirements = []) {
  return function(originalMethod) {
    return function(...args) {
      // Check required state properties
      for (const requirement of requirements) {
        if (!this.model.getState(requirement)) {
          return APIResponse.error(`Required state property '${requirement}' is missing`);
        }
      }
      
      return originalMethod.apply(this, args);
    };
  };
}

/**
 * StandardizedComponentAPI - Base class implementing consistent component patterns
 */
export class StandardizedComponentAPI extends BaseComponentAPI {
  constructor(model, view, umbilical, componentName = 'Unknown') {
    super();
    this.model = model;
    this.view = view;
    this.umbilical = umbilical;
    this.componentName = componentName;
    this.lastError = null;
    this.isInitialized = false;
    
    // Initialize standardized API
    this.initializeStandardizedAPI();
  }

  /**
   * Initialize the standardized API with core methods and component-specific methods
   */
  initializeStandardizedAPI() {
    // Get component-specific methods from subclass
    const componentMethods = this.getComponentSpecificMethods() || {};
    
    // Create unified API object
    this.api = {
      // === CORE LIFECYCLE METHODS ===
      isReady: () => this.isReady(),
      getState: (key) => this.getState(key),
      setState: (key, value) => this.setState(key, value),
      reset: () => this.reset(),
      destroy: () => this.destroy(),
      
      // === ERROR HANDLING ===
      getLastError: () => this.getLastError(),
      clearError: () => this.clearError(),
      hasError: () => this.hasError(),
      
      // === VALIDATION ===
      validate: () => this.validate(),
      isValid: () => this.isValid(),
      getValidationErrors: () => this.getValidationErrors(),
      
      // === COMPONENT INFO ===
      getComponentName: () => this.componentName,
      getAPIVersion: () => '1.0.0',
      getCapabilities: () => this.getCapabilities(),
      
      // === COMPONENT-SPECIFIC METHODS ===
      ...componentMethods
    };
    
    this.isInitialized = true;
    
    // Expose API through umbilical if onMount is available
    if (this.umbilical.onMount && typeof this.umbilical.onMount === 'function') {
      this.umbilical.onMount(this.api);
    }
  }

  /**
   * Override this method in subclasses to provide component-specific API methods
   * @returns {Object} Object containing component-specific methods
   */
  getComponentSpecificMethods() {
    return {};
  }

  /**
   * Override this method in subclasses to provide component-specific validation
   * @returns {Array} Array of validation error messages
   */
  getComponentSpecificValidationErrors() {
    return [];
  }

  // === CORE LIFECYCLE METHODS ===

  isReady() {
    return this.isInitialized && 
           this.model && 
           this.view && 
           this.umbilical;
  }

  getState(key) {
    if (!this.model) {
      throw new Error('Model not available');
    }
    return this.model.getState(key);
  }

  setState(key, value) {
    if (!this.model) {
      return APIResponse.error('Model not available');
    }
    
    this.model.updateState(key, value);
    return APIResponse.success({ [key]: value });
  }

  reset() {
    if (!this.model) {
      return APIResponse.error('Model not available');
    }
    
    this.model.reset();
    this.clearError();
    return APIResponse.success(null, { message: 'Component reset successfully' });
  }

  destroy() {
    try {
      // Component-specific cleanup
      if (this.view && typeof this.view.destroy === 'function') {
        this.view.destroy();
      }
      
      // Clear model listeners
      if (this.model && typeof this.model.removeListener === 'function') {
        this.model.removeListener(this.onModelChange);
      }
      
      // Umbilical cleanup
      if (this.umbilical.onDestroy && typeof this.umbilical.onDestroy === 'function') {
        this.umbilical.onDestroy();
      }
      
      // Clear references
      this.model = null;
      this.view = null;
      this.umbilical = null;
      this.api = null;
      this.isInitialized = false;
      
      return APIResponse.success(null, { message: 'Component destroyed successfully' });
    } catch (error) {
      return APIResponse.error(`Failed to destroy component: ${error.message}`);
    }
  }

  // === ERROR HANDLING ===

  getLastError() {
    return this.lastError;
  }

  setLastError(error) {
    this.lastError = error instanceof Error ? error : new Error(String(error));
  }

  clearError() {
    this.lastError = null;
    return APIResponse.success(null, { message: 'Error cleared' });
  }

  hasError() {
    return this.lastError !== null;
  }

  // === VALIDATION ===

  validate() {
    const errors = this.getValidationErrors();
    const isValid = errors.length === 0;
    
    return APIResponse.success({
      isValid,
      errors,
      timestamp: new Date().toISOString()
    });
  }

  isValid() {
    return this.getValidationErrors().length === 0;
  }

  getValidationErrors() {
    const errors = [];
    
    // Core validation
    if (!this.isReady()) {
      errors.push('Component is not ready');
    }
    
    if (!this.model) {
      errors.push('Model is not available');
    }
    
    if (!this.view) {
      errors.push('View is not available');
    }
    
    if (!this.umbilical) {
      errors.push('Umbilical is not available');
    }
    
    // Component-specific validation
    const componentErrors = this.getComponentSpecificValidationErrors();
    errors.push(...componentErrors);
    
    return errors;
  }

  // === COMPONENT CAPABILITIES ===

  getCapabilities() {
    const capabilities = {
      lifecycle: ['isReady', 'getState', 'setState', 'reset', 'destroy'],
      errorHandling: ['getLastError', 'clearError', 'hasError'],
      validation: ['validate', 'isValid', 'getValidationErrors'],
      info: ['getComponentName', 'getAPIVersion', 'getCapabilities']
    };
    
    // Add component-specific capabilities
    const componentMethods = Object.keys(this.getComponentSpecificMethods() || {});
    if (componentMethods.length > 0) {
      capabilities.componentSpecific = componentMethods;
    }
    
    return capabilities;
  }

  // === UTILITY METHODS ===

  /**
   * Safely execute a method with error handling
   */
  safeExecute(methodName, ...args) {
    try {
      if (typeof this[methodName] !== 'function') {
        return APIResponse.error(`Method '${methodName}' not found`);
      }
      
      const result = this[methodName](...args);
      return result instanceof APIResponse ? result : APIResponse.success(result);
    } catch (error) {
      this.setLastError(error);
      return APIResponse.error(`Error executing '${methodName}': ${error.message}`);
    }
  }

  /**
   * Create a validated API method wrapper
   */
  createValidatedMethod(methodName, validator = null) {
    return (...args) => {
      // Pre-validation
      if (validator) {
        const validationResult = validator(...args);
        if (!validationResult.success) {
          return validationResult;
        }
      }
      
      return this.safeExecute(methodName, ...args);
    };
  }

  /**
   * Log component activity for debugging
   */
  logActivity(level, message, data = null) {
    const logEntry = {
      component: this.componentName,
      level,
      message,
      data,
      timestamp: new Date().toISOString()
    };
    
    // Use console for now, but could be extended to use proper logging
    console.log(`[${this.componentName}] ${level.toUpperCase()}: ${message}`, data || '');
    
    // Trigger umbilical logging if available
    if (this.umbilical.onLogEntry && typeof this.umbilical.onLogEntry === 'function') {
      this.umbilical.onLogEntry(logEntry);
    }
  }

  /**
   * Handle model changes - should be overridden by subclasses
   */
  onModelChange(changes) {
    // Default implementation - subclasses should override
    this.logActivity('debug', 'Model changed', changes);
  }
}

/**
 * Component Factory for creating standardized components
 */
export class ComponentFactory {
  static async createComponent(ComponentClass, umbilical, options = {}) {
    try {
      // Validate umbilical capabilities
      if (!umbilical.dom) {
        throw new Error('Umbilical must provide DOM capabilities');
      }
      
      // Create component
      const component = await ComponentClass.create(umbilical, options);
      
      // Validate component implements standardized API
      if (!component.api) {
        throw new Error('Component must expose standardized API');
      }
      
      return APIResponse.success(component);
    } catch (error) {
      return APIResponse.error(`Failed to create component: ${error.message}`);
    }
  }
}

/**
 * API Method Registry for documentation and introspection
 */
export class APIMethodRegistry {
  static registry = new Map();
  
  static register(componentName, methods) {
    this.registry.set(componentName, {
      methods,
      registeredAt: new Date().toISOString()
    });
  }
  
  static getRegisteredMethods(componentName) {
    return this.registry.get(componentName)?.methods || [];
  }
  
  static getAllRegisteredComponents() {
    return Array.from(this.registry.keys());
  }
  
  static getAPIDocumentation(componentName) {
    const registration = this.registry.get(componentName);
    if (!registration) {
      return null;
    }
    
    return {
      componentName,
      methods: registration.methods,
      registeredAt: registration.registeredAt
    };
  }
}