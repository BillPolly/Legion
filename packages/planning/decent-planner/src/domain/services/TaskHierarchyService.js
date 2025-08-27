/**
 * TaskHierarchyService - Domain service for managing task hierarchies
 * Pure domain logic with no external dependencies
 */

import { Task } from '../entities/Task.js';
import { TaskComplexity } from '../value-objects/TaskComplexity.js';

export class TaskHierarchyService {
  /**
   * Traverse a task hierarchy depth-first
   */
  static traverse(rootTask, callback) {
    if (!(rootTask instanceof Task)) {
      throw new Error('Root task must be a Task instance');
    }
    
    callback(rootTask);
    
    for (const subtask of rootTask.subtasks) {
      this.traverse(subtask, callback);
    }
  }

  /**
   * Traverse a task hierarchy asynchronously
   */
  static async traverseAsync(rootTask, asyncCallback) {
    if (!(rootTask instanceof Task)) {
      throw new Error('Root task must be a Task instance');
    }
    
    await asyncCallback(rootTask);
    
    for (const subtask of rootTask.subtasks) {
      await this.traverseAsync(subtask, asyncCallback);
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
  static getSimpleTasks(rootTask) {
    const simpleTasks = [];
    
    this.traverse(rootTask, (task) => {
      if (task.isSimple()) {
        simpleTasks.push(task);
      }
    });
    
    return simpleTasks;
  }

  /**
   * Get all COMPLEX tasks in the hierarchy
   */
  static getComplexTasks(rootTask) {
    const complexTasks = [];
    
    this.traverse(rootTask, (task) => {
      if (task.isComplex()) {
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
      if (task.id.equals(taskId)) {
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