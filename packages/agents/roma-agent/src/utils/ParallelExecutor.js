/**
 * ParallelExecutor - Manages parallel task execution with dependency resolution
 * Handles concurrent limits, task timeouts, and failure tracking
 * NO MOCKS - uses real task executors
 * NO FALLBACKS - fails fast on errors
 */

export default class ParallelExecutor {
  constructor(options = {}) {
    this.maxConcurrent = options.maxConcurrent || 3;
    this.taskTimeout = options.taskTimeout;
    this.executing = new Set();
    this.completed = new Map();
    this.failed = new Map();
    this.skipped = new Set();
    this.onProgress = null;
    this.startTime = null;
    this.endTime = null;
  }
  
  /**
   * Execute tasks with parallel execution and dependency resolution
   */
  async executeTasks(tasks) {
    this.startTime = Date.now();
    const taskQueue = [...tasks];
    const results = [];
    const executingPromises = new Map();
    
    // Continue until all tasks are processed
    while (taskQueue.length > 0 || this.executing.size > 0) {
      // Start new tasks if under limit
      while (this.executing.size < this.maxConcurrent && taskQueue.length > 0) {
        const task = this.selectNextTask(taskQueue);
        
        if (task) {
          // Remove from queue
          taskQueue.splice(taskQueue.indexOf(task), 1);
          
          // Start execution
          const promise = this.startTask(task);
          executingPromises.set(task.id, promise);
        } else {
          // No executable tasks available right now
          break;
        }
      }
      
      // Wait for any task to complete if we have executing tasks
      if (this.executing.size > 0) {
        await this.waitForAnyCompletion(executingPromises);
      } else if (taskQueue.length > 0) {
        // We have tasks in queue but none can execute
        // Check if they depend on failed tasks
        const remainingTasks = [...taskQueue];
        for (const task of remainingTasks) {
          if (this.hasFailedDependencies(task)) {
            // Skip tasks with failed dependencies
            taskQueue.splice(taskQueue.indexOf(task), 1);
            this.skipped.add(task.id);
            results.push({
              taskId: task.id,
              success: false,
              error: 'Skipped due to failed dependencies',
              skipped: true
            });
            
            this.reportProgress(tasks.length);
          }
        }
        
        // If still have tasks but can't execute, break to avoid infinite loop
        if (taskQueue.length > 0 && this.executing.size === 0) {
          // These tasks have unmet dependencies that aren't being executed
          for (const task of taskQueue) {
            this.skipped.add(task.id);
            results.push({
              taskId: task.id,
              success: false,
              error: 'Dependencies not available',
              skipped: true
            });
          }
          break;
        }
      }
    }
    
    // Collect all results
    for (const [taskId, result] of this.completed) {
      results.push(result);
    }
    
    for (const [taskId, error] of this.failed) {
      results.push({
        taskId,
        success: false,
        error: error.message
      });
    }
    
    this.endTime = Date.now();
    
    return results;
  }
  
  /**
   * Start executing a task
   */
  async startTask(task) {
    this.executing.add(task.id);
    
    try {
      // Create promise with optional timeout
      let taskPromise = task.execute(task);
      
      if (this.taskTimeout) {
        taskPromise = this.withTimeout(taskPromise, this.taskTimeout);
      }
      
      const result = await taskPromise;
      
      // Mark as completed
      this.completed.set(task.id, {
        ...result,
        taskId: task.id
      });
      
      this.executing.delete(task.id);
      this.reportProgress(0); // Total will be calculated inside
      
      return result;
      
    } catch (error) {
      // Mark as failed
      this.failed.set(task.id, error);
      this.executing.delete(task.id);
      
      this.reportProgress(0);
      
      return {
        taskId: task.id,
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Add timeout to a promise
   */
  withTimeout(promise, timeoutMs) {
    return Promise.race([
      promise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Task timeout after ${timeoutMs}ms`)), timeoutMs)
      )
    ]);
  }
  
  /**
   * Wait for any executing task to complete
   */
  async waitForAnyCompletion(executingPromises) {
    if (executingPromises.size === 0) return;
    
    // Wait for at least one promise to resolve
    await Promise.race(Array.from(executingPromises.values()));
    
    // Clean up completed promises
    for (const [taskId, promise] of executingPromises) {
      if (!this.executing.has(taskId)) {
        executingPromises.delete(taskId);
      }
    }
  }
  
  /**
   * Check if a task can be executed (all dependencies met)
   */
  canExecute(task) {
    if (!task.dependencies || task.dependencies.length === 0) {
      return true;
    }
    
    // Check if any dependency failed
    if (this.hasFailedDependencies(task)) {
      return false;
    }
    
    // Check if all dependencies are completed
    return task.dependencies.every(dep => this.completed.has(dep));
  }
  
  /**
   * Check if task has failed dependencies
   */
  hasFailedDependencies(task) {
    if (!task.dependencies) return false;
    
    return task.dependencies.some(dep => 
      this.failed.has(dep) || this.skipped.has(dep)
    );
  }
  
  /**
   * Select next task to execute from queue
   */
  selectNextTask(queue) {
    // First filter by executable tasks
    const executableTasks = queue.filter(task => this.canExecute(task));
    
    if (executableTasks.length === 0) {
      return null;
    }
    
    // Sort by priority (higher priority first)
    if (executableTasks.some(task => task.priority !== undefined)) {
      executableTasks.sort((a, b) => {
        const priorityA = a.priority || 0;
        const priorityB = b.priority || 0;
        return priorityB - priorityA;
      });
    }
    
    return executableTasks[0];
  }
  
  /**
   * Report progress to callback if set
   */
  reportProgress(totalTasks) {
    if (!this.onProgress) return;
    
    const completed = this.completed.size;
    const failed = this.failed.size;
    const skipped = this.skipped.size;
    const done = completed + failed + skipped;
    const total = totalTasks || done + this.executing.size;
    
    this.onProgress({
      completed,
      failed,
      skipped,
      executing: this.executing.size,
      total,
      percentage: total > 0 ? Math.round((done / total) * 100) : 0
    });
  }
  
  /**
   * Get execution statistics
   */
  getExecutionStats() {
    return {
      total: this.completed.size + this.failed.size + this.skipped.size,
      completed: this.completed.size,
      failed: this.failed.size,
      skipped: this.skipped.size || 0,
      duration: this.endTime ? this.endTime - this.startTime : 0
    };
  }
  
  /**
   * Reset executor state
   */
  reset() {
    this.executing.clear();
    this.completed.clear();
    this.failed.clear();
    this.skipped.clear();
    this.startTime = null;
    this.endTime = null;
  }
}