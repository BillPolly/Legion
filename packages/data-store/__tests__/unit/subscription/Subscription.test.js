/**
 * Unit tests for Subscription class
 * Tests live query subscription functionality per design §4
 */

import { Subscription, SubscriptionState } from '../../../src/subscription/Subscription.js';

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
  fn.mockReturnValue = (value) => {
    fn.returnValue = value;
  };
  return fn;
}

describe('Subscription', () => {
  describe('construction', () => {
    it('should create subscription with required parameters', () => {
      const callback = createMockFn();
      const subscription = new Subscription({
        subscriptionId: 'sub1',
        queryId: 'query1',
        callback
      });
      
      expect(subscription.subscriptionId).toBe('sub1');
      expect(subscription.queryId).toBe('query1');
      expect(subscription.state).toBe(SubscriptionState.PENDING);
      expect(subscription.isActive()).toBe(false);
    });

    it('should accept handler instead of callback', () => {
      const handler = createMockFn();
      const subscription = new Subscription({
        subscriptionId: 'sub1',
        queryId: 'query1',
        handler
      });
      
      expect(subscription).toBeDefined();
    });

    it('should validate required parameters', () => {
      expect(() => new Subscription({}))
        .toThrow('Subscription ID is required');
      
      expect(() => new Subscription({ subscriptionId: 'sub1' }))
        .toThrow('Query ID is required');
      
      expect(() => new Subscription({ 
        subscriptionId: 'sub1',
        queryId: 'query1'
      })).toThrow('Callback or handler is required');
    });

    it('should accept optional parameters', () => {
      const filter = (item) => item.active;
      const transform = (item) => item.name;
      const metadata = { key: 'value' };
      
      const subscription = new Subscription({
        subscriptionId: 'sub1',
        queryId: 'query1',
        callback: createMockFn(),
        filter,
        transform,
        metadata
      });
      
      expect(subscription.getMetadata()).toEqual(metadata);
    });
  });

  describe('state management', () => {
    let subscription;
    let callback;

    beforeEach(() => {
      callback = createMockFn();
      subscription = new Subscription({
        subscriptionId: 'sub1',
        queryId: 'query1',
        callback
      });
    });

    it('should activate subscription', () => {
      const activatedHandler = createMockFn();
      subscription.on('activated', activatedHandler);
      
      subscription.activate();
      
      expect(subscription.state).toBe(SubscriptionState.ACTIVE);
      expect(subscription.isActive()).toBe(true);
      expect(activatedHandler.callCount).toBe(1);
      expect(activatedHandler.calls[0][0]).toEqual({
        subscriptionId: 'sub1'
      });
    });

    it('should not reactivate active subscription', () => {
      subscription.activate();
      const activatedHandler = createMockFn();
      subscription.on('activated', activatedHandler);
      
      subscription.activate();
      
      expect(activatedHandler.callCount).toBe(0);
    });

    it('should pause active subscription', () => {
      subscription.activate();
      const pausedHandler = createMockFn();
      subscription.on('paused', pausedHandler);
      
      subscription.pause();
      
      expect(subscription.state).toBe(SubscriptionState.PAUSED);
      expect(subscription.isPaused()).toBe(true);
      expect(pausedHandler.callCount).toBe(1);
    });

    it('should only pause active subscription', () => {
      expect(() => subscription.pause())
        .toThrow('Can only pause active subscription');
    });

    it('should resume paused subscription', () => {
      subscription.activate();
      subscription.pause();
      const resumedHandler = createMockFn();
      subscription.on('resumed', resumedHandler);
      
      subscription.resume();
      
      expect(subscription.state).toBe(SubscriptionState.ACTIVE);
      expect(subscription.isActive()).toBe(true);
      expect(resumedHandler.callCount).toBe(1);
    });

    it('should only resume paused subscription', () => {
      expect(() => subscription.resume())
        .toThrow('Can only resume paused subscription');
    });

    it('should cancel subscription', () => {
      subscription.activate();
      const cancelledHandler = createMockFn();
      subscription.on('cancelled', cancelledHandler);
      
      subscription.cancel();
      
      expect(subscription.state).toBe(SubscriptionState.CANCELLED);
      expect(subscription.isCancelled()).toBe(true);
      expect(cancelledHandler.callCount).toBe(1);
    });

    it('should not activate cancelled subscription', () => {
      subscription.cancel();
      
      expect(() => subscription.activate())
        .toThrow('Cannot activate cancelled subscription');
    });

    it('should clear results on cancel', () => {
      subscription.activate();
      subscription.handleResults([
        { id: 1, name: 'item1' },
        { id: 2, name: 'item2' }
      ]);
      
      subscription.cancel();
      
      expect(subscription.getResults()).toEqual([]);
    });
  });

  describe('result handling', () => {
    let subscription;
    let callback;

    beforeEach(() => {
      callback = createMockFn();
      subscription = new Subscription({
        subscriptionId: 'sub1',
        queryId: 'query1',
        callback
      });
      subscription.activate();
    });

    it('should handle initial results (bootstrap)', () => {
      const results = [
        { id: 1, name: 'item1' },
        { id: 2, name: 'item2' }
      ];
      
      subscription.handleResults(results);
      
      expect(subscription.getResults()).toEqual(results);
      expect(callback.callCount).toBe(1);
      expect(callback.calls[0][0]).toEqual({
        type: 'bootstrap',
        results,
        timestamp: expect.any(Number)
      });
    });

    it('should validate results array', () => {
      expect(() => subscription.handleResults('not-array'))
        .toThrow('Results must be an array');
    });

    it('should apply filter to results', () => {
      const filter = (item) => item.active;
      subscription = new Subscription({
        subscriptionId: 'sub1',
        queryId: 'query1',
        callback,
        filter
      });
      subscription.activate();
      
      const results = [
        { id: 1, name: 'item1', active: true },
        { id: 2, name: 'item2', active: false },
        { id: 3, name: 'item3', active: true }
      ];
      
      subscription.handleResults(results);
      
      expect(subscription.getResults()).toEqual([
        { id: 1, name: 'item1', active: true },
        { id: 3, name: 'item3', active: true }
      ]);
    });

    it('should apply transform to results', () => {
      const transform = (item) => ({ ...item, transformed: true });
      subscription = new Subscription({
        subscriptionId: 'sub1',
        queryId: 'query1',
        callback,
        transform
      });
      subscription.activate();
      
      const results = [
        { id: 1, name: 'item1' },
        { id: 2, name: 'item2' }
      ];
      
      subscription.handleResults(results);
      
      const transformed = subscription.getResults();
      expect(transformed[0].transformed).toBe(true);
      expect(transformed[1].transformed).toBe(true);
    });

    it('should clear existing results on bootstrap', () => {
      subscription.handleResults([{ id: 1 }, { id: 2 }]);
      subscription.handleResults([{ id: 3 }, { id: 4 }]);
      
      expect(subscription.getResults()).toEqual([
        { id: 3 },
        { id: 4 }
      ]);
    });
  });

  describe('update handling', () => {
    let subscription;
    let callback;

    beforeEach(() => {
      callback = createMockFn();
      subscription = new Subscription({
        subscriptionId: 'sub1',
        queryId: 'query1',
        callback
      });
      subscription.activate();
      
      // Bootstrap with initial results
      subscription.handleResults([
        { id: 1, name: 'item1' },
        { id: 2, name: 'item2' }
      ]);
      callback.mockClear();
    });

    it('should handle add update', () => {
      const update = {
        type: 'add',
        data: { id: 3, name: 'item3' }
      };
      
      subscription.handleUpdate(update);
      
      expect(subscription.getResults()).toHaveLength(3);
      expect(callback.callCount).toBe(1);
      expect(callback.calls[0][0]).toEqual({
        type: 'update',
        update: {
          type: 'add',
          data: { id: 3, name: 'item3' }
        },
        timestamp: expect.any(Number)
      });
    });

    it('should handle remove update', () => {
      const update = {
        type: 'remove',
        data: { id: 1, name: 'item1' }
      };
      
      subscription.handleUpdate(update);
      
      expect(subscription.getResults()).toHaveLength(1);
      expect(callback.callCount).toBe(1);
      expect(callback.calls[0][0]).toEqual({
        type: 'update',
        update: {
          type: 'remove',
          data: { id: 1, name: 'item1' }
        },
        timestamp: expect.any(Number)
      });
    });

    it('should handle modify update', () => {
      const update = {
        type: 'modify',
        data: { id: 1, name: 'item1-modified' }
      };
      
      subscription.handleUpdate(update);
      
      expect(subscription.getResults()).toHaveLength(2);
      expect(callback.callCount).toBe(1);
      expect(callback.calls[0][0]).toEqual({
        type: 'update',
        update: {
          type: 'modify',
          oldData: { id: 1, name: 'item1' },
          newData: { id: 1, name: 'item1-modified' }
        },
        timestamp: expect.any(Number)
      });
    });

    it('should queue updates when not active', () => {
      subscription.pause();
      
      subscription.handleUpdate({
        type: 'add',
        data: { id: 3, name: 'item3' }
      });
      
      expect(callback.callCount).toBe(0);
      expect(subscription.getResults()).toHaveLength(2); // Not processed yet
      
      // Resume should process pending
      subscription.resume();
      
      expect(callback.callCount).toBe(1);
      expect(callback.calls[0][0]).toEqual({
        type: 'batch_update',
        updates: expect.any(Array),
        timestamp: expect.any(Number)
      });
      expect(subscription.getResults()).toHaveLength(3);
    });

    it('should validate update', () => {
      expect(() => subscription.handleUpdate())
        .toThrow('Update is required');
    });

    it('should apply filter to updates', () => {
      subscription = new Subscription({
        subscriptionId: 'sub1',
        queryId: 'query1',
        callback,
        filter: (item) => item.active
      });
      subscription.activate();
      
      // Add an item that doesn't pass filter
      subscription.handleUpdate({
        type: 'add',
        data: { id: 3, active: false }
      });
      
      // The update is delivered but processedUpdate is null (filtered out)
      // So we need to check that the item wasn't added to results
      expect(subscription.getResults()).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    let subscription;
    let callback;

    beforeEach(() => {
      callback = createMockFn();
      subscription = new Subscription({
        subscriptionId: 'sub1',
        queryId: 'query1',
        callback
      });
      subscription.activate();
    });

    it('should handle errors', () => {
      const errorHandler = createMockFn();
      subscription.on('error', errorHandler);
      
      const error = new Error('Test error');
      subscription.handleError(error);
      
      expect(errorHandler.callCount).toBe(1);
      expect(errorHandler.calls[0][0]).toEqual({
        subscriptionId: 'sub1',
        error,
        errorCount: 1
      });
      
      expect(callback.callCount).toBe(1);
      expect(callback.calls[0][0]).toEqual({
        type: 'error',
        error,
        timestamp: expect.any(Number)
      });
    });

    it('should transition to error state after threshold', () => {
      // Add error handler to prevent unhandled error
      subscription.on('error', () => {});
      
      const error = new Error('Test error');
      
      subscription.handleError(error);
      expect(subscription.hasError()).toBe(false);
      
      subscription.handleError(error);
      subscription.handleError(error);
      subscription.handleError(error);
      
      expect(subscription.hasError()).toBe(true);
      expect(subscription.state).toBe(SubscriptionState.ERROR);
    });

    it('should handle callback errors', () => {
      callback.mockImplementation = () => {
        throw new Error('Callback error');
      };
      
      const errorHandler = createMockFn();
      subscription.on('error', errorHandler);
      
      subscription.handleResults([{ id: 1 }]);
      
      expect(errorHandler.callCount).toBeGreaterThan(0);
    });
  });

  describe('statistics', () => {
    let subscription;

    beforeEach(() => {
      subscription = new Subscription({
        subscriptionId: 'sub1',
        queryId: 'query1',
        callback: createMockFn()
      });
    });

    it('should provide subscription statistics', () => {
      const stats = subscription.getStats();
      
      expect(stats).toEqual({
        subscriptionId: 'sub1',
        queryId: 'query1',
        state: SubscriptionState.PENDING,
        createdAt: expect.any(Number),
        activatedAt: null,
        lastUpdateAt: null,
        updateCount: 0,
        errorCount: 0,
        resultCount: 0,
        pendingUpdateCount: 0
      });
    });

    it('should track activation time', () => {
      subscription.activate();
      
      const stats = subscription.getStats();
      expect(stats.activatedAt).toBeGreaterThan(0);
    });

    it('should track update count and time', () => {
      subscription.activate();
      subscription.handleResults([{ id: 1 }]);
      subscription.handleUpdate({ type: 'add', data: { id: 2 } });
      
      const stats = subscription.getStats();
      expect(stats.updateCount).toBe(2);
      expect(stats.lastUpdateAt).toBeGreaterThan(0);
    });

    it('should track error count', () => {
      // Add error handler to prevent unhandled error
      subscription.on('error', () => {});
      
      subscription.handleError(new Error('Test'));
      subscription.handleError(new Error('Test'));
      
      const stats = subscription.getStats();
      expect(stats.errorCount).toBe(2);
    });
  });

  describe('metadata management', () => {
    let subscription;

    beforeEach(() => {
      subscription = new Subscription({
        subscriptionId: 'sub1',
        queryId: 'query1',
        callback: createMockFn(),
        metadata: { initial: 'value' }
      });
    });

    it('should get metadata', () => {
      expect(subscription.getMetadata()).toEqual({ initial: 'value' });
    });

    it('should set metadata', () => {
      subscription.setMetadata('key', 'value');
      
      expect(subscription.getMetadata()).toEqual({
        initial: 'value',
        key: 'value'
      });
    });

    it('should support custom key function', () => {
      subscription.setMetadata('keyFunction', (item) => item.id);
      subscription.activate();
      
      subscription.handleResults([
        { id: 1, name: 'item1' },
        { id: 1, name: 'duplicate' }, // Same ID
        { id: 2, name: 'item2' }
      ]);
      
      // Should dedupe by ID
      expect(subscription.getResults()).toHaveLength(2);
    });
  });

  describe('utility methods', () => {
    let subscription;

    beforeEach(() => {
      subscription = new Subscription({
        subscriptionId: 'sub1',
        queryId: 'query1',
        callback: createMockFn()
      });
    });

    it('should clear results', () => {
      subscription.activate();
      subscription.handleResults([{ id: 1 }, { id: 2 }]);
      
      subscription.clearResults();
      
      expect(subscription.getResults()).toEqual([]);
      const stats = subscription.getStats();
      expect(stats.updateCount).toBe(0);
      expect(stats.lastUpdateAt).toBe(null);
    });

    it('should provide string representation', () => {
      const str = subscription.toString();
      
      expect(str).toContain('Subscription');
      expect(str).toContain('sub1');
      expect(str).toContain('query1');
      expect(str).toContain('pending');
    });

    it('should support method chaining', () => {
      const result = subscription
        .activate()
        .setMetadata('key', 'value')
        .handleResults([])
        .pause()
        .resume()
        .cancel();
      
      expect(result).toBe(subscription);
    });
  });
});