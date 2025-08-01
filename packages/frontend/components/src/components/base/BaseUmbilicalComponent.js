/**
 * BaseUmbilicalComponent - Foundation class for umbilical protocol components
 * 
 * Provides standardized implementation of the three-mode umbilical pattern:
 * 1. Introspection mode (umbilical.describe)
 * 2. Validation mode (umbilical.validate) 
 * 3. Instance creation mode
 * 
 * This class eliminates boilerplate and ensures consistency across components.
 */

import { UmbilicalUtils } from '../../umbilical/index.js';

export class BaseUmbilicalComponent {
  /**
   * Create a component following the umbilical protocol
   * @param {Object} umbilical - The umbilical object
   * @param {Function} InstanceClass - The class to instantiate in instance mode
   * @param {Object} config - Component configuration
   * @returns {Object|Instance} Requirements, validation result, or component instance
   */
  static create(umbilical, InstanceClass, config = {}) {
    // Handle case where this is called on a factory-created class
    if (!InstanceClass && typeof this === 'function' && this !== BaseUmbilicalComponent) {
      InstanceClass = this;
    }

    // 1. Introspection mode
    if (umbilical && umbilical.describe) {
      const requirements = this.defineRequirements(config);
      umbilical.describe(requirements);
      return;
    }

    // 2. Validation mode  
    if (umbilical && umbilical.validate) {
      const checks = this.validateCapabilities(umbilical, config);
      return umbilical.validate(checks);
    }

    // 3. Instance creation mode
    this.validateUmbilical(umbilical, config);
    return new InstanceClass(umbilical, config);
  }

  /**
   * Define component requirements - Override in subclasses
   * @param {Object} config - Component configuration
   * @returns {Requirements} Requirements object
   */
  static defineRequirements(config = {}) {
    const requirements = UmbilicalUtils.createRequirements();
    
    // Base requirements that most components need
    requirements.add('dom', 'HTMLElement', 'Parent DOM element for component');
    requirements.add('theme', 'string', 'Visual theme (light|dark) - optional', false);
    requirements.add('onMount', 'function', 'Called when component is mounted - optional', false);
    requirements.add('onDestroy', 'function', 'Called when component is destroyed - optional', false);
    requirements.add('onError', 'function', 'Called when an error occurs - optional', false);
    
    return requirements;
  }

  /**
   * Validate umbilical capabilities - Override in subclasses
   * @param {Object} umbilical - The umbilical object to validate
   * @param {Object} config - Component configuration
   * @returns {Object} Validation checks object
   */
  static validateCapabilities(umbilical, config = {}) {
    return {
      hasDomElement: !!(umbilical.dom && umbilical.dom.nodeType === Node.ELEMENT_NODE),
      hasValidTheme: !umbilical.theme || ['light', 'dark'].includes(umbilical.theme),
      hasValidCallbacks: this.validateCallbacks(umbilical),
      isConfigValid: this.validateConfig(config)
    };
  }

  /**
   * Validate required umbilical parameters - Override in subclasses
   * @param {Object} umbilical - The umbilical object
   * @param {Object} config - Component configuration
   * @throws {Error} If validation fails
   */
  static validateUmbilical(umbilical, config = {}) {
    if (!umbilical) {
      throw new Error(`${this.name} requires an umbilical object`);
    }

    // Only validate DOM if it's required (check if dom exists and is valid)
    if (umbilical.dom !== undefined) {
      UmbilicalUtils.validateCapabilities(umbilical, ['dom'], this.name);
    }

    // Validate theme if provided
    if (umbilical.theme && !['light', 'dark'].includes(umbilical.theme)) {
      throw new Error(`${this.name} theme must be 'light' or 'dark'`);
    }

    // Validate callbacks if provided
    const callbackValidation = this.validateCallbacks(umbilical);
    if (!callbackValidation) {
      throw new Error(`${this.name} callback validation failed`);
    }

    // Validate configuration
    if (!this.validateConfig(config)) {
      throw new Error(`${this.name} configuration validation failed`);
    }
  }

  /**
   * Validate callback functions
   * @param {Object} umbilical - The umbilical object
   * @returns {boolean} True if all callbacks are valid
   */
  static validateCallbacks(umbilical) {
    const callbacks = ['onMount', 'onDestroy', 'onError'];
    
    return callbacks.every(callback => {
      const fn = umbilical[callback];
      return !fn || typeof fn === 'function';
    });
  }

  /**
   * Validate component configuration - Override in subclasses
   * @param {Object} config - Configuration object
   * @returns {boolean} True if configuration is valid
   */
  static validateConfig(config) {
    return typeof config === 'object' && config !== null;
  }

  /**
   * Extract and merge configuration with defaults
   * @param {Object} umbilical - The umbilical object
   * @param {Object} defaults - Default configuration values
   * @returns {Object} Merged configuration
   */
  static extractConfig(umbilical, defaults = {}) {
    const config = {
      // Default values
      theme: 'light',
      ...defaults,
      
      // Extract from umbilical
      dom: umbilical.dom,
      theme: umbilical.theme || defaults.theme || 'light',
      
      // Callbacks
      onMount: umbilical.onMount,
      onDestroy: umbilical.onDestroy,
      onError: umbilical.onError,
      
      // Any additional properties from umbilical
      ...Object.fromEntries(
        Object.entries(umbilical).filter(([key]) => 
          !['dom', 'theme', 'onMount', 'onDestroy', 'onError', 'describe', 'validate'].includes(key)
        )
      )
    };

    return config;
  }

  /**
   * Handle component lifecycle callbacks
   * @param {string} lifecycle - Lifecycle event (mount|destroy|error)
   * @param {Object} umbilical - The umbilical object
   * @param {*} data - Data to pass to callback
   */
  static handleLifecycle(lifecycle, umbilical, data = null) {
    const callbackName = `on${lifecycle.charAt(0).toUpperCase()}${lifecycle.slice(1)}`;
    const callback = umbilical[callbackName];
    
    if (typeof callback === 'function') {
      try {
        callback(data);
      } catch (error) {
        console.error(`${this.name} ${lifecycle} callback error:`, error);
        
        // If this isn't the error callback itself, try to call error callback
        if (lifecycle !== 'error' && typeof umbilical.onError === 'function') {
          try {
            umbilical.onError(error);
          } catch (errorCallbackError) {
            console.error(`${this.name} error callback failed:`, errorCallbackError);
          }
        }
      }
    }
  }
}