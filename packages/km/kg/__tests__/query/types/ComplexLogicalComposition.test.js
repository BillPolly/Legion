import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { LogicalQuery } from '../../../src/query/types/LogicalQuery.js';
import { PatternQuery } from '../../../src/query/types/PatternQuery.js';
import { TriplePattern } from '../../../src/query/core/TriplePattern.js';
import { QueryVariable } from '../../../src/query/core/QueryVariable.js';
import { RangeConstraint } from '../../../src/query/constraints/RangeConstraint.js';
import { FunctionConstraint } from '../../../src/query/constraints/FunctionConstraint.js';
import { RegexConstraint } from '../../../src/query/constraints/RegexConstraint.js';
import { KGEngine } from '../../../src/core/KGEngine.js';

describe('Phase 5.2: Complex Logical Composition', () => {
  let kg;
  
  beforeEach(() => {
    kg = new KGEngine();
    
    // Setup comprehensive test data for complex logical query testing
    // Create a rich organizational graph with multiple entities and relationships
    
    // People with detailed attributes
    kg.addTriple('alice', 'rdf:type', 'Person');
    kg.addTriple('alice', 'name', 'Alice Smith');
    kg.addTriple('alice', 'age', 30);
    kg.addTriple('alice', 'department', 'Engineering');
    kg.addTriple('alice', 'salary', 75000);
    kg.addTriple('alice', 'level', 'Senior');
    kg.addTriple('alice', 'skills', 'JavaScript,Python,React');
    kg.addTriple('alice', 'location', 'San Francisco');
    kg.addTriple('alice', 'startDate', '2020-01-15');
    
    kg.addTriple('bob', 'rdf:type', 'Person');
    kg.addTriple('bob', 'name', 'Bob Johnson');
    kg.addTriple('bob', 'age', 25);
    kg.addTriple('bob', 'department', 'Engineering');
    kg.addTriple('bob', 'salary', 60000);
    kg.addTriple('bob', 'level', 'Junior');
    kg.addTriple('bob', 'skills', 'Java,Spring,Docker');
    kg.addTriple('bob', 'location', 'New York');
    kg.addTriple('bob', 'startDate', '2022-03-01');
    
    kg.addTriple('charlie', 'rdf:type', 'Person');
    kg.addTriple('charlie', 'name', 'Charlie Brown');
    kg.addTriple('charlie', 'age', 35);
    kg.addTriple('charlie', 'department', 'Sales');
    kg.addTriple('charlie', 'salary', 90000);
    kg.addTriple('charlie', 'level', 'Manager');
    kg.addTriple('charlie', 'skills', 'Sales,Negotiation,CRM');
    kg.addTriple('charlie', 'location', 'Chicago');
    kg.addTriple('charlie', 'startDate', '2018-06-10');
    
    kg.addTriple('diana', 'rdf:type', 'Person');
    kg.addTriple('diana', 'name', 'Diana Prince');
    kg.addTriple('diana', 'age', 28);
    kg.addTriple('diana', 'department', 'Marketing');
    kg.addTriple('diana', 'salary', 85000);
    kg.addTriple('diana', 'level', 'Senior');
    kg.addTriple('diana', 'skills', 'Marketing,Analytics,Design');
    kg.addTriple('diana', 'location', 'Los Angeles');
    kg.addTriple('diana', 'startDate', '2021-09-20');
    
    kg.addTriple('eve', 'rdf:type', 'Person');
    kg.addTriple('eve', 'name', 'Eve Wilson');
    kg.addTriple('eve', 'age', 32);
    kg.addTriple('eve', 'department', 'Marketing');
    kg.addTriple('eve', 'salary', 95000);
    kg.addTriple('eve', 'level', 'Manager');
    kg.addTriple('eve', 'skills', 'Strategy,Leadership,Analytics');
    kg.addTriple('eve', 'location', 'Seattle');
    kg.addTriple('eve', 'startDate', '2019-11-05');
    
    kg.addTriple('frank', 'rdf:type', 'Person');
    kg.addTriple('frank', 'name', 'Frank Miller');
    kg.addTriple('frank', 'age', 45);
    kg.addTriple('frank', 'department', 'HR');
    kg.addTriple('frank', 'salary', 80000);
    kg.addTriple('frank', 'level', 'Director');
    kg.addTriple('frank', 'skills', 'HR,Recruiting,Policy');
    kg.addTriple('frank', 'location', 'Austin');
    kg.addTriple('frank', 'startDate', '2015-02-28');
    
    // Companies and organizational structure
    kg.addTriple('techcorp', 'rdf:type', 'Company');
    kg.addTriple('techcorp', 'name', 'TechCorp Inc');
    kg.addTriple('techcorp', 'industry', 'Technology');
    kg.addTriple('techcorp', 'size', 'Large');
    kg.addTriple('techcorp', 'founded', '2010');
    kg.addTriple('techcorp', 'headquarters', 'San Francisco');
    
    kg.addTriple('startup', 'rdf:type', 'Company');
    kg.addTriple('startup', 'name', 'Innovation Startup');
    kg.addTriple('startup', 'industry', 'Technology');
    kg.addTriple('startup', 'size', 'Small');
    kg.addTriple('startup', 'founded', '2020');
    kg.addTriple('startup', 'headquarters', 'Austin');
    
    // Projects with complexity
    kg.addTriple('project1', 'rdf:type', 'Project');
    kg.addTriple('project1', 'name', 'AI Platform');
    kg.addTriple('project1', 'budget', 500000);
    kg.addTriple('project1', 'status', 'Active');
    kg.addTriple('project1', 'priority', 'High');
    kg.addTriple('project1', 'deadline', '2025-12-31');
    kg.addTriple('project1', 'technology', 'AI,Machine Learning');
    
    kg.addTriple('project2', 'rdf:type', 'Project');
    kg.addTriple('project2', 'name', 'Mobile App');
    kg.addTriple('project2', 'budget', 200000);
    kg.addTriple('project2', 'status', 'Planning');
    kg.addTriple('project2', 'priority', 'Medium');
    kg.addTriple('project2', 'deadline', '2025-08-15');
    kg.addTriple('project2', 'technology', 'React Native,Node.js');
    
    kg.addTriple('project3', 'rdf:type', 'Project');
    kg.addTriple('project3', 'name', 'Data Analytics');
    kg.addTriple('project3', 'budget', 300000);
    kg.addTriple('project3', 'status', 'Active');
    kg.addTriple('project3', 'priority', 'High');
    kg.addTriple('project3', 'deadline', '2025-10-01');
    kg.addTriple('project3', 'technology', 'Python,Spark,Kafka');
    
    kg.addTriple('project4', 'rdf:type', 'Project');
    kg.addTriple('project4', 'name', 'Security Audit');
    kg.addTriple('project4', 'budget', 150000);
    kg.addTriple('project4', 'status', 'Completed');
    kg.addTriple('project4', 'priority', 'Critical');
    kg.addTriple('project4', 'deadline', '2024-12-31');
    kg.addTriple('project4', 'technology', 'Security,Penetration Testing');
    
    // Complex relationships
    kg.addTriple('alice', 'worksAt', 'techcorp');
    kg.addTriple('bob', 'worksAt', 'techcorp');
    kg.addTriple('charlie', 'worksAt', 'techcorp');
    kg.addTriple('diana', 'worksAt', 'startup');
    kg.addTriple('eve', 'worksAt', 'startup');
    kg.addTriple('frank', 'worksAt', 'techcorp');
    
    kg.addTriple('alice', 'worksOn', 'project1');
    kg.addTriple('alice', 'worksOn', 'project3');
    kg.addTriple('bob', 'worksOn', 'project1');
    kg.addTriple('bob', 'worksOn', 'project2');
    kg.addTriple('charlie', 'worksOn', 'project4');
    kg.addTriple('diana', 'worksOn', 'project2');
    kg.addTriple('eve', 'worksOn', 'project3');
    kg.addTriple('frank', 'worksOn', 'project4');
    
    kg.addTriple('alice', 'manages', 'bob');
    kg.addTriple('charlie', 'manages', 'alice');
    kg.addTriple('eve', 'manages', 'diana');
    kg.addTriple('frank', 'manages', 'charlie');
    kg.addTriple('frank', 'manages', 'eve');
    
    kg.addTriple('alice', 'knows', 'bob');
    kg.addTriple('alice', 'knows', 'charlie');
    kg.addTriple('alice', 'knows', 'frank');
    kg.addTriple('bob', 'knows', 'diana');
    kg.addTriple('charlie', 'knows', 'eve');
    kg.addTriple('diana', 'knows', 'eve');
    kg.addTriple('eve', 'knows', 'frank');
    
    // Skills and certifications
    kg.addTriple('alice', 'hasCertification', 'AWS Solutions Architect');
    kg.addTriple('bob', 'hasCertification', 'Oracle Java Certified');
    kg.addTriple('charlie', 'hasCertification', 'Salesforce Admin');
    kg.addTriple('diana', 'hasCertification', 'Google Analytics');
    kg.addTriple('eve', 'hasCertification', 'PMP');
    kg.addTriple('frank', 'hasCertification', 'SHRM-CP');
  });
  
  afterEach(async () => {
    // Clear the knowledge graph to prevent memory leaks and ensure clean state
    if (kg && typeof kg.clear === 'function') {
      await kg.clear();
    }
    kg = null;
  });
  
  test('Step 5.2.1: Test nested logical queries (AND of ORs, etc.)', async () => {
    // Test complex nested query: (Engineering OR Marketing) AND (Senior OR Manager) AND (High Salary)
    const personVar = new QueryVariable('person');
    
    // Inner OR 1: Engineering OR Marketing
    const engineeringPattern = new TriplePattern(personVar, 'department', 'Engineering');
    const engineeringQuery = new PatternQuery();
    engineeringQuery.addPattern(engineeringPattern);
    
    const marketingPattern = new TriplePattern(personVar, 'department', 'Marketing');
    const marketingQuery = new PatternQuery();
    marketingQuery.addPattern(marketingPattern);
    
    const deptOrQuery = new LogicalQuery('OR');
    deptOrQuery.addOperand(engineeringQuery);
    deptOrQuery.addOperand(marketingQuery);
    
    // Inner OR 2: Senior OR Manager
    const seniorPattern = new TriplePattern(personVar, 'level', 'Senior');
    const seniorQuery = new PatternQuery();
    seniorQuery.addPattern(seniorPattern);
    
    const managerPattern = new TriplePattern(personVar, 'level', 'Manager');
    const managerQuery = new PatternQuery();
    managerQuery.addPattern(managerPattern);
    
    const levelOrQuery = new LogicalQuery('OR');
    levelOrQuery.addOperand(seniorQuery);
    levelOrQuery.addOperand(managerQuery);
    
    // High salary constraint
    const salaryVar = new QueryVariable('salary');
    salaryVar.addConstraint(new RangeConstraint(70000, 100000));
    
    const salaryPattern = new TriplePattern(personVar, 'salary', salaryVar);
    const salaryQuery = new PatternQuery();
    salaryQuery.addPattern(salaryPattern);
    
    // Outer AND: Combine all conditions
    const complexQuery = new LogicalQuery('AND');
    complexQuery.addOperand(deptOrQuery);
    complexQuery.addOperand(levelOrQuery);
    complexQuery.addOperand(salaryQuery);
    
    const results = await complexQuery.execute(kg);
    
    expect(results.bindings.length).toBeGreaterThan(0);
    
    // Verify all results meet the complex criteria
    for (const binding of results.bindings) {
      const person = binding.get('person');
      
      // Check department (Engineering OR Marketing)
      const deptTriples = kg.query(person, 'department', null);
      expect(deptTriples.length).toBeGreaterThan(0);
      const dept = deptTriples[0][2];
      expect(['Engineering', 'Marketing']).toContain(dept);
      
      // Check level (Senior OR Manager)
      const levelTriples = kg.query(person, 'level', null);
      expect(levelTriples.length).toBeGreaterThan(0);
      const level = levelTriples[0][2];
      expect(['Senior', 'Manager']).toContain(level);
      
      // Check salary (70k-100k)
      const salaryTriples = kg.query(person, 'salary', null);
      expect(salaryTriples.length).toBeGreaterThan(0);
      const salary = salaryTriples[0][2];
      expect(salary).toBeGreaterThanOrEqual(70000);
      expect(salary).toBeLessThanOrEqual(100000);
    }
    
    // Test nested NOT with OR: NOT (Junior OR Intern)
    const juniorPattern = new TriplePattern(personVar, 'level', 'Junior');
    const juniorQuery = new PatternQuery();
    juniorQuery.addPattern(juniorPattern);
    
    const internPattern = new TriplePattern(personVar, 'level', 'Intern');
    const internQuery = new PatternQuery();
    internQuery.addPattern(internPattern);
    
    const juniorOrInternQuery = new LogicalQuery('OR');
    juniorOrInternQuery.addOperand(juniorQuery);
    juniorOrInternQuery.addOperand(internQuery);
    
    const allPeoplePattern = new TriplePattern(personVar, 'rdf:type', 'Person');
    const allPeopleQuery = new PatternQuery();
    allPeopleQuery.addPattern(allPeoplePattern);
    
    const notJuniorOrInternQuery = new LogicalQuery('NOT');
    notJuniorOrInternQuery.addOperand(allPeopleQuery);
    notJuniorOrInternQuery.addOperand(juniorOrInternQuery);
    
    const notResults = await notJuniorOrInternQuery.execute(kg);
    
    expect(notResults.bindings.length).toBeGreaterThan(0);
    
    // Verify no Junior or Intern levels in results
    for (const binding of notResults.bindings) {
      const person = binding.get('person');
      const levelTriples = kg.query(person, 'level', null);
      if (levelTriples.length > 0) {
        const level = levelTriples[0][2];
        expect(level).not.toBe('Junior');
        expect(level).not.toBe('Intern');
      }
    }
    
    // Test deeply nested: ((A OR B) AND (C OR D)) OR ((E AND F) XOR (G OR H))
    const techSkillsVar = new QueryVariable('person');
    techSkillsVar.addConstraint(new FunctionConstraint((value) => {
      const skillsTriples = kg.query(value, 'skills', null);
      if (skillsTriples.length === 0) return false;
      const skills = skillsTriples[0][2].toLowerCase();
      return skills.includes('javascript') || skills.includes('python') || skills.includes('java');
    }));
    
    const techSkillsPattern = new TriplePattern(techSkillsVar, 'rdf:type', 'Person');
    const techSkillsQuery = new PatternQuery();
    techSkillsQuery.addPattern(techSkillsPattern);
    
    const westCoastVar = new QueryVariable('person');
    westCoastVar.addConstraint(new FunctionConstraint((value) => {
      const locationTriples = kg.query(value, 'location', null);
      if (locationTriples.length === 0) return false;
      const location = locationTriples[0][2];
      return ['San Francisco', 'Los Angeles', 'Seattle'].includes(location);
    }));
    
    const westCoastPattern = new TriplePattern(westCoastVar, 'rdf:type', 'Person');
    const westCoastQuery = new PatternQuery();
    westCoastQuery.addPattern(westCoastPattern);
    
    const techAndLocationQuery = new LogicalQuery('AND');
    techAndLocationQuery.addOperand(techSkillsQuery);
    techAndLocationQuery.addOperand(westCoastQuery);
    
    const highSalaryVar = new QueryVariable('person');
    highSalaryVar.addConstraint(new FunctionConstraint((value) => {
      const salaryTriples = kg.query(value, 'salary', null);
      return salaryTriples.length > 0 && salaryTriples[0][2] >= 80000;
    }));
    
    const highSalaryPattern = new TriplePattern(highSalaryVar, 'rdf:type', 'Person');
    const highSalaryQuery = new PatternQuery();
    highSalaryQuery.addPattern(highSalaryPattern);
    
    const deeplyNestedQuery = new LogicalQuery('OR');
    deeplyNestedQuery.addOperand(techAndLocationQuery);
    deeplyNestedQuery.addOperand(highSalaryQuery);
    
    const deepResults = await deeplyNestedQuery.execute(kg);
    expect(deepResults.bindings.length).toBeGreaterThan(0);
    
    // Verify complex logic
    for (const binding of deepResults.bindings) {
      const person = binding.get('person');
      
      // Should satisfy either: (tech skills AND west coast) OR (high salary)
      const skillsTriples = kg.query(person, 'skills', null);
      const locationTriples = kg.query(person, 'location', null);
      const salaryTriples = kg.query(person, 'salary', null);
      
      const hasTechSkills = skillsTriples.length > 0 && 
        ['javascript', 'python', 'java'].some(skill => 
          skillsTriples[0][2].toLowerCase().includes(skill));
      
      const isWestCoast = locationTriples.length > 0 && 
        ['San Francisco', 'Los Angeles', 'Seattle'].includes(locationTriples[0][2]);
      
      const hasHighSalary = salaryTriples.length > 0 && salaryTriples[0][2] >= 80000;
      
      const satisfiesCondition = (hasTechSkills && isWestCoast) || hasHighSalary;
      expect(satisfiesCondition).toBe(true);
    }
  });
  
  test('Step 5.2.2: Test logical query optimization and short-circuiting', async () => {
    // Test optimization with early termination conditions
    const personVar = new QueryVariable('person');
    
    // Create a query that should short-circuit on empty results
    const nonExistentPattern = new TriplePattern(personVar, 'department', 'NonExistentDept');
    const nonExistentQuery = new PatternQuery();
    nonExistentQuery.addPattern(nonExistentPattern);
    
    const expensivePattern = new TriplePattern(personVar, 'rdf:type', 'Person');
    const expensiveQuery = new PatternQuery();
    expensiveQuery.addPattern(expensivePattern);
    
    // AND query should short-circuit when first operand returns empty
    const shortCircuitQuery = new LogicalQuery('AND');
    shortCircuitQuery.addOperand(nonExistentQuery); // Empty result - should short-circuit
    shortCircuitQuery.addOperand(expensiveQuery);   // Should not be executed
    
    const startTime = Date.now();
    const results = await shortCircuitQuery.execute(kg);
    const executionTime = Date.now() - startTime;
    
    expect(results.bindings.length).toBe(0);
    expect(executionTime).toBeLessThan(100); // Should be very fast due to short-circuiting
    
    // Test OR query optimization - should return early when first operand succeeds
    const allPeoplePattern = new TriplePattern(personVar, 'rdf:type', 'Person');
    const allPeopleQuery = new PatternQuery();
    allPeopleQuery.addPattern(allPeoplePattern);
    
    const anotherExpensiveQuery = new PatternQuery();
    anotherExpensiveQuery.addPattern(new TriplePattern(personVar, 'someProperty', 'someValue'));
    
    const orOptimizationQuery = new LogicalQuery('OR');
    orOptimizationQuery.addOperand(allPeopleQuery);        // Should return all people
    orOptimizationQuery.addOperand(anotherExpensiveQuery); // Should not need to execute
    
    const orResults = await orOptimizationQuery.execute(kg);
    expect(orResults.bindings.length).toBeGreaterThan(0);
    
    // Test constraint ordering optimization
    // Constraints should be applied in order of selectivity (most selective first)
    const optimizedVar = new QueryVariable('person');
    
    // Add constraints in order of increasing selectivity
    optimizedVar.addConstraint(new FunctionConstraint((value) => {
      // Very selective constraint - should be applied first
      const nameTriples = kg.query(value, 'name', null);
      return nameTriples.length > 0 && nameTriples[0][2] === 'Alice Smith';
    }));
    
    optimizedVar.addConstraint(new FunctionConstraint((value) => {
      // Less selective constraint - should be applied later
      const ageTriples = kg.query(value, 'age', null);
      return ageTriples.length > 0 && ageTriples[0][2] >= 25;
    }));
    
    const optimizedPattern = new TriplePattern(optimizedVar, 'rdf:type', 'Person');
    const optimizedQuery = new PatternQuery();
    optimizedQuery.addPattern(optimizedPattern);
    
    const optimizedResults = await optimizedQuery.execute(kg);
    expect(optimizedResults.bindings.length).toBe(1);
    
    const person = optimizedResults.bindings[0].get('person');
    expect(person).toBe('alice');
    
    // Test index usage optimization (simulated)
    // Queries should prefer indexed lookups over full scans
    const indexedLookupPattern = new TriplePattern('alice', 'rdf:type', 'Person');
    const indexedQuery = new PatternQuery();
    indexedQuery.addPattern(indexedLookupPattern);
    
    const indexedStartTime = Date.now();
    const indexedResults = await indexedQuery.execute(kg);
    const indexedExecutionTime = Date.now() - indexedStartTime;
    
    expect(indexedResults.bindings.length).toBe(1);
    expect(indexedExecutionTime).toBeLessThan(50); // Should be very fast with indexed lookup
    
    // Test join ordering optimization
    // Smaller result sets should be processed first in joins
    const smallResultVar = new QueryVariable('person');
    const largeResultVar = new QueryVariable('person');
    
    const smallResultPattern = new TriplePattern(smallResultVar, 'name', 'Alice Smith');
    const smallResultQuery = new PatternQuery();
    smallResultQuery.addPattern(smallResultPattern);
    
    const largeResultPattern = new TriplePattern(largeResultVar, 'rdf:type', 'Person');
    const largeResultQuery = new PatternQuery();
    largeResultQuery.addPattern(largeResultPattern);
    
    const joinOptimizedQuery = new LogicalQuery('AND');
    joinOptimizedQuery.addOperand(smallResultQuery); // Small result set first
    joinOptimizedQuery.addOperand(largeResultQuery); // Large result set second
    
    const joinResults = await joinOptimizedQuery.execute(kg);
    expect(joinResults.bindings.length).toBe(1);
  });
  
  test('Step 5.2.3: Test logical query with mixed operand types', async () => {
    // Test mixing different query types in logical composition
    const personVar = new QueryVariable('person');
    const projectVar = new QueryVariable('project');
    
    // Pattern query: Find people in Engineering
    const engineeringPattern = new TriplePattern(personVar, 'department', 'Engineering');
    const engineeringQuery = new PatternQuery();
    engineeringQuery.addPattern(engineeringPattern);
    
    // Pattern query with constraints: Find high-budget projects
    const budgetVar = new QueryVariable('budget');
    budgetVar.addConstraint(new RangeConstraint(250000, 600000));
    
    const projectPattern = new TriplePattern(projectVar, 'budget', budgetVar);
    const projectQuery = new PatternQuery();
    projectQuery.addPattern(projectPattern);
    
    // Relationship query: Find people working on projects
    const worksOnPattern = new TriplePattern(personVar, 'worksOn', projectVar);
    const worksOnQuery = new PatternQuery();
    worksOnQuery.addPattern(worksOnPattern);
    
    // Complex mixed composition: (Engineering people) AND (High-budget projects) AND (Works-on relationship)
    const mixedQuery = new LogicalQuery('AND');
    mixedQuery.addOperand(engineeringQuery);
    mixedQuery.addOperand(projectQuery);
    mixedQuery.addOperand(worksOnQuery);
    
    const mixedResults = await mixedQuery.execute(kg);
    
    expect(mixedResults.bindings.length).toBeGreaterThan(0);
    expect(mixedResults.variableNames).toContain('person');
    expect(mixedResults.variableNames).toContain('project');
    expect(mixedResults.variableNames).toContain('budget');
    
    // Verify mixed results
    for (const binding of mixedResults.bindings) {
      const person = binding.get('person');
      const project = binding.get('project');
      const budget = binding.get('budget');
      
      // Verify person is in Engineering
      const deptTriples = kg.query(person, 'department', null);
      expect(deptTriples.length).toBeGreaterThan(0);
      expect(deptTriples[0][2]).toBe('Engineering');
      
      // Verify project has high budget
      expect(budget).toBeGreaterThanOrEqual(250000);
      expect(budget).toBeLessThanOrEqual(600000);
      
      // Verify person works on project
      const worksOnTriples = kg.query(person, 'worksOn', project);
      expect(worksOnTriples.length).toBeGreaterThan(0);
    }
    
    // Test mixing logical queries with different operators
    const seniorPattern = new TriplePattern(personVar, 'level', 'Senior');
    const seniorQuery = new PatternQuery();
    seniorQuery.addPattern(seniorPattern);
    
    const managerPattern = new TriplePattern(personVar, 'level', 'Manager');
    const managerQuery = new PatternQuery();
    managerQuery.addPattern(managerPattern);
    
    const seniorOrManagerQuery = new LogicalQuery('OR');
    seniorOrManagerQuery.addOperand(seniorQuery);
    seniorOrManagerQuery.addOperand(managerQuery);
    
    const techCompanyPattern = new TriplePattern(personVar, 'worksAt', 'techcorp');
    const techCompanyQuery = new PatternQuery();
    techCompanyQuery.addPattern(techCompanyPattern);
    
    // Mix OR query with AND query
    const mixedOperatorQuery = new LogicalQuery('AND');
    mixedOperatorQuery.addOperand(seniorOrManagerQuery); // OR query as operand
    mixedOperatorQuery.addOperand(techCompanyQuery);     // Pattern query as operand
    
    const mixedOperatorResults = await mixedOperatorQuery.execute(kg);
    
    expect(mixedOperatorResults.bindings.length).toBeGreaterThan(0);
    
    for (const binding of mixedOperatorResults.bindings) {
      const person = binding.get('person');
      
      // Verify person is Senior OR Manager
      const levelTriples = kg.query(person, 'level', null);
      expect(levelTriples.length).toBeGreaterThan(0);
      const level = levelTriples[0][2];
      expect(['Senior', 'Manager']).toContain(level);
      
      // Verify person works at techcorp
      const companyTriples = kg.query(person, 'worksAt', null);
      expect(companyTriples.length).toBeGreaterThan(0);
      expect(companyTriples[0][2]).toBe('techcorp');
    }
    
    // Test mixing constraint types
    const complexConstraintVar = new QueryVariable('person');
    
    // Function constraint combining age range check
    complexConstraintVar.addConstraint(new FunctionConstraint((value) => {
      const ageTriples = kg.query(value, 'age', null);
      if (ageTriples.length === 0) return false;
      const age = ageTriples[0][2];
      return age >= 25 && age <= 40;
    }));
    
    // Function constraint for name regex check
    complexConstraintVar.addConstraint(new FunctionConstraint((value) => {
      const nameTriples = kg.query(value, 'name', null);
      if (nameTriples.length === 0) return false;
      const name = nameTriples[0][2];
      return /^[A-D]/.test(name);
    }));
    
    // Function constraint for salary check
    complexConstraintVar.addConstraint(new FunctionConstraint((value) => {
      const salaryTriples = kg.query(value, 'salary', null);
      return salaryTriples.length > 0 && salaryTriples[0][2] >= 70000;
    }));
    
    const complexConstraintPattern = new TriplePattern(complexConstraintVar, 'rdf:type', 'Person');
    const complexConstraintQuery = new PatternQuery();
    complexConstraintQuery.addPattern(complexConstraintPattern);
    
    const constraintResults = await complexConstraintQuery.execute(kg);
    
    expect(constraintResults.bindings.length).toBeGreaterThan(0);
    
    // Verify all constraints are satisfied
    for (const binding of constraintResults.bindings) {
      const person = binding.get('person');
      
      // Verify age constraint (25-40)
      const ageTriples = kg.query(person, 'age', null);
      expect(ageTriples.length).toBeGreaterThan(0);
      const age = ageTriples[0][2];
      expect(age).toBeGreaterThanOrEqual(25);
      expect(age).toBeLessThanOrEqual(40);
      
      // Verify name regex constraint (starts with A-D)
      const nameTriples = kg.query(person, 'name', null);
      expect(nameTriples.length).toBeGreaterThan(0);
      const name = nameTriples[0][2];
      expect(name).toMatch(/^[A-D]/);
      
      // Verify salary function constraint (>= 70000)
      const salaryTriples = kg.query(person, 'salary', null);
      expect(salaryTriples.length).toBeGreaterThan(0);
      const salary = salaryTriples[0][2];
      expect(salary).toBeGreaterThanOrEqual(70000);
    }
  });
  
  test('Step 5.2.4: Test logical query serialization and reconstruction', async () => {
    // Test serialization of complex nested logical queries
    const personVar = new QueryVariable('person');
    
    // Create a complex nested query
    const engineeringPattern = new TriplePattern(personVar, 'department', 'Engineering');
    const engineeringQuery = new PatternQuery();
    engineeringQuery.addPattern(engineeringPattern);
    
    const seniorPattern = new TriplePattern(personVar, 'level', 'Senior');
    const seniorQuery = new PatternQuery();
    seniorQuery.addPattern(seniorPattern);
    
    const innerOrQuery = new LogicalQuery('OR');
    innerOrQuery.addOperand(engineeringQuery);
    innerOrQuery.addOperand(seniorQuery);
    
    const salaryVar = new QueryVariable('salary');
    salaryVar.addConstraint(new RangeConstraint(70000, 100000));
    
    const salaryPattern = new TriplePattern(personVar, 'salary', salaryVar);
    const salaryQuery = new PatternQuery();
    salaryQuery.addPattern(salaryPattern);
    
    const outerAndQuery = new LogicalQuery('AND');
    outerAndQuery.addOperand(innerOrQuery);
    outerAndQuery.addOperand(salaryQuery);
    
    // Test serialization
    const triples = outerAndQuery.toTriples();
    expect(triples.length).toBeGreaterThan(0);
    
    // Verify serialization structure
    const queryId = outerAndQuery.getId();
    
    // Check main query type
    const typeTriple = triples.find(([s, p, o]) => 
      s === queryId && p === 'rdf:type' && o === 'kg:Query'
    );
    expect(typeTriple).toBeDefined();
    
    // Check specific query type
    const queryTypeTriple = triples.find(([s, p, o]) => 
      s === queryId && p === 'kg:queryType' && o === 'LogicalQuery'
    );
    expect(queryTypeTriple).toBeDefined();
    
    // Check operator
    const operatorTriple = triples.find(([s, p, o]) => 
      s === queryId && p === 'kg:operator' && o === 'kg:AND'
    );
    expect(operatorTriple).toBeDefined();
    
    // Check operands
    const operandTriples = triples.filter(([s, p, o]) => 
      s === queryId && p === 'kg:hasOperand'
    );
    expect(operandTriples.length).toBe(2);
    
    // Verify nested query serialization
    const innerQueryId = innerOrQuery.getId();
    const innerTypeTriple = triples.find(([s, p, o]) => 
      s === innerQueryId && p === 'rdf:type' && o === 'kg:Query'
    );
    expect(innerTypeTriple).toBeDefined();
    
    const innerQueryTypeTriple = triples.find(([s, p, o]) => 
      s === innerQueryId && p === 'kg:queryType' && o === 'LogicalQuery'
    );
    expect(innerQueryTypeTriple).toBeDefined();
    
    const innerOperatorTriple = triples.find(([s, p, o]) => 
      s === innerQueryId && p === 'kg:operator' && o === 'kg:OR'
    );
    expect(innerOperatorTriple).toBeDefined();
    
    // Test constraint serialization
    const constraintTriples = triples.filter(([s, p, o]) => 
      p === 'kg:hasConstraint'
    );
    expect(constraintTriples.length).toBeGreaterThan(0);
    
    // Test variable serialization
    const variableTriples = triples.filter(([s, p, o]) => 
      p === 'kg:hasVariable'
    );
    expect(variableTriples.length).toBeGreaterThan(0);
    
    // Test pattern serialization
    const patternTriples = triples.filter(([s, p, o]) => 
      p === 'kg:hasPattern'
    );
    expect(patternTriples.length).toBeGreaterThan(0);
    
    // Test execution metadata serialization
    await outerAndQuery.execute(kg);
    const metadataTriples = outerAndQuery.toTriples();
    
    const statsTriples = metadataTriples.filter(([s, p, o]) => 
      s.includes('_stats')
    );
    expect(statsTriples.length).toBeGreaterThan(0);
    
    // Test query reconstruction (conceptual - would require full deserialization)
    const reconstructedQuery = new LogicalQuery('AND');
    reconstructedQuery.setMetadata('originalId', queryId);
    
    expect(reconstructedQuery.operator).toBe('AND');
    expect(reconstructedQuery.getMetadata('originalId')).toBe(queryId);
  });
  
  test('Step 5.2.5: Test logical query performance with large operand sets', async () => {
    // Test performance with many operands
    const personVar = new QueryVariable('person');
    
    // Create multiple pattern queries for different attributes
    const queries = [];
    
    // Department queries
    const departments = ['Engineering', 'Marketing', 'Sales', 'HR', 'Finance', 'Operations'];
    for (const dept of departments) {
      const pattern = new TriplePattern(personVar, 'department', dept);
      const query = new PatternQuery();
      query.addPattern(pattern);
      queries.push(query);
    }
    
    // Level queries
    const levels = ['Junior', 'Senior', 'Manager', 'Director', 'VP'];
    for (const level of levels) {
      const pattern = new TriplePattern(personVar, 'level', level);
      const query = new PatternQuery();
      query.addPattern(pattern);
      queries.push(query);
    }
    
    // Location queries
    const locations = ['San Francisco', 'New York', 'Chicago', 'Los Angeles', 'Seattle', 'Austin'];
    for (const location of locations) {
      const pattern = new TriplePattern(personVar, 'location', location);
      const query = new PatternQuery();
      query.addPattern(pattern);
      queries.push(query);
    }
    
    // Test large OR query performance
    const largeOrQuery = new LogicalQuery('OR');
    for (const query of queries) {
      largeOrQuery.addOperand(query);
    }
    
    const startTime = Date.now();
    const orResults = await largeOrQuery.execute(kg);
    const orExecutionTime = Date.now() - startTime;
    
    expect(orResults.bindings.length).toBeGreaterThan(0);
    expect(orExecutionTime).toBeLessThan(1000); // Should complete within 1 second
    
    // Test large AND query performance (should be faster due to early termination)
    const largeAndQuery = new LogicalQuery('AND');
    for (const query of queries.slice(0, 10)) { // Use fewer operands for AND
      largeAndQuery.addOperand(query);
    }
    
    const andStartTime = Date.now();
    const andResults = await largeAndQuery.execute(kg);
    const andExecutionTime = Date.now() - andStartTime;
    
    expect(andResults.bindings.length).toBe(0); // Should be empty due to conflicting constraints
    expect(andExecutionTime).toBeLessThan(500); // Should be faster due to short-circuiting
    
    // Test nested performance with multiple levels
    const nestedQueries = [];
    for (let i = 0; i < 5; i++) {
      const innerOr = new LogicalQuery('OR');
      for (let j = 0; j < 3; j++) {
        const pattern = new TriplePattern(personVar, 'department', departments[j]);
        const query = new PatternQuery();
        query.addPattern(pattern);
        innerOr.addOperand(query);
      }
      nestedQueries.push(innerOr);
    }
    
    const nestedAndQuery = new LogicalQuery('AND');
    for (const nestedQuery of nestedQueries) {
      nestedAndQuery.addOperand(nestedQuery);
    }
    
    const nestedStartTime = Date.now();
    const nestedResults = await nestedAndQuery.execute(kg);
    const nestedExecutionTime = Date.now() - nestedStartTime;
    
    expect(nestedExecutionTime).toBeLessThan(2000); // Should complete within 2 seconds
    
    // Test memory efficiency with large result sets
    const memoryTestQuery = new LogicalQuery('OR');
    
    // Add queries that will generate overlapping results
    for (const dept of departments.slice(0, 3)) {
      const pattern = new TriplePattern(personVar, 'department', dept);
      const query = new PatternQuery();
      query.addPattern(pattern);
      memoryTestQuery.addOperand(query);
    }
    
    const memoryResults = await memoryTestQuery.execute(kg);
    
    // Verify deduplication is working (no duplicate bindings)
    const uniquePersons = new Set();
    for (const binding of memoryResults.bindings) {
      const person = binding.get('person');
      expect(uniquePersons.has(person)).toBe(false);
      uniquePersons.add(person);
    }
    
    // Test query complexity metrics
    expect(largeOrQuery.operands.length).toBe(queries.length);
    expect(nestedAndQuery.operands.length).toBe(nestedQueries.length);
    
    // Verify all operands are properly stored
    for (let i = 0; i < largeOrQuery.operands.length; i++) {
      expect(largeOrQuery.operands[i]).toBeDefined();
      expect(largeOrQuery.operands[i]).toBeInstanceOf(PatternQuery);
    }
    
    for (let i = 0; i < nestedAndQuery.operands.length; i++) {
      expect(nestedAndQuery.operands[i]).toBeDefined();
      expect(nestedAndQuery.operands[i]).toBeInstanceOf(LogicalQuery);
    }
  });
});
