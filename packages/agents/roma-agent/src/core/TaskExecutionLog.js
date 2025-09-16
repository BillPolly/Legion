/**
 * TaskExecutionLog - Immutable event log for all task execution events
 * Provides complete audit trail and enables replay/debugging
 * 
 * Event-sourced architecture for complete observability and time-travel debugging
 */

import { Logger } from '../utils/Logger.js';
import {
  SNAPSHOT_INTERVAL
} from '../constants/SystemConstants.js';

export class TaskExecutionLog {
  constructor() {
    this.events = [];
    this.snapshots = new Map();
    this.subscribers = new Set();
    this.lastSnapshotTime = Date.now();
    this.snapshotInterval = SNAPSHOT_INTERVAL;
    this.logger = new Logger('TaskExecutionLog');
  }

  /**
   * Append an event to the log
   * @param {Object} event - The event to append
   * @returns {number} - Sequence ID of the event
   */
  append(event) {
    if (!event.type || !event.taskId) {
      throw new Error('Event must have type and taskId');
    }

    const sequencedEvent = {
      ...event,
      timestamp: event.timestamp || Date.now(),
      sequenceId: this.events.length,
      aggregateId: event.taskId
    };
    
    this.events.push(sequencedEvent);
    this.notifySubscribers(sequencedEvent);
    
    // Create snapshot periodically for performance
    if (this.events.length % this.snapshotInterval === 0) {
      this.createSnapshot(event.taskId);
    }
    
    return sequencedEvent.sequenceId;
  }

  /**
   * Get current state projection for a task
   * @param {string} taskId - Task ID to get projection for
   * @returns {Object} - Current state of the task
   */
  getProjection(taskId) {
    if (!taskId) {
      throw new Error('Task ID is required');
    }

    const snapshot = this.snapshots.get(taskId);
    const startIndex = snapshot ? snapshot.sequenceId + 1 : 0;
    
    const relevantEvents = this.events
      .slice(startIndex)
      .filter(e => e.aggregateId === taskId);
    
    const initialState = snapshot ? snapshot.state : this.getInitialState();
    
    return relevantEvents.reduce(
      (state, event) => this.applyEvent(state, event),
      initialState
    );
  }

  /**
   * Apply an event to a state (Event Sourcing projection)
   */
  applyEvent(state, event) {
    switch (event.type) {
      case 'TASK_CREATED':
        return {
          ...state,
          id: event.taskId,
          status: 'created',
          createdAt: event.timestamp,
          description: event.payload?.description,
          depth: event.payload?.depth || 0,
          type: event.payload?.type,
          operation: event.payload?.operation
        };
        
      case 'TASK_STARTED':
        return {
          ...state,
          status: 'executing',
          startedAt: event.timestamp,
          executionStrategy: event.payload?.strategy
        };
        
      case 'TASK_EVALUATING':
        return {
          ...state,
          status: 'evaluating',
          evaluatingAt: event.timestamp,
          evaluationType: event.payload?.evaluationType
        };
        
      case 'TASK_DECOMPOSED':
        return {
          ...state,
          status: 'decomposed',
          decomposedAt: event.timestamp,
          subtasks: event.payload?.subtasks || [],
          decompositionReason: event.payload?.reason
        };
        
      case 'TASK_COMPLETED':
        return {
          ...state,
          status: 'completed',
          completedAt: event.timestamp,
          result: event.payload?.result,
          duration: event.timestamp - (state.startedAt || event.timestamp),
          success: true
        };
        
      case 'TASK_FAILED':
        return {
          ...state,
          status: 'failed',
          failedAt: event.timestamp,
          error: event.payload?.error,
          errorStack: event.payload?.stack,
          retryCount: (state.retryCount || 0) + 1,
          success: false
        };
        
      case 'TASK_PROGRESS':
        return {
          ...state,
          progress: event.payload?.progress || 0,
          progressMessage: event.payload?.message,
          lastUpdate: event.timestamp
        };
        
      case 'TASK_RETRYING':
        return {
          ...state,
          status: 'retrying',
          retryingAt: event.timestamp,
          retryAttempt: event.payload?.attempt || 1,
          retryReason: event.payload?.reason
        };
        
      case 'SUBTASK_STARTED':
        return {
          ...state,
          activeSubtasks: [...(state.activeSubtasks || []), event.payload?.subtaskId],
          subtaskStartTimes: {
            ...state.subtaskStartTimes,
            [event.payload?.subtaskId]: event.timestamp
          }
        };
        
      case 'SUBTASK_COMPLETED':
        return {
          ...state,
          activeSubtasks: (state.activeSubtasks || []).filter(id => id !== event.payload?.subtaskId),
          completedSubtasks: [...(state.completedSubtasks || []), event.payload?.subtaskId],
          subtaskResults: {
            ...state.subtaskResults,
            [event.payload?.subtaskId]: event.payload?.result
          }
        };
        
      default:
        return state;
    }
  }

  /**
   * Get events for replay/debugging
   */
  getEventHistory(filter = {}) {
    let events = [...this.events];

    if (filter.taskId) {
      events = events.filter(e => e.aggregateId === filter.taskId);
    }
    
    if (filter.after !== undefined) {
      events = events.filter(e => e.sequenceId > filter.after);
    }
    
    if (filter.before !== undefined) {
      events = events.filter(e => e.sequenceId < filter.before);
    }
    
    if (filter.types && Array.isArray(filter.types)) {
      events = events.filter(e => filter.types.includes(e.type));
    }
    
    if (filter.startTime) {
      events = events.filter(e => e.timestamp >= filter.startTime);
    }
    
    if (filter.endTime) {
      events = events.filter(e => e.timestamp <= filter.endTime);
    }

    return events;
  }

  /**
   * Convenience accessor used by external callers
   */
  getEntries(filter = {}) {
    return this.getEventHistory(filter).map(event => ({ ...event }));
  }

  /**
   * Create snapshot for performance optimization
   */
  createSnapshot(taskId) {
    const state = this.getProjection(taskId);
    const lastEvent = this.events
      .filter(e => e.aggregateId === taskId)
      .pop();
    
    if (lastEvent) {
      this.snapshots.set(taskId, {
        state,
        sequenceId: lastEvent.sequenceId,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Subscribe to events for real-time updates
   */
  subscribe(callback, filter = {}) {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }

    const subscription = { callback, filter };
    this.subscribers.add(subscription);
    
    return () => this.subscribers.delete(subscription);
  }

  /**
   * Notify subscribers of new events
   */
  notifySubscribers(event) {
    this.subscribers.forEach(({ callback, filter }) => {
      try {
        // Apply filter if provided
        if (filter.taskId && filter.taskId !== event.taskId) {
          return;
        }
        if (filter.types && !filter.types.includes(event.type)) {
          return;
        }
        
        callback(event);
      } catch (error) {
        this.logger.error('Subscriber error', { 
          error: error.message, 
          stack: error.stack,
          eventType: event.type,
          taskId: event.taskId
        });
      }
    });
  }

  /**
   * Get initial state for a task
   */
  getInitialState() {
    return {
      id: null,
      status: 'pending',
      createdAt: null,
      startedAt: null,
      completedAt: null,
      failedAt: null,
      progress: 0,
      subtasks: [],
      activeSubtasks: [],
      completedSubtasks: [],
      subtaskResults: {},
      result: null,
      error: null,
      success: null,
      retryCount: 0,
      duration: null
    };
  }

  /**
   * Get statistics about the event log
   */
  getStats() {
    const taskIds = new Set(this.events.map(e => e.aggregateId));
    const eventTypes = {};
    
    this.events.forEach(e => {
      eventTypes[e.type] = (eventTypes[e.type] || 0) + 1;
    });
    
    return {
      totalEvents: this.events.length,
      uniqueTasks: taskIds.size,
      totalSnapshots: this.snapshots.size,
      eventTypes,
      oldestEvent: this.events[0]?.timestamp,
      newestEvent: this.events[this.events.length - 1]?.timestamp
    };
  }

  /**
   * Replay events from a specific point
   * Useful for debugging and testing
   */
  replay(fromSequenceId = 0, toSequenceId = null) {
    const endId = toSequenceId !== null ? toSequenceId : this.events.length - 1;
    
    if (fromSequenceId < 0 || endId >= this.events.length) {
      throw new Error('Invalid sequence ID range');
    }
    
    const eventsToReplay = this.events.slice(fromSequenceId, endId + 1);
    const states = new Map();
    
    eventsToReplay.forEach(event => {
      const taskId = event.aggregateId;
      const currentState = states.get(taskId) || this.getInitialState();
      const newState = this.applyEvent(currentState, event);
      states.set(taskId, newState);
    });
    
    return {
      events: eventsToReplay,
      finalStates: Object.fromEntries(states)
    };
  }

  /**
   * Clear all events and snapshots
   * Use with caution - mainly for testing
   */
  clear() {
    this.events = [];
    this.snapshots.clear();
    this.lastSnapshotTime = Date.now();
  }

  /**
   * Export events for persistence
   */
  export() {
    return {
      events: this.events,
      snapshots: Array.from(this.snapshots.entries()).map(([id, snapshot]) => ({
        taskId: id,
        ...snapshot
      })),
      metadata: {
        exportedAt: Date.now(),
        totalEvents: this.events.length,
        totalSnapshots: this.snapshots.size
      }
    };
  }

  /**
   * Import events from persistence
   */
  import(data) {
    if (!data || !data.events) {
      throw new Error('Invalid import data');
    }
    
    this.clear();
    
    this.events = data.events;
    
    if (data.snapshots) {
      data.snapshots.forEach(snapshot => {
        this.snapshots.set(snapshot.taskId, {
          state: snapshot.state,
          sequenceId: snapshot.sequenceId,
          timestamp: snapshot.timestamp
        });
      });
    }
    
    return {
      eventsImported: this.events.length,
      snapshotsImported: this.snapshots.size
    };
  }
}
