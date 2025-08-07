/**
 * Tests for EventEmitter utility
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { EventEmitter } from '../../src/utils/EventEmitter.js';

describe('EventEmitter', () => {
  let emitter;

  beforeEach(() => {
    emitter = new EventEmitter();
  });

  describe('Basic Subscription and Emission', () => {
    test('should add listeners and emit events', () => {
      const listener = jest.fn();
      emitter.on('test-event', listener);
      
      const eventData = { message: 'hello', value: 42 };
      const hadListeners = emitter.emit('test-event', eventData);
      
      expect(hadListeners).toBe(true);
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith({
        ...eventData,
        eventName: 'test-event',
        timestamp: expect.any(Number),
        source: 'EventEmitter'
      });
    });

    test('should handle events with no listeners', () => {
      const hadListeners = emitter.emit('no-listeners');
      expect(hadListeners).toBe(false);
    });

    test('should support multiple listeners for same event', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      
      emitter.on('multi-test', listener1);
      emitter.on('multi-test', listener2);
      
      emitter.emit('multi-test', { data: 'test' });
      
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    test('should support events with no data', () => {
      const listener = jest.fn();
      emitter.on('no-data', listener);
      
      emitter.emit('no-data');
      
      expect(listener).toHaveBeenCalledWith({
        eventName: 'no-data',
        timestamp: expect.any(Number),
        source: 'EventEmitter'
      });
    });
  });

  describe('Once Listeners', () => {
    test('should fire once listeners only once', () => {
      const listener = jest.fn();
      emitter.once('once-event', listener);
      
      emitter.emit('once-event', { first: true });
      emitter.emit('once-event', { second: true });
      
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        first: true,
        eventName: 'once-event'
      }));
    });

    test('should support both regular and once listeners', () => {
      const regularListener = jest.fn();
      const onceListener = jest.fn();
      
      emitter.on('mixed-event', regularListener);
      emitter.once('mixed-event', onceListener);
      
      emitter.emit('mixed-event', { first: true });
      emitter.emit('mixed-event', { second: true });
      
      expect(regularListener).toHaveBeenCalledTimes(2);
      expect(onceListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('Listener Removal', () => {
    test('should remove specific listeners', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      
      emitter.on('remove-test', listener1);
      emitter.on('remove-test', listener2);
      
      emitter.off('remove-test', listener1);
      emitter.emit('remove-test');
      
      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    test('should remove all listeners for an event', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      
      emitter.on('remove-all-test', listener1);
      emitter.once('remove-all-test', listener2);
      
      emitter.removeAllListeners('remove-all-test');
      emitter.emit('remove-all-test');
      
      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).not.toHaveBeenCalled();
    });

    test('should remove all listeners for all events', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      
      emitter.on('event1', listener1);
      emitter.on('event2', listener2);
      
      emitter.removeAllListeners();
      emitter.emit('event1');
      emitter.emit('event2');
      
      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).not.toHaveBeenCalled();
    });
  });

  describe('Event Introspection', () => {
    test('should return event names that have listeners', () => {
      emitter.on('event1', () => {});
      emitter.once('event2', () => {});
      
      const eventNames = emitter.eventNames();
      expect(eventNames).toContain('event1');
      expect(eventNames).toContain('event2');
      expect(eventNames).toHaveLength(2);
    });

    test('should count listeners correctly', () => {
      const listener1 = () => {};
      const listener2 = () => {};
      
      emitter.on('count-test', listener1);
      emitter.once('count-test', listener2);
      
      expect(emitter.listenerCount('count-test')).toBe(2);
      expect(emitter.listenerCount('no-listeners')).toBe(0);
    });

    test('should return all listeners for an event', () => {
      const listener1 = () => {};
      const listener2 = () => {};
      
      emitter.on('listeners-test', listener1);
      emitter.once('listeners-test', listener2);
      
      const listeners = emitter.listeners('listeners-test');
      expect(listeners).toContain(listener1);
      expect(listeners).toContain(listener2);
      expect(listeners).toHaveLength(2);
    });
  });

  describe('Error Handling', () => {
    test('should handle listener errors without breaking emission', () => {
      const goodListener = jest.fn();
      const badListener = jest.fn(() => { throw new Error('Listener error'); });
      const anotherGoodListener = jest.fn();
      
      emitter.on('error-test', goodListener);
      emitter.on('error-test', badListener);
      emitter.on('error-test', anotherGoodListener);
      
      // Should not throw
      expect(() => {
        emitter.emit('error-test');
      }).not.toThrow();
      
      expect(goodListener).toHaveBeenCalled();
      expect(badListener).toHaveBeenCalled();
      expect(anotherGoodListener).toHaveBeenCalled();
    });

    test('should reject invalid listeners', () => {
      expect(() => {
        emitter.on('test', 'not a function');
      }).toThrow('Listener must be a function');
      
      expect(() => {
        emitter.once('test', null);
      }).toThrow('Listener must be a function');
    });
  });

  describe('Promise-based Event Waiting', () => {
    test('should resolve when event is emitted', async () => {
      setTimeout(() => {
        emitter.emit('async-test', { data: 'resolved' });
      }, 10);
      
      const eventData = await emitter.waitForEvent('async-test');
      expect(eventData).toMatchObject({
        data: 'resolved',
        eventName: 'async-test'
      });
    });

    test('should timeout if event is not emitted', async () => {
      const promise = emitter.waitForEvent('never-emitted', 50);
      
      await expect(promise).rejects.toThrow('timeout after 50ms');
    });

    test('should not timeout if event is emitted in time', async () => {
      setTimeout(() => {
        emitter.emit('just-in-time', { success: true });
      }, 25);
      
      const eventData = await emitter.waitForEvent('just-in-time', 100);
      expect(eventData.success).toBe(true);
    });
  });

  describe('Chaining', () => {
    test('should support method chaining', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      
      const result = emitter
        .on('chain1', listener1)
        .once('chain2', listener2)
        .off('chain1', listener1)
        .removeAllListeners('chain2');
      
      expect(result).toBe(emitter);
    });
  });
});