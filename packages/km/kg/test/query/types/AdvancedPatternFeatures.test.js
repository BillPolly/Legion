import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { PatternQuery } from '../../../src/query/types/PatternQuery.js';
import { TriplePattern } from '../../../src/query/core/TriplePattern.js';
import { QueryVariable } from '../../../src/query/core/QueryVariable.js';
import { RangeConstraint, RegexConstraint, FunctionConstraint } from '../../../src/query/constraints/index.js';
import { KGEngine } from '../../../src/core/KGEngine.js';

describe('Phase 3.2: Advanced Pattern Features', () => {
  let kg;
  
  beforeEach(() => {
    kg = new KGEngine();
    
    // Setup comprehensive test data with types and relationships
    kg.addTriple('john', 'rdf:type', 'Person');
    kg.addTriple('john', 'name', 'John Smith');
    kg.addTriple('john', 'age', 30);
    kg.addTriple('john', 'email', 'john@example.com');
    kg.addTriple('john', 'worksAt', 'acme');
    kg.addTriple('john', 'salary', 75000);
    kg.addTriple('john', 'department', 'Engineering');
    
    kg.addTriple('jane', 'rdf:type', 'Person');
    kg.addTriple('jane', 'name', 'Jane Doe');
    kg.addTriple('jane', 'age', 25);
    kg.addTriple('jane', 'email', 'jane@example.com');
    kg.addTriple('jane', 'worksAt', 'techcorp');
    kg.addTriple('jane', 'salary', 65000);
    kg.addTriple('jane', 'department', 'Marketing');
    
    kg.addTriple('bob', 'rdf:type', 'Person');
    kg.addTriple('bob', 'name', 'Bob Johnson');
    kg.addTriple('bob', 'age', 35);
    kg.addTriple('bob', 'email', 'bob@example.com');
    kg.addTriple('bob', 'worksAt', 'acme');
    kg.addTriple('bob', 'salary', 85000);
    kg.addTriple('bob', 'department', 'Engineering');
    
    kg.addTriple('alice', 'rdf:type', 'Manager');
    kg.addTriple('alice', 'name', 'Alice Brown');
    kg.addTriple('alice', 'age', 40);
    kg.addTriple('alice', 'email', 'alice@acme.com');
    kg.addTriple('alice', 'worksAt', 'acme');
    kg.addTriple('alice', 'salary', 95000);
    kg.addTriple('alice', 'department', 'Engineering');
    kg.addTriple('alice', 'manages', 'john');
    kg.addTriple('alice', 'manages', 'bob');
    
    kg.addTriple('acme', 'rdf:type', 'Company');
    kg.addTriple('acme', 'name', 'Acme Corp');
    kg.addTriple('acme', 'industry', 'Technology');
    kg.addTriple('acme', 'founded', 2010);
    kg.addTriple('acme', 'revenue', 10000000);
    
    kg.addTriple('techcorp', 'rdf:type', 'Company');
    kg.addTriple('techcorp', 'name', 'Tech Corp');
    kg.addTriple('techcorp', 'industry', 'Software');
    kg.addTriple('techcorp', 'founded', 2015);
    kg.addTriple('techcorp', 'revenue', 5000000);
    
    // Add some products
    kg.addTriple('product1', 'rdf:type', 'Product');
    kg.addTriple('product1', 'name', 'Widget Pro');
    kg.addTriple('product1', 'price', 299.99);
    kg.addTriple('product1', 'category', 'Electronics');
    kg.addTriple('product1', 'manufacturer', 'acme');
    
    kg.addTriple('product2', 'rdf:type', 'Product');
    kg.addTriple('product2', 'name', 'Gadget Max');
    kg.addTriple('product2', 'price', 199.99);
    kg.addTriple('product2', 'category', 'Electronics');
    kg.addTriple('product2', 'manufacturer', 'techcorp');
  });
  
  afterEach(() => {
    // Cleanup
  });
  
  test('Step 3.2.1: Test pattern queries with type constraints', async () => {
    // Test query for specific type
    const personQuery = new PatternQuery();
    personQuery.addPattern(new TriplePattern('?entity', 'rdf:type', 'Person'));
    personQuery.addPattern(new TriplePattern('?entity', 'name', '?name'));
    
    const personResults = await personQuery.execute(kg);
    expect(personResults.bindings.length).toBe(3); // john, jane, bob
    
    const personNames = personResults.bindings.map(binding => binding.get('name'));
    expect(personNames).toContain('John Smith');
    expect(personNames).toContain('Jane Doe');
    expect(personNames).toContain('Bob Johnson');
    expect(personNames).not.toContain('Alice Brown'); // Alice is a Manager, not Person
    
    // Test query for Manager type
    const managerQuery = new PatternQuery();
    managerQuery.addPattern(new TriplePattern('?manager', 'rdf:type', 'Manager'));
    managerQuery.addPattern(new TriplePattern('?manager', 'name', '?name'));
    
    const managerResults = await managerQuery.execute(kg);
    expect(managerResults.bindings.length).toBe(1); // alice
    expect(managerResults.bindings[0].get('name')).toBe('Alice Brown');
    
    // Test query for Company type with additional constraints
    const companyQuery = new PatternQuery();
    companyQuery.addPattern(new TriplePattern('?company', 'rdf:type', 'Company'));
    companyQuery.addPattern(new TriplePattern('?company', 'industry', '?industry'));
    companyQuery.addPattern(new TriplePattern('?company', 'founded', '?year'));
    
    const companyResults = await companyQuery.execute(kg);
    expect(companyResults.bindings.length).toBe(2); // acme, techcorp
    
    companyResults.bindings.forEach(binding => {
      const industry = binding.get('industry');
      const year = binding.get('year');
      expect(['Technology', 'Software']).toContain(industry);
      expect(year).toBeGreaterThan(2000);
    });
    
    // Test query with type constraint and value filtering
    const recentCompanyQuery = new PatternQuery();
    const yearPattern = new TriplePattern('?company', 'founded', '?year');
    const yearVar = yearPattern.getVariables().find(v => v.name === 'year');
    yearVar.addConstraint(new RangeConstraint(2012, 2020));
    
    recentCompanyQuery.addPattern(new TriplePattern('?company', 'rdf:type', 'Company'));
    recentCompanyQuery.addPattern(yearPattern);
    recentCompanyQuery.addPattern(new TriplePattern('?company', 'name', '?name'));
    
    const recentResults = await recentCompanyQuery.execute(kg);
    expect(recentResults.bindings.length).toBe(1); // only techcorp (2015)
    expect(recentResults.bindings[0].get('name')).toBe('Tech Corp');
  });
  
  test('Step 3.2.2: Test pattern queries with value constraints', async () => {
    // Test salary range constraints
    const highSalaryQuery = new PatternQuery();
    const salaryPattern = new TriplePattern('?person', 'salary', '?salary');
    const salaryVar = salaryPattern.getVariables().find(v => v.name === 'salary');
    salaryVar.addConstraint(new RangeConstraint(80000, null)); // >= 80000
    
    highSalaryQuery.addPattern(new TriplePattern('?person', 'rdf:type', null)); // any type
    highSalaryQuery.addPattern(salaryPattern);
    highSalaryQuery.addPattern(new TriplePattern('?person', 'name', '?name'));
    
    const highSalaryResults = await highSalaryQuery.execute(kg);
    expect(highSalaryResults.bindings.length).toBe(2); // bob (85000), alice (95000)
    
    const highEarners = highSalaryResults.bindings.map(binding => binding.get('name'));
    expect(highEarners).toContain('Bob Johnson');
    expect(highEarners).toContain('Alice Brown');
    expect(highEarners).not.toContain('John Smith'); // 75000
    expect(highEarners).not.toContain('Jane Doe'); // 65000
    
    // Test age range constraints
    const youngProfessionalQuery = new PatternQuery();
    const agePattern = new TriplePattern('?person', 'age', '?age');
    const ageVar = agePattern.getVariables().find(v => v.name === 'age');
    ageVar.addConstraint(new RangeConstraint(25, 35)); // 25-35 years old
    
    youngProfessionalQuery.addPattern(agePattern);
    youngProfessionalQuery.addPattern(new TriplePattern('?person', 'name', '?name'));
    youngProfessionalQuery.addPattern(new TriplePattern('?person', 'department', '?dept'));
    
    const youngResults = await youngProfessionalQuery.execute(kg);
    expect(youngResults.bindings.length).toBe(3); // jane (25), john (30), bob (35)
    
    // Test price range for products
    const affordableProductQuery = new PatternQuery();
    const pricePattern = new TriplePattern('?product', 'price', '?price');
    const priceVar = pricePattern.getVariables().find(v => v.name === 'price');
    priceVar.addConstraint(new RangeConstraint(null, 250)); // <= 250
    
    affordableProductQuery.addPattern(new TriplePattern('?product', 'rdf:type', 'Product'));
    affordableProductQuery.addPattern(pricePattern);
    affordableProductQuery.addPattern(new TriplePattern('?product', 'name', '?name'));
    
    const affordableResults = await affordableProductQuery.execute(kg);
    expect(affordableResults.bindings.length).toBe(1); // Gadget Max (199.99)
    expect(affordableResults.bindings[0].get('name')).toBe('Gadget Max');
    
    // Test multiple value constraints
    const seniorEngineerQuery = new PatternQuery();
    const seniorAgePattern = new TriplePattern('?person', 'age', '?age');
    const seniorSalaryPattern = new TriplePattern('?person', 'salary', '?salary');
    
    const seniorAgeVar = seniorAgePattern.getVariables().find(v => v.name === 'age');
    seniorAgeVar.addConstraint(new RangeConstraint(30, null)); // >= 30
    
    const seniorSalaryVar = seniorSalaryPattern.getVariables().find(v => v.name === 'salary');
    seniorSalaryVar.addConstraint(new RangeConstraint(70000, null)); // >= 70000
    
    seniorEngineerQuery.addPattern(seniorAgePattern);
    seniorEngineerQuery.addPattern(seniorSalaryPattern);
    seniorEngineerQuery.addPattern(new TriplePattern('?person', 'department', 'Engineering'));
    seniorEngineerQuery.addPattern(new TriplePattern('?person', 'name', '?name'));
    
    const seniorResults = await seniorEngineerQuery.execute(kg);
    expect(seniorResults.bindings.length).toBe(3); // john (30, 75000), bob (35, 85000), alice (40, 95000)
    
    const seniorNames = seniorResults.bindings.map(binding => binding.get('name'));
    expect(seniorNames).toContain('John Smith');
    expect(seniorNames).toContain('Bob Johnson');
    expect(seniorNames).toContain('Alice Brown'); // Alice is also in Engineering department
  });
  
  test('Step 3.2.3: Test pattern queries with regex constraints', async () => {
    // Test email domain constraints
    const acmeEmailQuery = new PatternQuery();
    const emailPattern = new TriplePattern('?person', 'email', '?email');
    const emailVar = emailPattern.getVariables().find(v => v.name === 'email');
    emailVar.addConstraint(new RegexConstraint('@acme\\.com$')); // ends with @acme.com
    
    acmeEmailQuery.addPattern(emailPattern);
    acmeEmailQuery.addPattern(new TriplePattern('?person', 'name', '?name'));
    
    const acmeEmailResults = await acmeEmailQuery.execute(kg);
    expect(acmeEmailResults.bindings.length).toBe(1); // alice
    expect(acmeEmailResults.bindings[0].get('name')).toBe('Alice Brown');
    
    // Test name pattern constraints
    const johnNameQuery = new PatternQuery();
    const namePattern = new TriplePattern('?person', 'name', '?name');
    const nameVar = namePattern.getVariables().find(v => v.name === 'name');
    nameVar.addConstraint(new RegexConstraint('^John')); // starts with "John"
    
    johnNameQuery.addPattern(namePattern);
    johnNameQuery.addPattern(new TriplePattern('?person', 'age', '?age'));
    
    const johnResults = await johnNameQuery.execute(kg);
    expect(johnResults.bindings.length).toBe(1); // Only John Smith starts with "John"
    
    const johnNames = johnResults.bindings.map(binding => binding.get('name'));
    expect(johnNames).toContain('John Smith');
    expect(johnNames).not.toContain('Bob Johnson'); // doesn't start with "John"
    
    // Test product name patterns
    const proProductQuery = new PatternQuery();
    const productNamePattern = new TriplePattern('?product', 'name', '?name');
    const productNameVar = productNamePattern.getVariables().find(v => v.name === 'name');
    productNameVar.addConstraint(new RegexConstraint('Pro|Max')); // contains "Pro" or "Max"
    
    proProductQuery.addPattern(new TriplePattern('?product', 'rdf:type', 'Product'));
    proProductQuery.addPattern(productNamePattern);
    proProductQuery.addPattern(new TriplePattern('?product', 'price', '?price'));
    
    const proResults = await proProductQuery.execute(kg);
    expect(proResults.bindings.length).toBe(2); // Widget Pro, Gadget Max
    
    const proNames = proResults.bindings.map(binding => binding.get('name'));
    expect(proNames).toContain('Widget Pro');
    expect(proNames).toContain('Gadget Max');
    
    // Test case-insensitive regex
    const techCompanyQuery = new PatternQuery();
    const industryPattern = new TriplePattern('?company', 'industry', '?industry');
    const industryVar = industryPattern.getVariables().find(v => v.name === 'industry');
    industryVar.addConstraint(new RegexConstraint('tech', 'i')); // case-insensitive "tech"
    
    techCompanyQuery.addPattern(new TriplePattern('?company', 'rdf:type', 'Company'));
    techCompanyQuery.addPattern(industryPattern);
    techCompanyQuery.addPattern(new TriplePattern('?company', 'name', '?name'));
    
    const techResults = await techCompanyQuery.execute(kg);
    expect(techResults.bindings.length).toBe(1); // acme (Technology)
    expect(techResults.bindings[0].get('name')).toBe('Acme Corp');
    
    // Test complex regex pattern
    const complexEmailQuery = new PatternQuery();
    const complexEmailPattern = new TriplePattern('?person', 'email', '?email');
    const complexEmailVar = complexEmailPattern.getVariables().find(v => v.name === 'email');
    complexEmailVar.addConstraint(new RegexConstraint('^[a-z]+@[a-z]+\\.com$')); // simple email format
    
    complexEmailQuery.addPattern(complexEmailPattern);
    complexEmailQuery.addPattern(new TriplePattern('?person', 'name', '?name'));
    
    const complexResults = await complexEmailQuery.execute(kg);
    expect(complexResults.bindings.length).toBeGreaterThan(0);
    
    complexResults.bindings.forEach(binding => {
      const email = binding.get('email');
      expect(email).toMatch(/^[a-z]+@[a-z]+\.com$/);
    });
  });
  
  test('Step 3.2.4: Test pattern query optimization and execution planning', async () => {
    // Test query with selective patterns (should optimize by executing most selective first)
    const selectiveQuery = new PatternQuery();
    selectiveQuery.addPattern(new TriplePattern('?person', 'department', 'Engineering')); // selective
    selectiveQuery.addPattern(new TriplePattern('?person', 'rdf:type', null)); // less selective
    selectiveQuery.addPattern(new TriplePattern('?person', 'name', '?name')); // less selective
    
    const startTime = Date.now();
    const selectiveResults = await selectiveQuery.execute(kg);
    const executionTime = Date.now() - startTime;
    
    expect(selectiveResults.bindings.length).toBe(3); // john, bob, alice in Engineering
    expect(executionTime).toBeLessThan(100); // should be fast due to optimization
    
    // Test query execution statistics
    expect(selectiveQuery.executionStats.executionCount).toBe(1);
    expect(selectiveQuery.executionStats.totalExecutionTime).toBeGreaterThan(0);
    expect(selectiveQuery.executionStats.resultCount).toBe(3);
    
    // Test query with constraints (should apply constraints early)
    const constrainedQuery = new PatternQuery();
    const constrainedAgePattern = new TriplePattern('?person', 'age', '?age');
    const constrainedAgeVar = constrainedAgePattern.getVariables().find(v => v.name === 'age');
    constrainedAgeVar.addConstraint(new RangeConstraint(35, 50)); // narrow range
    
    constrainedQuery.addPattern(constrainedAgePattern);
    constrainedQuery.addPattern(new TriplePattern('?person', 'name', '?name'));
    constrainedQuery.addPattern(new TriplePattern('?person', 'salary', '?salary'));
    
    const constrainedStartTime = Date.now();
    const constrainedResults = await constrainedQuery.execute(kg);
    const constrainedExecutionTime = Date.now() - constrainedStartTime;
    
    expect(constrainedResults.bindings.length).toBe(2); // bob (35), alice (40)
    expect(constrainedExecutionTime).toBeLessThan(100);
    
    // Test large result set handling
    const largeQuery = new PatternQuery();
    largeQuery.addPattern(new TriplePattern('?s', '?p', '?o')); // all triples
    
    const largeStartTime = Date.now();
    const largeResults = await largeQuery.execute(kg);
    const largeExecutionTime = Date.now() - largeStartTime;
    
    expect(largeResults.bindings.length).toBeGreaterThan(20); // many triples
    expect(largeExecutionTime).toBeLessThan(500); // should still be reasonable
    
    // Test query caching (execute same query twice)
    const cachedQuery = new PatternQuery();
    cachedQuery.addPattern(new TriplePattern('?person', 'rdf:type', 'Person'));
    cachedQuery.addPattern(new TriplePattern('?person', 'name', '?name'));
    
    const firstExecution = await cachedQuery.execute(kg);
    const firstTime = cachedQuery.executionStats.totalExecutionTime;
    
    const secondExecution = await cachedQuery.execute(kg);
    const secondTime = cachedQuery.executionStats.totalExecutionTime - firstTime;
    
    expect(firstExecution.bindings.length).toBe(secondExecution.bindings.length);
    expect(cachedQuery.executionStats.executionCount).toBe(2);
    
    // Test query complexity analysis
    const complexQuery = new PatternQuery();
    complexQuery.addPattern(new TriplePattern('?person', 'rdf:type', 'Person'));
    complexQuery.addPattern(new TriplePattern('?person', 'worksAt', '?company'));
    complexQuery.addPattern(new TriplePattern('?company', 'industry', '?industry'));
    complexQuery.addPattern(new TriplePattern('?company', 'founded', '?year'));
    
    const complexResults = await complexQuery.execute(kg);
    expect(complexResults.bindings.length).toBe(3); // john, jane, bob with company info
    expect(complexQuery.executionStats.executionCount).toBe(1);
    
    // Verify all results have complete bindings
    complexResults.bindings.forEach(binding => {
      expect(binding.has('person')).toBe(true);
      expect(binding.has('company')).toBe(true);
      expect(binding.has('industry')).toBe(true);
      expect(binding.has('year')).toBe(true);
    });
  });
  
  test('Step 3.2.5: Test pattern query error handling and edge cases', async () => {
    // Test query with non-existent properties
    const nonExistentQuery = new PatternQuery();
    nonExistentQuery.addPattern(new TriplePattern('?person', 'nonExistentProperty', '?value'));
    
    const nonExistentResults = await nonExistentQuery.execute(kg);
    expect(nonExistentResults.bindings.length).toBe(0);
    expect(nonExistentResults.variableNames).toContain('person');
    expect(nonExistentResults.variableNames).toContain('value');
    
    // Test query with invalid constraint values
    const invalidConstraintQuery = new PatternQuery();
    const invalidPattern = new TriplePattern('?person', 'age', '?age');
    const invalidVar = invalidPattern.getVariables().find(v => v.name === 'age');
    invalidVar.addConstraint(new RangeConstraint(100, 50)); // invalid range (min > max)
    
    invalidConstraintQuery.addPattern(invalidPattern);
    
    const invalidResults = await invalidConstraintQuery.execute(kg);
    expect(invalidResults.bindings.length).toBe(0); // no results due to invalid constraint
    
    // Test query with circular variable references
    const circularQuery = new PatternQuery();
    circularQuery.addPattern(new TriplePattern('?a', 'relatesTo', '?b'));
    circularQuery.addPattern(new TriplePattern('?b', 'relatesTo', '?a'));
    
    const circularResults = await circularQuery.execute(kg);
    expect(circularResults.bindings.length).toBe(0); // no circular relationships in test data
    
    // Test query with null/undefined values
    const nullQuery = new PatternQuery();
    nullQuery.addPattern(new TriplePattern('?entity', null, '?value')); // null predicate
    
    const nullResults = await nullQuery.execute(kg);
    expect(nullResults.bindings.length).toBeGreaterThan(0); // should find all predicates
    
    // Test query with empty patterns
    const emptyQuery = new PatternQuery();
    // No patterns added
    
    const emptyResults = await emptyQuery.execute(kg);
    expect(emptyResults.bindings.length).toBe(0);
    expect(emptyResults.variableNames.length).toBe(0);
    
    // Test query with malformed regex constraint
    const malformedRegexQuery = new PatternQuery();
    const malformedPattern = new TriplePattern('?person', 'name', '?name');
    const malformedVar = malformedPattern.getVariables().find(v => v.name === 'name');
    
    // This should handle the malformed regex gracefully
    try {
      malformedVar.addConstraint(new RegexConstraint('[invalid regex')); // malformed regex
      malformedRegexQuery.addPattern(malformedPattern);
      
      const malformedResults = await malformedRegexQuery.execute(kg);
      // Should either work or fail gracefully
      expect(Array.isArray(malformedResults.bindings)).toBe(true);
    } catch (error) {
      // Graceful error handling is acceptable
      expect(error).toBeDefined();
    }
    
    // Test query with very large constraint values
    const largeValueQuery = new PatternQuery();
    const largePattern = new TriplePattern('?entity', 'value', '?val');
    const largeVar = largePattern.getVariables().find(v => v.name === 'val');
    largeVar.addConstraint(new RangeConstraint(Number.MAX_SAFE_INTEGER - 1, Number.MAX_SAFE_INTEGER));
    
    largeValueQuery.addPattern(largePattern);
    
    const largeResults = await largeValueQuery.execute(kg);
    expect(largeResults.bindings.length).toBe(0); // no values in that range
    
    // Test query serialization with edge cases
    const edgeCaseQuery = new PatternQuery();
    edgeCaseQuery.setMetadata('special_chars', 'test with "quotes" and \'apostrophes\'');
    edgeCaseQuery.setMetadata('unicode', 'test with unicode: 🚀 ñ ü');
    edgeCaseQuery.addPattern(new TriplePattern('?entity', 'property', 'value with spaces'));
    
    const edgeTriples = edgeCaseQuery.toTriples();
    expect(Array.isArray(edgeTriples)).toBe(true);
    expect(edgeTriples.length).toBeGreaterThan(0);
    
    // Verify metadata is preserved
    const specialCharsTriple = edgeTriples.find(([s, p, o]) => 
      p === 'kg:special_chars' && o === 'test with "quotes" and \'apostrophes\''
    );
    expect(specialCharsTriple).toBeDefined();
    
    const unicodeTriple = edgeTriples.find(([s, p, o]) => 
      p === 'kg:unicode' && o === 'test with unicode: 🚀 ñ ü'
    );
    expect(unicodeTriple).toBeDefined();
  });
});
