/**
 * Main entry point for Umbilical Testing Framework
 */

// Core components
export { ComponentDescriptor } from './core/ComponentDescriptor.js';
export { ComponentIntrospector } from './core/ComponentIntrospector.js';
export { SelfTestingFramework } from './core/SelfTestingFramework.js';
export { TestSuite } from './core/TestSuite.js';

// Test generators
export { DependencyTestGenerator } from './generators/DependencyTestGenerator.js';
export { DOMTestGenerator } from './generators/DOMTestGenerator.js';
export { EventTestGenerator } from './generators/EventTestGenerator.js';
export { StateTestGenerator } from './generators/StateTestGenerator.js';

// Validators
export { JSOMValidator } from './validators/JSOMValidator.js';
export { CoordinationBugDetector } from './validators/CoordinationBugDetector.js';

// Main framework class for easy usage
export class UmbilicalTestingFramework {
  /**
   * Generate comprehensive tests for a self-describing component
   * @param {Object|Function} ComponentClass - Component to test
   * @param {Object} options - Generation options
   * @returns {TestSuite} Generated test suite
   */
  static generateTests(ComponentClass, options = {}) {
    return SelfTestingFramework.generateTests(ComponentClass, options);
  }

  /**
   * Validate component using JSDOM
   * @param {Object|Function} ComponentClass - Component to validate
   * @param {Object} options - Validation options
   * @returns {Promise<Object>} Validation results
   */
  static async validateComponent(ComponentClass, options = {}) {
    const description = ComponentIntrospector.introspect(ComponentClass);
    return JSOMValidator.validateComponent(ComponentClass, description, options);
  }

  /**
   * Introspect component and get description
   * @param {Object|Function} ComponentClass - Component to introspect
   * @returns {Object} Component description
   */
  static introspect(ComponentClass) {
    return ComponentIntrospector.introspect(ComponentClass);
  }
}

// Default export
export default UmbilicalTestingFramework;