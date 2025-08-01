/**
 * Umbilical Component Protocol - Base utilities
 * 
 * The umbilical is the component's entire world. Everything it needs -
 * DOM access, data sources, event handling, lifecycle management -
 * must come through this single object interface.
 */

export class UmbilicalError extends Error {
  constructor(message, component, missingCapabilities = []) {
    super(message);
    this.name = 'UmbilicalError';
    this.component = component;
    this.missingCapabilities = missingCapabilities;
  }
}

/**
 * Base validation utilities for components
 */
export const UmbilicalUtils = {
  /**
   * Validate that an umbilical has required capabilities
   */
  validateCapabilities(umbilical, required, componentName = 'Component') {
    const missing = required.filter(capability => !(capability in umbilical));
    if (missing.length > 0) {
      throw new UmbilicalError(
        `${componentName} missing required capabilities: ${missing.join(', ')}`,
        componentName,
        missing
      );
    }
  },

  /**
   * Create a capability requirements descriptor
   */
  createRequirements() {
    const requirements = new Map();
    
    return {
      add(name, type, description = '') {
        requirements.set(name, { type, description });
      },
      
      get(name) {
        return requirements.get(name);
      },
      
      getAll() {
        return Object.fromEntries(requirements);
      },
      
      list() {
        return Array.from(requirements.keys());
      }
    };
  },

  /**
   * Create a mock umbilical for testing
   */
  createMockUmbilical(capabilities = {}) {
    return {
      // Default no-op implementations
      log: () => {},
      error: () => {},
      warn: () => {},
      
      // Merge in provided capabilities
      ...capabilities
    };
  }
};

/**
 * Standard lifecycle hooks that components can expect
 */
export const StandardLifecycle = {
  onMount() {},
  onUnmount() {},
  onDestroy() {},
  onError(error) { console.error(error); }
};