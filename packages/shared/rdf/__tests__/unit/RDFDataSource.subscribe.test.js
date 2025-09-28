/**
 * Unit tests for RDFDataSource.subscribe()
 * 
 * Tests subscription functionality:
 * - Subscription creation and setup
 * - Callback invocation on triple store changes
 * - Subscription cleanup and unsubscribe
 * - Multiple concurrent subscriptions
 * - Subscription with query filters
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { RDFDataSource } from '../../src/RDFDataSource.js';
import { NamespaceManager } from '../../src/NamespaceManager.js';
import { SimpleTripleStore } from '../../src/SimpleTripleStore.js';

describe('RDFDataSource.subscribe()', () => {
  let dataSource;
  let tripleStore;
  let namespaceManager;

  beforeEach(() => {
    tripleStore = new SimpleTripleStore();
    namespaceManager = new NamespaceManager();
    namespaceManager.addNamespace('ex', 'http://example.org/');
    
    dataSource = new RDFDataSource(tripleStore, namespaceManager);
  });

  describe('Subscription creation', () => {
    it('should create subscription with query spec and callback', () => {
      const callback = jest.fn();
      const querySpec = {
        find: ['?entity'],
        where: [['?entity', 'rdf:type', 'ex:Person']]
      };

      const subscription = dataSource.subscribe(querySpec, callback);

      expect(typeof subscription).toBe('object');
      expect(typeof subscription.unsubscribe).toBe('function');
      expect(callback).not.toHaveBeenCalled();
    });

    it('should throw if query spec is missing', () => {
      const callback = jest.fn();

      expect(() => {
        dataSource.subscribe(null, callback);
      }).toThrow('Query spec is required');
    });

    it('should throw if callback is missing', () => {
      const querySpec = {
        find: ['?entity'],
        where: [['?entity', 'rdf:type', 'ex:Person']]
      };

      expect(() => {
        dataSource.subscribe(querySpec, null);
      }).toThrow('Callback is required');
    });

    it('should throw if callback is not a function', () => {
      const querySpec = {
        find: ['?entity'],
        where: [['?entity', 'rdf:type', 'ex:Person']]
      };

      expect(() => {
        dataSource.subscribe(querySpec, 'not a function');
      }).toThrow('Callback must be a function');
    });

    it('should validate query spec structure', () => {
      const callback = jest.fn();

      expect(() => {
        dataSource.subscribe({ where: [] }, callback);
      }).toThrow('Query spec must have find array');

      expect(() => {
        dataSource.subscribe({ find: [] }, callback);
      }).toThrow('Query spec must have where array');
    });
  });

  describe('Callback invocation on changes', () => {
    it('should invoke callback when matching triple is added', () => {
      const callback = jest.fn();
      const querySpec = {
        find: ['?entity'],
        where: [['?entity', 'rdf:type', 'ex:Person']]
      };

      dataSource.subscribe(querySpec, callback);

      // Add matching triple
      tripleStore.add('ex:alice', 'rdf:type', 'ex:Person');

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith([
        { entity: 'ex:alice' }
      ]);
    });

    it('should not invoke callback when non-matching triple is added', () => {
      const callback = jest.fn();
      const querySpec = {
        find: ['?entity'],
        where: [['?entity', 'rdf:type', 'ex:Person']]
      };

      dataSource.subscribe(querySpec, callback);

      // Add non-matching triple
      tripleStore.add('ex:org1', 'rdf:type', 'ex:Organization');

      expect(callback).not.toHaveBeenCalled();
    });

    it('should invoke callback with all current matches on change', () => {
      // Add initial data
      tripleStore.add('ex:alice', 'rdf:type', 'ex:Person');

      const callback = jest.fn();
      const querySpec = {
        find: ['?entity'],
        where: [['?entity', 'rdf:type', 'ex:Person']]
      };

      dataSource.subscribe(querySpec, callback);

      // Add another matching triple
      tripleStore.add('ex:bob', 'rdf:type', 'ex:Person');

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.arrayContaining([
          { entity: 'ex:alice' },
          { entity: 'ex:bob' }
        ])
      );
    });

    it('should invoke callback when matching triple is removed', () => {
      tripleStore.add('ex:alice', 'rdf:type', 'ex:Person');
      tripleStore.add('ex:bob', 'rdf:type', 'ex:Person');

      const callback = jest.fn();
      const querySpec = {
        find: ['?entity'],
        where: [['?entity', 'rdf:type', 'ex:Person']]
      };

      dataSource.subscribe(querySpec, callback);

      // Remove matching triple
      tripleStore.remove('ex:alice', 'rdf:type', 'ex:Person');

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith([
        { entity: 'ex:bob' }
      ]);
    });

    it('should invoke callback with complex query results', () => {
      const callback = jest.fn();
      const querySpec = {
        find: ['?entity', '?name'],
        where: [
          ['?entity', 'rdf:type', 'ex:Person'],
          ['?entity', 'ex:name', '?name']
        ]
      };

      dataSource.subscribe(querySpec, callback);

      // Add matching data
      tripleStore.add('ex:alice', 'rdf:type', 'ex:Person');
      tripleStore.add('ex:alice', 'ex:name', 'Alice Smith');

      // Should be called after the second triple completes the match
      expect(callback).toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith([
        { entity: 'ex:alice', name: 'Alice Smith' }
      ]);
    });

    it('should invoke callback with filter applied', () => {
      const callback = jest.fn();
      const querySpec = {
        find: ['?entity', '?age'],
        where: [
          ['?entity', 'rdf:type', 'ex:Person'],
          ['?entity', 'ex:age', '?age']
        ],
        filter: (bindings) => bindings.age >= 30
      };

      dataSource.subscribe(querySpec, callback);

      // Add person under age threshold
      tripleStore.add('ex:bob', 'rdf:type', 'ex:Person');
      tripleStore.add('ex:bob', 'ex:age', 25);

      // Callback should not be invoked (filtered out)
      expect(callback).not.toHaveBeenCalled();

      // Add person meeting threshold
      tripleStore.add('ex:alice', 'rdf:type', 'ex:Person');
      tripleStore.add('ex:alice', 'ex:age', 30);

      // Callback should be invoked with filtered results
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith([
        { entity: 'ex:alice', age: 30 }
      ]);
    });
  });

  describe('Subscription cleanup', () => {
    it('should stop invoking callback after unsubscribe', () => {
      const callback = jest.fn();
      const querySpec = {
        find: ['?entity'],
        where: [['?entity', 'rdf:type', 'ex:Person']]
      };

      const subscription = dataSource.subscribe(querySpec, callback);

      // Add matching triple
      tripleStore.add('ex:alice', 'rdf:type', 'ex:Person');
      expect(callback).toHaveBeenCalledTimes(1);

      // Unsubscribe
      subscription.unsubscribe();

      // Add another matching triple
      tripleStore.add('ex:bob', 'rdf:type', 'ex:Person');

      // Callback should not be invoked again
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should allow unsubscribe to be called multiple times safely', () => {
      const callback = jest.fn();
      const querySpec = {
        find: ['?entity'],
        where: [['?entity', 'rdf:type', 'ex:Person']]
      };

      const subscription = dataSource.subscribe(querySpec, callback);

      // Call unsubscribe multiple times
      expect(() => {
        subscription.unsubscribe();
        subscription.unsubscribe();
        subscription.unsubscribe();
      }).not.toThrow();
    });

    it('should clean up all internal state on unsubscribe', () => {
      const callback = jest.fn();
      const querySpec = {
        find: ['?entity'],
        where: [['?entity', 'rdf:type', 'ex:Person']]
      };

      const subscription = dataSource.subscribe(querySpec, callback);
      subscription.unsubscribe();

      // Add data after unsubscribe
      tripleStore.add('ex:alice', 'rdf:type', 'ex:Person');

      // Verify callback not invoked
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('Multiple concurrent subscriptions', () => {
    it('should support multiple subscriptions to different queries', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      const querySpec1 = {
        find: ['?entity'],
        where: [['?entity', 'rdf:type', 'ex:Person']]
      };

      const querySpec2 = {
        find: ['?entity'],
        where: [['?entity', 'rdf:type', 'ex:Organization']]
      };

      dataSource.subscribe(querySpec1, callback1);
      dataSource.subscribe(querySpec2, callback2);

      // Add data matching first query
      tripleStore.add('ex:alice', 'rdf:type', 'ex:Person');

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).not.toHaveBeenCalled();

      // Add data matching second query
      tripleStore.add('ex:org1', 'rdf:type', 'ex:Organization');

      expect(callback1).toHaveBeenCalledTimes(1); // Still 1
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it('should support multiple subscriptions to same query', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      const querySpec = {
        find: ['?entity'],
        where: [['?entity', 'rdf:type', 'ex:Person']]
      };

      dataSource.subscribe(querySpec, callback1);
      dataSource.subscribe(querySpec, callback2);

      // Add matching data
      tripleStore.add('ex:alice', 'rdf:type', 'ex:Person');

      // Both callbacks should be invoked
      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it('should allow selective unsubscribe without affecting others', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      const querySpec = {
        find: ['?entity'],
        where: [['?entity', 'rdf:type', 'ex:Person']]
      };

      const subscription1 = dataSource.subscribe(querySpec, callback1);
      const subscription2 = dataSource.subscribe(querySpec, callback2);

      // Unsubscribe first callback
      subscription1.unsubscribe();

      // Add matching data
      tripleStore.add('ex:alice', 'rdf:type', 'ex:Person');

      // Only second callback should be invoked
      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it('should handle unsubscribe of all subscriptions', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      const querySpec = {
        find: ['?entity'],
        where: [['?entity', 'rdf:type', 'ex:Person']]
      };

      const subscription1 = dataSource.subscribe(querySpec, callback1);
      const subscription2 = dataSource.subscribe(querySpec, callback2);

      // Unsubscribe both
      subscription1.unsubscribe();
      subscription2.unsubscribe();

      // Add matching data
      tripleStore.add('ex:alice', 'rdf:type', 'ex:Person');

      // Neither callback should be invoked
      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
    });
  });

  describe('Edge cases', () => {
    it('should handle subscription with no initial matches', () => {
      const callback = jest.fn();
      const querySpec = {
        find: ['?entity'],
        where: [['?entity', 'rdf:type', 'ex:Person']]
      };

      const subscription = dataSource.subscribe(querySpec, callback);

      // No data added, callback should not be invoked
      expect(callback).not.toHaveBeenCalled();

      subscription.unsubscribe();
    });

    it('should handle subscription with empty result set after change', () => {
      tripleStore.add('ex:alice', 'rdf:type', 'ex:Person');

      const callback = jest.fn();
      const querySpec = {
        find: ['?entity'],
        where: [['?entity', 'rdf:type', 'ex:Person']]
      };

      dataSource.subscribe(querySpec, callback);

      // Remove the only matching triple
      tripleStore.remove('ex:alice', 'rdf:type', 'ex:Person');

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith([]);
    });

    it('should handle rapid successive changes', () => {
      const callback = jest.fn();
      const querySpec = {
        find: ['?entity'],
        where: [['?entity', 'rdf:type', 'ex:Person']]
      };

      dataSource.subscribe(querySpec, callback);

      // Add multiple triples rapidly
      tripleStore.add('ex:alice', 'rdf:type', 'ex:Person');
      tripleStore.add('ex:bob', 'rdf:type', 'ex:Person');
      tripleStore.add('ex:charlie', 'rdf:type', 'ex:Person');

      // Callback should be invoked for each change
      expect(callback.mock.calls.length).toBeGreaterThan(0);
    });
  });
});