/**
 * Unit tests for StreamProxy class extending Handle from @legion/km-data-handle
 * Tests the StreamProxy class in isolation with mocked DataSource
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { StreamProxy } from '../../src/StreamProxy.js';
import { DefaultQueryBuilder } from '../../src/DefaultQueryBuilder.js';

describe('StreamProxy Unit Tests', () => {
  let mockDataSource;
  let streamProxy;
  const testQuerySpec = {
    find: ['?e'],
    where: [['?e', ':type', 'stream-entity']]
  };

  beforeEach(() => {
    // Create mock DataSource that implements Handle interface
    mockDataSource = {
      query: jest.fn(),
      subscribe: jest.fn(),
      getSchema: jest.fn(),
      transact: jest.fn(),
      get: jest.fn(),
      queryBuilder: jest.fn((sourceHandle) => new DefaultQueryBuilder(mockDataSource, sourceHandle))
    };
  });

  afterEach(() => {
    if (streamProxy && typeof streamProxy.destroy === 'function') {
      streamProxy.destroy();
    }
    jest.clearAllMocks();
  });

  describe('StreamProxy Construction', () => {
    it('should create StreamProxy with valid DataSource and querySpec', () => {
      expect(() => {
        streamProxy = new StreamProxy(mockDataSource, testQuerySpec);
      }).not.toThrow();

      expect(streamProxy).toBeInstanceOf(StreamProxy);
      expect(streamProxy.dataSource).toBe(mockDataSource);
      expect(streamProxy.querySpec).toEqual(testQuerySpec);
    });

    it('should throw error when DataSource is null', () => {
      expect(() => {
        new StreamProxy(null, testQuerySpec);
      }).toThrow('DataSource must be a non-null object');
    });

    it('should throw error when DataSource is undefined', () => {
      expect(() => {
        new StreamProxy(undefined, testQuerySpec);
      }).toThrow('DataSource must be a non-null object');
    });

    it('should throw error when DataSource is not an object', () => {
      expect(() => {
        new StreamProxy('not-a-resource-manager', testQuerySpec);
      }).toThrow('DataSource must be a non-null object');
    });

    it('should throw error when querySpec is null', () => {
      expect(() => {
        new StreamProxy(mockDataSource, null);
      }).toThrow('Query specification is required');
    });

    it('should throw error when querySpec is undefined', () => {
      expect(() => {
        new StreamProxy(mockDataSource, undefined);
      }).toThrow('Query specification is required');
    });

    it('should throw error when querySpec is not an object', () => {
      expect(() => {
        new StreamProxy(mockDataSource, 'not-an-object');
      }).toThrow('Query specification must be an object');
    });

    it('should throw error when querySpec has no find clause', () => {
      const invalidSpec = {
        where: [['?e', ':type', 'test']]
      };

      expect(() => {
        new StreamProxy(mockDataSource, invalidSpec);
      }).toThrow('Query specification must have find clause');
    });

    it('should throw error when querySpec has empty find clause', () => {
      const invalidSpec = {
        find: [],
        where: [['?e', ':type', 'test']]
      };

      expect(() => {
        new StreamProxy(mockDataSource, invalidSpec);
      }).toThrow('Query specification must have find clause');
    });

    it('should throw error when querySpec has no where clause', () => {
      const invalidSpec = {
        find: ['?e']
      };

      expect(() => {
        new StreamProxy(mockDataSource, invalidSpec);
      }).toThrow('Query specification must have where clause');
    });

    it('should throw error when querySpec has non-array where clause', () => {
      const invalidSpec = {
        find: ['?e'],
        where: 'not-an-array'
      };

      expect(() => {
        new StreamProxy(mockDataSource, invalidSpec);
      }).toThrow('Where clause must be an array');
    });
  });

  describe('StreamProxy Value Operations', () => {
    beforeEach(() => {
      streamProxy = new StreamProxy(mockDataSource, testQuerySpec);
    });

    it('should return query results from DataSource', () => {
      const mockResults = [['entity1'], ['entity2'], ['entity3']];
      mockDataSource.query.mockReturnValue(mockResults);

      const result = streamProxy.value();

      expect(mockDataSource.query).toHaveBeenCalledWith(testQuerySpec);
      expect(result).toBe(mockResults);
    });

    it('should handle empty query results', () => {
      mockDataSource.query.mockReturnValue([]);

      const result = streamProxy.value();

      expect(mockDataSource.query).toHaveBeenCalledWith(testQuerySpec);
      expect(result).toEqual([]);
    });

    it('should throw error when called on destroyed StreamProxy', () => {
      streamProxy.destroy();

      expect(() => {
        streamProxy.value();
      }).toThrow('Handle has been destroyed');
    });
  });

  describe('StreamProxy Query Operations', () => {
    beforeEach(() => {
      streamProxy = new StreamProxy(mockDataSource, testQuerySpec);
    });

    it('should execute additional query with valid querySpec', () => {
      const additionalQuerySpec = {
        find: ['?e'],
        where: [['?e', ':status', 'active']]
      };
      const mockResults = [['active1'], ['active2']];
      mockDataSource.query.mockReturnValue(mockResults);

      const result = streamProxy.query(additionalQuerySpec);

      expect(mockDataSource.query).toHaveBeenCalledWith(additionalQuerySpec);
      expect(result).toBe(mockResults);
    });

    it('should throw error for invalid query specification', () => {
      expect(() => {
        streamProxy.query(null);
      }).toThrow('Query specification is required');
    });

    it('should throw error when called on destroyed StreamProxy', () => {
      const additionalQuerySpec = {
        find: ['?e'],
        where: [['?e', ':status', 'active']]
      };

      streamProxy.destroy();

      expect(() => {
        streamProxy.query(additionalQuerySpec);
      }).toThrow('Handle has been destroyed');
    });
  });

  describe('StreamProxy Filter Operations', () => {
    beforeEach(() => {
      streamProxy = new StreamProxy(mockDataSource, testQuerySpec);
    });

    it('should create filtered StreamProxy with valid predicate', () => {
      const filterPredicate = (item) => item[0] === 'entity1';

      const filteredProxy = streamProxy.filter(filterPredicate);

      expect(filteredProxy).toBeInstanceOf(StreamProxy);
      expect(filteredProxy).not.toBe(streamProxy);
      expect(filteredProxy.dataSource).toBe(mockDataSource);
    });

    it('should apply filter to value() results', () => {
      const mockResults = [['entity1'], ['entity2'], ['entity3']];
      mockDataSource.query.mockReturnValue(mockResults);
      const filterPredicate = (item) => item[0] === 'entity1' || item[0] === 'entity3';

      const filteredProxy = streamProxy.filter(filterPredicate);
      const result = filteredProxy.value();

      expect(result).toEqual([['entity1'], ['entity3']]);
    });

    it('should throw error for invalid filter predicate', () => {
      expect(() => {
        streamProxy.filter(null);
      }).toThrow('Filter predicate function is required');
    });

    it('should throw error for non-function filter predicate', () => {
      expect(() => {
        streamProxy.filter('not-a-function');
      }).toThrow('Filter predicate function is required');
    });

    it('should throw error when called on destroyed StreamProxy', () => {
      streamProxy.destroy();

      expect(() => {
        streamProxy.filter(() => true);
      }).toThrow('Handle has been destroyed');
    });
  });

  describe('StreamProxy Subscription Operations', () => {
    beforeEach(() => {
      streamProxy = new StreamProxy(mockDataSource, testQuerySpec);
    });

    it('should create subscription with callback only (monitors current stream)', () => {
      const mockSubscription = { id: 'sub1', unsubscribe: jest.fn() };
      mockDataSource.subscribe.mockReturnValue(mockSubscription);
      const callback = jest.fn();

      const subscription = streamProxy.subscribe(callback);

      expect(mockDataSource.subscribe).toHaveBeenCalledWith(testQuerySpec, callback);
      expect(subscription).toBeDefined();
      expect(typeof subscription.unsubscribe).toBe('function');
    });

    it('should create subscription with querySpec and callback', () => {
      const mockSubscription = { id: 'sub1', unsubscribe: jest.fn() };
      mockDataSource.subscribe.mockReturnValue(mockSubscription);
      const customQuerySpec = {
        find: ['?e'],
        where: [['?e', ':status', 'active']]
      };
      const callback = jest.fn();

      const subscription = streamProxy.subscribe(customQuerySpec, callback);

      expect(mockDataSource.subscribe).toHaveBeenCalledWith(customQuerySpec, callback);
      expect(subscription).toBeDefined();
      expect(typeof subscription.unsubscribe).toBe('function');
    });

    it('should throw error for invalid callback function', () => {
      expect(() => {
        streamProxy.subscribe(null);
      }).toThrow('Callback function is required');
    });

    it('should throw error for invalid querySpec in dual-param mode', () => {
      const callback = jest.fn();

      expect(() => {
        streamProxy.subscribe(null, callback);
      }).toThrow('Query specification is required');
    });

    it('should track subscriptions for cleanup', () => {
      const mockSubscription = { id: 'sub1', unsubscribe: jest.fn() };
      mockDataSource.subscribe.mockReturnValue(mockSubscription);
      const callback = jest.fn();

      streamProxy.subscribe(callback);

      expect(streamProxy._subscriptions.size).toBe(1);
    });

    it('should throw error when called on destroyed StreamProxy', () => {
      streamProxy.destroy();

      expect(() => {
        streamProxy.subscribe(jest.fn());
      }).toThrow('Handle has been destroyed');
    });
  });

  describe('StreamProxy Filtered Subscription Operations', () => {
    beforeEach(() => {
      streamProxy = new StreamProxy(mockDataSource, testQuerySpec);
    });

    it('should create filtered subscription that wraps callback', () => {
      const mockSubscription = { id: 'sub1', unsubscribe: jest.fn() };
      mockDataSource.subscribe.mockReturnValue(mockSubscription);
      const filterPredicate = (item) => item[0] === 'entity1';
      const callback = jest.fn();

      const filteredProxy = streamProxy.filter(filterPredicate);
      const subscription = filteredProxy.subscribe(callback);

      expect(mockDataSource.subscribe).toHaveBeenCalled();
      expect(subscription).toBeDefined();
      expect(typeof subscription.unsubscribe).toBe('function');

      // Simulate subscription callback with filtered results
      const subscriptionCallback = mockDataSource.subscribe.mock.calls[0][1];
      const mockData = [['entity1'], ['entity2'], ['entity3']];
      subscriptionCallback(mockData);

      expect(callback).toHaveBeenCalledWith([['entity1']]); // Only filtered results
    });

    it('should handle filtered subscription with custom querySpec', () => {
      const mockSubscription = { id: 'sub1', unsubscribe: jest.fn() };
      mockDataSource.subscribe.mockReturnValue(mockSubscription);
      const filterPredicate = (item) => item[0] === 'entity1';
      const callback = jest.fn();
      const customQuerySpec = {
        find: ['?e'],
        where: [['?e', ':status', 'active']]
      };

      const filteredProxy = streamProxy.filter(filterPredicate);
      const subscription = filteredProxy.subscribe(customQuerySpec, callback);

      expect(mockDataSource.subscribe).toHaveBeenCalledWith(customQuerySpec, expect.any(Function));
      expect(subscription).toBeDefined();
    });
  });

  describe('StreamProxy Destruction and Cleanup', () => {
    beforeEach(() => {
      streamProxy = new StreamProxy(mockDataSource, testQuerySpec);
    });

    it('should cleanup subscriptions when destroyed', () => {
      const mockSubscription1 = { id: 'sub1', unsubscribe: jest.fn() };
      const mockSubscription2 = { id: 'sub2', unsubscribe: jest.fn() };
      mockDataSource.subscribe
        .mockReturnValueOnce(mockSubscription1)
        .mockReturnValueOnce(mockSubscription2);

      streamProxy.subscribe(jest.fn());
      streamProxy.subscribe(jest.fn());

      expect(streamProxy._subscriptions.size).toBe(2);

      streamProxy.destroy();

      expect(mockSubscription1.unsubscribe).toHaveBeenCalled();
      expect(mockSubscription2.unsubscribe).toHaveBeenCalled();
      expect(streamProxy._subscriptions.size).toBe(0);
    });

    it('should handle unsubscribe errors gracefully', () => {
      const mockSubscription = {
        id: 'sub1',
        unsubscribe: jest.fn().mockImplementation(() => {
          throw new Error('Unsubscribe error');
        })
      };
      mockDataSource.subscribe.mockReturnValue(mockSubscription);

      streamProxy.subscribe(jest.fn());

      // Should not throw error during destruction
      expect(() => {
        streamProxy.destroy();
      }).not.toThrow();
    });

    it('should be safe to call destroy multiple times', () => {
      streamProxy.destroy();

      expect(() => {
        streamProxy.destroy();
      }).not.toThrow();
    });

    it('should return true for isDestroyed after destruction', () => {
      expect(streamProxy.isDestroyed()).toBe(false);

      streamProxy.destroy();

      expect(streamProxy.isDestroyed()).toBe(true);
    });
  });

  describe('StreamProxy Edge Cases', () => {
    beforeEach(() => {
      streamProxy = new StreamProxy(mockDataSource, testQuerySpec);
    });

    it('should handle DataSource query returning non-array', () => {
      mockDataSource.query.mockReturnValue(null);

      const result = streamProxy.value();

      expect(result).toBeNull();
    });

    it('should handle DataSource query throwing error', () => {
      mockDataSource.query.mockImplementation(() => {
        throw new Error('Query failed');
      });

      expect(() => {
        streamProxy.value();
      }).toThrow('Query failed');
    });

    it('should handle empty filter results', () => {
      const mockResults = [['entity1'], ['entity2']];
      mockDataSource.query.mockReturnValue(mockResults);
      const filterPredicate = () => false; // Filter out everything

      const filteredProxy = streamProxy.filter(filterPredicate);
      const result = filteredProxy.value();

      expect(result).toEqual([]);
    });

    it('should preserve querySpec through filter operations', () => {
      const filterPredicate = () => true;

      const filteredProxy = streamProxy.filter(filterPredicate);

      expect(filteredProxy.querySpec).toEqual(testQuerySpec);
    });
  });
});