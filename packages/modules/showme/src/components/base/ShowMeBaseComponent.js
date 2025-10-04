/**
 * ShowMeBaseComponent - Base component for ShowMe module UI elements
 * 
 * Extends Legion's BaseUmbilicalComponent with ShowMe-specific patterns
 * and utilities for consistent component behavior across the module.
 */

import { BaseUmbilicalComponent } from '@legion/components';

export class ShowMeBaseComponent extends BaseUmbilicalComponent {
  /**
   * Define standard ShowMe component requirements
   * @param {Object} config - Component configuration
   * @returns {Requirements} Requirements object
   */
  static defineRequirements(config = {}) {
    const requirements = super.defineRequirements(config);
    
    // Add ShowMe-specific requirements
    requirements.add('className', 'string', 'Additional CSS class name - optional', false);
    requirements.add('disabled', 'boolean', 'Disabled state - optional', false);
    requirements.add('testId', 'string', 'Test identifier for testing - optional', false);
    
    return requirements;
  }

  /**
   * Validate ShowMe component capabilities
   * @param {Object} umbilical - The umbilical object to validate
   * @param {Object} config - Component configuration
   * @returns {Object} Validation checks object
   */
  static validateCapabilities(umbilical, config = {}) {
    const baseChecks = super.validateCapabilities(umbilical, config);
    
    return {
      ...baseChecks,
      hasValidClassName: !umbilical.className || typeof umbilical.className === 'string',
      hasValidDisabled: typeof umbilical.disabled === 'boolean' || umbilical.disabled === undefined,
      hasValidTestId: !umbilical.testId || typeof umbilical.testId === 'string'
    };
  }

  /**
   * Extract ShowMe-specific configuration with defaults
   * @param {Object} umbilical - The umbilical object
   * @param {Object} defaults - Default configuration values
   * @returns {Object} Merged configuration with ShowMe defaults
   */
  static extractConfig(umbilical, defaults = {}) {
    const baseConfig = super.extractConfig(umbilical, defaults);
    
    return {
      ...baseConfig,
      className: umbilical.className || defaults.className || '',
      disabled: umbilical.disabled || defaults.disabled || false,
      testId: umbilical.testId || defaults.testId || null
    };
  }

  /**
   * Apply standard ShowMe component styling to an element
   * @param {HTMLElement} element - Element to style
   * @param {string} baseClassName - Base CSS class name
   * @param {Object} config - Component configuration
   */
  static applyStandardStyling(element, baseClassName, config = {}) {
    // Set base class
    element.className = baseClassName;
    
    // Add additional classes
    if (config.className) {
      element.classList.add(config.className);
    }
    
    // Apply disabled state
    if (config.disabled) {
      element.classList.add('disabled');
      element.setAttribute('aria-disabled', 'true');
      if (element.tagName === 'BUTTON' || element.tagName === 'INPUT') {
        element.disabled = true;
      }
    }
    
    // Apply test ID
    if (config.testId) {
      element.setAttribute('data-testid', config.testId);
    }
    
    // Apply theme
    if (config.theme) {
      element.setAttribute('data-theme', config.theme);
    }
  }

  /**
   * Create a standard ShowMe component element
   * @param {string} tagName - HTML tag name
   * @param {string} baseClassName - Base CSS class
   * @param {Object} config - Component configuration
   * @returns {HTMLElement} Configured element
   */
  static createElement(tagName, baseClassName, config = {}) {
    const element = document.createElement(tagName);
    this.applyStandardStyling(element, baseClassName, config);
    return element;
  }

  /**
   * Handle component errors with ShowMe-specific logging
   * @param {Error} error - Error that occurred
   * @param {string} componentName - Name of component where error occurred
   * @param {Object} umbilical - The umbilical object
   */
  static handleComponentError(error, componentName, umbilical) {
    const errorMessage = `ShowMe ${componentName} error: ${error.message}`;
    console.error(errorMessage, error);
    
    // Call error callback if provided
    super.handleLifecycle('error', umbilical, error);
  }

  /**
   * Create event handler that's bound to component instance
   * @param {Object} instance - Component instance
   * @param {Function} handler - Handler function
   * @returns {Function} Bound event handler
   */
  static createBoundEventHandler(instance, handler) {
    return (event) => {
      try {
        return handler.call(instance, event);
      } catch (error) {
        console.error('ShowMe component event handler error:', error);
        throw error;
      }
    };
  }

  /**
   * Safely remove event listeners from an element
   * @param {HTMLElement} element - Element to clean up
   * @param {Array} listeners - Array of {event, handler} objects
   */
  static removeEventListeners(element, listeners = []) {
    listeners.forEach(({ event, handler }) => {
      if (element && typeof element.removeEventListener === 'function') {
        element.removeEventListener(event, handler);
      }
    });
  }

  /**
   * Generate component-specific unique ID
   * @param {string} componentName - Name of the component
   * @param {string} elementType - Type of element (optional)
   * @param {string} customId - Custom ID if provided
   * @returns {string} Generated unique ID
   */
  static generateComponentId(componentName, elementType = null, customId = null) {
    const prefix = `showme-${componentName.toLowerCase()}`;
    
    if (customId) {
      return elementType ? `${prefix}-${elementType}-${customId}` : `${prefix}-${customId}`;
    }
    
    return elementType ? 
      this.generateElementId(prefix, elementType) : 
      this.generateId(prefix);
  }
}