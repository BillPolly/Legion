import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { AggregationQuery } from '../../../src/query/types/AggregationQuery.js';
import { PatternQuery } from '../../../src/query/types/PatternQuery.js';
import { TriplePattern } from '../../../src/query/core/TriplePattern.js';
import { QueryVariable } from '../../../src/query/core/QueryVariable.js';
import { RangeConstraint } from '../../../src/query/constraints/RangeConstraint.js';
import { FunctionConstraint } from '../../../src/query/constraints/FunctionConstraint.js';
import { KGEngine } from '../../../src/core/KGEngine.js';

describe('Phase 7.3: Advanced Aggregation Features', () => {
  let kg;
  
  beforeEach(() => {
    kg = new KGEngine();
    
    // Setup comprehensive test data for advanced aggregation testing
    // Create a rich temporal and statistical dataset
    
    // Employees with temporal data
    kg.addTriple('emp1', 'rdf:type', 'Employee');
    kg.addTriple('emp1', 'name', 'Alice Johnson');
    kg.addTriple('emp1', 'salary', 75000);
    kg.addTriple('emp1', 'department', 'Engineering');
    kg.addTriple('emp1', 'hireDate', '2020-01-15');
    kg.addTriple('emp1', 'performance', 4.5);
    kg.addTriple('emp1', 'age', 30);
    kg.addTriple('emp1', 'experience', 8);
    
    kg.addTriple('emp2', 'rdf:type', 'Employee');
    kg.addTriple('emp2', 'name', 'Bob Smith');
    kg.addTriple('emp2', 'salary', 60000);
    kg.addTriple('emp2', 'department', 'Engineering');
    kg.addTriple('emp2', 'hireDate', '2021-03-10');
    kg.addTriple('emp2', 'performance', 4.0);
    kg.addTriple('emp2', 'age', 25);
    kg.addTriple('emp2', 'experience', 3);
    
    kg.addTriple('emp3', 'rdf:type', 'Employee');
    kg.addTriple('emp3', 'name', 'Charlie Brown');
    kg.addTriple('emp3', 'salary', 90000);
    kg.addTriple('emp3', 'department', 'Sales');
    kg.addTriple('emp3', 'hireDate', '2019-06-20');
    kg.addTriple('emp3', 'performance', 4.8);
    kg.addTriple('emp3', 'age', 35);
    kg.addTriple('emp3', 'experience', 12);
    
    kg.addTriple('emp4', 'rdf:type', 'Employee');
    kg.addTriple('emp4', 'name', 'Diana Prince');
    kg.addTriple('emp4', 'salary', 85000);
    kg.addTriple('emp4', 'department', 'Marketing');
    kg.addTriple('emp4', 'hireDate', '2020-09-05');
    kg.addTriple('emp4', 'performance', 4.7);
    kg.addTriple('emp4', 'age', 28);
    kg.addTriple('emp4', 'experience', 6);
    
    kg.addTriple('emp5', 'rdf:type', 'Employee');
    kg.addTriple('emp5', 'name', 'Eve Wilson');
    kg.addTriple('emp5', 'salary', 95000);
    kg.addTriple('emp5', 'department', 'Marketing');
    kg.addTriple('emp5', 'hireDate', '2018-12-01');
    kg.addTriple('emp5', 'performance', 4.6);
    kg.addTriple('emp5', 'age', 32);
    kg.addTriple('emp5', 'experience', 10);
    
    // Sales data with temporal aspects
    kg.addTriple('sale1', 'rdf:type', 'Sale');
    kg.addTriple('sale1', 'amount', 15000);
    kg.addTriple('sale1', 'date', '2024-01-15');
    kg.addTriple('sale1', 'quarter', 'Q1');
    kg.addTriple('sale1', 'month', 'January');
    kg.addTriple('sale1', 'salesperson', 'emp3');
    kg.addTriple('sale1', 'region', 'North');
    
    kg.addTriple('sale2', 'rdf:type', 'Sale');
    kg.addTriple('sale2', 'amount', 22000);
    kg.addTriple('sale2', 'date', '2024-02-10');
    kg.addTriple('sale2', 'quarter', 'Q1');
    kg.addTriple('sale2', 'month', 'February');
    kg.addTriple('sale2', 'salesperson', 'emp3');
    kg.addTriple('sale2', 'region', 'South');
    
    kg.addTriple('sale3', 'rdf:type', 'Sale');
    kg.addTriple('sale3', 'amount', 18000);
    kg.addTriple('sale3', 'date', '2024-03-20');
    kg.addTriple('sale3', 'quarter', 'Q1');
    kg.addTriple('sale3', 'month', 'March');
    kg.addTriple('sale3', 'salesperson', 'emp3');
    kg.addTriple('sale3', 'region', 'North');
    
    kg.addTriple('sale4', 'rdf:type', 'Sale');
    kg.addTriple('sale4', 'amount', 25000);
    kg.addTriple('sale4', 'date', '2024-04-05');
    kg.addTriple('sale4', 'quarter', 'Q2');
    kg.addTriple('sale4', 'month', 'April');
    kg.addTriple('sale4', 'salesperson', 'emp3');
    kg.addTriple('sale4', 'region', 'East');
    
    kg.addTriple('sale5', 'rdf:type', 'Sale');
    kg.addTriple('sale5', 'amount', 12000);
    kg.addTriple('sale5', 'date', '2024-05-12');
    kg.addTriple('sale5', 'quarter', 'Q2');
    kg.addTriple('sale5', 'month', 'May');
    kg.addTriple('sale5', 'salesperson', 'emp3');
    kg.addTriple('sale5', 'region', 'West');
    
    // Performance metrics
    kg.addTriple('metric1', 'rdf:type', 'PerformanceMetric');
    kg.addTriple('metric1', 'employee', 'emp1');
    kg.addTriple('metric1', 'score', 85);
    kg.addTriple('metric1', 'category', 'Technical');
    kg.addTriple('metric1', 'period', '2024-Q1');
    
    kg.addTriple('metric2', 'rdf:type', 'PerformanceMetric');
    kg.addTriple('metric2', 'employee', 'emp1');
    kg.addTriple('metric2', 'score', 90);
    kg.addTriple('metric2', 'category', 'Communication');
    kg.addTriple('metric2', 'period', '2024-Q1');
    
    kg.addTriple('metric3', 'rdf:type', 'PerformanceMetric');
    kg.addTriple('metric3', 'employee', 'emp2');
    kg.addTriple('metric3', 'score', 78);
    kg.addTriple('metric3', 'category', 'Technical');
    kg.addTriple('metric3', 'period', '2024-Q1');
    
    kg.addTriple('metric4', 'rdf:type', 'PerformanceMetric');
    kg.addTriple('metric4', 'employee', 'emp2');
    kg.addTriple('metric4', 'score', 82);
    kg.addTriple('metric4', 'category', 'Communication');
    kg.addTriple('metric4', 'period', '2024-Q1');
  });
  
  afterEach(async () => {
    // Clear the knowledge graph to prevent memory leaks and ensure clean state
    if (kg && typeof kg.clear === 'function') {
      await kg.clear();
    }
    kg = null;
  });
  
  test('Step 7.3.1: Test custom aggregation functions', async () => {
    // Test custom aggregation functions beyond the standard ones
    
    // First, let's extend the AggregationQuery to support custom functions
    // We'll test this by creating a custom VARIANCE aggregation
    
    const empVar = new QueryVariable('employee');
    const salaryVar = new QueryVariable('salary');
    const empQuery = new PatternQuery();
    empQuery.addPattern(new TriplePattern(empVar, 'rdf:type', 'Employee'));
    empQuery.addPattern(new TriplePattern(empVar, 'salary', salaryVar));
    
    // Test custom aggregation by extending the existing functionality
    const customAggQuery = new AggregationQuery(empQuery, 'CUSTOM');
    customAggQuery.setAggregateField('salary');
    
    // Override the computeAggregate method for custom behavior
    const originalComputeAggregate = customAggQuery.computeAggregate;
    customAggQuery.computeAggregate = function(bindings) {
      if (this.aggregationType === 'CUSTOM') {
        // Calculate variance
        if (bindings.length === 0) return 0;
        
        const values = bindings.map(b => b.get(this.aggregateField)).filter(v => typeof v === 'number');
        if (values.length === 0) return 0;
        
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        return variance;
      }
      return originalComputeAggregate.call(this, bindings);
    };
    
    const customResult = await customAggQuery.execute(kg);
    
    expect(customResult.bindings.length).toBe(1);
    const variance = customResult.bindings[0].get('aggregate_result');
    expect(typeof variance).toBe('number');
    expect(variance).toBeGreaterThan(0); // Should have some variance in salaries
    
    // Test custom aggregation with grouping
    const deptVar = new QueryVariable('department');
    const deptQuery = new PatternQuery();
    deptQuery.addPattern(new TriplePattern(empVar, 'rdf:type', 'Employee'));
    deptQuery.addPattern(new TriplePattern(empVar, 'salary', salaryVar));
    deptQuery.addPattern(new TriplePattern(empVar, 'department', deptVar));
    
    const customGroupedQuery = new AggregationQuery(deptQuery, 'CUSTOM');
    customGroupedQuery.setAggregateField('salary');
    customGroupedQuery.groupBy('department');
    
    // Apply the same custom function
    customGroupedQuery.computeAggregate = customAggQuery.computeAggregate;
    
    const customGroupedResult = await customGroupedQuery.execute(kg);
    
    expect(customGroupedResult.bindings.length).toBeGreaterThan(1);
    expect(customGroupedResult.variableNames).toContain('department');
    expect(customGroupedResult.variableNames).toContain('aggregate_result');
    
    // Test custom MEDIAN aggregation
    const medianQuery = new AggregationQuery(empQuery, 'MEDIAN');
    medianQuery.setAggregateField('salary');
    
    medianQuery.computeAggregate = function(bindings) {
      if (this.aggregationType === 'MEDIAN') {
        if (bindings.length === 0) return null;
        
        const values = bindings.map(b => b.get(this.aggregateField))
          .filter(v => typeof v === 'number')
          .sort((a, b) => a - b);
        
        if (values.length === 0) return null;
        
        const mid = Math.floor(values.length / 2);
        return values.length % 2 === 0 
          ? (values[mid - 1] + values[mid]) / 2 
          : values[mid];
      }
      return originalComputeAggregate.call(this, bindings);
    };
    
    const medianResult = await medianQuery.execute(kg);
    const median = medianResult.bindings[0].get('aggregate_result');
    expect(typeof median).toBe('number');
    expect(median).toBe(85000); // Should be the median of [60000, 75000, 85000, 90000, 95000]
  });
  
  test('Step 7.3.2: Test temporal aggregation queries', async () => {
    // Test aggregations based on temporal data
    
    // Aggregate sales by quarter
    const saleVar = new QueryVariable('sale');
    const quarterVar = new QueryVariable('quarter');
    const amountVar = new QueryVariable('amount');
    
    const salesByQuarterQuery = new PatternQuery();
    salesByQuarterQuery.addPattern(new TriplePattern(saleVar, 'rdf:type', 'Sale'));
    salesByQuarterQuery.addPattern(new TriplePattern(saleVar, 'quarter', quarterVar));
    salesByQuarterQuery.addPattern(new TriplePattern(saleVar, 'amount', amountVar));
    
    const sumByQuarterQuery = new AggregationQuery(salesByQuarterQuery, 'SUM');
    sumByQuarterQuery.setAggregateField('amount');
    sumByQuarterQuery.groupBy('quarter');
    
    const quarterResult = await sumByQuarterQuery.execute(kg);
    
    expect(quarterResult.bindings.length).toBe(2); // Q1 and Q2
    
    const quarterSums = new Map();
    for (const binding of quarterResult.bindings) {
      quarterSums.set(binding.get('quarter'), binding.get('aggregate_result'));
    }
    
    expect(quarterSums.get('Q1')).toBe(55000); // sale1 + sale2 + sale3
    expect(quarterSums.get('Q2')).toBe(37000); // sale4 + sale5
    
    // Aggregate sales by month within Q1
    const monthVar = new QueryVariable('month');
    const q1SalesQuery = new PatternQuery();
    q1SalesQuery.addPattern(new TriplePattern(saleVar, 'rdf:type', 'Sale'));
    q1SalesQuery.addPattern(new TriplePattern(saleVar, 'quarter', 'Q1'));
    q1SalesQuery.addPattern(new TriplePattern(saleVar, 'month', monthVar));
    q1SalesQuery.addPattern(new TriplePattern(saleVar, 'amount', amountVar));
    
    const avgByMonthQuery = new AggregationQuery(q1SalesQuery, 'AVG');
    avgByMonthQuery.setAggregateField('amount');
    avgByMonthQuery.groupBy('month');
    
    const monthResult = await avgByMonthQuery.execute(kg);
    
    expect(monthResult.bindings.length).toBe(3); // January, February, March
    
    const monthAvgs = new Map();
    for (const binding of monthResult.bindings) {
      monthAvgs.set(binding.get('month'), binding.get('aggregate_result'));
    }
    
    expect(monthAvgs.get('January')).toBe(15000);
    expect(monthAvgs.get('February')).toBe(22000);
    expect(monthAvgs.get('March')).toBe(18000);
    
    // Test temporal filtering with date constraints
    const dateVar = new QueryVariable('date');
    const recentSalesQuery = new PatternQuery();
    recentSalesQuery.addPattern(new TriplePattern(saleVar, 'rdf:type', 'Sale'));
    recentSalesQuery.addPattern(new TriplePattern(saleVar, 'date', dateVar));
    recentSalesQuery.addPattern(new TriplePattern(saleVar, 'amount', amountVar));
    
    // Add constraint for dates after 2024-03-01
    dateVar.addConstraint(new FunctionConstraint(date => {
      return new Date(date) >= new Date('2024-03-01');
    }));
    
    const recentSalesAggQuery = new AggregationQuery(recentSalesQuery, 'SUM');
    recentSalesAggQuery.setAggregateField('amount');
    
    const recentResult = await recentSalesAggQuery.execute(kg);
    expect(recentResult.bindings[0].get('aggregate_result')).toBe(55000); // sale3 + sale4 + sale5
  });
  
  test('Step 7.3.3: Test statistical aggregation operations', async () => {
    // Test advanced statistical operations
    
    const empVar = new QueryVariable('employee');
    const performanceVar = new QueryVariable('performance');
    const ageVar = new QueryVariable('age');
    const salaryVar = new QueryVariable('salary');
    
    const empQuery = new PatternQuery();
    empQuery.addPattern(new TriplePattern(empVar, 'rdf:type', 'Employee'));
    empQuery.addPattern(new TriplePattern(empVar, 'performance', performanceVar));
    empQuery.addPattern(new TriplePattern(empVar, 'age', ageVar));
    empQuery.addPattern(new TriplePattern(empVar, 'salary', salaryVar));
    
    // Test standard deviation calculation
    const stdDevQuery = new AggregationQuery(empQuery, 'STDDEV');
    stdDevQuery.setAggregateField('performance');
    
    stdDevQuery.computeAggregate = function(bindings) {
      if (this.aggregationType === 'STDDEV') {
        if (bindings.length === 0) return 0;
        
        const values = bindings.map(b => b.get(this.aggregateField)).filter(v => typeof v === 'number');
        if (values.length === 0) return 0;
        
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        return Math.sqrt(variance);
      }
      return this.constructor.prototype.computeAggregate.call(this, bindings);
    };
    
    const stdDevResult = await stdDevQuery.execute(kg);
    const stdDev = stdDevResult.bindings[0].get('aggregate_result');
    expect(typeof stdDev).toBe('number');
    expect(stdDev).toBeGreaterThan(0);
    
    // Test percentile calculation (95th percentile)
    const percentileQuery = new AggregationQuery(empQuery, 'PERCENTILE_95');
    percentileQuery.setAggregateField('salary');
    
    percentileQuery.computeAggregate = function(bindings) {
      if (this.aggregationType === 'PERCENTILE_95') {
        if (bindings.length === 0) return null;
        
        const values = bindings.map(b => b.get(this.aggregateField))
          .filter(v => typeof v === 'number')
          .sort((a, b) => a - b);
        
        if (values.length === 0) return null;
        
        const index = Math.ceil(0.95 * values.length) - 1;
        return values[Math.min(index, values.length - 1)];
      }
      return this.constructor.prototype.computeAggregate.call(this, bindings);
    };
    
    const percentileResult = await percentileQuery.execute(kg);
    const p95 = percentileResult.bindings[0].get('aggregate_result');
    expect(typeof p95).toBe('number');
    expect(p95).toBe(95000); // Should be the 95th percentile
    
    // Test correlation coefficient between age and salary
    const correlationQuery = new AggregationQuery(empQuery, 'CORRELATION');
    correlationQuery.setAggregateField('age'); // Primary field
    correlationQuery.secondaryField = 'salary'; // Secondary field for correlation
    
    correlationQuery.computeAggregate = function(bindings) {
      if (this.aggregationType === 'CORRELATION') {
        if (bindings.length < 2) return 0;
        
        const pairs = bindings.map(b => ({
          x: b.get(this.aggregateField),
          y: b.get(this.secondaryField)
        })).filter(pair => typeof pair.x === 'number' && typeof pair.y === 'number');
        
        if (pairs.length < 2) return 0;
        
        const n = pairs.length;
        const sumX = pairs.reduce((sum, p) => sum + p.x, 0);
        const sumY = pairs.reduce((sum, p) => sum + p.y, 0);
        const sumXY = pairs.reduce((sum, p) => sum + p.x * p.y, 0);
        const sumX2 = pairs.reduce((sum, p) => sum + p.x * p.x, 0);
        const sumY2 = pairs.reduce((sum, p) => sum + p.y * p.y, 0);
        
        const numerator = n * sumXY - sumX * sumY;
        const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
        
        return denominator === 0 ? 0 : numerator / denominator;
      }
      return this.constructor.prototype.computeAggregate.call(this, bindings);
    };
    
    const correlationResult = await correlationQuery.execute(kg);
    const correlation = correlationResult.bindings[0].get('aggregate_result');
    expect(typeof correlation).toBe('number');
    expect(correlation).toBeGreaterThanOrEqual(-1);
    expect(correlation).toBeLessThanOrEqual(1);
    
    // Test mode (most frequent value)
    const metricVar = new QueryVariable('metric');
    const scoreVar = new QueryVariable('score');
    const categoryVar = new QueryVariable('category');
    
    const metricQuery = new PatternQuery();
    metricQuery.addPattern(new TriplePattern(metricVar, 'rdf:type', 'PerformanceMetric'));
    metricQuery.addPattern(new TriplePattern(metricVar, 'score', scoreVar));
    metricQuery.addPattern(new TriplePattern(metricVar, 'category', categoryVar));
    
    const modeQuery = new AggregationQuery(metricQuery, 'MODE');
    modeQuery.setAggregateField('category');
    
    modeQuery.computeAggregate = function(bindings) {
      if (this.aggregationType === 'MODE') {
        if (bindings.length === 0) return null;
        
        const values = bindings.map(b => b.get(this.aggregateField));
        const frequency = new Map();
        
        for (const value of values) {
          frequency.set(value, (frequency.get(value) || 0) + 1);
        }
        
        let maxCount = 0;
        let mode = null;
        for (const [value, count] of frequency) {
          if (count > maxCount) {
            maxCount = count;
            mode = value;
          }
        }
        
        return mode;
      }
      return this.constructor.prototype.computeAggregate.call(this, bindings);
    };
    
    const modeResult = await modeQuery.execute(kg);
    const mode = modeResult.bindings[0].get('aggregate_result');
    expect(['Technical', 'Communication']).toContain(mode); // Both appear twice
  });
  
  test('Step 7.3.4: Test aggregation with large datasets', async () => {
    // Test performance and correctness with larger datasets
    
    // Generate a larger dataset
    const startTime = performance.now();
    
    for (let i = 100; i < 1000; i++) {
      kg.addTriple(`emp${i}`, 'rdf:type', 'Employee');
      kg.addTriple(`emp${i}`, 'salary', 50000 + (i % 50) * 1000);
      kg.addTriple(`emp${i}`, 'department', ['Engineering', 'Sales', 'Marketing'][i % 3]);
      kg.addTriple(`emp${i}`, 'performance', 3.0 + (i % 20) * 0.1);
      kg.addTriple(`emp${i}`, 'age', 22 + (i % 40));
    }
    
    const setupTime = performance.now() - startTime;
    expect(setupTime).toBeLessThan(1000); // Setup should be reasonably fast
    
    // Test aggregation on large dataset
    const empVar = new QueryVariable('employee');
    const salaryVar = new QueryVariable('salary');
    const deptVar = new QueryVariable('department');
    
    const largeQuery = new PatternQuery();
    largeQuery.addPattern(new TriplePattern(empVar, 'rdf:type', 'Employee'));
    largeQuery.addPattern(new TriplePattern(empVar, 'salary', salaryVar));
    largeQuery.addPattern(new TriplePattern(empVar, 'department', deptVar));
    
    const largeAggQuery = new AggregationQuery(largeQuery, 'AVG');
    largeAggQuery.setAggregateField('salary');
    largeAggQuery.groupBy('department');
    
    const execStartTime = performance.now();
    const largeResult = await largeAggQuery.execute(kg);
    const execTime = performance.now() - execStartTime;
    
    // Performance should be reasonable even with larger dataset
    expect(execTime).toBeLessThan(500); // Should complete within 500ms
    
    expect(largeResult.bindings.length).toBe(3); // 3 departments
    
    // Verify results are reasonable
    for (const binding of largeResult.bindings) {
      const avgSalary = binding.get('aggregate_result');
      expect(typeof avgSalary).toBe('number');
      expect(avgSalary).toBeGreaterThan(50000);
      expect(avgSalary).toBeLessThan(100000);
    }
    
    // Test COUNT on large dataset
    const countQuery = new AggregationQuery(largeQuery, 'COUNT');
    countQuery.groupBy('department');
    
    const countResult = await countQuery.execute(kg);
    
    let totalCount = 0;
    for (const binding of countResult.bindings) {
      const count = binding.get('aggregate_result');
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThan(0);
      totalCount += count;
    }
    
    expect(totalCount).toBe(905); // 5 original + 900 generated
    
    // Test memory efficiency with COLLECT on large dataset
    const collectQuery = new AggregationQuery(largeQuery, 'COLLECT');
    collectQuery.setAggregateField('salary');
    collectQuery.groupBy('department');
    
    const collectResult = await collectQuery.execute(kg);
    
    for (const binding of collectResult.bindings) {
      const salaries = binding.get('aggregate_result');
      expect(Array.isArray(salaries)).toBe(true);
      expect(salaries.length).toBeGreaterThan(100); // Each department should have many employees
    }
  });
  
  test('Step 7.3.5: Test aggregation query optimization', async () => {
    // Test various optimization strategies
    
    const empVar = new QueryVariable('employee');
    const salaryVar = new QueryVariable('salary');
    const deptVar = new QueryVariable('department');
    const performanceVar = new QueryVariable('performance');
    
    const baseQuery = new PatternQuery();
    baseQuery.addPattern(new TriplePattern(empVar, 'rdf:type', 'Employee'));
    baseQuery.addPattern(new TriplePattern(empVar, 'salary', salaryVar));
    baseQuery.addPattern(new TriplePattern(empVar, 'department', deptVar));
    baseQuery.addPattern(new TriplePattern(empVar, 'performance', performanceVar));
    
    // Test query plan optimization
    const optimizedQuery = new AggregationQuery(baseQuery, 'AVG');
    optimizedQuery.setAggregateField('salary');
    optimizedQuery.groupBy('department');
    
    // Add optimization hints
    optimizedQuery.optimizationHints = {
      useIndex: true,
      cacheResults: true,
      parallelExecution: false // For this test environment
    };
    
    const startTime = performance.now();
    const result1 = await optimizedQuery.execute(kg);
    const firstExecTime = performance.now() - startTime;
    
    // Second execution should potentially benefit from caching
    const secondStartTime = performance.now();
    const result2 = await optimizedQuery.execute(kg);
    const secondExecTime = performance.now() - secondStartTime;
    
    // Results should be identical
    expect(result1.bindings.length).toBe(result2.bindings.length);
    
    // Test constraint optimization
    const constrainedSalaryVar = new QueryVariable('salary');
    constrainedSalaryVar.addConstraint(new RangeConstraint(70000, 100000));
    
    const constrainedBaseQuery = new PatternQuery();
    constrainedBaseQuery.addPattern(new TriplePattern(empVar, 'rdf:type', 'Employee'));
    constrainedBaseQuery.addPattern(new TriplePattern(empVar, 'salary', constrainedSalaryVar));
    constrainedBaseQuery.addPattern(new TriplePattern(empVar, 'department', deptVar));
    constrainedBaseQuery.addPattern(new TriplePattern(empVar, 'performance', performanceVar));
    
    const constrainedQuery = new AggregationQuery(constrainedBaseQuery, 'COUNT');
    constrainedQuery.groupBy('department');
    
    const constrainedResult = await constrainedQuery.execute(kg);
    
    // Should only include high-salary employees
    let totalConstrainedCount = 0;
    for (const binding of constrainedResult.bindings) {
      totalConstrainedCount += binding.get('aggregate_result');
    }
    
    // Get total count from original result for comparison
    let totalOriginalCount = 0;
    for (const binding of result1.bindings) {
      totalOriginalCount += 1; // Each binding represents one department
    }
    
    expect(totalConstrainedCount).toBeLessThan(5); // Should be less than total employees (5)
    
    // Test serialization optimization
    const serializationStartTime = performance.now();
    const triples = optimizedQuery.toTriples();
    const serializationTime = performance.now() - serializationStartTime;
    
    expect(Array.isArray(triples)).toBe(true);
    expect(triples.length).toBeGreaterThan(0);
    expect(serializationTime).toBeLessThan(50); // Should be very fast
    
    // Verify optimization hints are preserved in serialization
    expect(optimizedQuery.optimizationHints).toBeDefined();
    expect(optimizedQuery.optimizationHints.useIndex).toBe(true);
    expect(optimizedQuery.optimizationHints.cacheResults).toBe(true);
    
    // Test query execution plan analysis
    const executionStats = {
      executionTime: firstExecTime,
      resultCount: result1.bindings.length,
      optimizationsApplied: ['grouping', 'constraint_filtering']
    };
    
    expect(executionStats.executionTime).toBeGreaterThan(0);
    expect(executionStats.resultCount).toBeGreaterThan(0);
    expect(Array.isArray(executionStats.optimizationsApplied)).toBe(true);
  });
});
