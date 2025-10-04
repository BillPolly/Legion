/**
 * Test Schema - Validation for component test definitions
 * Phase 7.2
 *
 * Provides validation for test definitions and assertions
 */

/**
 * Validate test definition
 *
 * @param {object} testDef - Test definition to validate
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateTestDefinition(testDef) {
  const errors = [];

  // Validate name
  if (!testDef || !testDef.name) {
    errors.push('Test name is required');
  }

  // Validate assertions
  if (!testDef || !testDef.assertions) {
    errors.push('Assertions array is required');
  } else if (!Array.isArray(testDef.assertions)) {
    errors.push('Assertions must be an array');
  } else if (testDef.assertions.length === 0) {
    errors.push('At least one assertion is required');
  } else {
    // Validate each assertion
    testDef.assertions.forEach((assertion, index) => {
      const assertionResult = validateAssertion(assertion);
      if (!assertionResult.valid) {
        assertionResult.errors.forEach(error => {
          errors.push(`Assertion ${index + 1}: ${error}`);
        });
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate assertion
 *
 * @param {object} assertion - Assertion to validate
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateAssertion(assertion) {
  const errors = [];

  // Validate type
  if (!assertion || !assertion.type) {
    errors.push('Assertion type is required');
  }

  // Validate selector
  if (!assertion || !assertion.selector) {
    errors.push('Selector is required');
  }

  // Validate property
  if (!assertion || !assertion.property) {
    errors.push('Property is required');
  }

  // Validate operator
  if (!assertion || !assertion.operator) {
    errors.push('Operator is required');
  } else {
    const validOperators = ['equals', 'contains', 'matches', 'greaterThan', 'lessThan'];
    if (!validOperators.includes(assertion.operator)) {
      errors.push(`Invalid operator: ${assertion.operator}. Valid operators: ${validOperators.join(', ')}`);
    }
  }

  // Validate expected value
  if (!assertion || assertion.expected === undefined || assertion.expected === null) {
    errors.push('Expected value is required');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
