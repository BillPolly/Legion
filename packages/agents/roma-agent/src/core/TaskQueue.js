/**
 * TaskQueue - Advanced task queue with automatic backpressure and concurrency control
 * Manages parallel execution with proper error handling and monitoring
 * 
 * Features:
 * - Automatic backpressure management
 * - Configurable concurrency limits
 * - Built-in timeout support
 * - Event-driven monitoring
 * - Pause/resume capability
 * - Graceful draining
 */

import { EventEmitter } from 'events';
import { Logger } from '../utils/Logger.js';
import {
  MAX_CONCURRENT_TASKS,
  DEFAULT_RETRY_LIMIT,
  DEFAULT_RETRY_DELAY,
  MAX_RETRY_DELAY,
  RETRY_JITTER_FACTOR,
  SUCCESS_RATE_PERCENTAGE,
  ID_RANDOM_SUFFIX_LENGTH,
  ID_STRING_RADIX,
  ID_SUBSTRING_START
} from '../constants/SystemConstants.js';

export class TaskQueue extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.concurrency = options.concurrency || MAX_CONCURRENT_TASKS;
    this.timeout = options.timeout || 0; // 0 = no timeout
    this.retryLimit = options.retryLimit || DEFAULT_RETRY_LIMIT;
    this.retryDelay = options.retryDelay || DEFAULT_RETRY_DELAY;
    this.logger = new Logger('TaskQueue');
    
    this.queue = [];
    this.running = new Map();
    this.completed = new Map();
    this.failed = new Map();
    
    this.paused = false;
    this.draining = false;
    
    this.stats = {
      totalAdded: 0,
      totalStarted: 0,
      totalCompleted: 0,
      totalFailed: 0,
      totalRetried: 0,
      totalTimeout: 0
    };
  }

  /**
   * Add a task to the queue
   * @param {Function} taskFn - Async function to execute
   * @param {Object} metadata - Task metadata for tracking
   * @returns {Promise} - Resolves when task completes
   */
  async add(taskFn, metadata = {}) {
    if (this.draining) {
      throw new Error('Queue is draining, cannot add new tasks');
    }

    if (typeof taskFn !== 'function') {
      throw new Error('Task must be a function');
    }

    const taskId = metadata.id || this.generateTaskId();
    this.stats.totalAdded++;
    
    const taskPromise = new Promise((resolve, reject) => {
      const task = {
        id: taskId,
        fn: taskFn,
        metadata,
        resolve,
        reject,
        addedAt: Date.now(),
        attempts: 0,
        maxAttempts: (metadata.retryLimit || this.retryLimit) + 1,
        priority: metadata.priority || 0,
        timeout: metadata.timeout || this.timeout
      };

      // Insert task based on priority
      const insertIndex = this.findInsertIndex(task.priority);
      this.queue.splice(insertIndex, 0, task);

      this.emit('queued', {
        taskId,
        priority: task.priority,
        queueLength: this.queue.length,
        running: this.running.size
      });

      // Try to execute immediately if capacity available
      this.processNext();
    });

    return taskPromise;
  }

  /**
   * Find insertion index based on priority (higher priority = earlier execution)
   */
  findInsertIndex(priority) {
    for (let i = 0; i < this.queue.length; i++) {
      if (this.queue[i].priority < priority) {
        return i;
      }
    }
    return this.queue.length;
  }

  /**
   * Execute a task with timeout and error handling
   */
  async executeTask(task) {
    if (!task) return;

    task.attempts++;
    task.startedAt = Date.now();
    
    this.running.set(task.id, task);
    this.stats.totalStarted++;
    
    this.emit('started', {
      taskId: task.id,
      attempts: task.attempts,
      running: this.running.size,
      queued: this.queue.length
    });

    try {
      let result;
      
      if (task.timeout > 0) {
        // Execute with timeout
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Task timeout after ${task.timeout}ms`));
          }, task.timeout);
        });
        
        result = await Promise.race([
          task.fn(),
          timeoutPromise
        ]);
      } else {
        // Execute without timeout
        result = await task.fn();
      }

      // Task completed successfully
      task.completedAt = Date.now();
      task.duration = task.completedAt - task.startedAt;
      task.result = result;
      task.success = true;
      
      this.running.delete(task.id);
      this.completed.set(task.id, task);
      this.stats.totalCompleted++;

      this.emit('completed', {
        taskId: task.id,
        duration: task.duration,
        attempts: task.attempts,
        result
      });

      task.resolve(result);
      
    } catch (error) {
      // Handle task failure
      task.failedAt = Date.now();
      task.duration = task.failedAt - task.startedAt;
      task.error = error;
      
      this.running.delete(task.id);
      
      const isTimeout = error.message?.includes('timeout');
      if (isTimeout) {
        this.stats.totalTimeout++;
      }

      // Check if we should retry
      if (task.attempts < task.maxAttempts && !this.draining) {
        this.stats.totalRetried++;
        
        this.emit('retrying', {
          taskId: task.id,
          attempts: task.attempts,
          maxAttempts: task.maxAttempts,
          error: error.message
        });

        // Schedule retry with exponential backoff
        const delay = this.calculateRetryDelay(task.attempts);
        setTimeout(() => {
          // Re-add to queue for retry
          this.queue.unshift(task);
          this.processNext();
        }, delay);
        
      } else {
        // Max retries exceeded or queue is draining
        task.success = false;
        this.failed.set(task.id, task);
        this.stats.totalFailed++;

        this.emit('failed', {
          taskId: task.id,
          error: error.message,
          attempts: task.attempts,
          isTimeout
        });

        task.reject(error);
      }
      
    } finally {
      // Always process next task
      this.processNext();
    }
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  calculateRetryDelay(attempt) {
    const baseDelay = this.retryDelay;
    const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), MAX_RETRY_DELAY);
    
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * RETRY_JITTER_FACTOR * delay;
    return Math.floor(delay + jitter);
  }

  /**
   * Process next task in queue
   */
  processNext() {
    if (this.paused) {
      return;
    }

    if (this.queue.length === 0) {
      if (this.running.size === 0) {
        this.emit('idle');
        
        if (this.draining) {
          this.emit('drained');
        }
      }
      return;
    }

    if (this.running.size < this.concurrency) {
      const task = this.queue.shift();
      if (task) {
        // Execute task asynchronously
        this.executeTask(task).catch(error => {
          this.logger.error('Unexpected error in task execution', {
            error: error.message,
            stack: error.stack,
            taskId: task.id,
            queueLength: this.queue.length,
            runningTasks: this.running.size
          });
        });
      }
    }
  }

  /**
   * Pause processing
   */
  pause() {
    if (!this.paused) {
      this.paused = true;
      this.emit('paused', {
        queued: this.queue.length,
        running: this.running.size
      });
    }
  }

  /**
   * Resume processing
   */
  resume() {
    if (this.paused) {
      this.paused = false;
      this.emit('resumed', {
        queued: this.queue.length,
        running: this.running.size
      });
      
      // Process queued tasks up to concurrency limit
      const tasksToProcess = Math.min(
        this.queue.length,
        this.concurrency - this.running.size
      );
      
      for (let i = 0; i < tasksToProcess; i++) {
        this.processNext();
      }
    }
  }

  /**
   * Drain the queue (process remaining, don't accept new)
   */
  async drain() {
    this.draining = true;
    this.emit('draining', {
      queued: this.queue.length,
      running: this.running.size
    });
    
    return new Promise((resolve) => {
      if (this.running.size === 0 && this.queue.length === 0) {
        resolve();
      } else {
        this.once('drained', resolve);
      }
    });
  }

  /**
   * Clear the queue
   */
  clear() {
    const cleared = [...this.queue];
    this.queue = [];
    
    cleared.forEach(task => {
      task.reject(new Error('Queue cleared'));
    });

    this.emit('cleared', {
      clearedCount: cleared.length,
      running: this.running.size
    });

    return cleared.length;
  }

  /**
   * Cancel a specific task
   */
  cancel(taskId) {
    // Check if task is in queue
    const queueIndex = this.queue.findIndex(task => task.id === taskId);
    if (queueIndex !== -1) {
      const task = this.queue.splice(queueIndex, 1)[0];
      task.reject(new Error('Task cancelled'));
      
      this.emit('cancelled', {
        taskId,
        wasQueued: true
      });
      
      return true;
    }
    
    // Check if task is running
    if (this.running.has(taskId)) {
      // Can't cancel running task, but mark it for cancellation
      const task = this.running.get(taskId);
      task.cancelled = true;
      
      this.emit('cancelled', {
        taskId,
        wasRunning: true
      });
      
      return true;
    }
    
    return false;
  }

  /**
   * Get queue statistics
   */
  getStats() {
    const completedTasks = Array.from(this.completed.values());
    const failedTasks = Array.from(this.failed.values());
    
    const totalDuration = [...completedTasks, ...failedTasks]
      .reduce((sum, task) => sum + (task.duration || 0), 0);
    
    const totalTasks = completedTasks.length + failedTasks.length;
    
    return {
      ...this.stats,
      queued: this.queue.length,
      running: this.running.size,
      completed: this.completed.size,
      failed: this.failed.size,
      averageDuration: totalTasks > 0 ? totalDuration / totalTasks : 0,
      successRate: totalTasks > 0 
        ? (completedTasks.length / totalTasks) * SUCCESS_RATE_PERCENTAGE 
        : 0,
      concurrency: this.concurrency,
      paused: this.paused,
      draining: this.draining
    };
  }

  /**
   * Get detailed status
   */
  getStatus() {
    return {
      queue: this.queue.map(task => ({
        id: task.id,
        priority: task.priority,
        attempts: task.attempts,
        addedAt: task.addedAt
      })),
      running: Array.from(this.running.values()).map(task => ({
        id: task.id,
        attempts: task.attempts,
        startedAt: task.startedAt,
        elapsed: Date.now() - task.startedAt
      })),
      stats: this.getStats()
    };
  }

  /**
   * Wait for all tasks to complete
   */
  async waitForAll() {
    if (this.running.size === 0 && this.queue.length === 0) {
      return;
    }

    return new Promise((resolve) => {
      const checkComplete = () => {
        if (this.running.size === 0 && this.queue.length === 0) {
          this.off('completed', checkComplete);
          this.off('failed', checkComplete);
          resolve();
        }
      };

      this.on('completed', checkComplete);
      this.on('failed', checkComplete);
    });
  }

  /**
   * Wait for a specific task to complete
   */
  async waitForTask(taskId) {
    // Check if already completed
    if (this.completed.has(taskId)) {
      return this.completed.get(taskId).result;
    }
    
    // Check if already failed
    if (this.failed.has(taskId)) {
      throw this.failed.get(taskId).error;
    }
    
    return new Promise((resolve, reject) => {
      const checkTask = (event) => {
        if (event.taskId === taskId) {
          this.off('completed', checkTask);
          this.off('failed', checkTask);
          
          if (this.completed.has(taskId)) {
            resolve(this.completed.get(taskId).result);
          } else if (this.failed.has(taskId)) {
            reject(this.failed.get(taskId).error);
          }
        }
      };
      
      this.on('completed', checkTask);
      this.on('failed', checkTask);
    });
  }

  /**
   * Set concurrency limit
   */
  setConcurrency(limit) {
    if (limit < 1) {
      throw new Error('Concurrency must be at least 1');
    }
    
    const oldLimit = this.concurrency;
    this.concurrency = limit;
    
    this.emit('concurrencyChanged', {
      oldLimit,
      newLimit: limit
    });
    
    // Process more tasks if concurrency increased
    if (limit > oldLimit) {
      const additionalTasks = limit - oldLimit;
      for (let i = 0; i < additionalTasks; i++) {
        this.processNext();
      }
    }
  }

  /**
   * Generate unique task ID
   */
  generateTaskId() {
    return `task-${Date.now()}-${Math.random().toString(ID_STRING_RADIX).substr(ID_SUBSTRING_START, ID_RANDOM_SUFFIX_LENGTH)}`;
  }

  /**
   * Cleanup and reset
   */
  cleanup() {
    this.clear();
    this.running.clear();
    this.completed.clear();
    this.failed.clear();
    this.removeAllListeners();
    this.paused = false;
    this.draining = false;
    
    // Reset stats
    Object.keys(this.stats).forEach(key => {
      this.stats[key] = 0;
    });
  }
}