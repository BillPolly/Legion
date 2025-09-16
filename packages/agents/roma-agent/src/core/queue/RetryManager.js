/**
 * RetryManager - Handles retry logic with exponential backoff
 * Single responsibility: Retry strategy and scheduling
 */

import {
  DEFAULT_RETRY_LIMIT,
  DEFAULT_RETRY_DELAY,
  MAX_RETRY_DELAY,
  RETRY_JITTER_FACTOR
} from '../constants/SystemConstants.js';

export class RetryManager {
  constructor(options = {}) {
    this.defaultRetryLimit = options.retryLimit || DEFAULT_RETRY_LIMIT;
    this.defaultRetryDelay = options.retryDelay || DEFAULT_RETRY_DELAY;
    this.maxRetryDelay = options.maxRetryDelay || MAX_RETRY_DELAY;
    this.jitterFactor = options.jitterFactor || RETRY_JITTER_FACTOR;
    
    this.retryMap = new Map(); // Track retry attempts per task
    this.scheduledRetries = new Map(); // Track scheduled retries
  }

  /**
   * Check if task should be retried
   * @param {Object} task - Failed task
   * @param {Error} error - Failure error
   * @returns {boolean} - True if should retry
   */
  shouldRetry(task, error) {
    const maxAttempts = this.getMaxAttempts(task);
    const currentAttempts = this.getAttempts(task.id);
    
    // Check retry limit
    if (currentAttempts >= maxAttempts) {
      return false;
    }
    
    // Check if error is retryable
    if (!this.isRetryableError(error)) {
      return false;
    }
    
    // Check if task explicitly disables retries
    if (task.noRetry === true) {
      return false;
    }
    
    return true;
  }

  /**
   * Schedule a retry for a failed task
   * @param {Object} task - Failed task
   * @param {Function} retryCallback - Function to call for retry
   * @returns {Object} - Retry info
   */
  scheduleRetry(task, retryCallback) {
    const attempts = this.incrementAttempts(task.id);
    const delay = this.calculateDelay(attempts, task);
    
    const retryInfo = {
      taskId: task.id,
      attempts,
      maxAttempts: this.getMaxAttempts(task),
      delay,
      scheduledAt: Date.now(),
      executeAt: Date.now() + delay
    };
    
    // Schedule the retry
    const timeoutId = setTimeout(() => {
      this.scheduledRetries.delete(task.id);
      
      // Update task with retry metadata
      const retryTask = {
        ...task,
        attempts,
        isRetry: true,
        originalTask: task.originalTask || task,
        retryReason: task.error || 'Unknown error'
      };
      
      retryCallback(retryTask, retryInfo);
    }, delay);
    
    this.scheduledRetries.set(task.id, {
      ...retryInfo,
      timeoutId,
      callback: retryCallback
    });
    
    return retryInfo;
  }

  /**
   * Cancel scheduled retry
   * @param {string} taskId - Task ID
   * @returns {boolean} - True if cancelled
   */
  cancelRetry(taskId) {
    const scheduledRetry = this.scheduledRetries.get(taskId);
    if (!scheduledRetry) return false;
    
    clearTimeout(scheduledRetry.timeoutId);
    this.scheduledRetries.delete(taskId);
    return true;
  }

  /**
   * Cancel all scheduled retries
   * @returns {number} - Number of cancelled retries
   */
  cancelAllRetries() {
    let cancelled = 0;
    for (const taskId of this.scheduledRetries.keys()) {
      if (this.cancelRetry(taskId)) {
        cancelled++;
      }
    }
    return cancelled;
  }

  /**
   * Get retry attempts for task
   * @param {string} taskId - Task ID
   * @returns {number} - Current attempts
   */
  getAttempts(taskId) {
    return this.retryMap.get(taskId) || 0;
  }

  /**
   * Reset retry attempts for task
   * @param {string} taskId - Task ID
   */
  resetAttempts(taskId) {
    this.retryMap.delete(taskId);
    this.cancelRetry(taskId);
  }

  /**
   * Calculate retry delay with exponential backoff and jitter
   * @private
   */
  calculateDelay(attempt, task = {}) {
    const baseDelay = task.retryDelay || this.defaultRetryDelay;
    
    // Exponential backoff
    let delay = Math.min(
      baseDelay * Math.pow(2, attempt - 1),
      this.maxRetryDelay
    );
    
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * this.jitterFactor * delay;
    delay = Math.floor(delay + jitter);
    
    // Respect minimum delay
    return Math.max(delay, 100); // Minimum 100ms delay
  }

  /**
   * Get maximum attempts for task
   * @private
   */
  getMaxAttempts(task) {
    return (task.retryLimit !== undefined) 
      ? task.retryLimit 
      : this.defaultRetryLimit;
  }

  /**
   * Increment retry attempts
   * @private
   */
  incrementAttempts(taskId) {
    const current = this.getAttempts(taskId);
    const incremented = current + 1;
    this.retryMap.set(taskId, incremented);
    return incremented;
  }

  /**
   * Check if error is retryable
   * @private
   */
  isRetryableError(error) {
    if (!error) return false;
    
    const message = error.message || '';
    const nonRetryablePatterns = [
      /validation error/i,
      /invalid argument/i,
      /unauthorized/i,
      /forbidden/i,
      /not found/i,
      /bad request/i,
      /syntax error/i
    ];
    
    return !nonRetryablePatterns.some(pattern => pattern.test(message));
  }

  /**
   * Get retry statistics
   * @returns {Object} - Retry statistics
   */
  getStatistics() {
    const totalTasks = this.retryMap.size;
    const totalRetries = Array.from(this.retryMap.values()).reduce((sum, attempts) => sum + attempts, 0);
    const scheduledRetries = this.scheduledRetries.size;
    
    let maxAttempts = 0;
    let tasksWithRetries = 0;
    
    for (const attempts of this.retryMap.values()) {
      maxAttempts = Math.max(maxAttempts, attempts);
      if (attempts > 0) {
        tasksWithRetries++;
      }
    }
    
    return {
      totalTasks,
      totalRetries,
      scheduledRetries,
      maxAttempts,
      tasksWithRetries,
      retryRate: totalTasks > 0 ? (tasksWithRetries / totalTasks) * 100 : 0,
      averageRetries: totalTasks > 0 ? totalRetries / totalTasks : 0,
      defaultRetryLimit: this.defaultRetryLimit,
      defaultRetryDelay: this.defaultRetryDelay
    };
  }

  /**
   * Get next scheduled retries
   * @param {number} limit - Max number to return
   * @returns {Array<Object>} - Scheduled retries
   */
  getScheduledRetries(limit = 10) {
    const retries = Array.from(this.scheduledRetries.values())
      .map(({ timeoutId, callback, ...info }) => info)
      .sort((a, b) => a.executeAt - b.executeAt)
      .slice(0, limit);
    
    return retries;
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.cancelAllRetries();
    this.retryMap.clear();
  }
}