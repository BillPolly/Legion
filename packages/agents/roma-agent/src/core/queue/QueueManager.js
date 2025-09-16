/**
 * QueueManager - Manages task queue with priority ordering
 * Single responsibility: Queue data structure and priority management
 */

import {
  ID_RANDOM_SUFFIX_LENGTH,
  ID_STRING_RADIX,
  ID_SUBSTRING_START
} from '../constants/SystemConstants.js';

export class QueueManager {
  constructor() {
    this.queue = [];
    this.taskMap = new Map();
  }

  /**
   * Add task to queue based on priority
   * @param {Object} task - Task object with priority
   * @returns {string} - Task ID
   */
  enqueue(task) {
    const taskId = task.id || this.generateTaskId();
    const taskWithId = { ...task, id: taskId };
    
    // Insert based on priority (higher priority = earlier execution)
    const insertIndex = this.findInsertIndex(task.priority || 0);
    this.queue.splice(insertIndex, 0, taskWithId);
    this.taskMap.set(taskId, taskWithId);
    
    return taskId;
  }

  /**
   * Remove and return next task
   * @returns {Object|null} - Next task or null if empty
   */
  dequeue() {
    const task = this.queue.shift();
    if (task) {
      this.taskMap.delete(task.id);
    }
    return task || null;
  }

  /**
   * Peek at next task without removing
   * @returns {Object|null} - Next task or null if empty
   */
  peek() {
    return this.queue[0] || null;
  }

  /**
   * Requeue task at front (for retries)
   * @param {Object} task - Task to requeue
   */
  requeue(task) {
    this.queue.unshift(task);
    this.taskMap.set(task.id, task);
  }

  /**
   * Get task by ID
   * @param {string} taskId - Task ID
   * @returns {Object|null} - Task or null if not found
   */
  getTask(taskId) {
    return this.taskMap.get(taskId) || null;
  }

  /**
   * Remove task by ID
   * @param {string} taskId - Task ID
   * @returns {boolean} - True if removed
   */
  removeTask(taskId) {
    const task = this.taskMap.get(taskId);
    if (!task) return false;
    
    const index = this.queue.indexOf(task);
    if (index >= 0) {
      this.queue.splice(index, 1);
      this.taskMap.delete(taskId);
      return true;
    }
    return false;
  }

  /**
   * Get all tasks matching filter
   * @param {Function} filterFn - Filter function
   * @returns {Array<Object>} - Matching tasks
   */
  getTasks(filterFn) {
    if (!filterFn) return [...this.queue];
    return this.queue.filter(filterFn);
  }

  /**
   * Get queue size
   * @returns {number} - Queue size
   */
  size() {
    return this.queue.length;
  }

  /**
   * Check if queue is empty
   * @returns {boolean} - True if empty
   */
  isEmpty() {
    return this.queue.length === 0;
  }

  /**
   * Clear the queue
   */
  clear() {
    this.queue = [];
    this.taskMap.clear();
  }

  /**
   * Find insertion index based on priority
   * @private
   */
  findInsertIndex(priority) {
    for (let i = 0; i < this.queue.length; i++) {
      if ((this.queue[i].priority || 0) < priority) {
        return i;
      }
    }
    return this.queue.length;
  }

  /**
   * Generate unique task ID
   * @private
   */
  generateTaskId() {
    return `task-${Date.now()}-${Math.random()
      .toString(ID_STRING_RADIX)
      .substr(ID_SUBSTRING_START, ID_RANDOM_SUFFIX_LENGTH)}`;
  }

  /**
   * Get queue statistics
   * @returns {Object} - Queue statistics
   */
  getStatistics() {
    const priorities = {};
    let totalWaitTime = 0;
    const now = Date.now();
    
    for (const task of this.queue) {
      const priority = task.priority || 0;
      priorities[priority] = (priorities[priority] || 0) + 1;
      
      if (task.addedAt) {
        totalWaitTime += now - task.addedAt;
      }
    }
    
    return {
      size: this.queue.length,
      priorities,
      averageWaitTime: this.queue.length > 0 
        ? totalWaitTime / this.queue.length 
        : 0,
      oldestTask: this.queue.length > 0 
        ? now - (this.queue[this.queue.length - 1].addedAt || now)
        : 0
    };
  }
}