/**
 * Test suite for TaskProgressStream
 * Tests observable pattern, subscriptions, history, and event management
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TaskProgressStream } from '../../../src/core/TaskProgressStream.js';

describe('TaskProgressStream', () => {
  let stream;

  beforeEach(() => {
    stream = new TaskProgressStream({
      retentionTime: 1000,
      maxHistoryPerTask: 10,
      pruneInterval: 100
    });
  });

  afterEach(() => {
    stream.cleanup();
  });

  describe('Event Emission', () => {
    it('should emit progress events', () => {
      const event = {
        status: 'progress',
        progress: 50,
        message: 'Halfway done'
      };

      stream.emit('task-1', event);
      
      const history = stream.getHistory('task-1');
      expect(history.length).toBe(1);
      expect(history[0].status).toBe('progress');
      expect(history[0].taskId).toBe('task-1');
      expect(history[0].timestamp).toBeDefined();
      expect(history[0].id).toBeDefined();
    });

    it('should require task ID', () => {
      expect(() => stream.emit(null, {})).toThrow('Task ID is required');
      expect(() => stream.emit('', {})).toThrow('Task ID is required');
    });

    it('should enrich events with metadata', () => {
      const event = { status: 'started' };
      
      stream.emit('task-1', event);
      
      const history = stream.getHistory('task-1');
      expect(history[0].taskId).toBe('task-1');
      expect(history[0].timestamp).toBeGreaterThan(0);
      expect(history[0].id).toMatch(/^evt-/);
    });

    it('should preserve custom timestamps', () => {
      const customTimestamp = Date.now() - 1000;
      const event = {
        status: 'completed',
        timestamp: customTimestamp
      };

      stream.emit('task-1', event);
      
      const history = stream.getHistory('task-1');
      expect(history[0].timestamp).toBe(customTimestamp);
    });
  });

  describe('Subscriptions', () => {
    it('should notify exact match subscribers', () => {
      const observer = jest.fn();
      
      stream.subscribe('task-1', observer);
      stream.emit('task-1', { status: 'progress' });
      
      expect(observer).toHaveBeenCalledTimes(1);
      expect(observer).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: 'task-1',
          status: 'progress'
        })
      );
    });

    it('should notify wildcard subscribers', () => {
      const observer = jest.fn();
      
      stream.subscribe('*', observer);
      stream.emit('task-1', { status: 'started' });
      stream.emit('task-2', { status: 'completed' });
      
      expect(observer).toHaveBeenCalledTimes(2);
    });

    it('should notify prefix match subscribers', () => {
      const observer = jest.fn();
      
      stream.subscribe('task-*', observer);
      stream.emit('task-1', { status: 'started' });
      stream.emit('task-2', { status: 'completed' });
      stream.emit('other-1', { status: 'started' });
      
      expect(observer).toHaveBeenCalledTimes(2);
    });

    it('should handle unsubscribe', () => {
      const observer = jest.fn();
      
      const unsubscribe = stream.subscribe('task-1', observer);
      stream.emit('task-1', { status: 'started' });
      
      expect(observer).toHaveBeenCalledTimes(1);
      
      unsubscribe();
      stream.emit('task-1', { status: 'completed' });
      
      expect(observer).toHaveBeenCalledTimes(1);
    });

    it('should require function observer', () => {
      expect(() => stream.subscribe('task-1', 'not a function'))
        .toThrow('Observer must be a function');
      expect(() => stream.subscribe('task-1', null))
        .toThrow('Observer must be a function');
    });

    it('should apply event filters', () => {
      const observer = jest.fn();
      
      stream.subscribe('task-1', observer, {
        filter: { status: 'completed' }
      });
      
      stream.emit('task-1', { status: 'started' });
      stream.emit('task-1', { status: 'progress', progress: 50 });
      stream.emit('task-1', { status: 'completed' });
      
      expect(observer).toHaveBeenCalledTimes(1);
      expect(observer).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'completed' })
      );
    });

    it('should filter by progress range', () => {
      const observer = jest.fn();
      
      stream.subscribe('*', observer, {
        filter: { minProgress: 50, maxProgress: 80 }
      });
      
      stream.emit('task-1', { progress: 30 });
      stream.emit('task-1', { progress: 50 });
      stream.emit('task-1', { progress: 75 });
      stream.emit('task-1', { progress: 90 });
      
      expect(observer).toHaveBeenCalledTimes(2);
    });

    it('should filter by event types', () => {
      const observer = jest.fn();
      
      stream.subscribe('*', observer, {
        filter: { types: ['error', 'warning'] }
      });
      
      stream.emit('task-1', { type: 'info' });
      stream.emit('task-1', { type: 'error' });
      stream.emit('task-1', { type: 'warning' });
      stream.emit('task-1', { type: 'debug' });
      
      expect(observer).toHaveBeenCalledTimes(2);
    });

    it('should handle observer errors gracefully', () => {
      const goodObserver = jest.fn();
      const badObserver = jest.fn(() => {
        throw new Error('Observer error');
      });
      
      stream.subscribe('task-1', badObserver);
      stream.subscribe('task-1', goodObserver);
      
      expect(() => stream.emit('task-1', { status: 'test' })).not.toThrow();
      expect(goodObserver).toHaveBeenCalled();
    });

    it('should remove failing observers if configured', () => {
      const observer = jest.fn(() => {
        throw new Error('Observer error');
      });
      
      stream.subscribe('task-1', observer, { removeOnError: true });
      
      stream.emit('task-1', { status: 'test1' });
      stream.emit('task-1', { status: 'test2' });
      
      expect(observer).toHaveBeenCalledTimes(1);
    });
  });

  describe('History Management', () => {
    it('should store event history', () => {
      stream.emit('task-1', { status: 'started' });
      stream.emit('task-1', { status: 'progress', progress: 50 });
      stream.emit('task-1', { status: 'completed' });
      
      const history = stream.getHistory('task-1');
      expect(history.length).toBe(3);
      expect(history[0].status).toBe('started');
      expect(history[2].status).toBe('completed');
    });

    it('should limit history per task', () => {
      // maxHistoryPerTask is set to 10 in beforeEach
      for (let i = 0; i < 15; i++) {
        stream.emit('task-1', { status: 'progress', progress: i });
      }
      
      const history = stream.getHistory('task-1');
      expect(history.length).toBe(10);
      expect(history[0].progress).toBe(5); // First 5 should be dropped
      expect(history[9].progress).toBe(14); // Last should be 14
    });

    it('should replay history with filters', () => {
      const observer = jest.fn();
      
      // Add some history
      stream.emit('task-1', { status: 'started' });
      stream.emit('task-1', { status: 'progress', progress: 50 });
      stream.emit('task-1', { status: 'completed' });
      
      // Subscribe with history replay
      stream.subscribe('task-1', observer, { includeHistory: true });
      
      expect(observer).toHaveBeenCalledTimes(3);
      expect(observer).toHaveBeenCalledWith(
        expect.objectContaining({ replayed: true })
      );
    });

    it('should replay history with time filter', () => {
      const observer = jest.fn();
      const now = Date.now();
      
      stream.emit('task-1', { status: 'old', timestamp: now - 2000 });
      stream.emit('task-1', { status: 'recent', timestamp: now - 500 });
      stream.emit('task-1', { status: 'current', timestamp: now });
      
      stream.replayHistory('task-1', observer, { since: now - 1000 });
      
      expect(observer).toHaveBeenCalledTimes(2);
      expect(observer).not.toHaveBeenCalledWith(
        expect.objectContaining({ status: 'old' })
      );
    });

    it('should replay history with limit', () => {
      const observer = jest.fn();
      
      for (let i = 0; i < 5; i++) {
        stream.emit('task-1', { status: 'progress', progress: i });
      }
      
      stream.replayHistory('task-1', observer, { limit: 2 });
      
      expect(observer).toHaveBeenCalledTimes(2);
      expect(observer).toHaveBeenCalledWith(
        expect.objectContaining({ progress: 3 })
      );
      expect(observer).toHaveBeenCalledWith(
        expect.objectContaining({ progress: 4 })
      );
    });

    it('should clear history for specific task', () => {
      stream.emit('task-1', { status: 'test' });
      stream.emit('task-2', { status: 'test' });
      
      stream.clearHistory('task-1');
      
      expect(stream.getHistory('task-1').length).toBe(0);
      expect(stream.getHistory('task-2').length).toBe(1);
    });

    it('should clear all history', () => {
      stream.emit('task-1', { status: 'test' });
      stream.emit('task-2', { status: 'test' });
      
      stream.clearHistory();
      
      expect(stream.getHistory('task-1').length).toBe(0);
      expect(stream.getHistory('task-2').length).toBe(0);
    });

    it('should get all histories', () => {
      stream.emit('task-1', { status: 'started' });
      stream.emit('task-2', { status: 'started' });
      stream.emit('task-1', { status: 'completed' });
      
      const allHistories = stream.getAllHistories();
      
      expect(Object.keys(allHistories).length).toBe(2);
      expect(allHistories['task-1'].length).toBe(2);
      expect(allHistories['task-2'].length).toBe(1);
    });
  });

  describe('History Pruning', () => {
    it('should prune old events', (done) => {
      const oldTimestamp = Date.now() - 2000;
      const recentTimestamp = Date.now();
      
      stream.emit('task-1', { status: 'old', timestamp: oldTimestamp });
      stream.emit('task-1', { status: 'recent', timestamp: recentTimestamp });
      
      // Wait for automatic pruning
      setTimeout(() => {
        const history = stream.getHistory('task-1');
        expect(history.length).toBe(1);
        expect(history[0].status).toBe('recent');
        done();
      }, 150);
    });

    it('should emit pruning event', () => {
      const oldTimestamp = Date.now() - 2000;
      
      stream.emit('task-1', { status: 'old', timestamp: oldTimestamp });
      stream.emit('task-2', { status: 'old', timestamp: oldTimestamp });
      
      const pruned = stream.pruneHistory();
      expect(pruned).toBe(2);
    });

    it('should delete empty task histories', () => {
      const oldTimestamp = Date.now() - 2000;
      
      stream.emit('task-1', { status: 'old', timestamp: oldTimestamp });
      stream.pruneHistory();
      
      const allHistories = stream.getAllHistories();
      expect(Object.keys(allHistories).length).toBe(0);
    });
  });

  describe('Task Emitters', () => {
    it('should create task-specific emitter', () => {
      const emitter = stream.createTaskEmitter('task-1');
      
      emitter.emit({ status: 'custom' });
      
      const history = stream.getHistory('task-1');
      expect(history.length).toBe(1);
      expect(history[0].taskId).toBe('task-1');
    });

    it('should provide convenience methods', () => {
      const emitter = stream.createTaskEmitter('task-1');
      
      emitter.started({ strategy: 'atomic' });
      emitter.progress(50, 'Halfway');
      emitter.evaluating('complexity', { depth: 2 });
      emitter.decomposing(3, { reason: 'complex' });
      emitter.executing('api_call', { endpoint: '/test' });
      emitter.aggregating(5, { method: 'merge' });
      emitter.completed({ result: 'success' });
      
      const history = stream.getHistory('task-1');
      expect(history.length).toBe(7);
      expect(history[0].status).toBe('started');
      expect(history[1].progress).toBe(50);
      expect(history[2].evaluationType).toBe('complexity');
      expect(history[3].subtaskCount).toBe(3);
      expect(history[4].operation).toBe('api_call');
      expect(history[5].resultsCount).toBe(5);
      expect(history[6].success).toBe(true);
    });

    it('should handle failure', () => {
      const emitter = stream.createTaskEmitter('task-1');
      const error = new Error('Task failed');
      error.stack = 'Error stack trace';
      
      emitter.failed(error, { code: 'ERR001' });
      
      const history = stream.getHistory('task-1');
      expect(history[0].status).toBe('failed');
      expect(history[0].error).toBe('Task failed');
      expect(history[0].errorStack).toBe('Error stack trace');
      expect(history[0].success).toBe(false);
      expect(history[0].code).toBe('ERR001');
    });

    it('should handle retry events', () => {
      const emitter = stream.createTaskEmitter('task-1');
      
      emitter.retrying(2, 5, 'Network error');
      
      const history = stream.getHistory('task-1');
      expect(history[0].status).toBe('retrying');
      expect(history[0].attempt).toBe(2);
      expect(history[0].maxAttempts).toBe(5);
      expect(history[0].reason).toBe('Network error');
    });

    it('should support custom events', () => {
      const emitter = stream.createTaskEmitter('task-1');
      
      emitter.custom('validation', {
        passed: true,
        rules: ['required', 'format']
      });
      
      const history = stream.getHistory('task-1');
      expect(history[0].status).toBe('custom');
      expect(history[0].type).toBe('validation');
      expect(history[0].passed).toBe(true);
    });
  });

  describe('Batch Emitters', () => {
    it('should create batch emitter for multiple tasks', () => {
      const batch = stream.createBatchEmitter(['task-1', 'task-2', 'task-3']);
      
      batch.emit('task-1', { status: 'started' });
      batch.emit('task-2', { status: 'started' });
      
      expect(stream.getHistory('task-1').length).toBe(1);
      expect(stream.getHistory('task-2').length).toBe(1);
      expect(stream.getHistory('task-3').length).toBe(0);
    });

    it('should emit to all tasks', () => {
      const batch = stream.createBatchEmitter(['task-1', 'task-2']);
      
      batch.emitAll({ status: 'initialized' });
      
      expect(stream.getHistory('task-1').length).toBe(1);
      expect(stream.getHistory('task-2').length).toBe(1);
      expect(stream.getHistory('task-1')[0].status).toBe('initialized');
    });

    it('should provide individual emitters', () => {
      const batch = stream.createBatchEmitter(['task-1', 'task-2']);
      
      batch.emitters['task-1'].started();
      batch.emitters['task-2'].completed({ result: 'success' });
      
      expect(stream.getHistory('task-1')[0].status).toBe('started');
      expect(stream.getHistory('task-2')[0].status).toBe('completed');
    });
  });

  describe('Statistics', () => {
    it('should provide stream statistics', () => {
      stream.emit('task-1', { status: 'started' });
      stream.emit('task-2', { status: 'started' });
      stream.emit('task-1', { status: 'completed' });
      
      const observer = jest.fn();
      stream.subscribe('task-1', observer);
      stream.subscribe('*', observer);
      
      const stats = stream.getStats();
      
      expect(stats.totalTasks).toBe(2);
      expect(stats.totalEvents).toBe(3);
      expect(stats.totalObservers).toBe(2);
      expect(stats.patterns).toContain('task-1');
      expect(stats.patterns).toContain('*');
    });

    it('should track oldest and newest events', () => {
      const now = Date.now();
      
      stream.emit('task-1', { status: 'old', timestamp: now - 1000 });
      stream.emit('task-2', { status: 'new', timestamp: now });
      
      const stats = stream.getStats();
      
      expect(stats.oldestEvent).toBe(now - 1000);
      expect(stats.newestEvent).toBe(now);
    });
  });

  describe('Import/Export', () => {
    it('should export progress data', () => {
      stream.emit('task-1', { status: 'started' });
      stream.emit('task-2', { status: 'completed' });
      
      const exported = stream.export();
      
      expect(exported.history.length).toBe(2);
      expect(exported.history[0].taskId).toBe('task-1');
      expect(exported.history[1].taskId).toBe('task-2');
      expect(exported.stats.totalEvents).toBe(2);
      expect(exported.exportedAt).toBeDefined();
    });

    it('should import progress data', () => {
      const data = {
        history: [
          { taskId: 'task-1', events: [{ status: 'imported' }] },
          { taskId: 'task-2', events: [{ status: 'imported' }] }
        ]
      };
      
      const result = stream.import(data);
      
      expect(result.tasksImported).toBe(2);
      expect(result.eventsImported).toBe(2);
      expect(stream.getHistory('task-1')[0].status).toBe('imported');
    });

    it('should validate import data', () => {
      expect(() => stream.import(null)).toThrow('Invalid import data');
      expect(() => stream.import({})).toThrow('Invalid import data');
    });

    it('should clear before import', () => {
      stream.emit('task-old', { status: 'old' });
      
      const data = {
        history: [
          { taskId: 'task-new', events: [{ status: 'new' }] }
        ]
      };
      
      stream.import(data);
      
      expect(stream.getHistory('task-old').length).toBe(0);
      expect(stream.getHistory('task-new').length).toBe(1);
    });
  });

  describe('Observer Management', () => {
    it('should clear observers for pattern', () => {
      const observer1 = jest.fn();
      const observer2 = jest.fn();
      
      stream.subscribe('task-1', observer1);
      stream.subscribe('task-2', observer2);
      
      stream.clearObservers('task-1');
      
      stream.emit('task-1', { status: 'test' });
      stream.emit('task-2', { status: 'test' });
      
      expect(observer1).not.toHaveBeenCalled();
      expect(observer2).toHaveBeenCalled();
    });

    it('should clear all observers', () => {
      const observer1 = jest.fn();
      const observer2 = jest.fn();
      
      stream.subscribe('task-1', observer1);
      stream.subscribe('*', observer2);
      
      stream.clearObservers();
      
      stream.emit('task-1', { status: 'test' });
      
      expect(observer1).not.toHaveBeenCalled();
      expect(observer2).not.toHaveBeenCalled();
    });

    it('should count total observers', () => {
      stream.subscribe('task-1', () => {});
      stream.subscribe('task-1', () => {});
      stream.subscribe('*', () => {});
      stream.subscribe('task-*', () => {});
      
      expect(stream.getTotalObservers()).toBe(4);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources', () => {
      stream.emit('task-1', { status: 'test' });
      stream.subscribe('task-1', jest.fn());
      
      stream.cleanup();
      
      expect(stream.history.size).toBe(0);
      expect(stream.observers.size).toBe(0);
      expect(stream.pruneTimer).toBeNull();
    });
  });
});