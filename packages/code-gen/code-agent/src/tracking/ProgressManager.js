/**
 * ProgressManager - Progress tracking and persistence
 * 
 * Manages progress across different code generation phases and sessions
 * with support for persistence, analytics, milestones, and rollback.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import path from 'path';

class ProgressManager extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      autoSave: true,
      persistToFile: true,
      saveFilePath: './progress.json',
      saveInterval: 30000, // 30 seconds
      enableEvents: true,
      ...config
    };

    // Progress tracking
    this.phases = new Map();
    this.tasks = new Map(); // phase -> Map(taskName -> taskInfo)
    this.sessions = new Map();
    this.milestones = new Map();
    this.checkpoints = new Map();
    
    // Current session
    this.currentSession = null;
    
    // State tracking
    this.isDirtyFlag = false;
    this.lastSaveTime = null;
    this.autoSaveTimer = null;
    
    // Default phases
    this._initializeDefaultPhases();
    
    // Start auto-save if enabled
    if (this.config.autoSave && this.config.saveInterval > 0) {
      this._startAutoSave();
    }
  }

  /**
   * Set progress for a phase
   * 
   * @param {string} phaseName - Phase name
   * @param {number} progress - Progress percentage (0-100)
   * @returns {Promise<void>}
   */
  async setPhaseProgress(phaseName, progress) {
    this._validatePhaseName(phaseName);
    this._validateProgress(progress);

    if (!this.phases.has(phaseName)) {
      this.phases.set(phaseName, {
        name: phaseName,
        progress: 0,
        completed: false,
        startedAt: null,
        completedAt: null,
        order: this.phases.size + 1,
        weight: 1.0
      });
    }

    const phase = this.phases.get(phaseName);
    const oldProgress = phase.progress;
    phase.progress = progress;
    phase.updatedAt = Date.now();

    if (!phase.startedAt && progress > 0) {
      phase.startedAt = Date.now();
    }

    this._markDirty();
    
    if (this.config.enableEvents) {
      this.emit('progress-updated', {
        type: 'phase-progress',
        phase: phaseName,
        oldProgress,
        newProgress: progress,
        timestamp: Date.now()
      });
    }

    // Check for milestone completion
    await this._checkMilestones();
  }

  /**
   * Get progress for a phase
   * 
   * @param {string} phaseName - Phase name
   * @returns {Promise<number>} Progress percentage
   */
  async getPhaseProgress(phaseName) {
    const phase = this.phases.get(phaseName);
    return phase ? phase.progress : 0;
  }

  /**
   * Get overall project progress
   * 
   * @returns {Promise<number>} Overall progress percentage
   */
  async getOverallProgress() {
    const phases = Array.from(this.phases.values());
    if (phases.length === 0) return 0;

    const totalWeight = phases.reduce((sum, phase) => sum + phase.weight, 0);
    const weightedProgress = phases.reduce((sum, phase) => {
      return sum + (phase.progress * phase.weight);
    }, 0);

    return totalWeight > 0 ? weightedProgress / totalWeight : 0;
  }

  /**
   * Get progress for all phases
   * 
   * @returns {Promise<Object>} Progress for all phases
   */
  async getAllProgress() {
    const progress = {};
    for (const [name, phase] of this.phases.entries()) {
      progress[name] = phase.progress;
    }
    return progress;
  }

  /**
   * Set progress for a task within a phase
   * 
   * @param {string} phaseName - Phase name
   * @param {string} taskName - Task name
   * @param {number} progress - Progress percentage (0-100)
   * @returns {Promise<void>}
   */
  async setTaskProgress(phaseName, taskName, progress) {
    this._validatePhaseName(phaseName);
    this._validateTaskName(taskName);
    this._validateProgress(progress);

    if (!this.tasks.has(phaseName)) {
      this.tasks.set(phaseName, new Map());
    }

    const phaseTasks = this.tasks.get(phaseName);
    if (!phaseTasks.has(taskName)) {
      phaseTasks.set(taskName, {
        name: taskName,
        phase: phaseName,
        progress: 0,
        completed: false,
        startedAt: null,
        completedAt: null,
        weight: 1.0
      });
    }

    const task = phaseTasks.get(taskName);
    task.progress = progress;
    task.updatedAt = Date.now();

    if (!task.startedAt && progress > 0) {
      task.startedAt = Date.now();
    }

    if (progress >= 100 && !task.completed) {
      task.completed = true;
      task.completedAt = Date.now();
    }

    // Update phase progress based on task progress
    await this._updatePhaseProgressFromTasks(phaseName);
    
    this._markDirty();
  }

  /**
   * Get progress for a specific task
   * 
   * @param {string} phaseName - Phase name
   * @param {string} taskName - Task name
   * @returns {Promise<number>} Task progress percentage
   */
  async getTaskProgress(phaseName, taskName) {
    const phaseTasks = this.tasks.get(phaseName);
    if (!phaseTasks) return 0;
    
    const task = phaseTasks.get(taskName);
    return task ? task.progress : 0;
  }

  /**
   * Register a new phase
   * 
   * @param {string} phaseName - Phase name
   * @param {Object} config - Phase configuration
   * @returns {Promise<void>}
   */
  async registerPhase(phaseName, config = {}) {
    this._validatePhaseName(phaseName);

    this.phases.set(phaseName, {
      name: phaseName,
      progress: 0,
      completed: false,
      startedAt: null,
      completedAt: null,
      order: config.order || this.phases.size + 1,
      weight: config.weight || 1.0,
      tasks: config.tasks || [],
      description: config.description || '',
      ...config
    });

    // Initialize tasks if provided
    if (config.tasks && config.tasks.length > 0) {
      const phaseTasks = new Map();
      for (const taskName of config.tasks) {
        phaseTasks.set(taskName, {
          name: taskName,
          phase: phaseName,
          progress: 0,
          completed: false,
          startedAt: null,
          completedAt: null,
          weight: 1.0
        });
      }
      this.tasks.set(phaseName, phaseTasks);
    }

    this._markDirty();
  }

  /**
   * Get all registered phases
   * 
   * @returns {Promise<Object>} All phases
   */
  async getPhases() {
    const phases = {};
    for (const [name, phase] of this.phases.entries()) {
      phases[name] = { ...phase };
    }
    return phases;
  }

  /**
   * Get current active phase
   * 
   * @returns {Promise<string|null>} Current phase name
   */
  async getCurrentPhase() {
    const phases = Array.from(this.phases.values())
      .sort((a, b) => a.order - b.order);

    // Find the first phase that's in progress (0 < progress < 100)
    for (const phase of phases) {
      if (phase.progress > 0 && phase.progress < 100) {
        return phase.name;
      }
    }

    // If no phase is in progress, return the first incomplete phase
    for (const phase of phases) {
      if (!phase.completed && phase.progress < 100) {
        return phase.name;
      }
    }

    return null;
  }

  /**
   * Mark a phase as complete
   * 
   * @param {string} phaseName - Phase name
   * @returns {Promise<void>}
   */
  async completePhase(phaseName) {
    await this.setPhaseProgress(phaseName, 100);
    
    const phase = this.phases.get(phaseName);
    if (phase) {
      phase.completed = true;
      phase.completedAt = Date.now();
      
      if (this.config.enableEvents) {
        this.emit('progress-updated', {
          type: 'phase-completed',
          phase: phaseName,
          timestamp: Date.now()
        });
      }
    }
    
    this._markDirty();
  }

  /**
   * Get next phase to work on
   * 
   * @returns {Promise<string|null>} Next phase name
   */
  async getNextPhase() {
    const phases = Array.from(this.phases.values())
      .sort((a, b) => a.order - b.order);

    for (const phase of phases) {
      if (!phase.completed) {
        return phase.name;
      }
    }

    return null;
  }

  /**
   * Get phase information
   * 
   * @param {string} phaseName - Phase name
   * @returns {Promise<Object|null>} Phase information
   */
  async getPhaseInfo(phaseName) {
    const phase = this.phases.get(phaseName);
    return phase ? { ...phase } : null;
  }

  /**
   * Get tasks for a phase
   * 
   * @param {string} phaseName - Phase name
   * @returns {Promise<Array>} Phase tasks
   */
  async getPhaseTasks(phaseName) {
    const phaseTasks = this.tasks.get(phaseName);
    if (!phaseTasks) return [];
    
    return Array.from(phaseTasks.values()).map(task => ({ ...task }));
  }

  /**
   * Mark a task as complete
   * 
   * @param {string} phaseName - Phase name
   * @param {string} taskName - Task name
   * @returns {Promise<void>}
   */
  async completeTask(phaseName, taskName) {
    await this.setTaskProgress(phaseName, taskName, 100);
  }

  /**
   * Get task information
   * 
   * @param {string} phaseName - Phase name
   * @param {string} taskName - Task name
   * @returns {Promise<Object|null>} Task information
   */
  async getTaskInfo(phaseName, taskName) {
    const phaseTasks = this.tasks.get(phaseName);
    if (!phaseTasks) return null;
    
    const task = phaseTasks.get(taskName);
    return task ? { ...task } : null;
  }

  /**
   * Get incomplete tasks for a phase
   * 
   * @param {string} phaseName - Phase name
   * @returns {Promise<Array>} Incomplete tasks
   */
  async getIncompleteTasks(phaseName) {
    const tasks = await this.getPhaseTasks(phaseName);
    return tasks.filter(task => task.progress < 100);
  }

  /**
   * Start a new session
   * 
   * @param {string} projectName - Project name
   * @param {Object} config - Session configuration
   * @returns {Promise<string>} Session ID
   */
  async startSession(projectName, config = {}) {
    const sessionId = uuidv4();
    
    this.currentSession = {
      id: sessionId,
      projectName,
      startedAt: Date.now(),
      endedAt: null,
      progress: {},
      finalProgress: null,
      ...config
    };

    this.sessions.set(sessionId, this.currentSession);
    this._markDirty();
    
    return sessionId;
  }

  /**
   * End current session
   * 
   * @returns {Promise<void>}
   */
  async endSession() {
    if (!this.currentSession) return;

    this.currentSession.endedAt = Date.now();
    this.currentSession.finalProgress = await this.getOverallProgress();
    
    this.currentSession = null;
    this._markDirty();
  }

  /**
   * Resume a previous session
   * 
   * @param {string} sessionId - Session ID
   * @returns {Promise<void>}
   */
  async resumeSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    this.currentSession = session;
    
    // Restore progress if saved in session
    if (session.progress) {
      for (const [phaseName, progress] of Object.entries(session.progress)) {
        await this.setPhaseProgress(phaseName, progress);
      }
    }
  }

  /**
   * Get current session
   * 
   * @returns {Promise<Object|null>} Current session
   */
  async getCurrentSession() {
    return this.currentSession ? { ...this.currentSession } : null;
  }

  /**
   * Get session by ID
   * 
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object|null>} Session
   */
  async getSession(sessionId) {
    const session = this.sessions.get(sessionId);
    return session ? { ...session } : null;
  }

  /**
   * Get session history
   * 
   * @returns {Promise<Array>} Session history
   */
  async getSessionHistory() {
    return Array.from(this.sessions.values())
      .sort((a, b) => b.startedAt - a.startedAt)
      .map(session => ({ ...session }));
  }

  /**
   * Get completion statistics
   * 
   * @returns {Promise<Object>} Completion statistics
   */
  async getCompletionStats() {
    const phases = Array.from(this.phases.values());
    const totalPhases = phases.length;
    const completedPhases = phases.filter(p => p.progress >= 100).length;
    const inProgressPhases = phases.filter(p => p.progress > 0 && p.progress < 100).length;
    const pendingPhases = phases.filter(p => p.progress === 0).length;
    const overallCompletion = await this.getOverallProgress();

    return {
      totalPhases,
      completedPhases,
      inProgressPhases,
      pendingPhases,
      overallCompletion
    };
  }

  /**
   * Get time estimate for completion
   * 
   * @returns {Promise<Object>} Time estimate
   */
  async getTimeEstimate() {
    if (!this.currentSession) {
      return {
        estimatedRemaining: null,
        basedOnCurrentSpeed: false
      };
    }

    const sessionDuration = Date.now() - this.currentSession.startedAt;
    const currentProgress = await this.getOverallProgress();
    
    if (currentProgress <= 0) {
      return {
        estimatedRemaining: null,
        basedOnCurrentSpeed: false
      };
    }

    const progressRate = currentProgress / sessionDuration; // progress per ms
    const remainingProgress = 100 - currentProgress;
    const estimatedRemaining = remainingProgress / progressRate;

    return {
      estimatedRemaining: Math.round(estimatedRemaining),
      basedOnCurrentSpeed: true,
      sessionDuration,
      currentProgress,
      progressRate: progressRate * 3600000 // per hour
    };
  }

  /**
   * Get velocity metrics
   * 
   * @returns {Promise<Object>} Velocity metrics
   */
  async getVelocityMetrics() {
    if (!this.currentSession) {
      return {
        tasksCompletedPerHour: 0,
        progressPerHour: 0
      };
    }

    const sessionDuration = Date.now() - this.currentSession.startedAt;
    const hoursElapsed = sessionDuration / 3600000; // ms to hours

    if (hoursElapsed <= 0) {
      return {
        tasksCompletedPerHour: 0,
        progressPerHour: 0
      };
    }

    // Count completed tasks across all phases
    let completedTasks = 0;
    for (const phaseTasks of this.tasks.values()) {
      for (const task of phaseTasks.values()) {
        if (task.completed) {
          completedTasks++;
        }
      }
    }

    const currentProgress = await this.getOverallProgress();

    return {
      tasksCompletedPerHour: completedTasks / hoursElapsed,
      progressPerHour: currentProgress / hoursElapsed,
      hoursElapsed,
      completedTasks
    };
  }

  /**
   * Create a milestone
   * 
   * @param {string} name - Milestone name
   * @param {Object} config - Milestone configuration
   * @returns {Promise<void>}
   */
  async createMilestone(name, config = {}) {
    this.milestones.set(name, {
      name,
      description: config.description || '',
      targetDate: config.targetDate || null,
      requiredPhases: config.requiredPhases || [],
      completed: false,
      completedAt: null,
      createdAt: Date.now(),
      ...config
    });

    this._markDirty();
  }

  /**
   * Get milestone
   * 
   * @param {string} name - Milestone name
   * @returns {Promise<Object|null>} Milestone
   */
  async getMilestone(name) {
    const milestone = this.milestones.get(name);
    return milestone ? { ...milestone } : null;
  }

  /**
   * Get upcoming milestones
   * 
   * @returns {Promise<Array>} Upcoming milestones
   */
  async getUpcomingMilestones() {
    return Array.from(this.milestones.values())
      .filter(m => !m.completed)
      .sort((a, b) => (a.targetDate || 0) - (b.targetDate || 0))
      .map(milestone => ({ ...milestone }));
  }

  /**
   * Create a progress checkpoint
   * 
   * @param {string} name - Checkpoint name
   * @returns {Promise<string>} Checkpoint ID
   */
  async createCheckpoint(name) {
    const checkpointId = uuidv4();
    
    this.checkpoints.set(checkpointId, {
      id: checkpointId,
      name,
      progress: await this.getAllProgress(),
      tasks: this._serializeTasks(),
      sessions: Array.from(this.sessions.entries()),
      createdAt: Date.now()
    });

    this._markDirty();
    return checkpointId;
  }

  /**
   * Get checkpoint
   * 
   * @param {string} checkpointId - Checkpoint ID
   * @returns {Promise<Object|null>} Checkpoint
   */
  async getCheckpoint(checkpointId) {
    const checkpoint = this.checkpoints.get(checkpointId);
    return checkpoint ? { ...checkpoint } : null;
  }

  /**
   * Rollback to checkpoint
   * 
   * @param {string} checkpointId - Checkpoint ID
   * @returns {Promise<void>}
   */
  async rollbackToCheckpoint(checkpointId) {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) {
      throw new Error('Checkpoint not found');
    }

    // Restore progress
    this.phases.clear();
    for (const [phaseName, progress] of Object.entries(checkpoint.progress)) {
      await this.setPhaseProgress(phaseName, progress);
    }

    // Restore tasks
    this._deserializeTasks(checkpoint.tasks);

    this._markDirty();
  }

  /**
   * Save progress to file
   * 
   * @returns {Promise<void>}
   */
  async save() {
    if (!this.config.persistToFile) return;

    try {
      const data = {
        phases: Array.from(this.phases.entries()),
        tasks: this._serializeTasks(),
        sessions: Array.from(this.sessions.entries()),
        milestones: Array.from(this.milestones.entries()),
        checkpoints: Array.from(this.checkpoints.entries()),
        currentSession: this.currentSession,
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
      console.warn('Failed to save progress:', error.message);
    }
  }

  /**
   * Load progress from file
   * 
   * @returns {Promise<void>}
   */
  async load() {
    if (!this.config.persistToFile) return;

    try {
      const filePath = path.resolve(this.config.saveFilePath);
      const data = JSON.parse(await fs.readFile(filePath, 'utf8'));

      // Restore data
      this.phases = new Map(data.phases || []);
      this._deserializeTasks(data.tasks || []);
      this.sessions = new Map(data.sessions || []);
      this.milestones = new Map(data.milestones || []);
      this.checkpoints = new Map(data.checkpoints || []);
      this.currentSession = data.currentSession || null;
      this.lastSaveTime = data.lastSaveTime;

      this.isDirtyFlag = false;
    } catch (error) {
      // File doesn't exist or is invalid, start fresh
      this._initializeDefaultPhases();
    }
  }

  /**
   * Clear all progress
   * 
   * @returns {Promise<void>}
   */
  async clear() {
    this.phases.clear();
    this.tasks.clear();
    this.sessions.clear();
    this.milestones.clear();
    this.checkpoints.clear();
    this.currentSession = null;
    
    this._stopAutoSave();
    this._initializeDefaultPhases();
    
    if (this.config.autoSave && this.config.saveInterval > 0) {
      this._startAutoSave();
    }
    
    this._markDirty();
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this._stopAutoSave();
    this.removeAllListeners();
  }

  /**
   * Check if progress has unsaved changes
   * 
   * @returns {boolean} True if dirty
   */
  isDirty() {
    return this.isDirtyFlag;
  }

  /**
   * Private helper methods
   */

  _initializeDefaultPhases() {
    const defaultPhases = [
      { name: 'planning', order: 1, weight: 1.0 },
      { name: 'generation', order: 2, weight: 1.0 },
      { name: 'testing', order: 3, weight: 1.0 },
      { name: 'validation', order: 4, weight: 1.0 }
    ];

    for (const phase of defaultPhases) {
      this.phases.set(phase.name, {
        name: phase.name,
        progress: 0,
        completed: false,
        startedAt: null,
        completedAt: null,
        order: phase.order,
        weight: phase.weight
      });
    }
  }

  _validatePhaseName(phaseName) {
    if (phaseName === undefined || phaseName === null) {
      throw new Error('Phase name is required');
    }
    if (typeof phaseName !== 'string' || phaseName.trim() === '') {
      throw new Error('Phase name cannot be empty');
    }
  }

  _validateTaskName(taskName) {
    if (taskName === undefined || taskName === null) {
      throw new Error('Task name is required');
    }
    if (typeof taskName !== 'string' || taskName.trim() === '') {
      throw new Error('Task name cannot be empty');
    }
  }

  _validateProgress(progress) {
    if (typeof progress !== 'number' || progress < 0 || progress > 100) {
      throw new Error('Progress must be between 0 and 100');
    }
  }

  async _updatePhaseProgressFromTasks(phaseName) {
    const phaseTasks = this.tasks.get(phaseName);
    if (!phaseTasks || phaseTasks.size === 0) return;

    const tasks = Array.from(phaseTasks.values());
    const totalWeight = tasks.reduce((sum, task) => sum + task.weight, 0);
    const weightedProgress = tasks.reduce((sum, task) => {
      return sum + (task.progress * task.weight);
    }, 0);

    const phaseProgress = totalWeight > 0 ? weightedProgress / totalWeight : 0;
    await this.setPhaseProgress(phaseName, phaseProgress);
  }

  async _checkMilestones() {
    for (const milestone of this.milestones.values()) {
      if (milestone.completed) continue;

      // Check if all required phases are completed
      const allRequiredComplete = milestone.requiredPhases.every((phaseName) => {
        const phase = this.phases.get(phaseName);
        return phase && phase.progress >= 100;
      });

      if (allRequiredComplete && milestone.requiredPhases.length > 0) {
        milestone.completed = true;
        milestone.completedAt = Date.now();

        if (this.config.enableEvents) {
          this.emit('milestone-reached', {
            milestone: milestone.name,
            timestamp: Date.now()
          });
        }
      }
    }
  }

  _serializeTasks() {
    const serialized = [];
    for (const [phaseName, phaseTasks] of this.tasks.entries()) {
      serialized.push([phaseName, Array.from(phaseTasks.entries())]);
    }
    return serialized;
  }

  _deserializeTasks(serializedTasks) {
    this.tasks.clear();
    for (const [phaseName, taskEntries] of serializedTasks) {
      this.tasks.set(phaseName, new Map(taskEntries));
    }
  }

  _markDirty() {
    this.isDirtyFlag = true;
  }

  _startAutoSave() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }

    this.autoSaveTimer = setInterval(async () => {
      if (this.isDirtyFlag) {
        await this.save();
      }
    }, this.config.saveInterval);
  }

  _stopAutoSave() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }
}

export { ProgressManager };