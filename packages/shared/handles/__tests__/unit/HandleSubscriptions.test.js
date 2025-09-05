/**
 * HandleSubscriptions Unit Tests
 * Test event subscription and forwarding functionality
 */

import { jest } from '@jest/globals';
import { HandleSubscriptions } from '../../src/HandleSubscriptions.js';

describe('HandleSubscriptions', () => {
  let subscriptions;
  let mockHandle;

  beforeEach(() => {
    mockHandle = {
      getGuid: jest.fn().mockReturnValue('handle-guid-123'),
      sendToActor: jest.fn()
    };
    
    subscriptions = new HandleSubscriptions(mockHandle);
  });

  describe('Local Subscription Management', () => {
    test('should add and trigger local subscriptions', () => {
      const callback = jest.fn();
      
      subscriptions.subscribe('test-event', callback);
      subscriptions.emit('test-event', { data: 'test' });
      
      expect(callback).toHaveBeenCalledWith({ data: 'test' });
    });

    test('should support multiple subscribers for same event', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      
      subscriptions.subscribe('test-event', callback1);
      subscriptions.subscribe('test-event', callback2);
      subscriptions.emit('test-event', 'data');
      
      expect(callback1).toHaveBeenCalledWith('data');
      expect(callback2).toHaveBeenCalledWith('data');
    });

    test('should return unsubscribe function', () => {
      const callback = jest.fn();
      
      const unsubscribe = subscriptions.subscribe('test-event', callback);
      subscriptions.emit('test-event', 'data1');
      
      unsubscribe();
      subscriptions.emit('test-event', 'data2');
      
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith('data1');
    });

    test('should handle unsubscribe for non-existent subscription', () => {
      const callback = jest.fn();
      
      // Should not throw error
      subscriptions.unsubscribe('non-existent-event', callback);
      
      expect(() => subscriptions.unsubscribe('test-event', callback)).not.toThrow();
    });

    test('should clean up empty event sets', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      
      subscriptions.subscribe('test-event', callback1);
      subscriptions.subscribe('test-event', callback2);
      
      subscriptions.unsubscribe('test-event', callback1);
      expect(subscriptions.hasSubscriptions('test-event')).toBe(true);
      
      subscriptions.unsubscribe('test-event', callback2);
      expect(subscriptions.hasSubscriptions('test-event')).toBe(false);
    });
  });

  describe('Remote Subscription Management', () => {
    test('should add remote subscribers by actor GUID', () => {
      subscriptions.subscribeRemote('test-event', 'remote-actor-guid');
      
      expect(subscriptions.hasRemoteSubscriptions('test-event')).toBe(true);
    });

    test('should forward events to remote subscribers', () => {
      subscriptions.subscribeRemote('test-event', 'remote-actor-guid-1');
      subscriptions.subscribeRemote('test-event', 'remote-actor-guid-2');
      
      subscriptions.emit('test-event', { data: 'remote-data' });
      
      expect(mockHandle.sendToActor).toHaveBeenCalledWith(
        'remote-actor-guid-1',
        'handle-event',
        {
          handleId: 'handle-guid-123',
          event: 'test-event',
          data: { data: 'remote-data' }
        }
      );
      
      expect(mockHandle.sendToActor).toHaveBeenCalledWith(
        'remote-actor-guid-2',
        'handle-event',
        {
          handleId: 'handle-guid-123',
          event: 'test-event',
          data: { data: 'remote-data' }
        }
      );
    });

    test('should remove remote subscribers', () => {
      subscriptions.subscribeRemote('test-event', 'remote-guid');
      expect(subscriptions.hasRemoteSubscriptions('test-event')).toBe(true);
      
      subscriptions.unsubscribeRemote('test-event', 'remote-guid');
      expect(subscriptions.hasRemoteSubscriptions('test-event')).toBe(false);
    });

    test('should handle multiple remote subscribers for same event', () => {
      subscriptions.subscribeRemote('test-event', 'guid-1');
      subscriptions.subscribeRemote('test-event', 'guid-2');
      subscriptions.subscribeRemote('test-event', 'guid-3');
      
      subscriptions.emit('test-event', 'broadcast-data');
      
      expect(mockHandle.sendToActor).toHaveBeenCalledTimes(3);
    });
  });

  describe('Combined Local and Remote Events', () => {
    test('should emit to both local and remote subscribers', () => {
      const localCallback = jest.fn();
      
      subscriptions.subscribe('mixed-event', localCallback);
      subscriptions.subscribeRemote('mixed-event', 'remote-guid');
      
      subscriptions.emit('mixed-event', 'mixed-data');
      
      expect(localCallback).toHaveBeenCalledWith('mixed-data');
      expect(mockHandle.sendToActor).toHaveBeenCalledWith(
        'remote-guid',
        'handle-event',
        {
          handleId: 'handle-guid-123',
          event: 'mixed-event',
          data: 'mixed-data'
        }
      );
    });

    test('should handle events with no subscribers gracefully', () => {
      // Should not throw error
      expect(() => subscriptions.emit('no-subscribers-event', 'data')).not.toThrow();
      
      expect(mockHandle.sendToActor).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    test('should catch and log errors in local callbacks', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const errorCallback = jest.fn().mockImplementation(() => {
        throw new Error('Callback error');
      });
      const goodCallback = jest.fn();
      
      subscriptions.subscribe('error-event', errorCallback);
      subscriptions.subscribe('error-event', goodCallback);
      
      subscriptions.emit('error-event', 'data');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error in event callback'),
        expect.any(Error)
      );
      expect(goodCallback).toHaveBeenCalledWith('data'); // Should still call other callbacks
      
      consoleSpy.mockRestore();
    });

    test('should handle sendToActor errors gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockHandle.sendToActor.mockImplementation(() => {
        throw new Error('Actor send error');
      });
      
      subscriptions.subscribeRemote('error-event', 'failing-remote-guid');
      
      expect(() => subscriptions.emit('error-event', 'data')).not.toThrow();
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });

  describe('Subscription Introspection', () => {
    test('should list all event names with subscriptions', () => {
      subscriptions.subscribe('event1', jest.fn());
      subscriptions.subscribe('event2', jest.fn());
      subscriptions.subscribeRemote('event3', 'remote-guid');
      
      const events = subscriptions.listEvents();
      
      expect(events).toContain('event1');
      expect(events).toContain('event2');
      expect(events).toContain('event3');
    });

    test('should get subscription count for events', () => {
      subscriptions.subscribe('popular-event', jest.fn());
      subscriptions.subscribe('popular-event', jest.fn());
      subscriptions.subscribeRemote('popular-event', 'guid1');
      subscriptions.subscribeRemote('popular-event', 'guid2');
      
      const count = subscriptions.getSubscriptionCount('popular-event');
      
      expect(count.local).toBe(2);
      expect(count.remote).toBe(2);
      expect(count.total).toBe(4);
    });

    test('should provide complete subscription statistics', () => {
      subscriptions.subscribe('event1', jest.fn());
      subscriptions.subscribe('event1', jest.fn());
      subscriptions.subscribe('event2', jest.fn());
      subscriptions.subscribeRemote('event2', 'guid1');
      subscriptions.subscribeRemote('event3', 'guid2');
      
      const stats = subscriptions.getStats();
      
      expect(stats.totalEvents).toBe(3);
      expect(stats.totalLocalSubscriptions).toBe(3);
      expect(stats.totalRemoteSubscriptions).toBe(2);
      expect(stats.eventsWithBothLocalAndRemote).toBe(1); // event2
    });
  });

  describe('Cleanup Operations', () => {
    test('should clear all subscriptions', () => {
      subscriptions.subscribe('event1', jest.fn());
      subscriptions.subscribe('event2', jest.fn());
      subscriptions.subscribeRemote('event3', 'guid');
      
      subscriptions.clear();
      
      expect(subscriptions.listEvents().length).toBe(0);
      expect(subscriptions.hasSubscriptions('event1')).toBe(false);
      expect(subscriptions.hasRemoteSubscriptions('event3')).toBe(false);
    });

    test('should remove all subscriptions for specific event', () => {
      subscriptions.subscribe('event1', jest.fn());
      subscriptions.subscribe('event1', jest.fn());
      subscriptions.subscribe('event2', jest.fn());
      subscriptions.subscribeRemote('event1', 'guid');
      
      subscriptions.clearEvent('event1');
      
      expect(subscriptions.hasSubscriptions('event1')).toBe(false);
      expect(subscriptions.hasRemoteSubscriptions('event1')).toBe(false);
      expect(subscriptions.hasSubscriptions('event2')).toBe(true);
    });
  });
});