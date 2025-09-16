/**
 * Test suite for TaskExecutionLog
 * Tests event sourcing, projections, snapshots, and subscriptions
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TaskExecutionLog } from '../../../src/core/TaskExecutionLog.js';

describe('TaskExecutionLog', () => {
  let log;

  beforeEach(() => {
    log = new TaskExecutionLog();
  });

  describe('Event Appending', () => {
    it('should append events with sequence IDs', () => {
      const event = {
        type: 'TASK_CREATED',
        taskId: 'task-1',
        payload: { description: 'Test task' }
      };

      const sequenceId = log.append(event);
      expect(sequenceId).toBe(0);

      const secondId = log.append({ ...event, taskId: 'task-2' });
      expect(secondId).toBe(1);
    });

    it('should enrich events with timestamp and aggregateId', () => {
      const event = {
        type: 'TASK_CREATED',
        taskId: 'task-1',
        payload: { description: 'Test task' }
      };

      log.append(event);
      const storedEvent = log.events[0];

      expect(storedEvent.timestamp).toBeDefined();
      expect(storedEvent.sequenceId).toBe(0);
      expect(storedEvent.aggregateId).toBe('task-1');
    });

    it('should reject events without type or taskId', () => {
      expect(() => log.append({ taskId: 'task-1' })).toThrow('Event must have type and taskId');
      expect(() => log.append({ type: 'TASK_CREATED' })).toThrow('Event must have type and taskId');
    });
  });

  describe('Event Projections', () => {
    it('should project task state from events', () => {
      const taskId = 'task-1';

      log.append({
        type: 'TASK_CREATED',
        taskId,
        payload: { description: 'Test task', depth: 0 }
      });

      log.append({
        type: 'TASK_STARTED',
        taskId,
        payload: { strategy: 'atomic' }
      });

      log.append({
        type: 'TASK_COMPLETED',
        taskId,
        payload: { result: { output: 'Success' } }
      });

      const projection = log.getProjection(taskId);

      expect(projection.status).toBe('completed');
      expect(projection.description).toBe('Test task');
      expect(projection.executionStrategy).toBe('atomic');
      expect(projection.result).toEqual({ output: 'Success' });
      expect(projection.success).toBe(true);
    });

    it('should handle task failure projection', () => {
      const taskId = 'task-1';

      log.append({
        type: 'TASK_CREATED',
        taskId,
        payload: { description: 'Test task' }
      });

      log.append({
        type: 'TASK_FAILED',
        taskId,
        payload: { error: 'Test error', stack: 'Error stack' }
      });

      const projection = log.getProjection(taskId);

      expect(projection.status).toBe('failed');
      expect(projection.error).toBe('Test error');
      expect(projection.errorStack).toBe('Error stack');
      expect(projection.success).toBe(false);
      expect(projection.retryCount).toBe(1);
    });

    it('should handle subtask tracking', () => {
      const taskId = 'task-1';

      log.append({
        type: 'TASK_CREATED',
        taskId,
        payload: { description: 'Parent task' }
      });

      log.append({
        type: 'TASK_DECOMPOSED',
        taskId,
        payload: { 
          subtasks: ['sub-1', 'sub-2', 'sub-3'],
          reason: 'Complex task'
        }
      });

      log.append({
        type: 'SUBTASK_STARTED',
        taskId,
        payload: { subtaskId: 'sub-1' }
      });

      log.append({
        type: 'SUBTASK_COMPLETED',
        taskId,
        payload: { 
          subtaskId: 'sub-1',
          result: { success: true }
        }
      });

      const projection = log.getProjection(taskId);

      expect(projection.status).toBe('decomposed');
      expect(projection.subtasks).toEqual(['sub-1', 'sub-2', 'sub-3']);
      expect(projection.completedSubtasks).toContain('sub-1');
      expect(projection.subtaskResults['sub-1']).toEqual({ success: true });
    });
  });

  describe('Snapshots', () => {
    it('should create snapshots periodically', () => {
      const taskId = 'task-1';
      log.snapshotInterval = 3; // Create snapshot every 3 events

      // Add 3 events
      for (let i = 0; i < 3; i++) {
        log.append({
          type: 'TASK_PROGRESS',
          taskId,
          payload: { progress: i * 33 }
        });
      }

      expect(log.snapshots.has(taskId)).toBe(true);
      const snapshot = log.snapshots.get(taskId);
      expect(snapshot.sequenceId).toBe(2); // Last event index
    });

    it('should use snapshots for projection optimization', () => {
      const taskId = 'task-1';
      
      // Create initial events
      log.append({
        type: 'TASK_CREATED',
        taskId,
        payload: { description: 'Test' }
      });

      // Create snapshot
      log.createSnapshot(taskId);
      const snapshot = log.snapshots.get(taskId);
      expect(snapshot.state.status).toBe('created');

      // Add more events after snapshot
      log.append({
        type: 'TASK_STARTED',
        taskId,
        payload: { strategy: 'atomic' }
      });

      // Projection should use snapshot + new events
      const projection = log.getProjection(taskId);
      expect(projection.status).toBe('executing');
    });
  });

  describe('Event History', () => {
    beforeEach(() => {
      // Add various events
      log.append({
        type: 'TASK_CREATED',
        taskId: 'task-1',
        payload: {}
      });
      log.append({
        type: 'TASK_STARTED',
        taskId: 'task-1',
        payload: {}
      });
      log.append({
        type: 'TASK_CREATED',
        taskId: 'task-2',
        payload: {}
      });
      log.append({
        type: 'TASK_COMPLETED',
        taskId: 'task-1',
        payload: {}
      });
    });

    it('should filter events by taskId', () => {
      const history = log.getEventHistory({ taskId: 'task-1' });
      expect(history.length).toBe(3);
      expect(history.every(e => e.aggregateId === 'task-1')).toBe(true);
    });

    it('should filter events by type', () => {
      const history = log.getEventHistory({ 
        types: ['TASK_CREATED'] 
      });
      expect(history.length).toBe(2);
      expect(history.every(e => e.type === 'TASK_CREATED')).toBe(true);
    });

    it('should filter events by sequence range', () => {
      const history = log.getEventHistory({ 
        after: 0,
        before: 3
      });
      expect(history.length).toBe(2); // Events at index 1 and 2
      expect(history[0].sequenceId).toBe(1);
      expect(history[1].sequenceId).toBe(2);
    });
  });

  describe('Subscriptions', () => {
    it('should notify subscribers of new events', () => {
      const callback = jest.fn();
      
      log.subscribe(callback);

      log.append({
        type: 'TASK_CREATED',
        taskId: 'task-1',
        payload: {}
      });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'TASK_CREATED',
          taskId: 'task-1'
        })
      );
    });

    it('should filter subscriptions by taskId', () => {
      const callback = jest.fn();
      
      log.subscribe(callback, { taskId: 'task-1' });

      log.append({
        type: 'TASK_CREATED',
        taskId: 'task-1',
        payload: {}
      });

      log.append({
        type: 'TASK_CREATED',
        taskId: 'task-2',
        payload: {}
      });

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should filter subscriptions by event types', () => {
      const callback = jest.fn();
      
      log.subscribe(callback, { 
        types: ['TASK_COMPLETED', 'TASK_FAILED'] 
      });

      log.append({
        type: 'TASK_CREATED',
        taskId: 'task-1',
        payload: {}
      });

      log.append({
        type: 'TASK_COMPLETED',
        taskId: 'task-1',
        payload: {}
      });

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should handle unsubscribe', () => {
      const callback = jest.fn();
      
      const unsubscribe = log.subscribe(callback);
      
      log.append({
        type: 'TASK_CREATED',
        taskId: 'task-1',
        payload: {}
      });

      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();

      log.append({
        type: 'TASK_STARTED',
        taskId: 'task-1',
        payload: {}
      });

      expect(callback).toHaveBeenCalledTimes(1); // Not called again
    });
  });

  describe('Replay', () => {
    beforeEach(() => {
      log.append({
        type: 'TASK_CREATED',
        taskId: 'task-1',
        payload: { description: 'Task 1' }
      });
      log.append({
        type: 'TASK_STARTED',
        taskId: 'task-1',
        payload: { strategy: 'atomic' }
      });
      log.append({
        type: 'TASK_COMPLETED',
        taskId: 'task-1',
        payload: { result: 'Success' }
      });
    });

    it('should replay events from specific point', () => {
      const replay = log.replay(1, 2);
      
      expect(replay.events.length).toBe(2);
      expect(replay.events[0].type).toBe('TASK_STARTED');
      expect(replay.events[1].type).toBe('TASK_COMPLETED');
    });

    it('should build final states during replay', () => {
      const replay = log.replay(0, 2);
      
      expect(replay.finalStates['task-1']).toBeDefined();
      expect(replay.finalStates['task-1'].status).toBe('completed');
      expect(replay.finalStates['task-1'].executionStrategy).toBe('atomic');
    });

    it('should handle invalid sequence ranges', () => {
      expect(() => log.replay(-1, 2)).toThrow('Invalid sequence ID range');
      expect(() => log.replay(0, 100)).toThrow('Invalid sequence ID range');
    });
  });

  describe('Statistics', () => {
    it('should provide event log statistics', () => {
      log.append({
        type: 'TASK_CREATED',
        taskId: 'task-1',
        payload: {}
      });
      log.append({
        type: 'TASK_STARTED',
        taskId: 'task-1',
        payload: {}
      });
      log.append({
        type: 'TASK_CREATED',
        taskId: 'task-2',
        payload: {}
      });

      const stats = log.getStats();

      expect(stats.totalEvents).toBe(3);
      expect(stats.uniqueTasks).toBe(2);
      expect(stats.eventTypes['TASK_CREATED']).toBe(2);
      expect(stats.eventTypes['TASK_STARTED']).toBe(1);
    });
  });

  describe('Import/Export', () => {
    it('should export and import event log', () => {
      // Add some events
      log.append({
        type: 'TASK_CREATED',
        taskId: 'task-1',
        payload: { description: 'Test' }
      });
      log.append({
        type: 'TASK_COMPLETED',
        taskId: 'task-1',
        payload: { result: 'Success' }
      });

      // Create snapshot
      log.createSnapshot('task-1');

      // Export
      const exported = log.export();
      expect(exported.events.length).toBe(2);
      expect(exported.snapshots.length).toBe(1);

      // Create new log and import
      const newLog = new TaskExecutionLog();
      const importResult = newLog.import(exported);

      expect(importResult.eventsImported).toBe(2);
      expect(importResult.snapshotsImported).toBe(1);

      // Verify imported data
      const projection = newLog.getProjection('task-1');
      expect(projection.status).toBe('completed');
      expect(projection.result).toBe('Success');
    });

    it('should clear before import', () => {
      log.append({
        type: 'TASK_CREATED',
        taskId: 'existing',
        payload: {}
      });

      const exportData = {
        events: [{
          type: 'TASK_CREATED',
          taskId: 'imported',
          aggregateId: 'imported',
          sequenceId: 0,
          timestamp: Date.now()
        }],
        snapshots: []
      };

      log.import(exportData);
      expect(log.events.length).toBe(1);
      expect(log.events[0].taskId).toBe('imported');
    });
  });
});