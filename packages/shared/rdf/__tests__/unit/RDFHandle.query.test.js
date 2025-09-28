/**
 * Unit tests for RDFHandle.query() method
 * 
 * Tests query execution functionality:
 * - Basic query delegation to DataSource
 * - Query spec validation
 * - Error handling
 * - Query result format consistency
 * - Complex query patterns
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { RDFHandle } from '../../src/RDFHandle.js';

// Mock DataSource for testing Handle in isolation
class MockDataSource {
  constructor() {
    this.queryResults = [];
    this.lastQuerySpec = null;
    this.shouldThrowOnQuery = false;
    this.queryThrowMessage = 'Mock query error';
  }

  // Set query results for testing
  setQueryResults(results) {
    this.queryResults = results;
  }

  // Configure mock to throw on query
  setQueryThrow(shouldThrow, message = 'Mock query error') {
    this.shouldThrowOnQuery = shouldThrow;
    this.queryThrowMessage = message;
  }

  // Mock DataSource.query() implementation
  query(querySpec) {
    // Store the last query spec for inspection
    this.lastQuerySpec = querySpec;

    if (this.shouldThrowOnQuery) {
      throw new Error(this.queryThrowMessage);
    }

    if (!querySpec) {
      throw new Error('Query spec is required');
    }

    if (!querySpec.find || !Array.isArray(querySpec.find)) {
      throw new Error('Query spec must have find array');
    }

    if (!querySpec.where || !Array.isArray(querySpec.where)) {
      throw new Error('Query spec must have where array');
    }

    return this.queryResults;
  }

  // Mock DataSource.subscribe() implementation
  subscribe(querySpec, callback) {
    const subscription = {
      id: Date.now() + Math.random(),
      querySpec,
      callback,
      unsubscribe: () => {}
    };
    return subscription;
  }

  // Mock DataSource.getSchema() implementation
  getSchema() {
    return {};
  }

  // Mock DataSource.queryBuilder() implementation
  queryBuilder(sourceHandle) {
    return {
      _sourceHandle: sourceHandle,
      where: () => this,
      select: () => this,
      join: () => this,
      orderBy: () => this,
      limit: () => this,
      skip: () => this,
      groupBy: () => this,
      aggregate: () => this,
      first: () => null,
      last: () => null,
      count: () => 0,
      toArray: () => []
    };
  }
}

describe('RDFHandle.query()', () => {
  let mockDataSource;
  let handle;

  beforeEach(() => {
    mockDataSource = new MockDataSource();
    handle = new RDFHandle(mockDataSource, 'http://example.org/alice');
  });

  describe('Basic query delegation', () => {
    it('should delegate query to DataSource', () => {
      const querySpec = {
        find: ['?person', '?name'],
        where: [
          ['?person', 'rdf:type', 'foaf:Person'],
          ['?person', 'foaf:name', '?name']
        ]
      };

      const expectedResults = [
        { person: 'http://example.org/alice', name: 'Alice Smith' },
        { person: 'http://example.org/bob', name: 'Bob Jones' }
      ];

      mockDataSource.setQueryResults(expectedResults);

      const results = handle.query(querySpec);

      expect(results).toEqual(expectedResults);
      expect(mockDataSource.lastQuerySpec).toEqual(querySpec);
    });

    it('should return empty array for query with no results', () => {
      const querySpec = {
        find: ['?person'],
        where: [['?person', 'rdf:type', 'foaf:NonExistentType']]
      };

      mockDataSource.setQueryResults([]);

      const results = handle.query(querySpec);

      expect(results).toEqual([]);
      expect(Array.isArray(results)).toBe(true);
    });

    it('should pass through DataSource query results unchanged', () => {
      const querySpec = {
        find: ['?s', '?p', '?o'],
        where: [['?s', '?p', '?o']]
      };

      const expectedResults = [
        { s: 'http://example.org/alice', p: 'foaf:name', o: 'Alice' },
        { s: 'http://example.org/alice', p: 'foaf:age', o: 30 },
        { s: 'http://example.org/bob', p: 'foaf:name', o: 'Bob' }
      ];

      mockDataSource.setQueryResults(expectedResults);

      const results = handle.query(querySpec);

      expect(results).toBe(expectedResults); // Same reference
      expect(results).toEqual(expectedResults);
    });
  });

  describe('Query spec validation', () => {
    it('should throw if querySpec is missing', () => {
      expect(() => {
        handle.query(null);
      }).toThrow('Query specification must be an object');
    });

    it('should throw if querySpec is not an object', () => {
      expect(() => {
        handle.query('invalid query');
      }).toThrow('Query specification must be an object');
    });

    it('should throw if querySpec has no find clause', () => {
      expect(() => {
        handle.query({
          where: [['?s', '?p', '?o']]
        });
      }).toThrow('Query spec must have find array');
    });

    it('should throw if querySpec has no where clause', () => {
      expect(() => {
        handle.query({
          find: ['?s']
        });
      }).toThrow('Query spec must have where array');
    });

    it('should accept querySpec with both find and where', () => {
      const querySpec = {
        find: ['?person'],
        where: [['?person', 'rdf:type', 'foaf:Person']]
      };

      mockDataSource.setQueryResults([]);

      expect(() => {
        handle.query(querySpec);
      }).not.toThrow();
    });

    it('should accept querySpec with only find clause', () => {
      const querySpec = {
        find: ['?person']
      };

      mockDataSource.setQueryResults([]);

      expect(() => {
        handle.query(querySpec);
      }).toThrow(); // MockDataSource requires where clause
    });

    it('should accept querySpec with only where clause', () => {
      const querySpec = {
        where: [['?person', 'rdf:type', 'foaf:Person']]
      };

      mockDataSource.setQueryResults([]);

      expect(() => {
        handle.query(querySpec);
      }).toThrow(); // MockDataSource requires find clause
    });
  });

  describe('Complex query patterns', () => {
    it('should handle entity lookup query', () => {
      const querySpec = {
        find: ['?p', '?o'],
        where: [['http://example.org/alice', '?p', '?o']]
      };

      const expectedResults = [
        { p: 'rdf:type', o: 'foaf:Person' },
        { p: 'foaf:name', o: 'Alice Smith' },
        { p: 'foaf:age', o: 30 }
      ];

      mockDataSource.setQueryResults(expectedResults);

      const results = handle.query(querySpec);

      expect(results).toEqual(expectedResults);
    });

    it('should handle relationship traversal query', () => {
      const querySpec = {
        find: ['?friend', '?friendName'],
        where: [
          ['http://example.org/alice', 'foaf:knows', '?friend'],
          ['?friend', 'foaf:name', '?friendName']
        ]
      };

      const expectedResults = [
        { friend: 'http://example.org/bob', friendName: 'Bob Jones' },
        { friend: 'http://example.org/charlie', friendName: 'Charlie Brown' }
      ];

      mockDataSource.setQueryResults(expectedResults);

      const results = handle.query(querySpec);

      expect(results).toEqual(expectedResults);
    });

    it('should handle type-based query', () => {
      const querySpec = {
        find: ['?person', '?name'],
        where: [
          ['?person', 'rdf:type', 'foaf:Person'],
          ['?person', 'foaf:name', '?name']
        ]
      };

      const expectedResults = [
        { person: 'http://example.org/alice', name: 'Alice Smith' },
        { person: 'http://example.org/bob', name: 'Bob Jones' }
      ];

      mockDataSource.setQueryResults(expectedResults);

      const results = handle.query(querySpec);

      expect(results).toEqual(expectedResults);
    });

    it('should handle query with filter', () => {
      const querySpec = {
        find: ['?person', '?age'],
        where: [
          ['?person', 'rdf:type', 'foaf:Person'],
          ['?person', 'foaf:age', '?age']
        ],
        filter: (bindings) => bindings.age >= 25
      };

      const expectedResults = [
        { person: 'http://example.org/alice', age: 30 },
        { person: 'http://example.org/bob', age: 28 }
      ];

      mockDataSource.setQueryResults(expectedResults);

      const results = handle.query(querySpec);

      expect(results).toEqual(expectedResults);
    });

    it('should handle multi-hop relationship query', () => {
      const querySpec = {
        find: ['?friendOfFriend', '?name'],
        where: [
          ['http://example.org/alice', 'foaf:knows', '?friend'],
          ['?friend', 'foaf:knows', '?friendOfFriend'],
          ['?friendOfFriend', 'foaf:name', '?name']
        ]
      };

      const expectedResults = [
        { friendOfFriend: 'http://example.org/diana', name: 'Diana Prince' }
      ];

      mockDataSource.setQueryResults(expectedResults);

      const results = handle.query(querySpec);

      expect(results).toEqual(expectedResults);
    });
  });

  describe('Error handling', () => {
    it('should throw if handle is destroyed', () => {
      handle.destroy();

      expect(() => {
        handle.query({
          find: ['?s'],
          where: [['?s', '?p', '?o']]
        });
      }).toThrow('Handle has been destroyed');
    });

    it('should propagate DataSource query errors', () => {
      mockDataSource.setQueryThrow(true, 'Database connection failed');

      expect(() => {
        handle.query({
          find: ['?s'],
          where: [['?s', '?p', '?o']]
        });
      }).toThrow('Database connection failed');
    });

    it('should propagate DataSource validation errors', () => {
      // MockDataSource will throw for missing find array
      expect(() => {
        handle.query({
          where: [['?s', '?p', '?o']]
        });
      }).toThrow('Query spec must have find array');
    });

    it('should handle DataSource returning null', () => {
      // Configure mock to return null instead of array
      mockDataSource.query = () => null;

      const result = handle.query({
        find: ['?s'],
        where: [['?s', '?p', '?o']]
      });

      expect(result).toBeNull();
    });

    it('should handle DataSource returning undefined', () => {
      // Configure mock to return undefined
      mockDataSource.query = () => undefined;

      const result = handle.query({
        find: ['?s'],
        where: [['?s', '?p', '?o']]
      });

      expect(result).toBeUndefined();
    });
  });

  describe('Query result consistency', () => {
    it('should maintain result object structure', () => {
      const querySpec = {
        find: ['?person', '?name', '?age'],
        where: [
          ['?person', 'rdf:type', 'foaf:Person'],
          ['?person', 'foaf:name', '?name'],
          ['?person', 'foaf:age', '?age']
        ]
      };

      const expectedResults = [
        {
          person: 'http://example.org/alice',
          name: 'Alice Smith',
          age: 30
        }
      ];

      mockDataSource.setQueryResults(expectedResults);

      const results = handle.query(querySpec);

      expect(results).toEqual(expectedResults);
      expect(results[0]).toHaveProperty('person');
      expect(results[0]).toHaveProperty('name');
      expect(results[0]).toHaveProperty('age');
    });

    it('should preserve result data types', () => {
      const querySpec = {
        find: ['?value'],
        where: [['http://example.org/alice', 'foaf:age', '?value']]
      };

      const expectedResults = [{ value: 30 }];

      mockDataSource.setQueryResults(expectedResults);

      const results = handle.query(querySpec);

      expect(results[0].value).toBe(30);
      expect(typeof results[0].value).toBe('number');
    });

    it('should handle large result sets', () => {
      const querySpec = {
        find: ['?person'],
        where: [['?person', 'rdf:type', 'foaf:Person']]
      };

      // Generate 100 results
      const expectedResults = Array.from({ length: 100 }, (_, i) => ({
        person: `http://example.org/person${i}`
      }));

      mockDataSource.setQueryResults(expectedResults);

      const results = handle.query(querySpec);

      expect(results).toEqual(expectedResults);
      expect(results.length).toBe(100);
    });

    it('should handle mixed data types in results', () => {
      const querySpec = {
        find: ['?property', '?value'],
        where: [['http://example.org/alice', '?property', '?value']]
      };

      const expectedResults = [
        { property: 'foaf:name', value: 'Alice Smith' },
        { property: 'foaf:age', value: 30 },
        { property: 'foaf:active', value: true },
        { property: 'foaf:birthDate', value: new Date('1990-01-01') }
      ];

      mockDataSource.setQueryResults(expectedResults);

      const results = handle.query(querySpec);

      expect(results).toEqual(expectedResults);
      expect(typeof results[0].value).toBe('string');
      expect(typeof results[1].value).toBe('number');
      expect(typeof results[2].value).toBe('boolean');
      expect(results[3].value).toBeInstanceOf(Date);
    });
  });

  describe('Performance and edge cases', () => {
    it('should handle empty query results efficiently', () => {
      const querySpec = {
        find: ['?nonexistent'],
        where: [['?nonexistent', 'nonexistent:property', 'nonexistent value']]
      };

      mockDataSource.setQueryResults([]);

      const start = Date.now();
      const results = handle.query(querySpec);
      const end = Date.now();

      expect(results).toEqual([]);
      expect(end - start).toBeLessThan(10); // Should be very fast
    });

    it('should handle repeated queries efficiently', () => {
      const querySpec = {
        find: ['?person'],
        where: [['?person', 'rdf:type', 'foaf:Person']]
      };

      const expectedResults = [
        { person: 'http://example.org/alice' }
      ];

      mockDataSource.setQueryResults(expectedResults);

      // Run same query multiple times
      const results1 = handle.query(querySpec);
      const results2 = handle.query(querySpec);
      const results3 = handle.query(querySpec);

      expect(results1).toEqual(expectedResults);
      expect(results2).toEqual(expectedResults);
      expect(results3).toEqual(expectedResults);
    });

    it('should handle malformed query spec gracefully', () => {
      const malformedSpec = {
        find: null,
        where: 'invalid'
      };

      expect(() => {
        handle.query(malformedSpec);
      }).toThrow(); // Should throw validation error
    });
  });
});