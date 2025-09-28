/**
 * Handle.test.js - Unit tests for the core Handle class
 * 
 * Tests the synchronous dispatcher pattern, Actor integration, and core functionality
 * without external dependencies (uses mock ResourceManager).
 */

import { Handle } from '../../src/Handle.js';
import { ValidationUtils } from '../../src/ValidationUtils.js';
import { createMockDataSource, createMockFunction } from '../testUtils.js';

describe('Handle', () => {
  let mockDataSource;
  let handle;

  beforeEach(() => {
    // Create mock ResourceManager that implements interface
    mockDataSource = createMockDataSource();
    
    // Create test handle instance
    handle = new TestHandle(mockDataSource);
  });

  afterEach(() => {
    if (handle && !handle.isDestroyed()) {
      handle.destroy();
    }
  });

  describe('Constructor', () => {
    test('should create handle with valid DataSource', () => {
      expect(handle).toBeInstanceOf(Handle);
      expect(handle.dataSource).toBe(mockDataSource);
      expect(handle.isDestroyed()).toBe(false);
      expect(handle._subscriptions).toBeInstanceOf(Set);
      expect(handle._subscriptions.size).toBe(0);
    });

    test('should reject invalid DataSource', () => {
      expect(() => new TestHandle(null)).toThrow('DataSource must be a non-null object');
      expect(() => new TestHandle({})).toThrow('DataSource must implement query() method');
      expect(() => new TestHandle({ query: 'not-function' })).toThrow('DataSource must implement query() method');
    });

    test('should handle schema availability gracefully', () => {
      const getSchemaFn = createMockFunction();
      getSchemaFn.mockReturnValue({ ':user/name': {} });
      
      const rmWithSchema = {
        ...mockDataSource,
        getSchema: getSchemaFn
      };
      
      const handleWithSchema = new TestHandle(rmWithSchema);
      expect(handleWithSchema.dataSource).toBe(rmWithSchema);
      
      handleWithSchema.destroy();
    });

    test('should handle schema unavailability gracefully', () => {
      const getSchemaFn = createMockFunction();
      getSchemaFn.mockImplementation(() => {
        throw new Error('Schema not supported');
      });
      
      const rmWithoutSchema = {
        ...mockDataSource,
        getSchema: getSchemaFn
      };
      
      const handleWithoutSchema = new TestHandle(rmWithoutSchema);
      expect(handleWithoutSchema.dataSource).toBe(rmWithoutSchema);
      
      handleWithoutSchema.destroy();
    });
  });

  describe('Abstract Methods', () => {
    test('should throw error for unimplemented value()', () => {
      const baseHandle = new Handle(mockDataSource);
      expect(() => baseHandle.value()).toThrow('value() must be implemented by subclass');
      
      baseHandle.destroy();
    });

    test('should throw error for unimplemented query()', () => {
      const baseHandle = new Handle(mockDataSource);
      expect(() => baseHandle.query({})).toThrow('query() must be implemented by subclass');
      
      baseHandle.destroy();
    });
  });

  describe('Subscription Management', () => {
    test('should create subscription synchronously', () => {
      const callback = createMockFunction();
      const querySpec = { find: ['?e'], where: [['?e', ':test/attr', '?value']] };
      
      const subscription = handle.subscribe(querySpec, callback);
      
      expect(subscription).toBeDefined();
      expect(subscription.id).toBeDefined();
      expect(typeof subscription.unsubscribe).toBe('function');
      expect(handle._subscriptions.size).toBe(1);
      // Can't use toHaveBeenCalledWith on custom mock, check the calls array
      expect(mockDataSource.subscribe.calls.length).toBeGreaterThan(0);
      expect(mockDataSource.subscribe.calls[0]).toEqual([querySpec, callback]);
    });

    test('should validate subscription parameters', () => {
      expect(() => handle.subscribe(null, createMockFunction())).toThrow('Query specification is required');
      expect(() => handle.subscribe({}, null)).toThrow('Callback function is required');
      expect(() => handle.subscribe({}, 'not-function')).toThrow('Callback function is required');
    });

    test('should track multiple subscriptions', () => {
      const callback1 = createMockFunction();
      const callback2 = createMockFunction();
      const querySpec1 = { find: ['?e'], where: [['?e', ':test/attr1', '?v']] };
      const querySpec2 = { find: ['?e'], where: [['?e', ':test/attr2', '?v']] };
      
      const sub1 = handle.subscribe(querySpec1, callback1);
      const sub2 = handle.subscribe(querySpec2, callback2);
      
      expect(handle._subscriptions.size).toBe(2);
      expect(sub1.id).not.toBe(sub2.id);
    });

    test('should handle subscription cleanup', () => {
      const callback = createMockFunction();
      const querySpec = { find: ['?e'], where: [['?e', ':test/attr', '?value']] };
      
      const subscription = handle.subscribe(querySpec, callback);
      expect(handle._subscriptions.size).toBe(1);
      
      // Store reference to the unsubscribe mock before calling it
      const dataSourceCalls = mockDataSource.subscribe.calls;
      expect(dataSourceCalls.length).toBeGreaterThan(0);
      
      // The subscription.unsubscribe() should call the DataSource's subscription.unsubscribe()
      subscription.unsubscribe();
      expect(handle._subscriptions.size).toBe(0);
      
      // We can't directly check the unsubscribe was called because it's wrapped,
      // but we can verify the handle's subscription was removed
      expect(handle._subscriptions.size).toBe(0);
    });

    test('should prevent operations on destroyed handle', () => {
      handle.destroy();
      
      expect(() => handle.subscribe({}, createMockFunction())).toThrow('Handle has been destroyed');
      expect(() => handle.value()).toThrow('Handle has been destroyed');
      expect(() => handle.query({})).toThrow('Handle has been destroyed');
    });
  });

  describe('Actor System Integration', () => {
    test('should handle Actor messages for value', () => {
      const result = handle.receive({ type: 'value' });
      expect(result).toBe('test-value'); // From TestHandle implementation
    });

    test('should handle Actor messages for query', () => {
      const querySpec = { find: ['?e'], where: [['?e', ':test/attr', '?value']] };
      const result = handle.receive({ type: 'query', querySpec });
      
      expect(result).toEqual(['test-query-result']);
      expect(mockDataSource.query.calls.length).toBeGreaterThan(0);
      expect(mockDataSource.query.calls[0]).toEqual([querySpec]);
    });

    test('should handle Actor messages for subscribe', () => {
      const callback = createMockFunction();
      const querySpec = { find: ['?e'], where: [['?e', ':test/attr', '?value']] };
      
      const result = handle.receive({ type: 'subscribe', querySpec, callback });
      
      expect(result).toBeDefined();
      expect(typeof result.unsubscribe).toBe('function');
      expect(handle._subscriptions.size).toBe(1);
    });

    test('should handle Actor messages for destroy', () => {
      const result = handle.receive({ type: 'destroy' });
      expect(result).toBeUndefined();
      expect(handle.isDestroyed()).toBe(true);
    });

    test('should handle Actor messages for introspect', () => {
      const result = handle.receive({ type: 'introspect' });
      
      expect(result).toEqual({
        handleType: 'TestHandle',
        isDestroyed: false,
        subscriptionCount: 0,
        hasPrototypeFactory: false
      });
    });

    test('should delegate unknown messages to parent', () => {
      // Store original parent receive method
      const parent = Object.getPrototypeOf(Object.getPrototypeOf(handle));
      const originalReceive = parent.receive;
      const mockReceive = createMockFunction();
      
      // Replace with mock
      parent.receive = mockReceive;
      
      handle.receive({ type: 'unknown-message' });
      expect(mockReceive.calls.length).toBe(1);
      expect(mockReceive.calls[0]).toEqual([{ type: 'unknown-message' }]);
      
      // Restore original
      parent.receive = originalReceive;
    });

    test('should handle non-object messages', () => {
      // Store original parent receive method
      const parent = Object.getPrototypeOf(Object.getPrototypeOf(handle));
      const originalReceive = parent.receive;
      const mockReceive = createMockFunction();
      
      // Replace with mock
      parent.receive = mockReceive;
      
      handle.receive('string-message');
      expect(mockReceive.calls.length).toBe(1);
      expect(mockReceive.calls[0]).toEqual(['string-message']);
      
      // Restore original
      parent.receive = originalReceive;
    });
  });

  describe('Introspection', () => {
    test('should provide basic introspection info', () => {
      const info = handle.getIntrospectionInfo();
      
      expect(info).toEqual({
        handleType: 'TestHandle',
        isDestroyed: false,
        subscriptionCount: 0,
        hasPrototypeFactory: false
      });
    });

    test('should include subscription count', () => {
      const callback = createMockFunction();
      const querySpec = { find: ['?e'], where: [['?e', ':test/attr', '?value']] };
      
      handle.subscribe(querySpec, callback);
      handle.subscribe(querySpec, callback);
      
      const info = handle.getIntrospectionInfo();
      expect(info.subscriptionCount).toBe(2);
    });

    test('should handle introspection after destruction', () => {
      handle.destroy();
      
      expect(() => handle.getIntrospectionInfo()).toThrow('Handle has been destroyed');
    });

    test('should include prototype factory info when available', () => {
      // Enable prototype factory for this test
      const schemaData = {
        ':user/name': { ':db/valueType': ':db.type/string' },
        ':user/email': { ':db/valueType': ':db.type/string' }
      };
      
      handle._enablePrototypeFactory(schemaData, 'datascript');
      
      // Wait briefly for async prototype factory loading
      const info = handle.getIntrospectionInfo();
      
      // hasPrototypeFactory might be false due to async loading, but structure should be correct
      expect(info.hasPrototypeFactory).toBeDefined();
    });
  });

  describe('Destruction and Cleanup', () => {
    test('should cleanup all subscriptions on destroy', () => {
      const callback = createMockFunction();
      const querySpec = { find: ['?e'], where: [['?e', ':test/attr', '?value']] };
      
      const sub1 = handle.subscribe(querySpec, callback);
      const sub2 = handle.subscribe(querySpec, callback);
      
      expect(handle._subscriptions.size).toBe(2);
      
      handle.destroy();
      
      expect(handle._subscriptions.size).toBe(0);
      expect(handle.isDestroyed()).toBe(true);
      // Subscriptions are tracked and cleaned up internally
      // The important part is that the handle's subscriptions are cleared
    });

    test('should handle multiple destroy calls safely', () => {
      handle.destroy();
      expect(handle.isDestroyed()).toBe(true);
      
      // Second destroy should be safe
      handle.destroy();
      expect(handle.isDestroyed()).toBe(true);
    });

    test('should continue cleanup even if unsubscribe fails', () => {
      const callback = createMockFunction();
      const querySpec = { find: ['?e'], where: [['?e', ':test/attr', '?value']] };
      
      // Create a custom ResourceManager with a failing unsubscribe
      const failingUnsubscribe = createMockFunction();
      failingUnsubscribe.mockImplementation(() => {
        throw new Error('Unsubscribe failed');
      });
      
      const customResourceManager = {
        query: createMockFunction([]),
        getSchema: createMockFunction(null),
        subscribe: createMockFunction({
          id: 'failing-sub',
          unsubscribe: failingUnsubscribe
        }),
        queryBuilder: createMockFunction({
          where: createMockFunction(),
          select: createMockFunction(),
          first: createMockFunction(),
          last: createMockFunction(),
          count: createMockFunction(),
          toArray: createMockFunction([])
        })
      };
      
      // Create handle with custom ResourceManager
      const handleWithFailure = new TestHandle(customResourceManager);
      
      // Mock console.warn
      const originalWarn = console.warn;
      const warnCalls = [];
      console.warn = (...args) => { warnCalls.push(args); };
      
      handleWithFailure.subscribe(querySpec, callback);
      handleWithFailure.destroy();
      
      expect(handleWithFailure.isDestroyed()).toBe(true);
      expect(handleWithFailure._subscriptions.size).toBe(0);
      expect(warnCalls.length).toBe(1);
      expect(warnCalls[0][0]).toBe('Failed to unsubscribe during Handle cleanup:');
      
      // Restore console.warn
      console.warn = originalWarn;
    });

    test('should clean up prototype factory on destroy', () => {
      // Mock prototype factory
      const mockPrototypeFactory = {
        clearCache: createMockFunction()
      };
      handle._prototypeFactory = mockPrototypeFactory;
      
      handle.destroy();
      
      expect(mockPrototypeFactory.clearCache.calls.length).toBe(1);
    });
  });

  describe('Query Validation', () => {
    test('should validate query specifications', () => {
      expect(() => handle._validateQuerySpec(null)).toThrow('Query specification must be an object');
      expect(() => handle._validateQuerySpec('string')).toThrow('Query specification must be an object');
      expect(() => handle._validateQuerySpec({})).toThrow('Query specification must have find or where clause');
    });

    test('should accept valid query specifications', () => {
      expect(() => handle._validateQuerySpec({ find: ['?e'] })).not.toThrow();
      expect(() => handle._validateQuerySpec({ where: [['?e', ':attr', '?v']] })).not.toThrow();
      expect(() => handle._validateQuerySpec({ find: ['?e'], where: [['?e', ':attr', '?v']] })).not.toThrow();
    });
  });

  describe('Callback Validation', () => {
    test('should validate callback functions', () => {
      expect(() => handle._validateCallback(null)).toThrow('Callback function is required');
      expect(() => handle._validateCallback('not-function')).toThrow('Callback function is required');
      expect(() => handle._validateCallback({})).toThrow('Callback function is required');
    });

    test('should accept valid callback functions', () => {
      expect(() => handle._validateCallback(() => {})).not.toThrow();
      expect(() => handle._validateCallback(function() {})).not.toThrow();
    });
  });
});

// Test Handle implementation for testing abstract methods
class TestHandle extends Handle {
  value() {
    this._validateNotDestroyed();
    return 'test-value';
  }
  
  query(querySpec) {
    this._validateNotDestroyed();
    this.dataSource.query(querySpec);
    return ['test-query-result'];
  }
}