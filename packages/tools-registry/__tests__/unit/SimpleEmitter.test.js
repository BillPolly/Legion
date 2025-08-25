/**
 * Unit tests for SimpleEmitter
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SimpleEmitter } from '../../src/core/SimpleEmitter.js';

describe('SimpleEmitter', () => {
  let emitter;

  beforeEach(() => {
    emitter = new SimpleEmitter();
  });

  it('should allow subscribing to events', () => {
    const callback = jest.fn();
    const unsubscribe = emitter.subscribe(callback);
    
    expect(typeof unsubscribe).toBe('function');
    expect(emitter.getSubscriberCount()).toBe(1);
  });

  it('should emit events to all subscribers', () => {
    const callback1 = jest.fn();
    const callback2 = jest.fn();
    
    emitter.subscribe(callback1);
    emitter.subscribe(callback2);
    
    emitter.emit('test-event', { data: 'test' });
    
    expect(callback1).toHaveBeenCalledWith('test-event', { data: 'test' });
    expect(callback2).toHaveBeenCalledWith('test-event', { data: 'test' });
  });

  it('should allow unsubscribing', () => {
    const callback = jest.fn();
    const unsubscribe = emitter.subscribe(callback);
    
    expect(emitter.getSubscriberCount()).toBe(1);
    
    unsubscribe();
    
    expect(emitter.getSubscriberCount()).toBe(0);
    
    emitter.emit('test-event', { data: 'test' });
    expect(callback).not.toHaveBeenCalled();
  });

  it('should handle multiple events through the same callback', () => {
    const callback = jest.fn();
    emitter.subscribe(callback);
    
    emitter.emit('event1', { type: 'first' });
    emitter.emit('event2', { type: 'second' });
    emitter.emit('event3', { type: 'third' });
    
    expect(callback).toHaveBeenCalledTimes(3);
    expect(callback).toHaveBeenCalledWith('event1', { type: 'first' });
    expect(callback).toHaveBeenCalledWith('event2', { type: 'second' });
    expect(callback).toHaveBeenCalledWith('event3', { type: 'third' });
  });

  it('should handle subscriber errors without affecting other subscribers', () => {
    const errorCallback = jest.fn(() => {
      throw new Error('Subscriber error');
    });
    const normalCallback = jest.fn();
    
    emitter.subscribe(errorCallback);
    emitter.subscribe(normalCallback);
    
    // Should not throw
    expect(() => emitter.emit('test-event', {})).not.toThrow();
    
    expect(errorCallback).toHaveBeenCalled();
    expect(normalCallback).toHaveBeenCalled();
  });

  it('should clear all subscribers', () => {
    emitter.subscribe(jest.fn());
    emitter.subscribe(jest.fn());
    emitter.subscribe(jest.fn());
    
    expect(emitter.getSubscriberCount()).toBe(3);
    
    emitter.clearSubscribers();
    
    expect(emitter.getSubscriberCount()).toBe(0);
  });

  it('should throw error for non-function callbacks', () => {
    expect(() => emitter.subscribe('not a function')).toThrow('Callback must be a function');
    expect(() => emitter.subscribe(null)).toThrow('Callback must be a function');
    expect(() => emitter.subscribe(123)).toThrow('Callback must be a function');
  });
});