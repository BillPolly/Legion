import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { TriplePattern } from '../../../src/query/core/TriplePattern.js';
import { QueryVariable } from '../../../src/query/core/QueryVariable.js';
import { RangeConstraint, RegexConstraint } from '../../../src/query/constraints/index.js';
import { KGEngine } from '../../../src/core/KGEngine.js';

describe('Phase 1.3: Triple Pattern System', () => {
  let kg;
  let pattern;
  
  beforeEach(() => {
    kg = new KGEngine();
    // Setup some test data
    kg.addTriple('john', 'rdf:type', 'Person');
    kg.addTriple('john', 'name', 'John Smith');
    kg.addTriple('john', 'age', 30);
    kg.addTriple('jane', 'rdf:type', 'Person');
    kg.addTriple('jane', 'name', 'Jane Doe');
    kg.addTriple('jane', 'age', 25);
    kg.addTriple('acme', 'rdf:type', 'Company');
    kg.addTriple('john', 'worksAt', 'acme');
  });
  
  afterEach(() => {
    // Cleanup
  });
  
  test('Step 1.3.1: Test TriplePattern creation with mixed variables and constants', () => {
    // Test pattern with variable subject
    const pattern1 = new TriplePattern('?person', 'rdf:type', 'Person');
    expect(pattern1).toBeDefined();
    expect(pattern1.subject).toBeInstanceOf(QueryVariable);
    expect(pattern1.subject.name).toBe('person');
    expect(pattern1.predicate).toBe('rdf:type');
    expect(pattern1.object).toBe('Person');
    expect(pattern1.getId()).toMatch(/^pattern_[a-z0-9]+$/);
    
    // Test pattern with variable predicate
    const pattern2 = new TriplePattern('john', '?property', '?value');
    expect(pattern2.subject).toBe('john');
    expect(pattern2.predicate).toBeInstanceOf(QueryVariable);
    expect(pattern2.predicate.name).toBe('property');
    expect(pattern2.object).toBeInstanceOf(QueryVariable);
    expect(pattern2.object.name).toBe('value');
    
    // Test pattern with all variables
    const pattern3 = new TriplePattern('?s', '?p', '?o');
    expect(pattern3.subject).toBeInstanceOf(QueryVariable);
    expect(pattern3.subject.name).toBe('s');
    expect(pattern3.predicate).toBeInstanceOf(QueryVariable);
    expect(pattern3.predicate.name).toBe('p');
    expect(pattern3.object).toBeInstanceOf(QueryVariable);
    expect(pattern3.object.name).toBe('o');
    
    // Test pattern with all constants
    const pattern4 = new TriplePattern('john', 'name', 'John Smith');
    expect(pattern4.subject).toBe('john');
    expect(pattern4.predicate).toBe('name');
    expect(pattern4.object).toBe('John Smith');
    
    // Test pattern with QueryVariable objects
    const personVar = new QueryVariable('person', 'Person');
    const pattern5 = new TriplePattern(personVar, 'rdf:type', 'Person');
    expect(pattern5.subject).toBe(personVar);
    expect(pattern5.predicate).toBe('rdf:type');
    expect(pattern5.object).toBe('Person');
  });
  
  test('Step 1.3.2: Test pattern variable extraction', () => {
    // Test variable extraction from mixed pattern
    const pattern = new TriplePattern('?person', 'name', '?name');
    const variables = pattern.getVariables();
    
    expect(variables).toHaveLength(2);
    expect(variables.map(v => v.name)).toContain('person');
    expect(variables.map(v => v.name)).toContain('name');
    
    // Test pattern with no variables
    const constantPattern = new TriplePattern('john', 'name', 'John Smith');
    const noVars = constantPattern.getVariables();
    expect(noVars).toHaveLength(0);
    
    // Test pattern with all variables
    const allVarPattern = new TriplePattern('?s', '?p', '?o');
    const allVars = allVarPattern.getVariables();
    expect(allVars).toHaveLength(3);
    expect(allVars.map(v => v.name)).toContain('s');
    expect(allVars.map(v => v.name)).toContain('p');
    expect(allVars.map(v => v.name)).toContain('o');
    
    // Test variable name extraction
    const varNames = pattern.getVariableNames();
    expect(varNames).toContain('person');
    expect(varNames).toContain('name');
    expect(varNames).toHaveLength(2);
  });
  
  test('Step 1.3.3: Test pattern constraint attachment', () => {
    // Create pattern with variable
    const pattern = new TriplePattern('?person', 'age', '?age');
    const ageVar = pattern.getVariables().find(v => v.name === 'age');
    
    // Add constraints to the age variable
    const rangeConstraint = new RangeConstraint(18, 65);
    ageVar.addConstraint(rangeConstraint);
    
    expect(ageVar.constraints).toHaveLength(1);
    expect(ageVar.constraints[0]).toBe(rangeConstraint);
    
    // Test constraint evaluation
    expect(ageVar.validateValue(30)).toBe(true);
    expect(ageVar.validateValue(10)).toBe(false);
    expect(ageVar.validateValue(70)).toBe(false);
    
    // Add multiple constraints
    const personVar = pattern.getVariables().find(v => v.name === 'person');
    const regexConstraint = new RegexConstraint('^[a-z]+$');
    personVar.addConstraint(regexConstraint);
    
    expect(personVar.constraints).toHaveLength(1);
    expect(personVar.validateValue('john')).toBe(true);
    expect(personVar.validateValue('John')).toBe(false);
    
    // Test pattern constraint retrieval
    const allConstraints = pattern.getAllConstraints();
    expect(allConstraints).toHaveLength(2);
  });
  
  test('Step 1.3.4: Test pattern serialization to triples', () => {
    // Create pattern with variables and constraints
    const pattern = new TriplePattern('?person', 'age', '?age');
    const ageVar = pattern.getVariables().find(v => v.name === 'age');
    ageVar.addConstraint(new RangeConstraint(0, 120));
    
    // Test serialization
    const triples = pattern.toTriples();
    expect(Array.isArray(triples)).toBe(true);
    expect(triples.length).toBeGreaterThan(0);
    
    const patternId = pattern.getId();
    
    // Check core pattern triples
    const typeTriple = triples.find(([s, p, o]) => 
      s === patternId && p === 'rdf:type' && o === 'kg:TriplePattern'
    );
    expect(typeTriple).toBeDefined();
    
    const subjectTriple = triples.find(([s, p, o]) => 
      s === patternId && p === 'kg:subject' && o === 'person'
    );
    expect(subjectTriple).toBeDefined();
    
    const predicateTriple = triples.find(([s, p, o]) => 
      s === patternId && p === 'kg:predicate' && o === 'age'
    );
    expect(predicateTriple).toBeDefined();
    
    const objectTriple = triples.find(([s, p, o]) => 
      s === patternId && p === 'kg:object' && o === 'age'
    );
    expect(objectTriple).toBeDefined();
    
    // Check variable triples are included
    const variableTriples = triples.filter(([s, p, o]) => 
      s === patternId && p === 'kg:hasVariable'
    );
    expect(variableTriples.length).toBeGreaterThan(0);
    
    // Check constraint triples are included
    const constraintTriples = triples.filter(([s, p, o]) => 
      p === 'kg:hasConstraint'
    );
    expect(constraintTriples.length).toBeGreaterThan(0);
  });
  
  test('Step 1.3.5: Test pattern matching against knowledge graph', () => {
    // Test exact match pattern
    const exactPattern = new TriplePattern('john', 'name', 'John Smith');
    const exactMatches = exactPattern.match(kg);
    expect(exactMatches).toHaveLength(1);
    expect(exactMatches[0].bindings.size()).toBe(0); // No variables to bind
    
    // Test pattern with one variable
    const oneVarPattern = new TriplePattern('?person', 'rdf:type', 'Person');
    const oneVarMatches = oneVarPattern.match(kg);
    expect(oneVarMatches.length).toBeGreaterThan(0);
    
    const johnMatch = oneVarMatches.find(match => 
      match.bindings.get('person') === 'john'
    );
    expect(johnMatch).toBeDefined();
    expect(johnMatch.bindings.get('person')).toBe('john');
    
    const janeMatch = oneVarMatches.find(match => 
      match.bindings.get('person') === 'jane'
    );
    expect(janeMatch).toBeDefined();
    expect(janeMatch.bindings.get('person')).toBe('jane');
    
    // Test pattern with multiple variables
    const multiVarPattern = new TriplePattern('?person', '?property', '?value');
    const multiVarMatches = multiVarPattern.match(kg);
    expect(multiVarMatches.length).toBeGreaterThan(0);
    
    // Check that all bindings are complete
    multiVarMatches.forEach(match => {
      expect(match.bindings.has('person')).toBe(true);
      expect(match.bindings.has('property')).toBe(true);
      expect(match.bindings.has('value')).toBe(true);
    });
    
    // Test pattern with constraints
    const constrainedPattern = new TriplePattern('?person', 'age', '?age');
    const ageVar = constrainedPattern.getVariables().find(v => v.name === 'age');
    ageVar.addConstraint(new RangeConstraint(20, 35));
    
    const constrainedMatches = constrainedPattern.match(kg);
    expect(constrainedMatches.length).toBeGreaterThan(0);
    
    // All matches should satisfy the constraint
    constrainedMatches.forEach(match => {
      const age = match.bindings.get('age');
      expect(age).toBeGreaterThanOrEqual(20);
      expect(age).toBeLessThanOrEqual(35);
    });
  });
  
  test('Step 1.3.6: Test pattern optimization and selectivity', () => {
    // Test selectivity estimation
    const highSelectivityPattern = new TriplePattern('john', 'name', '?name');
    const highSelectivity = highSelectivityPattern.estimateSelectivity(kg);
    expect(highSelectivity).toBeGreaterThan(0);
    expect(highSelectivity).toBeLessThanOrEqual(1);
    
    const lowSelectivityPattern = new TriplePattern('?s', '?p', '?o');
    const lowSelectivity = lowSelectivityPattern.estimateSelectivity(kg);
    expect(lowSelectivity).toBeGreaterThan(0);
    expect(lowSelectivity).toBeLessThanOrEqual(1);
    
    // High selectivity should be higher than low selectivity
    expect(highSelectivity).toBeGreaterThan(lowSelectivity);
    
    // Test optimization hints
    const optimizationHints = highSelectivityPattern.getOptimizationHints(kg);
    expect(optimizationHints).toBeDefined();
    expect(optimizationHints.estimatedResultSize).toBeDefined();
    expect(optimizationHints.recommendedExecutionOrder).toBeDefined();
    expect(optimizationHints.indexUsage).toBeDefined();
  });
  
  test('Step 1.3.7: Test pattern validation and error handling', () => {
    // Test pattern creation with null values (now allowed for wildcard queries)
    expect(() => new TriplePattern(null, 'predicate', 'object')).not.toThrow();
    expect(() => new TriplePattern('subject', null, 'object')).not.toThrow();
    expect(() => new TriplePattern('subject', 'predicate', null)).not.toThrow();
    
    // Test that null patterns are created successfully
    const nullSubjectPattern = new TriplePattern(null, 'predicate', 'object');
    expect(nullSubjectPattern.subject).toBeNull();
    
    const nullPredicatePattern = new TriplePattern('subject', null, 'object');
    expect(nullPredicatePattern.predicate).toBeNull();
    
    const nullObjectPattern = new TriplePattern('subject', 'predicate', null);
    expect(nullObjectPattern.object).toBeNull();
    
    // Test pattern validation
    const validPattern = new TriplePattern('?s', 'p', '?o');
    expect(validPattern.isValid()).toBe(true);
    
    const validationErrors = validPattern.getValidationErrors();
    expect(validationErrors).toHaveLength(0);
    
    // Test pattern with conflicting constraints
    const conflictPattern = new TriplePattern('?person', 'age', '?age');
    const ageVar = conflictPattern.getVariables().find(v => v.name === 'age');
    ageVar.addConstraint(new RangeConstraint(30, 40));
    ageVar.addConstraint(new RangeConstraint(50, 60)); // Conflicting range
    
    const conflicts = conflictPattern.detectConstraintConflicts();
    expect(conflicts.length).toBeGreaterThan(0);
  });
});
