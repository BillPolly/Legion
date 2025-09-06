import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { QueryVariable, VariableBinding } from '../../../src/query/core/QueryVariable.js';
import { RangeConstraint, RegexConstraint, FunctionConstraint } from '../../../src/query/constraints/index.js';

describe('Phase 1.2: Query Variables and Bindings', () => {
  let variable;
  let binding;
  
  beforeEach(() => {
    variable = new QueryVariable('testVar');
    binding = new VariableBinding();
  });
  
  afterEach(() => {
    // Cleanup
  });
  
  test('Step 1.2.1: Test QueryVariable creation and constraint attachment', () => {
    // Test basic variable creation
    expect(variable).toBeDefined();
    expect(variable).toBeInstanceOf(QueryVariable);
    expect(variable.name).toBe('testVar');
    expect(variable.getId()).toMatch(/^var_testVar_[a-z0-9]+$/);
    
    // Test variable with type
    const typedVar = new QueryVariable('person', 'Person');
    expect(typedVar.name).toBe('person');
    expect(typedVar.type).toBe('Person');
    
    // Test constraint attachment
    const rangeConstraint = new RangeConstraint(18, 65);
    variable.addConstraint(rangeConstraint);
    
    expect(variable.constraints).toHaveLength(1);
    expect(variable.constraints[0]).toBe(rangeConstraint);
    
    // Test multiple constraints
    const regexConstraint = new RegexConstraint('^[A-Z]');
    variable.addConstraint(regexConstraint);
    
    expect(variable.constraints).toHaveLength(2);
    expect(variable.constraints[1]).toBe(regexConstraint);
    
    // Test method chaining
    const result = variable.addConstraint(new FunctionConstraint(x => x > 0));
    expect(result).toBe(variable);
    expect(variable.constraints).toHaveLength(3);
  });
  
  test('Step 1.2.2: Test VariableBinding creation and value assignment', () => {
    // Test basic binding creation
    expect(binding).toBeDefined();
    expect(binding).toBeInstanceOf(VariableBinding);
    expect(binding.size()).toBe(0);
    expect(binding.isEmpty()).toBe(true);
    
    // Test value binding
    binding.bind('name', 'John');
    binding.bind('age', 30);
    binding.bind('active', true);
    
    expect(binding.size()).toBe(3);
    expect(binding.isEmpty()).toBe(false);
    expect(binding.get('name')).toBe('John');
    expect(binding.get('age')).toBe(30);
    expect(binding.get('active')).toBe(true);
    expect(binding.get('nonexistent')).toBeUndefined();
    
    // Test binding existence check
    expect(binding.has('name')).toBe(true);
    expect(binding.has('nonexistent')).toBe(false);
    
    // Test variable names retrieval
    const varNames = binding.getVariableNames();
    expect(varNames).toContain('name');
    expect(varNames).toContain('age');
    expect(varNames).toContain('active');
    expect(varNames).toHaveLength(3);
  });
  
  test('Step 1.2.3: Test variable type validation and constraint enforcement', () => {
    // Test type validation
    const typedVar = new QueryVariable('count', 'number');
    expect(typedVar.validateType(42)).toBe(true);
    expect(typedVar.validateType('string')).toBe(false);
    expect(typedVar.validateType(null)).toBe(false);
    
    // Test constraint enforcement
    const constrainedVar = new QueryVariable('age');
    constrainedVar.addConstraint(new RangeConstraint(0, 120));
    constrainedVar.addConstraint(new FunctionConstraint(x => Number.isInteger(x)));
    
    expect(constrainedVar.validateValue(25)).toBe(true);
    expect(constrainedVar.validateValue(150)).toBe(false); // Out of range
    expect(constrainedVar.validateValue(25.5)).toBe(false); // Not integer
    expect(constrainedVar.validateValue(-5)).toBe(false); // Out of range
    
    // Test string constraints
    const nameVar = new QueryVariable('name', 'string');
    nameVar.addConstraint(new RegexConstraint('^[A-Z][a-z]+$'));
    
    expect(nameVar.validateValue('John')).toBe(true);
    expect(nameVar.validateValue('john')).toBe(false); // Doesn't match regex
    expect(nameVar.validateValue('JOHN')).toBe(false); // Doesn't match regex
    expect(nameVar.validateValue(123)).toBe(false); // Wrong type
  });
  
  test('Step 1.2.4: Test cross-pattern variable sharing', () => {
    // Test variable equality and sharing
    const var1 = new QueryVariable('person');
    const var2 = new QueryVariable('person');
    const var3 = new QueryVariable('company');
    
    // Variables with same name should be considered equal for sharing
    expect(var1.name).toBe(var2.name);
    expect(var1.name).not.toBe(var3.name);
    
    // Test binding compatibility
    const binding1 = new VariableBinding();
    binding1.bind('person', 'john_123');
    binding1.bind('age', 30);
    
    const binding2 = new VariableBinding();
    binding2.bind('person', 'john_123'); // Same value
    binding2.bind('company', 'acme_corp');
    
    // Test binding merging
    const merged = VariableBinding.merge(binding1, binding2);
    expect(merged.get('person')).toBe('john_123');
    expect(merged.get('age')).toBe(30);
    expect(merged.get('company')).toBe('acme_corp');
    expect(merged.size()).toBe(3);
    
    // Test conflicting bindings
    const binding3 = new VariableBinding();
    binding3.bind('person', 'jane_456'); // Different value
    
    expect(() => VariableBinding.merge(binding1, binding3))
      .toThrow('Variable binding conflict');
  });
  
  test('Step 1.2.5: Test variable serialization to triples', () => {
    // Test variable serialization
    const var1 = new QueryVariable('person', 'Person');
    var1.addConstraint(new RangeConstraint(18, 65));
    var1.addConstraint(new RegexConstraint('^[A-Z]'));
    
    const triples = var1.toTriples();
    expect(Array.isArray(triples)).toBe(true);
    expect(triples.length).toBeGreaterThan(0);
    
    const varId = var1.getId();
    
    // Check core variable triples
    const typeTriple = triples.find(([s, p, o]) => 
      s === varId && p === 'rdf:type' && o === 'kg:QueryVariable'
    );
    expect(typeTriple).toBeDefined();
    
    const nameTriple = triples.find(([s, p, o]) => 
      s === varId && p === 'kg:variableName' && o === 'person'
    );
    expect(nameTriple).toBeDefined();
    
    const typeConstraintTriple = triples.find(([s, p, o]) => 
      s === varId && p === 'kg:variableType' && o === 'Person'
    );
    expect(typeConstraintTriple).toBeDefined();
    
    // Check constraint triples
    const constraintTriples = triples.filter(([s, p, o]) => 
      s === varId && p === 'kg:hasConstraint'
    );
    expect(constraintTriples).toHaveLength(2);
    
    // Test binding serialization
    const binding = new VariableBinding();
    binding.bind('person', 'john_123');
    binding.bind('age', 30);
    
    const bindingTriples = binding.toTriples();
    expect(Array.isArray(bindingTriples)).toBe(true);
    expect(bindingTriples.length).toBeGreaterThan(0);
    
    const bindingId = binding.getId();
    
    const bindingTypeTriple = bindingTriples.find(([s, p, o]) => 
      s === bindingId && p === 'rdf:type' && o === 'kg:VariableBinding'
    );
    expect(bindingTypeTriple).toBeDefined();
    
    // Check individual binding triples
    const personBindingTriple = bindingTriples.find(([s, p, o]) => 
      p === 'kg:bindsVariable' && o === 'person'
    );
    expect(personBindingTriple).toBeDefined();
  });
  
  test('Step 1.2.6: Test variable binding operations', () => {
    // Test binding operations
    const binding = new VariableBinding();
    
    // Test fluent interface
    const result = binding
      .bind('name', 'John')
      .bind('age', 30)
      .bind('active', true);
    
    expect(result).toBe(binding);
    expect(binding.size()).toBe(3);
    
    // Test unbinding
    binding.unbind('active');
    expect(binding.has('active')).toBe(false);
    expect(binding.size()).toBe(2);
    
    // Test clear
    binding.clear();
    expect(binding.isEmpty()).toBe(true);
    expect(binding.size()).toBe(0);
    
    // Test iteration
    binding.bind('a', 1).bind('b', 2).bind('c', 3);
    
    const entries = [];
    binding.forEach((value, variable) => {
      entries.push([variable, value]);
    });
    
    expect(entries).toHaveLength(3);
    expect(entries).toContainEqual(['a', 1]);
    expect(entries).toContainEqual(['b', 2]);
    expect(entries).toContainEqual(['c', 3]);
  });
  
  test('Step 1.2.7: Test variable constraint evaluation', () => {
    // Test complex constraint scenarios
    const var1 = new QueryVariable('score');
    var1.addConstraint(new RangeConstraint(0, 100));
    var1.addConstraint(new FunctionConstraint(x => x % 5 === 0, 'Must be divisible by 5'));
    
    expect(var1.validateValue(85)).toBe(true);
    expect(var1.validateValue(87)).toBe(false); // Not divisible by 5
    expect(var1.validateValue(105)).toBe(false); // Out of range
    expect(var1.validateValue(-5)).toBe(false); // Out of range
    
    // Test constraint error messages
    const errors = var1.getValidationErrors(87);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('Must be divisible by 5');
    
    const rangeErrors = var1.getValidationErrors(105);
    expect(rangeErrors.length).toBeGreaterThan(0);
    expect(rangeErrors.some(err => err.includes('range'))).toBe(true);
  });
});
