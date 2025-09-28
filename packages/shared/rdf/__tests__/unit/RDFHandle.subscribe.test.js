/**
 * Unit tests for RDFHandle.subscribe() method
 * 
 * Tests subscription functionality:
 * - Basic subscription setup
 * - Query spec validation
 * - Callback validation
 * - Subscription cleanup
 * - Cache invalidation on changes
 * - Error handling
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { RDFHandle } from '../../src/RDFHandle.js';

// Mock DataSource for testing Handle in isolation
class MockDataSource {
  constructor() {
    this.subscriptions = [];
    this.queryResults = [];
    this.schema = {};
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

describe('RDFHandle.subscribe()', () => {
  let mockDataSource;
  let handle;

  beforeEach(() => {
    mockDataSource = new MockDataSource();
    handle = new RDFHandle(mockDataSource, 'http://example.org/alice');
  });

  describe('Basic subscription functionality', () => {
    it('should create subscription with valid parameters', () => {
      const querySpec = {
        find: ['?p', '?o'],
        where: [['http://example.org/alice', '?p', '?o']]
      };
      
      const callback = jest.fn();

      const subscription = handle.subscribe(querySpec, callback);

      expect(subscription).toBeDefined();
      expect(subscription.id).toBeDefined();
      expect(typeof subscription.unsubscribe).toBe('function');
    });

    it('should delegate to DataSource.subscribe()', () => {
      const querySpec = {
        find: ['?p', '?o'],
        where: [['http://example.org/alice', '?p', '?o']]
      };
      
      const callback = jest.fn();

      handle.subscribe(querySpec, callback);

      expect(mockDataSource.subscriptions.length).toBe(1);
      expect(mockDataSource.subscriptions[0].querySpec).toEqual(querySpec);
    });

    it('should wrap callback to invalidate cache', () => {
      const querySpec = {
        find: ['?p', '?o'],
        where: [['http://example.org/alice', '?p', '?o']]
      };
      
      const callback = jest.fn();

      // Set initial data and get cached value
      mockDataSource.setQueryResults([{
        s: 'http://example.org/alice',
        p: 'name',
        o: 'Alice Smith'
      }]);

      const value1 = handle.value();
      expect(value1.name).toBe('Alice Smith');

      // Subscribe to changes
      handle.subscribe(querySpec, callback);

      // Simulate data change
      mockDataSource.setQueryResults([{
        s: 'http://example.org/alice',
        p: 'name',
        o: 'Alice Johnson'
      }]);

      // Cache should be invalidated - new value() call should see changes
      const value2 = handle.value();
      expect(value2.name).toBe('Alice Johnson');
      expect(value1).not.toBe(value2); // Different object references
    });

    it('should invoke original callback with changes', () => {
      const querySpec = {
        find: ['?p', '?o'],
        where: [['http://example.org/alice', '?p', '?o']]
      };
      
      const callback = jest.fn();

      handle.subscribe(querySpec, callback);

      const changes = [{ s: 'http://example.org/alice', p: 'name', o: 'New Name' }];
      mockDataSource.setQueryResults(changes);

      expect(callback).toHaveBeenCalledWith(changes);
    });
  });

  describe('Subscription cleanup', () => {
    it('should support unsubscribe', () => {
      const querySpec = {
        find: ['?p', '?o'],
        where: [['http://example.org/alice', '?p', '?o']]
      };
      
      const callback = jest.fn();

      const subscription = handle.subscribe(querySpec, callback);
      expect(mockDataSource.subscriptions.length).toBe(1);

      subscription.unsubscribe();
      expect(mockDataSource.subscriptions.length).toBe(0);
    });

    it('should clean up subscriptions when handle is destroyed', () => {
      const querySpec = {
        find: ['?p', '?o'],
        where: [['http://example.org/alice', '?p', '?o']]
      };
      
      const callback = jest.fn();

      handle.subscribe(querySpec, callback);
      expect(mockDataSource.subscriptions.length).toBe(1);

      handle.destroy();
      expect(mockDataSource.subscriptions.length).toBe(0);
    });

    it('should handle multiple subscriptions', () => {
      const querySpec1 = {
        find: ['?p', '?o'],
        where: [['http://example.org/alice', '?p', '?o']]
      };
      
      const querySpec2 = {
        find: ['?friend'],
        where: [['http://example.org/alice', 'knows', '?friend']]
      };
      
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      const sub1 = handle.subscribe(querySpec1, callback1);
      const sub2 = handle.subscribe(querySpec2, callback2);

      expect(mockDataSource.subscriptions.length).toBe(2);

      sub1.unsubscribe();
      expect(mockDataSource.subscriptions.length).toBe(1);

      sub2.unsubscribe();
      expect(mockDataSource.subscriptions.length).toBe(0);
    });
  });

  describe('Input validation', () => {
    it('should throw if querySpec is missing', () => {
      const callback = jest.fn();

      expect(() => {
        handle.subscribe(null, callback);
      }).toThrow('Query specification must be an object');
    });

    it('should throw if querySpec is not an object', () => {
      const callback = jest.fn();

      expect(() => {
        handle.subscribe('invalid query', callback);
      }).toThrow('Query specification must be an object');
    });

    it('should throw if callback is missing', () => {
      const querySpec = {
        find: ['?p', '?o'],
        where: [['http://example.org/alice', '?p', '?o']]
      };

      expect(() => {
        handle.subscribe(querySpec, null);
      }).toThrow('Callback function is required');
    });

    it('should throw if callback is not a function', () => {
      const querySpec = {
        find: ['?p', '?o'],
        where: [['http://example.org/alice', '?p', '?o']]
      };

      expect(() => {
        handle.subscribe(querySpec, 'not a function');
      }).toThrow('Callback function is required');
    });

    it('should validate querySpec structure', () => {
      const callback = jest.fn();

      expect(() => {
        handle.subscribe({}, callback);
      }).toThrow('Query specification must have find or where clause');
    });
  });

  describe('Error handling', () => {
    it('should throw if handle is destroyed', () => {
      handle.destroy();

      const querySpec = {
        find: ['?p', '?o'],
        where: [['http://example.org/alice', '?p', '?o']]
      };
      
      const callback = jest.fn();

      expect(() => {
        handle.subscribe(querySpec, callback);
      }).toThrow('Handle has been destroyed');
    });

    it('should propagate DataSource subscription errors', () => {
      // Mock DataSource to throw an error
      mockDataSource.subscribe = () => {
        throw new Error('Subscription failed');
      };

      const querySpec = {
        find: ['?p', '?o'],
        where: [['http://example.org/alice', '?p', '?o']]
      };
      
      const callback = jest.fn();

      expect(() => {
        handle.subscribe(querySpec, callback);
      }).toThrow('Subscription failed');
    });

    it('should handle callback errors gracefully', () => {
      const querySpec = {
        find: ['?p', '?o'],
        where: [['http://example.org/alice', '?p', '?o']]
      };
      
      const callback = jest.fn(() => {
        throw new Error('Callback error');
      });

      // Should not throw when creating subscription
      const subscription = handle.subscribe(querySpec, callback);
      expect(subscription).toBeDefined();

      // Should not throw when triggering callback (error should be caught)
      expect(() => {
        mockDataSource.setQueryResults([{ s: 'test', p: 'test', o: 'test' }]);
      }).not.toThrow();

      expect(callback).toHaveBeenCalled();
    });
  });

  describe('Complex subscription scenarios', () => {
    it('should handle entity-specific subscriptions', () => {
      const querySpec = {
        find: ['?p', '?o'],
        where: [['http://example.org/alice', '?p', '?o']]
      };
      
      const callback = jest.fn();

      handle.subscribe(querySpec, callback);

      // Simulate changes to Alice
      const aliceChanges = [
        { s: 'http://example.org/alice', p: 'name', o: 'Alice Updated' }
      ];
      mockDataSource.setQueryResults(aliceChanges);

      expect(callback).toHaveBeenCalledWith(aliceChanges);
    });

    it('should handle query-based subscriptions', () => {
      const querySpec = {
        find: ['?person', '?name'],
        where: [
          ['?person', 'rdf:type', 'foaf:Person'],
          ['?person', 'foaf:name', '?name']
        ]
      };
      
      const callback = jest.fn();

      handle.subscribe(querySpec, callback);

      // Simulate query result changes
      const queryResults = [
        { person: 'http://example.org/alice', name: 'Alice Smith' },
        { person: 'http://example.org/bob', name: 'Bob Jones' }
      ];
      mockDataSource.setQueryResults(queryResults);

      expect(callback).toHaveBeenCalledWith(queryResults);
    });

    it('should maintain subscription state correctly', () => {
      const querySpec = {
        find: ['?p', '?o'],
        where: [['http://example.org/alice', '?p', '?o']]
      };
      
      const callback = jest.fn();

      const subscription = handle.subscribe(querySpec, callback);
      
      // Verify subscription tracking: Handle tracks the wrapper it creates, not the returned subscription
      expect(handle._subscriptions.size).toBe(1); // Handle tracks one wrapper internally
      expect(mockDataSource.subscriptions.length).toBe(1);

      // Trigger callback multiple times
      mockDataSource.setQueryResults([{ s: 'test1', p: 'test1', o: 'test1' }]);
      mockDataSource.setQueryResults([{ s: 'test2', p: 'test2', o: 'test2' }]);

      expect(callback).toHaveBeenCalledTimes(2);

      // Unsubscribe
      subscription.unsubscribe();
      expect(mockDataSource.subscriptions.length).toBe(0);

      // Should not receive further callbacks
      mockDataSource.setQueryResults([{ s: 'test3', p: 'test3', o: 'test3' }]);
      expect(callback).toHaveBeenCalledTimes(2); // Still 2, not 3
    });
  });
});