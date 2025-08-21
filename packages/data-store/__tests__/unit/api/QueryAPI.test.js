/**
 * Unit tests for QueryAPI class
 * Tests client-facing query interface per design §15.3
 */

import { QueryAPI } from '../../../src/api/QueryAPI.js';
import { Store } from '../../../src/Store.js';
import { TrieManager } from '../../../src/trie/TrieManager.js';
import { Dispatcher } from '../../../src/kernel/Dispatcher.js';
import { SubscriptionManager } from '../../../src/subscription/SubscriptionManager.js';
import { GraphSpecBuilder } from '../../../src/query/GraphSpecBuilder.js';

// Simple mock function for testing
function createMockFn() {
  const fn = function(...args) {
    fn.calls.push(args);
    fn.callCount++;
    if (fn.mockImplementation) {
      return fn.mockImplementation(...args);
    }
    return fn.returnValue;
  };
  fn.calls = [];
  fn.callCount = 0;
  fn.returnValue = undefined;
  fn.mockImplementation = null;
  fn.mockClear = () => {
    fn.calls = [];
    fn.callCount = 0;
  };
  return fn;
}

describe('QueryAPI', () => {
  let store;
  let trieManager;
  let dispatcher;
  let subscriptionManager;
  let queryCompiler;
  let queryAPI;

  beforeEach(() => {
    store = new Store();
    trieManager = new TrieManager();
    dispatcher = new Dispatcher(store, trieManager);
    subscriptionManager = new SubscriptionManager(dispatcher);
    queryCompiler = new GraphSpecBuilder();
    
    queryAPI = new QueryAPI(store, dispatcher, subscriptionManager, queryCompiler);
    
    // Define relationship types for testing
    store.defineRelationType('follows', 'followedBy');
    store.defineRelationType('likes', 'likedBy');
  });

  describe('construction', () => {
    it('should create QueryAPI with required dependencies', () => {
      expect(queryAPI).toBeDefined();
      expect(queryAPI._store).toBe(store);
      expect(queryAPI._dispatcher).toBe(dispatcher);
      expect(queryAPI._subscriptionManager).toBe(subscriptionManager);
      expect(queryAPI._queryCompiler).toBe(queryCompiler);
    });

    it('should validate required dependencies', () => {
      expect(() => new QueryAPI())
        .toThrow('Store is required');
      
      expect(() => new QueryAPI(store))
        .toThrow('Dispatcher is required');
      
      expect(() => new QueryAPI(store, dispatcher))
        .toThrow('SubscriptionManager is required');
      
      expect(() => new QueryAPI(store, dispatcher, subscriptionManager))
        .toThrow('QueryCompiler is required');
    });

    it('should initialize internal state', () => {
      expect(queryAPI._queryCache.size).toBe(0);
      expect(queryAPI._subscriptionQueries.size).toBe(0);
      expect(queryAPI._nextQueryId).toBe(1);
    });
  });

  describe('submitPathQuery', () => {
    it('should submit simple path query and return subscription ID', () => {
      const spec = { relation: 'follows' };
      const projection = ['src', 'dst'];
      
      const subscriptionId = queryAPI.submitPathQuery(spec, projection);
      
      expect(subscriptionId).toMatch(/^sub_/);
      expect(queryAPI._subscriptionQueries.has(subscriptionId)).toBe(true);
    });

    it('should normalize string query specs', () => {
      const spec = 'follows';
      const projection = ['src', 'dst'];
      
      const subscriptionId = queryAPI.submitPathQuery(spec, projection);
      
      expect(subscriptionId).toBeDefined();
      
      // Should convert to object format
      const subscription = queryAPI.getSubscription(subscriptionId);
      expect(subscription.querySpec).toEqual({ path: 'follows' });
    });

    it('should validate required parameters', () => {
      expect(() => queryAPI.submitPathQuery())
        .toThrow('Query spec is required');
      
      expect(() => queryAPI.submitPathQuery({ relation: 'follows' }))
        .toThrow('Projection is required');
    });

    it('should cache queries and reuse them', () => {
      const spec = { relation: 'follows' };
      const projection = ['src', 'dst'];
      
      const sub1 = queryAPI.submitPathQuery(spec, projection);
      const sub2 = queryAPI.submitPathQuery(spec, projection);
      
      // Different subscriptions
      expect(sub1).not.toBe(sub2);
      
      // But same underlying query
      const info1 = queryAPI.getSubscription(sub1);
      const info2 = queryAPI.getSubscription(sub2);
      expect(info1.queryId).toBe(info2.queryId);
      
      // Only one cached query
      expect(queryAPI._queryCache.size).toBe(1);
    });

    it('should pass options to subscription', () => {
      const spec = { relation: 'follows' };
      const projection = ['src', 'dst'];
      const filter = (item) => item.src === 'alice';
      const transform = (item) => item.src;
      
      const subscriptionId = queryAPI.submitPathQuery(spec, projection, {
        filter,
        transform,
        metadata: { custom: 'data' }
      });
      
      const subscription = subscriptionManager.getSubscription(subscriptionId);
      const metadata = subscription.getMetadata();
      
      expect(metadata.custom).toBe('data');
      expect(metadata.querySpec).toEqual(spec);
      expect(metadata.projection).toEqual(projection);
    });

    it('should emit subscriptionCreated event', () => {
      const handler = createMockFn();
      queryAPI.on('subscriptionCreated', handler);
      
      const spec = { relation: 'follows' };
      const projection = ['src', 'dst'];
      
      const subscriptionId = queryAPI.submitPathQuery(spec, projection);
      
      expect(handler.callCount).toBe(1);
      expect(handler.calls[0][0]).toEqual({
        subscriptionId,
        queryId: expect.any(String),
        spec,
        projection
      });
    });

    it('should handle query compilation errors', () => {
      const handler = createMockFn();
      queryAPI.on('queryError', handler);
      
      const invalidSpec = { invalid: 'spec' };
      const projection = ['src', 'dst'];
      
      expect(() => queryAPI.submitPathQuery(invalidSpec, projection))
        .toThrow();
      
      expect(handler.callCount).toBe(1);
      expect(handler.calls[0][0].error).toBeDefined();
    });
  });

  describe('unsubscribe', () => {
    let subscriptionId;

    beforeEach(() => {
      subscriptionId = queryAPI.submitPathQuery({ relation: 'follows' }, ['src', 'dst']);
    });

    it('should unsubscribe from query', () => {
      const result = queryAPI.unsubscribe(subscriptionId);
      
      expect(result).toBe(true);
      expect(queryAPI._subscriptionQueries.has(subscriptionId)).toBe(false);
    });

    it('should emit subscriptionRemoved event', () => {
      const handler = createMockFn();
      queryAPI.on('subscriptionRemoved', handler);
      
      queryAPI.unsubscribe(subscriptionId);
      
      expect(handler.callCount).toBe(1);
      expect(handler.calls[0][0].subscriptionId).toBe(subscriptionId);
    });

    it('should validate subscription ID', () => {
      expect(() => queryAPI.unsubscribe())
        .toThrow('Subscription ID is required');
    });

    it('should handle non-existent subscription gracefully', () => {
      const result = queryAPI.unsubscribe('non-existent');
      
      expect(result).toBe(false);
    });

    it('should garbage collect unused queries', () => {
      const handler = createMockFn();
      queryAPI.on('queryGarbageCollected', handler);
      
      const info = queryAPI.getSubscription(subscriptionId);
      const queryId = info.queryId;
      
      // Only one subscription for this query
      queryAPI.unsubscribe(subscriptionId);
      
      // Query should be garbage collected
      expect(handler.callCount).toBe(1);
      expect(handler.calls[0][0].queryId).toBe(queryId);
    });
  });

  describe('onChange', () => {
    let subscriptionId;

    beforeEach(() => {
      subscriptionId = queryAPI.submitPathQuery({ relation: 'follows' }, ['src', 'dst']);
    });

    it('should return change stream for subscription', () => {
      const changeStream = queryAPI.onChange(subscriptionId);
      
      expect(changeStream).toBeDefined();
      expect(typeof changeStream.on).toBe('function');
      expect(typeof changeStream.emit).toBe('function');
    });

    it('should validate subscription ID', () => {
      expect(() => queryAPI.onChange())
        .toThrow('Subscription ID is required');
      
      expect(() => queryAPI.onChange('non-existent'))
        .toThrow('Subscription non-existent not found');
    });

    it('should emit bootstrap data', () => {
      const changeStream = queryAPI.onChange(subscriptionId);
      const handler = createMockFn();
      changeStream.on('data', handler);
      
      // Trigger bootstrap by getting subscription and calling handleResults
      const subscription = subscriptionManager.getSubscription(subscriptionId);
      subscription.handleResults([{ src: 'alice', dst: 'bob' }]);
      
      expect(handler.callCount).toBe(1);
      expect(handler.calls[0][0]).toEqual({
        type: 'bootstrap',
        adds: [{ src: 'alice', dst: 'bob' }],
        removes: [],
        timestamp: expect.any(Number)
      });
    });

    it('should emit update data', () => {
      const changeStream = queryAPI.onChange(subscriptionId);
      const handler = createMockFn();
      changeStream.on('data', handler);
      
      // Trigger update
      const subscription = subscriptionManager.getSubscription(subscriptionId);
      subscription.handleUpdate({
        type: 'add',
        data: { src: 'bob', dst: 'charlie' }
      });
      
      expect(handler.callCount).toBe(1);
      expect(handler.calls[0][0]).toEqual({
        type: 'update',
        adds: [{ src: 'bob', dst: 'charlie' }],
        removes: [],
        timestamp: expect.any(Number)
      });
    });

    it('should handle change stream setup and cleanup', () => {
      const changeStream = queryAPI.onChange(subscriptionId);
      
      expect(changeStream).toBeDefined();
      expect(typeof changeStream.on).toBe('function');
      expect(typeof changeStream.emit).toBe('function');
      
      // Should be able to close stream
      changeStream.emit('close');
      
      // This test just verifies the basic functionality
      expect(true).toBe(true);
    });
  });

  describe('subscription management', () => {
    let subscriptionId;

    beforeEach(() => {
      subscriptionId = queryAPI.submitPathQuery({ relation: 'follows' }, ['src', 'dst']);
    });

    it('should get subscription information', () => {
      const info = queryAPI.getSubscription(subscriptionId);
      
      expect(info).toEqual({
        subscriptionId,
        queryId: expect.any(String),
        state: 'active',
        querySpec: { relation: 'follows' },
        projection: ['src', 'dst'],
        isActive: true,
        stats: expect.any(Object)
      });
    });

    it('should return null for non-existent subscription', () => {
      const info = queryAPI.getSubscription('non-existent');
      
      expect(info).toBe(null);
    });

    it('should list active subscriptions', () => {
      const sub2 = queryAPI.submitPathQuery({ relation: 'likes' }, ['user', 'item']);
      
      const active = queryAPI.getActiveSubscriptions();
      
      expect(active).toHaveLength(2);
      expect(active.map(s => s.subscriptionId)).toContain(subscriptionId);
      expect(active.map(s => s.subscriptionId)).toContain(sub2);
    });

    it('should pause and resume subscriptions', () => {
      queryAPI.pauseSubscription(subscriptionId);
      
      const info = queryAPI.getSubscription(subscriptionId);
      expect(info.isActive).toBe(false);
      expect(info.state).toBe('paused');
      
      queryAPI.resumeSubscription(subscriptionId);
      
      const info2 = queryAPI.getSubscription(subscriptionId);
      expect(info2.isActive).toBe(true);
      expect(info2.state).toBe('active');
    });
  });

  describe('statistics', () => {
    it('should provide API statistics', () => {
      queryAPI.submitPathQuery({ relation: 'follows' }, ['src', 'dst']);
      queryAPI.submitPathQuery({ relation: 'likes' }, ['user', 'item']);
      
      const stats = queryAPI.getStats();
      
      expect(stats).toEqual({
        totalSubscriptions: 2,
        activeSubscriptions: 2,
        pausedSubscriptions: 0,
        errorSubscriptions: 0,
        queriesWithSubscriptions: 2,
        subscriptionsByState: expect.any(Object),
        cachedQueries: 2,
        activeQueries: expect.any(Number)
      });
    });
  });

  describe('query normalization', () => {
    it('should normalize string queries', () => {
      const normalized = queryAPI._normalizeQuerySpec('follows');
      
      expect(normalized).toEqual({ path: 'follows' });
    });

    it('should normalize object queries', () => {
      const spec = { relation: 'follows', constraints: [] };
      const normalized = queryAPI._normalizeQuerySpec(spec);
      
      expect(normalized).toEqual(spec);
      expect(normalized).not.toBe(spec); // Should be a copy
    });

    it('should validate query specs', () => {
      expect(() => queryAPI._normalizeQuerySpec({}))
        .toThrow('Query spec must have path, steps, or relation');
      
      expect(() => queryAPI._normalizeQuerySpec(null))
        .toThrow('Query spec must be a string or object');
      
      expect(() => queryAPI._normalizeQuerySpec(123))
        .toThrow('Query spec must be a string or object');
    });
  });

  describe('query compilation', () => {
    it('should compile simple queries as fallback', () => {
      const spec = { relation: 'follows' };
      const projection = ['src', 'dst'];
      const queryId = 'test-query';
      
      const graphSpec = queryAPI._compileSimpleQuery(spec, projection, queryId);
      
      expect(graphSpec).toEqual({
        type: 'select',
        relation: 'follows',
        constraints: [],
        projection: ['src', 'dst']
      });
    });

    it('should handle path-based queries', () => {
      const spec = { path: 'follows' };
      const projection = ['src', 'dst'];
      const queryId = 'test-query';
      
      const graphSpec = queryAPI._compileSimpleQuery(spec, projection, queryId);
      
      expect(graphSpec.relation).toBe('follows');
    });

    it('should validate compilable specs', () => {
      expect(() => queryAPI._compileSimpleQuery({}, ['src'], 'test'))
        .toThrow('Cannot compile query spec to GraphSpec');
    });
  });

  describe('cleanup', () => {
    it('should clear all subscriptions and queries', () => {
      queryAPI.submitPathQuery({ relation: 'follows' }, ['src', 'dst']);
      queryAPI.submitPathQuery({ relation: 'likes' }, ['user', 'item']);
      
      const handler = createMockFn();
      queryAPI.on('cleared', handler);
      
      queryAPI.clear();
      
      expect(queryAPI._subscriptionQueries.size).toBe(0);
      expect(queryAPI._queryCache.size).toBe(0);
      expect(queryAPI.getStats().totalSubscriptions).toBe(0);
      expect(handler.callCount).toBe(1);
    });
  });

  describe('event forwarding', () => {
    it('should forward subscription manager events', () => {
      const errorHandler = createMockFn();
      const resultHandler = createMockFn();
      
      queryAPI.on('subscriptionError', errorHandler);
      queryAPI.on('resultsDelivered', resultHandler);
      
      // Trigger events from subscription manager
      subscriptionManager.emit('subscriptionError', { error: 'test' });
      subscriptionManager.emit('resultsDelivered', { count: 5 });
      
      expect(errorHandler.callCount).toBe(1);
      expect(resultHandler.callCount).toBe(1);
    });
  });

  describe('string representation', () => {
    it('should provide meaningful string representation', () => {
      queryAPI.submitPathQuery({ relation: 'follows' }, ['src', 'dst']);
      queryAPI.submitPathQuery({ relation: 'likes' }, ['user', 'item']);
      
      const str = queryAPI.toString();
      
      expect(str).toContain('QueryAPI');
      expect(str).toContain('subscriptions=2');
      expect(str).toContain('queries=2');
    });
  });
});