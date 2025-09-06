import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { AggregationQuery } from '../../../src/query/types/AggregationQuery.js';
import { PatternQuery } from '../../../src/query/types/PatternQuery.js';
import { TriplePattern } from '../../../src/query/core/TriplePattern.js';
import { QueryVariable } from '../../../src/query/core/QueryVariable.js';
import { RangeConstraint } from '../../../src/query/constraints/RangeConstraint.js';
import { KGEngine } from '../../../src/core/KGEngine.js';

describe('Phase 7.1: Basic Aggregation Operations', () => {
  let kg;
  
  beforeEach(() => {
    kg = new KGEngine();
    
    // Setup comprehensive test data for aggregation testing
    // Create a rich dataset with people, projects, and numerical data
    
    // People with salaries and ages
    kg.addTriple('alice', 'rdf:type', 'Person');
    kg.addTriple('alice', 'name', 'Alice Smith');
    kg.addTriple('alice', 'age', 30);
    kg.addTriple('alice', 'salary', 75000);
    kg.addTriple('alice', 'department', 'Engineering');
    kg.addTriple('alice', 'level', 'Senior');
    kg.addTriple('alice', 'experience', 8);
    kg.addTriple('alice', 'rating', 4.5);
    
    kg.addTriple('bob', 'rdf:type', 'Person');
    kg.addTriple('bob', 'name', 'Bob Johnson');
    kg.addTriple('bob', 'age', 25);
    kg.addTriple('bob', 'salary', 60000);
    kg.addTriple('bob', 'department', 'Engineering');
    kg.addTriple('bob', 'level', 'Junior');
    kg.addTriple('bob', 'experience', 3);
    kg.addTriple('bob', 'rating', 4.0);
    
    kg.addTriple('charlie', 'rdf:type', 'Person');
    kg.addTriple('charlie', 'name', 'Charlie Brown');
    kg.addTriple('charlie', 'age', 35);
    kg.addTriple('charlie', 'salary', 90000);
    kg.addTriple('charlie', 'department', 'Sales');
    kg.addTriple('charlie', 'level', 'Manager');
    kg.addTriple('charlie', 'experience', 12);
    kg.addTriple('charlie', 'rating', 4.8);
    
    kg.addTriple('diana', 'rdf:type', 'Person');
    kg.addTriple('diana', 'name', 'Diana Prince');
    kg.addTriple('diana', 'age', 28);
    kg.addTriple('diana', 'salary', 85000);
    kg.addTriple('diana', 'department', 'Marketing');
    kg.addTriple('diana', 'level', 'Senior');
    kg.addTriple('diana', 'experience', 6);
    kg.addTriple('diana', 'rating', 4.7);
    
    kg.addTriple('eve', 'rdf:type', 'Person');
    kg.addTriple('eve', 'name', 'Eve Wilson');
    kg.addTriple('eve', 'age', 32);
    kg.addTriple('eve', 'salary', 95000);
    kg.addTriple('eve', 'department', 'Marketing');
    kg.addTriple('eve', 'level', 'Manager');
    kg.addTriple('eve', 'experience', 10);
    kg.addTriple('eve', 'rating', 4.6);
    
    // Projects with budgets and team sizes
    kg.addTriple('project1', 'rdf:type', 'Project');
    kg.addTriple('project1', 'name', 'AI Platform');
    kg.addTriple('project1', 'budget', 500000);
    kg.addTriple('project1', 'teamSize', 8);
    kg.addTriple('project1', 'duration', 12);
    kg.addTriple('project1', 'priority', 'High');
    
    kg.addTriple('project2', 'rdf:type', 'Project');
    kg.addTriple('project2', 'name', 'Mobile App');
    kg.addTriple('project2', 'budget', 200000);
    kg.addTriple('project2', 'teamSize', 5);
    kg.addTriple('project2', 'duration', 6);
    kg.addTriple('project2', 'priority', 'Medium');
    
    kg.addTriple('project3', 'rdf:type', 'Project');
    kg.addTriple('project3', 'name', 'Data Analytics');
    kg.addTriple('project3', 'budget', 300000);
    kg.addTriple('project3', 'teamSize', 6);
    kg.addTriple('project3', 'duration', 9);
    kg.addTriple('project3', 'priority', 'High');
    
    kg.addTriple('project4', 'rdf:type', 'Project');
    kg.addTriple('project4', 'name', 'Security Audit');
    kg.addTriple('project4', 'budget', 150000);
    kg.addTriple('project4', 'teamSize', 3);
    kg.addTriple('project4', 'duration', 4);
    kg.addTriple('project4', 'priority', 'Critical');
    
    // Relationships
    kg.addTriple('alice', 'worksOn', 'project1');
    kg.addTriple('bob', 'worksOn', 'project1');
    kg.addTriple('charlie', 'worksOn', 'project2');
    kg.addTriple('diana', 'worksOn', 'project2');
    kg.addTriple('eve', 'worksOn', 'project3');
    kg.addTriple('alice', 'worksOn', 'project3');
    kg.addTriple('bob', 'worksOn', 'project4');
  });
  
  afterEach(async () => {
    // Clear the knowledge graph to prevent memory leaks and ensure clean state
    if (kg && typeof kg.clear === 'function') {
      await kg.clear();
    }
    kg = null;
  });
  
  test('Step 7.1.1: Test COUNT aggregation queries', async () => {
    // Test basic COUNT aggregation
    
    // Count all people
    const personVar = new QueryVariable('person');
    const sourceQuery = new PatternQuery();
    sourceQuery.addPattern(new TriplePattern(personVar, 'rdf:type', 'Person'));
    
    const countQuery = new AggregationQuery(sourceQuery, 'COUNT');
    const countResult = await countQuery.execute(kg);
    
    expect(countResult.bindings.length).toBe(1);
    expect(countResult.variableNames).toContain('aggregate_result');
    expect(countResult.bindings[0].get('aggregate_result')).toBe(5); // 5 people
    
    // Count people by department
    const deptVar = new QueryVariable('department');
    const deptQuery = new PatternQuery();
    deptQuery.addPattern(new TriplePattern(personVar, 'rdf:type', 'Person'));
    deptQuery.addPattern(new TriplePattern(personVar, 'department', deptVar));
    
    const countByDeptQuery = new AggregationQuery(deptQuery, 'COUNT');
    countByDeptQuery.groupBy('department');
    
    const countByDeptResult = await countByDeptQuery.execute(kg);
    
    expect(countByDeptResult.bindings.length).toBe(3); // 3 departments
    expect(countByDeptResult.variableNames).toContain('department');
    expect(countByDeptResult.variableNames).toContain('aggregate_result');
    
    // Verify counts by department
    const deptCounts = new Map();
    for (const binding of countByDeptResult.bindings) {
      deptCounts.set(binding.get('department'), binding.get('aggregate_result'));
    }
    
    expect(deptCounts.get('Engineering')).toBe(2); // Alice, Bob
    expect(deptCounts.get('Sales')).toBe(1); // Charlie
    expect(deptCounts.get('Marketing')).toBe(2); // Diana, Eve
    
    // Count projects
    const projectVar = new QueryVariable('project');
    const projectQuery = new PatternQuery();
    projectQuery.addPattern(new TriplePattern(projectVar, 'rdf:type', 'Project'));
    
    const countProjectsQuery = new AggregationQuery(projectQuery, 'COUNT');
    const countProjectsResult = await countProjectsQuery.execute(kg);
    
    expect(countProjectsResult.bindings[0].get('aggregate_result')).toBe(4); // 4 projects
    
    // Count with constraints
    const salaryVar = new QueryVariable('salary');
    const highSalaryQuery = new PatternQuery();
    highSalaryQuery.addPattern(new TriplePattern(personVar, 'rdf:type', 'Person'));
    highSalaryQuery.addPattern(new TriplePattern(personVar, 'salary', salaryVar));
    salaryVar.addConstraint(new RangeConstraint(80000, 100000));
    
    const countHighSalaryQuery = new AggregationQuery(highSalaryQuery, 'COUNT');
    const countHighSalaryResult = await countHighSalaryQuery.execute(kg);
    
    expect(countHighSalaryResult.bindings[0].get('aggregate_result')).toBe(3); // Charlie, Diana, Eve
    
    // Test COUNT with empty result set
    const nonExistentQuery = new PatternQuery();
    nonExistentQuery.addPattern(new TriplePattern(personVar, 'rdf:type', 'NonExistent'));
    
    const countEmptyQuery = new AggregationQuery(nonExistentQuery, 'COUNT');
    const countEmptyResult = await countEmptyQuery.execute(kg);
    
    expect(countEmptyResult.bindings[0].get('aggregate_result')).toBe(0);
  });
  
  test('Step 7.1.2: Test SUM aggregation queries', async () => {
    // Test basic SUM aggregation
    
    // Sum all salaries
    const personVar = new QueryVariable('person');
    const salaryVar = new QueryVariable('salary');
    const salaryQuery = new PatternQuery();
    salaryQuery.addPattern(new TriplePattern(personVar, 'rdf:type', 'Person'));
    salaryQuery.addPattern(new TriplePattern(personVar, 'salary', salaryVar));
    
    const sumSalaryQuery = new AggregationQuery(salaryQuery, 'SUM');
    sumSalaryQuery.setAggregateField('salary');
    
    const sumSalaryResult = await sumSalaryQuery.execute(kg);
    
    expect(sumSalaryResult.bindings.length).toBe(1);
    expect(sumSalaryResult.bindings[0].get('aggregate_result')).toBe(405000); // 75000 + 60000 + 90000 + 85000 + 95000
    
    // Sum salaries by department
    const deptVar = new QueryVariable('department');
    const salaryByDeptQuery = new PatternQuery();
    salaryByDeptQuery.addPattern(new TriplePattern(personVar, 'rdf:type', 'Person'));
    salaryByDeptQuery.addPattern(new TriplePattern(personVar, 'salary', salaryVar));
    salaryByDeptQuery.addPattern(new TriplePattern(personVar, 'department', deptVar));
    
    const sumSalaryByDeptQuery = new AggregationQuery(salaryByDeptQuery, 'SUM');
    sumSalaryByDeptQuery.setAggregateField('salary');
    sumSalaryByDeptQuery.groupBy('department');
    
    const sumSalaryByDeptResult = await sumSalaryByDeptQuery.execute(kg);
    
    expect(sumSalaryByDeptResult.bindings.length).toBe(3);
    
    const deptSums = new Map();
    for (const binding of sumSalaryByDeptResult.bindings) {
      deptSums.set(binding.get('department'), binding.get('aggregate_result'));
    }
    
    expect(deptSums.get('Engineering')).toBe(135000); // 75000 + 60000
    expect(deptSums.get('Sales')).toBe(90000); // 90000
    expect(deptSums.get('Marketing')).toBe(180000); // 85000 + 95000
    
    // Sum project budgets
    const projectVar = new QueryVariable('project');
    const budgetVar = new QueryVariable('budget');
    const budgetQuery = new PatternQuery();
    budgetQuery.addPattern(new TriplePattern(projectVar, 'rdf:type', 'Project'));
    budgetQuery.addPattern(new TriplePattern(projectVar, 'budget', budgetVar));
    
    const sumBudgetQuery = new AggregationQuery(budgetQuery, 'SUM');
    sumBudgetQuery.setAggregateField('budget');
    
    const sumBudgetResult = await sumBudgetQuery.execute(kg);
    
    expect(sumBudgetResult.bindings[0].get('aggregate_result')).toBe(1150000); // 500000 + 200000 + 300000 + 150000
    
    // Sum with constraints
    const experienceVar = new QueryVariable('experience');
    const seniorQuery = new PatternQuery();
    seniorQuery.addPattern(new TriplePattern(personVar, 'rdf:type', 'Person'));
    seniorQuery.addPattern(new TriplePattern(personVar, 'experience', experienceVar));
    experienceVar.addConstraint(new RangeConstraint(5, 15));
    
    const sumSeniorExpQuery = new AggregationQuery(seniorQuery, 'SUM');
    sumSeniorExpQuery.setAggregateField('experience');
    
    const sumSeniorExpResult = await sumSeniorExpQuery.execute(kg);
    
    expect(sumSeniorExpResult.bindings[0].get('aggregate_result')).toBe(36); // 8 + 12 + 6 + 10
    
    // Test SUM with empty result set
    const nonExistentQuery = new PatternQuery();
    nonExistentQuery.addPattern(new TriplePattern(personVar, 'rdf:type', 'NonExistent'));
    
    const sumEmptyQuery = new AggregationQuery(nonExistentQuery, 'SUM');
    sumEmptyQuery.setAggregateField('salary');
    
    const sumEmptyResult = await sumEmptyQuery.execute(kg);
    
    expect(sumEmptyResult.bindings[0].get('aggregate_result')).toBe(0);
  });
  
  test('Step 7.1.3: Test AVG aggregation queries', async () => {
    // Test basic AVG aggregation
    
    // Average salary
    const personVar = new QueryVariable('person');
    const salaryVar = new QueryVariable('salary');
    const salaryQuery = new PatternQuery();
    salaryQuery.addPattern(new TriplePattern(personVar, 'rdf:type', 'Person'));
    salaryQuery.addPattern(new TriplePattern(personVar, 'salary', salaryVar));
    
    const avgSalaryQuery = new AggregationQuery(salaryQuery, 'AVG');
    avgSalaryQuery.setAggregateField('salary');
    
    const avgSalaryResult = await avgSalaryQuery.execute(kg);
    
    expect(avgSalaryResult.bindings.length).toBe(1);
    expect(avgSalaryResult.bindings[0].get('aggregate_result')).toBe(81000); // 405000 / 5
    
    // Average salary by department
    const deptVar = new QueryVariable('department');
    const salaryByDeptQuery = new PatternQuery();
    salaryByDeptQuery.addPattern(new TriplePattern(personVar, 'rdf:type', 'Person'));
    salaryByDeptQuery.addPattern(new TriplePattern(personVar, 'salary', salaryVar));
    salaryByDeptQuery.addPattern(new TriplePattern(personVar, 'department', deptVar));
    
    const avgSalaryByDeptQuery = new AggregationQuery(salaryByDeptQuery, 'AVG');
    avgSalaryByDeptQuery.setAggregateField('salary');
    avgSalaryByDeptQuery.groupBy('department');
    
    const avgSalaryByDeptResult = await avgSalaryByDeptQuery.execute(kg);
    
    expect(avgSalaryByDeptResult.bindings.length).toBe(3);
    
    const deptAvgs = new Map();
    for (const binding of avgSalaryByDeptResult.bindings) {
      deptAvgs.set(binding.get('department'), binding.get('aggregate_result'));
    }
    
    expect(deptAvgs.get('Engineering')).toBe(67500); // 135000 / 2
    expect(deptAvgs.get('Sales')).toBe(90000); // 90000 / 1
    expect(deptAvgs.get('Marketing')).toBe(90000); // 180000 / 2
    
    // Average age
    const ageVar = new QueryVariable('age');
    const ageQuery = new PatternQuery();
    ageQuery.addPattern(new TriplePattern(personVar, 'rdf:type', 'Person'));
    ageQuery.addPattern(new TriplePattern(personVar, 'age', ageVar));
    
    const avgAgeQuery = new AggregationQuery(ageQuery, 'AVG');
    avgAgeQuery.setAggregateField('age');
    
    const avgAgeResult = await avgAgeQuery.execute(kg);
    
    expect(avgAgeResult.bindings[0].get('aggregate_result')).toBe(30); // (30 + 25 + 35 + 28 + 32) / 5
    
    // Average project budget
    const projectVar = new QueryVariable('project');
    const budgetVar = new QueryVariable('budget');
    const budgetQuery = new PatternQuery();
    budgetQuery.addPattern(new TriplePattern(projectVar, 'rdf:type', 'Project'));
    budgetQuery.addPattern(new TriplePattern(projectVar, 'budget', budgetVar));
    
    const avgBudgetQuery = new AggregationQuery(budgetQuery, 'AVG');
    avgBudgetQuery.setAggregateField('budget');
    
    const avgBudgetResult = await avgBudgetQuery.execute(kg);
    
    expect(avgBudgetResult.bindings[0].get('aggregate_result')).toBe(287500); // 1150000 / 4
    
    // Average with constraints
    const levelVar = new QueryVariable('level');
    const managerQuery = new PatternQuery();
    managerQuery.addPattern(new TriplePattern(personVar, 'rdf:type', 'Person'));
    managerQuery.addPattern(new TriplePattern(personVar, 'level', 'Manager'));
    managerQuery.addPattern(new TriplePattern(personVar, 'salary', salaryVar));
    
    const avgManagerSalaryQuery = new AggregationQuery(managerQuery, 'AVG');
    avgManagerSalaryQuery.setAggregateField('salary');
    
    const avgManagerSalaryResult = await avgManagerSalaryQuery.execute(kg);
    
    expect(avgManagerSalaryResult.bindings[0].get('aggregate_result')).toBe(92500); // (90000 + 95000) / 2
  });
  
  test('Step 7.1.4: Test MIN/MAX aggregation queries', async () => {
    // Test MIN aggregation
    
    // Minimum salary
    const personVar = new QueryVariable('person');
    const salaryVar = new QueryVariable('salary');
    const salaryQuery = new PatternQuery();
    salaryQuery.addPattern(new TriplePattern(personVar, 'rdf:type', 'Person'));
    salaryQuery.addPattern(new TriplePattern(personVar, 'salary', salaryVar));
    
    const minSalaryQuery = new AggregationQuery(salaryQuery, 'MIN');
    minSalaryQuery.setAggregateField('salary');
    
    const minSalaryResult = await minSalaryQuery.execute(kg);
    
    expect(minSalaryResult.bindings.length).toBe(1);
    expect(minSalaryResult.bindings[0].get('aggregate_result')).toBe(60000); // Bob's salary
    
    // Test MAX aggregation
    
    // Maximum salary
    const maxSalaryQuery = new AggregationQuery(salaryQuery, 'MAX');
    maxSalaryQuery.setAggregateField('salary');
    
    const maxSalaryResult = await maxSalaryQuery.execute(kg);
    
    expect(maxSalaryResult.bindings[0].get('aggregate_result')).toBe(95000); // Eve's salary
    
    // MIN/MAX by department
    const deptVar = new QueryVariable('department');
    const salaryByDeptQuery = new PatternQuery();
    salaryByDeptQuery.addPattern(new TriplePattern(personVar, 'rdf:type', 'Person'));
    salaryByDeptQuery.addPattern(new TriplePattern(personVar, 'salary', salaryVar));
    salaryByDeptQuery.addPattern(new TriplePattern(personVar, 'department', deptVar));
    
    const minSalaryByDeptQuery = new AggregationQuery(salaryByDeptQuery, 'MIN');
    minSalaryByDeptQuery.setAggregateField('salary');
    minSalaryByDeptQuery.groupBy('department');
    
    const minSalaryByDeptResult = await minSalaryByDeptQuery.execute(kg);
    
    const deptMins = new Map();
    for (const binding of minSalaryByDeptResult.bindings) {
      deptMins.set(binding.get('department'), binding.get('aggregate_result'));
    }
    
    expect(deptMins.get('Engineering')).toBe(60000); // Bob
    expect(deptMins.get('Sales')).toBe(90000); // Charlie
    expect(deptMins.get('Marketing')).toBe(85000); // Diana
    
    const maxSalaryByDeptQuery = new AggregationQuery(salaryByDeptQuery, 'MAX');
    maxSalaryByDeptQuery.setAggregateField('salary');
    maxSalaryByDeptQuery.groupBy('department');
    
    const maxSalaryByDeptResult = await maxSalaryByDeptQuery.execute(kg);
    
    const deptMaxs = new Map();
    for (const binding of maxSalaryByDeptResult.bindings) {
      deptMaxs.set(binding.get('department'), binding.get('aggregate_result'));
    }
    
    expect(deptMaxs.get('Engineering')).toBe(75000); // Alice
    expect(deptMaxs.get('Sales')).toBe(90000); // Charlie
    expect(deptMaxs.get('Marketing')).toBe(95000); // Eve
    
    // MIN/MAX age
    const ageVar = new QueryVariable('age');
    const ageQuery = new PatternQuery();
    ageQuery.addPattern(new TriplePattern(personVar, 'rdf:type', 'Person'));
    ageQuery.addPattern(new TriplePattern(personVar, 'age', ageVar));
    
    const minAgeQuery = new AggregationQuery(ageQuery, 'MIN');
    minAgeQuery.setAggregateField('age');
    
    const minAgeResult = await minAgeQuery.execute(kg);
    expect(minAgeResult.bindings[0].get('aggregate_result')).toBe(25); // Bob
    
    const maxAgeQuery = new AggregationQuery(ageQuery, 'MAX');
    maxAgeQuery.setAggregateField('age');
    
    const maxAgeResult = await maxAgeQuery.execute(kg);
    expect(maxAgeResult.bindings[0].get('aggregate_result')).toBe(35); // Charlie
    
    // MIN/MAX project budget
    const projectVar = new QueryVariable('project');
    const budgetVar = new QueryVariable('budget');
    const budgetQuery = new PatternQuery();
    budgetQuery.addPattern(new TriplePattern(projectVar, 'rdf:type', 'Project'));
    budgetQuery.addPattern(new TriplePattern(projectVar, 'budget', budgetVar));
    
    const minBudgetQuery = new AggregationQuery(budgetQuery, 'MIN');
    minBudgetQuery.setAggregateField('budget');
    
    const minBudgetResult = await minBudgetQuery.execute(kg);
    expect(minBudgetResult.bindings[0].get('aggregate_result')).toBe(150000); // project4
    
    const maxBudgetQuery = new AggregationQuery(budgetQuery, 'MAX');
    maxBudgetQuery.setAggregateField('budget');
    
    const maxBudgetResult = await maxBudgetQuery.execute(kg);
    expect(maxBudgetResult.bindings[0].get('aggregate_result')).toBe(500000); // project1
  });
  
  test('Step 7.1.5: Test COLLECT aggregation queries', async () => {
    // Test basic COLLECT aggregation
    
    // Collect all names
    const personVar = new QueryVariable('person');
    const nameVar = new QueryVariable('name');
    const nameQuery = new PatternQuery();
    nameQuery.addPattern(new TriplePattern(personVar, 'rdf:type', 'Person'));
    nameQuery.addPattern(new TriplePattern(personVar, 'name', nameVar));
    
    const collectNamesQuery = new AggregationQuery(nameQuery, 'COLLECT');
    collectNamesQuery.setAggregateField('name');
    
    const collectNamesResult = await collectNamesQuery.execute(kg);
    
    expect(collectNamesResult.bindings.length).toBe(1);
    const names = collectNamesResult.bindings[0].get('aggregate_result');
    expect(Array.isArray(names)).toBe(true);
    expect(names.length).toBe(5);
    expect(names).toContain('Alice Smith');
    expect(names).toContain('Bob Johnson');
    expect(names).toContain('Charlie Brown');
    expect(names).toContain('Diana Prince');
    expect(names).toContain('Eve Wilson');
    
    // Collect names by department
    const deptVar = new QueryVariable('department');
    const nameByDeptQuery = new PatternQuery();
    nameByDeptQuery.addPattern(new TriplePattern(personVar, 'rdf:type', 'Person'));
    nameByDeptQuery.addPattern(new TriplePattern(personVar, 'name', nameVar));
    nameByDeptQuery.addPattern(new TriplePattern(personVar, 'department', deptVar));
    
    const collectNamesByDeptQuery = new AggregationQuery(nameByDeptQuery, 'COLLECT');
    collectNamesByDeptQuery.setAggregateField('name');
    collectNamesByDeptQuery.groupBy('department');
    
    const collectNamesByDeptResult = await collectNamesByDeptQuery.execute(kg);
    
    expect(collectNamesByDeptResult.bindings.length).toBe(3);
    
    const deptNames = new Map();
    for (const binding of collectNamesByDeptResult.bindings) {
      deptNames.set(binding.get('department'), binding.get('aggregate_result'));
    }
    
    const engineeringNames = deptNames.get('Engineering');
    expect(engineeringNames.length).toBe(2);
    expect(engineeringNames).toContain('Alice Smith');
    expect(engineeringNames).toContain('Bob Johnson');
    
    const salesNames = deptNames.get('Sales');
    expect(salesNames.length).toBe(1);
    expect(salesNames).toContain('Charlie Brown');
    
    const marketingNames = deptNames.get('Marketing');
    expect(marketingNames.length).toBe(2);
    expect(marketingNames).toContain('Diana Prince');
    expect(marketingNames).toContain('Eve Wilson');
    
    // Collect project names
    const projectVar = new QueryVariable('project');
    const projectNameVar = new QueryVariable('projectName');
    const projectNameQuery = new PatternQuery();
    projectNameQuery.addPattern(new TriplePattern(projectVar, 'rdf:type', 'Project'));
    projectNameQuery.addPattern(new TriplePattern(projectVar, 'name', projectNameVar));
    
    const collectProjectNamesQuery = new AggregationQuery(projectNameQuery, 'COLLECT');
    collectProjectNamesQuery.setAggregateField('projectName');
    
    const collectProjectNamesResult = await collectProjectNamesQuery.execute(kg);
    
    const projectNames = collectProjectNamesResult.bindings[0].get('aggregate_result');
    expect(projectNames.length).toBe(4);
    expect(projectNames).toContain('AI Platform');
    expect(projectNames).toContain('Mobile App');
    expect(projectNames).toContain('Data Analytics');
    expect(projectNames).toContain('Security Audit');
    
    // Collect salaries by level
    const levelVar = new QueryVariable('level');
    const salaryVar = new QueryVariable('salary');
    const salaryByLevelQuery = new PatternQuery();
    salaryByLevelQuery.addPattern(new TriplePattern(personVar, 'rdf:type', 'Person'));
    salaryByLevelQuery.addPattern(new TriplePattern(personVar, 'salary', salaryVar));
    salaryByLevelQuery.addPattern(new TriplePattern(personVar, 'level', levelVar));
    
    const collectSalariesByLevelQuery = new AggregationQuery(salaryByLevelQuery, 'COLLECT');
    collectSalariesByLevelQuery.setAggregateField('salary');
    collectSalariesByLevelQuery.groupBy('level');
    
    const collectSalariesByLevelResult = await collectSalariesByLevelQuery.execute(kg);
    
    const levelSalaries = new Map();
    for (const binding of collectSalariesByLevelResult.bindings) {
      levelSalaries.set(binding.get('level'), binding.get('aggregate_result'));
    }
    
    const seniorSalaries = levelSalaries.get('Senior');
    expect(seniorSalaries.length).toBe(2);
    expect(seniorSalaries).toContain(75000); // Alice
    expect(seniorSalaries).toContain(85000); // Diana
    
    const managerSalaries = levelSalaries.get('Manager');
    expect(managerSalaries.length).toBe(2);
    expect(managerSalaries).toContain(90000); // Charlie
    expect(managerSalaries).toContain(95000); // Eve
    
    const juniorSalaries = levelSalaries.get('Junior');
    expect(juniorSalaries.length).toBe(1);
    expect(juniorSalaries).toContain(60000); // Bob
    
    // Test COLLECT with empty result set
    const nonExistentQuery = new PatternQuery();
    nonExistentQuery.addPattern(new TriplePattern(personVar, 'rdf:type', 'NonExistent'));
    
    const collectEmptyQuery = new AggregationQuery(nonExistentQuery, 'COLLECT');
    collectEmptyQuery.setAggregateField('name');
    
    const collectEmptyResult = await collectEmptyQuery.execute(kg);
    
    expect(collectEmptyResult.bindings[0].get('aggregate_result')).toEqual([]);
  });
});
