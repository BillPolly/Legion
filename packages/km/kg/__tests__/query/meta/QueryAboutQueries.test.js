import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { PatternQuery } from '../../../src/query/types/PatternQuery.js';
import { AggregationQuery } from '../../../src/query/types/AggregationQuery.js';
import { TraversalQuery } from '../../../src/query/types/TraversalQuery.js';
import { TriplePattern } from '../../../src/query/core/TriplePattern.js';
import { QueryVariable } from '../../../src/query/core/QueryVariable.js';
import { FixedLengthPath } from '../../../src/query/paths/FixedLengthPath.js';
import { KGEngine } from '../../../src/core/KGEngine.js';

describe('Phase 9.1: Query-About-Queries', () => {
  let kg;
  
  beforeEach(() => {
    kg = new KGEngine();
    
    // Create a simplified set of queries to query about
    // Focus on PatternQuery, AggregationQuery, and TraversalQuery only
    
    // Pattern Query 1: Find all people
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
    patternQuery1.setMetadata('usage_count', 45);
    
    // Pattern Query 2: Find people by age
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
    patternQuery2.setMetadata('usage_count', 23);
    
    // Aggregation Query 1: Count people by department
    const baseQuery = new PatternQuery();
    baseQuery.addPattern(new TriplePattern(
      new QueryVariable('person'), 
      'department', 
      new QueryVariable('department')
    ));
    const aggQuery1 = new AggregationQuery(baseQuery, 'COUNT');
    aggQuery1.setAggregateField('person');
    aggQuery1.groupBy('department');
    aggQuery1._kgId = 'agg_query_1'; // Set the ID manually
    aggQuery1.setMetadata('creator', 'charlie');
    aggQuery1.setMetadata('created', '2024-02-01');
    aggQuery1.setMetadata('description', 'Count employees by department');
    aggQuery1.setMetadata('category', 'analytics');
    aggQuery1.setMetadata('usage_count', 67);
    
    // Traversal Query 1: Find friends of friends
    const startNode = new QueryVariable('person');
    const pathExpression = new FixedLengthPath('knows', 2);
    const endVariable = new QueryVariable('friend');
    const traversalQuery1 = new TraversalQuery(startNode, pathExpression, endVariable);
    traversalQuery1._kgId = 'traversal_query_1'; // Set the ID manually
    traversalQuery1.setMetadata('creator', 'diana');
    traversalQuery1.setMetadata('created', '2024-02-10');
    traversalQuery1.setMetadata('description', 'Find friends of friends');
    traversalQuery1.setMetadata('category', 'social');
    traversalQuery1.setMetadata('usage_count', 12);
    
    // Simple Pattern Query 3: Find engineers
    const patternQuery3 = new PatternQuery('pattern_query_3');
    patternQuery3.addPattern(new TriplePattern(
      new QueryVariable('person'), 
      'department', 
      'Engineering'
    ));
    patternQuery3.setMetadata('creator', 'eve');
    patternQuery3.setMetadata('created', '2024-02-15');
    patternQuery3.setMetadata('description', 'Find engineers');
    patternQuery3.setMetadata('category', 'department');
    patternQuery3.setMetadata('usage_count', 8);
    
    // Simple Pattern Query 4: Find recent hires
    const patternQuery4 = new PatternQuery('pattern_query_4');
    patternQuery4.addPattern(new TriplePattern(
      new QueryVariable('person'), 
      'startDate', 
      new QueryVariable('date')
    ));
    patternQuery4.setMetadata('creator', 'frank');
    patternQuery4.setMetadata('created', '2024-02-20');
    patternQuery4.setMetadata('description', 'Find recent hires');
    patternQuery4.setMetadata('category', 'temporal');
    patternQuery4.setMetadata('usage_count', 15);
    
    const queries = [patternQuery1, patternQuery2, aggQuery1, traversalQuery1, patternQuery3, patternQuery4];
    
    // Store queries as triples in the knowledge graph (simplified approach)
    for (const query of queries) {
      // Add basic query type triple
      kg.addTriple(query.getId(), 'rdf:type', `kg:${query.constructor.name}`);
      
      // Add metadata triples directly from the Map
      for (const [key, value] of query.metadata) {
        kg.addTriple(query.getId(), `kg:${key}`, value);
      }
    }
    
    // Add some execution history
    kg.addTriple('execution_1', 'rdf:type', 'kg:QueryExecution');
    kg.addTriple('execution_1', 'kg:query', 'pattern_query_1');
    kg.addTriple('execution_1', 'kg:executedAt', '2024-03-01T10:00:00Z');
    kg.addTriple('execution_1', 'kg:executionTime', 45);
    kg.addTriple('execution_1', 'kg:resultCount', 100);
    kg.addTriple('execution_1', 'kg:executor', 'alice');
    
    kg.addTriple('execution_2', 'rdf:type', 'kg:QueryExecution');
    kg.addTriple('execution_2', 'kg:query', 'agg_query_1');
    kg.addTriple('execution_2', 'kg:executedAt', '2024-03-01T11:00:00Z');
    kg.addTriple('execution_2', 'kg:executionTime', 120);
    kg.addTriple('execution_2', 'kg:resultCount', 5);
    kg.addTriple('execution_2', 'kg:executor', 'bob');
    
    kg.addTriple('execution_3', 'rdf:type', 'kg:QueryExecution');
    kg.addTriple('execution_3', 'kg:query', 'pattern_query_1');
    kg.addTriple('execution_3', 'kg:executedAt', '2024-03-01T12:00:00Z');
    kg.addTriple('execution_3', 'kg:executionTime', 38);
    kg.addTriple('execution_3', 'kg:resultCount', 105);
    kg.addTriple('execution_3', 'kg:executor', 'charlie');
  });
  
  afterEach(async () => {
    // Clear the knowledge graph to prevent memory leaks and ensure clean state
    if (kg && typeof kg.clear === 'function') {
      await kg.clear();
    }
    kg = null;
  });
  
  test('Step 9.1.1: Test queries that find other queries by type', async () => {
    // Test meta-queries that find queries by their type
    
    // Find all PatternQuery instances
    const findPatternQueries = new PatternQuery();
    findPatternQueries.addPattern(new TriplePattern(
      new QueryVariable('query'),
      'rdf:type',
      'kg:PatternQuery'
    ));
    
    const patternQueryResults = await findPatternQueries.execute(kg);
    expect(patternQueryResults.size()).toBe(4); // pattern_query_1, pattern_query_2, pattern_query_3, pattern_query_4
    
    const patternQueryIds = patternQueryResults.map(binding => binding.get('query'));
    expect(patternQueryIds).toContain('pattern_query_1');
    expect(patternQueryIds).toContain('pattern_query_2');
    expect(patternQueryIds).toContain('pattern_query_3');
    expect(patternQueryIds).toContain('pattern_query_4');
    
    // Find all AggregationQuery instances
    const findAggQueries = new PatternQuery();
    findAggQueries.addPattern(new TriplePattern(
      new QueryVariable('query'),
      'rdf:type',
      'kg:AggregationQuery'
    ));
    
    const aggQueryResults = await findAggQueries.execute(kg);
    expect(aggQueryResults.size()).toBe(1); // agg_query_1
    expect(aggQueryResults.getBinding(0).get('query')).toBe('agg_query_1');
    
    // Find all TraversalQuery instances
    const findTraversalQueries = new PatternQuery();
    findTraversalQueries.addPattern(new TriplePattern(
      new QueryVariable('query'),
      'rdf:type',
      'kg:TraversalQuery'
    ));
    
    const traversalQueryResults = await findTraversalQueries.execute(kg);
    expect(traversalQueryResults.size()).toBe(1); // traversal_query_1
    expect(traversalQueryResults.getBinding(0).get('query')).toBe('traversal_query_1');
    
    // Find all queries (any type)
    const findAllQueries = new PatternQuery();
    findAllQueries.addPattern(new TriplePattern(
      new QueryVariable('query'),
      'rdf:type',
      new QueryVariable('type')
    ));
    findAllQueries.constraint('type', 'matches', /^kg:.*Query$/);
    
    const allQueryResults = await findAllQueries.execute(kg);
    expect(allQueryResults.size()).toBe(6); // All our 6 queries
    
    // Count queries by type
    const typeQuery = new PatternQuery();
    typeQuery.addPattern(new TriplePattern(
      new QueryVariable('query'),
      'rdf:type',
      new QueryVariable('type')
    ));
    typeQuery.constraint('type', 'matches', /^kg:.*Query$/);
    const queryTypeCount = new AggregationQuery(typeQuery, 'COUNT');
    queryTypeCount.setAggregateField('query');
    queryTypeCount.groupBy('type');
    
    const typeCountResults = await queryTypeCount.execute(kg);
    expect(typeCountResults.size()).toBe(3); // 3 different types
    
    // Verify we have the expected types
    const typeCounts = {};
    for (const binding of typeCountResults) {
      typeCounts[binding.get('type')] = binding.get('aggregate_result');
    }
    
    expect(typeCounts['kg:PatternQuery']).toBe(4);
    expect(typeCounts['kg:AggregationQuery']).toBe(1);
    expect(typeCounts['kg:TraversalQuery']).toBe(1);
  });
  
  test('Step 9.1.2: Test queries that find queries by creator', async () => {
    // Test meta-queries that find queries by their creator
    
    // Find all queries created by Alice
    const findAliceQueries = new PatternQuery();
    findAliceQueries.addPattern(new TriplePattern(
      new QueryVariable('query'),
      'kg:creator',
      'alice'
    ));
    
    const aliceQueryResults = await findAliceQueries.execute(kg);
    expect(aliceQueryResults.size()).toBe(1); // pattern_query_1
    expect(aliceQueryResults.getBinding(0).get('query')).toBe('pattern_query_1');
    
    // Find all queries created by Bob
    const findBobQueries = new PatternQuery();
    findBobQueries.addPattern(new TriplePattern(
      new QueryVariable('query'),
      'kg:creator',
      'bob'
    ));
    
    const bobQueryResults = await findBobQueries.execute(kg);
    expect(bobQueryResults.size()).toBe(1); // pattern_query_2
    expect(bobQueryResults.getBinding(0).get('query')).toBe('pattern_query_2');
    
    // Find queries with their creators and types
    const findQueriesWithCreators = new PatternQuery();
    findQueriesWithCreators.addPattern(new TriplePattern(
      new QueryVariable('query'),
      'kg:creator',
      new QueryVariable('creator')
    ));
    findQueriesWithCreators.addPattern(new TriplePattern(
      new QueryVariable('query'),
      'rdf:type',
      new QueryVariable('type')
    ));
    
    const queryCreatorResults = await findQueriesWithCreators.execute(kg);
    expect(queryCreatorResults.size()).toBe(6); // All our 6 queries have creators
    
    // Verify specific creator-query relationships
    const creatorQueryMap = {};
    for (const binding of queryCreatorResults) {
      const creator = binding.get('creator');
      const query = binding.get('query');
      if (!creatorQueryMap[creator]) {
        creatorQueryMap[creator] = [];
      }
      creatorQueryMap[creator].push(query);
    }
    
    expect(creatorQueryMap['alice']).toContain('pattern_query_1');
    expect(creatorQueryMap['bob']).toContain('pattern_query_2');
    expect(creatorQueryMap['charlie']).toContain('agg_query_1');
    expect(creatorQueryMap['diana']).toContain('traversal_query_1');
    expect(creatorQueryMap['eve']).toContain('pattern_query_3');
    expect(creatorQueryMap['frank']).toContain('pattern_query_4');
    
    // Count queries by creator
    const creatorQuery = new PatternQuery();
    creatorQuery.addPattern(new TriplePattern(
      new QueryVariable('query'),
      'kg:creator',
      new QueryVariable('creator')
    ));
    const queryCreatorCount = new AggregationQuery(creatorQuery, 'COUNT');
    queryCreatorCount.setAggregateField('query');
    queryCreatorCount.groupBy('creator');
    
    const creatorCountResults = await queryCreatorCount.execute(kg);
    expect(creatorCountResults.size()).toBe(6); // 6 different creators
    
    // Each creator should have exactly 1 query
    for (const binding of creatorCountResults) {
      expect(binding.get('aggregate_result')).toBe(1);
    }
    
    // Find queries created in a specific time period (simplified test)
    const findQueriesWithDates = new PatternQuery();
    findQueriesWithDates.addPattern(new TriplePattern(
      new QueryVariable('query'),
      'kg:created',
      new QueryVariable('created')
    ));
    findQueriesWithDates.addPattern(new TriplePattern(
      new QueryVariable('query'),
      'kg:creator',
      new QueryVariable('creator')
    ));
    
    const dateQueryResults = await findQueriesWithDates.execute(kg);
    expect(dateQueryResults.size()).toBe(6); // All 6 queries have creation dates
    
    const creatorsWithDates = dateQueryResults.map(binding => binding.get('creator'));
    expect(creatorsWithDates).toContain('charlie');
    expect(creatorsWithDates).toContain('diana');
    expect(creatorsWithDates).toContain('eve');
    expect(creatorsWithDates).toContain('frank');
  });
  
  test('Step 9.1.3: Test queries that analyze query performance', async () => {
    // Test meta-queries that analyze query execution performance
    
    // Find all query executions
    const findExecutions = new PatternQuery();
    findExecutions.addPattern(new TriplePattern(
      new QueryVariable('execution'),
      'rdf:type',
      'kg:QueryExecution'
    ));
    findExecutions.addPattern(new TriplePattern(
      new QueryVariable('execution'),
      'kg:query',
      new QueryVariable('query')
    ));
    findExecutions.addPattern(new TriplePattern(
      new QueryVariable('execution'),
      'kg:executionTime',
      new QueryVariable('time')
    ));
    
    const executionResults = await findExecutions.execute(kg);
    expect(executionResults.size()).toBe(3); // 3 executions
    
    // Verify execution data
    const executions = executionResults.toArray();
    const executionTimes = executions.map(e => e.time);
    expect(executionTimes).toContain(45);
    expect(executionTimes).toContain(120);
    expect(executionTimes).toContain(38);
    
    // Find slow queries (execution time > 100ms)
    const findSlowQueries = new PatternQuery();
    findSlowQueries.addPattern(new TriplePattern(
      new QueryVariable('execution'),
      'rdf:type',
      'kg:QueryExecution'
    ));
    findSlowQueries.addPattern(new TriplePattern(
      new QueryVariable('execution'),
      'kg:query',
      new QueryVariable('query')
    ));
    findSlowQueries.addPattern(new TriplePattern(
      new QueryVariable('execution'),
      'kg:executionTime',
      new QueryVariable('time')
    ));
    findSlowQueries.constraint('time', '>', 100);
    
    const slowQueryResults = await findSlowQueries.execute(kg);
    expect(slowQueryResults.size()).toBe(1); // Only agg_query_1 execution
    expect(slowQueryResults.getBinding(0).get('query')).toBe('agg_query_1');
    expect(slowQueryResults.getBinding(0).get('time')).toBe(120);
    
    // Calculate average execution time per query
    const avgTimeQuery = new PatternQuery();
    avgTimeQuery.addPattern(new TriplePattern(
      new QueryVariable('execution'),
      'kg:query',
      new QueryVariable('query')
    ));
    avgTimeQuery.addPattern(new TriplePattern(
      new QueryVariable('execution'),
      'kg:executionTime',
      new QueryVariable('time')
    ));
    const avgExecutionTime = new AggregationQuery(avgTimeQuery, 'AVG');
    avgExecutionTime.setAggregateField('time');
    avgExecutionTime.groupBy('query');
    
    const avgTimeResults = await avgExecutionTime.execute(kg);
    expect(avgTimeResults.size()).toBe(2); // 2 different queries executed
    
    // Verify averages
    const avgTimes = {};
    for (const binding of avgTimeResults) {
      avgTimes[binding.get('query')] = binding.get('aggregate_result');
    }
    
    expect(avgTimes['pattern_query_1']).toBe(41.5); // (45 + 38) / 2
    expect(avgTimes['agg_query_1']).toBe(120); // Only one execution
    
    // Find queries with multiple executions
    const execCountQuery = new PatternQuery();
    execCountQuery.addPattern(new TriplePattern(
      new QueryVariable('execution'),
      'kg:query',
      new QueryVariable('query')
    ));
    const executionCount = new AggregationQuery(execCountQuery, 'COUNT');
    executionCount.setAggregateField('execution');
    executionCount.groupBy('query');
    
    const countResults = await executionCount.execute(kg);
    expect(countResults.size()).toBe(2);
    
    const executionCounts = {};
    for (const binding of countResults) {
      executionCounts[binding.get('query')] = binding.get('aggregate_result');
    }
    
    expect(executionCounts['pattern_query_1']).toBe(2);
    expect(executionCounts['agg_query_1']).toBe(1);
    
    // Find performance trends (queries getting faster/slower)
    const findPerformanceTrends = new PatternQuery();
    findPerformanceTrends.addPattern(new TriplePattern(
      new QueryVariable('execution'),
      'kg:query',
      new QueryVariable('query')
    ));
    findPerformanceTrends.addPattern(new TriplePattern(
      new QueryVariable('execution'),
      'kg:executionTime',
      new QueryVariable('time')
    ));
    findPerformanceTrends.addPattern(new TriplePattern(
      new QueryVariable('execution'),
      'kg:executedAt',
      new QueryVariable('timestamp')
    ));
    
    const trendResults = await findPerformanceTrends.execute(kg);
    const sortedTrends = trendResults.orderBy('timestamp');
    
    // Verify chronological order
    const timestamps = sortedTrends.map(binding => binding.get('timestamp'));
    expect(timestamps[0]).toBe('2024-03-01T10:00:00Z');
    expect(timestamps[1]).toBe('2024-03-01T11:00:00Z');
    expect(timestamps[2]).toBe('2024-03-01T12:00:00Z');
    
    // Find queries with best/worst performance
    const findBestPerformance = new PatternQuery();
    findBestPerformance.addPattern(new TriplePattern(
      new QueryVariable('execution'),
      'kg:executionTime',
      new QueryVariable('time')
    ));
    findBestPerformance.addPattern(new TriplePattern(
      new QueryVariable('execution'),
      'kg:query',
      new QueryVariable('query')
    ));
    
    const performanceResults = await findBestPerformance.execute(kg);
    const sortedByTime = performanceResults.orderBy('time');
    
    // Best performance (fastest)
    const fastest = sortedByTime.getBinding(0);
    expect(fastest.get('time')).toBe(38);
    expect(fastest.get('query')).toBe('pattern_query_1');
    
    // Worst performance (slowest)
    const slowest = sortedByTime.getBinding(sortedByTime.size() - 1);
    expect(slowest.get('time')).toBe(120);
    expect(slowest.get('query')).toBe('agg_query_1');
  });
  
  test('Step 9.1.4: Test queries that find queries by execution patterns', async () => {
    // Test meta-queries that find queries based on execution patterns
    
    // Find frequently executed queries (usage_count > 20)
    const findFrequentQueries = new PatternQuery();
    findFrequentQueries.addPattern(new TriplePattern(
      new QueryVariable('query'),
      'kg:usage_count',
      new QueryVariable('count')
    ));
    findFrequentQueries.constraint('count', '>', 20);
    
    const frequentResults = await findFrequentQueries.execute(kg);
    expect(frequentResults.size()).toBe(3); // pattern_query_1 (45), pattern_query_2 (23), agg_query_1 (67)
    
    const frequentQueries = frequentResults.map(binding => binding.get('query'));
    expect(frequentQueries).toContain('pattern_query_1');
    expect(frequentQueries).toContain('pattern_query_2');
    expect(frequentQueries).toContain('agg_query_1');
    
    // Find rarely used queries (usage_count < 15)
    const findRareQueries = new PatternQuery();
    findRareQueries.addPattern(new TriplePattern(
      new QueryVariable('query'),
      'kg:usage_count',
      new QueryVariable('count')
    ));
    findRareQueries.constraint('count', '<', 15);
    
    const rareResults = await findRareQueries.execute(kg);
    expect(rareResults.size()).toBeGreaterThanOrEqual(2); // At least traversal_query_1 (12), pattern_query_3 (8)
    
    const rareQueries = rareResults.map(binding => binding.get('query'));
    expect(rareQueries).toContain('traversal_query_1');
    expect(rareQueries).toContain('pattern_query_3');
    
    // Find queries by execution frequency ranges
    const usageQuery = new PatternQuery();
    usageQuery.addPattern(new TriplePattern(
      new QueryVariable('query'),
      'kg:usage_count',
      new QueryVariable('count')
    ));
    const usageRanges = new AggregationQuery(usageQuery, 'COUNT');
    usageRanges.setAggregateField('query');
    
    const usageResults = await usageRanges.execute(kg);
    expect(usageResults.size()).toBe(1);
    expect(usageResults.getBinding(0).get('aggregate_result')).toBe(6); // All 6 queries have usage counts
    
    // Find queries executed by specific users
    const findQueriesByExecutor = new PatternQuery();
    findQueriesByExecutor.addPattern(new TriplePattern(
      new QueryVariable('execution'),
      'kg:executor',
      'alice'
    ));
    findQueriesByExecutor.addPattern(new TriplePattern(
      new QueryVariable('execution'),
      'kg:query',
      new QueryVariable('query')
    ));
    
    const aliceExecutions = await findQueriesByExecutor.execute(kg);
    expect(aliceExecutions.size()).toBe(1);
    expect(aliceExecutions.getBinding(0).get('query')).toBe('pattern_query_1');
    
    // Find queries that have been executed multiple times
    const multiExecQuery = new PatternQuery();
    multiExecQuery.addPattern(new TriplePattern(
      new QueryVariable('execution'),
      'kg:query',
      new QueryVariable('query')
    ));
    const multipleExecutions = new AggregationQuery(multiExecQuery, 'COUNT');
    multipleExecutions.setAggregateField('execution');
    multipleExecutions.groupBy('query');
    
    const multiExecResults = await multipleExecutions.execute(kg);
    const multiExecFiltered = multiExecResults.filter(binding => binding.get('aggregate_result') > 1);
    expect(multiExecFiltered.size()).toBe(1); // Only pattern_query_1 has multiple executions
    expect(multiExecFiltered.getBinding(0).get('query')).toBe('pattern_query_1');
    
    // Find execution patterns by time of day
    const findExecutionTimes = new PatternQuery();
    findExecutionTimes.addPattern(new TriplePattern(
      new QueryVariable('execution'),
      'kg:executedAt',
      new QueryVariable('timestamp')
    ));
    findExecutionTimes.addPattern(new TriplePattern(
      new QueryVariable('execution'),
      'kg:query',
      new QueryVariable('query')
    ));
    
    const timeResults = await findExecutionTimes.execute(kg);
    expect(timeResults.size()).toBe(3);
    
    // Verify execution times are in chronological order
    const sortedByTime = timeResults.orderBy('timestamp');
    const times = sortedByTime.map(binding => binding.get('timestamp'));
    expect(times[0]).toBe('2024-03-01T10:00:00Z');
    expect(times[1]).toBe('2024-03-01T11:00:00Z');
    expect(times[2]).toBe('2024-03-01T12:00:00Z');
    
    // Find queries with specific result patterns
    const findHighResultQueries = new PatternQuery();
    findHighResultQueries.addPattern(new TriplePattern(
      new QueryVariable('execution'),
      'kg:resultCount',
      new QueryVariable('count')
    ));
    findHighResultQueries.addPattern(new TriplePattern(
      new QueryVariable('execution'),
      'kg:query',
      new QueryVariable('query')
    ));
    findHighResultQueries.constraint('count', '>', 50);
    
    const highResultResults = await findHighResultQueries.execute(kg);
    expect(highResultResults.size()).toBe(2); // Both pattern_query_1 executions
    
    for (const binding of highResultResults) {
      expect(binding.get('query')).toBe('pattern_query_1');
      expect(binding.get('count')).toBeGreaterThan(50);
    }
    
    // Find correlation between query type and execution patterns
    const findTypeExecutionCorrelation = new PatternQuery();
    findTypeExecutionCorrelation.addPattern(new TriplePattern(
      new QueryVariable('query'),
      'rdf:type',
      new QueryVariable('type')
    ));
    findTypeExecutionCorrelation.addPattern(new TriplePattern(
      new QueryVariable('execution'),
      'kg:query',
      new QueryVariable('query')
    ));
    findTypeExecutionCorrelation.addPattern(new TriplePattern(
      new QueryVariable('execution'),
      'kg:executionTime',
      new QueryVariable('time')
    ));
    
    const correlationResults = await findTypeExecutionCorrelation.execute(kg);
    expect(correlationResults.size()).toBe(3); // 3 executions with type info
    
    // Verify we can correlate query types with execution patterns
    const typeExecutionMap = {};
    for (const binding of correlationResults) {
      const type = binding.get('type');
      const time = binding.get('time');
      if (!typeExecutionMap[type]) {
        typeExecutionMap[type] = [];
      }
      typeExecutionMap[type].push(time);
    }
    
    expect(typeExecutionMap['kg:PatternQuery']).toContain(45);
    expect(typeExecutionMap['kg:PatternQuery']).toContain(38);
    expect(typeExecutionMap['kg:AggregationQuery']).toContain(120);
  });
  
  test('Step 9.1.5: Test meta-query result interpretation', async () => {
    // Test interpretation and analysis of meta-query results
    
    // Create a comprehensive meta-query that gathers query statistics
    const comprehensiveMetaQuery = new PatternQuery();
    comprehensiveMetaQuery.addPattern(new TriplePattern(
      new QueryVariable('query'),
      'rdf:type',
      new QueryVariable('type')
    ));
    comprehensiveMetaQuery.addPattern(new TriplePattern(
      new QueryVariable('query'),
      'kg:creator',
      new QueryVariable('creator')
    ));
    comprehensiveMetaQuery.addPattern(new TriplePattern(
      new QueryVariable('query'),
      'kg:created',
      new QueryVariable('created')
    ));
    comprehensiveMetaQuery.addPattern(new TriplePattern(
      new QueryVariable('query'),
      'kg:usage_count',
      new QueryVariable('usage')
    ));
    comprehensiveMetaQuery.addPattern(new TriplePattern(
      new QueryVariable('query'),
      'kg:category',
      new QueryVariable('category')
    ));
    
    const metaResults = await comprehensiveMetaQuery.execute(kg);
    expect(metaResults.size()).toBe(6); // All 6 queries with complete metadata
    
    // Interpret results: Find query usage patterns
    const usageAnalysis = {
      totalQueries: metaResults.size(),
      totalUsage: 0,
      averageUsage: 0,
      categories: {},
      creators: {},
      types: {}
    };
    
    for (const binding of metaResults) {
      const usage = binding.get('usage');
      const category = binding.get('category');
      const creator = binding.get('creator');
      const type = binding.get('type');
      
      usageAnalysis.totalUsage += usage;
      
      // Category analysis
      if (!usageAnalysis.categories[category]) {
        usageAnalysis.categories[category] = { count: 0, totalUsage: 0 };
      }
      usageAnalysis.categories[category].count++;
      usageAnalysis.categories[category].totalUsage += usage;
      
      // Creator analysis
      if (!usageAnalysis.creators[creator]) {
        usageAnalysis.creators[creator] = { count: 0, totalUsage: 0 };
      }
      usageAnalysis.creators[creator].count++;
      usageAnalysis.creators[creator].totalUsage += usage;
      
      // Type analysis
      if (!usageAnalysis.types[type]) {
        usageAnalysis.types[type] = { count: 0, totalUsage: 0 };
      }
      usageAnalysis.types[type].count++;
      usageAnalysis.types[type].totalUsage += usage;
    }
    
    usageAnalysis.averageUsage = usageAnalysis.totalUsage / usageAnalysis.totalQueries;
    
    // Verify analysis results
    expect(usageAnalysis.totalQueries).toBe(6);
    expect(usageAnalysis.totalUsage).toBe(170); // 45+23+67+12+8+15
    expect(usageAnalysis.averageUsage).toBeCloseTo(28.33, 2);
    
    // Category analysis
    expect(usageAnalysis.categories['analytics'].count).toBe(1);
    expect(usageAnalysis.categories['analytics'].totalUsage).toBe(67);
    expect(usageAnalysis.categories['basic'].count).toBe(1);
    expect(usageAnalysis.categories['basic'].totalUsage).toBe(45);
    
    // Creator analysis - each creator has 1 query
    for (const creator of ['alice', 'bob', 'charlie', 'diana', 'eve', 'frank']) {
      expect(usageAnalysis.creators[creator].count).toBe(1);
    }
    
    // Type analysis
    expect(usageAnalysis.types['kg:PatternQuery'].count).toBe(4);
    expect(usageAnalysis.types['kg:PatternQuery'].totalUsage).toBe(91); // 45+23+8+15
    
    // Generate query recommendations based on meta-analysis
    const recommendations = [];
    
    // Recommend promoting popular queries
    const popularQueries = Object.entries(usageAnalysis.creators)
      .filter(([creator, data]) => data.totalUsage > usageAnalysis.averageUsage)
      .map(([creator, data]) => creator);
    
    if (popularQueries.length > 0) {
      recommendations.push({
        type: 'promotion',
        message: `Queries by ${popularQueries.join(', ')} are above average usage`,
        creators: popularQueries
      });
    }
    
    // Verify recommendations were generated
    expect(recommendations.length).toBeGreaterThan(0);
    
    // Test simple meta-query for finding high-usage queries
    const highUsageQuery = new PatternQuery();
    highUsageQuery.addPattern(new TriplePattern(
      new QueryVariable('query'),
      'kg:usage_count',
      new QueryVariable('usage')
    ));
    highUsageQuery.addPattern(new TriplePattern(
      new QueryVariable('query'),
      'kg:created',
      new QueryVariable('created')
    ));
    highUsageQuery.constraint('usage', '>', 20);
    
    const highUsageResults = await highUsageQuery.execute(kg);
    expect(highUsageResults.size()).toBe(3); // pattern_query_1 (45), pattern_query_2 (23), agg_query_1 (67)
    
    // Verify high usage queries are in the results
    const queryIds = highUsageResults.map(binding => binding.get('query'));
    expect(queryIds).toContain('agg_query_1');
    expect(queryIds).toContain('pattern_query_1');
    expect(queryIds).toContain('pattern_query_2');
  });
});
