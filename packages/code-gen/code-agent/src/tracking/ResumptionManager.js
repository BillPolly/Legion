/**
 * ResumptionManager - Manages resumption capabilities and workflow continuity
 * 
 * Handles state snapshots, session resumption, recovery mechanisms,
 * and workflow continuity across interruptions.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import path from 'path';

class ResumptionManager extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      autoSave: true,
      persistToFile: true,
      saveFilePath: './resumption.json',
      maxSnapshots: 10,
      compressionEnabled: false,
      saveInterval: 60000, // 1 minute
      ...config
    };

    // State storage
    this.snapshots = new Map();
    this.sessions = new Map();
    this.resumptionPoints = new Map();
    this.interruptions = new Map();
    
    // State tracking
    this.isDirtyFlag = false;
    this.lastSaveTime = null;
    this.autoSaveTimer = null;
    
    // Start auto-save if enabled
    if (this.config.autoSave && this.config.saveInterval > 0) {
      this._startAutoSave();
    }
  }

  /**
   * Create a state snapshot
   * 
   * @param {string} name - Snapshot name
   * @param {Object} state - State to snapshot
   * @returns {Promise<string>} Snapshot ID
   */
  async createSnapshot(name, state) {
    if (!name || name.trim() === '') {
      throw new Error('Snapshot name cannot be empty');
    }
    
    if (state === null || state === undefined) {
      throw new Error('Snapshot state cannot be null');
    }

    const snapshotId = uuidv4();
    
    // Compress state if enabled
    let processedState = state;
    let compressed = false;
    
    if (this.config.compressionEnabled) {
      try {
        processedState = await this._compressState(state);
        compressed = true;
      } catch (error) {
        // Fall back to uncompressed if compression fails
        processedState = state;
      }
    }

    const snapshot = {
      id: snapshotId,
      name,
      state: processedState,
      compressed,
      createdAt: Date.now(),
      version: '1.0.0'
    };

    this.snapshots.set(snapshotId, snapshot);
    this._enforceSnapshotLimit();
    this._markDirty();
    
    return snapshotId;
  }

  /**
   * Get a snapshot by ID
   * 
   * @param {string} snapshotId - Snapshot ID
   * @returns {Promise<Object>} Snapshot
   */
  async getSnapshot(snapshotId) {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) {
      throw new Error('Snapshot not found');
    }

    let state = snapshot.state;
    
    // Decompress if needed
    if (snapshot.compressed) {
      state = await this._decompressState(snapshot.state);
    }

    return {
      ...snapshot,
      state
    };
  }

  /**
   * List all snapshots
   * 
   * @returns {Promise<Array>} Snapshots sorted by creation time (newest first)
   */
  async listSnapshots() {
    return Array.from(this.snapshots.values())
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(snapshot => ({
        id: snapshot.id,
        name: snapshot.name,
        createdAt: snapshot.createdAt,
        compressed: snapshot.compressed,
        version: snapshot.version
      }));
  }

  /**
   * Delete a snapshot
   * 
   * @param {string} snapshotId - Snapshot ID
   * @returns {Promise<void>}
   */
  async deleteSnapshot(snapshotId) {
    if (!this.snapshots.has(snapshotId)) {
      throw new Error('Snapshot not found');
    }

    this.snapshots.delete(snapshotId);
    this._markDirty();
  }

  /**
   * Create a resumable session
   * 
   * @param {string} name - Session name
   * @param {Object} config - Session configuration
   * @returns {Promise<string>} Session ID
   */
  async createSession(name, config = {}) {
    const sessionId = uuidv4();
    
    const session = {
      id: sessionId,
      name,
      config,
      status: 'active',
      createdAt: Date.now(),
      startedAt: Date.now(),
      pausedAt: null,
      resumedAt: null,
      completedAt: null,
      result: null
    };

    this.sessions.set(sessionId, session);
    this._markDirty();
    
    return sessionId;
  }

  /**
   * Get session by ID
   * 
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>} Session
   */
  async getSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    
    return { ...session };
  }

  /**
   * Pause a session
   * 
   * @param {string} sessionId - Session ID
   * @returns {Promise<void>}
   */
  async pauseSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    session.status = 'paused';
    session.pausedAt = Date.now();
    this._markDirty();
  }

  /**
   * Resume a session
   * 
   * @param {string} sessionId - Session ID
   * @returns {Promise<void>}
   */
  async resumeSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    session.status = 'active';
    session.resumedAt = Date.now();
    this._markDirty();
  }

  /**
   * Complete a session
   * 
   * @param {string} sessionId - Session ID
   * @param {Object} result - Session result
   * @returns {Promise<void>}
   */
  async completeSession(sessionId, result = {}) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    session.status = 'completed';
    session.completedAt = Date.now();
    session.result = result;
    this._markDirty();
  }

  /**
   * Get active sessions
   * 
   * @returns {Promise<Array>} Active sessions
   */
  async getActiveSessions() {
    return Array.from(this.sessions.values())
      .filter(session => session.status === 'active')
      .map(session => ({ ...session }));
  }

  /**
   * Restore state from snapshot
   * 
   * @param {string} snapshotId - Snapshot ID
   * @param {Object} options - Restoration options
   * @returns {Promise<Object>} Restored state
   */
  async restoreState(snapshotId, options = {}) {
    const snapshot = await this.getSnapshot(snapshotId);
    let state = snapshot.state;

    if (options.fillDefaults) {
      state = this._fillStateDefaults(state);
    } else if (options.allowPartial && !this._isCompleteState(state)) {
      // Allow partial state without defaults
    }

    return state;
  }

  /**
   * Validate state integrity
   * 
   * @param {Object} state - State to validate
   * @returns {Promise<Object>} Validation result
   */
  async validateState(state) {
    const validation = {
      isValid: true,
      errors: [],
      warnings: []
    };

    // Required fields
    const requiredFields = ['currentPhase'];
    for (const field of requiredFields) {
      if (!state[field]) {
        validation.isValid = false;
        validation.errors.push(`Missing required field: ${field}`);
      }
    }

    // Optional but recommended fields
    const recommendedFields = ['progress', 'tasks', 'configuration'];
    for (const field of recommendedFields) {
      if (!state[field]) {
        validation.warnings.push(`Missing recommended field: ${field}`);
      }
    }

    return validation;
  }

  /**
   * Create a resumption point
   * 
   * @param {string} name - Point name
   * @param {Object} data - Point data
   * @returns {Promise<string>} Point ID
   */
  async createResumptionPoint(name, data) {
    const pointId = uuidv4();
    
    const point = {
      id: pointId,
      name,
      data,
      createdAt: Date.now()
    };

    this.resumptionPoints.set(pointId, point);
    this._markDirty();
    
    return pointId;
  }

  /**
   * Get resumption point by ID
   * 
   * @param {string} pointId - Point ID
   * @returns {Promise<Object>} Resumption point
   */
  async getResumptionPoint(pointId) {
    const point = this.resumptionPoints.get(pointId);
    if (!point) {
      throw new Error('Resumption point not found');
    }
    
    return { ...point };
  }

  /**
   * Find resumption points by criteria
   * 
   * @param {Object} criteria - Search criteria
   * @returns {Promise<Array>} Matching points
   */
  async findResumptionPoints(criteria) {
    return Array.from(this.resumptionPoints.values())
      .filter(point => {
        for (const [key, value] of Object.entries(criteria)) {
          if (point.data[key] !== value) {
            return false;
          }
        }
        return true;
      })
      .map(point => ({ ...point }));
  }

  /**
   * Get latest resumption point
   * 
   * @returns {Promise<Object|null>} Latest point
   */
  async getLatestResumptionPoint() {
    const points = Array.from(this.resumptionPoints.values());
    if (points.length === 0) return null;
    
    return points.reduce((latest, current) => 
      current.createdAt > latest.createdAt ? current : latest
    );
  }

  /**
   * Mark workflow as interrupted
   * 
   * @param {string} sessionId - Session ID
   * @param {Object} details - Interruption details
   * @returns {Promise<void>}
   */
  async markWorkflowInterrupted(sessionId, details) {
    const interruption = {
      sessionId,
      ...details,
      detectedAt: Date.now()
    };

    this.interruptions.set(sessionId, interruption);
    this._markDirty();
  }

  /**
   * Get interrupted workflows
   * 
   * @returns {Promise<Array>} Interrupted workflows
   */
  async getInterruptedWorkflows() {
    return Array.from(this.interruptions.values())
      .map(interruption => ({ ...interruption }));
  }

  /**
   * Suggest resumption strategy
   * 
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>} Resumption strategy
   */
  async suggestResumptionStrategy(sessionId) {
    const session = await this.getSession(sessionId);
    const interruption = this.interruptions.get(sessionId);
    
    const strategies = {
      continue: {
        type: 'continue',
        description: 'Continue from last known state',
        confidence: 0.8,
        risks: ['potential-data-loss']
      },
      'restart-step': {
        type: 'restart-step',
        description: 'Restart current step',
        confidence: 0.9,
        risks: ['duplicate-work']
      },
      rollback: {
        type: 'rollback',
        description: 'Rollback to previous checkpoint',
        confidence: 0.95,
        risks: ['lost-progress']
      }
    };

    // Simple heuristic for recommendation
    let recommended = 'continue';
    if (interruption?.reason === 'system-crash') {
      recommended = 'rollback';
    } else if (session.config.currentPhase === 'generation') {
      recommended = 'restart-step';
    }

    return {
      recommended,
      options: Object.values(strategies),
      reasoning: `Based on session state and interruption type: ${interruption?.reason || 'unknown'}`
    };
  }

  /**
   * Validate resumption feasibility
   * 
   * @param {string} sessionId - Session ID
   * @param {Object} currentState - Current file system state
   * @returns {Promise<Object>} Feasibility assessment
   */
  async validateResumptionFeasibility(sessionId, currentState) {
    const session = await this.getSession(sessionId);
    
    const assessment = {
      canResume: true,
      requiredActions: [],
      riskLevel: 'low',
      warnings: []
    };

    // Check working directory
    if (session.config.workingDirectory && currentState.files) {
      if (!currentState.files.includes('package.json')) {
        assessment.requiredActions.push('restore-package-json');
        assessment.riskLevel = 'medium';
      }
    }

    // Check dependencies
    if (session.config.targetFramework && currentState.dependencies) {
      const frameworkInstalled = currentState.dependencies.includes(session.config.targetFramework);
      if (!frameworkInstalled) {
        assessment.requiredActions.push('install-dependencies');
      }
    }

    return assessment;
  }

  /**
   * Perform automatic recovery
   * 
   * @param {string} sessionId - Session ID
   * @param {Object} options - Recovery options
   * @returns {Promise<Object>} Recovery result
   */
  async performAutomaticRecovery(sessionId, options = {}) {
    const { strategy = 'rollback-to-snapshot', snapshotName } = options;
    
    try {
      let restoredState = null;
      
      if (strategy === 'rollback-to-snapshot' && snapshotName) {
        const snapshots = await this.listSnapshots();
        const targetSnapshot = snapshots.find(s => s.name === snapshotName);
        
        if (targetSnapshot) {
          restoredState = await this.restoreState(targetSnapshot.id);
        }
      }

      return {
        success: true,
        strategy,
        restoredState,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Resolve recovery conflicts
   * 
   * @param {string} sessionId - Session ID
   * @param {Object} conflictingState - State with conflicts
   * @returns {Promise<Object>} Resolution strategy
   */
  async resolveRecoveryConflicts(sessionId, conflictingState) {
    const conflicts = conflictingState.conflicts || [];
    
    const resolution = {
      strategy: 'merge',
      actions: [],
      userInteractionRequired: false
    };

    for (const conflict of conflicts) {
      if (conflict.type === 'content-mismatch') {
        resolution.actions.push({
          type: 'backup-and-restore',
          file: conflict.file,
          description: `Backup current ${conflict.file} and restore from snapshot`
        });
      } else if (conflict.type === 'version-conflict') {
        resolution.actions.push({
          type: 'merge-versions',
          file: conflict.file,
          description: `Merge version information in ${conflict.file}`
        });
        resolution.userInteractionRequired = true;
      }
    }

    return resolution;
  }

  /**
   * Generate recovery report
   * 
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>} Recovery report
   */
  async generateRecoveryReport(sessionId) {
    const session = await this.getSession(sessionId);
    const interruption = this.interruptions.get(sessionId);
    const strategy = await this.suggestResumptionStrategy(sessionId);
    
    return {
      sessionInfo: {
        id: sessionId,
        name: session.name,
        projectName: session.config.projectName,
        status: session.status
      },
      interruptionDetails: interruption || { reason: 'unknown' },
      availableRecoveryOptions: strategy.options,
      recommendations: strategy.recommended,
      riskAssessment: {
        dataLoss: interruption?.reason === 'system-crash' ? 'high' : 'low',
        corruption: 'low',
        timeToRecover: '5-15 minutes'
      },
      generatedAt: Date.now()
    };
  }

  /**
   * Integration methods
   */

  async integrateWithTaskTracker(snapshotId) {
    const snapshot = await this.getSnapshot(snapshotId);
    const taskTrackerState = snapshot.state.taskTracker;
    
    if (!taskTrackerState) {
      return { tasksToRestore: [], dependenciesToRestore: {} };
    }

    return {
      tasksToRestore: taskTrackerState.tasks || [],
      dependenciesToRestore: taskTrackerState.dependencies || {},
      resumptionPoint: {
        type: 'task-tracker',
        data: taskTrackerState
      }
    };
  }

  async integrateWithProgressManager(snapshotId) {
    const snapshot = await this.getSnapshot(snapshotId);
    const progressState = snapshot.state.progressManager;
    
    if (!progressState) {
      return { progressToRestore: {}, sessionToResume: null };
    }

    return {
      progressToRestore: progressState.phases || {},
      sessionToResume: progressState.currentSession,
      milestonesToCheck: progressState.milestones || []
    };
  }

  /**
   * Error recovery methods
   */

  async recoverFromCorruption(corruptedData) {
    const recovery = {
      recoveredSessions: [],
      recoveredSnapshots: [],
      lostData: []
    };

    // Try to recover sessions
    if (corruptedData.sessions && typeof corruptedData.sessions === 'object') {
      for (const [id, session] of Object.entries(corruptedData.sessions)) {
        if (session && session.id && session.name) {
          recovery.recoveredSessions.push(session);
        } else {
          recovery.lostData.push({ type: 'session', id });
        }
      }
    }

    // Try to recover snapshots
    if (Array.isArray(corruptedData.snapshots)) {
      for (const snapshot of corruptedData.snapshots) {
        if (snapshot && snapshot.id && snapshot.state) {
          recovery.recoveredSnapshots.push(snapshot);
        } else {
          recovery.lostData.push({ type: 'snapshot', data: snapshot });
        }
      }
    }

    return recovery;
  }

  async checkCompatibility(snapshot) {
    const currentVersion = '1.0.0';
    const snapshotVersion = snapshot.version || '0.1.0';
    
    const compatibility = {
      isCompatible: true,
      migrationRequired: false,
      warnings: []
    };

    if (snapshotVersion !== currentVersion) {
      compatibility.migrationRequired = true;
      compatibility.warnings.push(`Version mismatch: ${snapshotVersion} -> ${currentVersion}`);
    }

    if (snapshot.state && snapshot.state.legacy) {
      compatibility.warnings.push('Snapshot contains legacy data structure');
    }

    return compatibility;
  }

  /**
   * Data persistence methods
   */

  async save() {
    if (!this.config.persistToFile) return;

    try {
      const data = {
        snapshots: Array.from(this.snapshots.entries()),
        sessions: Array.from(this.sessions.entries()),
        resumptionPoints: Array.from(this.resumptionPoints.entries()),
        interruptions: Array.from(this.interruptions.entries()),
        lastSaveTime: Date.now(),
        version: '1.0.0'
      };

      const filePath = path.resolve(this.config.saveFilePath);
      const dir = path.dirname(filePath);

      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
      
      this.lastSaveTime = Date.now();
      this.isDirtyFlag = false;
    } catch (error) {
      console.warn('Failed to save resumption data:', error.message);
    }
  }

  async load() {
    if (!this.config.persistToFile) return;

    try {
      const filePath = path.resolve(this.config.saveFilePath);
      const data = JSON.parse(await fs.readFile(filePath, 'utf8'));

      this.snapshots = new Map(data.snapshots || []);
      this.sessions = new Map(data.sessions || []);
      this.resumptionPoints = new Map(data.resumptionPoints || []);
      this.interruptions = new Map(data.interruptions || []);
      this.lastSaveTime = data.lastSaveTime;

      this.isDirtyFlag = false;
    } catch (error) {
      // File doesn't exist or is invalid, start fresh
      this.snapshots = new Map();
      this.sessions = new Map();
      this.resumptionPoints = new Map();
      this.interruptions = new Map();
    }
  }

  async clear() {
    this.snapshots.clear();
    this.sessions.clear();
    this.resumptionPoints.clear();
    this.interruptions.clear();
    
    this._stopAutoSave();
    if (this.config.autoSave && this.config.saveInterval > 0) {
      this._startAutoSave();
    }
    
    this._markDirty();
  }

  destroy() {
    this._stopAutoSave();
    this.removeAllListeners();
  }

  isDirty() {
    return this.isDirtyFlag;
  }

  /**
   * Private helper methods
   */

  _enforceSnapshotLimit() {
    const snapshots = Array.from(this.snapshots.entries())
      .sort(([,a], [,b]) => b.createdAt - a.createdAt);

    while (snapshots.length > this.config.maxSnapshots) {
      const [oldestId] = snapshots.pop();
      this.snapshots.delete(oldestId);
    }
  }

  _isCompleteState(state) {
    const requiredFields = ['currentPhase', 'progress'];
    return requiredFields.every(field => state[field] !== undefined);
  }

  _fillStateDefaults(state) {
    return {
      currentPhase: 'planning',
      progress: {},
      tasks: [],
      configuration: {},
      ...state
    };
  }

  async _compressState(state) {
    // Simple compression simulation - in real implementation would use zlib
    return {
      _compressed: true,
      data: JSON.stringify(state)
    };
  }

  async _decompressState(compressedState) {
    if (compressedState._compressed) {
      return JSON.parse(compressedState.data);
    }
    return compressedState;
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

export { ResumptionManager };