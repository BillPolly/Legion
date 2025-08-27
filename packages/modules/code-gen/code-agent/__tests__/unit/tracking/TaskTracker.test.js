/**
 * Tests for TaskTracker class
 * 
 * TaskTracker is responsible for creating, managing, and tracking tasks
 * throughout the code generation process.
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { TaskTracker } from '../../../src/tracking/TaskTracker.js';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';

describe('TaskTracker', () => {
  let tracker;

  beforeEach(() => {
    tracker = new TaskTracker();
  });

  afterEach(() => {
    // Clean up any temporary files or state
    tracker.clear();
  });

  describe('Constructor', () => {
    test('should create TaskTracker with default configuration', () => {
      expect(tracker).toBeDefined();
      expect(tracker.config).toBeDefined();
      expect(tracker.config.autoSave).toBe(true);
      expect(tracker.config.persistToFile).toBe(true);
    });

    test('should accept custom configuration', () => {
      const customTracker = new TaskTracker({
        autoSave: false,
        persistToFile: false,
        maxTasks: 1000
      });

      expect(customTracker.config.autoSave).toBe(false);
      expect(customTracker.config.persistToFile).toBe(false);
      expect(customTracker.config.maxTasks).toBe(1000);
    });
  });

  describe('Task Creation', () => {
    test('should create a new task with default values', async () => {
      const task = await tracker.createTask({
        title: 'Test Task',
        description: 'A test task'
      });

      expect(task.id).toBeDefined();
      expect(task.title).toBe('Test Task');
      expect(task.description).toBe('A test task');
      expect(task.status).toBe('pending');
      expect(task.priority).toBe('medium');
      expect(task.createdAt).toBeDefined();
    });

    test('should create task with custom properties', async () => {
      const task = await tracker.createTask({
        title: 'High Priority Task',
        description: 'Important task',
        priority: 'high',
        status: 'in_progress',
        category: 'planning',
        estimatedTime: 120
      });

      expect(task.priority).toBe('high');
      expect(task.status).toBe('in_progress');
      expect(task.category).toBe('planning');
      expect(task.estimatedTime).toBe(120);
    });

    test('should generate unique task IDs', async () => {
      const task1 = await tracker.createTask({ title: 'Task 1' });
      const task2 = await tracker.createTask({ title: 'Task 2' });

      expect(task1.id).not.toBe(task2.id);
    });

    test('should validate required task properties', async () => {
      await expect(tracker.createTask({}))
        .rejects.toThrow('Task title is required');

      await expect(tracker.createTask({ title: '' }))
        .rejects.toThrow('Task title cannot be empty');
    });

    test('should create subtasks', async () => {
      const parentTask = await tracker.createTask({
        title: 'Parent Task',
        description: 'Main task'
      });

      const subtask = await tracker.createTask({
        title: 'Subtask',
        description: 'Child task',
        parentId: parentTask.id
      });

      expect(subtask.parentId).toBe(parentTask.id);
      expect(subtask.level).toBe(1);
    });
  });

  describe('Task Management', () => {
    let task;

    beforeEach(async () => {
      task = await tracker.createTask({
        title: 'Test Task',
        description: 'A test task'
      });
    });

    test('should update task status', async () => {
      await tracker.updateTaskStatus(task.id, 'in_progress');

      const updatedTask = await tracker.getTask(task.id);
      expect(updatedTask.status).toBe('in_progress');
      expect(updatedTask.updatedAt).toBeDefined();
    });

    test('should update task progress', async () => {
      await tracker.updateTaskProgress(task.id, 50);

      const updatedTask = await tracker.getTask(task.id);
      expect(updatedTask.progress).toBe(50);
    });

    test('should update task properties', async () => {
      await tracker.updateTask(task.id, {
        priority: 'high',
        estimatedTime: 180,
        assignee: 'CodeAgent'
      });

      const updatedTask = await tracker.getTask(task.id);
      expect(updatedTask.priority).toBe('high');
      expect(updatedTask.estimatedTime).toBe(180);
      expect(updatedTask.assignee).toBe('CodeAgent');
    });

    test('should add task notes', async () => {
      await tracker.addTaskNote(task.id, 'This is a note');
      await tracker.addTaskNote(task.id, 'Another note');

      const updatedTask = await tracker.getTask(task.id);
      expect(updatedTask.notes).toHaveLength(2);
      expect(updatedTask.notes[0]).toBe('This is a note');
      expect(updatedTask.notes[1]).toBe('Another note');
    });

    test('should delete task', async () => {
      await tracker.deleteTask(task.id);

      await expect(tracker.getTask(task.id))
        .rejects.toThrow('Task not found');
    });
  });

  describe('Task Querying', () => {
    beforeEach(async () => {
      await tracker.createTask({
        title: 'Planning Task',
        category: 'planning',
        status: 'completed'
      });
      await tracker.createTask({
        title: 'Coding Task',
        category: 'generation',
        status: 'in_progress',
        priority: 'high'
      });
      await tracker.createTask({
        title: 'Testing Task',
        category: 'testing',
        status: 'pending',
        priority: 'low'
      });
    });

    test('should get all tasks', async () => {
      const allTasks = await tracker.getAllTasks();
      expect(allTasks).toHaveLength(3);
    });

    test('should filter tasks by status', async () => {
      const inProgressTasks = await tracker.getTasksByStatus('in_progress');
      expect(inProgressTasks).toHaveLength(1);
      expect(inProgressTasks[0].title).toBe('Coding Task');
    });

    test('should filter tasks by category', async () => {
      const planningTasks = await tracker.getTasksByCategory('planning');
      expect(planningTasks).toHaveLength(1);
      expect(planningTasks[0].title).toBe('Planning Task');
    });

    test('should filter tasks by priority', async () => {
      const highPriorityTasks = await tracker.getTasksByPriority('high');
      expect(highPriorityTasks).toHaveLength(1);
      expect(highPriorityTasks[0].title).toBe('Coding Task');
    });

    test('should get pending tasks', async () => {
      const pendingTasks = await tracker.getPendingTasks();
      expect(pendingTasks).toHaveLength(1);
      expect(pendingTasks[0].status).toBe('pending');
    });

    test('should get active tasks', async () => {
      const activeTasks = await tracker.getActiveTasks();
      expect(activeTasks).toHaveLength(2); // in_progress + pending
    });

    test('should get completed tasks', async () => {
      const completedTasks = await tracker.getCompletedTasks();
      expect(completedTasks).toHaveLength(1);
      expect(completedTasks[0].status).toBe('completed');
    });
  });

  describe('Task Dependencies', () => {
    let task1, task2, task3;

    beforeEach(async () => {
      task1 = await tracker.createTask({ title: 'Task 1' });
      task2 = await tracker.createTask({ title: 'Task 2' });
      task3 = await tracker.createTask({ title: 'Task 3' });
    });

    test('should add task dependency', async () => {
      await tracker.addDependency(task2.id, task1.id);

      const dependencies = await tracker.getDependencies(task2.id);
      expect(dependencies).toContain(task1.id);
    });

    test('should remove task dependency', async () => {
      await tracker.addDependency(task2.id, task1.id);
      await tracker.removeDependency(task2.id, task1.id);

      const dependencies = await tracker.getDependencies(task2.id);
      expect(dependencies).not.toContain(task1.id);
    });

    test('should get tasks that can be started', async () => {
      await tracker.addDependency(task2.id, task1.id);
      await tracker.addDependency(task3.id, task2.id);

      const readyTasks = await tracker.getReadyTasks();
      expect(readyTasks.map(t => t.id)).toContain(task1.id);
      expect(readyTasks.map(t => t.id)).not.toContain(task2.id);
      expect(readyTasks.map(t => t.id)).not.toContain(task3.id);
    });

    test('should detect circular dependencies', async () => {
      await tracker.addDependency(task2.id, task1.id);
      
      await expect(tracker.addDependency(task1.id, task2.id))
        .rejects.toThrow('Circular dependency detected');
    });

    test('should update ready tasks when dependency completes', async () => {
      await tracker.addDependency(task2.id, task1.id);
      await tracker.updateTaskStatus(task1.id, 'completed');

      const readyTasks = await tracker.getReadyTasks();
      expect(readyTasks.map(t => t.id)).toContain(task2.id);
    });
  });

  describe('Task Statistics', () => {
    beforeEach(async () => {
      await tracker.createTask({ title: 'Task 1', status: 'completed' });
      await tracker.createTask({ title: 'Task 2', status: 'in_progress' });
      await tracker.createTask({ title: 'Task 3', status: 'pending' });
      await tracker.createTask({ title: 'Task 4', status: 'failed' });
    });

    test('should get task statistics', async () => {
      const stats = await tracker.getStatistics();

      expect(stats.total).toBe(4);
      expect(stats.completed).toBe(1);
      expect(stats.inProgress).toBe(1);
      expect(stats.pending).toBe(1);
      expect(stats.failed).toBe(1);
      expect(stats.completionRate).toBe(25); // 1/4 * 100
    });

    test('should get category statistics', async () => {
      await tracker.createTask({ 
        title: 'Planning Task 1', 
        category: 'planning', 
        status: 'completed' 
      });
      await tracker.createTask({ 
        title: 'Planning Task 2', 
        category: 'planning', 
        status: 'pending' 
      });

      const categoryStats = await tracker.getCategoryStatistics();
      expect(categoryStats.planning.total).toBe(2);
      expect(categoryStats.planning.completed).toBe(1);
    });

    test('should get time tracking statistics', async () => {
      const task = await tracker.createTask({ 
        title: 'Timed Task',
        estimatedTime: 120 
      });
      
      await tracker.startTask(task.id);
      await new Promise(resolve => setTimeout(resolve, 100)); // Wait 100ms
      await tracker.completeTask(task.id);

      const timeStats = await tracker.getTimeStatistics();
      expect(timeStats.totalEstimated).toBeGreaterThan(0);
      expect(timeStats.totalActual).toBeGreaterThan(0);
    });
  });

  describe('Task Workflow', () => {
    test('should start a task', async () => {
      const task = await tracker.createTask({ title: 'Workflow Task' });
      await tracker.startTask(task.id);

      const updatedTask = await tracker.getTask(task.id);
      expect(updatedTask.status).toBe('in_progress');
      expect(updatedTask.startedAt).toBeDefined();
    });

    test('should pause a task', async () => {
      const task = await tracker.createTask({ title: 'Workflow Task' });
      await tracker.startTask(task.id);
      await tracker.pauseTask(task.id);

      const updatedTask = await tracker.getTask(task.id);
      expect(updatedTask.status).toBe('paused');
      expect(updatedTask.pausedAt).toBeDefined();
    });

    test('should resume a paused task', async () => {
      const task = await tracker.createTask({ title: 'Workflow Task' });
      await tracker.startTask(task.id);
      await tracker.pauseTask(task.id);
      await tracker.resumeTask(task.id);

      const updatedTask = await tracker.getTask(task.id);
      expect(updatedTask.status).toBe('in_progress');
      expect(updatedTask.resumedAt).toBeDefined();
    });

    test('should complete a task', async () => {
      const task = await tracker.createTask({ title: 'Workflow Task' });
      await tracker.startTask(task.id);
      await tracker.completeTask(task.id);

      const updatedTask = await tracker.getTask(task.id);
      expect(updatedTask.status).toBe('completed');
      expect(updatedTask.completedAt).toBeDefined();
      expect(updatedTask.progress).toBe(100);
    });

    test('should fail a task', async () => {
      const task = await tracker.createTask({ title: 'Workflow Task' });
      await tracker.startTask(task.id);
      await tracker.failTask(task.id, 'Test failure reason');

      const updatedTask = await tracker.getTask(task.id);
      expect(updatedTask.status).toBe('failed');
      expect(updatedTask.failedAt).toBeDefined();
      expect(updatedTask.failureReason).toBe('Test failure reason');
    });
  });

  describe('Persistence', () => {
    test('should save tasks to file when autoSave is enabled', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tasks-test-'));
      const persistentTracker = new TaskTracker({
        autoSave: true,
        persistToFile: true,
        saveFilePath: path.join(tempDir, 'test-tasks.json')
      });

      await persistentTracker.createTask({ title: 'Persistent Task' });
      
      // Should auto-save
      expect(persistentTracker.isDirty()).toBe(false);
    });

    test('should load tasks from file', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tasks-test-'));
      const saveFilePath = path.join(tempDir, 'test-tasks-load.json');
      
      const tracker1 = new TaskTracker({
        saveFilePath: saveFilePath
      });
      
      await tracker1.createTask({ title: 'Task to Load' });
      await tracker1.save();

      const tracker2 = new TaskTracker({
        saveFilePath: saveFilePath
      });
      
      await tracker2.load();
      const tasks = await tracker2.getAllTasks();
      
      expect(tasks).toHaveLength(1);
      expect(tasks[0].title).toBe('Task to Load');
    });

    test('should handle save/load errors gracefully', async () => {
      const tracker = new TaskTracker({
        saveFilePath: '/invalid/path/tasks.json'
      });

      await tracker.createTask({ title: 'Test Task' });
      
      // Should not throw error, just log warning
      await expect(tracker.save()).resolves.not.toThrow();
    });
  });

  describe('Task Search and Filtering', () => {
    beforeEach(async () => {
      await tracker.createTask({
        title: 'API Implementation',
        description: 'Implement REST API endpoints',
        category: 'generation',
        priority: 'high'
      });
      await tracker.createTask({
        title: 'Database Setup',
        description: 'Setup MongoDB database',
        category: 'setup',
        priority: 'medium'
      });
      await tracker.createTask({
        title: 'Unit Tests',
        description: 'Write unit tests for API',
        category: 'testing',
        priority: 'low'
      });
    });

    test('should search tasks by title', async () => {
      const results = await tracker.searchTasks({ title: 'API' });
      expect(results).toHaveLength(2);
      expect(results.some(t => t.title.includes('API'))).toBe(true);
    });

    test('should search tasks by description', async () => {
      const results = await tracker.searchTasks({ description: 'MongoDB' });
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Database Setup');
    });

    test('should filter tasks by multiple criteria', async () => {
      const results = await tracker.searchTasks({
        category: 'generation',
        priority: 'high'
      });
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('API Implementation');
    });

    test('should support fuzzy search', async () => {
      const results = await tracker.searchTasks({ 
        fuzzy: true, 
        query: 'databse' // intentional typo
      });
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Database Setup');
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid task ID gracefully', async () => {
      await expect(tracker.getTask('invalid-id'))
        .rejects.toThrow('Task not found');
    });

    test('should handle duplicate task titles with warning', async () => {
      await tracker.createTask({ title: 'Duplicate Task' });
      
      // Should not throw, but log warning
      const task2 = await tracker.createTask({ title: 'Duplicate Task' });
      expect(task2.id).toBeDefined();
    });

    test('should validate task updates', async () => {
      const task = await tracker.createTask({ title: 'Test Task' });
      
      await expect(tracker.updateTask(task.id, { status: 'invalid' }))
        .rejects.toThrow('Invalid status');
    });

    test('should handle concurrent task updates', async () => {
      const task = await tracker.createTask({ title: 'Concurrent Task' });
      
      // Simulate concurrent updates
      const update1 = tracker.updateTask(task.id, { priority: 'high' });
      const update2 = tracker.updateTask(task.id, { status: 'in_progress' });
      
      await Promise.all([update1, update2]);
      
      const updatedTask = await tracker.getTask(task.id);
      expect(updatedTask.priority).toBe('high');
      expect(updatedTask.status).toBe('in_progress');
    });
  });
});