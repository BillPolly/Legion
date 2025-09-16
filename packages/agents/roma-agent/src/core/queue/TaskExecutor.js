/**
 * TaskExecutor - Executes tasks with timeout and concurrency control
 * Single responsibility: Task execution and lifecycle management
 */

import { Logger } from '../../utils/Logger.js';

export class TaskExecutor {
  constructor(options = {}) {
    this.concurrency = options.concurrency || 5;
    this.defaultTimeout = options.timeout || 0; // 0 = no timeout
    this.logger = new Logger('TaskExecutor');
    
    this.running = new Map();
    this.completed = new Map();
    this.failed = new Map();
  }

  /**
   * Check if can execute more tasks
   * @returns {boolean} - True if capacity available
   */
  hasCapacity() {
    return this.running.size < this.concurrency;
  }

  /**
   * Get available execution slots
   * @returns {number} - Number of available slots
   */
  availableSlots() {
    return Math.max(0, this.concurrency - this.running.size);
  }

  /**
   * Execute a task with timeout
   * @param {Object} task - Task to execute
   * @returns {Promise<Object>} - Execution result
   */
  async execute(task) {
    if (!task || typeof task.fn !== 'function') {
      throw new Error('Invalid task: must have fn property as function');
    }

    const startTime = Date.now();
    const timeout = task.timeout || this.defaultTimeout;
    
    // Track running task
    this.running.set(task.id, {
      ...task,
      startedAt: startTime,
      status: 'running'
    });

    try {
      let result;
      
      if (timeout > 0) {
        // Execute with timeout
        result = await this.executeWithTimeout(task.fn, timeout);
      } else {
        // Execute without timeout
        result = await task.fn();
      }

      // Task completed successfully
      const endTime = Date.now();
      const completedTask = {
        ...task,
        startedAt: startTime,
        completedAt: endTime,
        duration: endTime - startTime,
        result,
        success: true,
        status: 'completed'
      };

      this.running.delete(task.id);
      this.completed.set(task.id, completedTask);

      return {
        success: true,
        task: completedTask,
        result
      };

    } catch (error) {
      // Task failed
      const endTime = Date.now();
      const failedTask = {
        ...task,
        startedAt: startTime,
        failedAt: endTime,
        duration: endTime - startTime,
        error: error.message,
        errorStack: error.stack,
        success: false,
        status: 'failed',
        isTimeout: error.message?.includes('timeout')
      };

      this.running.delete(task.id);
      this.failed.set(task.id, failedTask);

      return {
        success: false,
        task: failedTask,
        error
      };
    }
  }

  /**
   * Execute function with timeout
   * @private
   */
  async executeWithTimeout(fn, timeout) {
    return new Promise(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Task timeout after ${timeout}ms`));
      }, timeout);

      try {
        const result = await fn();
        clearTimeout(timeoutId);
        resolve(result);
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  /**
   * Cancel a running task (if supported)
   * @param {string} taskId - Task ID to cancel
   * @returns {boolean} - True if cancelled
   */
  cancel(taskId) {
    const task = this.running.get(taskId);
    if (!task) return false;

    // Mark as cancelled
    task.status = 'cancelled';
    task.cancelledAt = Date.now();
    
    this.running.delete(taskId);
    this.failed.set(taskId, {
      ...task,
      error: 'Task cancelled',
      success: false
    });

    return true;
  }

  /**
   * Cancel all running tasks
   * @returns {number} - Number of cancelled tasks
   */
  cancelAll() {
    const taskIds = Array.from(this.running.keys());
    let cancelled = 0;
    
    for (const taskId of taskIds) {
      if (this.cancel(taskId)) {
        cancelled++;
      }
    }
    
    return cancelled;
  }

  /**
   * Get task status
   * @param {string} taskId - Task ID
   * @returns {Object|null} - Task status or null
   */
  getTaskStatus(taskId) {
    return this.running.get(taskId) ||
           this.completed.get(taskId) ||
           this.failed.get(taskId) ||
           null;
  }

  /**
   * Get execution statistics
   * @returns {Object} - Execution statistics
   */
  getStatistics() {
    const completedTasks = Array.from(this.completed.values());
    const failedTasks = Array.from(this.failed.values());
    
    let totalDuration = 0;
    let minDuration = Infinity;
    let maxDuration = 0;
    let timeoutCount = 0;
    
    for (const task of completedTasks) {
      if (task.duration) {
        totalDuration += task.duration;
        minDuration = Math.min(minDuration, task.duration);
        maxDuration = Math.max(maxDuration, task.duration);
      }
    }
    
    for (const task of failedTasks) {
      if (task.isTimeout) {
        timeoutCount++;
      }
      if (task.duration) {
        totalDuration += task.duration;
      }
    }
    
    const totalExecuted = completedTasks.length + failedTasks.length;
    
    return {
      running: this.running.size,
      completed: completedTasks.length,
      failed: failedTasks.length,
      timeouts: timeoutCount,
      successRate: totalExecuted > 0 
        ? (completedTasks.length / totalExecuted) * 100
        : 0,
      averageDuration: totalExecuted > 0
        ? totalDuration / totalExecuted
        : 0,
      minDuration: minDuration === Infinity ? 0 : minDuration,
      maxDuration,
      concurrency: this.concurrency,
      utilization: (this.running.size / this.concurrency) * 100
    };
  }

  /**
   * Clear completed and failed task history
   * @param {Object} options - Clear options
   */
  clearHistory(options = {}) {
    if (options.completed !== false) {
      this.completed.clear();
    }
    if (options.failed !== false) {
      this.failed.clear();
    }
  }

  /**
   * Reset executor state
   */
  reset() {
    this.cancelAll();
    this.clearHistory();
  }
}