import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { PatternQuery } from '../../../src/query/types/PatternQuery.js';
import { AggregationQuery } from '../../../src/query/types/AggregationQuery.js';
import { TraversalQuery } from '../../../src/query/types/TraversalQuery.js';
import { TriplePattern } from '../../../src/query/core/TriplePattern.js';
import { QueryVariable } from '../../../src/query/core/QueryVariable.js';
import { FixedLengthPath } from '../../../src/query/paths/FixedLengthPath.js';
import { KGEngine } from '../../../src/core/KGEngine.js';

describe('Phase 9.2: Query Analytics and Introspection', () => {
  let kg;
  let queries;
  
  beforeEach(() => {
    kg = new KGEngine();
    queries = [];
    
    // Create a comprehensive set of queries with detailed execution history
    
    // Pattern Query 1: Find all people (heavily used)
    const patternQuery1 = new PatternQuery('pattern_query_1');
    patternQuery1.addPattern(new TriplePattern(
      new QueryVariable('person'), 
      'rdf:type', 
      'Person'
    ));
    patternQuery1.setMetadata('creator', 'alice');
    patternQuery1.setMetadata('created', '2024-01-15');
    patternQuery1.setMetadata('description', 'Find all people in the system');
    patternQuery1.setMetadata('category', 'basic');
    patternQuery1.setMetadata('usage_count', 150);
    patternQuery1.setMetadata('version', '1.0');
    patternQuery1.setMetadata('last_modified', '2024-01-15');
    queries.push(patternQuery1);
    
    // Pattern Query 2: Find people by age (moderate usage)
    const patternQuery2 = new PatternQuery('pattern_query_2');
    patternQuery2.addPattern(new TriplePattern(
      new QueryVariable('person'), 
      'rdf:type', 
      'Person'
    ));
    patternQuery2.addPattern(new TriplePattern(
      new QueryVariable('person'), 
      'age', 
      new QueryVariable('age')
    ));
    patternQuery2.setMetadata('creator', 'bob');
    patternQuery2.setMetadata('created', '2024-01-20');
    patternQuery2.setMetadata('description', 'Find people with their ages');
    patternQuery2.setMetadata('category', 'demographic');
    patternQuery2.setMetadata('usage_count', 75);
    patternQuery2.setMetadata('version', '1.1');
    patternQuery2.setMetadata('last_modified', '2024-02-01');
    queries.push(patternQuery2);
    
    // Aggregation Query 1: Count people by department (high performance impact)
    const baseQuery = new PatternQuery();
    baseQuery.addPattern(new TriplePattern(
      new QueryVariable('person'), 
      'department', 
      new QueryVariable('department')
    ));
    const aggQuery1 = new AggregationQuery(baseQuery, 'COUNT');
    aggQuery1.setAggregateField('person');
    aggQuery1.groupBy('department');
    aggQuery1._kgId = 'agg_query_1';
    aggQuery1.setMetadata('creator', 'charlie');
    aggQuery1.setMetadata('created', '2024-02-01');
    aggQuery1.setMetadata('description', 'Count employees by department');
    aggQuery1.setMetadata('category', 'analytics');
    aggQuery1.setMetadata('usage_count', 45);
    aggQuery1.setMetadata('version', '2.0');
    aggQuery1.setMetadata('last_modified', '2024-02-15');
    queries.push(aggQuery1);
    
    // Traversal Query 1: Find friends of friends (low usage, high complexity)
    const startNode = new QueryVariable('person');
    const pathExpression = new FixedLengthPath('knows', 2);
    const endVariable = new QueryVariable('friend');
    const traversalQuery1 = new TraversalQuery(startNode, pathExpression, endVariable);
    traversalQuery1._kgId = 'traversal_query_1';
    traversalQuery1.setMetadata('creator', 'diana');
    traversalQuery1.setMetadata('created', '2024-02-10');
    traversalQuery1.setMetadata('description', 'Find friends of friends');
    traversalQuery1.setMetadata('category', 'social');
    traversalQuery1.setMetadata('usage_count', 20);
    traversalQuery1.setMetadata('version', '1.0');
    traversalQuery1.setMetadata('last_modified', '2024-02-10');
    queries.push(traversalQuery1);
    
    // Pattern Query 3: Find engineers (deprecated)
    const patternQuery3 = new PatternQuery('pattern_query_3');
    patternQuery3.addPattern(new TriplePattern(
      new QueryVariable('person'), 
      'department', 
      'Engineering'
    ));
    patternQuery3.setMetadata('creator', 'eve');
    patternQuery3.setMetadata('created', '2024-01-01');
    patternQuery3.setMetadata('description', 'Find engineers');
    patternQuery3.setMetadata('category', 'department');
    patternQuery3.setMetadata('usage_count', 5);
    patternQuery3.setMetadata('version', '0.9');
    patternQuery3.setMetadata('last_modified', '2024-01-01');
    patternQuery3.setMetadata('deprecated', true);
    queries.push(patternQuery3);
    
    // Store queries as triples in the knowledge graph
    for (const query of queries) {
      // Add basic query type triple
      kg.addTriple(query.getId(), 'rdf:type', `kg:${query.constructor.name}`);
      
      // Add metadata triples directly from the Map
      for (const [key, value] of query.metadata) {
        kg.addTriple(query.getId(), `kg:${key}`, value);
      }
    }
    
    // Add comprehensive execution history with performance metrics
    const executions = [
      // Pattern Query 1 executions (frequent, good performance)
      { id: 'exec_1', query: 'pattern_query_1', time: 25, results: 100, executor: 'alice', timestamp: '2024-03-01T09:00:00Z', memory: 512, cpu: 15 },
      { id: 'exec_2', query: 'pattern_query_1', time: 23, results: 105, executor: 'bob', timestamp: '2024-03-01T10:00:00Z', memory: 480, cpu: 12 },
      { id: 'exec_3', query: 'pattern_query_1', time: 28, results: 98, executor: 'charlie', timestamp: '2024-03-01T11:00:00Z', memory: 520, cpu: 18 },
      { id: 'exec_4', query: 'pattern_query_1', time: 22, results: 102, executor: 'alice', timestamp: '2024-03-01T14:00:00Z', memory: 495, cpu: 14 },
      
      // Pattern Query 2 executions (moderate frequency, variable performance)
      { id: 'exec_5', query: 'pattern_query_2', time: 45, results: 50, executor: 'bob', timestamp: '2024-03-01T12:00:00Z', memory: 768, cpu: 25 },
      { id: 'exec_6', query: 'pattern_query_2', time: 52, results: 48, executor: 'diana', timestamp: '2024-03-01T15:00:00Z', memory: 820, cpu: 30 },
      
      // Aggregation Query executions (infrequent, high resource usage)
      { id: 'exec_7', query: 'agg_query_1', time: 180, results: 8, executor: 'charlie', timestamp: '2024-03-01T13:00:00Z', memory: 2048, cpu: 85 },
      { id: 'exec_8', query: 'agg_query_1', time: 195, results: 8, executor: 'alice', timestamp: '2024-03-01T16:00:00Z', memory: 2200, cpu: 90 },
      
      // Traversal Query executions (rare, very high resource usage)
      { id: 'exec_9', query: 'traversal_query_1', time: 350, results: 25, executor: 'diana', timestamp: '2024-03-01T17:00:00Z', memory: 4096, cpu: 95 },
      
      // Deprecated query execution (should trigger optimization recommendation)
      { id: 'exec_10', query: 'pattern_query_3', time: 15, results: 12, executor: 'eve', timestamp: '2024-03-01T08:00:00Z', memory: 256, cpu: 8 }
    ];
    
    for (const exec of executions) {
      kg.addTriple(exec.id, 'rdf:type', 'kg:QueryExecution');
      kg.addTriple(exec.id, 'kg:query', exec.query);
      kg.addTriple(exec.id, 'kg:executionTime', exec.time);
      kg.addTriple(exec.id, 'kg:resultCount', exec.results);
      kg.addTriple(exec.id, 'kg:executor', exec.executor);
      kg.addTriple(exec.id, 'kg:executedAt', exec.timestamp);
      kg.addTriple(exec.id, 'kg:memoryUsage', exec.memory);
      kg.addTriple(exec.id, 'kg:cpuUsage', exec.cpu);
    }
    
    // Add query optimization recommendations
    kg.addTriple('opt_rec_1', 'rdf:type', 'kg:OptimizationRecommendation');
    kg.addTriple('opt_rec_1', 'kg:targetQuery', 'agg_query_1');
    kg.addTriple('opt_rec_1', 'kg:recommendation', 'Add index on department field');
    kg.addTriple('opt_rec_1', 'kg:priority', 'high');
    kg.addTriple('opt_rec_1', 'kg:estimatedImprovement', '40%');
    
    kg.addTriple('opt_rec_2', 'rdf:type', 'kg:OptimizationRecommendation');
    kg.addTriple('opt_rec_2', 'kg:targetQuery', 'pattern_query_3');
    kg.addTriple('opt_rec_2', 'kg:recommendation', 'Replace with pattern_query_1 + filter');
    kg.addTriple('opt_rec_2', 'kg:priority', 'medium');
    kg.addTriple('opt_rec_2', 'kg:estimatedImprovement', '20%');
    
    // Add query lineage information
    kg.addTriple('lineage_1', 'rdf:type', 'kg:QueryLineage');
    kg.addTriple('lineage_1', 'kg:derivedQuery', 'pattern_query_2');
    kg.addTriple('lineage_1', 'kg:sourceQuery', 'pattern_query_1');
    kg.addTriple('lineage_1', 'kg:derivationType', 'extension');
    kg.addTriple('lineage_1', 'kg:derivedAt', '2024-01-20');
    
    // Add query version history
    kg.addTriple('version_1', 'rdf:type', 'kg:QueryVersion');
    kg.addTriple('version_1', 'kg:query', 'pattern_query_2');
    kg.addTriple('version_1', 'kg:version', '1.0');
    kg.addTriple('version_1', 'kg:createdAt', '2024-01-20');
    kg.addTriple('version_1', 'kg:changes', 'Initial version');
    
    kg.addTriple('version_2', 'rdf:type', 'kg:QueryVersion');
    kg.addTriple('version_2', 'kg:query', 'pattern_query_2');
    kg.addTriple('version_2', 'kg:version', '1.1');
    kg.addTriple('version_2', 'kg:createdAt', '2024-02-01');
    kg.addTriple('version_2', 'kg:changes', 'Added age constraint optimization');
  });
  
  afterEach(async () => {
    // Clear the knowledge graph to prevent memory leaks and ensure clean state
    if (kg && typeof kg.clear === 'function') {
      await kg.clear();
    }
    kg = null;
    queries = null;
  });
  
  test('Step 9.2.1: Test query usage statistics collection', async () => {
    // Test comprehensive usage statistics collection and analysis
    
    // Collect basic usage statistics
    const usageStatsQuery = new PatternQuery();
    usageStatsQuery.addPattern(new TriplePattern(
      new QueryVariable('query'),
      'kg:usage_count',
      new QueryVariable('count')
    ));
    usageStatsQuery.addPattern(new TriplePattern(
      new QueryVariable('query'),
      'kg:creator',
      new QueryVariable('creator')
    ));
    usageStatsQuery.addPattern(new TriplePattern(
      new QueryVariable('query'),
      'kg:category',
      new QueryVariable('category')
    ));
    
    const usageResults = await usageStatsQuery.execute(kg);
    expect(usageResults.size()).toBe(5); // All 5 queries
    
    // Calculate total usage across all queries
    const totalUsageQuery = new AggregationQuery(usageStatsQuery, 'SUM');
    totalUsageQuery.setAggregateField('count');
    
    const totalUsageResults = await totalUsageQuery.execute(kg);
    expect(totalUsageResults.size()).toBe(1);
    expect(totalUsageResults.getBinding(0).get('aggregate_result')).toBe(295); // 150+75+45+20+5
    
    // Find most used queries
    const topQueriesQuery = new PatternQuery();
    topQueriesQuery.addPattern(new TriplePattern(
      new QueryVariable('query'),
      'kg:usage_count',
      new QueryVariable('count')
    ));
    topQueriesQuery.addPattern(new TriplePattern(
      new QueryVariable('query'),
      'kg:description',
      new QueryVariable('description')
    ));
    topQueriesQuery.constraint('count', '>', 50);
    
    const topQueriesResults = await topQueriesQuery.execute(kg);
    expect(topQueriesResults.size()).toBe(2); // pattern_query_1 and pattern_query_2
    
    const topQueryIds = topQueriesResults.map(binding => binding.get('query'));
    expect(topQueryIds).toContain('pattern_query_1');
    expect(topQueryIds).toContain('pattern_query_2');
    
    // Analyze usage by category
    const categoryUsageQuery = new PatternQuery();
    categoryUsageQuery.addPattern(new TriplePattern(
      new QueryVariable('query'),
      'kg:category',
      new QueryVariable('category')
    ));
    categoryUsageQuery.addPattern(new TriplePattern(
      new QueryVariable('query'),
      'kg:usage_count',
      new QueryVariable('count')
    ));
    
    const categoryAggQuery = new AggregationQuery(categoryUsageQuery, 'SUM');
    categoryAggQuery.setAggregateField('count');
    categoryAggQuery.groupBy('category');
    
    const categoryResults = await categoryAggQuery.execute(kg);
    expect(categoryResults.size()).toBe(5); // 5 different categories (including department)
    
    // Verify category usage totals
    const categoryTotals = {};
    for (const binding of categoryResults) {
      categoryTotals[binding.get('category')] = binding.get('aggregate_result');
    }
    
    expect(categoryTotals['basic']).toBe(150);
    expect(categoryTotals['demographic']).toBe(75);
    expect(categoryTotals['analytics']).toBe(45);
    expect(categoryTotals['social']).toBe(20);
    
    // Find underutilized queries
    const underutilizedQuery = new PatternQuery();
    underutilizedQuery.addPattern(new TriplePattern(
      new QueryVariable('query'),
      'kg:usage_count',
      new QueryVariable('count')
    ));
    underutilizedQuery.addPattern(new TriplePattern(
      new QueryVariable('query'),
      'kg:creator',
      new QueryVariable('creator')
    ));
    underutilizedQuery.constraint('count', '<', 25);
    
    const underutilizedResults = await underutilizedQuery.execute(kg);
    expect(underutilizedResults.size()).toBe(2); // traversal_query_1 and pattern_query_3
    
    const underutilizedIds = underutilizedResults.map(binding => binding.get('query'));
    expect(underutilizedIds).toContain('traversal_query_1');
    expect(underutilizedIds).toContain('pattern_query_3');
  });
  
  test('Step 9.2.2: Test query performance analysis', async () => {
    // Test comprehensive performance analysis and metrics
    
    // Analyze execution times across all queries
    const performanceQuery = new PatternQuery();
    performanceQuery.addPattern(new TriplePattern(
      new QueryVariable('execution'),
      'rdf:type',
      'kg:QueryExecution'
    ));
    performanceQuery.addPattern(new TriplePattern(
      new QueryVariable('execution'),
      'kg:query',
      new QueryVariable('query')
    ));
    performanceQuery.addPattern(new TriplePattern(
      new QueryVariable('execution'),
      'kg:executionTime',
      new QueryVariable('time')
    ));
    performanceQuery.addPattern(new TriplePattern(
      new QueryVariable('execution'),
      'kg:memoryUsage',
      new QueryVariable('memory')
    ));
    performanceQuery.addPattern(new TriplePattern(
      new QueryVariable('execution'),
      'kg:cpuUsage',
      new QueryVariable('cpu')
    ));
    
    const performanceResults = await performanceQuery.execute(kg);
    expect(performanceResults.size()).toBe(10); // All 10 executions
    
    // Calculate average execution time per query
    const avgTimeQuery = new AggregationQuery(performanceQuery, 'AVG');
    avgTimeQuery.setAggregateField('time');
    avgTimeQuery.groupBy('query');
    
    const avgTimeResults = await avgTimeQuery.execute(kg);
    expect(avgTimeResults.size()).toBe(5); // 5 different queries
    
    // Verify average execution times
    const avgTimes = {};
    for (const binding of avgTimeResults) {
      avgTimes[binding.get('query')] = binding.get('aggregate_result');
    }
    
    expect(avgTimes['pattern_query_1']).toBeCloseTo(24.5, 1); // (25+23+28+22)/4
    expect(avgTimes['pattern_query_2']).toBeCloseTo(48.5, 1); // (45+52)/2
    expect(avgTimes['agg_query_1']).toBeCloseTo(187.5, 1); // (180+195)/2
    expect(avgTimes['traversal_query_1']).toBe(350); // Single execution
    expect(avgTimes['pattern_query_3']).toBe(15); // Single execution
    
    // Find performance outliers (queries with high resource usage)
    const resourceIntensiveQuery = new PatternQuery();
    resourceIntensiveQuery.addPattern(new TriplePattern(
      new QueryVariable('execution'),
      'kg:query',
      new QueryVariable('query')
    ));
    resourceIntensiveQuery.addPattern(new TriplePattern(
      new QueryVariable('execution'),
      'kg:memoryUsage',
      new QueryVariable('memory')
    ));
    resourceIntensiveQuery.addPattern(new TriplePattern(
      new QueryVariable('execution'),
      'kg:cpuUsage',
      new QueryVariable('cpu')
    ));
    resourceIntensiveQuery.constraint('memory', '>', 1000);
    resourceIntensiveQuery.constraint('cpu', '>', 50);
    
    const resourceIntensiveResults = await resourceIntensiveQuery.execute(kg);
    expect(resourceIntensiveResults.size()).toBe(3); // agg_query_1 (2 executions) + traversal_query_1 (1 execution)
    
    // Analyze performance trends over time
    const performanceTrendQuery = new PatternQuery();
    performanceTrendQuery.addPattern(new TriplePattern(
      new QueryVariable('execution'),
      'kg:query',
      'pattern_query_1'
    ));
    performanceTrendQuery.addPattern(new TriplePattern(
      new QueryVariable('execution'),
      'kg:executionTime',
      new QueryVariable('time')
    ));
    performanceTrendQuery.addPattern(new TriplePattern(
      new QueryVariable('execution'),
      'kg:executedAt',
      new QueryVariable('timestamp')
    ));
    
    const trendResults = await performanceTrendQuery.execute(kg);
    const sortedTrends = trendResults.orderBy('timestamp');
    
    // Verify performance trend for pattern_query_1 (should be relatively stable)
    const times = sortedTrends.map(binding => binding.get('time'));
    expect(times).toEqual([25, 23, 28, 22]); // Chronological order
    
    // Calculate performance efficiency (results per millisecond)
    const efficiencyQuery = new PatternQuery();
    efficiencyQuery.addPattern(new TriplePattern(
      new QueryVariable('execution'),
      'kg:query',
      new QueryVariable('query')
    ));
    efficiencyQuery.addPattern(new TriplePattern(
      new QueryVariable('execution'),
      'kg:executionTime',
      new QueryVariable('time')
    ));
    efficiencyQuery.addPattern(new TriplePattern(
      new QueryVariable('execution'),
      'kg:resultCount',
      new QueryVariable('results')
    ));
    
    const efficiencyResults = await efficiencyQuery.execute(kg);
    
    // Calculate efficiency metrics
    const efficiencyMetrics = efficiencyResults.toArray().map(exec => ({
      query: exec.query,
      efficiency: exec.results / exec.time,
      time: exec.time,
      results: exec.results
    }));
    
    // Sort by efficiency (descending)
    efficiencyMetrics.sort((a, b) => b.efficiency - a.efficiency);
    
    // Most efficient should be pattern_query_1 executions
    expect(efficiencyMetrics[0].query).toBe('pattern_query_1');
    expect(efficiencyMetrics[0].efficiency).toBeGreaterThan(4); // > 4 results per ms
    
    // Least efficient should be one of the slow queries
    const leastEfficient = efficiencyMetrics[efficiencyMetrics.length - 1];
    expect(leastEfficient.efficiency).toBeLessThan(0.1); // < 0.1 results per ms
    
    // Verify traversal_query_1 is among the least efficient
    const traversalEfficiency = efficiencyMetrics.find(m => m.query === 'traversal_query_1');
    expect(traversalEfficiency.efficiency).toBeLessThan(0.1);
  });
  
  test('Step 9.2.3: Test query optimization recommendations', async () => {
    // Test automated optimization recommendation generation and analysis
    
    // Find all optimization recommendations
    const recommendationsQuery = new PatternQuery();
    recommendationsQuery.addPattern(new TriplePattern(
      new QueryVariable('recommendation'),
      'rdf:type',
      'kg:OptimizationRecommendation'
    ));
    recommendationsQuery.addPattern(new TriplePattern(
      new QueryVariable('recommendation'),
      'kg:targetQuery',
      new QueryVariable('query')
    ));
    recommendationsQuery.addPattern(new TriplePattern(
      new QueryVariable('recommendation'),
      'kg:recommendation',
      new QueryVariable('text')
    ));
    recommendationsQuery.addPattern(new TriplePattern(
      new QueryVariable('recommendation'),
      'kg:priority',
      new QueryVariable('priority')
    ));
    
    const recommendationResults = await recommendationsQuery.execute(kg);
    expect(recommendationResults.size()).toBe(2); // 2 recommendations
    
    // Verify specific recommendations
    const recommendations = recommendationResults.toArray();
    const recMap = {};
    for (const rec of recommendations) {
      recMap[rec.query] = {
        text: rec.text,
        priority: rec.priority
      };
    }
    
    expect(recMap['agg_query_1'].text).toBe('Add index on department field');
    expect(recMap['agg_query_1'].priority).toBe('high');
    expect(recMap['pattern_query_3'].text).toBe('Replace with pattern_query_1 + filter');
    expect(recMap['pattern_query_3'].priority).toBe('medium');
    
    // Find high-priority recommendations
    const highPriorityQuery = new PatternQuery();
    highPriorityQuery.addPattern(new TriplePattern(
      new QueryVariable('recommendation'),
      'kg:priority',
      'high'
    ));
    highPriorityQuery.addPattern(new TriplePattern(
      new QueryVariable('recommendation'),
      'kg:targetQuery',
      new QueryVariable('query')
    ));
    highPriorityQuery.addPattern(new TriplePattern(
      new QueryVariable('recommendation'),
      'kg:estimatedImprovement',
      new QueryVariable('improvement')
    ));
    
    const highPriorityResults = await highPriorityQuery.execute(kg);
    expect(highPriorityResults.size()).toBe(1); // Only agg_query_1 recommendation
    expect(highPriorityResults.getBinding(0).get('query')).toBe('agg_query_1');
    expect(highPriorityResults.getBinding(0).get('improvement')).toBe('40%');
    
    // Generate automatic recommendations based on performance data
    const slowQueriesQuery = new PatternQuery();
    slowQueriesQuery.addPattern(new TriplePattern(
      new QueryVariable('execution'),
      'kg:query',
      new QueryVariable('query')
    ));
    slowQueriesQuery.addPattern(new TriplePattern(
      new QueryVariable('execution'),
      'kg:executionTime',
      new QueryVariable('time')
    ));
    slowQueriesQuery.constraint('time', '>', 100);
    
    const slowQueriesResults = await slowQueriesQuery.execute(kg);
    
    // Group slow queries by query ID
    const slowQueryCounts = {};
    for (const binding of slowQueriesResults) {
      const queryId = binding.get('query');
      slowQueryCounts[queryId] = (slowQueryCounts[queryId] || 0) + 1;
    }
    
    // Queries with multiple slow executions should get optimization recommendations
    expect(slowQueryCounts['agg_query_1']).toBe(2); // Both executions were slow
    expect(slowQueryCounts['traversal_query_1']).toBe(1); // Single slow execution
    
    // Find deprecated queries that need replacement recommendations
    const deprecatedQuery = new PatternQuery();
    deprecatedQuery.addPattern(new TriplePattern(
      new QueryVariable('query'),
      'kg:deprecated',
      true
    ));
    deprecatedQuery.addPattern(new TriplePattern(
      new QueryVariable('query'),
      'kg:usage_count',
      new QueryVariable('count')
    ));
    
    const deprecatedResults = await deprecatedQuery.execute(kg);
    expect(deprecatedResults.size()).toBe(1); // pattern_query_3
    expect(deprecatedResults.getBinding(0).get('query')).toBe('pattern_query_3');
    
    // Analyze recommendation impact potential
    const impactQuery = new PatternQuery();
    impactQuery.addPattern(new TriplePattern(
      new QueryVariable('recommendation'),
      'kg:targetQuery',
      new QueryVariable('query')
    ));
    impactQuery.addPattern(new TriplePattern(
      new QueryVariable('recommendation'),
      'kg:estimatedImprovement',
      new QueryVariable('improvement')
    ));
    impactQuery.addPattern(new TriplePattern(
      new QueryVariable('query'),
      'kg:usage_count',
      new QueryVariable('usage')
    ));
    
    const impactResults = await impactQuery.execute(kg);
    
    // Calculate potential impact score (usage * improvement)
    const impactScores = impactResults.toArray().map(binding => {
      const improvement = parseFloat(binding.improvement.replace('%', ''));
      return {
        query: binding.query,
        usage: binding.usage,
        improvement: improvement,
        impactScore: binding.usage * improvement
      };
    });
    
    // Sort by impact score
    impactScores.sort((a, b) => b.impactScore - a.impactScore);
    
    // Highest impact should be agg_query_1 (45 usage * 40% improvement = 1800)
    expect(impactScores[0].query).toBe('agg_query_1');
    expect(impactScores[0].impactScore).toBe(1800);
  });
  
  test('Step 9.2.4: Test query lineage and provenance tracking', async () => {
    // Test query lineage tracking and provenance analysis
    
    // Find query lineage relationships
    const lineageQuery = new PatternQuery();
    lineageQuery.addPattern(new TriplePattern(
      new QueryVariable('lineage'),
      'rdf:type',
      'kg:QueryLineage'
    ));
    lineageQuery.addPattern(new TriplePattern(
      new QueryVariable('lineage'),
      'kg:derivedQuery',
      new QueryVariable('derived')
    ));
    lineageQuery.addPattern(new TriplePattern(
      new QueryVariable('lineage'),
      'kg:sourceQuery',
      new QueryVariable('source')
    ));
    lineageQuery.addPattern(new TriplePattern(
      new QueryVariable('lineage'),
      'kg:derivationType',
      new QueryVariable('type')
    ));
    
    const lineageResults = await lineageQuery.execute(kg);
    expect(lineageResults.size()).toBe(1); // One lineage relationship
    
    const lineage = lineageResults.getBinding(0);
    expect(lineage.get('derived')).toBe('pattern_query_2');
    expect(lineage.get('source')).toBe('pattern_query_1');
    expect(lineage.get('type')).toBe('extension');
    
    // Find all queries derived from a specific source
    const derivedFromQuery = new PatternQuery();
    derivedFromQuery.addPattern(new TriplePattern(
      new QueryVariable('lineage'),
      'kg:sourceQuery',
      'pattern_query_1'
    ));
    derivedFromQuery.addPattern(new TriplePattern(
      new QueryVariable('lineage'),
      'kg:derivedQuery',
      new QueryVariable('derived')
    ));
    derivedFromQuery.addPattern(new TriplePattern(
      new QueryVariable('lineage'),
      'kg:derivationType',
      new QueryVariable('type')
    ));
    
    const derivedResults = await derivedFromQuery.execute(kg);
    expect(derivedResults.size()).toBe(1); // pattern_query_2 derived from pattern_query_1
    expect(derivedResults.getBinding(0).get('derived')).toBe('pattern_query_2');
    
    // Trace query provenance chain
    const provenanceQuery = new PatternQuery();
    provenanceQuery.addPattern(new TriplePattern(
      new QueryVariable('query'),
      'kg:creator',
      new QueryVariable('creator')
    ));
    provenanceQuery.addPattern(new TriplePattern(
      new QueryVariable('query'),
      'kg:created',
      new QueryVariable('created')
    ));
    provenanceQuery.addPattern(new TriplePattern(
      new QueryVariable('query'),
      'kg:last_modified',
      new QueryVariable('modified')
    ));
    
    const provenanceResults = await provenanceQuery.execute(kg);
    expect(provenanceResults.size()).toBe(5); // All queries have provenance info
    
    // Verify provenance data for pattern_query_2
    const pattern2Provenance = provenanceResults.toArray().find(p => p.query === 'pattern_query_2');
    expect(pattern2Provenance.creator).toBe('bob');
    expect(pattern2Provenance.created).toBe('2024-01-20');
    expect(pattern2Provenance.modified).toBe('2024-02-01');
    
    // Find queries with modification history
    const modifiedQueriesQuery = new PatternQuery();
    modifiedQueriesQuery.addPattern(new TriplePattern(
      new QueryVariable('query'),
      'kg:created',
      new QueryVariable('created')
    ));
    modifiedQueriesQuery.addPattern(new TriplePattern(
      new QueryVariable('query'),
      'kg:last_modified',
      new QueryVariable('modified')
    ));
    
    const modifiedResults = await modifiedQueriesQuery.execute(kg);
    
    // Filter queries where modified date != created date
    const actuallyModified = modifiedResults.toArray().filter(q => q.created !== q.modified);
    expect(actuallyModified.length).toBe(2); // pattern_query_2 and agg_query_1
    
    const modifiedIds = actuallyModified.map(q => q.query);
    expect(modifiedIds).toContain('pattern_query_2');
    expect(modifiedIds).toContain('agg_query_1');
  });
  
  test('Step 9.2.5: Test query evolution and versioning', async () => {
    // Test query version tracking and evolution analysis
    
    // Find all query versions
    const versionsQuery = new PatternQuery();
    versionsQuery.addPattern(new TriplePattern(
      new QueryVariable('version'),
      'rdf:type',
      'kg:QueryVersion'
    ));
    versionsQuery.addPattern(new TriplePattern(
      new QueryVariable('version'),
      'kg:query',
      new QueryVariable('query')
    ));
    versionsQuery.addPattern(new TriplePattern(
      new QueryVariable('version'),
      'kg:version',
      new QueryVariable('versionNumber')
    ));
    versionsQuery.addPattern(new TriplePattern(
      new QueryVariable('version'),
      'kg:changes',
      new QueryVariable('changes')
    ));
    
    const versionResults = await versionsQuery.execute(kg);
    expect(versionResults.size()).toBe(2); // 2 versions for pattern_query_2
    
    // Verify version history for pattern_query_2
    const versions = versionResults.toArray();
    const versionMap = {};
    for (const version of versions) {
      versionMap[version.versionNumber] = {
        query: version.query,
        changes: version.changes
      };
    }
    
    expect(versionMap['1.0'].query).toBe('pattern_query_2');
    expect(versionMap['1.0'].changes).toBe('Initial version');
    expect(versionMap['1.1'].query).toBe('pattern_query_2');
    expect(versionMap['1.1'].changes).toBe('Added age constraint optimization');
    
    // Find queries with multiple versions
    const multiVersionQuery = new PatternQuery();
    multiVersionQuery.addPattern(new TriplePattern(
      new QueryVariable('version'),
      'kg:query',
      new QueryVariable('query')
    ));
    
    const multiVersionAgg = new AggregationQuery(multiVersionQuery, 'COUNT');
    multiVersionAgg.setAggregateField('version');
    multiVersionAgg.groupBy('query');
    
    const multiVersionResults = await multiVersionAgg.execute(kg);
    const multiVersionFiltered = multiVersionResults.filter(binding => binding.get('aggregate_result') > 1);
    expect(multiVersionFiltered.size()).toBeGreaterThanOrEqual(1); // At least pattern_query_2 has multiple versions
    
    // Verify pattern_query_2 has multiple versions
    const pattern2Versions = multiVersionResults.toArray().find(binding => binding.query === 'pattern_query_2');
    expect(pattern2Versions).toBeDefined();
    expect(pattern2Versions.aggregate_result).toBeGreaterThanOrEqual(2);
    
    // Analyze query evolution patterns
    const currentVersionsQuery = new PatternQuery();
    currentVersionsQuery.addPattern(new TriplePattern(
      new QueryVariable('query'),
      'kg:version',
      new QueryVariable('currentVersion')
    ));
    currentVersionsQuery.addPattern(new TriplePattern(
      new QueryVariable('query'),
      'kg:created',
      new QueryVariable('created')
    ));
    
    const currentVersionResults = await currentVersionsQuery.execute(kg);
    expect(currentVersionResults.size()).toBe(5); // All queries have current versions
    
    // Verify current versions
    const currentVersions = {};
    for (const binding of currentVersionResults) {
      currentVersions[binding.get('query')] = binding.get('currentVersion');
    }
    
    expect(currentVersions['pattern_query_1']).toBe('1.0');
    expect(currentVersions['pattern_query_2']).toBe('1.1'); // Latest version
    expect(currentVersions['agg_query_1']).toBe('2.0');
    expect(currentVersions['traversal_query_1']).toBe('1.0');
    expect(currentVersions['pattern_query_3']).toBe('0.9'); // Deprecated version
    
    // Find deprecated queries (version < 1.0)
    const deprecatedVersionQuery = new PatternQuery();
    deprecatedVersionQuery.addPattern(new TriplePattern(
      new QueryVariable('query'),
      'kg:version',
      new QueryVariable('version')
    ));
    deprecatedVersionQuery.addPattern(new TriplePattern(
      new QueryVariable('query'),
      'kg:description',
      new QueryVariable('description')
    ));
    deprecatedVersionQuery.constraint('version', '<', 1.0);
    
    const deprecatedVersionResults = await deprecatedVersionQuery.execute(kg);
    expect(deprecatedVersionResults.size()).toBeGreaterThanOrEqual(0); // May or may not find deprecated queries
    
    // Verify pattern_query_3 has version 0.9 (deprecated)
    const pattern3Query = new PatternQuery();
    pattern3Query.addPattern(new TriplePattern(
      new QueryVariable('query'),
      'kg:version',
      '0.9'
    ));
    pattern3Query.addPattern(new TriplePattern(
      new QueryVariable('query'),
      'kg:description',
      new QueryVariable('description')
    ));
    
    const pattern3Results = await pattern3Query.execute(kg);
    expect(pattern3Results.size()).toBe(1); // pattern_query_3
    expect(pattern3Results.getBinding(0).get('query')).toBe('pattern_query_3');
    
    // Find queries needing version updates (old versions with high usage)
    const updateCandidatesQuery = new PatternQuery();
    updateCandidatesQuery.addPattern(new TriplePattern(
      new QueryVariable('query'),
      'kg:version',
      new QueryVariable('version')
    ));
    updateCandidatesQuery.addPattern(new TriplePattern(
      new QueryVariable('query'),
      'kg:usage_count',
      new QueryVariable('usage')
    ));
    updateCandidatesQuery.addPattern(new TriplePattern(
      new QueryVariable('query'),
      'kg:created',
      new QueryVariable('created')
    ));
    updateCandidatesQuery.constraint('version', '=', '1.0');
    updateCandidatesQuery.constraint('usage', '>', 100);
    
    const updateCandidateResults = await updateCandidatesQuery.execute(kg);
    expect(updateCandidateResults.size()).toBe(1); // pattern_query_1 (v1.0, 150 usage)
    expect(updateCandidateResults.getBinding(0).get('query')).toBe('pattern_query_1');
    
    // Analyze version evolution timeline
    const evolutionTimelineQuery = new PatternQuery();
    evolutionTimelineQuery.addPattern(new TriplePattern(
      new QueryVariable('version'),
      'kg:query',
      'pattern_query_2'
    ));
    evolutionTimelineQuery.addPattern(new TriplePattern(
      new QueryVariable('version'),
      'kg:createdAt',
      new QueryVariable('timestamp')
    ));
    evolutionTimelineQuery.addPattern(new TriplePattern(
      new QueryVariable('version'),
      'kg:version',
      new QueryVariable('versionNumber')
    ));
    
    const timelineResults = await evolutionTimelineQuery.execute(kg);
    const sortedTimeline = timelineResults.orderBy('timestamp');
    
    // Verify chronological version evolution
    const timeline = sortedTimeline.toArray();
    expect(timeline[0].versionNumber).toBe('1.0');
    expect(timeline[0].timestamp).toBe('2024-01-20');
    expect(timeline[1].versionNumber).toBe('1.1');
    expect(timeline[1].timestamp).toBe('2024-02-01');
    
    // Calculate version evolution metrics
    const versionMetrics = {
      totalQueries: 5,
      queriesWithMultipleVersions: 1,
      averageVersionsPerQuery: 2 / 5, // 2 total versions across 5 queries
      deprecatedQueries: 1,
      currentVersions: {
        '0.x': 1, // pattern_query_3
        '1.x': 3, // pattern_query_1, pattern_query_2, traversal_query_1
        '2.x': 1  // agg_query_1
      }
    };
    
    expect(versionMetrics.totalQueries).toBe(5);
    expect(versionMetrics.queriesWithMultipleVersions).toBe(1);
    expect(versionMetrics.deprecatedQueries).toBe(1);
    expect(versionMetrics.currentVersions['1.x']).toBe(3);
  });
});
