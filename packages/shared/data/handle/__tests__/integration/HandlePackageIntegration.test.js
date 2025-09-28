/**
 * HandlePackageIntegration.test.js - Integration tests for the complete Handle package
 * 
 * Tests that all components work together correctly in realistic scenarios.
 */

import { 
  Handle, 
  CachedHandle, 
  PrototypeFactory, 
  ValidationUtils
} from '../../src/index.js';
import { validateDataSourceInterface } from '../../src/ValidationUtils.js';
import { createMockFunction } from '../testUtils.js';

describe('Handle Package Integration', () => {
  let mockDataSource;
  let mockCacheManager;

  beforeEach(() => {
    // Create comprehensive mock DataSource
    const queryFn = createMockFunction();
    queryFn.mockImplementation((querySpec) => {
      // Mock different query responses based on query type
      if (querySpec.where && querySpec.where.some(clause => clause.includes(':user/name'))) {
        return [['John Doe']];
      }
      if (querySpec.where && querySpec.where.some(clause => clause.includes(':user/tags'))) {
        return [['javascript'], ['nodejs'], ['react']];
      }
      if (querySpec.find && querySpec.find.includes('?attr') && querySpec.find.includes('?value')) {
        // Entity introspection query
        return [
          [':user/name', 'John Doe'],
          [':user/email', 'john@example.com'],
          [':user/active', true]
        ];
      }
      return [];
    });
    
    const subscribeFn = createMockFunction();
    subscribeFn.mockReturnValue({
      id: `sub-${Date.now()}`,
      unsubscribe: createMockFunction()
    });
    
    const getSchemaFn = createMockFunction();
    getSchemaFn.mockReturnValue({
      ':user/name': {
        ':db/valueType': ':db.type/string',
        ':db/cardinality': ':db.cardinality/one'
      },
        ':user/email': {
          ':db/valueType': ':db.type/string',
          ':db/cardinality': ':db.cardinality/one'
        },
        ':user/tags': {
          ':db/valueType': ':db.type/string',
          ':db/cardinality': ':db.cardinality/many'
        },
        ':user/active': {
          ':db/valueType': ':db.type/boolean',
          ':db/cardinality': ':db.cardinality/one'
        }
      });
    
    const updateFn = createMockFunction();
    updateFn.mockReturnValue(true);
    
    // Create mock query builder
    const queryBuilderFn = createMockFunction();
    queryBuilderFn.mockReturnValue({
      where: createMockFunction(),
      select: createMockFunction(),
      first: createMockFunction(),
      last: createMockFunction(),
      count: createMockFunction(),
      toArray: createMockFunction([])
    });
    
    mockDataSource = {
      query: queryFn,
      subscribe: subscribeFn,
      getSchema: getSchemaFn,
      update: updateFn,
      queryBuilder: queryBuilderFn
    };

    // Mock cache manager for CachedHandle testing
    mockCacheManager = {
      get: createMockFunction(null),
      set: createMockFunction(),
      invalidate: createMockFunction(),
      invalidateEntity: createMockFunction(),
      invalidateAll: createMockFunction()
    };
  });

  describe('DataSource Validation Integration', () => {
    test('should validate DataSource interface across components', () => {
      // All components should accept valid DataSource
      expect(() => new TestHandle(mockDataSource)).not.toThrow();
      expect(() => new TestCachedHandle(mockDataSource)).not.toThrow();
      expect(() => validateDataSourceInterface(mockDataSource)).not.toThrow();
    });

    test('should reject invalid DataSource consistently', () => {
      const invalidDS = { query: 'not-function' };
      
      expect(() => new TestHandle(invalidDS)).toThrow('DataSource must implement query() method');
      expect(() => new TestCachedHandle(invalidDS)).toThrow('DataSource must implement query() method');
      expect(() => validateDataSourceInterface(invalidDS)).toThrow('DataSource must implement query() method');
    });
  });

  describe('Handle + PrototypeFactory Integration', () => {
    test('should create enhanced handles with prototype-based introspection', () => {
      const factory = new PrototypeFactory(TestHandle);
      
      // Analyze schema
      const schema = mockDataSource.getSchema();
      factory.analyzeSchema(schema, 'datascript');
      
      // Create prototype
      const UserHandlePrototype = factory.getEntityPrototype('user');
      const userHandle = new UserHandlePrototype(mockDataSource, 123);
      
      // Should have both Handle functionality and prototype enhancements
      expect(userHandle).toBeInstanceOf(TestHandle);
      expect(userHandle.entityId).toBe(123);
      expect(userHandle.typeName).toBe('user');
      
      // Test prototype-enhanced introspection
      const introspection = userHandle.getIntrospectionInfo();
      expect(introspection.entityType).toBe('user');
      expect(introspection.entityId).toBe(123);
      expect(introspection.availableAttributes).toContain('name');
      expect(introspection.capabilities).toContain('query');
      
      userHandle.destroy();
    });

    test('should provide dynamic property access', () => {
      const factory = new PrototypeFactory(TestHandle);
      factory.analyzeSchema(mockDataSource.getSchema(), 'datascript');
      
      const UserHandlePrototype = factory.getEntityPrototype('user');
      const userHandle = new UserHandlePrototype(mockDataSource, 123);
      
      // Test dynamic getter
      const name = userHandle.name;
      expect(name).toBe('John Doe');
      expect(mockDataSource.query).toHaveBeenCalledWith({
        find: ['?value'],
        where: [[123, ':user/name', '?value']]
      });
      
      // Test dynamic setter
      userHandle.name = 'Jane Doe';
      expect(mockDataSource.update).toHaveBeenCalledWith({
        entityId: 123,
        attribute: ':user/name',
        value: 'Jane Doe'
      });
      
      userHandle.destroy();
    });

    test('should handle cardinality many attributes', () => {
      const factory = new PrototypeFactory(TestHandle);
      factory.analyzeSchema(mockDataSource.getSchema(), 'datascript');
      
      const UserHandlePrototype = factory.getEntityPrototype('user');
      const userHandle = new UserHandlePrototype(mockDataSource, 123);
      
      const tags = userHandle.tags;
      expect(tags).toEqual(['javascript', 'nodejs', 'react']);
      
      userHandle.destroy();
    });
  });

  describe('CachedHandle + ValidationUtils Integration', () => {
    test('should use ValidationUtils for parameter validation', () => {
      const cachedHandle = new TestCachedHandle(mockDataSource, { cacheTTL: 1000 });
      
      // Should validate subscription parameters using ValidationUtils
      expect(() => cachedHandle.subscribe(null, createMockFunction())).toThrow('Query specification is required');
      expect(() => cachedHandle.subscribe({}, null)).toThrow('Callback function is required');
      
      // Should validate query specifications
      expect(() => cachedHandle._validateQuerySpec(null)).toThrow('Query specification must be an object');
      
      cachedHandle.destroy();
    });

    test('should provide enhanced caching with validation', () => {
      const cachedHandle = new TestCachedHandle(mockDataSource, { 
        cacheTTL: 1000,
        cacheManager: mockCacheManager 
      });
      
      // First call should fetch fresh data
      const data1 = cachedHandle.getCachedTestData();
      expect(data1).toBe('fresh-test-data');
      
      // Second call should use cached data
      const data2 = cachedHandle.getCachedTestData();
      expect(data2).toBe('fresh-test-data');
      
      // Should have cache info
      const cacheInfo = cachedHandle.getCacheInfo();
      expect(cacheInfo.hasLocalCache).toBe(true);
      expect(cacheInfo.localCacheValid).toBe(true);
      expect(cacheInfo.hasGlobalCache).toBe(true);
      
      cachedHandle.destroy();
    });

    test('should handle cache invalidation subscriptions', () => {
      const cachedHandle = new TestCachedHandle(mockDataSource, { 
        cacheManager: mockCacheManager 
      });
      
      const querySpec = {
        find: ['?e'],
        where: [['?e', ':user/name', '?name']]
      };
      
      // Should validate and create cache invalidation subscription
      const subscription = cachedHandle._setupCacheInvalidation(querySpec);
      expect(subscription).toBeDefined();
      expect(mockDataSource.subscribe).toHaveBeenCalledWith(querySpec, expect.any(Function));
      
      cachedHandle.destroy();
    });
  });

  describe('Actor System Integration', () => {
    test('should handle Actor messages across Handle types', () => {
      const basicHandle = new TestHandle(mockDataSource);
      const cachedHandle = new TestCachedHandle(mockDataSource);
      
      // Both should handle Actor messages
      expect(basicHandle.receive({ type: 'value' })).toBe('test-value');
      expect(cachedHandle.receive({ type: 'value' })).toBe('cached-test-value');
      
      // Both should handle query messages
      const querySpec = { find: ['?e'], where: [['?e', ':test/attr', '?value']] };
      const basicResult = basicHandle.receive({ type: 'query', querySpec });
      const cachedResult = cachedHandle.receive({ type: 'query', querySpec });
      
      expect(basicResult).toEqual(['test-query-result']);
      expect(cachedResult).toEqual(['cached-test-query-result']);
      
      // Both should handle introspection messages
      const basicInfo = basicHandle.receive({ type: 'introspect' });
      const cachedInfo = cachedHandle.receive({ type: 'introspect' });
      
      expect(basicInfo.handleType).toBe('TestHandle');
      expect(cachedInfo.handleType).toBe('TestCachedHandle');
      
      basicHandle.destroy();
      cachedHandle.destroy();
    });

    test('should support remote Handle creation via Actor system', () => {
      const factory = new PrototypeFactory(TestHandle);
      factory.analyzeSchema(mockDataSource.getSchema(), 'datascript');
      
      const UserHandlePrototype = factory.getEntityPrototype('user');
      
      // Simulate remote Handle creation
      const remoteHandleConfig = {
        dataSource: mockDataSource,
        entityId: 456,
        options: { remoteable: true }
      };
      
      const remoteHandle = new UserHandlePrototype(
        remoteHandleConfig.dataSource, 
        remoteHandleConfig.entityId,
        remoteHandleConfig.options
      );
      
      // Should work exactly like local Handle
      expect(remoteHandle.entityId).toBe(456);
      expect(remoteHandle.typeName).toBe('user');
      
      // Should respond to Actor messages
      const introspection = remoteHandle.receive({ type: 'introspect' });
      expect(introspection.entityId).toBe(456);
      expect(introspection.entityType).toBe('user');
      
      remoteHandle.destroy();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle missing schema gracefully', () => {
      const rmWithoutSchema = {
        ...mockDataSource,
        getSchema: createMockFunction(null)
      };
      
      const handle = new TestHandle(rmWithoutSchema);
      expect(handle._prototypeFactory).toBe(null);
      
      // Introspection should still work without prototype factory
      const info = handle.getIntrospectionInfo();
      expect(info.hasPrototypeFactory).toBe(false);
      
      handle.destroy();
    });

    test('should handle subscription failures gracefully', () => {
      const failingRM = {
        ...mockDataSource,
        subscribe: createMockFunction().mockImplementation(() => {
          throw new Error('Subscription failed');
        })
      };
      
      const cachedHandle = new TestCachedHandle(failingRM);
      
      // Mock console.warn
      const originalWarn = console.warn;
      const warnCalls = [];
      console.warn = (...args) => { warnCalls.push(args); };
      
      // Should not throw, but warn
      const querySpec = { find: ['?e'], where: [['?e', ':test/attr', '?value']] };
      const subscription = cachedHandle._setupCacheInvalidation(querySpec);
      
      expect(subscription).toBeNull();
      expect(warnCalls.length).toBe(1);
      expect(warnCalls[0][0]).toBe('Failed to setup cache invalidation:');
      expect(warnCalls[0][1]).toBe('Subscription failed');
      
      // Restore console.warn
      console.warn = originalWarn;
      cachedHandle.destroy();
    });

    test('should handle bulk operations with mixed success/failure', () => {
      const cachedHandle = new TestCachedHandle(mockDataSource);
      
      const items = [1, 2, 3, 4];
      const operation = createMockFunction();
      let callCount = 0;
      operation.mockImplementation(() => {
        callCount++;
        if (callCount === 2) {
          throw new Error('Item 2 failed');
        }
        return 'success';
      });
      
      // Mock console.warn
      const originalWarn = console.warn;
      const warnCalls = [];
      console.warn = (...args) => { warnCalls.push(args); };
      
      const result = cachedHandle._executeBulkOperation(items, operation, 'Test operation');
      
      expect(result.success).toBe(true);
      expect(result.processed).toBe(3);
      expect(result.failed).toBe(1);
      expect(result.total).toBe(4);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].index).toBe(1);
      
      // Restore console.warn
      console.warn = originalWarn;
      cachedHandle.destroy();
    });
  });

  describe('Memory and Resource Management', () => {
    test('should clean up all resources on destroy', () => {
      const factory = new PrototypeFactory(TestCachedHandle);
      factory.analyzeSchema(mockDataSource.getSchema(), 'datascript');
      
      const UserHandlePrototype = factory.getEntityPrototype('user');
      const userHandle = new UserHandlePrototype(mockDataSource, 123, {
        cacheTTL: 1000,
        cacheManager: mockCacheManager
      });
      
      // Create some subscriptions
      const sub1 = userHandle.subscribe({ find: ['?e'], where: [['?e', ':user/name', '?name']] }, createMockFunction());
      const sub2 = userHandle.subscribe({ find: ['?e'], where: [['?e', ':user/email', '?email']] }, createMockFunction());
      
      // Setup cache invalidation
      userHandle._setupCacheInvalidation({ find: ['?e'], where: [['?e', ':user/name', '?name']] });
      
      expect(userHandle._subscriptions.size).toBeGreaterThan(0);
      expect(userHandle._cacheInvalidationSubs.size).toBeGreaterThan(0);
      
      // Destroy should clean up everything
      userHandle.destroy();
      
      expect(userHandle._subscriptions.size).toBe(0);
      expect(userHandle._cacheInvalidationSubs.size).toBe(0);
      expect(userHandle.isDestroyed()).toBe(true);
    });

    test('should prevent operations after destruction', () => {
      const handle = new TestHandle(mockDataSource);
      handle.destroy();
      
      expect(() => handle.subscribe({}, createMockFunction())).toThrow('Handle has been destroyed');
      expect(() => handle.query({})).toThrow('Handle has been destroyed');
      expect(() => handle.value()).toThrow('Handle has been destroyed');
      expect(() => handle.getIntrospectionInfo()).toThrow('Handle has been destroyed');
    });
  });

  describe('Performance and Caching Behavior', () => {
    test('should demonstrate caching performance benefits', () => {
      const cachedHandle = new TestCachedHandle(mockDataSource, { cacheTTL: 5000 });
      
      // First call - should fetch fresh data
      const start1 = Date.now();
      const data1 = cachedHandle.getCachedTestData();
      const time1 = Date.now() - start1;
      
      // Second call - should use cache (much faster)
      const start2 = Date.now();
      const data2 = cachedHandle.getCachedTestData();
      const time2 = Date.now() - start2;
      
      expect(data1).toBe(data2);
      expect(time2).toBeLessThan(time1); // Cached call should be faster
      
      cachedHandle.destroy();
    });

    test('should handle cache expiration correctly', (done) => {
      const cachedHandle = new TestCachedHandle(mockDataSource, { cacheTTL: 10 }); // 10ms TTL
      
      // First call
      const data1 = cachedHandle.getCachedTestData();
      expect(data1).toBe('fresh-test-data');
      
      // Wait for cache expiration
      setTimeout(() => {
        const data2 = cachedHandle.getCachedTestData();
        expect(data2).toBe('fresh-test-data'); // Should fetch fresh again
        
        cachedHandle.destroy();
        done();
      }, 15); // Wait longer than TTL
    });
  });
});

// Test implementations for integration testing

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

class TestCachedHandle extends CachedHandle {
  value() {
    this._validateNotDestroyed();
    return 'cached-test-value';
  }
  
  query(querySpec) {
    this._validateNotDestroyed();
    this.dataSource.query(querySpec);
    return ['cached-test-query-result'];
  }
  
  getCachedTestData() {
    return this._getCachedData();
  }
  
  _fetchFreshData() {
    // Simulate some work
    const start = Date.now();
    while (Date.now() - start < 5) {} // 5ms delay
    return 'fresh-test-data';
  }
}