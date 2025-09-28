/**
 * Proxy Type Detector Unit Tests
 * Testing logic that determines which proxy type to create based on query results
 */

import { ProxyTypeDetector } from '../src/ProxyTypeDetector.js';
import { DataStoreDataSource } from '../src/DataStoreDataSource.js';
import { createTestStore, createSampleData, assertions, validators, errorHelpers } from './setup.js';

describe('ProxyTypeDetector', () => {
  let store;
  let resourceManager;
  let sampleData;
  let detector;
  
  beforeEach(() => {
    store = createTestStore();
    resourceManager = new DataStoreDataSource(store);
    sampleData = createSampleData(store);
    detector = new ProxyTypeDetector(resourceManager);
  });
  
  describe('Constructor', () => {
    test('should require resourceManager parameter', () => {
      expect(() => new ProxyTypeDetector()).toThrow('ResourceManager is required');
      expect(() => new ProxyTypeDetector(null)).toThrow('ResourceManager is required');
      expect(() => new ProxyTypeDetector({})).toThrow('ResourceManager is required');
    });
    
    test('should validate resourceManager has required methods', () => {
      const invalidResourceManager = { query: 'not a function' };
      expect(() => new ProxyTypeDetector(invalidResourceManager)).toThrow('ResourceManager is required');
    });
    
    test('should accept valid ResourceManager', () => {
      expect(() => new ProxyTypeDetector(resourceManager)).not.toThrow();
      const detector = new ProxyTypeDetector(resourceManager);
      expect(detector.resourceManager).toBe(resourceManager);
      expect(detector.store).toBe(store); // Should have backward compatibility
    });
  });
  
  describe('detectProxyType() Method', () => {
    test('should require querySpec parameter', () => {
      expect(() => detector.detectProxyType()).toThrow('Query specification is required');
      expect(() => detector.detectProxyType(null)).toThrow('Query specification is required');
      expect(() => detector.detectProxyType(undefined)).toThrow('Query specification is required');
    });
    
    test('should validate querySpec structure', () => {
      expect(() => detector.detectProxyType({})).toThrow('Query must have find clause');
      expect(() => detector.detectProxyType({ find: [] })).toThrow('Query must have find clause');
      expect(() => detector.detectProxyType({ find: ['?e'] })).toThrow('Query must have where clause');
      expect(() => detector.detectProxyType({ find: ['?e'], where: 'invalid' })).toThrow('Where clause must be an array');
    });
    
    test('should detect EntityProxy for single entity queries', () => {
      // Query that returns a single entity ID
      const entityQuery = {
        find: ['?e'],
        where: [['?e', ':user/name', 'Alice']]
      };
      
      const result = detector.detectProxyType(entityQuery);
      expect(result.type).toBe('EntityProxy');
      expect(result.isCollection).toBe(false);
      expect(result.isStream).toBe(false);
    });
    
    test('should detect CollectionProxy for multi-entity queries', () => {
      // Query that returns multiple entities
      const collectionQuery = {
        find: ['?e'],
        where: [['?e', ':user/name', '?name']]
      };
      
      const result = detector.detectProxyType(collectionQuery);
      expect(result.type).toBe('CollectionProxy');
      expect(result.isCollection).toBe(true);
      expect(result.isStream).toBe(false);
    });
    
    test('should detect StreamProxy for attribute value queries', () => {
      // Query that returns attribute values (not entity IDs)
      const streamQuery = {
        find: ['?name', '?email'],
        where: [
          ['?e', ':user/name', '?name'],
          ['?e', ':user/email', '?email']
        ]
      };
      
      const result = detector.detectProxyType(streamQuery);
      expect(result.type).toBe('StreamProxy');
      expect(result.isCollection).toBe(false);
      expect(result.isStream).toBe(true);
    });
    
    test('should detect DataStoreProxy for aggregate queries', () => {
      // Query that aggregates or transforms data
      const aggregateQuery = {
        find: ['(count ?e)'],
        where: [['?e', ':user/name', '?name']]
      };
      
      const result = detector.detectProxyType(aggregateQuery);
      expect(result.type).toBe('DataStoreProxy');
      expect(result.isCollection).toBe(false);
      expect(result.isStream).toBe(false);
      expect(result.isAggregate).toBe(true);
    });
    
    test('should detect DataStoreProxy for complex multi-source queries', () => {
      // Query that joins multiple entity types
      const complexQuery = {
        find: ['?user', '?project'],
        where: [
          ['?user', ':user/name', '?name'],
          ['?project', ':project/name', '?pname'],
          ['?project', ':project/owner', '?user']
        ]
      };
      
      const result = detector.detectProxyType(complexQuery);
      expect(result.type).toBe('DataStoreProxy');
      expect(result.isCollection).toBe(false);
      expect(result.isStream).toBe(false);
      expect(result.isComplex).toBe(true);
    });
  });
  
  describe('analyzeQueryResults() Method', () => {
    test('should analyze actual query results to refine detection', () => {
      const entityQuery = {
        find: ['?e'],
        where: [['?e', ':user/name', 'Alice']]
      };
      
      // Execute query to get actual results
      const results = resourceManager.query(entityQuery);
      const analysis = detector.analyzeQueryResults(entityQuery, results);
      
      expect(analysis.resultCount).toBe(1);
      expect(analysis.isSingleResult).toBe(true);
      expect(analysis.containsEntityIds).toBe(true);
      expect(analysis.suggestedType).toBe('EntityProxy');
    });
    
    test('should handle empty query results', () => {
      const emptyQuery = {
        find: ['?e'],
        where: [['?e', ':user/name', 'NonExistent']]
      };
      
      const results = resourceManager.query(emptyQuery);
      const analysis = detector.analyzeQueryResults(emptyQuery, results);
      
      expect(analysis.resultCount).toBe(0);
      expect(analysis.isSingleResult).toBe(false);
      expect(analysis.isEmpty).toBe(true);
      expect(analysis.suggestedType).toBe('CollectionProxy'); // Empty collections still use CollectionProxy
    });
    
    test('should analyze multiple entity results', () => {
      const multiQuery = {
        find: ['?e'],
        where: [['?e', ':user/name', '?name']]
      };
      
      const results = resourceManager.query(multiQuery);
      const analysis = detector.analyzeQueryResults(multiQuery, results);
      
      expect(analysis.resultCount).toBe(3); // Alice, Bob, Charlie
      expect(analysis.isSingleResult).toBe(false);
      expect(analysis.containsEntityIds).toBe(true);
      expect(analysis.suggestedType).toBe('CollectionProxy');
    });
    
    test('should analyze attribute value results', () => {
      const valueQuery = {
        find: ['?name'],
        where: [['?e', ':user/name', '?name']]
      };
      
      const results = resourceManager.query(valueQuery);
      const analysis = detector.analyzeQueryResults(valueQuery, results);
      
      expect(analysis.resultCount).toBe(3);
      expect(analysis.isSingleResult).toBe(false);
      expect(analysis.containsEntityIds).toBe(false);
      expect(analysis.suggestedType).toBe('StreamProxy');
    });
  });
  
  describe('isEntityIdQuery() Method', () => {
    test('should identify entity ID queries', () => {
      const entityQuery = {
        find: ['?e'],
        where: [['?e', ':user/name', 'Alice']]
      };
      
      expect(detector.isEntityIdQuery(entityQuery)).toBe(true);
    });
    
    test('should identify non-entity queries', () => {
      const valueQuery = {
        find: ['?name', '?email'],
        where: [
          ['?e', ':user/name', '?name'],
          ['?e', ':user/email', '?email']
        ]
      };
      
      expect(detector.isEntityIdQuery(valueQuery)).toBe(false);
    });
    
    test('should handle mixed queries', () => {
      const mixedQuery = {
        find: ['?e', '?name'],
        where: [['?e', ':user/name', '?name']]
      };
      
      expect(detector.isEntityIdQuery(mixedQuery)).toBe(true); // Contains entity ID
    });
  });
  
  describe('isSingleResultQuery() Method', () => {
    test('should detect single result patterns', () => {
      // Query with specific value that should return one result
      const singleQuery = {
        find: ['?e'],
        where: [['?e', ':user/name', 'Alice']]
      };
      
      expect(detector.isSingleResultQuery(singleQuery)).toBe(true);
    });
    
    test('should detect multi-result patterns', () => {
      // Query with variable that can match multiple values
      const multiQuery = {
        find: ['?e'],
        where: [['?e', ':user/name', '?name']]
      };
      
      expect(detector.isSingleResultQuery(multiQuery)).toBe(false);
    });
    
    test('should handle unique constraint queries', () => {
      // Queries against unique attributes should return single results
      const uniqueQuery = {
        find: ['?e'],
        where: [['?e', ':user/email', 'alice@example.com']]
      };
      
      expect(detector.isSingleResultQuery(uniqueQuery)).toBe(true);
    });
  });
  
  describe('isAggregateQuery() Method', () => {
    test('should detect count aggregates', () => {
      const countQuery = {
        find: ['(count ?e)'],
        where: [['?e', ':user/name', '?name']]
      };
      
      expect(detector.isAggregateQuery(countQuery)).toBe(true);
    });
    
    test('should detect sum aggregates', () => {
      const sumQuery = {
        find: ['(sum ?age)'],
        where: [['?e', ':user/age', '?age']]
      };
      
      expect(detector.isAggregateQuery(sumQuery)).toBe(true);
    });
    
    test('should detect min/max aggregates', () => {
      const minQuery = {
        find: ['(min ?age)'],
        where: [['?e', ':user/age', '?age']]
      };
      
      const maxQuery = {
        find: ['(max ?age)'],
        where: [['?e', ':user/age', '?age']]
      };
      
      expect(detector.isAggregateQuery(minQuery)).toBe(true);
      expect(detector.isAggregateQuery(maxQuery)).toBe(true);
    });
    
    test('should not detect non-aggregate queries', () => {
      const normalQuery = {
        find: ['?e', '?name'],
        where: [['?e', ':user/name', '?name']]
      };
      
      expect(detector.isAggregateQuery(normalQuery)).toBe(false);
    });
  });
  
  describe('Error Handling', () => {
    test('should fail fast with invalid inputs', () => {
      errorHelpers.expectNoFallback(() => detector.detectProxyType());
      errorHelpers.expectNoFallback(() => detector.detectProxyType(null));
      errorHelpers.expectNoFallback(() => detector.detectProxyType({}));
    });
    
    test('should not have fallback behavior', () => {
      const invalidDetector = new ProxyTypeDetector(resourceManager);
      
      // Should throw immediately, not return default values
      errorHelpers.expectNoFallback(() => invalidDetector.detectProxyType());
      errorHelpers.expectNoFallback(() => invalidDetector.analyzeQueryResults());
    });
  });
  
  describe('Integration with ResourceManager', () => {
    test('should work with real ResourceManager queries', () => {
      const queries = [
        {
          spec: { find: ['?e'], where: [['?e', ':user/name', 'Alice']] },
          expectedType: 'EntityProxy'
        },
        {
          spec: { find: ['?e'], where: [['?e', ':user/name', '?name']] },
          expectedType: 'CollectionProxy'
        },
        {
          spec: { find: ['?name'], where: [['?e', ':user/name', '?name']] },
          expectedType: 'StreamProxy'
        },
        {
          spec: { find: ['(count ?e)'], where: [['?e', ':user/name', '?name']] },
          expectedType: 'DataStoreProxy'
        }
      ];
      
      queries.forEach(({ spec, expectedType }) => {
        const result = detector.detectProxyType(spec);
        expect(result.type).toBe(expectedType);
      });
    });
    
    test('should provide consistent results for same query', () => {
      const querySpec = {
        find: ['?e'],
        where: [['?e', ':user/name', '?name']]
      };
      
      const result1 = detector.detectProxyType(querySpec);
      const result2 = detector.detectProxyType(querySpec);
      
      expect(result1.type).toBe(result2.type);
      expect(result1.isCollection).toBe(result2.isCollection);
      expect(result1.isStream).toBe(result2.isStream);
    });
  });
});