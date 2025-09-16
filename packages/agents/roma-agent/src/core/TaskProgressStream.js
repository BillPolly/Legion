/**
 * TaskProgressStream - Observable pattern for progress updates
 * Provides real-time progress tracking with multiple consumer support
 * 
 * Features:
 * - Multiple subscriber support
 * - Pattern-based subscriptions
 * - Historical event replay
 * - WebSocket-ready integration
 * - Memory-efficient pruning
 * - Scoped emitters for tasks
 */

import { Logger } from '../utils/Logger.js';
import {
  TASK_HISTORY_RETENTION_TIME,
  MAX_HISTORY_PER_TASK,
  HISTORY_PRUNE_INTERVAL,
  ID_RANDOM_SUFFIX_LENGTH,
  ID_STRING_RADIX,
  ID_SUBSTRING_START
} from '../constants/SystemConstants.js';

export class TaskProgressStream {
  constructor(options = {}) {
    this.observers = new Map();
    this.history = new Map();
    this.retentionTime = options.retentionTime || TASK_HISTORY_RETENTION_TIME;
    this.maxHistoryPerTask = options.maxHistoryPerTask || MAX_HISTORY_PER_TASK;
    this.pruneInterval = options.pruneInterval || HISTORY_PRUNE_INTERVAL;
    this.logger = new Logger('TaskProgressStream');
    
    // Start automatic pruning
    this.pruneTimer = setInterval(() => {
      this.pruneHistory();
    }, this.pruneInterval);
  }

  /**
   * Subscribe to progress updates
   * @param {string} pattern - Task ID or pattern (* for all, prefix* for prefix match)
   * @param {Function} observer - Callback function
   * @param {Object} options - Subscription options
   * @returns {Function} - Unsubscribe function
   */
  subscribe(pattern, observer, options = {}) {
    if (typeof observer !== 'function') {
      throw new Error('Observer must be a function');
    }

    const subscription = {
      pattern,
      observer,
      options,
      id: this.generateSubscriptionId()
    };

    if (!this.observers.has(pattern)) {
      this.observers.set(pattern, new Set());
    }
    
    this.observers.get(pattern).add(subscription);
    
    // Send historical events if requested
    if (options.includeHistory && pattern !== '*') {
      this.replayHistory(pattern, observer, options);
    }
    
    // Return unsubscribe function
    return () => {
      const observers = this.observers.get(pattern);
      if (observers) {
        observers.delete(subscription);
        if (observers.size === 0) {
          this.observers.delete(pattern);
        }
      }
    };
  }

  /**
   * Emit a progress event
   * @param {string} taskId - Task ID
   * @param {Object} event - Progress event
   */
  emit(taskId, event) {
    if (!taskId) {
      throw new Error('Task ID is required');
    }

    const enrichedEvent = {
      ...event,
      taskId,
      timestamp: event.timestamp || Date.now(),
      id: this.generateEventId()
    };

    // Store in history
    this.addToHistory(taskId, enrichedEvent);

    // Notify matching observers
    this.notifyObservers(taskId, enrichedEvent);
  }

  /**
   * Add event to history
   */
  addToHistory(taskId, event) {
    if (!this.history.has(taskId)) {
      this.history.set(taskId, []);
    }
    
    const taskHistory = this.history.get(taskId);
    taskHistory.push(event);
    
    // Limit history size per task
    if (taskHistory.length > this.maxHistoryPerTask) {
      taskHistory.shift(); // Remove oldest event
    }
  }

  /**
   * Notify all matching observers
   */
  notifyObservers(taskId, event) {
    const patterns = this.getMatchingPatterns(taskId);
    
    patterns.forEach(pattern => {
      const observers = this.observers.get(pattern);
      if (observers) {
        observers.forEach(subscription => {
          this.notifyObserver(subscription, event);
        });
      }
    });
  }

  /**
   * Get all patterns that match a task ID
   */
  getMatchingPatterns(taskId) {
    const patterns = [];
    
    // Exact match
    if (this.observers.has(taskId)) {
      patterns.push(taskId);
    }
    
    // Wildcard match
    if (this.observers.has('*')) {
      patterns.push('*');
    }
    
    // Prefix matches
    this.observers.forEach((_, pattern) => {
      if (pattern.endsWith('*') && pattern !== '*') {
        const prefix = pattern.slice(0, -1);
        if (taskId.startsWith(prefix)) {
          patterns.push(pattern);
        }
      }
    });
    
    return patterns;
  }

  /**
   * Notify an observer with error handling
   */
  notifyObserver(subscription, event) {
    const { observer, options } = subscription;
    
    // Apply filters if specified
    if (options.filter) {
      if (!this.passesFilter(event, options.filter)) {
        return;
      }
    }
    
    try {
      observer(event);
    } catch (error) {
      this.logger.error('Progress observer error', {
        error: error.message,
        stack: error.stack,
        taskId: event.taskId,
        eventType: event.type,
        removeOnError: options.removeOnError
      });
      
      // Optionally remove failing observers
      if (options.removeOnError) {
        this.removeSubscription(subscription);
      }
    }
  }

  /**
   * Check if event passes filter
   */
  passesFilter(event, filter) {
    if (filter.status && event.status !== filter.status) {
      return false;
    }
    
    if (filter.minProgress && event.progress < filter.minProgress) {
      return false;
    }
    
    if (filter.maxProgress && event.progress > filter.maxProgress) {
      return false;
    }
    
    if (filter.types && !filter.types.includes(event.type)) {
      return false;
    }
    
    return true;
  }

  /**
   * Replay history to an observer
   */
  replayHistory(taskId, observer, options = {}) {
    const history = this.getHistory(taskId);
    
    let events = history;
    
    // Apply time filter
    if (options.since) {
      events = events.filter(e => e.timestamp >= options.since);
    }
    
    // Apply limit
    if (options.limit) {
      events = events.slice(-options.limit);
    }
    
    // Replay events
    events.forEach(event => {
      try {
        observer({
          ...event,
          replayed: true
        });
      } catch (error) {
        this.logger.error('Error during history replay', {
          error: error.message,
          stack: error.stack,
          taskId: taskId,
          eventCount: events.length
        });
      }
    });
  }

  /**
   * Get progress history for a task
   */
  getHistory(taskId) {
    return this.history.get(taskId) || [];
  }

  /**
   * Get all task histories
   */
  getAllHistories() {
    const result = {};
    this.history.forEach((events, taskId) => {
      result[taskId] = [...events];
    });
    return result;
  }

  /**
   * Clear history for a task
   */
  clearHistory(taskId) {
    if (taskId) {
      this.history.delete(taskId);
    } else {
      this.history.clear();
    }
  }

  /**
   * Prune old history entries
   */
  pruneHistory() {
    const cutoff = Date.now() - this.retentionTime;
    let totalPruned = 0;
    
    for (const [taskId, events] of this.history) {
      const recentEvents = events.filter(e => e.timestamp > cutoff);
      const prunedCount = events.length - recentEvents.length;
      
      if (prunedCount > 0) {
        totalPruned += prunedCount;
        
        if (recentEvents.length === 0) {
          this.history.delete(taskId);
        } else {
          this.history.set(taskId, recentEvents);
        }
      }
    }
    
    if (totalPruned > 0) {
      this.emit('_system', {
        type: 'history_pruned',
        prunedCount: totalPruned,
        remainingTasks: this.history.size
      });
    }
    
    return totalPruned;
  }

  /**
   * Create a scoped emitter for a specific task
   */
  createTaskEmitter(taskId) {
    const self = this;
    
    return {
      emit: (event) => self.emit(taskId, event),
      
      progress: (percent, message) => self.emit(taskId, {
        status: 'progress',
        progress: percent,
        message
      }),
      
      started: (details = {}) => self.emit(taskId, {
        status: 'started',
        ...details
      }),
      
      evaluating: (type, details = {}) => self.emit(taskId, {
        status: 'evaluating',
        evaluationType: type,
        ...details
      }),
      
      decomposing: (subtaskCount, details = {}) => self.emit(taskId, {
        status: 'decomposing',
        subtaskCount,
        ...details
      }),
      
      executing: (operation, details = {}) => self.emit(taskId, {
        status: 'executing',
        operation,
        ...details
      }),
      
      aggregating: (resultsCount, details = {}) => self.emit(taskId, {
        status: 'aggregating',
        resultsCount,
        ...details
      }),
      
      completed: (result, details = {}) => self.emit(taskId, {
        status: 'completed',
        result,
        success: true,
        ...details
      }),
      
      failed: (error, details = {}) => self.emit(taskId, {
        status: 'failed',
        error: error.message || error,
        errorStack: error.stack,
        success: false,
        ...details
      }),
      
      retrying: (attempt, maxAttempts, reason) => self.emit(taskId, {
        status: 'retrying',
        attempt,
        maxAttempts,
        reason
      }),
      
      custom: (type, data) => self.emit(taskId, {
        status: 'custom',
        type,
        ...data
      })
    };
  }

  /**
   * Create a batch emitter for multiple tasks
   */
  createBatchEmitter(taskIds) {
    const emitters = {};
    taskIds.forEach(taskId => {
      emitters[taskId] = this.createTaskEmitter(taskId);
    });
    
    return {
      emit: (taskId, event) => {
        if (emitters[taskId]) {
          emitters[taskId].emit(event);
        }
      },
      
      emitAll: (event) => {
        Object.values(emitters).forEach(emitter => {
          emitter.emit(event);
        });
      },
      
      emitters
    };
  }

  /**
   * Get statistics about the progress stream
   */
  getStats() {
    let totalEvents = 0;
    let oldestEvent = null;
    let newestEvent = null;
    
    this.history.forEach(events => {
      totalEvents += events.length;
      
      if (events.length > 0) {
        const first = events[0];
        const last = events[events.length - 1];
        
        if (!oldestEvent || first.timestamp < oldestEvent.timestamp) {
          oldestEvent = first;
        }
        
        if (!newestEvent || last.timestamp > newestEvent.timestamp) {
          newestEvent = last;
        }
      }
    });
    
    return {
      totalTasks: this.history.size,
      totalEvents,
      totalObservers: this.getTotalObservers(),
      oldestEvent: oldestEvent?.timestamp,
      newestEvent: newestEvent?.timestamp,
      retentionTime: this.retentionTime,
      patterns: Array.from(this.observers.keys())
    };
  }

  /**
   * Get total number of observers
   */
  getTotalObservers() {
    let total = 0;
    this.observers.forEach(observers => {
      total += observers.size;
    });
    return total;
  }

  /**
   * Remove a specific subscription
   */
  removeSubscription(subscription) {
    const observers = this.observers.get(subscription.pattern);
    if (observers) {
      observers.delete(subscription);
      if (observers.size === 0) {
        this.observers.delete(subscription.pattern);
      }
    }
  }

  /**
   * Clear all observers for a pattern
   */
  clearObservers(pattern) {
    if (pattern) {
      this.observers.delete(pattern);
    } else {
      this.observers.clear();
    }
  }

  /**
   * Export progress data
   */
  export() {
    return {
      history: Array.from(this.history.entries()).map(([taskId, events]) => ({
        taskId,
        events
      })),
      stats: this.getStats(),
      exportedAt: Date.now()
    };
  }

  /**
   * Import progress data
   */
  import(data) {
    if (!data || !data.history) {
      throw new Error('Invalid import data');
    }
    
    this.history.clear();
    
    data.history.forEach(({ taskId, events }) => {
      this.history.set(taskId, events);
    });
    
    return {
      tasksImported: this.history.size,
      eventsImported: this.getStats().totalEvents
    };
  }

  /**
   * Generate unique subscription ID
   */
  generateSubscriptionId() {
    return `sub-${Date.now()}-${Math.random().toString(ID_STRING_RADIX).substr(ID_SUBSTRING_START, ID_RANDOM_SUFFIX_LENGTH)}`;
  }

  /**
   * Generate unique event ID
   */
  generateEventId() {
    return `evt-${Date.now()}-${Math.random().toString(ID_STRING_RADIX).substr(ID_SUBSTRING_START, ID_RANDOM_SUFFIX_LENGTH)}`;
  }

  /**
   * Cleanup and stop
   */
  cleanup() {
    if (this.pruneTimer) {
      clearInterval(this.pruneTimer);
      this.pruneTimer = null;
    }
    
    this.observers.clear();
    this.history.clear();
  }
}