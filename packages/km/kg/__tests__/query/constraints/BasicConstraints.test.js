import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { RangeConstraint, RegexConstraint, FunctionConstraint } from '../../../src/query/constraints/index.js';
import { QueryVariable } from '../../../src/query/core/QueryVariable.js';

describe('Phase 2.1: Basic Constraints', () => {
  let rangeConstraint;
  let regexConstraint;
  let functionConstraint;
  
  beforeEach(() => {
    rangeConstraint = new RangeConstraint(0, 100);
    regexConstraint = new RegexConstraint('^[A-Z][a-z]+$');
    functionConstraint = new FunctionConstraint(x => x % 2 === 0, 'Must be even number');
  });
  
  afterEach(() => {
    // Cleanup
  });
  
  test('Step 2.1.1: Test RangeConstraint with numeric values', () => {
    // Test basic range constraint creation
    expect(rangeConstraint).toBeDefined();
    expect(rangeConstraint).toBeInstanceOf(RangeConstraint);
    expect(rangeConstraint.minValue).toBe(0);
    expect(rangeConstraint.maxValue).toBe(100);
    expect(rangeConstraint.getId()).toMatch(/^constraint_[a-z0-9]+$/);
    
    // Test range validation - valid values
    expect(rangeConstraint.evaluate(0)).toBe(true);
    expect(rangeConstraint.evaluate(50)).toBe(true);
    expect(rangeConstraint.evaluate(100)).toBe(true);
    expect(rangeConstraint.evaluate(25.5)).toBe(true);
    
    // Test range validation - invalid values
    expect(rangeConstraint.evaluate(-1)).toBe(false);
    expect(rangeConstraint.evaluate(101)).toBe(false);
    expect(rangeConstraint.evaluate(-10)).toBe(false);
    expect(rangeConstraint.evaluate(200)).toBe(false);
    
    // Test edge cases
    expect(rangeConstraint.evaluate(0.0001)).toBe(true);
    expect(rangeConstraint.evaluate(99.9999)).toBe(true);
    
    // Test min-only constraint
    const minOnlyConstraint = new RangeConstraint(18, null);
    expect(minOnlyConstraint.evaluate(18)).toBe(true);
    expect(minOnlyConstraint.evaluate(100)).toBe(true);
    expect(minOnlyConstraint.evaluate(17)).toBe(false);
    
    // Test max-only constraint
    const maxOnlyConstraint = new RangeConstraint(null, 65);
    expect(maxOnlyConstraint.evaluate(65)).toBe(true);
    expect(maxOnlyConstraint.evaluate(0)).toBe(true);
    expect(maxOnlyConstraint.evaluate(66)).toBe(false);
    
    // Test error messages
    expect(rangeConstraint.getErrorMessage(-5)).toContain('range');
    expect(rangeConstraint.getErrorMessage(105)).toContain('range');
  });
  
  test('Step 2.1.2: Test RegexConstraint with string patterns', () => {
    // Test basic regex constraint creation
    expect(regexConstraint).toBeDefined();
    expect(regexConstraint).toBeInstanceOf(RegexConstraint);
    expect(regexConstraint.pattern).toBe('^[A-Z][a-z]+$');
    expect(regexConstraint.getId()).toMatch(/^constraint_[a-z0-9]+$/);
    
    // Test regex validation - valid values
    expect(regexConstraint.evaluate('John')).toBe(true);
    expect(regexConstraint.evaluate('Alice')).toBe(true);
    expect(regexConstraint.evaluate('Bob')).toBe(true);
    expect(regexConstraint.evaluate('Mary')).toBe(true);
    
    // Test regex validation - invalid values
    expect(regexConstraint.evaluate('john')).toBe(false); // lowercase first
    expect(regexConstraint.evaluate('JOHN')).toBe(false); // all uppercase
    expect(regexConstraint.evaluate('John123')).toBe(false); // contains numbers
    expect(regexConstraint.evaluate('J')).toBe(false); // too short
    expect(regexConstraint.evaluate('')).toBe(false); // empty string
    expect(regexConstraint.evaluate('John Smith')).toBe(false); // contains space
    
    // Test different regex patterns
    const emailRegex = new RegexConstraint('^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$');
    expect(emailRegex.evaluate('user@example.com')).toBe(true);
    expect(emailRegex.evaluate('test.email+tag@domain.co.uk')).toBe(true);
    expect(emailRegex.evaluate('invalid-email')).toBe(false);
    expect(emailRegex.evaluate('user@')).toBe(false);
    
    const phoneRegex = new RegexConstraint('^\\+?[1-9]\\d{1,14}$');
    expect(phoneRegex.evaluate('+1234567890')).toBe(true);
    expect(phoneRegex.evaluate('1234567890')).toBe(true);
    expect(phoneRegex.evaluate('+44123456789')).toBe(true);
    expect(phoneRegex.evaluate('abc123')).toBe(false);
    expect(phoneRegex.evaluate('+0123456789')).toBe(false); // starts with 0
    
    // Test case sensitivity flags
    const caseInsensitiveRegex = new RegexConstraint('^hello$', 'i');
    expect(caseInsensitiveRegex.evaluate('hello')).toBe(true);
    expect(caseInsensitiveRegex.evaluate('Hello')).toBe(true);
    expect(caseInsensitiveRegex.evaluate('HELLO')).toBe(true);
    expect(caseInsensitiveRegex.evaluate('world')).toBe(false);
    
    // Test error messages
    expect(regexConstraint.getErrorMessage('john')).toContain('pattern');
  });
  
  test('Step 2.1.3: Test FunctionConstraint with custom predicates', () => {
    // Test basic function constraint creation
    expect(functionConstraint).toBeDefined();
    expect(functionConstraint).toBeInstanceOf(FunctionConstraint);
    expect(functionConstraint.description).toBe('Must be even number');
    expect(functionConstraint.getId()).toMatch(/^constraint_[a-z0-9]+$/);
    
    // Test function validation - valid values
    expect(functionConstraint.evaluate(0)).toBe(true);
    expect(functionConstraint.evaluate(2)).toBe(true);
    expect(functionConstraint.evaluate(100)).toBe(true);
    expect(functionConstraint.evaluate(-4)).toBe(true);
    
    // Test function validation - invalid values
    expect(functionConstraint.evaluate(1)).toBe(false);
    expect(functionConstraint.evaluate(3)).toBe(false);
    expect(functionConstraint.evaluate(99)).toBe(false);
    expect(functionConstraint.evaluate(-3)).toBe(false);
    
    // Test complex function constraints
    const primeConstraint = new FunctionConstraint(
      n => {
        if (n < 2) return false;
        for (let i = 2; i <= Math.sqrt(n); i++) {
          if (n % i === 0) return false;
        }
        return true;
      },
      'Must be a prime number'
    );
    
    expect(primeConstraint.evaluate(2)).toBe(true);
    expect(primeConstraint.evaluate(3)).toBe(true);
    expect(primeConstraint.evaluate(5)).toBe(true);
    expect(primeConstraint.evaluate(7)).toBe(true);
    expect(primeConstraint.evaluate(11)).toBe(true);
    expect(primeConstraint.evaluate(4)).toBe(false);
    expect(primeConstraint.evaluate(6)).toBe(false);
    expect(primeConstraint.evaluate(8)).toBe(false);
    expect(primeConstraint.evaluate(9)).toBe(false);
    expect(primeConstraint.evaluate(1)).toBe(false);
    
    // Test string validation functions
    const lengthConstraint = new FunctionConstraint(
      s => typeof s === 'string' && s.length >= 3 && s.length <= 20,
      'String must be between 3 and 20 characters'
    );
    
    expect(lengthConstraint.evaluate('abc')).toBe(true);
    expect(lengthConstraint.evaluate('hello world')).toBe(true);
    expect(lengthConstraint.evaluate('a very long string here')).toBe(false);
    expect(lengthConstraint.evaluate('ab')).toBe(false);
    expect(lengthConstraint.evaluate(123)).toBe(false);
    
    // Test context-aware functions
    const contextConstraint = new FunctionConstraint(
      (value, context) => {
        const threshold = context.threshold || 50;
        return value > threshold;
      },
      'Value must exceed threshold'
    );
    
    expect(contextConstraint.evaluate(60, { threshold: 50 })).toBe(true);
    expect(contextConstraint.evaluate(40, { threshold: 50 })).toBe(false);
    expect(contextConstraint.evaluate(60, {})).toBe(true); // uses default threshold
    expect(contextConstraint.evaluate(40, {})).toBe(false);
    
    // Test error messages
    expect(functionConstraint.getErrorMessage(3)).toBe('Must be even number');
    expect(primeConstraint.getErrorMessage(4)).toBe('Must be a prime number');
  });
  
  test('Step 2.1.4: Test constraint evaluation with valid/invalid values', () => {
    // Test comprehensive validation scenarios
    const constraints = [rangeConstraint, regexConstraint, functionConstraint];
    
    // Test each constraint type with appropriate values
    const testCases = [
      { constraint: rangeConstraint, validValues: [0, 50, 100], invalidValues: [-1, 101] },
      { constraint: regexConstraint, validValues: ['John', 'Alice'], invalidValues: ['john', 'JOHN'] },
      { constraint: functionConstraint, validValues: [0, 2, 100], invalidValues: [1, 3, 99] }
    ];
    
    testCases.forEach(({ constraint, validValues, invalidValues }) => {
      validValues.forEach(value => {
        expect(constraint.evaluate(value)).toBe(true);
      });
      
      invalidValues.forEach(value => {
        expect(constraint.evaluate(value)).toBe(false);
      });
    });
    
    // Test constraint with null/undefined values
    constraints.forEach(constraint => {
      expect(constraint.evaluate(null)).toBe(false);
      expect(constraint.evaluate(undefined)).toBe(false);
    });
    
    // Test constraint with edge case values
    expect(rangeConstraint.evaluate(Number.POSITIVE_INFINITY)).toBe(false);
    expect(rangeConstraint.evaluate(Number.NEGATIVE_INFINITY)).toBe(false);
    expect(rangeConstraint.evaluate(NaN)).toBe(false);
    
    expect(regexConstraint.evaluate(123)).toBe(false); // non-string
    expect(regexConstraint.evaluate({})).toBe(false); // object
    expect(regexConstraint.evaluate([])).toBe(false); // array
    
    // Test performance with large datasets
    const largeDataset = Array.from({ length: 1000 }, (_, i) => i);
    const start = Date.now();
    largeDataset.forEach(value => rangeConstraint.evaluate(value));
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(100); // Should complete in under 100ms
  });
  
  test('Step 2.1.5: Test constraint serialization to triples', () => {
    // Test RangeConstraint serialization
    const rangeTriples = rangeConstraint.toTriples();
    expect(Array.isArray(rangeTriples)).toBe(true);
    expect(rangeTriples.length).toBeGreaterThan(0);
    
    const rangeId = rangeConstraint.getId();
    const rangeTypeTriple = rangeTriples.find(([s, p, o]) => 
      s === rangeId && p === 'rdf:type' && o === 'kg:RangeConstraint'
    );
    expect(rangeTypeTriple).toBeDefined();
    
    const minValueTriple = rangeTriples.find(([s, p, o]) => 
      s === rangeId && p === 'kg:minValue' && o === 0
    );
    expect(minValueTriple).toBeDefined();
    
    const maxValueTriple = rangeTriples.find(([s, p, o]) => 
      s === rangeId && p === 'kg:maxValue' && o === 100
    );
    expect(maxValueTriple).toBeDefined();
    
    // Test RegexConstraint serialization
    const regexTriples = regexConstraint.toTriples();
    expect(Array.isArray(regexTriples)).toBe(true);
    expect(regexTriples.length).toBeGreaterThan(0);
    
    const regexId = regexConstraint.getId();
    const regexTypeTriple = regexTriples.find(([s, p, o]) => 
      s === regexId && p === 'rdf:type' && o === 'kg:RegexConstraint'
    );
    expect(regexTypeTriple).toBeDefined();
    
    const patternTriple = regexTriples.find(([s, p, o]) => 
      s === regexId && p === 'kg:pattern' && o === '^[A-Z][a-z]+$'
    );
    expect(patternTriple).toBeDefined();
    
    // Test FunctionConstraint serialization
    const functionTriples = functionConstraint.toTriples();
    expect(Array.isArray(functionTriples)).toBe(true);
    expect(functionTriples.length).toBeGreaterThan(0);
    
    const functionId = functionConstraint.getId();
    const functionTypeTriple = functionTriples.find(([s, p, o]) => 
      s === functionId && p === 'rdf:type' && o === 'kg:FunctionConstraint'
    );
    expect(functionTypeTriple).toBeDefined();
    
    const descriptionTriple = functionTriples.find(([s, p, o]) => 
      s === functionId && p === 'kg:description' && o === 'Must be even number'
    );
    expect(descriptionTriple).toBeDefined();
    
    const functionBodyTriple = functionTriples.find(([s, p, o]) => 
      s === functionId && p === 'kg:functionBody'
    );
    expect(functionBodyTriple).toBeDefined();
    expect(functionBodyTriple[2]).toContain('x % 2 === 0');
    
    // Test serialization round-trip integrity
    const allConstraints = [rangeConstraint, regexConstraint, functionConstraint];
    allConstraints.forEach(constraint => {
      const triples = constraint.toTriples();
      expect(triples.length).toBeGreaterThan(0);
      
      // Verify all triples have the constraint ID as subject
      const constraintTriples = triples.filter(([s]) => s === constraint.getId());
      expect(constraintTriples.length).toBeGreaterThan(0);
      
      // Verify type triple exists
      const typeTriple = triples.find(([s, p, o]) => 
        s === constraint.getId() && p === 'rdf:type'
      );
      expect(typeTriple).toBeDefined();
    });
  });
});
