/**
 * TaskTracker - Task creation, management, and tracking
 * 
 * Manages tasks throughout the code generation process with support for
 * dependencies, workflow states, persistence, and comprehensive tracking.
 */

import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import path from 'path';

class TaskTracker {
  constructor(config = {}) {
    this.config = {
      autoSave: true,
      persistToFile: true,
      maxTasks: 10000,
      saveFilePath: null, // Must be explicitly set to enable file persistence
      enableTimeTracking: true,
      enableFuzzySearch: true,
      ...config
    };

    // Task storage
    this.tasks = new Map();
    this.dependencies = new Map(); // taskId -> Set of dependency taskIds
    this.dependents = new Map(); // taskId -> Set of dependent taskIds
    
    // State tracking
    this.isDirtyFlag = false;
    this.lastSaveTime = null;
    
    // Valid task statuses
    this.validStatuses = [
      'pending', 'in_progress', 'paused', 'completed', 'failed', 'cancelled'
    ];
    
    // Valid priorities
    this.validPriorities = ['low', 'medium', 'high', 'critical'];
    
    // Valid categories
    this.validCategories = [
      'planning', 'generation', 'testing', 'validation', 'setup', 'cleanup'
    ];
  }

  /**
   * Create a new task
   * 
   * @param {Object} taskData - Task configuration
   * @returns {Promise<Object>} Created task
   */
  async createTask(taskData) {
    // Validate required fields
    if (taskData.title === undefined || taskData.title === null) {
      throw new Error('Task title is required');
    }
    
    if (taskData.title.trim() === '') {
      throw new Error('Task title cannot be empty');
    }

    // Check for duplicate titles (warning only)
    const existingTasks = Array.from(this.tasks.values());
    if (existingTasks.some(t => t.title === taskData.title)) {
      console.warn(`Warning: Task with title '${taskData.title}' already exists`);
    }

    // Create task with defaults
    const task = {
      id: uuidv4(),
      title: taskData.title,
      description: taskData.description || '',
      status: taskData.status || 'pending',
      priority: taskData.priority || 'medium',
      category: taskData.category || 'general',
      progress: 0,
      estimatedTime: taskData.estimatedTime || null,
      actualTime: 0,
      assignee: taskData.assignee || null,
      parentId: taskData.parentId || null,
      level: taskData.parentId ? this._calculateTaskLevel(taskData.parentId) : 0,
      notes: [],
      tags: taskData.tags || [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      startedAt: null,
      pausedAt: null,
      resumedAt: null,
      completedAt: null,
      failedAt: null,
      failureReason: null
    };

    // Validate task properties
    this._validateTask(task);

    // Store task
    this.tasks.set(task.id, task);
    
    // Initialize dependency tracking
    this.dependencies.set(task.id, new Set());
    this.dependents.set(task.id, new Set());
    
    // Mark as dirty for auto-save
    this._markDirty();
    
    if (this.config.autoSave) {
      await this._autoSave();
    }

    return task;
  }

  /**
   * Get a task by ID
   * 
   * @param {string} taskId - Task ID
   * @returns {Promise<Object>} Task object
   */
  async getTask(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error('Task not found');
    }
    return { ...task };
  }

  /**
   * Update task status
   * 
   * @param {string} taskId - Task ID
   * @param {string} status - New status
   * @returns {Promise<Object>} Updated task
   */
  async updateTaskStatus(taskId, status) {
    return this.updateTask(taskId, { status });
  }

  /**
   * Update task progress
   * 
   * @param {string} taskId - Task ID
   * @param {number} progress - Progress percentage (0-100)
   * @returns {Promise<Object>} Updated task
   */
  async updateTaskProgress(taskId, progress) {
    if (progress < 0 || progress > 100) {
      throw new Error('Progress must be between 0 and 100');
    }
    return this.updateTask(taskId, { progress });
  }

  /**
   * Update task properties
   * 
   * @param {string} taskId - Task ID
   * @param {Object} updates - Properties to update
   * @returns {Promise<Object>} Updated task
   */
  async updateTask(taskId, updates) {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    // Validate updates
    if (updates.status && !this.validStatuses.includes(updates.status)) {
      throw new Error('Invalid status');
    }
    
    if (updates.priority && !this.validPriorities.includes(updates.priority)) {
      throw new Error('Invalid priority');
    }

    // Apply updates
    const updatedTask = {
      ...task,
      ...updates,
      updatedAt: Date.now()
    };

    this._validateTask(updatedTask);
    this.tasks.set(taskId, updatedTask);
    this._markDirty();
    
    if (this.config.autoSave) {
      await this._autoSave();
    }

    return { ...updatedTask };
  }

  /**
   * Add a note to a task
   * 
   * @param {string} taskId - Task ID
   * @param {string} note - Note to add
   * @returns {Promise<Object>} Updated task
   */
  async addTaskNote(taskId, note) {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    task.notes.push(note);
    task.updatedAt = Date.now();
    
    this._markDirty();
    
    if (this.config.autoSave) {
      await this._autoSave();
    }

    return { ...task };
  }

  /**
   * Delete a task
   * 
   * @param {string} taskId - Task ID
   * @returns {Promise<void>}
   */
  async deleteTask(taskId) {
    if (!this.tasks.has(taskId)) {
      throw new Error('Task not found');
    }

    // Remove dependencies
    this.dependencies.delete(taskId);
    this.dependents.delete(taskId);
    
    // Remove from other tasks' dependencies
    for (const [id, deps] of this.dependencies.entries()) {
      deps.delete(taskId);
    }
    
    for (const [id, deps] of this.dependents.entries()) {
      deps.delete(taskId);
    }

    // Remove task
    this.tasks.delete(taskId);
    this._markDirty();
    
    if (this.config.autoSave) {
      await this._autoSave();
    }
  }

  /**
   * Get all tasks
   * 
   * @returns {Promise<Array>} All tasks
   */
  async getAllTasks() {
    return Array.from(this.tasks.values()).map(task => ({ ...task }));
  }

  /**
   * Get tasks by status
   * 
   * @param {string} status - Task status
   * @returns {Promise<Array>} Filtered tasks
   */
  async getTasksByStatus(status) {
    return Array.from(this.tasks.values())
      .filter(task => task.status === status)
      .map(task => ({ ...task }));
  }

  /**
   * Get tasks by category
   * 
   * @param {string} category - Task category
   * @returns {Promise<Array>} Filtered tasks
   */
  async getTasksByCategory(category) {
    return Array.from(this.tasks.values())
      .filter(task => task.category === category)
      .map(task => ({ ...task }));
  }

  /**
   * Get tasks by priority
   * 
   * @param {string} priority - Task priority
   * @returns {Promise<Array>} Filtered tasks
   */
  async getTasksByPriority(priority) {
    return Array.from(this.tasks.values())
      .filter(task => task.priority === priority)
      .map(task => ({ ...task }));
  }

  /**
   * Get pending tasks
   * 
   * @returns {Promise<Array>} Pending tasks
   */
  async getPendingTasks() {
    return this.getTasksByStatus('pending');
  }

  /**
   * Get active tasks (in_progress + pending)
   * 
   * @returns {Promise<Array>} Active tasks
   */
  async getActiveTasks() {
    return Array.from(this.tasks.values())
      .filter(task => ['pending', 'in_progress'].includes(task.status))
      .map(task => ({ ...task }));
  }

  /**
   * Get completed tasks
   * 
   * @returns {Promise<Array>} Completed tasks
   */
  async getCompletedTasks() {
    return this.getTasksByStatus('completed');
  }

  /**
   * Add task dependency
   * 
   * @param {string} taskId - Dependent task ID
   * @param {string} dependencyId - Dependency task ID
   * @returns {Promise<void>}
   */
  async addDependency(taskId, dependencyId) {
    if (!this.tasks.has(taskId) || !this.tasks.has(dependencyId)) {
      throw new Error('Task not found');
    }

    // Check for circular dependency
    if (await this._wouldCreateCircularDependency(taskId, dependencyId)) {
      throw new Error('Circular dependency detected');
    }

    this.dependencies.get(taskId).add(dependencyId);
    this.dependents.get(dependencyId).add(taskId);
    
    this._markDirty();
  }

  /**
   * Remove task dependency
   * 
   * @param {string} taskId - Dependent task ID
   * @param {string} dependencyId - Dependency task ID
   * @returns {Promise<void>}
   */
  async removeDependency(taskId, dependencyId) {
    this.dependencies.get(taskId)?.delete(dependencyId);
    this.dependents.get(dependencyId)?.delete(taskId);
    
    this._markDirty();
  }

  /**
   * Get task dependencies
   * 
   * @param {string} taskId - Task ID
   * @returns {Promise<Array>} Dependency IDs
   */
  async getDependencies(taskId) {
    const deps = this.dependencies.get(taskId);
    return deps ? Array.from(deps) : [];
  }

  /**
   * Get tasks that can be started (no pending dependencies)
   * 
   * @returns {Promise<Array>} Ready tasks
   */
  async getReadyTasks() {
    const readyTasks = [];
    
    for (const task of this.tasks.values()) {
      if (task.status === 'pending') {
        const dependencies = this.dependencies.get(task.id);
        const allDependenciesComplete = Array.from(dependencies).every(depId => {
          const depTask = this.tasks.get(depId);
          return depTask && depTask.status === 'completed';
        });
        
        if (allDependenciesComplete) {
          readyTasks.push({ ...task });
        }
      }
    }
    
    return readyTasks;
  }

  /**
   * Get task statistics
   * 
   * @returns {Promise<Object>} Statistics
   */
  async getStatistics() {
    const tasks = Array.from(this.tasks.values());
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    const inProgress = tasks.filter(t => t.status === 'in_progress').length;
    const pending = tasks.filter(t => t.status === 'pending').length;
    const failed = tasks.filter(t => t.status === 'failed').length;
    
    return {
      total,
      completed,
      inProgress,
      pending,
      failed,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0
    };
  }

  /**
   * Get category statistics
   * 
   * @returns {Promise<Object>} Category statistics
   */
  async getCategoryStatistics() {
    const tasks = Array.from(this.tasks.values());
    const categoryStats = {};
    
    for (const task of tasks) {
      if (!categoryStats[task.category]) {
        categoryStats[task.category] = {
          total: 0,
          completed: 0,
          inProgress: 0,
          pending: 0,
          failed: 0
        };
      }
      
      categoryStats[task.category].total++;
      categoryStats[task.category][task.status.replace('_', '')]++;
    }
    
    return categoryStats;
  }

  /**
   * Get time tracking statistics
   * 
   * @returns {Promise<Object>} Time statistics
   */
  async getTimeStatistics() {
    const tasks = Array.from(this.tasks.values());
    const totalEstimated = tasks.reduce((sum, task) => sum + (task.estimatedTime || 0), 0);
    const totalActual = tasks.reduce((sum, task) => sum + (task.actualTime || 0), 0);
    
    return {
      totalEstimated,
      totalActual,
      efficiency: totalEstimated > 0 ? (totalActual / totalEstimated) * 100 : 0
    };
  }

  /**
   * Start a task
   * 
   * @param {string} taskId - Task ID
   * @returns {Promise<Object>} Updated task
   */
  async startTask(taskId) {
    return this.updateTask(taskId, {
      status: 'in_progress',
      startedAt: Date.now()
    });
  }

  /**
   * Pause a task
   * 
   * @param {string} taskId - Task ID
   * @returns {Promise<Object>} Updated task
   */
  async pauseTask(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    // Calculate actual time if task was running
    let actualTime = task.actualTime || 0;
    if (task.status === 'in_progress' && task.startedAt) {
      actualTime += Date.now() - (task.resumedAt || task.startedAt);
    }

    return this.updateTask(taskId, {
      status: 'paused',
      pausedAt: Date.now(),
      actualTime
    });
  }

  /**
   * Resume a paused task
   * 
   * @param {string} taskId - Task ID
   * @returns {Promise<Object>} Updated task
   */
  async resumeTask(taskId) {
    return this.updateTask(taskId, {
      status: 'in_progress',
      resumedAt: Date.now()
    });
  }

  /**
   * Complete a task
   * 
   * @param {string} taskId - Task ID
   * @returns {Promise<Object>} Updated task
   */
  async completeTask(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    // Calculate actual time
    let actualTime = task.actualTime || 0;
    if (task.status === 'in_progress' && task.startedAt) {
      actualTime += Date.now() - (task.resumedAt || task.startedAt);
    }

    return this.updateTask(taskId, {
      status: 'completed',
      progress: 100,
      completedAt: Date.now(),
      actualTime
    });
  }

  /**
   * Fail a task
   * 
   * @param {string} taskId - Task ID
   * @param {string} reason - Failure reason
   * @returns {Promise<Object>} Updated task
   */
  async failTask(taskId, reason) {
    return this.updateTask(taskId, {
      status: 'failed',
      failedAt: Date.now(),
      failureReason: reason
    });
  }

  /**
   * Search tasks
   * 
   * @param {Object} criteria - Search criteria
   * @returns {Promise<Array>} Matching tasks
   */
  async searchTasks(criteria) {
    const tasks = Array.from(this.tasks.values());
    
    return tasks.filter(task => {
      // Title search (also searches description for broader results)
      if (criteria.title) {
        const searchTerm = criteria.title.toLowerCase();
        const titleMatch = task.title.toLowerCase().includes(searchTerm);
        const descMatch = task.description.toLowerCase().includes(searchTerm);
        if (!titleMatch && !descMatch) {
          return false;
        }
      }
      
      // Description search
      if (criteria.description && !task.description.toLowerCase().includes(criteria.description.toLowerCase())) {
        return false;
      }
      
      // Category filter
      if (criteria.category && task.category !== criteria.category) {
        return false;
      }
      
      // Priority filter
      if (criteria.priority && task.priority !== criteria.priority) {
        return false;
      }
      
      // Status filter
      if (criteria.status && task.status !== criteria.status) {
        return false;
      }
      
      // Fuzzy search
      if (criteria.fuzzy && criteria.query) {
        const query = criteria.query.toLowerCase();
        const searchText = `${task.title} ${task.description}`.toLowerCase();
        if (!this._fuzzyMatch(searchText, query)) {
          return false;
        }
      }
      
      return true;
    }).map(task => ({ ...task }));
  }

  /**
   * Save tasks to file
   * 
   * @returns {Promise<void>}
   */
  async save() {
    if (!this.config.persistToFile || !this.config.saveFilePath) return;
    
    try {
      const data = {
        tasks: Array.from(this.tasks.entries()),
        dependencies: Array.from(this.dependencies.entries()).map(([id, deps]) => [id, Array.from(deps)]),
        dependents: Array.from(this.dependents.entries()).map(([id, deps]) => [id, Array.from(deps)]),
        lastSaveTime: Date.now()
      };
      
      const filePath = path.resolve(this.config.saveFilePath);
      const dir = path.dirname(filePath);
      
      // Ensure directory exists
      await fs.mkdir(dir, { recursive: true });
      
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
      this.lastSaveTime = Date.now();
      this.isDirtyFlag = false;
    } catch (error) {
      console.warn('Failed to save tasks:', error.message);
    }
  }

  /**
   * Load tasks from file
   * 
   * @returns {Promise<void>}
   */
  async load() {
    if (!this.config.persistToFile || !this.config.saveFilePath) return;
    
    try {
      const filePath = path.resolve(this.config.saveFilePath);
      const data = JSON.parse(await fs.readFile(filePath, 'utf8'));
      
      // Restore tasks
      this.tasks = new Map(data.tasks);
      
      // Restore dependencies
      this.dependencies = new Map(data.dependencies.map(([id, deps]) => [id, new Set(deps)]));
      this.dependents = new Map(data.dependents.map(([id, deps]) => [id, new Set(deps)]));
      
      this.lastSaveTime = data.lastSaveTime;
      this.isDirtyFlag = false;
    } catch (error) {
      // File doesn't exist or is invalid, start fresh
      this.tasks = new Map();
      this.dependencies = new Map();
      this.dependents = new Map();
    }
  }

  /**
   * Clear all tasks
   * 
   * @returns {Promise<void>}
   */
  async clear() {
    this.tasks.clear();
    this.dependencies.clear();
    this.dependents.clear();
    this._markDirty();
    
    if (this.config.autoSave) {
      await this._autoSave();
    }
  }

  /**
   * Check if tracker has unsaved changes
   * 
   * @returns {boolean} True if dirty
   */
  isDirty() {
    return this.isDirtyFlag;
  }

  /**
   * Private helper methods
   */

  _validateTask(task) {
    if (!this.validStatuses.includes(task.status)) {
      throw new Error(`Invalid status: ${task.status}`);
    }
    
    if (!this.validPriorities.includes(task.priority)) {
      throw new Error(`Invalid priority: ${task.priority}`);
    }
    
    if (task.progress < 0 || task.progress > 100) {
      throw new Error('Progress must be between 0 and 100');
    }
  }

  _calculateTaskLevel(parentId) {
    const parent = this.tasks.get(parentId);
    return parent ? parent.level + 1 : 0;
  }

  _markDirty() {
    this.isDirtyFlag = true;
  }

  async _autoSave() {
    if (this.isDirtyFlag && this.config.autoSave) {
      await this.save();
    }
  }

  async _wouldCreateCircularDependency(taskId, dependencyId) {
    // Check if adding dependencyId to taskId would create a cycle
    const visited = new Set();
    const stack = [dependencyId];
    
    while (stack.length > 0) {
      const currentId = stack.pop();
      
      if (currentId === taskId) {
        return true; // Cycle detected
      }
      
      if (visited.has(currentId)) {
        continue;
      }
      
      visited.add(currentId);
      const deps = this.dependencies.get(currentId);
      if (deps) {
        stack.push(...Array.from(deps));
      }
    }
    
    return false;
  }

  _fuzzyMatch(text, query) {
    // Simple fuzzy matching - allows for typos
    // First check for direct substring match
    if (text.includes(query)) {
      return true;
    }
    
    // Split text into words and check each word
    const words = text.split(' ');
    for (const word of words) {
      const distance = this._levenshteinDistance(word.toLowerCase(), query.toLowerCase());
      const threshold = Math.max(1, Math.floor(query.length * 0.3)); // 30% error tolerance
      if (distance <= threshold) {
        return true;
      }
    }
    
    return false;
  }

  _levenshteinDistance(str1, str2) {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }
    
    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }
}

export { TaskTracker };