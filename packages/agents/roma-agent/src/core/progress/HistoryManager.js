/**
 * HistoryManager - Manages event history and pruning
 * Single responsibility: History storage and lifecycle management
 */

import {
  TASK_HISTORY_RETENTION_TIME,
  MAX_HISTORY_PER_TASK,
  HISTORY_PRUNE_INTERVAL
} from '../constants/SystemConstants.js';

export class HistoryManager {
  constructor(options = {}) {
    this.history = new Map();
    this.retentionTime = options.retentionTime || TASK_HISTORY_RETENTION_TIME;
    this.maxHistoryPerTask = options.maxHistoryPerTask || MAX_HISTORY_PER_TASK;
    this.pruneInterval = options.pruneInterval || HISTORY_PRUNE_INTERVAL;
    this.pruneTimer = null;
    
    // Start automatic pruning if enabled
    if (options.autoPrune !== false) {
      this.startAutoPruning();
    }
  }

  /**
   * Add event to history
   * @param {string} taskId - Task ID
   * @param {Object} event - Event to store
   */
  addEvent(taskId, event) {
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
   * Get history for a task
   * @param {string} taskId - Task ID
   * @param {Object} options - Filter options
   * @returns {Array<Object>} - Filtered history
   */
  getHistory(taskId, options = {}) {
    let events = this.history.get(taskId) || [];
    
    // Apply time filter
    if (options.since) {
      events = events.filter(e => e.timestamp >= options.since);
    }
    
    if (options.until) {
      events = events.filter(e => e.timestamp <= options.until);
    }
    
    // Apply type filter
    if (options.types) {
      events = events.filter(e => options.types.includes(e.type));
    }
    
    // Apply status filter
    if (options.status) {
      events = events.filter(e => e.status === options.status);
    }
    
    // Apply limit
    if (options.limit) {
      events = events.slice(-options.limit);
    }
    
    return [...events]; // Return copy
  }

  /**
   * Get all histories
   * @returns {Object} - All task histories
   */
  getAllHistories() {
    const result = {};
    for (const [taskId, events] of this.history) {
      result[taskId] = [...events];
    }
    return result;
  }

  /**
   * Clear history
   * @param {string} taskId - Optional task ID to clear specific history
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
   * @returns {number} - Number of pruned events
   */
  pruneHistory() {
    const cutoff = Date.now() - this.retentionTime;
    let totalPruned = 0;
    const emptyTasks = [];
    
    for (const [taskId, events] of this.history) {
      const recentEvents = events.filter(e => e.timestamp > cutoff);
      const prunedCount = events.length - recentEvents.length;
      
      if (prunedCount > 0) {
        totalPruned += prunedCount;
        
        if (recentEvents.length === 0) {
          emptyTasks.push(taskId);
        } else {
          this.history.set(taskId, recentEvents);
        }
      }
    }
    
    // Remove empty task histories
    for (const taskId of emptyTasks) {
      this.history.delete(taskId);
    }
    
    return totalPruned;
  }

  /**
   * Start automatic pruning
   */
  startAutoPruning() {
    if (this.pruneTimer) {
      return; // Already running
    }
    
    this.pruneTimer = setInterval(() => {
      this.pruneHistory();
    }, this.pruneInterval);
  }

  /**
   * Stop automatic pruning
   */
  stopAutoPruning() {
    if (this.pruneTimer) {
      clearInterval(this.pruneTimer);
      this.pruneTimer = null;
    }
  }

  /**
   * Get statistics
   * @returns {Object} - History statistics
   */
  getStatistics() {
    let totalEvents = 0;
    let oldestEvent = null;
    let newestEvent = null;
    const taskStats = [];
    
    for (const [taskId, events] of this.history) {
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
        
        taskStats.push({
          taskId,
          eventCount: events.length,
          oldestEvent: first.timestamp,
          newestEvent: last.timestamp
        });
      }
    }
    
    return {
      totalTasks: this.history.size,
      totalEvents,
      oldestEvent: oldestEvent?.timestamp,
      newestEvent: newestEvent?.timestamp,
      retentionTime: this.retentionTime,
      maxHistoryPerTask: this.maxHistoryPerTask,
      taskStats
    };
  }

  /**
   * Export history data
   * @returns {Object} - Exportable history data
   */
  export() {
    return {
      history: Array.from(this.history.entries()).map(([taskId, events]) => ({
        taskId,
        events: [...events]
      })),
      metadata: {
        exportedAt: Date.now(),
        retentionTime: this.retentionTime,
        maxHistoryPerTask: this.maxHistoryPerTask
      }
    };
  }

  /**
   * Import history data
   * @param {Object} data - History data to import
   */
  import(data) {
    if (!data || !data.history) {
      throw new Error('Invalid history data');
    }
    
    this.history.clear();
    
    for (const { taskId, events } of data.history) {
      this.history.set(taskId, [...events]);
    }
    
    // Update settings if provided
    if (data.metadata) {
      if (data.metadata.retentionTime) {
        this.retentionTime = data.metadata.retentionTime;
      }
      if (data.metadata.maxHistoryPerTask) {
        this.maxHistoryPerTask = data.metadata.maxHistoryPerTask;
      }
    }
  }

  /**
   * Cleanup and stop
   */
  cleanup() {
    this.stopAutoPruning();
    this.history.clear();
  }
}