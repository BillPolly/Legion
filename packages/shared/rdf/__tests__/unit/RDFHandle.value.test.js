/**
 * Unit tests for RDFHandle.value() method
 * 
 * Tests entity value retrieval functionality:
 * - Basic entity value retrieval
 * - Non-existent entity handling
 * - Type preservation
 * - Multi-valued properties
 * - Reference properties
 * - Error handling
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { RDFHandle } from '../../src/RDFHandle.js';
import { SimpleTripleStore } from '../../src/SimpleTripleStore.js';
import { NamespaceManager } from '../../src/NamespaceManager.js';

// Mock DataSource for testing Handle in isolation
class MockDataSource {
  constructor() {
    this.entities = new Map();
    this.subscriptions = [];
    this.queryResults = [];
    this.schema = {};
  }

  // Set entity data for testing
  setEntity(entityId, entity) {
    this.entities.set(entityId, entity);
  }

  // Set schema for testing
  setSchema(schema) {
    this.schema = schema;
  }

  // Set query results for testing
  setQueryResults(results) {
    this.queryResults = results;
    
    // Notify all subscribers of data change
    this._notifySubscribers(results);
  }
  
  // Notify subscribers of data changes
  _notifySubscribers(changes) {
    for (const subscription of this.subscriptions) {
      try {
        // Invoke callback synchronously to simulate data change notification
        subscription.callback(changes);
      } catch (error) {
        // Continue even if callback fails
        console.warn('Subscription callback failed:', error);
      }
    }
  }

  // Mock DataSource.query() implementation
  query(querySpec) {
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
    if (!querySpec) {
      throw new Error('Query spec is required');
    }

    if (!callback || typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }

    const subscription = {
      id: Date.now() + Math.random(),
      querySpec,
      callback,
      unsubscribe: () => {
        const index = this.subscriptions.findIndex(s => s.id === subscription.id);
        if (index >= 0) {
          this.subscriptions.splice(index, 1);
        }
      }
    };

    this.subscriptions.push(subscription);

    return subscription;
  }

  // Mock DataSource.getSchema() implementation
  getSchema() {
    return this.schema;
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

describe('RDFHandle.value()', () => {
  let mockDataSource;
  let handle;

  beforeEach(() => {
    mockDataSource = new MockDataSource();
  });

  describe('Constructor validation', () => {
    it('should throw if dataSource is missing', () => {
      expect(() => {
        new RDFHandle(null, 'http://example.org/entity');
      }).toThrow('DataSource must be a non-null object');
    });

    it('should throw if entityId is missing', () => {
      expect(() => {
        new RDFHandle(mockDataSource, null);
      }).toThrow('Entity ID is required');
    });

    it('should throw if entityId is not a string', () => {
      expect(() => {
        new RDFHandle(mockDataSource, 123);
      }).toThrow('Entity ID must be a string');
    });

    it('should create instance with valid parameters', () => {
      const handle = new RDFHandle(mockDataSource, 'http://example.org/entity');
      expect(handle).toBeInstanceOf(RDFHandle);
      expect(handle.entityId).toBe('http://example.org/entity');
    });
  });

  describe('Basic entity value retrieval', () => {
    beforeEach(() => {
      handle = new RDFHandle(mockDataSource, 'http://example.org/alice');
    });

    it('should retrieve simple entity with string properties', () => {
      const entity = {
        type: 'foaf:Person',
        name: 'Alice Smith',
        email: 'alice@example.com'
      };

      mockDataSource.setQueryResults([{
        s: 'http://example.org/alice',
        p: 'type',
        o: 'foaf:Person'
      }, {
        s: 'http://example.org/alice',
        p: 'name',
        o: 'Alice Smith'
      }, {
        s: 'http://example.org/alice',
        p: 'email',
        o: 'alice@example.com'
      }]);

      const result = handle.value();
      expect(result).toEqual({
        type: 'foaf:Person',
        name: 'Alice Smith',
        email: 'alice@example.com'
      });
    });

    it('should retrieve entity with number properties', () => {
      mockDataSource.setQueryResults([{
        s: 'http://example.org/alice',
        p: 'type',
        o: 'foaf:Person'
      }, {
        s: 'http://example.org/alice',
        p: 'age',
        o: 30
      }, {
        s: 'http://example.org/alice',
        p: 'score',
        o: 95.5
      }]);

      const result = handle.value();
      expect(result).toEqual({
        type: 'foaf:Person',
        age: 30,
        score: 95.5
      });
      expect(typeof result.age).toBe('number');
      expect(typeof result.score).toBe('number');
    });

    it('should retrieve entity with boolean properties', () => {
      mockDataSource.setQueryResults([{
        s: 'http://example.org/alice',
        p: 'type',
        o: 'foaf:Person'
      }, {
        s: 'http://example.org/alice',
        p: 'active',
        o: true
      }, {
        s: 'http://example.org/alice',
        p: 'verified',
        o: false
      }]);

      const result = handle.value();
      expect(result).toEqual({
        type: 'foaf:Person',
        active: true,
        verified: false
      });
      expect(typeof result.active).toBe('boolean');
      expect(typeof result.verified).toBe('boolean');
    });

    it('should retrieve entity with Date properties', () => {
      const testDate = new Date('2024-01-15T10:30:00Z');
      
      mockDataSource.setQueryResults([{
        s: 'http://example.org/alice',
        p: 'type',
        o: 'foaf:Person'
      }, {
        s: 'http://example.org/alice',
        p: 'birthDate',
        o: testDate
      }]);

      const result = handle.value();
      expect(result).toEqual({
        type: 'foaf:Person',
        birthDate: testDate
      });
      expect(result.birthDate).toBeInstanceOf(Date);
    });
  });

  describe('Multi-valued properties', () => {
    beforeEach(() => {
      handle = new RDFHandle(mockDataSource, 'http://example.org/alice');
    });

    it('should handle single-valued properties as non-arrays', () => {
      mockDataSource.setQueryResults([{
        s: 'http://example.org/alice',
        p: 'type',
        o: 'foaf:Person'
      }, {
        s: 'http://example.org/alice',
        p: 'name',
        o: 'Alice Smith'
      }]);

      const result = handle.value();
      expect(result.name).toBe('Alice Smith');
      expect(Array.isArray(result.name)).toBe(false);
    });

    it('should handle multi-valued properties as arrays', () => {
      mockDataSource.setQueryResults([{
        s: 'http://example.org/alice',
        p: 'type',
        o: 'foaf:Person'
      }, {
        s: 'http://example.org/alice',
        p: 'hobby',
        o: 'reading'
      }, {
        s: 'http://example.org/alice',
        p: 'hobby',
        o: 'hiking'
      }, {
        s: 'http://example.org/alice',
        p: 'hobby',
        o: 'cooking'
      }]);

      const result = handle.value();
      expect(result.hobby).toEqual(['reading', 'hiking', 'cooking']);
      expect(Array.isArray(result.hobby)).toBe(true);
    });

    it('should handle mixed single and multi-valued properties', () => {
      mockDataSource.setQueryResults([{
        s: 'http://example.org/alice',
        p: 'type',
        o: 'foaf:Person'
      }, {
        s: 'http://example.org/alice',
        p: 'name',
        o: 'Alice Smith'
      }, {
        s: 'http://example.org/alice',
        p: 'email',
        o: 'alice@example.com'
      }, {
        s: 'http://example.org/alice',
        p: 'email',
        o: 'alice.smith@work.com'
      }]);

      const result = handle.value();
      expect(result.name).toBe('Alice Smith');
      expect(result.email).toEqual(['alice@example.com', 'alice.smith@work.com']);
      expect(Array.isArray(result.name)).toBe(false);
      expect(Array.isArray(result.email)).toBe(true);
    });
  });

  describe('Reference properties', () => {
    beforeEach(() => {
      handle = new RDFHandle(mockDataSource, 'http://example.org/alice');
    });

    it('should handle single entity reference', () => {
      mockDataSource.setQueryResults([{
        s: 'http://example.org/alice',
        p: 'type',
        o: 'foaf:Person'
      }, {
        s: 'http://example.org/alice',
        p: 'manager',
        o: 'http://example.org/bob'
      }]);

      const result = handle.value();
      expect(result.manager).toBe('http://example.org/bob');
    });

    it('should handle multiple entity references', () => {
      mockDataSource.setQueryResults([{
        s: 'http://example.org/alice',
        p: 'type',
        o: 'foaf:Person'
      }, {
        s: 'http://example.org/alice',
        p: 'knows',
        o: 'http://example.org/bob'
      }, {
        s: 'http://example.org/alice',
        p: 'knows',
        o: 'http://example.org/charlie'
      }]);

      const result = handle.value();
      expect(result.knows).toEqual([
        'http://example.org/bob',
        'http://example.org/charlie'
      ]);
    });

    it('should handle mixed literal and reference properties', () => {
      mockDataSource.setQueryResults([{
        s: 'http://example.org/alice',
        p: 'type',
        o: 'foaf:Person'
      }, {
        s: 'http://example.org/alice',
        p: 'name',
        o: 'Alice Smith'
      }, {
        s: 'http://example.org/alice',
        p: 'manager',
        o: 'http://example.org/bob'
      }, {
        s: 'http://example.org/alice',
        p: 'knows',
        o: 'http://example.org/charlie'
      }]);

      const result = handle.value();
      expect(result).toEqual({
        type: 'foaf:Person',
        name: 'Alice Smith',
        manager: 'http://example.org/bob',
        knows: 'http://example.org/charlie'
      });
    });
  });

  describe('Non-existent entity handling', () => {
    beforeEach(() => {
      handle = new RDFHandle(mockDataSource, 'http://example.org/nonexistent');
    });

    it('should return null for non-existent entity', () => {
      mockDataSource.setQueryResults([]);

      const result = handle.value();
      expect(result).toBeNull();
    });

    it('should return null for entity with no properties', () => {
      // Entity exists but has no properties (type triple only)
      mockDataSource.setQueryResults([]);

      const result = handle.value();
      expect(result).toBeNull();
    });
  });

  describe('Error handling', () => {
    beforeEach(() => {
      handle = new RDFHandle(mockDataSource, 'http://example.org/alice');
    });

    it('should throw if handle is destroyed', () => {
      handle.destroy();

      expect(() => {
        handle.value();
      }).toThrow('Handle has been destroyed');
    });

    it('should propagate DataSource query errors', () => {
      // Mock DataSource to throw an error
      mockDataSource.query = () => {
        throw new Error('Database connection failed');
      };

      expect(() => {
        handle.value();
      }).toThrow('Database connection failed');
    });

    it('should handle malformed query results gracefully', () => {
      // Mock malformed results (missing required fields)
      // Results should have 'p' and 'o' properties from find: ['?p', '?o']
      mockDataSource.setQueryResults([
        { p: 'name' }, // Missing 'o' property
        { o: 'Alice' }, // Missing 'p' property  
        { x: 'invalid', y: 'result' } // Completely wrong properties
      ]);

      // Should not throw, should ignore malformed results
      const result = handle.value();
      expect(result).toBeNull();
    });
  });

  describe('Complex entity scenarios', () => {
    beforeEach(() => {
      handle = new RDFHandle(mockDataSource, 'http://example.org/alice');
    });

    it('should handle entity with all property types', () => {
      const testDate = new Date('2024-01-15T10:30:00Z');
      
      mockDataSource.setQueryResults([{
        s: 'http://example.org/alice',
        p: 'type',
        o: 'foaf:Person'
      }, {
        s: 'http://example.org/alice',
        p: 'name',
        o: 'Alice Smith'
      }, {
        s: 'http://example.org/alice',
        p: 'age',
        o: 30
      }, {
        s: 'http://example.org/alice',
        p: 'score',
        o: 95.5
      }, {
        s: 'http://example.org/alice',
        p: 'active',
        o: true
      }, {
        s: 'http://example.org/alice',
        p: 'birthDate',
        o: testDate
      }, {
        s: 'http://example.org/alice',
        p: 'manager',
        o: 'http://example.org/bob'
      }, {
        s: 'http://example.org/alice',
        p: 'hobby',
        o: 'reading'
      }, {
        s: 'http://example.org/alice',
        p: 'hobby',
        o: 'hiking'
      }]);

      const result = handle.value();
      expect(result).toEqual({
        type: 'foaf:Person',
        name: 'Alice Smith',
        age: 30,
        score: 95.5,
        active: true,
        birthDate: testDate,
        manager: 'http://example.org/bob',
        hobby: ['reading', 'hiking']
      });

      // Verify types
      expect(typeof result.name).toBe('string');
      expect(typeof result.age).toBe('number');
      expect(typeof result.score).toBe('number');
      expect(typeof result.active).toBe('boolean');
      expect(result.birthDate).toBeInstanceOf(Date);
      expect(typeof result.manager).toBe('string');
      expect(Array.isArray(result.hobby)).toBe(true);
    });

    it('should handle entity with long property names', () => {
      mockDataSource.setQueryResults([{
        s: 'http://example.org/alice',
        p: 'type',
        o: 'foaf:Person'
      }, {
        s: 'http://example.org/alice',
        p: 'http://example.org/ontology#hasVeryLongPropertyNameThatTestsHandling',
        o: 'test value'
      }]);

      const result = handle.value();
      expect(result).toEqual({
        type: 'foaf:Person',
        'http://example.org/ontology#hasVeryLongPropertyNameThatTestsHandling': 'test value'
      });
    });

    it('should handle entity with special characters in values', () => {
      mockDataSource.setQueryResults([{
        s: 'http://example.org/alice',
        p: 'type',
        o: 'foaf:Person'
      }, {
        s: 'http://example.org/alice',
        p: 'name',
        o: 'Alice "Smith" & Bob'
      }, {
        s: 'http://example.org/alice',
        p: 'bio',
        o: 'Line 1\nLine 2\tTabbed'
      }]);

      const result = handle.value();
      expect(result).toEqual({
        type: 'foaf:Person',
        name: 'Alice "Smith" & Bob',
        bio: 'Line 1\nLine 2\tTabbed'
      });
    });
  });

  describe('Caching behavior', () => {
    beforeEach(() => {
      handle = new RDFHandle(mockDataSource, 'http://example.org/alice');
    });

    it('should return same object reference for repeated calls', () => {
      mockDataSource.setQueryResults([{
        s: 'http://example.org/alice',
        p: 'type',
        o: 'foaf:Person'
      }, {
        s: 'http://example.org/alice',
        p: 'name',
        o: 'Alice Smith'
      }]);

      const result1 = handle.value();
      const result2 = handle.value();
      
      expect(result1).toBe(result2);
    });

    it('should refresh cache when data changes', () => {
      // Initial data
      mockDataSource.setQueryResults([{
        s: 'http://example.org/alice',
        p: 'type',
        o: 'foaf:Person'
      }, {
        s: 'http://example.org/alice',
        p: 'name',
        o: 'Alice Smith'
      }]);

      // Set up subscription to enable cache invalidation
      const subscription = handle.subscribe({
        find: ['?p', '?o'],
        where: [['http://example.org/alice', '?p', '?o']]
      }, () => {
        // Subscription callback - cache invalidation happens automatically
      });

      const result1 = handle.value();
      expect(result1.name).toBe('Alice Smith');

      // Simulate data change
      mockDataSource.setQueryResults([{
        s: 'http://example.org/alice',
        p: 'type',
        o: 'foaf:Person'
      }, {
        s: 'http://example.org/alice',
        p: 'name',
        o: 'Alice Johnson'
      }]);

      // Cache should be invalidated - new value() call should see changes
      const result2 = handle.value();
      expect(result2.name).toBe('Alice Johnson');
      expect(result1).not.toBe(result2);
      
      // Clean up subscription
      subscription.unsubscribe();
    });
  });
});