/**
 * ComponentTestRunner - Test execution engine
 * Phase 7.3
 *
 * Runs component tests with assertions and generates results
 */

export class ComponentTestRunner {
  constructor(lifecycle) {
    if (!lifecycle) {
      throw new Error('ComponentTestRunner requires a lifecycle');
    }
    this.lifecycle = lifecycle;
  }

  /**
   * Run all tests for a component
   *
   * @param {string} dsl - Component DSL
   * @param {Array} tests - Array of test definitions
   * @returns {Promise<{total: number, passed: number, failed: number, tests: Array}>}
   */
  async runTests(dsl, tests) {
    const results = {
      total: tests.length,
      passed: 0,
      failed: 0,
      tests: []
    };

    for (const test of tests) {
      const result = await this.runTest(dsl, test);
      results.tests.push(result);
      if (result.passed) {
        results.passed++;
      } else {
        results.failed++;
      }
    }

    return results;
  }

  /**
   * Run a single test
   *
   * @param {string} dsl - Component DSL
   * @param {object} test - Test definition
   * @returns {Promise<{name: string, passed: boolean, assertions: Array, message: string}>}
   */
  async runTest(dsl, test) {
    // Create temporary container
    const container = document.createElement('div');
    container.style.display = 'none';
    document.body.appendChild(container);

    try {
      // Mount component with test data
      const component = await this.lifecycle.mount(dsl, container, test.data);

      // Run assertions
      const assertionResults = [];
      for (const assertion of test.assertions) {
        const result = this.runAssertion(container, assertion);
        assertionResults.push(result);
      }

      // Cleanup
      await component.unmount();
      document.body.removeChild(container);

      // Check if all assertions passed
      const passed = assertionResults.every(r => r.passed);

      return {
        name: test.name,
        passed,
        assertions: assertionResults,
        message: passed ? 'All assertions passed' : 'Some assertions failed'
      };
    } catch (error) {
      // Test execution failed - cleanup container
      if (container.parentNode) {
        document.body.removeChild(container);
      }

      return {
        name: test.name,
        passed: false,
        error: error.message,
        message: `Test failed: ${error.message}`
      };
    }
  }

  /**
   * Run a single assertion
   *
   * @param {HTMLElement} container - Test container
   * @param {object} assertion - Assertion definition
   * @returns {{passed: boolean, actual: any, expected: any, message: string}}
   */
  runAssertion(container, assertion) {
    const element = container.querySelector(assertion.selector);

    if (!element) {
      return {
        passed: false,
        message: `Element not found: ${assertion.selector}`
      };
    }

    const actualValue = this.getPropertyValue(element, assertion.property);
    const passed = this.compareValues(
      actualValue,
      assertion.expected,
      assertion.operator
    );

    return {
      passed,
      actual: actualValue,
      expected: assertion.expected,
      message: passed
        ? `✓ ${assertion.selector}.${assertion.property} ${assertion.operator} ${assertion.expected}`
        : `✗ Expected ${assertion.expected}, got ${actualValue}`
    };
  }

  /**
   * Get property value from element (supports nested properties)
   *
   * @param {HTMLElement} element - DOM element
   * @param {string} property - Property path (e.g., "style.color")
   * @returns {any}
   */
  getPropertyValue(element, property) {
    // Handle nested properties like "style.color"
    const parts = property.split('.');
    let value = element;
    for (const part of parts) {
      value = value[part];
    }
    return value;
  }

  /**
   * Compare values using operator
   *
   * @param {any} actual - Actual value
   * @param {any} expected - Expected value
   * @param {string} operator - Comparison operator
   * @returns {boolean}
   */
  compareValues(actual, expected, operator) {
    switch (operator) {
      case 'equals':
        return actual === expected;
      case 'contains':
        // Handle DOMTokenList (classList)
        if (actual && typeof actual.contains === 'function') {
          return actual.contains(expected);
        }
        // Handle strings and arrays
        return actual.includes(expected);
      case 'matches':
        return new RegExp(expected).test(actual);
      case 'greaterThan':
        return actual > expected;
      case 'lessThan':
        return actual < expected;
      default:
        return false;
    }
  }
}
