/**
 * InMemoryTaskRepository - Infrastructure adapter for in-memory task storage
 * Implements the TaskRepository port
 */

import { TaskRepository } from '../../application/ports/TaskRepository.js';
import { Task } from '../../domain/entities/Task.js';
import { TaskHierarchyService } from '../../domain/services/TaskHierarchyService.js';

export class InMemoryTaskRepository extends TaskRepository {
  constructor() {
    super();
    this.tasks = new Map();
  }

  async save(task) {
    if (!(task instanceof Task)) {
      throw new Error('Must provide a Task instance');
    }
    
    const taskCopy = Task.fromJSON(task.toJSON());
    this.tasks.set(task.id.toString(), taskCopy);
    return taskCopy;
  }

  async findById(taskId) {
    const task = this.tasks.get(taskId.toString());
    return task ? Task.fromJSON(task.toJSON()) : null;
  }

  async findByParentId(parentId) {
    const results = [];
    
    for (const task of this.tasks.values()) {
      if (task.parentId && task.parentId.equals(parentId)) {
        results.push(Task.fromJSON(task.toJSON()));
      }
    }
    
    return results;
  }

  async findByComplexity(complexity) {
    const results = [];
    
    for (const task of this.tasks.values()) {
      if (task.complexity.equals(complexity)) {
        results.push(Task.fromJSON(task.toJSON()));
      }
    }
    
    return results;
  }

  async update(task) {
    if (!(task instanceof Task)) {
      throw new Error('Must provide a Task instance');
    }
    
    if (!this.tasks.has(task.id.toString())) {
      throw new Error(`Task with id ${task.id} not found`);
    }
    
    const taskCopy = Task.fromJSON(task.toJSON());
    this.tasks.set(task.id.toString(), taskCopy);
    return taskCopy;
  }

  async delete(taskId) {
    return this.tasks.delete(taskId.toString());
  }

  async saveHierarchy(rootTask) {
    if (!(rootTask instanceof Task)) {
      throw new Error('Must provide a Task instance');
    }
    
    // Save all tasks in the hierarchy
    await TaskHierarchyService.traverseAsync(rootTask, async (task) => {
      await this.save(task);
    });
    
    return rootTask;
  }

  async loadHierarchy(rootTaskId) {
    const rootTask = await this.findById(rootTaskId);
    if (!rootTask) {
      throw new Error(`Root task with id ${rootTaskId} not found`);
    }
    
    // Recursively load subtasks
    await this.loadSubtasks(rootTask);
    
    return rootTask;
  }

  async loadSubtasks(task) {
    const children = await this.findByParentId(task.id);
    
    for (const child of children) {
      await this.loadSubtasks(child);
      task.addSubtask(child);
    }
  }

  // Helper method for testing
  clear() {
    this.tasks.clear();
  }

  // Helper method for testing
  size() {
    return this.tasks.size;
  }
}