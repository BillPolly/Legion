import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { PatternQuery } from '../../../src/query/types/PatternQuery.js';
import { TriplePattern } from '../../../src/query/core/TriplePattern.js';
import { QueryVariable } from '../../../src/query/core/QueryVariable.js';
import { RangeConstraint, RegexConstraint, FunctionConstraint } from '../../../src/query/constraints/index.js';
import { KGEngine } from '../../../src/core/KGEngine.js';

describe('Phase 3.1: Basic Pattern Matching', () => {
  let kg;
  let patternQuery;
  
  beforeEach(() => {
    kg = new KGEngine();
    patternQuery = new PatternQuery();
    
    // Setup comprehensive test data
    kg.addTriple('john', 'rdf:type', 'Person');
    kg.addTriple('john', 'name', 'John Smith');
    kg.addTriple('john', 'age', 30);
    kg.addTriple('john', 'email', 'john@example.com');
    kg.addTriple('john', 'worksAt', 'acme');
    
    kg.addTriple('jane', 'rdf:type', 'Person');
    kg.addTriple('jane', 'name', 'Jane Doe');
    kg.addTriple('jane', 'age', 25);
    kg.addTriple('jane', 'email', 'jane@example.com');
    kg.addTriple('jane', 'worksAt', 'techcorp');
    
    kg.addTriple('bob', 'rdf:type', 'Person');
    kg.addTriple('bob', 'name', 'Bob Johnson');
    kg.addTriple('bob', 'age', 35);
    kg.addTriple('bob', 'email', 'bob@example.com');
    kg.addTriple('bob', 'worksAt', 'acme');
    
    kg.addTriple('acme', 'rdf:type', 'Company');
    kg.addTriple('acme', 'name', 'Acme Corp');
    kg.addTriple('acme', 'industry', 'Technology');
    
    kg.addTriple('techcorp', 'rdf:type', 'Company');
    kg.addTriple('techcorp', 'name', 'Tech Corp');
    kg.addTriple('techcorp', 'industry', 'Software');
  });
  
  afterEach(() => {
    // Cleanup
  });
  
  test('Step 3.1.1: Test single pattern queries with all variable positions', async () => {
    // Test pattern with variable subject
    const subjectVarQuery = new PatternQuery();
    const subjectPattern = new TriplePattern('?person', 'rdf:type', 'Person');
    subjectVarQuery.addPattern(subjectPattern);
    
    const subjectResults = await subjectVarQuery.execute(kg);
    expect(subjectResults).toBeDefined();
    expect(subjectResults.bindings).toBeDefined();
    expect(subjectResults.bindings.length).toBe(3); // john, jane, bob
    
    const personIds = subjectResults.bindings.map(binding => binding.get('person'));
    expect(personIds).toContain('john');
    expect(personIds).toContain('jane');
    expect(personIds).toContain('bob');
    
    // Test pattern with variable predicate
    const predicateVarQuery = new PatternQuery();
    const predicatePattern = new TriplePattern('john', '?property', '?value');
    predicateVarQuery.addPattern(predicatePattern);
    
    const predicateResults = await predicateVarQuery.execute(kg);
    expect(predicateResults.bindings.length).toBeGreaterThan(0);
    
    const properties = predicateResults.bindings.map(binding => binding.get('property'));
    expect(properties).toContain('rdf:type');
    expect(properties).toContain('name');
    expect(properties).toContain('age');
    expect(properties).toContain('email');
    expect(properties).toContain('worksAt');
    
    // Test pattern with variable object
    const objectVarQuery = new PatternQuery();
    const objectPattern = new TriplePattern('?person', 'worksAt', '?company');
    objectVarQuery.addPattern(objectPattern);
    
    const objectResults = await objectVarQuery.execute(kg);
    expect(objectResults.bindings.length).toBe(3); // john->acme, jane->techcorp, bob->acme
    
    const companies = objectResults.bindings.map(binding => binding.get('company'));
    expect(companies).toContain('acme');
    expect(companies).toContain('techcorp');
    
    // Test pattern with all variables
    const allVarQuery = new PatternQuery();
    const allVarPattern = new TriplePattern('?s', '?p', '?o');
    allVarQuery.addPattern(allVarPattern);
    
    const allVarResults = await allVarQuery.execute(kg);
    expect(allVarResults.bindings.length).toBeGreaterThan(10); // All triples in the graph
    
    // Test pattern with no variables (exact match)
    const exactQuery = new PatternQuery();
    const exactPattern = new TriplePattern('john', 'name', 'John Smith');
    exactQuery.addPattern(exactPattern);
    
    const exactResults = await exactQuery.execute(kg);
    expect(exactResults.bindings.length).toBe(1);
    expect(exactResults.bindings[0].size).toBe(0); // No variables to bind
  });
  
  test('Step 3.1.2: Test multi-pattern queries with variable joins', async () => {
    // Test simple join: person and their name
    const simpleJoinQuery = new PatternQuery();
    simpleJoinQuery.addPattern(new TriplePattern('?person', 'rdf:type', 'Person'));
    simpleJoinQuery.addPattern(new TriplePattern('?person', 'name', '?name'));
    
    const simpleJoinResults = await simpleJoinQuery.execute(kg);
    expect(simpleJoinResults.bindings.length).toBe(3);
    
    simpleJoinResults.bindings.forEach(binding => {
      expect(binding.has('person')).toBe(true);
      expect(binding.has('name')).toBe(true);
      
      const person = binding.get('person');
      const name = binding.get('name');
      
      if (person === 'john') expect(name).toBe('John Smith');
      if (person === 'jane') expect(name).toBe('Jane Doe');
      if (person === 'bob') expect(name).toBe('Bob Johnson');
    });
    
    // Test complex join: person, company, and company industry
    const complexJoinQuery = new PatternQuery();
    complexJoinQuery.addPattern(new TriplePattern('?person', 'rdf:type', 'Person'));
    complexJoinQuery.addPattern(new TriplePattern('?person', 'worksAt', '?company'));
    complexJoinQuery.addPattern(new TriplePattern('?company', 'industry', '?industry'));
    
    const complexJoinResults = await complexJoinQuery.execute(kg);
    expect(complexJoinResults.bindings.length).toBe(3);
    
    complexJoinResults.bindings.forEach(binding => {
      expect(binding.has('person')).toBe(true);
      expect(binding.has('company')).toBe(true);
      expect(binding.has('industry')).toBe(true);
      
      const person = binding.get('person');
      const company = binding.get('company');
      const industry = binding.get('industry');
      
      if (person === 'john') {
        expect(company).toBe('acme');
        expect(industry).toBe('Technology');
      }
      if (person === 'jane') {
        expect(company).toBe('techcorp');
        expect(industry).toBe('Software');
      }
      if (person === 'bob') {
        expect(company).toBe('acme');
        expect(industry).toBe('Technology');
      }
    });
    
    // Test join with shared variables across multiple patterns
    const sharedVarQuery = new PatternQuery();
    sharedVarQuery.addPattern(new TriplePattern('?person1', 'worksAt', '?company'));
    sharedVarQuery.addPattern(new TriplePattern('?person2', 'worksAt', '?company'));
    
    const sharedVarResults = await sharedVarQuery.execute(kg);
    expect(sharedVarResults.bindings.length).toBeGreaterThan(0);
    
    // Should find pairs of people working at the same company
    const acmeWorkers = sharedVarResults.bindings.filter(binding => 
      binding.get('company') === 'acme'
    );
    expect(acmeWorkers.length).toBeGreaterThan(0);
    
    // Test join with no matching results
    const noMatchQuery = new PatternQuery();
    noMatchQuery.addPattern(new TriplePattern('?person', 'rdf:type', 'Person'));
    noMatchQuery.addPattern(new TriplePattern('?person', 'rdf:type', 'Company')); // Impossible
    
    const noMatchResults = await noMatchQuery.execute(kg);
    expect(noMatchResults.bindings.length).toBe(0);
  });
  
  test('Step 3.1.3: Test pattern queries with constraints', async () => {
    // Test query with age constraint
    const ageConstraintQuery = new PatternQuery();
    const agePattern = new TriplePattern('?person', 'age', '?age');
    const ageVar = agePattern.getVariables().find(v => v.name === 'age');
    ageVar.addConstraint(new RangeConstraint(25, 35));
    ageConstraintQuery.addPattern(agePattern);
    
    const ageConstraintResults = await ageConstraintQuery.execute(kg);
    expect(ageConstraintResults.bindings.length).toBe(3); // All ages are in range
    
    // Test query with stricter age constraint
    const strictAgeQuery = new PatternQuery();
    const strictAgePattern = new TriplePattern('?person', 'age', '?age');
    const strictAgeVar = strictAgePattern.getVariables().find(v => v.name === 'age');
    strictAgeVar.addConstraint(new RangeConstraint(30, 40));
    strictAgeQuery.addPattern(strictAgePattern);
    
    const strictAgeResults = await strictAgeQuery.execute(kg);
    expect(strictAgeResults.bindings.length).toBe(2); // john (30) and bob (35)
    
    const strictAgePersons = strictAgeResults.bindings.map(binding => binding.get('person'));
    expect(strictAgePersons).toContain('john');
    expect(strictAgePersons).toContain('bob');
    expect(strictAgePersons).not.toContain('jane'); // age 25 is out of range
    
    // Test query with regex constraint on email
    const emailConstraintQuery = new PatternQuery();
    const emailPattern = new TriplePattern('?person', 'email', '?email');
    const emailVar = emailPattern.getVariables().find(v => v.name === 'email');
    emailVar.addConstraint(new RegexConstraint('^[a-z]+@example\\.com$'));
    emailConstraintQuery.addPattern(emailPattern);
    
    const emailConstraintResults = await emailConstraintQuery.execute(kg);
    expect(emailConstraintResults.bindings.length).toBe(3); // All emails match pattern
    
    // Test query with function constraint
    const functionConstraintQuery = new PatternQuery();
    const functionPattern = new TriplePattern('?person', 'age', '?age');
    const functionVar = functionPattern.getVariables().find(v => v.name === 'age');
    functionVar.addConstraint(new FunctionConstraint(age => age % 5 === 0, 'Age must be divisible by 5'));
    functionConstraintQuery.addPattern(functionPattern);
    
    const functionConstraintResults = await functionConstraintQuery.execute(kg);
    expect(functionConstraintResults.bindings.length).toBe(3); // john (30), jane (25), and bob (35) - all divisible by 5
    
    // Test query with multiple constraints
    const multiConstraintQuery = new PatternQuery();
    const multiPattern = new TriplePattern('?person', 'age', '?age');
    const multiVar = multiPattern.getVariables().find(v => v.name === 'age');
    multiVar.addConstraint(new RangeConstraint(20, 40));
    multiVar.addConstraint(new FunctionConstraint(age => age >= 30, 'Age must be at least 30'));
    multiConstraintQuery.addPattern(multiPattern);
    
    const multiConstraintResults = await multiConstraintQuery.execute(kg);
    expect(multiConstraintResults.bindings.length).toBe(2); // john (30) and bob (35)
  });
  
  test('Step 3.1.4: Test pattern query result binding and extraction', async () => {
    // Test basic result structure
    const basicQuery = new PatternQuery();
    basicQuery.addPattern(new TriplePattern('?person', 'name', '?name'));
    
    const basicResults = await basicQuery.execute(kg);
    expect(basicResults).toBeDefined();
    expect(basicResults.bindings).toBeDefined();
    expect(Array.isArray(basicResults.bindings)).toBe(true);
    expect(basicResults.variableNames).toBeDefined();
    expect(Array.isArray(basicResults.variableNames)).toBe(true);
    expect(basicResults.variableNames).toContain('person');
    expect(basicResults.variableNames).toContain('name');
    
    // Test result binding access
    basicResults.bindings.forEach(binding => {
      expect(binding.has('person')).toBe(true);
      expect(binding.has('name')).toBe(true);
      expect(binding.get('person')).toBeDefined();
      expect(binding.get('name')).toBeDefined();
      expect(typeof binding.get('name')).toBe('string');
    });
    
    // Test result filtering
    const filteredResults = basicResults.bindings.filter(binding => 
      binding.get('name').includes('John')
    );
    expect(filteredResults.length).toBe(2); // John Smith and Bob Johnson
    
    // Test result transformation
    const nameList = basicResults.bindings.map(binding => binding.get('name'));
    expect(nameList).toContain('John Smith');
    expect(nameList).toContain('Jane Doe');
    expect(nameList).toContain('Bob Johnson');
    
    // Test result aggregation
    const personCount = basicResults.bindings.length;
    expect(personCount).toBe(5); // 3 people + 2 companies with names
    
    const uniquePersons = new Set(basicResults.bindings.map(binding => binding.get('person')));
    expect(uniquePersons.size).toBe(5); // john, jane, bob, acme, techcorp
    
    // Test complex result extraction
    const complexQuery = new PatternQuery();
    complexQuery.addPattern(new TriplePattern('?person', 'rdf:type', 'Person'));
    complexQuery.addPattern(new TriplePattern('?person', 'name', '?name'));
    complexQuery.addPattern(new TriplePattern('?person', 'age', '?age'));
    complexQuery.addPattern(new TriplePattern('?person', 'worksAt', '?company'));
    
    const complexResults = await complexQuery.execute(kg);
    expect(complexResults.bindings.length).toBe(3);
    
    // Test result object creation
    const resultObjects = complexResults.bindings.map(binding => ({
      person: binding.get('person'),
      name: binding.get('name'),
      age: binding.get('age'),
      company: binding.get('company')
    }));
    
    expect(resultObjects.length).toBe(3);
    resultObjects.forEach(obj => {
      expect(obj.person).toBeDefined();
      expect(obj.name).toBeDefined();
      expect(obj.age).toBeDefined();
      expect(obj.company).toBeDefined();
      expect(typeof obj.age).toBe('number');
    });
  });
  
  test('Step 3.1.5: Test pattern query serialization and reconstruction', async () => {
    // Create a complex pattern query
    const originalQuery = new PatternQuery();
    originalQuery.setMetadata('author', 'test_user');
    originalQuery.setMetadata('description', 'Find people and their companies');
    
    const pattern1 = new TriplePattern('?person', 'rdf:type', 'Person');
    const pattern2 = new TriplePattern('?person', 'worksAt', '?company');
    const agePattern = new TriplePattern('?person', 'age', '?age');
    
    // Add constraint to age variable
    const ageVar = agePattern.getVariables().find(v => v.name === 'age');
    ageVar.addConstraint(new RangeConstraint(25, 40));
    
    originalQuery.addPattern(pattern1);
    originalQuery.addPattern(pattern2);
    originalQuery.addPattern(agePattern);
    
    // Test serialization
    const triples = originalQuery.toTriples();
    expect(Array.isArray(triples)).toBe(true);
    expect(triples.length).toBeGreaterThan(0);
    
    const queryId = originalQuery.getId();
    
    // Check core query triples
    const typeTriple = triples.find(([s, p, o]) => 
      s === queryId && p === 'rdf:type' && o === 'kg:PatternQuery'
    );
    expect(typeTriple).toBeDefined();
    
    const authorTriple = triples.find(([s, p, o]) => 
      s === queryId && p === 'kg:author' && o === 'test_user'
    );
    expect(authorTriple).toBeDefined();
    
    // Check pattern triples
    const patternTriples = triples.filter(([s, p, o]) => 
      s === queryId && p === 'kg:hasPattern'
    );
    expect(patternTriples.length).toBe(3);
    
    // Check that pattern details are included
    const patternIds = patternTriples.map(([s, p, o]) => o);
    patternIds.forEach(patternId => {
      const patternTypeTriple = triples.find(([s, p, o]) => 
        s === patternId && p === 'rdf:type' && o === 'kg:TriplePattern'
      );
      expect(patternTypeTriple).toBeDefined();
    });
    
    // Check constraint serialization
    const constraintTriples = triples.filter(([s, p, o]) => 
      p === 'kg:hasConstraint'
    );
    expect(constraintTriples.length).toBeGreaterThan(0);
    
    // Test execution of serialized query
    const originalResults = await originalQuery.execute(kg);
    expect(originalResults.bindings.length).toBeGreaterThan(0);
    
    // Verify results match expected constraints
    originalResults.bindings.forEach(binding => {
      const age = binding.get('age');
      expect(age).toBeGreaterThanOrEqual(25);
      expect(age).toBeLessThanOrEqual(40);
    });
    
    // Test query metadata preservation
    expect(originalQuery.getMetadata('author')).toBe('test_user');
    expect(originalQuery.getMetadata('description')).toBe('Find people and their companies');
    
    // Test query statistics
    expect(originalQuery.executionStats.executionCount).toBe(1);
    expect(originalQuery.executionStats.resultCount).toBe(originalResults.bindings.length);
    expect(originalQuery.executionStats.totalExecutionTime).toBeGreaterThan(0);
  });
});
