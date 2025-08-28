/**
 * StateManager - State persistence and management
 * 
 * This class manages state persistence, task tracking, file tracking,
 * session management, and recovery capabilities for the code agent.
 */

import fs from 'fs/promises';
import path from 'path';

class StateManager {
  constructor(options = {}) {
    this.config = {
      stateDir: options.stateDir || './state',
      autoSave: options.autoSave !== false,
      maxSessions: options.maxSessions || 10,
      ...options
    };

    this.initialized = false;
    this.currentState = {};
    this.sessions = new Map();
    this.tasks = new Map();
    this.generatedFiles = new Map();
    this.testFiles = new Map();
    this.qualityCheckHistory = new Map();
    this.qualityGateStatus = {
      eslintPassed: false,
      testsPassed: false,
      coverageThresholdMet: false,
      allGatesPassed: false
    };
    this.checkpoints = new Map();
  }

  /**
   * Initialize the StateManager
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      await fs.mkdir(this.config.stateDir, { recursive: true });
      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize StateManager: ${error.message}`);
    }
  }

  /**
   * Save state to file
   * @param {string} sessionId - Session identifier
   * @param {Object} state - State to save
   */
  async saveState(sessionId, state) {
    if (!this.initialized) {
      await this.initialize();
    }

    const statePath = path.join(this.config.stateDir, `${sessionId}.json`);
    await fs.writeFile(statePath, JSON.stringify(state, null, 2));
  }

  /**
   * Load state from file
   * @param {string} sessionId - Session identifier
   * @returns {Object|null} Loaded state or null if not found
   */
  async loadState(sessionId) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const statePath = path.join(this.config.stateDir, `${sessionId}.json`);
      const data = await fs.readFile(statePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Set current working state
   * @param {Object} state - State to set
   */
  setCurrentState(state) {
    this.currentState = { ...state, timestamp: Date.now() };
  }

  /**
   * Get current working state
   * @returns {Object} Current state
   */
  getCurrentState() {
    return { ...this.currentState };
  }

  /**
   * Save current working state
   */
  async saveCurrentState() {
    if (!this.initialized) {
      await this.initialize();
    }

    const statePath = path.join(this.config.stateDir, 'current.json');
    await fs.writeFile(statePath, JSON.stringify(this.currentState, null, 2));
  }

  /**
   * Load current working state
   * @returns {Object|null} Current state or null if not found
   */
  async loadCurrentState() {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const statePath = path.join(this.config.stateDir, 'current.json');
      const data = await fs.readFile(statePath, 'utf8');
      const state = JSON.parse(data);
      this.currentState = state;
      return state;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Start a new task
   * @param {string} taskId - Task identifier
   * @param {Object} config - Task configuration
   */
  startTask(taskId, config = {}) {
    const task = {
      id: taskId,
      status: 'in_progress',
      progress: 0,
      startTime: Date.now(),
      config: config,
      ...config
    };

    this.tasks.set(taskId, task);
    this.currentState.currentTask = taskId;
  }

  /**
   * Update task progress
   * @param {string} taskId - Task identifier
   * @param {number} progress - Progress percentage (0-100)
   */
  updateTaskProgress(taskId, progress) {
    const task = this.tasks.get(taskId);
    if (task) {
      task.progress = progress;
      task.lastUpdate = Date.now();
    }
  }

  /**
   * Complete a task
   * @param {string} taskId - Task identifier
   * @param {Object} result - Task result
   */
  completeTask(taskId, result = {}) {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = 'completed';
      task.progress = 100;
      task.endTime = Date.now();
      task.result = result;
    }
  }

  /**
   * Mark task as failed
   * @param {string} taskId - Task identifier
   * @param {string} error - Error message
   */
  failTask(taskId, error) {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = 'failed';
      task.endTime = Date.now();
      task.error = error;
    }
  }

  /**
   * Get current task
   * @returns {Object|null} Current task or null
   */
  getCurrentTask() {
    const currentTaskId = this.currentState.currentTask;
    return currentTaskId ? this.tasks.get(currentTaskId) : null;
  }

  /**
   * Get completed tasks
   * @returns {Array} Array of completed tasks
   */
  getCompletedTasks() {
    return Array.from(this.tasks.values()).filter(task => task.status === 'completed');
  }

  /**
   * Get failed tasks
   * @returns {Array} Array of failed tasks
   */
  getFailedTasks() {
    return Array.from(this.tasks.values()).filter(task => task.status === 'failed');
  }

  /**
   * Add generated file to tracking
   * @param {string} filePath - File path
   * @param {Object} metadata - File metadata
   */
  addGeneratedFile(filePath, metadata = {}) {
    this.generatedFiles.set(filePath, {
      path: filePath,
      timestamp: Date.now(),
      metadata: metadata
    });
  }

  /**
   * Remove generated file from tracking
   * @param {string} filePath - File path
   */
  removeGeneratedFile(filePath) {
    this.generatedFiles.delete(filePath);
  }

  /**
   * Get generated files
   * @returns {Array} Array of generated files
   */
  getGeneratedFiles() {
    return Array.from(this.generatedFiles.values());
  }

  /**
   * Add test file to tracking
   * @param {string} filePath - Test file path
   * @param {Object} metadata - Test metadata
   */
  addTestFile(filePath, metadata = {}) {
    this.testFiles.set(filePath, {
      path: filePath,
      timestamp: Date.now(),
      metadata: metadata
    });
  }

  /**
   * Get test files
   * @returns {Array} Array of test files
   */
  getTestFiles() {
    return Array.from(this.testFiles.values());
  }

  /**
   * Create new session
   * @param {Object} config - Session configuration
   * @returns {string} Session ID
   */
  createSession(config = {}) {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const session = {
      id: sessionId,
      status: 'active',
      startTime: Date.now(),
      config: config
    };

    this.sessions.set(sessionId, session);

    // Cleanup old sessions if needed
    if (this.sessions.size > this.config.maxSessions) {
      const oldestSession = Array.from(this.sessions.values())
        .sort((a, b) => a.startTime - b.startTime)[0];
      this.sessions.delete(oldestSession.id);
    }

    return sessionId;
  }

  /**
   * Get session by ID
   * @param {string} sessionId - Session ID
   * @returns {Object|null} Session or null
   */
  getSession(sessionId) {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Get active sessions
   * @returns {Array} Array of active sessions
   */
  getActiveSessions() {
    return Array.from(this.sessions.values())
      .filter(session => session.status === 'active');
  }

  /**
   * End session
   * @param {string} sessionId - Session ID
   */
  endSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'ended';
      session.endTime = Date.now();
    }
  }

  /**
   * Record quality check results
   * @param {string} sessionId - Session ID
   * @param {Object} results - Quality check results
   */
  recordQualityCheck(sessionId, results) {
    if (!this.qualityCheckHistory.has(sessionId)) {
      this.qualityCheckHistory.set(sessionId, []);
    }

    this.qualityCheckHistory.get(sessionId).push({
      timestamp: Date.now(),
      results: results
    });
  }

  /**
   * Get quality check history
   * @param {string} sessionId - Session ID
   * @returns {Array} Quality check history
   */
  getQualityCheckHistory(sessionId) {
    return this.qualityCheckHistory.get(sessionId) || [];
  }

  /**
   * Update quality gate status
   * @param {Object} status - Quality gate status
   */
  updateQualityGateStatus(status) {
    this.qualityGateStatus = { ...this.qualityGateStatus, ...status };
    this.qualityGateStatus.allGatesPassed = 
      this.qualityGateStatus.eslintPassed && 
      this.qualityGateStatus.testsPassed && 
      this.qualityGateStatus.coverageThresholdMet;
  }

  /**
   * Get quality gate status
   * @returns {Object} Quality gate status
   */
  getQualityGateStatus() {
    return { ...this.qualityGateStatus };
  }

  /**
   * Create recovery checkpoint
   * @param {string} checkpointId - Checkpoint ID
   * @param {Object} checkpoint - Checkpoint data
   */
  createCheckpoint(checkpointId, checkpoint) {
    this.checkpoints.set(checkpointId, {
      id: checkpointId,
      timestamp: Date.now(),
      ...checkpoint
    });
  }

  /**
   * Get checkpoint
   * @param {string} checkpointId - Checkpoint ID
   * @returns {Object|null} Checkpoint or null
   */
  getCheckpoint(checkpointId) {
    return this.checkpoints.get(checkpointId) || null;
  }

  /**
   * Restore from checkpoint
   * @param {string} checkpointId - Checkpoint ID
   */
  async restoreFromCheckpoint(checkpointId) {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (checkpoint) {
      this.currentState = { ...checkpoint };
      if (this.config.autoSave) {
        await this.saveCurrentState();
      }
    }
  }

  /**
   * Validate state structure
   * @param {Object} state - State to validate
   * @returns {boolean} Is valid
   */
  validateState(state) {
    if (!state || typeof state !== 'object') {
      return false;
    }

    // Check required fields have valid types
    if (state.currentTask !== undefined && typeof state.currentTask !== 'string') {
      return false;
    }

    if (state.progress !== undefined && (typeof state.progress !== 'number' || state.progress < 0 || state.progress > 100)) {
      return false;
    }

    if (state.timestamp !== undefined && (typeof state.timestamp !== 'number' || state.timestamp <= 0)) {
      return false;
    }

    return true;
  }

  /**
   * Clean invalid state properties
   * @param {Object} state - State to clean
   * @returns {Object} Cleaned state
   */
  cleanState(state) {
    const cleaned = {};

    for (const [key, value] of Object.entries(state)) {
      if (value !== null && value !== undefined && value !== '') {
        cleaned[key] = value;
      }
    }

    return cleaned;
  }

  /**
   * Export complete state
   * @returns {Object} Complete state export
   */
  async exportState() {
    return {
      tasks: Array.from(this.tasks.values()),
      generatedFiles: Array.from(this.generatedFiles.values()),
      testFiles: Array.from(this.testFiles.values()),
      sessions: Array.from(this.sessions.values()),
      qualityGateStatus: this.qualityGateStatus,
      currentState: this.currentState,
      checkpoints: Array.from(this.checkpoints.values()),
      timestamp: Date.now()
    };
  }

  /**
   * Import state
   * @param {Object} stateData - State data to import
   */
  async importState(stateData) {
    if (stateData.tasks) {
      for (const task of stateData.tasks) {
        this.tasks.set(task.id, task);
      }
    }

    if (stateData.generatedFiles) {
      for (const file of stateData.generatedFiles) {
        this.generatedFiles.set(file.path, file);
      }
    }

    if (stateData.testFiles) {
      for (const file of stateData.testFiles) {
        this.testFiles.set(file.path, file);
      }
    }

    if (stateData.sessions) {
      for (const session of stateData.sessions) {
        this.sessions.set(session.id, session);
      }
    }

    if (stateData.qualityGateStatus) {
      this.qualityGateStatus = { ...stateData.qualityGateStatus };
    }

    if (stateData.currentState) {
      this.currentState = { ...stateData.currentState };
    }

    if (stateData.checkpoints) {
      for (const checkpoint of stateData.checkpoints) {
        this.checkpoints.set(checkpoint.id, checkpoint);
      }
    }
  }
}

export { StateManager };