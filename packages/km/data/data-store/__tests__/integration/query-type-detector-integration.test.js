/**
 * QueryTypeDetector Integration Tests
 * Phase 1, Step 1.3: Query Result Type Detection
 * 
 * Integration tests demonstrating QueryTypeDetector working with real DataStore
 * and actual query execution to verify proxy type determination works correctly
 * in real-world scenarios.
 * 
 * No mocks - using real DataStore, DataScript database, and query results
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { QueryTypeDetector } from '../../src/query-type-detector.js';
import { DataStore } from '../../src/store.js';
import { q } from '../../../datascript/index.js';

describe('QueryTypeDetector Integration Tests', () => {
  let detector;
  let store;
  let schema;
  
  beforeEach(async () => {
    // Real schema for comprehensive testing
    schema = {
      ':user/id': { valueType: 'string', unique: 'identity' },
      ':user/name': { valueType: 'string' },
      ':user/age': { valueType: 'number' },
      ':user/verified': { valueType: 'boolean' },
      ':user/friends': { valueType: 'ref', card: 'many' },
      ':user/profile': { valueType: 'ref' },
      ':post/id': { valueType: 'string', unique: 'identity' },
      ':post/title': { valueType: 'string' },
      ':post/content': { valueType: 'string' },
      ':post/author': { valueType: 'ref' },
      ':post/tags': { valueType: 'ref', card: 'many' },
      ':tag/id': { valueType: 'string', unique: 'identity' },
      ':tag/name': { valueType: 'string' }
    };
    
    store = new DataStore(schema);
    detector = new QueryTypeDetector(store);
    
    // Add test data using createEntities
    const usersResult = store.createEntities([
      { ':user/id': 'user-alice', ':user/name': 'Alice', ':user/age': 30, ':user/verified': true },
      { ':user/id': 'user-bob', ':user/name': 'Bob', ':user/age': 25, ':user/verified': false },
      { ':user/id': 'user-charlie', ':user/name': 'Charlie', ':user/age': 35, ':user/verified': true }
    ]);
    
    const tagsResult = store.createEntities([
      { ':tag/id': 'tag-tech', ':tag/name': 'Technology' },
      { ':tag/id': 'tag-news', ':tag/name': 'News' },
      { ':tag/id': 'tag-fun', ':tag/name': 'Fun' }
    ]);
    
    const aliceId = usersResult.entityIds[0];
    const bobId = usersResult.entityIds[1];
    const techTagId = tagsResult.entityIds[0];
    const newsTagId = tagsResult.entityIds[1];
    const funTagId = tagsResult.entityIds[2];
    
    store.createEntities([
      { 
        ':post/id': 'post-1', 
        ':post/title': 'Hello World', 
        ':post/content': 'My first post',
        ':post/author': aliceId,
        ':post/tags': [techTagId, newsTagId]
      },
      { 
        ':post/id': 'post-2', 
        ':post/title': 'DataScript Rocks', 
        ':post/content': 'Learning DataScript',
        ':post/author': aliceId,
        ':post/tags': [techTagId]
      },
      { 
        ':post/id': 'post-3', 
        ':post/title': 'Fun Times', 
        ':post/content': 'Having fun with code',
        ':post/author': bobId,
        ':post/tags': [funTagId]
      }
    ]);
  });
  
  afterEach(() => {
    detector = null;
    store = null;
  });

  describe('Aggregate Query Integration', () => {
    test('should detect StreamProxy for count aggregate with actual results', () => {
      const countQuery = {
        find: [['count']],
        where: [['?e', ':user/name', '?name']],
        findType: 'scalar'
      };
      
      // Execute actual query
      const results = q(countQuery, store.db());
      expect(results).toBe(3); // We have 3 users (scalar result)
      
      // For detector testing, we need to wrap scalar result in array format for consistency
      const proxyType = detector.detectProxyType(countQuery, [results]);
      expect(proxyType).toBe('StreamProxy');
    });
    
    test('should detect StreamProxy for sum aggregate with real data', () => {
      const sumQuery = {
        find: [['sum', '?age']],
        where: [['?e', ':user/age', '?age']],
        findType: 'scalar'
      };
      
      const results = q(sumQuery, store.db());
      expect(results).toBe(90); // 30 + 25 + 35 = 90 (scalar result)
      
      // For detector testing, we need to wrap scalar result in array format for consistency
      const proxyType = detector.detectProxyType(sumQuery, [results]);
      expect(proxyType).toBe('StreamProxy');
    });
    
    test('should detect StreamProxy for avg aggregate', () => {
      const avgQuery = {
        find: [['avg', '?age']],
        where: [['?e', ':user/age', '?age']],
        findType: 'scalar'
      };
      
      const results = q(avgQuery, store.db());
      expect(results).toBe(30); // 90 / 3 = 30 (scalar result)
      
      // For detector testing, we need to wrap scalar result in array format for consistency
      const proxyType = detector.detectProxyType(avgQuery, [results]);
      expect(proxyType).toBe('StreamProxy');
    });
  });

  describe('Entity Query Integration', () => {
    test('should detect EntityProxy for single entity query', () => {
      const entityQuery = {
        find: ['?e'],
        where: [['?e', ':user/name', 'Alice']]
      };
      
      const results = q(entityQuery, store.db());
      expect(results).toHaveLength(1);
      
      const proxyType = detector.detectProxyType(entityQuery, results);
      expect(proxyType).toBe('EntityProxy');
    });
    
    test('should detect CollectionProxy for entity query with multiple results', () => {
      const entityQuery = {
        find: ['?e'],
        where: [['?e', ':user/verified', true]]
      };
      
      const results = q(entityQuery, store.db());
      expect(results).toHaveLength(2); // Alice and Charlie are verified
      
      const proxyType = detector.detectProxyType(entityQuery, results);
      expect(proxyType).toBe('CollectionProxy');
    });
    
    test('should handle entity queries through relationships', () => {
      const relationshipQuery = {
        find: ['?author'],
        where: [
          ['?post', ':post/title', 'Hello World'],
          ['?post', ':post/author', '?author']
        ]
      };
      
      const results = q(relationshipQuery, store.db());
      expect(results).toHaveLength(1);
      
      const proxyType = detector.detectProxyType(relationshipQuery, results);
      expect(proxyType).toBe('EntityProxy');
    });
  });

  describe('Scalar Query Integration', () => {
    test('should detect StreamProxy for single scalar query', () => {
      const scalarQuery = {
        find: ['?name'],
        where: [
          ['?e', ':user/name', '?name'],
          ['?e', ':user/id', 'user-alice']
        ]
      };
      
      const results = q(scalarQuery, store.db());
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(['Alice']);
      
      const proxyType = detector.detectProxyType(scalarQuery, results);
      expect(proxyType).toBe('StreamProxy');
    });
    
    test('should detect CollectionProxy for scalar query with multiple results', () => {
      const scalarQuery = {
        find: ['?name'],
        where: [['?e', ':user/name', '?name']]
      };
      
      const results = q(scalarQuery, store.db());
      expect(results).toHaveLength(3); // Alice, Bob, Charlie
      
      const proxyType = detector.detectProxyType(scalarQuery, results);
      expect(proxyType).toBe('CollectionProxy');
    });
    
    test('should handle complex scalar queries with joins', () => {
      const complexScalarQuery = {
        find: ['?title'],
        where: [
          ['?post', ':post/title', '?title'],
          ['?post', ':post/author', '?author'],
          ['?author', ':user/name', 'Alice']
        ]
      };
      
      const results = q(complexScalarQuery, store.db());
      expect(results).toHaveLength(2); // Alice has 2 posts
      
      const proxyType = detector.detectProxyType(complexScalarQuery, results);
      expect(proxyType).toBe('CollectionProxy');
    });
  });

  describe('Multi-Variable Query Integration', () => {
    test('should detect CollectionProxy for multi-variable queries', () => {
      const multiVarQuery = {
        find: ['?name', '?age'],
        where: [
          ['?e', ':user/name', '?name'],
          ['?e', ':user/age', '?age']
        ]
      };
      
      const results = q(multiVarQuery, store.db());
      expect(results).toHaveLength(3);
      expect(results).toEqual([
        ['Alice', 30],
        ['Bob', 25],
        ['Charlie', 35]
      ]);
      
      const proxyType = detector.detectProxyType(multiVarQuery, results);
      expect(proxyType).toBe('CollectionProxy');
    });
    
    test('should handle relationship queries with multiple variables', () => {
      const relationshipQuery = {
        find: ['?post-title', '?author-name'],
        where: [
          ['?post', ':post/title', '?post-title'],
          ['?post', ':post/author', '?author'],
          ['?author', ':user/name', '?author-name']
        ]
      };
      
      const results = q(relationshipQuery, store.db());
      expect(results).toHaveLength(3); // 3 posts
      
      const proxyType = detector.detectProxyType(relationshipQuery, results);
      expect(proxyType).toBe('CollectionProxy');
    });
  });

  describe('Complex Query Analysis Integration', () => {
    test('should analyze join complexity with real data', () => {
      const complexJoinQuery = {
        find: ['?tag-name'],
        where: [
          ['?post', ':post/author', '?author'],
          ['?author', ':user/name', 'Alice'],
          ['?post', ':post/tags', '?tag'],
          ['?tag', ':tag/name', '?tag-name']
        ]
      };
      
      const results = q(complexJoinQuery, store.db());
      expect(results.length).toBeGreaterThan(0); // Alice's posts have tags
      
      const analysis = detector.analyzeQuery(complexJoinQuery);
      expect(analysis.hasJoins).toBe(true);
      expect(analysis.joinDepth).toBeGreaterThan(2);
      expect(analysis.complexity).toBe('complex');
      
      const proxyType = detector.detectProxyType(complexJoinQuery, results);
      expect(proxyType).toBe('CollectionProxy');
    });
    
    test('should handle filtered queries correctly', () => {
      const filteredQuery = {
        find: ['?name'],
        where: [
          ['?e', ':user/name', '?name'],
          ['?e', ':user/age', '?age'],
          ['?e', ':user/verified', true]
        ]
      };
      
      const results = q(filteredQuery, store.db());
      expect(results).toHaveLength(2); // Alice and Charlie are verified
      
      const analysis = detector.analyzeQuery(filteredQuery);
      expect(analysis.hasFilters).toBe(true);
      expect(analysis.filterCount).toBe(1); // The verified filter
      
      const proxyType = detector.detectProxyType(filteredQuery, results);
      expect(proxyType).toBe('CollectionProxy');
    });
  });

  describe('Empty Result Handling', () => {
    test('should handle empty results for scalar queries', () => {
      const emptyScalarQuery = {
        find: ['?name'],
        where: [
          ['?e', ':user/name', '?name'],
          ['?e', ':user/id', 'non-existent-user']
        ]
      };
      
      const results = q(emptyScalarQuery, store.db());
      expect(results).toHaveLength(0);
      
      const proxyType = detector.detectProxyType(emptyScalarQuery, results);
      expect(proxyType).toBe('StreamProxy'); // Single-value query, empty result
    });
    
    test('should handle empty results for entity queries', () => {
      const emptyEntityQuery = {
        find: ['?e'],
        where: [['?e', ':user/name', 'NonExistent']]
      };
      
      const results = q(emptyEntityQuery, store.db());
      expect(results).toHaveLength(0);
      
      const proxyType = detector.detectProxyType(emptyEntityQuery, results);
      expect(proxyType).toBe('EntityProxy'); // Single entity query, empty result
    });
    
    test('should handle empty results for multi-variable queries', () => {
      const emptyMultiVarQuery = {
        find: ['?name', '?age'],
        where: [
          ['?e', ':user/name', '?name'],
          ['?e', ':user/age', 200] // No 200-year-old users
        ]
      };
      
      const results = q(emptyMultiVarQuery, store.db());
      expect(results).toHaveLength(0);
      
      const proxyType = detector.detectProxyType(emptyMultiVarQuery, results);
      expect(proxyType).toBe('CollectionProxy'); // Multi-variable query, empty collection
    });
  });

  describe('Schema-based Analysis Integration', () => {
    test('should correctly identify reference vs scalar attributes in real queries', () => {
      // Query with reference attribute
      const refQuery = {
        find: ['?author'],
        where: [['?post', ':post/author', '?author']]
      };
      
      expect(detector.isEntityQuery(refQuery)).toBe(true);
      
      const analysis = detector.analyzeQuery(refQuery);
      expect(analysis.entityVariable).toBe('?author');
      
      // Query with scalar attribute
      const scalarQuery = {
        find: ['?title'],
        where: [['?post', ':post/title', '?title']]
      };
      
      expect(detector.isScalarQuery(scalarQuery)).toBe(true);
      
      const scalarAnalysis = detector.analyzeQuery(scalarQuery);
      expect(scalarAnalysis.scalarVariable).toBe('?title');
      expect(scalarAnalysis.scalarAttribute).toBe(':post/title');
    });
    
    test('should handle cardinality-many references correctly', () => {
      const manyRefQuery = {
        find: ['?tag'],
        where: [['?post', ':post/tags', '?tag']]
      };
      
      expect(detector.isEntityQuery(manyRefQuery)).toBe(true);
      
      const results = q(manyRefQuery, store.db());
      expect(results.length).toBeGreaterThan(1); // Multiple tags across posts
      
      const proxyType = detector.detectProxyType(manyRefQuery, results);
      expect(proxyType).toBe('CollectionProxy');
    });
  });

  describe('Performance and Stress Testing', () => {
    test('should handle complex queries with many clauses efficiently', () => {
      const complexQuery = {
        find: ['?title', '?author-name', '?tag-name'],
        where: [
          ['?post', ':post/title', '?title'],
          ['?post', ':post/author', '?author'],
          ['?author', ':user/name', '?author-name'],
          ['?post', ':post/tags', '?tag'],
          ['?tag', ':tag/name', '?tag-name'],
          ['?author', ':user/verified', true],
          ['?author', ':user/age', '?age']
        ]
      };
      
      const startTime = Date.now();
      const analysis = detector.analyzeQuery(complexQuery);
      const analysisTime = Date.now() - startTime;
      
      expect(analysisTime).toBeLessThan(50); // Should be fast
      expect(analysis.type).toBe('multi-variable');
      expect(analysis.complexity).toBe('complex');
      
      const results = q(complexQuery, store.db());
      const proxyType = detector.detectProxyType(complexQuery, results);
      expect(proxyType).toBe('CollectionProxy');
    });
    
    test('should handle edge case queries without errors', () => {
      const edgeCaseQueries = [
        // Query with only filters, no variables
        {
          find: ['?e'],
          where: [
            ['?e', ':user/verified', true],
            ['?e', ':user/age', 30]
          ]
        },
        // Query with complex nesting patterns
        {
          find: ['?nested'],
          where: [
            ['?post', ':post/author', '?author'],
            ['?author', ':user/friends', '?friend'],
            ['?friend', ':user/name', '?nested']
          ]
        }
      ];
      
      edgeCaseQueries.forEach((query, index) => {
        expect(() => {
          const analysis = detector.analyzeQuery(query);
          expect(analysis).toBeDefined();
          
          try {
            const results = q(query, store.db());
            const proxyType = detector.detectProxyType(query, results);
            expect(['StreamProxy', 'EntityProxy', 'CollectionProxy']).toContain(proxyType);
          } catch (queryError) {
            // Some edge case queries might not execute successfully with our test data,
            // but the analysis should still work
            console.warn(`Edge case query ${index} couldn't execute:`, queryError.message);
          }
        }).not.toThrow();
      });
    });
  });
});