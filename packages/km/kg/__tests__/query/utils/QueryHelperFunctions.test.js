import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { PatternQuery } from '../../../src/query/types/PatternQuery.js';
import { LogicalQuery } from '../../../src/query/types/LogicalQuery.js';
import { TriplePattern } from '../../../src/query/core/TriplePattern.js';
import { QueryVariable } from '../../../src/query/core/QueryVariable.js';
import { RangeConstraint } from '../../../src/query/constraints/RangeConstraint.js';
import { RegexConstraint } from '../../../src/query/constraints/RegexConstraint.js';
import { FunctionConstraint } from '../../../src/query/constraints/FunctionConstraint.js';
import { QueryHelpers } from '../../../src/query/utils/QueryHelpers.js';
import { KGEngine } from '../../../src/core/KGEngine.js';

describe('Phase 11.1: Query Helper Functions', () => {
  let kg;
  
  beforeEach(() => {
    kg = new KGEngine();
    
    // Add test data for helper function testing
    const testTriples = [
      // People
      ['person:alice', 'rdf:type', 'Person'],
      ['person:alice', 'name', 'Alice Johnson'],
      ['person:alice', 'age', 30],
      
      ['person:bob', 'rdf:type', 'Person'],
      ['person:bob', 'name', 'Bob Smith'],
      ['person:bob', 'age', 25],
      
      ['person:charlie', 'rdf:type', 'Person'],
      ['person:charlie', 'name', 'Charlie Brown'],
      ['person:charlie', 'age', 35],
      
      // Relationships
      ['person:alice', 'knows', 'person:bob'],
      ['person:bob', 'knows', 'person:charlie']
    ];
    
    for (const [subject, predicate, object] of testTriples) {
      kg.addTriple(subject, predicate, object);
    }
  });
  
  afterEach(async () => {
    if (kg && typeof kg.clear === 'function') {
      await kg.clear();
    }
    kg = null;
  });
  
  test('Step 11.1.1: Test QueryHelpers pattern creation utilities', async () => {
    // Test createEntityQuery helper
    const entityQuery = QueryHelpers.createEntityQuery('Person');
    expect(entityQuery).toBeInstanceOf(PatternQuery);
    
    const entityResults = await entityQuery.execute(kg);
    expect(entityResults.size()).toBe(3); // Alice, Bob, Charlie
    
    // Test createPropertyQuery helper
    const propertyQuery = QueryHelpers.createPropertyQuery('person:alice', 'name');
    expect(propertyQuery).toBeInstanceOf(PatternQuery);
    
    const propertyResults = await propertyQuery.execute(kg);
    expect(propertyResults.size()).toBe(1);
    expect(propertyResults.getBinding(0).get('value')).toBe('Alice Johnson');
    
    // Test createRelationshipQuery helper
    const relationshipQuery = QueryHelpers.createRelationshipQuery('knows');
    expect(relationshipQuery).toBeInstanceOf(PatternQuery);
    
    const relationshipResults = await relationshipQuery.execute(kg);
    expect(relationshipResults.size()).toBe(2); // Alice knows Bob, Bob knows Charlie
    
    // Test createAllPropertiesQuery helper
    const allPropsQuery = QueryHelpers.createAllPropertiesQuery('person:alice');
    expect(allPropsQuery).toBeInstanceOf(PatternQuery);
    
    const allPropsResults = await allPropsQuery.execute(kg);
    expect(allPropsResults.size()).toBeGreaterThanOrEqual(3); // At least type, name, age
    
    const properties = allPropsResults.map(binding => binding.get('property'));
    expect(properties).toContain('rdf:type');
    expect(properties).toContain('name');
    expect(properties).toContain('age');
  });
  
  test('Step 11.1.2: Test QueryHelpers logical composition utilities', async () => {
    // Test createAndQuery helper - simplified
    const query1 = QueryHelpers.createEntityQuery('Person');
    const query2 = QueryHelpers.createPropertyQuery(new QueryVariable('person'), 'age', new QueryVariable('age'));
    
    const andQuery = QueryHelpers.createAndQuery([query1, query2]);
    expect(andQuery).toBeInstanceOf(LogicalQuery);
    expect(andQuery.operator).toBe('AND'); // Use direct property access
    
    // Test createOrQuery helper
    const youngQuery = QueryHelpers.createPropertyQuery(new QueryVariable('person'), 'age', new QueryVariable('age'));
    const oldQuery = QueryHelpers.createPropertyQuery(new QueryVariable('person'), 'age', new QueryVariable('age'));
    
    const orQuery = QueryHelpers.createOrQuery([youngQuery, oldQuery]);
    expect(orQuery).toBeInstanceOf(LogicalQuery);
    expect(orQuery.operator).toBe('OR');
    
    // Test createNotQuery helper
    const engineeringQuery = QueryHelpers.createPropertyQuery(new QueryVariable('person'), 'department', 'Engineering');
    const notQuery = QueryHelpers.createNotQuery(engineeringQuery);
    expect(notQuery).toBeInstanceOf(LogicalQuery);
    expect(notQuery.operator).toBe('NOT');
  });
  
  test('Step 11.1.3: Test QueryHelpers constraint creation utilities', async () => {
    // Test createRangeConstraint helper
    const rangeConstraint = QueryHelpers.createRangeConstraint('age', 25, 35);
    expect(rangeConstraint).toBeInstanceOf(RangeConstraint);
    
    // Test createRegexConstraint helper
    const emailRegexConstraint = QueryHelpers.createRegexConstraint('email', '.*@example\\.com$');
    expect(emailRegexConstraint).toBeInstanceOf(RegexConstraint);
    
    // Test createFunctionConstraint helper
    const evenAgeConstraint = QueryHelpers.createFunctionConstraint('age', (value) => value % 2 === 0);
    expect(evenAgeConstraint).toBeInstanceOf(FunctionConstraint);
    
    // Test createComparisonConstraint helper
    const comparisonConstraint = QueryHelpers.createComparisonConstraint('age', '>=', 30);
    expect(comparisonConstraint).toBeInstanceOf(FunctionConstraint);
    
    // Test createStringConstraint helper
    const stringConstraint = QueryHelpers.createStringConstraint('name', 'contains', 'Alice');
    expect(stringConstraint).toBeInstanceOf(FunctionConstraint);
    
    // Test createMultipleConstraints helper
    const multipleConstraints = QueryHelpers.createMultipleConstraints('age', [
      { operator: '>', value: 20 },
      { operator: '<', value: 40 }
    ]);
    expect(Array.isArray(multipleConstraints)).toBe(true);
    expect(multipleConstraints.length).toBe(2);
  });
  
  test('Step 11.1.4: Test QueryHelpers result formatting utilities', async () => {
    // Create a simple test query with known results
    const testQuery = QueryHelpers.createEntityQuery('Person');
    
    const results = await testQuery.execute(kg);
    expect(results.size()).toBe(3);
    
    // Test formatAsTable helper
    const tableFormat = QueryHelpers.formatAsTable(results, ['entity']);
    expect(Array.isArray(tableFormat)).toBe(true);
    expect(tableFormat.length).toBe(3);
    
    // Test formatAsCSV helper
    const csvFormat = QueryHelpers.formatAsCSV(results, ['entity']);
    expect(typeof csvFormat).toBe('string');
    expect(csvFormat).toContain('entity');
    
    // Test formatAsJSON helper
    const jsonFormat = QueryHelpers.formatAsJSON(results);
    expect(typeof jsonFormat).toBe('string');
    const parsedJson = JSON.parse(jsonFormat);
    expect(Array.isArray(parsedJson)).toBe(true);
    expect(parsedJson.length).toBe(3);
    
    // Test extractColumn helper
    const entityColumn = QueryHelpers.extractColumn(results, 'entity');
    expect(Array.isArray(entityColumn)).toBe(true);
    expect(entityColumn.length).toBe(3);
    
    // Test sortResults helper
    const sortedResults = QueryHelpers.sortResults(results, 'entity', 'asc');
    expect(sortedResults.size()).toBe(3);
    
    // Test filterResults helper
    const filteredResults = QueryHelpers.filterResults(results, (binding) => {
      return binding.get('entity') === 'person:alice';
    });
    expect(filteredResults.size()).toBe(1);
    
    // Test aggregateResults helper with count
    const countResult = QueryHelpers.aggregateResults(results, 'entity', 'count');
    expect(countResult).toBe(3);
  });
  
  test('Step 11.1.5: Test QueryHelpers validation utilities', async () => {
    // Test validateQuery helper
    const validQuery = QueryHelpers.createEntityQuery('Person');
    const validationResult = QueryHelpers.validateQuery(validQuery);
    expect(validationResult.isValid).toBe(true);
    expect(validationResult.errors).toEqual([]);
    
    // Test validatePattern helper
    const validPattern = new TriplePattern(
      new QueryVariable('person'),
      'rdf:type',
      'Person'
    );
    const patternValidation = QueryHelpers.validatePattern(validPattern);
    expect(patternValidation.isValid).toBe(true);
    
    // Test validateVariable helper
    const validVariable = new QueryVariable('person');
    const variableValidation = QueryHelpers.validateVariable(validVariable);
    expect(variableValidation.isValid).toBe(true);
    
    // Test validateQueryStructure helper
    const structureValidation = QueryHelpers.validateQueryStructure(validQuery);
    expect(structureValidation.isValid).toBe(true);
    expect(structureValidation.hasPatterns).toBe(true);
    expect(structureValidation.hasVariables).toBe(true);
    
    // Test validateQueryPerformance helper
    const performanceValidation = QueryHelpers.validateQueryPerformance(validQuery);
    expect(performanceValidation.isValid).toBe(true);
    expect(performanceValidation.estimatedComplexity).toBeDefined();
    expect(performanceValidation.recommendations).toBeDefined();
    
    // Test validateQuerySafety helper
    const safetyValidation = QueryHelpers.validateQuerySafety(validQuery);
    expect(safetyValidation.isValid).toBe(true);
    expect(safetyValidation.hasCycles).toBe(false);
    expect(safetyValidation.hasInfiniteLoops).toBe(false);
    
    // Test validateQueryCompatibility helper
    const compatibilityValidation = QueryHelpers.validateQueryCompatibility(validQuery, kg);
    expect(compatibilityValidation.isValid).toBe(true);
    expect(compatibilityValidation.supportedFeatures).toBeDefined();
    expect(compatibilityValidation.unsupportedFeatures).toEqual([]);
    
    // Test comprehensive validation
    const comprehensiveValidation = QueryHelpers.validateQueryComprehensive(validQuery, kg);
    expect(comprehensiveValidation.isValid).toBe(true);
    expect(comprehensiveValidation.structure).toBeDefined();
    expect(comprehensiveValidation.performance).toBeDefined();
    expect(comprehensiveValidation.safety).toBeDefined();
    expect(comprehensiveValidation.compatibility).toBeDefined();
    
    // Test validation with invalid query (empty query)
    const emptyQuery = new PatternQuery();
    const emptyValidation = QueryHelpers.validateQuery(emptyQuery);
    expect(emptyValidation.isValid).toBe(false);
    expect(emptyValidation.errors.length).toBeGreaterThan(0);
    
    // Test validation recommendations
    const recommendations = QueryHelpers.getQueryOptimizationRecommendations(validQuery);
    expect(Array.isArray(recommendations)).toBe(true);
    expect(recommendations.length).toBeGreaterThanOrEqual(0);
  });
});
