import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { PatternQuery } from '../../../src/query/types/PatternQuery.js';
import { LogicalQuery } from '../../../src/query/types/LogicalQuery.js';
import { AggregationQuery } from '../../../src/query/types/AggregationQuery.js';
import { SequentialQuery } from '../../../src/query/types/SequentialQuery.js';
import { TriplePattern } from '../../../src/query/core/TriplePattern.js';
import { QueryVariable } from '../../../src/query/core/QueryVariable.js';
import { RangeConstraint } from '../../../src/query/constraints/RangeConstraint.js';
import { RegexConstraint } from '../../../src/query/constraints/RegexConstraint.js';
import { KGEngine } from '../../../src/core/KGEngine.js';

describe('Phase 12.2: Edge Cases and Boundary Conditions', () => {
  let kg;
  
  beforeEach(() => {
    kg = new KGEngine();
  });
  
  afterEach(async () => {
    if (kg && typeof kg.clear === 'function') {
      await kg.clear();
    }
    kg = null;
  });
  
  test('Step 12.2.1: Test queries with empty result sets', async () => {
    // Test pattern query with no matching data
    const emptyQuery = new PatternQuery();
    emptyQuery.addPattern(new TriplePattern(
      new QueryVariable('nonexistent'),
      'rdf:type',
      'NonExistentType'
    ));
    
    const emptyResult = await emptyQuery.execute(kg);
    expect(emptyResult).toBeDefined();
    expect(emptyResult.bindings.length).toBe(0);
    expect(emptyResult.size()).toBe(0);
    expect(emptyResult.isEmpty()).toBe(true);
    
    // Test logical query with empty operands
    const logicalEmpty = new LogicalQuery('AND');
    logicalEmpty.addOperand(emptyQuery);
    
    const logicalResult = await logicalEmpty.execute(kg);
    expect(logicalResult).toBeDefined();
    expect(logicalResult.bindings.length).toBe(0);
    
    // Test aggregation query with empty source
    const aggregateEmpty = new AggregationQuery(emptyQuery, 'COUNT');
    const aggregateResult = await aggregateEmpty.execute(kg);
    expect(aggregateResult).toBeDefined();
    expect(aggregateResult.bindings.length).toBe(1);
    expect(aggregateResult.bindings[0].get('aggregate_result')).toBe(0);
    
    // Test sequential query with empty intermediate results
    const seqEmpty = new SequentialQuery();
    seqEmpty.addStage(emptyQuery);
    seqEmpty.addStage(new PatternQuery().addPattern(
      new TriplePattern(new QueryVariable('x'), 'prop', new QueryVariable('y'))
    ));
    
    const seqResult = await seqEmpty.execute(kg);
    expect(seqResult).toBeDefined();
    expect(seqResult.bindings.length).toBe(0);
  });
  
  test('Step 12.2.2: Test queries with very large result sets', async () => {
    // Add a large amount of test data
    const largeDataSize = 1000;
    for (let i = 0; i < largeDataSize; i++) {
      kg.addTriple(`entity:${i}`, 'rdf:type', 'TestEntity');
      kg.addTriple(`entity:${i}`, 'index', i);
      kg.addTriple(`entity:${i}`, 'category', `cat_${i % 10}`);
    }
    
    // Test pattern query with large result set
    const largeQuery = new PatternQuery();
    largeQuery.addPattern(new TriplePattern(
      new QueryVariable('entity'),
      'rdf:type',
      'TestEntity'
    ));
    
    const largeResult = await largeQuery.execute(kg);
    expect(largeResult).toBeDefined();
    expect(largeResult.bindings.length).toBe(largeDataSize);
    
    // Test aggregation with large dataset
    const countQuery = new AggregationQuery(largeQuery, 'COUNT');
    const countResult = await countQuery.execute(kg);
    expect(countResult).toBeDefined();
    expect(countResult.bindings[0].get('aggregate_result')).toBe(largeDataSize);
    
    // Test grouped aggregation with large dataset
    const groupQuery = new PatternQuery();
    groupQuery.addPattern(new TriplePattern(
      new QueryVariable('entity'),
      'category',
      new QueryVariable('category')
    ));
    
    const groupedAgg = new AggregationQuery(groupQuery, 'COUNT');
    groupedAgg.groupBy('category');
    
    const groupedResult = await groupedAgg.execute(kg);
    expect(groupedResult).toBeDefined();
    expect(groupedResult.bindings.length).toBe(10); // 10 categories
    
    // Each category should have 100 entities
    groupedResult.bindings.forEach(binding => {
      expect(binding.get('aggregate_result')).toBe(100);
    });
  });
  
  test('Step 12.2.3: Test queries with complex variable binding patterns', async () => {
    // Add test data with complex relationships
    kg.addTriple('person:alice', 'rdf:type', 'Person');
    kg.addTriple('person:alice', 'name', 'Alice');
    kg.addTriple('person:alice', 'age', 30);
    kg.addTriple('person:alice', 'knows', 'person:bob');
    
    kg.addTriple('person:bob', 'rdf:type', 'Person');
    kg.addTriple('person:bob', 'name', 'Bob');
    kg.addTriple('person:bob', 'age', 25);
    kg.addTriple('person:bob', 'knows', 'person:charlie');
    
    kg.addTriple('person:charlie', 'rdf:type', 'Person');
    kg.addTriple('person:charlie', 'name', 'Charlie');
    kg.addTriple('person:charlie', 'age', 35);
    kg.addTriple('person:charlie', 'knows', 'person:alice');
    
    // Test complex variable binding with multiple shared variables
    const complexQuery = new PatternQuery();
    const personVar = new QueryVariable('person');
    const nameVar = new QueryVariable('name');
    const ageVar = new QueryVariable('age');
    const friendVar = new QueryVariable('friend');
    const friendNameVar = new QueryVariable('friendName');
    
    complexQuery.addPattern(new TriplePattern(personVar, 'rdf:type', 'Person'));
    complexQuery.addPattern(new TriplePattern(personVar, 'name', nameVar));
    complexQuery.addPattern(new TriplePattern(personVar, 'age', ageVar));
    complexQuery.addPattern(new TriplePattern(personVar, 'knows', friendVar));
    complexQuery.addPattern(new TriplePattern(friendVar, 'name', friendNameVar));
    
    const complexResult = await complexQuery.execute(kg);
    expect(complexResult).toBeDefined();
    expect(complexResult.bindings.length).toBe(3); // Each person knows one other person
    
    // Verify binding consistency
    complexResult.bindings.forEach(binding => {
      expect(binding.has('person')).toBe(true);
      expect(binding.has('name')).toBe(true);
      expect(binding.has('age')).toBe(true);
      expect(binding.has('friend')).toBe(true);
      expect(binding.has('friendName')).toBe(true);
      
      // Verify data types
      expect(typeof binding.get('age')).toBe('number');
      expect(typeof binding.get('name')).toBe('string');
      expect(typeof binding.get('friendName')).toBe('string');
    });
    
    // Test variable binding with constraints
    const constrainedQuery = new PatternQuery();
    const constrainedPersonVar = new QueryVariable('person');
    const constrainedAgeVar = new QueryVariable('age');
    
    // Add age constraint
    constrainedAgeVar.addConstraint(new RangeConstraint('age', 25, 35));
    
    constrainedQuery.addPattern(new TriplePattern(constrainedPersonVar, 'rdf:type', 'Person'));
    constrainedQuery.addPattern(new TriplePattern(constrainedPersonVar, 'age', constrainedAgeVar));
    
    const constrainedResult = await constrainedQuery.execute(kg);
    expect(constrainedResult).toBeDefined();
    expect(constrainedResult.bindings.length).toBe(3); // All ages are within range
    
    constrainedResult.bindings.forEach(binding => {
      const age = binding.get('age');
      expect(age).toBeGreaterThanOrEqual(25);
      expect(age).toBeLessThanOrEqual(35);
    });
  });
  
  test('Step 12.2.4: Test queries with deeply nested compositions', async () => {
    // Add test data
    kg.addTriple('item:1', 'rdf:type', 'Item');
    kg.addTriple('item:1', 'value', 10);
    kg.addTriple('item:2', 'rdf:type', 'Item');
    kg.addTriple('item:2', 'value', 20);
    kg.addTriple('item:3', 'rdf:type', 'Item');
    kg.addTriple('item:3', 'value', 30);
    
    // Create deeply nested logical query structure
    const baseQuery1 = new PatternQuery();
    baseQuery1.addPattern(new TriplePattern(new QueryVariable('item'), 'rdf:type', 'Item'));
    
    const baseQuery2 = new PatternQuery();
    baseQuery2.addPattern(new TriplePattern(new QueryVariable('item'), 'value', new QueryVariable('value')));
    
    // Level 1: AND of base queries
    const level1 = new LogicalQuery('AND');
    level1.addOperand(baseQuery1);
    level1.addOperand(baseQuery2);
    
    // Level 2: OR with aggregation
    const aggregateQuery = new AggregationQuery(level1, 'COUNT');
    const level2 = new LogicalQuery('OR');
    level2.addOperand(level1);
    level2.addOperand(aggregateQuery);
    
    // Level 3: Sequential processing
    const level3 = new SequentialQuery();
    level3.addStage(level2);
    level3.addStage(new AggregationQuery(baseQuery1, 'COUNT'));
    
    // Level 4: Final logical composition
    const level4 = new LogicalQuery('AND');
    level4.addOperand(level3);
    level4.addOperand(level1);
    
    const nestedResult = await level4.execute(kg);
    expect(nestedResult).toBeDefined();
    expect(nestedResult.bindings.length).toBeGreaterThan(0);
    
    // Test deeply nested sequential query
    const deepSeq = new SequentialQuery();
    for (let i = 0; i < 10; i++) {
      const stageQuery = new PatternQuery();
      stageQuery.addPattern(new TriplePattern(new QueryVariable('item'), 'rdf:type', 'Item'));
      deepSeq.addStage(stageQuery);
    }
    
    const deepSeqResult = await deepSeq.execute(kg);
    expect(deepSeqResult).toBeDefined();
    
    // Test nested aggregations
    const nestedAgg1 = new AggregationQuery(baseQuery1, 'COUNT');
    const nestedAgg2 = new AggregationQuery(nestedAgg1, 'COUNT');
    
    const nestedAggResult = await nestedAgg2.execute(kg);
    expect(nestedAggResult).toBeDefined();
    expect(nestedAggResult.bindings.length).toBe(1);
  });
  
  test('Step 12.2.5: Test queries with unusual data types and values', async () => {
    // Add test data with various data types
    kg.addTriple('test:entity', 'stringProp', 'normal string');
    kg.addTriple('test:entity', 'emptyString', '');
    kg.addTriple('test:entity', 'numberProp', 42);
    kg.addTriple('test:entity', 'floatProp', 3.14159);
    kg.addTriple('test:entity', 'negativeProp', -100);
    kg.addTriple('test:entity', 'zeroProp', 0);
    kg.addTriple('test:entity', 'booleanTrue', true);
    kg.addTriple('test:entity', 'booleanFalse', false);
    kg.addTriple('test:entity', 'nullProp', null);
    kg.addTriple('test:entity', 'undefinedProp', undefined);
    kg.addTriple('test:entity', 'specialChars', '!@#$%^&*()_+-=[]{}|;:,.<>?');
    kg.addTriple('test:entity', 'unicodeProp', '🚀🌟💫🔥⭐');
    kg.addTriple('test:entity', 'longString', 'a'.repeat(1000));
    kg.addTriple('test:entity', 'jsonLike', '{"key": "value", "number": 123}');
    kg.addTriple('test:entity', 'arrayLike', '[1, 2, 3, "test"]');
    
    // Test query with various data types
    const dataTypeQuery = new PatternQuery();
    dataTypeQuery.addPattern(new TriplePattern(
      'test:entity',
      new QueryVariable('property'),
      new QueryVariable('value')
    ));
    
    const dataTypeResult = await dataTypeQuery.execute(kg);
    expect(dataTypeResult).toBeDefined();
    expect(dataTypeResult.bindings.length).toBeGreaterThan(10);
    
    // Test constraints with unusual values
    const numericQuery = new PatternQuery();
    const numericVar = new QueryVariable('value');
    numericVar.addConstraint(new RangeConstraint('value', -200, 200));
    
    numericQuery.addPattern(new TriplePattern(
      'test:entity',
      new QueryVariable('prop'),
      numericVar
    ));
    
    const numericResult = await numericQuery.execute(kg);
    expect(numericResult).toBeDefined();
    
    // Should include numeric values within range
    const numericValues = numericResult.bindings.map(b => b.get('value')).filter(v => typeof v === 'number');
    expect(numericValues.length).toBeGreaterThan(0);
    numericValues.forEach(value => {
      expect(value).toBeGreaterThanOrEqual(-200);
      expect(value).toBeLessThanOrEqual(200);
    });
    
    // Test regex constraint with special characters
    const regexQuery = new PatternQuery();
    const regexVar = new QueryVariable('value');
    regexVar.addConstraint(new RegexConstraint('^[!@#$%^&*()_+\\-=\\[\\]{}|;:,.<>?]+$'));
    
    regexQuery.addPattern(new TriplePattern(
      'test:entity',
      new QueryVariable('prop'),
      regexVar
    ));
    
    const regexResult = await regexQuery.execute(kg);
    expect(regexResult).toBeDefined();
    expect(regexResult.bindings.length).toBe(1); // Should match specialChars
    expect(regexResult.bindings[0].get('value')).toBe('!@#$%^&*()_+-=[]{}|;:,.<>?');
    
    // Test aggregation with mixed data types
    const mixedAggQuery = new AggregationQuery(dataTypeQuery, 'COLLECT');
    const mixedAggResult = await mixedAggQuery.execute(kg);
    expect(mixedAggResult).toBeDefined();
    expect(mixedAggResult.bindings.length).toBe(1);
    
    const collectedValues = mixedAggResult.bindings[0].get('aggregate_result');
    expect(Array.isArray(collectedValues)).toBe(true);
    expect(collectedValues.length).toBeGreaterThan(10);
    
    // Verify various data types are preserved in the original query results
    const originalValues = dataTypeResult.bindings.map(b => b.get('value'));
    const hasString = originalValues.some(v => typeof v === 'string');
    const hasNumber = originalValues.some(v => typeof v === 'number');
    const hasBoolean = originalValues.some(v => typeof v === 'boolean');
    
    expect(hasString).toBe(true);
    expect(hasNumber).toBe(true);
    expect(hasBoolean).toBe(true);
    
    // The collected values should contain the same data
    expect(collectedValues.length).toBe(originalValues.length);
    
    // Test handling of null and undefined values
    const nullQuery = new PatternQuery();
    nullQuery.addPattern(new TriplePattern(
      'test:entity',
      'nullProp',
      new QueryVariable('nullValue')
    ));
    
    const nullResult = await nullQuery.execute(kg);
    expect(nullResult).toBeDefined();
    // Note: Behavior with null/undefined may vary based on storage implementation
    
    // Test very long strings
    const longStringQuery = new PatternQuery();
    longStringQuery.addPattern(new TriplePattern(
      'test:entity',
      'longString',
      new QueryVariable('longValue')
    ));
    
    const longStringResult = await longStringQuery.execute(kg);
    expect(longStringResult).toBeDefined();
    if (longStringResult.bindings.length > 0) {
      const longValue = longStringResult.bindings[0].get('longValue');
      expect(typeof longValue).toBe('string');
      expect(longValue.length).toBe(1000);
    }
  });
});
