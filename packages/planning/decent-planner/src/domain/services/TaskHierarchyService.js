/**
 * TaskHierarchyService - Domain service for managing task hierarchies
 * Pure domain logic with no external dependencies
 */

import { Task } from '../entities/Task.js';

export class TaskHierarchyService {
  /**
   * Traverse a task hierarchy depth-first
   */
  static traverse(rootTask, callback) {
    if (!rootTask || typeof rootTask !== 'object') {
      throw new Error('Root task must be an object');
    }
    
    callback(rootTask);
    
    if (rootTask.subtasks && Array.isArray(rootTask.subtasks)) {
      for (const subtask of rootTask.subtasks) {
        this.traverse(subtask, callback);
      }
    }
  }

  /**
   * Traverse a task hierarchy asynchronously
   */
  static async traverseAsync(rootTask, asyncCallback) {
    if (!rootTask || typeof rootTask !== 'object') {
      throw new Error('Root task must be an object');
    }
    
    await asyncCallback(rootTask);
    
    if (rootTask.subtasks && Array.isArray(rootTask.subtasks)) {
      for (const subtask of rootTask.subtasks) {
        await this.traverseAsync(subtask, asyncCallback);
      }
    }
  }

  /**
   * Get all tasks at a specific depth level
   */
  static getTasksAtLevel(rootTask, level) {
    const tasks = [];
    
    this.traverse(rootTask, (task) => {
      if (task.depth === level) {
        tasks.push(task);
      }
    });
    
    return tasks;
  }

  /**
   * Get all SIMPLE tasks in the hierarchy
   */
  static getSimpleTasks(planOrTask) {
    const simpleTasks = [];
    
    // Debug logging
    console.log('[DEBUG] getSimpleTasks received:', typeof planOrTask, planOrTask ? Object.keys(planOrTask) : 'null');
    
    // Handle both plan object and direct task object
    const rootTask = planOrTask.rootTask || planOrTask;
    
    console.log('[DEBUG] rootTask:', typeof rootTask, rootTask ? Object.keys(rootTask) : 'null');
    console.log('[DEBUG] rootTask.complexity:', rootTask?.complexity);
    
    // Include root task if it's SIMPLE (handle both string and value object)
    const complexity = rootTask?.complexity?.value || rootTask?.complexity;
    if (rootTask && complexity === 'SIMPLE') {
      simpleTasks.push(rootTask);
      console.log('[DEBUG] Added SIMPLE root task to simpleTasks array');
    } else {
      console.log('[DEBUG] Root task not SIMPLE or undefined:', rootTask?.complexity);
    }
    
    // Also traverse subtasks
    if (rootTask && rootTask.subtasks && Array.isArray(rootTask.subtasks)) {
      this.traverse(rootTask, (task) => {
        const taskComplexity = task?.complexity?.value || task?.complexity;
        if (task !== rootTask && taskComplexity === 'SIMPLE') {
          simpleTasks.push(task);
        }
      });
    }
    
    console.log('[DEBUG] getSimpleTasks returning:', simpleTasks.length, 'tasks');
    return simpleTasks;
  }

  /**
   * Get all COMPLEX tasks in the hierarchy
   */
  static getComplexTasks(rootTask) {
    const complexTasks = [];
    
    this.traverse(rootTask, (task) => {
      const complexity = task?.complexity?.value || task?.complexity;
      if (complexity === 'COMPLEX') {
        complexTasks.push(task);
      }
    });
    
    return complexTasks;
  }

  /**
   * Calculate statistics for the hierarchy
   */
  static calculateStatistics(rootTask) {
    const stats = {
      totalTasks: 0,
      simpleTasks: 0,
      complexTasks: 0,
      feasibleTasks: 0,
      infeasibleTasks: 0,
      maxDepth: 0,
      averageSubtasks: 0,
      totalTools: 0
    };
    
    let complexTaskCount = 0;
    let totalSubtasks = 0;
    
    this.traverse(rootTask, (task) => {
      stats.totalTasks++;
      
      if (task.isSimple()) {
        stats.simpleTasks++;
        if (task.feasible === true) {
          stats.feasibleTasks++;
        } else if (task.feasible === false) {
          stats.infeasibleTasks++;
        }
        stats.totalTools += task.getToolCount();
      } else {
        stats.complexTasks++;
        complexTaskCount++;
        totalSubtasks += task.getSubtaskCount();
      }
      
      if (task.depth > stats.maxDepth) {
        stats.maxDepth = task.depth;
      }
    });
    
    if (complexTaskCount > 0) {
      stats.averageSubtasks = totalSubtasks / complexTaskCount;
    }
    
    return stats;
  }

  /**
   * Validate the hierarchy structure
   */
  static validateHierarchy(rootTask) {
    const errors = [];
    const warnings = [];
    
    this.traverse(rootTask, (task) => {
      // Check that SIMPLE tasks don't have subtasks
      if (task.isSimple() && task.hasSubtasks()) {
        errors.push(`SIMPLE task "${task.description}" has subtasks`);
      }
      
      // Check that COMPLEX tasks have subtasks
      if (task.isComplex() && !task.hasSubtasks()) {
        errors.push(`COMPLEX task "${task.description}" has no subtasks`);
      }
      
      // Check that only SIMPLE tasks have tools
      if (task.isComplex() && task.hasTools()) {
        errors.push(`COMPLEX task "${task.description}" has tools assigned`);
      }
      
      // Warn about deep nesting
      if (task.depth > 10) {
        warnings.push(`Task "${task.description}" is at depth ${task.depth}, which may be too deep`);
      }
      
      // Warn about too many subtasks
      if (task.getSubtaskCount() > 10) {
        warnings.push(`Task "${task.description}" has ${task.getSubtaskCount()} subtasks, which may be too many`);
      }
    });
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get the depth levels in bottom-up order
   */
  static getBottomUpLevels(rootTask) {
    const stats = this.calculateStatistics(rootTask);
    const levels = [];
    
    for (let level = stats.maxDepth; level >= 0; level--) {
      levels.push(level);
    }
    
    return levels;
  }

  /**
   * Find a task by its ID
   */
  static findTaskById(rootTask, taskId) {
    let foundTask = null;
    
    this.traverse(rootTask, (task) => {
      // Handle both Task instances and plain objects
      const taskIdStr = typeof task.id === 'object' && task.id.toString ? task.id.toString() : String(task.id);
      const targetIdStr = typeof taskId === 'object' && taskId.toString ? taskId.toString() : String(taskId);
      
      if (taskIdStr === targetIdStr) {
        foundTask = task;
      }
    });
    
    return foundTask;
  }

  /**
   * Get the parent task of a given task
   */
  static findParentTask(rootTask, childTask) {
    let parent = null;
    
    this.traverse(rootTask, (task) => {
      if (task.subtasks.includes(childTask)) {
        parent = task;
      }
    });
    
    return parent;
  }

  /**
   * Clone a task hierarchy
   */
  static cloneHierarchy(rootTask) {
    return Task.fromJSON(rootTask.toJSON());
  }
}