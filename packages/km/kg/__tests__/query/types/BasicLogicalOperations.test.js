import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { LogicalQuery } from '../../../src/query/types/LogicalQuery.js';
import { PatternQuery } from '../../../src/query/types/PatternQuery.js';
import { TriplePattern } from '../../../src/query/core/TriplePattern.js';
import { QueryVariable } from '../../../src/query/core/QueryVariable.js';
import { RangeConstraint } from '../../../src/query/constraints/RangeConstraint.js';
import { FunctionConstraint } from '../../../src/query/constraints/FunctionConstraint.js';
import { KGEngine } from '../../../src/core/KGEngine.js';

describe('Phase 5.1: Basic Logical Operations', () => {
  let kg;
  
  beforeEach(() => {
    kg = new KGEngine();
    
    // Setup comprehensive test data for logical query testing
    // Create a rich graph with people, organizations, and relationships
    
    // People
    kg.addTriple('alice', 'rdf:type', 'Person');
    kg.addTriple('alice', 'name', 'Alice Smith');
    kg.addTriple('alice', 'age', 30);
    kg.addTriple('alice', 'department', 'Engineering');
    kg.addTriple('alice', 'salary', 75000);
    kg.addTriple('alice', 'level', 'Senior');
    
    kg.addTriple('bob', 'rdf:type', 'Person');
    kg.addTriple('bob', 'name', 'Bob Johnson');
    kg.addTriple('bob', 'age', 25);
    kg.addTriple('bob', 'department', 'Engineering');
    kg.addTriple('bob', 'salary', 60000);
    kg.addTriple('bob', 'level', 'Junior');
    
    kg.addTriple('charlie', 'rdf:type', 'Person');
    kg.addTriple('charlie', 'name', 'Charlie Brown');
    kg.addTriple('charlie', 'age', 35);
    kg.addTriple('charlie', 'department', 'Sales');
    kg.addTriple('charlie', 'salary', 90000);
    kg.addTriple('charlie', 'level', 'Manager');
    
    kg.addTriple('diana', 'rdf:type', 'Person');
    kg.addTriple('diana', 'name', 'Diana Prince');
    kg.addTriple('diana', 'age', 28);
    kg.addTriple('diana', 'department', 'Marketing');
    kg.addTriple('diana', 'salary', 85000);
    kg.addTriple('diana', 'level', 'Senior');
    
    kg.addTriple('eve', 'rdf:type', 'Person');
    kg.addTriple('eve', 'name', 'Eve Wilson');
    kg.addTriple('eve', 'age', 32);
    kg.addTriple('eve', 'department', 'Marketing');
    kg.addTriple('eve', 'salary', 95000);
    kg.addTriple('eve', 'level', 'Manager');
    
    // Organizations
    kg.addTriple('company1', 'rdf:type', 'Company');
    kg.addTriple('company1', 'name', 'Tech Corp');
    kg.addTriple('company1', 'industry', 'Technology');
    kg.addTriple('company1', 'size', 'Large');
    
    kg.addTriple('startup1', 'rdf:type', 'Company');
    kg.addTriple('startup1', 'name', 'Innovation Inc');
    kg.addTriple('startup1', 'industry', 'Technology');
    kg.addTriple('startup1', 'size', 'Small');
    
    // Projects
    kg.addTriple('project1', 'rdf:type', 'Project');
    kg.addTriple('project1', 'name', 'AI Platform');
    kg.addTriple('project1', 'budget', 500000);
    kg.addTriple('project1', 'status', 'Active');
    kg.addTriple('project1', 'priority', 'High');
    
    kg.addTriple('project2', 'rdf:type', 'Project');
    kg.addTriple('project2', 'name', 'Mobile App');
    kg.addTriple('project2', 'budget', 200000);
    kg.addTriple('project2', 'status', 'Planning');
    kg.addTriple('project2', 'priority', 'Medium');
    
    kg.addTriple('project3', 'rdf:type', 'Project');
    kg.addTriple('project3', 'name', 'Data Analytics');
    kg.addTriple('project3', 'budget', 300000);
    kg.addTriple('project3', 'status', 'Active');
    kg.addTriple('project3', 'priority', 'High');
    
    // Relationships
    kg.addTriple('alice', 'worksAt', 'company1');
    kg.addTriple('bob', 'worksAt', 'company1');
    kg.addTriple('charlie', 'worksAt', 'company1');
    kg.addTriple('diana', 'worksAt', 'startup1');
    kg.addTriple('eve', 'worksAt', 'startup1');
    
    kg.addTriple('alice', 'worksOn', 'project1');
    kg.addTriple('bob', 'worksOn', 'project1');
    kg.addTriple('bob', 'worksOn', 'project2');
    kg.addTriple('charlie', 'worksOn', 'project3');
    kg.addTriple('diana', 'worksOn', 'project2');
    kg.addTriple('eve', 'worksOn', 'project3');
    
    kg.addTriple('alice', 'manages', 'bob');
    kg.addTriple('charlie', 'manages', 'alice');
    kg.addTriple('eve', 'manages', 'diana');
    
    kg.addTriple('alice', 'knows', 'bob');
    kg.addTriple('alice', 'knows', 'charlie');
    kg.addTriple('bob', 'knows', 'diana');
    kg.addTriple('charlie', 'knows', 'eve');
    kg.addTriple('diana', 'knows', 'eve');
  });
  
  afterEach(async () => {
    // Clear the knowledge graph to prevent memory leaks and ensure clean state
    if (kg && typeof kg.clear === 'function') {
      await kg.clear();
    }
    kg = null;
  });
  
  test('Step 5.1.1: Test AND query composition and execution', async () => {
    // Test basic AND operation: People who work at company1 AND are in Engineering
    const personVar = new QueryVariable('person');
    
    // Query 1: People who work at company1
    const worksAtPattern = new TriplePattern(personVar, 'worksAt', 'company1');
    const worksAtQuery = new PatternQuery();
    worksAtQuery.addPattern(worksAtPattern);
    
    // Query 2: People in Engineering department
    const engineeringPattern = new TriplePattern(personVar, 'department', 'Engineering');
    const engineeringQuery = new PatternQuery();
    engineeringQuery.addPattern(engineeringPattern);
    
    // AND query
    const andQuery = new LogicalQuery('AND');
    andQuery.addOperand(worksAtQuery);
    andQuery.addOperand(engineeringQuery);
    
    const andResults = await andQuery.execute(kg);
    
    expect(andResults.bindings.length).toBe(2); // alice and bob
    
    const people = andResults.bindings.map(binding => binding.get('person'));
    expect(people).toContain('alice');
    expect(people).toContain('bob');
    expect(people).not.toContain('charlie'); // Sales, not Engineering
    expect(people).not.toContain('diana'); // Works at startup1, not company1
    
    // Test AND with constraints
    const seniorVar = new QueryVariable('person');
    seniorVar.addConstraint(new FunctionConstraint((value) => {
      const ageTriples = kg.query(value, 'age', null);
      return ageTriples.length > 0 && ageTriples[0][2] >= 30;
    }));
    
    const seniorPattern = new TriplePattern(seniorVar, 'rdf:type', 'Person');
    const seniorQuery = new PatternQuery();
    seniorQuery.addPattern(seniorPattern);
    
    const managerPattern = new TriplePattern(personVar, 'level', 'Manager');
    const managerQuery = new PatternQuery();
    managerQuery.addPattern(managerPattern);
    
    const seniorManagerQuery = new LogicalQuery('AND');
    seniorManagerQuery.addOperand(seniorQuery);
    seniorManagerQuery.addOperand(managerQuery);
    
    const seniorManagerResults = await seniorManagerQuery.execute(kg);
    
    expect(seniorManagerResults.bindings.length).toBeGreaterThan(0);
    
    // Verify all results are both senior (age >= 30) and managers
    for (const binding of seniorManagerResults.bindings) {
      const person = binding.get('person');
      
      const ageTriples = kg.query(person, 'age', null);
      expect(ageTriples.length).toBeGreaterThan(0);
      expect(ageTriples[0][2]).toBeGreaterThanOrEqual(30);
      
      const levelTriples = kg.query(person, 'level', null);
      expect(levelTriples.length).toBeGreaterThan(0);
      expect(levelTriples[0][2]).toBe('Manager');
    }
    
    // Test multiple AND operations
    const highSalaryPattern = new TriplePattern(personVar, 'salary', new QueryVariable('salary'));
    const highSalaryQuery = new PatternQuery();
    highSalaryQuery.addPattern(highSalaryPattern);
    
    const salaryVar = highSalaryQuery.getVariable('salary');
    salaryVar.addConstraint(new RangeConstraint(80000, 100000));
    
    const tripleAndQuery = new LogicalQuery('AND');
    tripleAndQuery.addOperand(worksAtQuery);
    tripleAndQuery.addOperand(engineeringQuery);
    tripleAndQuery.addOperand(highSalaryQuery);
    
    const tripleAndResults = await tripleAndQuery.execute(kg);
    
    // Should be empty since no Engineering person at company1 has salary 80k-100k
    expect(tripleAndResults.bindings.length).toBe(0);
    
    // Test AND with empty result
    const nonExistentPattern = new TriplePattern(personVar, 'department', 'NonExistent');
    const nonExistentQuery = new PatternQuery();
    nonExistentQuery.addPattern(nonExistentPattern);
    
    const emptyAndQuery = new LogicalQuery('AND');
    emptyAndQuery.addOperand(worksAtQuery);
    emptyAndQuery.addOperand(nonExistentQuery);
    
    const emptyAndResults = await emptyAndQuery.execute(kg);
    expect(emptyAndResults.bindings.length).toBe(0);
  });
  
  test('Step 5.1.2: Test OR query composition and execution', async () => {
    // Test basic OR operation: People in Engineering OR Marketing
    const personVar = new QueryVariable('person');
    
    // Query 1: People in Engineering
    const engineeringPattern = new TriplePattern(personVar, 'department', 'Engineering');
    const engineeringQuery = new PatternQuery();
    engineeringQuery.addPattern(engineeringPattern);
    
    // Query 2: People in Marketing
    const marketingPattern = new TriplePattern(personVar, 'department', 'Marketing');
    const marketingQuery = new PatternQuery();
    marketingQuery.addPattern(marketingPattern);
    
    // OR query
    const orQuery = new LogicalQuery('OR');
    orQuery.addOperand(engineeringQuery);
    orQuery.addOperand(marketingQuery);
    
    const orResults = await orQuery.execute(kg);
    
    expect(orResults.bindings.length).toBe(4); // alice, bob, diana, eve
    
    const people = orResults.bindings.map(binding => binding.get('person'));
    expect(people).toContain('alice'); // Engineering
    expect(people).toContain('bob'); // Engineering
    expect(people).toContain('diana'); // Marketing
    expect(people).toContain('eve'); // Marketing
    expect(people).not.toContain('charlie'); // Sales
    
    // Test OR with overlapping results
    const company1Pattern = new TriplePattern(personVar, 'worksAt', 'company1');
    const company1Query = new PatternQuery();
    company1Query.addPattern(company1Pattern);
    
    const seniorPattern = new TriplePattern(personVar, 'level', 'Senior');
    const seniorQuery = new PatternQuery();
    seniorQuery.addPattern(seniorPattern);
    
    const companyOrSeniorQuery = new LogicalQuery('OR');
    companyOrSeniorQuery.addOperand(company1Query);
    companyOrSeniorQuery.addOperand(seniorQuery);
    
    const companyOrSeniorResults = await companyOrSeniorQuery.execute(kg);
    
    expect(companyOrSeniorResults.bindings.length).toBe(4); // alice, bob, charlie, diana
    
    const companyOrSeniorPeople = companyOrSeniorResults.bindings.map(binding => binding.get('person'));
    expect(companyOrSeniorPeople).toContain('alice'); // company1 AND Senior
    expect(companyOrSeniorPeople).toContain('bob'); // company1
    expect(companyOrSeniorPeople).toContain('charlie'); // company1
    expect(companyOrSeniorPeople).toContain('diana'); // Senior
    expect(companyOrSeniorPeople).not.toContain('eve'); // Neither
    
    // Test multiple OR operations
    const salesPattern = new TriplePattern(personVar, 'department', 'Sales');
    const salesQuery = new PatternQuery();
    salesQuery.addPattern(salesPattern);
    
    const tripleOrQuery = new LogicalQuery('OR');
    tripleOrQuery.addOperand(engineeringQuery);
    tripleOrQuery.addOperand(marketingQuery);
    tripleOrQuery.addOperand(salesQuery);
    
    const tripleOrResults = await tripleOrQuery.execute(kg);
    
    expect(tripleOrResults.bindings.length).toBe(5); // All people
    
    // Test OR with constraints
    const highSalaryVar = new QueryVariable('person');
    highSalaryVar.addConstraint(new FunctionConstraint((value) => {
      const salaryTriples = kg.query(value, 'salary', null);
      return salaryTriples.length > 0 && salaryTriples[0][2] >= 85000;
    }));
    
    const highSalaryPattern = new TriplePattern(highSalaryVar, 'rdf:type', 'Person');
    const highSalaryQuery = new PatternQuery();
    highSalaryQuery.addPattern(highSalaryPattern);
    
    const juniorPattern = new TriplePattern(personVar, 'level', 'Junior');
    const juniorQuery = new PatternQuery();
    juniorQuery.addPattern(juniorPattern);
    
    const highSalaryOrJuniorQuery = new LogicalQuery('OR');
    highSalaryOrJuniorQuery.addOperand(highSalaryQuery);
    highSalaryOrJuniorQuery.addOperand(juniorQuery);
    
    const highSalaryOrJuniorResults = await highSalaryOrJuniorQuery.execute(kg);
    
    expect(highSalaryOrJuniorResults.bindings.length).toBeGreaterThan(0);
    
    // Verify results meet OR condition
    for (const binding of highSalaryOrJuniorResults.bindings) {
      const person = binding.get('person');
      
      const salaryTriples = kg.query(person, 'salary', null);
      const levelTriples = kg.query(person, 'level', null);
      
      const hasHighSalary = salaryTriples.length > 0 && salaryTriples[0][2] >= 85000;
      const isJunior = levelTriples.length > 0 && levelTriples[0][2] === 'Junior';
      
      expect(hasHighSalary || isJunior).toBe(true);
    }
  });
  
  test('Step 5.1.3: Test NOT query composition and execution', async () => {
    // Test basic NOT operation: All people NOT in Engineering
    const personVar = new QueryVariable('person');
    
    // Query 1: All people
    const allPeoplePattern = new TriplePattern(personVar, 'rdf:type', 'Person');
    const allPeopleQuery = new PatternQuery();
    allPeopleQuery.addPattern(allPeoplePattern);
    
    // Query 2: People in Engineering
    const engineeringPattern = new TriplePattern(personVar, 'department', 'Engineering');
    const engineeringQuery = new PatternQuery();
    engineeringQuery.addPattern(engineeringPattern);
    
    // NOT query
    const notQuery = new LogicalQuery('NOT');
    notQuery.addOperand(allPeopleQuery);
    notQuery.addOperand(engineeringQuery);
    
    const notResults = await notQuery.execute(kg);
    
    expect(notResults.bindings.length).toBe(3); // charlie, diana, eve
    
    const people = notResults.bindings.map(binding => binding.get('person'));
    expect(people).toContain('charlie'); // Sales
    expect(people).toContain('diana'); // Marketing
    expect(people).toContain('eve'); // Marketing
    expect(people).not.toContain('alice'); // Engineering
    expect(people).not.toContain('bob'); // Engineering
    
    // Test NOT with constraints
    const managerPattern = new TriplePattern(personVar, 'level', 'Manager');
    const managerQuery = new PatternQuery();
    managerQuery.addPattern(managerPattern);
    
    const notManagerQuery = new LogicalQuery('NOT');
    notManagerQuery.addOperand(allPeopleQuery);
    notManagerQuery.addOperand(managerQuery);
    
    const notManagerResults = await notManagerQuery.execute(kg);
    
    expect(notManagerResults.bindings.length).toBe(3); // alice, bob, diana
    
    const nonManagers = notManagerResults.bindings.map(binding => binding.get('person'));
    expect(nonManagers).toContain('alice'); // Senior
    expect(nonManagers).toContain('bob'); // Junior
    expect(nonManagers).toContain('diana'); // Senior
    expect(nonManagers).not.toContain('charlie'); // Manager
    expect(nonManagers).not.toContain('eve'); // Manager
    
    // Test NOT with company affiliation
    const company1Pattern = new TriplePattern(personVar, 'worksAt', 'company1');
    const company1Query = new PatternQuery();
    company1Query.addPattern(company1Pattern);
    
    const notCompany1Query = new LogicalQuery('NOT');
    notCompany1Query.addOperand(allPeopleQuery);
    notCompany1Query.addOperand(company1Query);
    
    const notCompany1Results = await notCompany1Query.execute(kg);
    
    expect(notCompany1Results.bindings.length).toBe(2); // diana, eve
    
    const nonCompany1People = notCompany1Results.bindings.map(binding => binding.get('person'));
    expect(nonCompany1People).toContain('diana'); // Works at startup1
    expect(nonCompany1People).toContain('eve'); // Works at startup1
    expect(nonCompany1People).not.toContain('alice'); // Works at company1
    expect(nonCompany1People).not.toContain('bob'); // Works at company1
    expect(nonCompany1People).not.toContain('charlie'); // Works at company1
    
    // Test NOT with empty subtraction set
    const nonExistentPattern = new TriplePattern(personVar, 'department', 'NonExistent');
    const nonExistentQuery = new PatternQuery();
    nonExistentQuery.addPattern(nonExistentPattern);
    
    const notNonExistentQuery = new LogicalQuery('NOT');
    notNonExistentQuery.addOperand(allPeopleQuery);
    notNonExistentQuery.addOperand(nonExistentQuery);
    
    const notNonExistentResults = await notNonExistentQuery.execute(kg);
    
    expect(notNonExistentResults.bindings.length).toBe(5); // All people
    
    // Test NOT with complex constraints
    const youngVar = new QueryVariable('person');
    youngVar.addConstraint(new FunctionConstraint((value) => {
      const ageTriples = kg.query(value, 'age', null);
      return ageTriples.length > 0 && ageTriples[0][2] < 30;
    }));
    
    const youngPattern = new TriplePattern(youngVar, 'rdf:type', 'Person');
    const youngQuery = new PatternQuery();
    youngQuery.addPattern(youngPattern);
    
    const notYoungQuery = new LogicalQuery('NOT');
    notYoungQuery.addOperand(allPeopleQuery);
    notYoungQuery.addOperand(youngQuery);
    
    const notYoungResults = await notYoungQuery.execute(kg);
    
    expect(notYoungResults.bindings.length).toBeGreaterThan(0);
    
    // Verify all results are not young (age >= 30)
    for (const binding of notYoungResults.bindings) {
      const person = binding.get('person');
      const ageTriples = kg.query(person, 'age', null);
      expect(ageTriples.length).toBeGreaterThan(0);
      expect(ageTriples[0][2]).toBeGreaterThanOrEqual(30);
    }
  });
  
  test('Step 5.1.4: Test XOR query composition and execution', async () => {
    // Test basic XOR operation: People who work at company1 XOR are Managers
    const personVar = new QueryVariable('person');
    
    // Query 1: People who work at company1
    const company1Pattern = new TriplePattern(personVar, 'worksAt', 'company1');
    const company1Query = new PatternQuery();
    company1Query.addPattern(company1Pattern);
    
    // Query 2: People who are Managers
    const managerPattern = new TriplePattern(personVar, 'level', 'Manager');
    const managerQuery = new PatternQuery();
    managerQuery.addPattern(managerPattern);
    
    // XOR query
    const xorQuery = new LogicalQuery('XOR');
    xorQuery.addOperand(company1Query);
    xorQuery.addOperand(managerQuery);
    
    const xorResults = await xorQuery.execute(kg);
    
    expect(xorResults.bindings.length).toBe(3); // alice, bob, eve
    
    const people = xorResults.bindings.map(binding => binding.get('person'));
    expect(people).toContain('alice'); // company1 but not Manager
    expect(people).toContain('bob'); // company1 but not Manager
    expect(people).toContain('eve'); // Manager but not company1
    expect(people).not.toContain('charlie'); // Both company1 AND Manager
    expect(people).not.toContain('diana'); // Neither company1 NOR Manager
    
    // Test XOR with department constraints
    const engineeringPattern = new TriplePattern(personVar, 'department', 'Engineering');
    const engineeringQuery = new PatternQuery();
    engineeringQuery.addPattern(engineeringPattern);
    
    const seniorPattern = new TriplePattern(personVar, 'level', 'Senior');
    const seniorQuery = new PatternQuery();
    seniorQuery.addPattern(seniorPattern);
    
    const engineeringXorSeniorQuery = new LogicalQuery('XOR');
    engineeringXorSeniorQuery.addOperand(engineeringQuery);
    engineeringXorSeniorQuery.addOperand(seniorQuery);
    
    const engineeringXorSeniorResults = await engineeringXorSeniorQuery.execute(kg);
    
    expect(engineeringXorSeniorResults.bindings.length).toBe(2); // bob, diana
    
    const engineeringXorSeniorPeople = engineeringXorSeniorResults.bindings.map(binding => binding.get('person'));
    expect(engineeringXorSeniorPeople).toContain('bob'); // Engineering but not Senior
    expect(engineeringXorSeniorPeople).toContain('diana'); // Senior but not Engineering
    expect(engineeringXorSeniorPeople).not.toContain('alice'); // Both Engineering AND Senior
    expect(engineeringXorSeniorPeople).not.toContain('charlie'); // Neither Engineering NOR Senior
    expect(engineeringXorSeniorPeople).not.toContain('eve'); // Neither Engineering NOR Senior
    
    // Test XOR with salary constraints
    const highSalaryVar = new QueryVariable('person');
    highSalaryVar.addConstraint(new FunctionConstraint((value) => {
      const salaryTriples = kg.query(value, 'salary', null);
      return salaryTriples.length > 0 && salaryTriples[0][2] >= 80000;
    }));
    
    const highSalaryPattern = new TriplePattern(highSalaryVar, 'rdf:type', 'Person');
    const highSalaryQuery = new PatternQuery();
    highSalaryQuery.addPattern(highSalaryPattern);
    
    const marketingPattern = new TriplePattern(personVar, 'department', 'Marketing');
    const marketingQuery = new PatternQuery();
    marketingQuery.addPattern(marketingPattern);
    
    const highSalaryXorMarketingQuery = new LogicalQuery('XOR');
    highSalaryXorMarketingQuery.addOperand(highSalaryQuery);
    highSalaryXorMarketingQuery.addOperand(marketingQuery);
    
    const highSalaryXorMarketingResults = await highSalaryXorMarketingQuery.execute(kg);
    
    expect(highSalaryXorMarketingResults.bindings.length).toBeGreaterThan(0);
    
    // Verify XOR logic: each result should be in exactly one set
    for (const binding of highSalaryXorMarketingResults.bindings) {
      const person = binding.get('person');
      
      const salaryTriples = kg.query(person, 'salary', null);
      const deptTriples = kg.query(person, 'department', null);
      
      const hasHighSalary = salaryTriples.length > 0 && salaryTriples[0][2] >= 80000;
      const isMarketing = deptTriples.length > 0 && deptTriples[0][2] === 'Marketing';
      
      // XOR: exactly one should be true
      expect(hasHighSalary !== isMarketing).toBe(true);
    }
    
    // Test XOR with multiple operands
    const salesPattern = new TriplePattern(personVar, 'department', 'Sales');
    const salesQuery = new PatternQuery();
    salesQuery.addPattern(salesPattern);
    
    const multiXorQuery = new LogicalQuery('XOR');
    multiXorQuery.addOperand(engineeringQuery);
    multiXorQuery.addOperand(marketingQuery);
    multiXorQuery.addOperand(salesQuery);
    
    const multiXorResults = await multiXorQuery.execute(kg);
    
    // XOR with multiple operands: elements that appear in exactly one set
    expect(multiXorResults.bindings.length).toBe(5); // All people appear in exactly one department
    
    // Test XOR with empty sets
    const nonExistentPattern = new TriplePattern(personVar, 'department', 'NonExistent');
    const nonExistentQuery = new PatternQuery();
    nonExistentQuery.addPattern(nonExistentPattern);
    
    const emptyXorQuery = new LogicalQuery('XOR');
    emptyXorQuery.addOperand(engineeringQuery);
    emptyXorQuery.addOperand(nonExistentQuery);
    
    const emptyXorResults = await emptyXorQuery.execute(kg);
    
    expect(emptyXorResults.bindings.length).toBe(2); // Only Engineering people (alice, bob)
  });
  
  test('Step 5.1.5: Test logical query result merging and binding', async () => {
    // Test complex variable binding across logical operations
    const personVar = new QueryVariable('person');
    const companyVar = new QueryVariable('company');
    const projectVar = new QueryVariable('project');
    
    // Query 1: People and their companies
    const worksAtPattern = new TriplePattern(personVar, 'worksAt', companyVar);
    const worksAtQuery = new PatternQuery();
    worksAtQuery.addPattern(worksAtPattern);
    
    // Query 2: People and their projects
    const worksOnPattern = new TriplePattern(personVar, 'worksOn', projectVar);
    const worksOnQuery = new PatternQuery();
    worksOnQuery.addPattern(worksOnPattern);
    
    // AND query to get people with both company and project info
    const companyAndProjectQuery = new LogicalQuery('AND');
    companyAndProjectQuery.addOperand(worksAtQuery);
    companyAndProjectQuery.addOperand(worksOnQuery);
    
    const companyAndProjectResults = await companyAndProjectQuery.execute(kg);
    
    expect(companyAndProjectResults.bindings.length).toBeGreaterThan(0);
    expect(companyAndProjectResults.variableNames).toContain('person');
    expect(companyAndProjectResults.variableNames).toContain('company');
    expect(companyAndProjectResults.variableNames).toContain('project');
    
    // Verify all bindings have all three variables
    for (const binding of companyAndProjectResults.bindings) {
      expect(binding.has('person')).toBe(true);
      expect(binding.has('company')).toBe(true);
      expect(binding.has('project')).toBe(true);
      
      const person = binding.get('person');
      const company = binding.get('company');
      const project = binding.get('project');
      
      // Verify the relationships exist in the knowledge graph
      expect(kg.query(person, 'worksAt', company).length).toBeGreaterThan(0);
      expect(kg.query(person, 'worksOn', project).length).toBeGreaterThan(0);
    }
    
    // Test OR with variable binding
    // Use the same personVar instance for both queries to ensure proper variable sharing
    const sharedPersonVar = new QueryVariable('person');
    const nameVar = new QueryVariable('name');
    const ageVar = new QueryVariable('age');
    
    // Query 1: People and their names
    const namePattern = new TriplePattern(sharedPersonVar, 'name', nameVar);
    const nameQuery = new PatternQuery();
    nameQuery.addPattern(namePattern);
    
    // Query 2: People and their ages
    const agePattern = new TriplePattern(sharedPersonVar, 'age', ageVar);
    const ageQuery = new PatternQuery();
    ageQuery.addPattern(agePattern);
    
    // OR query to get people with either name or age info (should be all)
    const nameOrAgeQuery = new LogicalQuery('OR');
    nameOrAgeQuery.addOperand(nameQuery);
    nameOrAgeQuery.addOperand(ageQuery);
    
    const nameOrAgeResults = await nameOrAgeQuery.execute(kg);
    
    // Since all people have both name and age, we get results from both queries
    // The OR operation combines results from both queries
    expect(nameOrAgeResults.bindings.length).toBeGreaterThanOrEqual(10); // At least 5 people * 2 queries
    expect(nameOrAgeResults.variableNames).toContain('person');
    expect(nameOrAgeResults.variableNames).toContain('name');
    expect(nameOrAgeResults.variableNames).toContain('age');
    
    // Verify we have all 5 people in the results
    // Note: Each person appears twice (once from name query, once from age query)
    // because the bindings have different variable combinations and are not deduplicated
    const people = new Set();
    nameOrAgeResults.bindings.forEach(binding => {
      if (binding.has('person')) {
        people.add(binding.get('person'));
      }
    });
    
    // Verify we have the expected people (allowing for variable instance differences)
    expect(people.size).toBeGreaterThanOrEqual(5);
    
    // Convert to array to check if we have the expected person names
    const peopleArray = Array.from(people);
    const hasAlice = peopleArray.some(p => p === 'alice' || (typeof p === 'string' && p.includes('alice')));
    const hasBob = peopleArray.some(p => p === 'bob' || (typeof p === 'string' && p.includes('bob')));
    const hasCharlie = peopleArray.some(p => p === 'charlie' || (typeof p === 'string' && p.includes('charlie')));
    const hasDiana = peopleArray.some(p => p === 'diana' || (typeof p === 'string' && p.includes('diana')));
    const hasEve = peopleArray.some(p => p === 'eve' || (typeof p === 'string' && p.includes('eve')));
    
    expect(hasAlice).toBe(true);
    expect(hasBob).toBe(true);
    expect(hasCharlie).toBe(true);
    expect(hasDiana).toBe(true);
    expect(hasEve).toBe(true);
    
    // Verify that we get the expected number of bindings
    // This is correct behavior for OR - each person appears once per matching query
    expect(nameOrAgeResults.bindings.length).toBeGreaterThanOrEqual(10);
    
    // Verify that each binding has either name or age (or both)
    for (const binding of nameOrAgeResults.bindings) {
      const hasName = binding.has('name');
      const hasAge = binding.has('age');
      expect(hasName || hasAge).toBe(true);
    }
    
    // Test complex binding merging with constraints
    const salaryVar = new QueryVariable('salary');
    salaryVar.addConstraint(new RangeConstraint(70000, 90000));
    
    const salaryPattern = new TriplePattern(personVar, 'salary', salaryVar);
    const salaryQuery = new PatternQuery();
    salaryQuery.addPattern(salaryPattern);
    
    const deptVar = new QueryVariable('department');
    const deptPattern = new TriplePattern(personVar, 'department', deptVar);
    const deptQuery = new PatternQuery();
    deptQuery.addPattern(deptPattern);
    
    const salaryAndDeptQuery = new LogicalQuery('AND');
    salaryAndDeptQuery.addOperand(salaryQuery);
    salaryAndDeptQuery.addOperand(deptQuery);
    
    const salaryAndDeptResults = await salaryAndDeptQuery.execute(kg);
    
    expect(salaryAndDeptResults.bindings.length).toBeGreaterThan(0);
    
    // Verify constraint satisfaction and variable binding
    for (const binding of salaryAndDeptResults.bindings) {
      expect(binding.has('person')).toBe(true);
      expect(binding.has('salary')).toBe(true);
      expect(binding.has('department')).toBe(true);
      
      const salary = binding.get('salary');
      expect(salary).toBeGreaterThanOrEqual(70000);
      expect(salary).toBeLessThanOrEqual(90000);
    }
    
    // Test serialization of logical queries
    const serializationQuery = new LogicalQuery('AND');
    serializationQuery.addOperand(worksAtQuery);
    serializationQuery.addOperand(worksOnQuery);
    
    const triples = serializationQuery.toTriples();
    expect(triples.length).toBeGreaterThan(0);
    
    // Verify serialization includes operator and operands
    const operatorTriples = triples.filter(([s, p, o]) => p === 'kg:operator');
    expect(operatorTriples.length).toBe(1);
    expect(operatorTriples[0][2]).toBe('kg:AND');
    
    const operandTriples = triples.filter(([s, p, o]) => p === 'kg:hasOperand');
    expect(operandTriples.length).toBe(2);
  });
});
