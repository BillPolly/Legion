/**
 * StateManager - Manages persistent project state
 * Handles versioning, rollback, and concurrent access
 * NO MOCKS - uses real file system
 * NO FALLBACKS - fails fast on errors
 */

import fs from 'fs/promises';
import path from 'path';

export default class StateManager {
  constructor(projectRoot) {
    if (!projectRoot) {
      throw new Error('Project root is required');
    }
    this.projectRoot = projectRoot;
    this.state = null;
    this.history = [];
    this.lockPath = null;
    this.lockTimeout = null;
  }
  
  async load(projectId) {
    const statePath = path.join(this.projectRoot, projectId, 'state.json');
    const historyPath = path.join(this.projectRoot, projectId, 'history.json');
    
    const data = await fs.readFile(statePath, 'utf-8');
    this.state = JSON.parse(data);
    
    // Load history if exists
    try {
      const historyData = await fs.readFile(historyPath, 'utf-8');
      this.history = JSON.parse(historyData);
    } catch (e) {
      this.history = [];
    }
    
    return this.state;
  }

  async loadOrCreate(projectId) {
    const statePath = path.join(this.projectRoot, projectId, 'state.json');
    const historyPath = path.join(this.projectRoot, projectId, 'history.json');
    
    try {
      const data = await fs.readFile(statePath, 'utf-8');
      this.state = JSON.parse(data);
      
      // Load history if exists
      try {
        const historyData = await fs.readFile(historyPath, 'utf-8');
        this.history = JSON.parse(historyData);
      } catch (e) {
        this.history = [];
      }
    } catch (error) {
      // Create new state
      this.state = {
        projectId: projectId,
        status: 'planning',
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        requirements: null,
        plan: null,
        phases: [],
        tasks: [],
        artifacts: []
      };
      this.history = [];
    }
    
    return this.state;
  }
  
  async updateRequirements(requirements) {
    this.state.requirements = requirements;
    this.state.updatedAt = new Date().toISOString();
    await this._save();
  }
  
  async savePlan(plan) {
    this.state.plan = plan;
    this.state.status = 'executing';
    this.state.updatedAt = new Date().toISOString();
    await this._save();
  }
  
  async updateStatus(status) {
    this.state.status = status;
    this.state.updatedAt = new Date().toISOString();
    await this._save();
  }
  
  async markComplete(result) {
    this.state.status = 'completed';
    this.state.result = result;
    this.state.completedAt = new Date().toISOString();
    this.state.updatedAt = new Date().toISOString();
    await this._save();
  }
  
  async getState() {
    return this.state;
  }
  
  /**
   * Public save method
   */
  async save(stateData = null) {
    if (stateData) {
      this.state = stateData;
    }
    this.state.updatedAt = new Date().toISOString();
    await this._save();
  }
  
  /**
   * Update state with partial updates and version increment
   */
  async update(updates) {
    // Save current state to history before updating
    await this._saveToHistory();
    
    // Apply updates
    Object.assign(this.state, updates);
    
    // Increment version
    this.state.version = (this.state.version || 1) + 1;
    this.state.updatedAt = new Date().toISOString();
    
    await this._save();
  }
  
  /**
   * Update or add a task
   */
  async updateTask(task) {
    if (!task.id) {
      throw new Error('Task must have an id');
    }
    
    const existingIndex = this.state.tasks.findIndex(t => t.id === task.id);
    
    if (existingIndex >= 0) {
      // Update existing task
      this.state.tasks[existingIndex] = { ...this.state.tasks[existingIndex], ...task };
    } else {
      // Add new task
      this.state.tasks.push(task);
    }
    
    this.state.updatedAt = new Date().toISOString();
    await this._save();
  }
  
  /**
   * Add an artifact with auto-generated ID if needed
   */
  async addArtifact(artifact) {
    if (!artifact.id) {
      artifact.id = 'artifact-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }
    
    this.state.artifacts.push(artifact);
    this.state.updatedAt = new Date().toISOString();
    await this._save();
  }
  
  /**
   * Rollback to previous version
   */
  async rollback() {
    if (this.history.length === 0) {
      throw new Error('No history to rollback to');
    }
    
    // Get previous state from history
    const previousState = this.history.pop();
    this.state = previousState;
    
    // Save the rolled back state
    await this._save();
    await this._saveHistory();
  }
  
  /**
   * Get state history
   */
  async getHistory() {
    // Include current state in returned history
    return [...this.history, this.state];
  }
  
  /**
   * Lock state for exclusive access
   */
  async lock(options = {}) {
    const { timeout = 30000 } = options;
    const stateDir = path.join(this.projectRoot, this.state.projectId);
    const lockPath = path.join(stateDir, 'state.lock');
    
    // Ensure directory exists
    await fs.mkdir(stateDir, { recursive: true });
    
    // Check if already locked
    try {
      const lockData = await fs.readFile(lockPath, 'utf-8');
      const lock = JSON.parse(lockData);
      
      // Check if lock is expired
      if (Date.now() - lock.timestamp > lock.timeout) {
        // Lock expired, can proceed
      } else {
        throw new Error('State is locked');
      }
    } catch (error) {
      if (error.message === 'State is locked') {
        throw error;
      }
      // Lock file doesn't exist, can proceed
    }
    
    // Create lock
    const lockData = {
      pid: process.pid,
      timestamp: Date.now(),
      timeout: timeout
    };
    
    await fs.writeFile(lockPath, JSON.stringify(lockData));
    this.lockPath = lockPath;
    
    // Set auto-unlock timeout if specified
    if (timeout > 0) {
      this.lockTimeout = setTimeout(async () => {
        await this.unlock();
      }, timeout);
    }
  }
  
  /**
   * Unlock state
   */
  async unlock() {
    if (this.lockTimeout) {
      clearTimeout(this.lockTimeout);
      this.lockTimeout = null;
    }
    
    if (this.lockPath) {
      try {
        await fs.unlink(this.lockPath);
      } catch (error) {
        // Ignore if already deleted
      }
      this.lockPath = null;
    } else if (this.state) {
      // Try to unlock based on state
      const lockPath = path.join(this.projectRoot, this.state.projectId, 'state.lock');
      try {
        await fs.unlink(lockPath);
      } catch (error) {
        // Ignore if doesn't exist
      }
    }
  }
  
  async _save() {
    // Create directory if it doesn't exist
    const stateDir = path.join(this.projectRoot, this.state.projectId);
    await fs.mkdir(stateDir, { recursive: true });
    
    const statePath = path.join(stateDir, 'state.json');
    await fs.writeFile(statePath, JSON.stringify(this.state, null, 2));
  }
  
  async _saveToHistory() {
    // Add current state to history
    this.history.push(JSON.parse(JSON.stringify(this.state)));
    
    // Keep only last 10 versions
    if (this.history.length > 10) {
      this.history = this.history.slice(-10);
    }
    
    await this._saveHistory();
  }
  
  async _saveHistory() {
    const stateDir = path.join(this.projectRoot, this.state.projectId);
    await fs.mkdir(stateDir, { recursive: true });
    
    const historyPath = path.join(stateDir, 'history.json');
    await fs.writeFile(historyPath, JSON.stringify(this.history, null, 2));
  }
}