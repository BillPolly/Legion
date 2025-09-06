import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { AggregationQuery } from '../../../src/query/types/AggregationQuery.js';
import { PatternQuery } from '../../../src/query/types/PatternQuery.js';
import { TriplePattern } from '../../../src/query/core/TriplePattern.js';
import { QueryVariable } from '../../../src/query/core/QueryVariable.js';
import { RangeConstraint } from '../../../src/query/constraints/RangeConstraint.js';
import { KGEngine } from '../../../src/core/KGEngine.js';

describe('Phase 7.2: Grouped Aggregation', () => {
  let kg;
  
  beforeEach(() => {
    kg = new KGEngine();
    
    // Setup comprehensive test data for grouped aggregation testing
    // Create a rich dataset with hierarchical grouping possibilities
    
    // Employees with multiple grouping dimensions
    kg.addTriple('emp1', 'rdf:type', 'Employee');
    kg.addTriple('emp1', 'name', 'Alice Johnson');
    kg.addTriple('emp1', 'salary', 75000);
    kg.addTriple('emp1', 'department', 'Engineering');
    kg.addTriple('emp1', 'level', 'Senior');
    kg.addTriple('emp1', 'location', 'New York');
    kg.addTriple('emp1', 'team', 'Backend');
    kg.addTriple('emp1', 'experience', 8);
    kg.addTriple('emp1', 'bonus', 7500);
    
    kg.addTriple('emp2', 'rdf:type', 'Employee');
    kg.addTriple('emp2', 'name', 'Bob Smith');
    kg.addTriple('emp2', 'salary', 60000);
    kg.addTriple('emp2', 'department', 'Engineering');
    kg.addTriple('emp2', 'level', 'Junior');
    kg.addTriple('emp2', 'location', 'New York');
    kg.addTriple('emp2', 'team', 'Frontend');
    kg.addTriple('emp2', 'experience', 3);
    kg.addTriple('emp2', 'bonus', 3000);
    
    kg.addTriple('emp3', 'rdf:type', 'Employee');
    kg.addTriple('emp3', 'name', 'Charlie Brown');
    kg.addTriple('emp3', 'salary', 90000);
    kg.addTriple('emp3', 'department', 'Sales');
    kg.addTriple('emp3', 'level', 'Manager');
    kg.addTriple('emp3', 'location', 'San Francisco');
    kg.addTriple('emp3', 'team', 'Enterprise');
    kg.addTriple('emp3', 'experience', 12);
    kg.addTriple('emp3', 'bonus', 18000);
    
    kg.addTriple('emp4', 'rdf:type', 'Employee');
    kg.addTriple('emp4', 'name', 'Diana Prince');
    kg.addTriple('emp4', 'salary', 85000);
    kg.addTriple('emp4', 'department', 'Marketing');
    kg.addTriple('emp4', 'level', 'Senior');
    kg.addTriple('emp4', 'location', 'San Francisco');
    kg.addTriple('emp4', 'team', 'Digital');
    kg.addTriple('emp4', 'experience', 6);
    kg.addTriple('emp4', 'bonus', 8500);
    
    kg.addTriple('emp5', 'rdf:type', 'Employee');
    kg.addTriple('emp5', 'name', 'Eve Wilson');
    kg.addTriple('emp5', 'salary', 95000);
    kg.addTriple('emp5', 'department', 'Marketing');
    kg.addTriple('emp5', 'level', 'Manager');
    kg.addTriple('emp5', 'location', 'New York');
    kg.addTriple('emp5', 'team', 'Brand');
    kg.addTriple('emp5', 'experience', 10);
    kg.addTriple('emp5', 'bonus', 19000);
    
    kg.addTriple('emp6', 'rdf:type', 'Employee');
    kg.addTriple('emp6', 'name', 'Frank Miller');
    kg.addTriple('emp6', 'salary', 70000);
    kg.addTriple('emp6', 'department', 'Engineering');
    kg.addTriple('emp6', 'level', 'Senior');
    kg.addTriple('emp6', 'location', 'San Francisco');
    kg.addTriple('emp6', 'team', 'DevOps');
    kg.addTriple('emp6', 'experience', 7);
    kg.addTriple('emp6', 'bonus', 7000);
    
    // Projects with multiple dimensions
    kg.addTriple('proj1', 'rdf:type', 'Project');
    kg.addTriple('proj1', 'name', 'AI Platform');
    kg.addTriple('proj1', 'budget', 500000);
    kg.addTriple('proj1', 'department', 'Engineering');
    kg.addTriple('proj1', 'priority', 'High');
    kg.addTriple('proj1', 'status', 'Active');
    kg.addTriple('proj1', 'quarter', 'Q1');
    
    kg.addTriple('proj2', 'rdf:type', 'Project');
    kg.addTriple('proj2', 'name', 'Mobile App');
    kg.addTriple('proj2', 'budget', 200000);
    kg.addTriple('proj2', 'department', 'Engineering');
    kg.addTriple('proj2', 'priority', 'Medium');
    kg.addTriple('proj2', 'status', 'Completed');
    kg.addTriple('proj2', 'quarter', 'Q1');
    
    kg.addTriple('proj3', 'rdf:type', 'Project');
    kg.addTriple('proj3', 'name', 'Sales Campaign');
    kg.addTriple('proj3', 'budget', 300000);
    kg.addTriple('proj3', 'department', 'Sales');
    kg.addTriple('proj3', 'priority', 'High');
    kg.addTriple('proj3', 'status', 'Active');
    kg.addTriple('proj3', 'quarter', 'Q2');
    
    kg.addTriple('proj4', 'rdf:type', 'Project');
    kg.addTriple('proj4', 'name', 'Brand Refresh');
    kg.addTriple('proj4', 'budget', 150000);
    kg.addTriple('proj4', 'department', 'Marketing');
    kg.addTriple('proj4', 'priority', 'Low');
    kg.addTriple('proj4', 'status', 'Planning');
    kg.addTriple('proj4', 'quarter', 'Q2');
    
    // Relationships
    kg.addTriple('emp1', 'worksOn', 'proj1');
    kg.addTriple('emp2', 'worksOn', 'proj2');
    kg.addTriple('emp3', 'worksOn', 'proj3');
    kg.addTriple('emp4', 'worksOn', 'proj4');
    kg.addTriple('emp5', 'worksOn', 'proj4');
    kg.addTriple('emp6', 'worksOn', 'proj1');
  });
  
  afterEach(async () => {
    // Clear the knowledge graph to prevent memory leaks and ensure clean state
    if (kg && typeof kg.clear === 'function') {
      await kg.clear();
    }
    kg = null;
  });
  
  test('Step 7.2.1: Test GROUP BY functionality', async () => {
    // Test basic GROUP BY with single field
    
    // Group employees by department and count
    const empVar = new QueryVariable('employee');
    const deptVar = new QueryVariable('department');
    const empQuery = new PatternQuery();
    empQuery.addPattern(new TriplePattern(empVar, 'rdf:type', 'Employee'));
    empQuery.addPattern(new TriplePattern(empVar, 'department', deptVar));
    
    const countByDeptQuery = new AggregationQuery(empQuery, 'COUNT');
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
    
    expect(deptCounts.get('Engineering')).toBe(3); // emp1, emp2, emp6
    expect(deptCounts.get('Sales')).toBe(1); // emp3
    expect(deptCounts.get('Marketing')).toBe(2); // emp4, emp5
    
    // Group projects by status and sum budget
    const projVar = new QueryVariable('project');
    const statusVar = new QueryVariable('status');
    const budgetVar = new QueryVariable('budget');
    const projQuery = new PatternQuery();
    projQuery.addPattern(new TriplePattern(projVar, 'rdf:type', 'Project'));
    projQuery.addPattern(new TriplePattern(projVar, 'status', statusVar));
    projQuery.addPattern(new TriplePattern(projVar, 'budget', budgetVar));
    
    const sumByStatusQuery = new AggregationQuery(projQuery, 'SUM');
    sumByStatusQuery.setAggregateField('budget');
    sumByStatusQuery.groupBy('status');
    
    const sumByStatusResult = await sumByStatusQuery.execute(kg);
    
    expect(sumByStatusResult.bindings.length).toBe(3); // 3 statuses
    
    const statusSums = new Map();
    for (const binding of sumByStatusResult.bindings) {
      statusSums.set(binding.get('status'), binding.get('aggregate_result'));
    }
    
    expect(statusSums.get('Active')).toBe(800000); // proj1 + proj3
    expect(statusSums.get('Completed')).toBe(200000); // proj2
    expect(statusSums.get('Planning')).toBe(150000); // proj4
    
    // Group employees by level and calculate average salary
    const levelVar = new QueryVariable('level');
    const salaryVar = new QueryVariable('salary');
    const salaryQuery = new PatternQuery();
    salaryQuery.addPattern(new TriplePattern(empVar, 'rdf:type', 'Employee'));
    salaryQuery.addPattern(new TriplePattern(empVar, 'level', levelVar));
    salaryQuery.addPattern(new TriplePattern(empVar, 'salary', salaryVar));
    
    const avgByLevelQuery = new AggregationQuery(salaryQuery, 'AVG');
    avgByLevelQuery.setAggregateField('salary');
    avgByLevelQuery.groupBy('level');
    
    const avgByLevelResult = await avgByLevelQuery.execute(kg);
    
    const levelAvgs = new Map();
    for (const binding of avgByLevelResult.bindings) {
      levelAvgs.set(binding.get('level'), binding.get('aggregate_result'));
    }
    
    expect(levelAvgs.get('Senior')).toBeCloseTo(76666.67, 2); // (75000 + 85000 + 70000) / 3
    expect(levelAvgs.get('Junior')).toBe(60000); // 60000 / 1
    expect(levelAvgs.get('Manager')).toBe(92500); // (90000 + 95000) / 2
  });
  
  test('Step 7.2.2: Test multiple grouping fields', async () => {
    // Test GROUP BY with multiple fields
    
    // Group employees by department and level
    const empVar = new QueryVariable('employee');
    const deptVar = new QueryVariable('department');
    const levelVar = new QueryVariable('level');
    const salaryVar = new QueryVariable('salary');
    
    const empQuery = new PatternQuery();
    empQuery.addPattern(new TriplePattern(empVar, 'rdf:type', 'Employee'));
    empQuery.addPattern(new TriplePattern(empVar, 'department', deptVar));
    empQuery.addPattern(new TriplePattern(empVar, 'level', levelVar));
    empQuery.addPattern(new TriplePattern(empVar, 'salary', salaryVar));
    
    const avgByDeptLevelQuery = new AggregationQuery(empQuery, 'AVG');
    avgByDeptLevelQuery.setAggregateField('salary');
    avgByDeptLevelQuery.groupBy('department', 'level');
    
    const avgByDeptLevelResult = await avgByDeptLevelQuery.execute(kg);
    
    expect(avgByDeptLevelResult.variableNames).toContain('department');
    expect(avgByDeptLevelResult.variableNames).toContain('level');
    expect(avgByDeptLevelResult.variableNames).toContain('aggregate_result');
    
    // Create a map for easier verification
    const groupAvgs = new Map();
    for (const binding of avgByDeptLevelResult.bindings) {
      const key = `${binding.get('department')}-${binding.get('level')}`;
      groupAvgs.set(key, binding.get('aggregate_result'));
    }
    
    expect(groupAvgs.get('Engineering-Senior')).toBe(72500); // (75000 + 70000) / 2
    expect(groupAvgs.get('Engineering-Junior')).toBe(60000); // 60000 / 1
    expect(groupAvgs.get('Sales-Manager')).toBe(90000); // 90000 / 1
    expect(groupAvgs.get('Marketing-Senior')).toBe(85000); // 85000 / 1
    expect(groupAvgs.get('Marketing-Manager')).toBe(95000); // 95000 / 1
    
    // Group projects by department, priority, and quarter
    const projVar = new QueryVariable('project');
    const projDeptVar = new QueryVariable('department');
    const priorityVar = new QueryVariable('priority');
    const quarterVar = new QueryVariable('quarter');
    const budgetVar = new QueryVariable('budget');
    
    const projQuery = new PatternQuery();
    projQuery.addPattern(new TriplePattern(projVar, 'rdf:type', 'Project'));
    projQuery.addPattern(new TriplePattern(projVar, 'department', projDeptVar));
    projQuery.addPattern(new TriplePattern(projVar, 'priority', priorityVar));
    projQuery.addPattern(new TriplePattern(projVar, 'quarter', quarterVar));
    projQuery.addPattern(new TriplePattern(projVar, 'budget', budgetVar));
    
    const sumByMultipleQuery = new AggregationQuery(projQuery, 'SUM');
    sumByMultipleQuery.setAggregateField('budget');
    sumByMultipleQuery.groupBy('department', 'priority', 'quarter');
    
    const sumByMultipleResult = await sumByMultipleQuery.execute(kg);
    
    expect(sumByMultipleResult.variableNames).toContain('department');
    expect(sumByMultipleResult.variableNames).toContain('priority');
    expect(sumByMultipleResult.variableNames).toContain('quarter');
    expect(sumByMultipleResult.variableNames).toContain('aggregate_result');
    
    // Verify specific groupings
    const multiGroupSums = new Map();
    for (const binding of sumByMultipleResult.bindings) {
      const key = `${binding.get('department')}-${binding.get('priority')}-${binding.get('quarter')}`;
      multiGroupSums.set(key, binding.get('aggregate_result'));
    }
    
    expect(multiGroupSums.get('Engineering-High-Q1')).toBe(500000); // proj1
    expect(multiGroupSums.get('Engineering-Medium-Q1')).toBe(200000); // proj2
    expect(multiGroupSums.get('Sales-High-Q2')).toBe(300000); // proj3
    expect(multiGroupSums.get('Marketing-Low-Q2')).toBe(150000); // proj4
  });
  
  test('Step 7.2.3: Test aggregation with constraints', async () => {
    // Test GROUP BY with constraints on source data
    
    // Group high-salary employees (>= 70000) by department
    const empVar = new QueryVariable('employee');
    const deptVar = new QueryVariable('department');
    const salaryVar = new QueryVariable('salary');
    
    const highSalaryQuery = new PatternQuery();
    highSalaryQuery.addPattern(new TriplePattern(empVar, 'rdf:type', 'Employee'));
    highSalaryQuery.addPattern(new TriplePattern(empVar, 'department', deptVar));
    highSalaryQuery.addPattern(new TriplePattern(empVar, 'salary', salaryVar));
    salaryVar.addConstraint(new RangeConstraint(70000, 100000));
    
    const countHighSalaryByDeptQuery = new AggregationQuery(highSalaryQuery, 'COUNT');
    countHighSalaryByDeptQuery.groupBy('department');
    
    const countHighSalaryByDeptResult = await countHighSalaryByDeptQuery.execute(kg);
    
    const highSalaryCounts = new Map();
    for (const binding of countHighSalaryByDeptResult.bindings) {
      highSalaryCounts.set(binding.get('department'), binding.get('aggregate_result'));
    }
    
    expect(highSalaryCounts.get('Engineering')).toBe(2); // emp1 (75000), emp6 (70000)
    expect(highSalaryCounts.get('Sales')).toBe(1); // emp3 (90000)
    expect(highSalaryCounts.get('Marketing')).toBe(2); // emp4 (85000), emp5 (95000)
    
    // Group senior-level employees by location and calculate average bonus
    const levelVar = new QueryVariable('level');
    const locationVar = new QueryVariable('location');
    const bonusVar = new QueryVariable('bonus');
    
    const seniorQuery = new PatternQuery();
    seniorQuery.addPattern(new TriplePattern(empVar, 'rdf:type', 'Employee'));
    seniorQuery.addPattern(new TriplePattern(empVar, 'level', 'Senior'));
    seniorQuery.addPattern(new TriplePattern(empVar, 'location', locationVar));
    seniorQuery.addPattern(new TriplePattern(empVar, 'bonus', bonusVar));
    
    const avgBonusByLocationQuery = new AggregationQuery(seniorQuery, 'AVG');
    avgBonusByLocationQuery.setAggregateField('bonus');
    avgBonusByLocationQuery.groupBy('location');
    
    const avgBonusByLocationResult = await avgBonusByLocationQuery.execute(kg);
    
    const locationBonusAvgs = new Map();
    for (const binding of avgBonusByLocationResult.bindings) {
      locationBonusAvgs.set(binding.get('location'), binding.get('aggregate_result'));
    }
    
    expect(locationBonusAvgs.get('New York')).toBe(7500); // emp1 (7500)
    expect(locationBonusAvgs.get('San Francisco')).toBe(7750); // (emp4: 8500 + emp6: 7000) / 2
    
    // Group high-priority projects by department
    const projVar = new QueryVariable('project');
    const projDeptVar = new QueryVariable('department');
    const budgetVar = new QueryVariable('budget');
    
    const highPriorityQuery = new PatternQuery();
    highPriorityQuery.addPattern(new TriplePattern(projVar, 'rdf:type', 'Project'));
    highPriorityQuery.addPattern(new TriplePattern(projVar, 'priority', 'High'));
    highPriorityQuery.addPattern(new TriplePattern(projVar, 'department', projDeptVar));
    highPriorityQuery.addPattern(new TriplePattern(projVar, 'budget', budgetVar));
    
    const sumHighPriorityByDeptQuery = new AggregationQuery(highPriorityQuery, 'SUM');
    sumHighPriorityByDeptQuery.setAggregateField('budget');
    sumHighPriorityByDeptQuery.groupBy('department');
    
    const sumHighPriorityByDeptResult = await sumHighPriorityByDeptQuery.execute(kg);
    
    const highPrioritySums = new Map();
    for (const binding of sumHighPriorityByDeptResult.bindings) {
      highPrioritySums.set(binding.get('department'), binding.get('aggregate_result'));
    }
    
    expect(highPrioritySums.get('Engineering')).toBe(500000); // proj1
    expect(highPrioritySums.get('Sales')).toBe(300000); // proj3
    expect(highPrioritySums.has('Marketing')).toBe(false); // No high-priority marketing projects
  });
  
  test('Step 7.2.4: Test aggregation result formatting', async () => {
    // Test that grouped aggregation results are properly formatted
    
    const empVar = new QueryVariable('employee');
    const deptVar = new QueryVariable('department');
    const nameVar = new QueryVariable('name');
    
    const empQuery = new PatternQuery();
    empQuery.addPattern(new TriplePattern(empVar, 'rdf:type', 'Employee'));
    empQuery.addPattern(new TriplePattern(empVar, 'department', deptVar));
    empQuery.addPattern(new TriplePattern(empVar, 'name', nameVar));
    
    // Test COLLECT aggregation with grouping
    const collectNamesByDeptQuery = new AggregationQuery(empQuery, 'COLLECT');
    collectNamesByDeptQuery.setAggregateField('name');
    collectNamesByDeptQuery.groupBy('department');
    
    const collectNamesByDeptResult = await collectNamesByDeptQuery.execute(kg);
    
    expect(collectNamesByDeptResult.bindings.length).toBe(3);
    expect(collectNamesByDeptResult.variableNames).toEqual(['department', 'aggregate_result']);
    
    // Verify result structure and content
    const deptNames = new Map();
    for (const binding of collectNamesByDeptResult.bindings) {
      expect(binding instanceof Map).toBe(true);
      expect(binding.has('department')).toBe(true);
      expect(binding.has('aggregate_result')).toBe(true);
      
      const names = binding.get('aggregate_result');
      expect(Array.isArray(names)).toBe(true);
      deptNames.set(binding.get('department'), names);
    }
    
    const engineeringNames = deptNames.get('Engineering');
    expect(engineeringNames.length).toBe(3);
    expect(engineeringNames).toContain('Alice Johnson');
    expect(engineeringNames).toContain('Bob Smith');
    expect(engineeringNames).toContain('Frank Miller');
    
    const salesNames = deptNames.get('Sales');
    expect(salesNames.length).toBe(1);
    expect(salesNames).toContain('Charlie Brown');
    
    const marketingNames = deptNames.get('Marketing');
    expect(marketingNames.length).toBe(2);
    expect(marketingNames).toContain('Diana Prince');
    expect(marketingNames).toContain('Eve Wilson');
    
    // Test MIN/MAX aggregation formatting
    const salaryVar = new QueryVariable('salary');
    const salaryQuery = new PatternQuery();
    salaryQuery.addPattern(new TriplePattern(empVar, 'rdf:type', 'Employee'));
    salaryQuery.addPattern(new TriplePattern(empVar, 'department', deptVar));
    salaryQuery.addPattern(new TriplePattern(empVar, 'salary', salaryVar));
    
    const maxSalaryByDeptQuery = new AggregationQuery(salaryQuery, 'MAX');
    maxSalaryByDeptQuery.setAggregateField('salary');
    maxSalaryByDeptQuery.groupBy('department');
    
    const maxSalaryByDeptResult = await maxSalaryByDeptQuery.execute(kg);
    
    // Verify numeric result formatting
    for (const binding of maxSalaryByDeptResult.bindings) {
      const maxSalary = binding.get('aggregate_result');
      expect(typeof maxSalary).toBe('number');
      expect(maxSalary).toBeGreaterThan(0);
    }
  });
  
  test('Step 7.2.5: Test aggregation performance optimization', async () => {
    // Test that grouped aggregation performs efficiently
    
    const empVar = new QueryVariable('employee');
    const deptVar = new QueryVariable('department');
    const salaryVar = new QueryVariable('salary');
    
    const empQuery = new PatternQuery();
    empQuery.addPattern(new TriplePattern(empVar, 'rdf:type', 'Employee'));
    empQuery.addPattern(new TriplePattern(empVar, 'department', deptVar));
    empQuery.addPattern(new TriplePattern(empVar, 'salary', salaryVar));
    
    const avgSalaryByDeptQuery = new AggregationQuery(empQuery, 'AVG');
    avgSalaryByDeptQuery.setAggregateField('salary');
    avgSalaryByDeptQuery.groupBy('department');
    
    // Measure execution time
    const startTime = performance.now();
    const result = await avgSalaryByDeptQuery.execute(kg);
    const endTime = performance.now();
    const executionTime = endTime - startTime;
    
    // Verify results are correct
    expect(result.bindings.length).toBe(3);
    
    // Performance should be reasonable (less than 100ms for this small dataset)
    expect(executionTime).toBeLessThan(100);
    
    // Test that multiple executions are consistent
    const result2 = await avgSalaryByDeptQuery.execute(kg);
    expect(result2.bindings.length).toBe(result.bindings.length);
    
    // Verify results are identical
    const sortedResult1 = result.bindings.sort((a, b) => 
      a.get('department').localeCompare(b.get('department'))
    );
    const sortedResult2 = result2.bindings.sort((a, b) => 
      a.get('department').localeCompare(b.get('department'))
    );
    
    for (let i = 0; i < sortedResult1.length; i++) {
      expect(sortedResult1[i].get('department')).toBe(sortedResult2[i].get('department'));
      expect(sortedResult1[i].get('aggregate_result')).toBe(sortedResult2[i].get('aggregate_result'));
    }
    
    // Test serialization performance
    const serializationStartTime = performance.now();
    const triples = avgSalaryByDeptQuery.toTriples();
    const serializationEndTime = performance.now();
    const serializationTime = serializationEndTime - serializationStartTime;
    
    expect(Array.isArray(triples)).toBe(true);
    expect(triples.length).toBeGreaterThan(0);
    expect(serializationTime).toBeLessThan(50); // Should be very fast
    
    // Verify serialization includes groupBy information
    const groupByTriples = triples.filter(triple => triple[1] === 'kg:groupByField');
    expect(groupByTriples.length).toBe(1); // One groupBy field
    expect(groupByTriples[0][2]).toBe('department');
  });
});
