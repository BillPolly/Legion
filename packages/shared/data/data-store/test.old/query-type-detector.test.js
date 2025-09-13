/**
 * Query Type Detector Unit Tests
 * Phase 1, Step 1.3: Query Result Type Detection
 * 
 * TDD approach: Tests written first for query analysis logic that determines
 * which proxy type (StreamProxy, CollectionProxy, or EntityProxy) to return
 * based on query structure and result analysis.
 * 
 * Query analysis considers:
 * - Find clause structure (single variable, multiple variables, aggregates)
 * - Result cardinality (single result vs multiple results)
 * - Schema-based type inference for entity references
 * - Aggregate function detection
 * 
 * No mocks - using real query structures and expected proxy behaviors
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { QueryTypeDetector } from '../src/query-type-detector.js';
import { DataStore } from '../src/store.js';

describe('QueryTypeDetector Unit Tests', () => {
  let detector;
  let store;
  let schema;
  
  beforeEach(() => {
    // Real DataStore for schema-based analysis
    schema = {
      ':user/id': { valueType: 'string', unique: 'identity' },
      ':user/name': { valueType: 'string' },
      ':user/age': { valueType: 'number' },
      ':user/verified': { valueType: 'boolean' },
      ':user/friends': { valueType: 'ref', card: 'many' },
      ':user/profile': { valueType: 'ref' },
      ':post/id': { valueType: 'string', unique: 'identity' },
      ':post/title': { valueType: 'string' },
      ':post/author': { valueType: 'ref' },
      ':post/tags': { valueType: 'ref', card: 'many' }
    };
    
    store = new DataStore(schema);
    detector = new QueryTypeDetector(store);
  });
  
  afterEach(() => {
    detector = null;
    store = null;
  });

  describe('Constructor and Basic Methods', () => {
    test('should create QueryTypeDetector with DataStore', () => {
      expect(detector).toBeInstanceOf(QueryTypeDetector);
      expect(detector.store).toBe(store);
    });
    
    test('should throw error without DataStore', () => {
      expect(() => new QueryTypeDetector()).toThrow('QueryTypeDetector requires DataStore instance');
      expect(() => new QueryTypeDetector(null)).toThrow('QueryTypeDetector requires DataStore instance');
      expect(() => new QueryTypeDetector({})).toThrow('QueryTypeDetector requires valid DataStore instance');
    });
    
    test('should provide detectProxyType method', () => {
      expect(typeof detector.detectProxyType).toBe('function');
    });
    
    test('should provide analysis helper methods', () => {
      expect(typeof detector.analyzeQuery).toBe('function');
      expect(typeof detector.isAggregateQuery).toBe('function');
      expect(typeof detector.isEntityQuery).toBe('function');
      expect(typeof detector.isScalarQuery).toBe('function');
    });
  });

  describe('Aggregate Function Detection', () => {
    test('should detect count aggregate function', () => {
      const countQuery = {
        find: [['(count ?e)']],
        where: [['?e', ':user/name', '?name']]
      };
      
      expect(detector.isAggregateQuery(countQuery)).toBe(true);
      const analysis = detector.analyzeQuery(countQuery);
      expect(analysis.type).toBe('aggregate');
      expect(analysis.aggregateFunction).toBe('count');
    });
    
    test('should detect sum aggregate function', () => {
      const sumQuery = {
        find: [['(sum ?age)']],
        where: [['?e', ':user/age', '?age']]
      };
      
      expect(detector.isAggregateQuery(sumQuery)).toBe(true);
      const analysis = detector.analyzeQuery(sumQuery);
      expect(analysis.type).toBe('aggregate');
      expect(analysis.aggregateFunction).toBe('sum');
    });
    
    test('should detect avg aggregate function', () => {
      const avgQuery = {
        find: [['(avg ?age)']],
        where: [['?e', ':user/age', '?age']]
      };
      
      expect(detector.isAggregateQuery(avgQuery)).toBe(true);
      const analysis = detector.analyzeQuery(avgQuery);
      expect(analysis.type).toBe('aggregate');
      expect(analysis.aggregateFunction).toBe('avg');
    });
    
    test('should detect min/max aggregate functions', () => {
      const minQuery = {
        find: [['(min ?age)']],
        where: [['?e', ':user/age', '?age']]
      };
      
      const maxQuery = {
        find: [['(max ?age)']],
        where: [['?e', ':user/age', '?age']]
      };
      
      expect(detector.isAggregateQuery(minQuery)).toBe(true);
      expect(detector.isAggregateQuery(maxQuery)).toBe(true);
      
      expect(detector.analyzeQuery(minQuery).aggregateFunction).toBe('min');
      expect(detector.analyzeQuery(maxQuery).aggregateFunction).toBe('max');
    });
    
    test('should not detect non-aggregate queries as aggregates', () => {
      const regularQuery = {
        find: ['?name'],
        where: [['?e', ':user/name', '?name']]
      };
      
      expect(detector.isAggregateQuery(regularQuery)).toBe(false);
      const analysis = detector.analyzeQuery(regularQuery);
      expect(analysis.type).not.toBe('aggregate');
    });
    
    test('should handle complex aggregate expressions', () => {
      const complexQuery = {
        find: [['(count-distinct ?author)']],
        where: [['?post', ':post/author', '?author']]
      };
      
      expect(detector.isAggregateQuery(complexQuery)).toBe(true);
      const analysis = detector.analyzeQuery(complexQuery);
      expect(analysis.aggregateFunction).toBe('count-distinct');
    });
  });

  describe('Entity Query Detection', () => {
    test('should detect single entity query', () => {
      const entityQuery = {
        find: ['?e'],
        where: [['?e', ':user/name', 'Alice']]
      };
      
      expect(detector.isEntityQuery(entityQuery)).toBe(true);
      const analysis = detector.analyzeQuery(entityQuery);
      expect(analysis.type).toBe('entity');
      expect(analysis.entityVariable).toBe('?e');
    });
    
    test('should detect entity query with multiple conditions', () => {
      const entityQuery = {
        find: ['?user'],
        where: [
          ['?user', ':user/name', 'Alice'],
          ['?user', ':user/verified', true]
        ]
      };
      
      expect(detector.isEntityQuery(entityQuery)).toBe(true);
      const analysis = detector.analyzeQuery(entityQuery);
      expect(analysis.type).toBe('entity');
      expect(analysis.entityVariable).toBe('?user');
    });
    
    test('should not detect multi-variable queries as entity queries', () => {
      const multiVarQuery = {
        find: ['?name', '?age'],
        where: [['?e', ':user/name', '?name'], ['?e', ':user/age', '?age']]
      };
      
      expect(detector.isEntityQuery(multiVarQuery)).toBe(false);
    });
    
    test('should not detect scalar attribute queries as entity queries', () => {
      const scalarQuery = {
        find: ['?name'],
        where: [['?e', ':user/name', '?name']]
      };
      
      expect(detector.isEntityQuery(scalarQuery)).toBe(false);
    });
    
    test('should handle entity queries with relationships', () => {
      const relationshipQuery = {
        find: ['?author'],
        where: [
          ['?post', ':post/title', 'Hello World'],
          ['?post', ':post/author', '?author']
        ]
      };
      
      expect(detector.isEntityQuery(relationshipQuery)).toBe(true);
      const analysis = detector.analyzeQuery(relationshipQuery);
      expect(analysis.entityVariable).toBe('?author');
    });
  });

  describe('Scalar Query Detection', () => {
    test('should detect single scalar attribute query', () => {
      const scalarQuery = {
        find: ['?name'],
        where: [['?e', ':user/name', '?name']]
      };
      
      expect(detector.isScalarQuery(scalarQuery)).toBe(true);
      const analysis = detector.analyzeQuery(scalarQuery);
      expect(analysis.type).toBe('scalar');
      expect(analysis.scalarVariable).toBe('?name');
      expect(analysis.scalarAttribute).toBe(':user/name');
    });
    
    test('should detect scalar queries with different data types', () => {
      const ageQuery = {
        find: ['?age'],
        where: [['?e', ':user/age', '?age']]
      };
      
      const verifiedQuery = {
        find: ['?verified'],
        where: [['?e', ':user/verified', '?verified']]
      };
      
      expect(detector.isScalarQuery(ageQuery)).toBe(true);
      expect(detector.isScalarQuery(verifiedQuery)).toBe(true);
      
      const ageAnalysis = detector.analyzeQuery(ageQuery);
      const verifiedAnalysis = detector.analyzeQuery(verifiedQuery);
      
      expect(ageAnalysis.scalarAttribute).toBe(':user/age');
      expect(verifiedAnalysis.scalarAttribute).toBe(':user/verified');
    });
    
    test('should not detect multi-variable queries as scalar', () => {
      const multiVarQuery = {
        find: ['?name', '?age'],
        where: [['?e', ':user/name', '?name'], ['?e', ':user/age', '?age']]
      };
      
      expect(detector.isScalarQuery(multiVarQuery)).toBe(false);
    });
    
    test('should not detect entity queries as scalar', () => {
      const entityQuery = {
        find: ['?e'],
        where: [['?e', ':user/name', 'Alice']]
      };
      
      expect(detector.isScalarQuery(entityQuery)).toBe(false);
    });
    
    test('should handle scalar queries with complex conditions', () => {
      const complexScalarQuery = {
        find: ['?title'],
        where: [
          ['?post', ':post/title', '?title'],
          ['?post', ':post/author', '?author'],
          ['?author', ':user/name', 'Alice']
        ]
      };
      
      expect(detector.isScalarQuery(complexScalarQuery)).toBe(true);
      const analysis = detector.analyzeQuery(complexScalarQuery);
      expect(analysis.scalarAttribute).toBe(':post/title');
    });
  });

  describe('Multi-Variable Query Detection', () => {
    test('should detect multi-variable queries', () => {
      const multiVarQuery = {
        find: ['?name', '?age'],
        where: [['?e', ':user/name', '?name'], ['?e', ':user/age', '?age']]
      };
      
      const analysis = detector.analyzeQuery(multiVarQuery);
      expect(analysis.type).toBe('multi-variable');
      expect(analysis.variables).toEqual(['?name', '?age']);
      expect(analysis.variableCount).toBe(2);
    });
    
    test('should detect three-variable queries', () => {
      const threeVarQuery = {
        find: ['?name', '?age', '?verified'],
        where: [
          ['?e', ':user/name', '?name'],
          ['?e', ':user/age', '?age'],
          ['?e', ':user/verified', '?verified']
        ]
      };
      
      const analysis = detector.analyzeQuery(threeVarQuery);
      expect(analysis.type).toBe('multi-variable');
      expect(analysis.variables).toEqual(['?name', '?age', '?verified']);
      expect(analysis.variableCount).toBe(3);
    });
    
    test('should detect relationship queries with multiple variables', () => {
      const relationshipQuery = {
        find: ['?post-title', '?author-name'],
        where: [
          ['?post', ':post/title', '?post-title'],
          ['?post', ':post/author', '?author'],
          ['?author', ':user/name', '?author-name']
        ]
      };
      
      const analysis = detector.analyzeQuery(relationshipQuery);
      expect(analysis.type).toBe('multi-variable');
      expect(analysis.variables).toEqual(['?post-title', '?author-name']);
    });
  });

  describe('Proxy Type Detection', () => {
    test('should return StreamProxy for aggregate queries', () => {
      const countQuery = {
        find: [['(count ?e)']],
        where: [['?e', ':user/name', '?name']]
      };
      
      const mockResults = [[5]]; // Count result
      const proxyType = detector.detectProxyType(countQuery, mockResults);
      
      expect(proxyType).toBe('StreamProxy');
    });
    
    test('should return EntityProxy for single entity queries', () => {
      const entityQuery = {
        find: ['?e'],
        where: [['?e', ':user/name', 'Alice']]
      };
      
      const mockResults = [[123]]; // Single entity ID
      const proxyType = detector.detectProxyType(entityQuery, mockResults);
      
      expect(proxyType).toBe('EntityProxy');
    });
    
    test('should return CollectionProxy for entity queries with multiple results', () => {
      const entityQuery = {
        find: ['?e'],
        where: [['?e', ':user/verified', true]]
      };
      
      const mockResults = [[123], [456], [789]]; // Multiple entity IDs
      const proxyType = detector.detectProxyType(entityQuery, mockResults);
      
      expect(proxyType).toBe('CollectionProxy');
    });
    
    test('should return StreamProxy for single scalar queries', () => {
      const scalarQuery = {
        find: ['?name'],
        where: [['?e', ':user/name', '?name'], ['?e', ':user/id', 'user-alice']]
      };
      
      const mockResults = [['Alice']]; // Single scalar result
      const proxyType = detector.detectProxyType(scalarQuery, mockResults);
      
      expect(proxyType).toBe('StreamProxy');
    });
    
    test('should return CollectionProxy for scalar queries with multiple results', () => {
      const scalarQuery = {
        find: ['?name'],
        where: [['?e', ':user/name', '?name']]
      };
      
      const mockResults = [['Alice'], ['Bob'], ['Charlie']]; // Multiple scalar results
      const proxyType = detector.detectProxyType(scalarQuery, mockResults);
      
      expect(proxyType).toBe('CollectionProxy');
    });
    
    test('should return CollectionProxy for multi-variable queries', () => {
      const multiVarQuery = {
        find: ['?name', '?age'],
        where: [['?e', ':user/name', '?name'], ['?e', ':user/age', '?age']]
      };
      
      const mockResults = [['Alice', 30], ['Bob', 25]]; // Multi-variable results
      const proxyType = detector.detectProxyType(multiVarQuery, mockResults);
      
      expect(proxyType).toBe('CollectionProxy');
    });
    
    test('should return StreamProxy for empty results on single-value queries', () => {
      const scalarQuery = {
        find: ['?name'],
        where: [['?e', ':user/name', '?name'], ['?e', ':user/id', 'non-existent']]
      };
      
      const mockResults = []; // No results
      const proxyType = detector.detectProxyType(scalarQuery, mockResults);
      
      expect(proxyType).toBe('StreamProxy');
    });
    
    test('should return CollectionProxy for empty results on multi-value queries', () => {
      const multiVarQuery = {
        find: ['?name', '?age'],
        where: [['?e', ':user/name', '?name'], ['?e', ':user/age', 100]] // No 100-year-olds
      };
      
      const mockResults = []; // No results
      const proxyType = detector.detectProxyType(multiVarQuery, mockResults);
      
      expect(proxyType).toBe('CollectionProxy');
    });
  });

  describe('Schema-based Type Inference', () => {
    test('should use schema to identify reference attributes', () => {
      const analysis = detector._analyzeAttribute(':user/friends');
      expect(analysis.isReference).toBe(true);
      expect(analysis.isMany).toBe(true);
      expect(analysis.valueType).toBe('ref');
    });
    
    test('should use schema to identify scalar attributes', () => {
      const nameAnalysis = detector._analyzeAttribute(':user/name');
      expect(nameAnalysis.isReference).toBe(false);
      expect(nameAnalysis.isMany).toBe(false);
      expect(nameAnalysis.valueType).toBe('string');
      
      const ageAnalysis = detector._analyzeAttribute(':user/age');
      expect(ageAnalysis.valueType).toBe('number');
      
      const verifiedAnalysis = detector._analyzeAttribute(':user/verified');
      expect(verifiedAnalysis.valueType).toBe('boolean');
    });
    
    test('should handle single reference attributes', () => {
      const analysis = detector._analyzeAttribute(':post/author');
      expect(analysis.isReference).toBe(true);
      expect(analysis.isMany).toBe(false);
      expect(analysis.valueType).toBe('ref');
    });
    
    test('should handle unknown attributes gracefully', () => {
      const analysis = detector._analyzeAttribute(':unknown/attribute');
      expect(analysis.isReference).toBe(false);
      expect(analysis.isMany).toBe(false);
      expect(analysis.valueType).toBe('unknown');
    });
    
    test('should identify unique attributes', () => {
      const idAnalysis = detector._analyzeAttribute(':user/id');
      expect(idAnalysis.isUnique).toBe(true);
      expect(idAnalysis.uniqueType).toBe('identity');
      
      const emailAnalysis = detector._analyzeAttribute(':user/email');
      expect(emailAnalysis.isUnique).toBe(false); // Not in our test schema
    });
  });

  describe('Complex Query Pattern Analysis', () => {
    test('should analyze join queries correctly', () => {
      const joinQuery = {
        find: ['?post-title'],
        where: [
          ['?post', ':post/title', '?post-title'],
          ['?post', ':post/author', '?author'],
          ['?author', ':user/name', 'Alice']
        ]
      };
      
      const analysis = detector.analyzeQuery(joinQuery);
      expect(analysis.type).toBe('scalar');
      expect(analysis.hasJoins).toBe(true);
      expect(analysis.joinDepth).toBe(2); // post -> author -> name
    });
    
    test('should analyze queries with multiple joins', () => {
      const complexJoinQuery = {
        find: ['?tag-name'],
        where: [
          ['?post', ':post/author', '?author'],
          ['?author', ':user/name', 'Alice'],
          ['?post', ':post/tags', '?tag'],
          ['?tag', ':tag/name', '?tag-name']
        ]
      };
      
      const analysis = detector.analyzeQuery(complexJoinQuery);
      expect(analysis.hasJoins).toBe(true);
      expect(analysis.joinDepth).toBeGreaterThan(2);
    });
    
    test('should detect filtering conditions', () => {
      const filteredQuery = {
        find: ['?name'],
        where: [
          ['?e', ':user/name', '?name'],
          ['?e', ':user/age', '?age'],
          ['?e', ':user/verified', true]
        ]
      };
      
      const analysis = detector.analyzeQuery(filteredQuery);
      expect(analysis.hasFilters).toBe(true);
      expect(analysis.filterCount).toBe(1); // The :user/verified true condition
    });
    
    test('should analyze query complexity', () => {
      const simpleQuery = {
        find: ['?name'],
        where: [['?e', ':user/name', '?name']]
      };
      
      const complexQuery = {
        find: ['?title', '?author-name', '?tag-name'],
        where: [
          ['?post', ':post/title', '?title'],
          ['?post', ':post/author', '?author'],
          ['?author', ':user/name', '?author-name'],
          ['?post', ':post/tags', '?tag'],
          ['?tag', ':tag/name', '?tag-name'],
          ['?author', ':user/verified', true]
        ]
      };
      
      const simpleAnalysis = detector.analyzeQuery(simpleQuery);
      const complexAnalysis = detector.analyzeQuery(complexQuery);
      
      expect(simpleAnalysis.complexity).toBe('simple');
      expect(complexAnalysis.complexity).toBe('complex');
      expect(complexAnalysis.clauseCount).toBe(6);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should throw error for invalid query structures', () => {
      expect(() => detector.detectProxyType()).toThrow('Query spec is required');
      expect(() => detector.detectProxyType({})).toThrow('Query spec must have find clause');
      expect(() => detector.detectProxyType({ find: [] })).toThrow('Find clause cannot be empty');
      expect(() => detector.detectProxyType({ find: ['?e'] })).toThrow('Query spec must have where clause');
    });
    
    test('should handle malformed aggregate expressions', () => {
      const malformedQuery = {
        find: [['(invalid-function ?e)']],
        where: [['?e', ':user/name', '?name']]
      };
      
      expect(detector.isAggregateQuery(malformedQuery)).toBe(false);
      const analysis = detector.analyzeQuery(malformedQuery);
      expect(analysis.type).not.toBe('aggregate');
    });
    
    test('should handle queries with mixed find clause types', () => {
      const mixedQuery = {
        find: ['?name', ['(count ?e)']],
        where: [['?e', ':user/name', '?name']]
      };
      
      const analysis = detector.analyzeQuery(mixedQuery);
      expect(analysis.type).toBe('mixed'); // Special case
      expect(analysis.hasAggregates).toBe(true);
      expect(analysis.hasVariables).toBe(true);
    });
    
    test('should provide meaningful error messages', () => {
      expect(() => {
        detector.detectProxyType(null, []);
      }).toThrow('Query spec is required');
      
      expect(() => {
        detector.detectProxyType({ find: ['?e'], where: [] }, null);
      }).toThrow('Query results are required');
    });
    
    test('should handle edge case with empty where clause', () => {
      const emptyWhereQuery = {
        find: ['?e'],
        where: []
      };
      
      // Should still be able to analyze structure
      const analysis = detector.analyzeQuery(emptyWhereQuery);
      expect(analysis.type).toBe('entity');
      expect(analysis.clauseCount).toBe(0);
    });
  });
});