/**
 * Test Schema Tests - Phase 7.2
 *
 * Tests for component test definition and assertion validation
 */

import { validateTestDefinition, validateAssertion } from '../../../src/components/component-editor/src/testing/TestSchema.js';

describe('Test Schema Validation', () => {
  describe('validateTestDefinition()', () => {
    test('should validate valid test definition', () => {
      const testDef = {
        name: 'should display user name',
        description: 'Verify name appears',
        data: { name: 'Test' },
        assertions: [
          {
            type: 'element',
            selector: 'h2',
            property: 'textContent',
            operator: 'equals',
            expected: 'Test'
          }
        ]
      };

      const result = validateTestDefinition(testDef);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('should require name field', () => {
      const testDef = {
        data: {},
        assertions: []
      };

      const result = validateTestDefinition(testDef);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Test name is required');
    });

    test('should require assertions array', () => {
      const testDef = {
        name: 'test',
        data: {}
      };

      const result = validateTestDefinition(testDef);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Assertions array is required');
    });

    test('should require at least one assertion', () => {
      const testDef = {
        name: 'test',
        data: {},
        assertions: []
      };

      const result = validateTestDefinition(testDef);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('At least one assertion is required');
    });

    test('should validate all assertions', () => {
      const testDef = {
        name: 'test',
        data: {},
        assertions: [
          {
            type: 'element',
            selector: 'div',
            property: 'textContent',
            operator: 'equals',
            expected: 'value'
          },
          {
            // Invalid assertion - missing operator
            type: 'element',
            selector: 'span',
            property: 'textContent',
            expected: 'value'
          }
        ]
      };

      const result = validateTestDefinition(testDef);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Operator'))).toBe(true);
    });

    test('should allow optional description', () => {
      const testDef = {
        name: 'test',
        data: {},
        assertions: [
          {
            type: 'element',
            selector: 'div',
            property: 'textContent',
            operator: 'equals',
            expected: 'value'
          }
        ]
      };

      const result = validateTestDefinition(testDef);
      expect(result.valid).toBe(true);
    });

    test('should allow optional data', () => {
      const testDef = {
        name: 'test',
        assertions: [
          {
            type: 'element',
            selector: 'div',
            property: 'textContent',
            operator: 'equals',
            expected: 'value'
          }
        ]
      };

      const result = validateTestDefinition(testDef);
      expect(result.valid).toBe(true);
    });
  });

  describe('validateAssertion()', () => {
    test('should validate valid element assertion', () => {
      const assertion = {
        type: 'element',
        selector: 'h2.title',
        property: 'textContent',
        operator: 'equals',
        expected: 'Hello'
      };

      const result = validateAssertion(assertion);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('should require type field', () => {
      const assertion = {
        selector: 'div',
        property: 'textContent',
        operator: 'equals',
        expected: 'value'
      };

      const result = validateAssertion(assertion);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Assertion type is required');
    });

    test('should require selector field', () => {
      const assertion = {
        type: 'element',
        property: 'textContent',
        operator: 'equals',
        expected: 'value'
      };

      const result = validateAssertion(assertion);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Selector is required');
    });

    test('should require property field', () => {
      const assertion = {
        type: 'element',
        selector: 'div',
        operator: 'equals',
        expected: 'value'
      };

      const result = validateAssertion(assertion);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Property is required');
    });

    test('should require operator field', () => {
      const assertion = {
        type: 'element',
        selector: 'div',
        property: 'textContent',
        expected: 'value'
      };

      const result = validateAssertion(assertion);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Operator is required');
    });

    test('should require expected field', () => {
      const assertion = {
        type: 'element',
        selector: 'div',
        property: 'textContent',
        operator: 'equals'
      };

      const result = validateAssertion(assertion);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Expected value is required');
    });

    test('should validate operator values', () => {
      const validOperators = ['equals', 'contains', 'matches', 'greaterThan', 'lessThan'];

      validOperators.forEach(operator => {
        const assertion = {
          type: 'element',
          selector: 'div',
          property: 'textContent',
          operator,
          expected: 'value'
        };

        const result = validateAssertion(assertion);
        expect(result.valid).toBe(true);
      });
    });

    test('should reject invalid operator', () => {
      const assertion = {
        type: 'element',
        selector: 'div',
        property: 'textContent',
        operator: 'invalidOperator',
        expected: 'value'
      };

      const result = validateAssertion(assertion);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid operator'))).toBe(true);
    });

    test('should accept nested property paths', () => {
      const assertion = {
        type: 'element',
        selector: 'div',
        property: 'style.color',
        operator: 'equals',
        expected: 'red'
      };

      const result = validateAssertion(assertion);
      expect(result.valid).toBe(true);
    });
  });

  describe('Multiple Errors', () => {
    test('should collect all validation errors', () => {
      const testDef = {
        // Missing name
        data: {},
        // Missing assertions
      };

      const result = validateTestDefinition(testDef);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
      expect(result.errors).toContain('Test name is required');
      expect(result.errors).toContain('Assertions array is required');
    });

    test('should collect all assertion errors', () => {
      const assertion = {
        // Missing type, selector, property, operator, expected
      };

      const result = validateAssertion(assertion);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(3);
    });
  });
});
