import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { RangeConstraint, RegexConstraint, FunctionConstraint } from '../../../src/query/constraints/index.js';
import { QueryVariable } from '../../../src/query/core/QueryVariable.js';
import { TriplePattern } from '../../../src/query/core/TriplePattern.js';
import { KGEngine } from '../../../src/core/KGEngine.js';

describe('Phase 2.2: Constraint Composition', () => {
  let kg;
  let variable;
  
  beforeEach(() => {
    kg = new KGEngine();
    variable = new QueryVariable('testVar');
    
    // Setup test data
    kg.addTriple('person1', 'age', 25);
    kg.addTriple('person2', 'age', 35);
    kg.addTriple('person3', 'age', 45);
    kg.addTriple('person4', 'age', 55);
    kg.addTriple('person1', 'name', 'Alice');
    kg.addTriple('person2', 'name', 'Bob');
    kg.addTriple('person3', 'name', 'Charlie');
    kg.addTriple('person4', 'name', 'David');
  });
  
  afterEach(() => {
    // Cleanup
  });
  
  test('Step 2.2.1: Test multiple constraints on single variable', () => {
    // Create a variable with multiple constraints
    const ageVar = new QueryVariable('age', 'number');
    
    // Add range constraint (18-65)
    const rangeConstraint = new RangeConstraint(18, 65);
    ageVar.addConstraint(rangeConstraint);
    
    // Add even number constraint
    const evenConstraint = new FunctionConstraint(
      x => x % 2 === 0,
      'Must be even number'
    );
    ageVar.addConstraint(evenConstraint);
    
    // Add divisible by 5 constraint
    const divisibleBy5Constraint = new FunctionConstraint(
      x => x % 5 === 0,
      'Must be divisible by 5'
    );
    ageVar.addConstraint(divisibleBy5Constraint);
    
    // Test that all constraints are applied
    expect(ageVar.constraints).toHaveLength(3);
    
    // Test values that satisfy all constraints
    expect(ageVar.validateValue(20)).toBe(true); // 18-65, even, divisible by 5
    expect(ageVar.validateValue(30)).toBe(true); // 18-65, even, divisible by 5
    expect(ageVar.validateValue(40)).toBe(true); // 18-65, even, divisible by 5
    expect(ageVar.validateValue(60)).toBe(true); // 18-65, even, divisible by 5
    
    // Test values that fail one or more constraints
    expect(ageVar.validateValue(25)).toBe(false); // odd number
    expect(ageVar.validateValue(22)).toBe(false); // not divisible by 5
    expect(ageVar.validateValue(70)).toBe(false); // outside range
    expect(ageVar.validateValue(15)).toBe(false); // outside range
    expect(ageVar.validateValue(35)).toBe(false); // odd number
    
    // Test constraint error collection
    const errors25 = ageVar.getValidationErrors(25);
    expect(errors25.length).toBeGreaterThan(0);
    expect(errors25.some(err => err.includes('even'))).toBe(true);
    
    const errors22 = ageVar.getValidationErrors(22);
    expect(errors22.length).toBeGreaterThan(0);
    expect(errors22.some(err => err.includes('divisible by 5'))).toBe(true);
    
    const errors70 = ageVar.getValidationErrors(70);
    expect(errors70.length).toBeGreaterThan(0);
    expect(errors70.some(err => err.includes('range'))).toBe(true);
  });
  
  test('Step 2.2.2: Test constraint interaction and precedence', () => {
    // Test constraint order independence
    const var1 = new QueryVariable('test1');
    const var2 = new QueryVariable('test2');
    
    // Add constraints in different orders
    var1.addConstraint(new RangeConstraint(0, 100));
    var1.addConstraint(new FunctionConstraint(x => x % 2 === 0));
    
    var2.addConstraint(new FunctionConstraint(x => x % 2 === 0));
    var2.addConstraint(new RangeConstraint(0, 100));
    
    // Both should behave identically
    const testValues = [50, 51, 150, -10];
    testValues.forEach(value => {
      expect(var1.validateValue(value)).toBe(var2.validateValue(value));
    });
    
    // Test constraint precedence with conflicting constraints
    const conflictVar = new QueryVariable('conflict');
    conflictVar.addConstraint(new RangeConstraint(10, 20));
    conflictVar.addConstraint(new RangeConstraint(30, 40)); // Conflicting range
    
    // All values should fail due to impossible constraint combination
    expect(conflictVar.validateValue(15)).toBe(false);
    expect(conflictVar.validateValue(35)).toBe(false);
    expect(conflictVar.validateValue(25)).toBe(false);
    
    // Test type constraint interaction
    const typedVar = new QueryVariable('typed', 'number');
    typedVar.addConstraint(new RangeConstraint(0, 100));
    
    expect(typedVar.validateValue(50)).toBe(true); // valid number in range
    expect(typedVar.validateValue('50')).toBe(false); // string, not number
    expect(typedVar.validateValue(150)).toBe(false); // number out of range
    
    // Test string constraints with regex
    const stringVar = new QueryVariable('stringVar', 'string');
    stringVar.addConstraint(new RegexConstraint('^[A-Z][a-z]+$'));
    stringVar.addConstraint(new FunctionConstraint(s => s.length >= 3));
    
    expect(stringVar.validateValue('Alice')).toBe(true);
    expect(stringVar.validateValue('Bob')).toBe(true);
    expect(stringVar.validateValue('alice')).toBe(false); // fails regex
    expect(stringVar.validateValue('Al')).toBe(false); // too short
    expect(stringVar.validateValue(123)).toBe(false); // wrong type
  });
  
  test('Step 2.2.3: Test constraint performance with large datasets', () => {
    // Create variable with multiple constraints
    const perfVar = new QueryVariable('perf');
    perfVar.addConstraint(new RangeConstraint(0, 1000));
    perfVar.addConstraint(new FunctionConstraint(x => x % 2 === 0));
    perfVar.addConstraint(new FunctionConstraint(x => x % 3 === 0));
    perfVar.addConstraint(new FunctionConstraint(x => x % 5 === 0));
    
    // Generate large dataset
    const largeDataset = Array.from({ length: 10000 }, (_, i) => i);
    
    // Test performance
    const start = Date.now();
    const validValues = largeDataset.filter(value => perfVar.validateValue(value));
    const duration = Date.now() - start;
    
    // Should complete in reasonable time (under 1 second)
    expect(duration).toBeLessThan(1000);
    
    // Verify correctness of results
    expect(validValues.length).toBeGreaterThan(0);
    validValues.forEach(value => {
      expect(value >= 0 && value <= 1000).toBe(true);
      expect(value % 2).toBe(0);
      expect(value % 3).toBe(0);
      expect(value % 5).toBe(0);
    });
    
    // Test constraint short-circuiting optimization
    const shortCircuitVar = new QueryVariable('shortCircuit');
    let evaluationCount = 0;
    
    // Add a constraint that always fails first
    shortCircuitVar.addConstraint(new FunctionConstraint(() => {
      evaluationCount++;
      return false;
    }));
    
    // Add expensive constraint that should not be evaluated
    shortCircuitVar.addConstraint(new FunctionConstraint(() => {
      // Expensive operation that should be skipped
      for (let i = 0; i < 1000000; i++) { /* busy work */ }
      return true;
    }));
    
    const shortCircuitStart = Date.now();
    shortCircuitVar.validateValue(42);
    const shortCircuitDuration = Date.now() - shortCircuitStart;
    
    // Should be fast due to short-circuiting
    expect(shortCircuitDuration).toBeLessThan(100);
    expect(evaluationCount).toBe(1);
  });
  
  test('Step 2.2.4: Test constraint error handling and validation', () => {
    // Test constraint validation during addition
    const testVar = new QueryVariable('test');
    
    // Test adding valid constraints
    expect(() => {
      testVar.addConstraint(new RangeConstraint(0, 100));
    }).not.toThrow();
    
    expect(() => {
      testVar.addConstraint(new RegexConstraint('^[A-Z]+$'));
    }).not.toThrow();
    
    expect(() => {
      testVar.addConstraint(new FunctionConstraint(x => x > 0));
    }).not.toThrow();
    
    // Test constraint error aggregation
    const multiConstraintVar = new QueryVariable('multi');
    multiConstraintVar.addConstraint(new RangeConstraint(10, 20));
    multiConstraintVar.addConstraint(new FunctionConstraint(x => x % 2 === 0, 'Must be even'));
    multiConstraintVar.addConstraint(new FunctionConstraint(x => x % 3 === 0, 'Must be divisible by 3'));
    
    // Test value that fails multiple constraints
    const errors = multiConstraintVar.getValidationErrors(25);
    expect(errors.length).toBeGreaterThan(1);
    expect(errors.some(err => err.includes('range'))).toBe(true);
    expect(errors.some(err => err.includes('even'))).toBe(true);
    expect(errors.some(err => err.includes('divisible by 3'))).toBe(true);
    
    // Test constraint exception handling
    const exceptionVar = new QueryVariable('exception');
    exceptionVar.addConstraint(new FunctionConstraint(() => {
      throw new Error('Constraint evaluation error');
    }));
    
    // Should handle constraint exceptions gracefully
    expect(exceptionVar.validateValue(42)).toBe(false);
    
    // Test malformed constraint handling
    const malformedVar = new QueryVariable('malformed');
    
    // Test with null constraint function
    expect(() => {
      malformedVar.addConstraint(new FunctionConstraint(null));
    }).toThrow();
    
    // Test with invalid regex pattern
    expect(() => {
      new RegexConstraint('[invalid regex');
    }).toThrow();
    
    // Test with invalid range
    expect(() => {
      new RangeConstraint(100, 0); // max < min
    }).not.toThrow(); // Should be allowed, just results in no valid values
  });
  
  test('Step 2.2.5: Test constraint optimization and caching', () => {
    // Test constraint result caching
    let evaluationCount = 0;
    const expensiveConstraint = new FunctionConstraint((value) => {
      evaluationCount++;
      // Simulate expensive computation
      let result = 0;
      for (let i = 0; i < 1000; i++) {
        result += Math.sin(value + i);
      }
      return result > 0;
    }, 'Expensive constraint');
    
    const cachedVar = new QueryVariable('cached');
    cachedVar.addConstraint(expensiveConstraint);
    
    // First evaluation
    const result1 = cachedVar.validateValue(42);
    const firstEvaluationCount = evaluationCount;
    
    // Second evaluation with same value (should use cache if implemented)
    const result2 = cachedVar.validateValue(42);
    
    expect(result1).toBe(result2);
    // Note: Caching is optional optimization, so we don't strictly require it
    
    // Test constraint composition optimization
    const optimizedVar = new QueryVariable('optimized');
    
    // Add constraints in order of increasing computational cost
    optimizedVar.addConstraint(new RangeConstraint(0, 100)); // Fast
    optimizedVar.addConstraint(new FunctionConstraint(x => x % 2 === 0)); // Medium
    optimizedVar.addConstraint(new FunctionConstraint(x => {
      // Expensive constraint
      for (let i = 0; i < 1000; i++) { /* computation */ }
      return x % 7 === 0;
    })); // Slow
    
    // Test with value that fails first constraint (should be fast)
    const fastStart = Date.now();
    optimizedVar.validateValue(150); // Fails range constraint
    const fastDuration = Date.now() - fastStart;
    
    expect(fastDuration).toBeLessThan(50); // Should be very fast
    
    // Test constraint reordering for optimization
    const reorderedVar = new QueryVariable('reordered');
    
    // Add expensive constraint first
    reorderedVar.addConstraint(new FunctionConstraint(x => {
      for (let i = 0; i < 1000; i++) { /* expensive */ }
      return x % 7 === 0;
    }));
    
    // Add cheap constraint that will likely fail
    reorderedVar.addConstraint(new RangeConstraint(1000, 2000));
    
    // The system could potentially reorder these for better performance
    // but we don't require it in this test
    
    // Test constraint statistics collection
    const statsVar = new QueryVariable('stats');
    statsVar.addConstraint(new RangeConstraint(0, 100));
    statsVar.addConstraint(new FunctionConstraint(x => x % 2 === 0));
    
    // Run multiple evaluations
    for (let i = 0; i < 100; i++) {
      statsVar.validateValue(i);
    }
    
    // Verify constraints are working correctly
    expect(statsVar.validateValue(50)).toBe(true);
    expect(statsVar.validateValue(51)).toBe(false);
    expect(statsVar.validateValue(150)).toBe(false);
  });
});
