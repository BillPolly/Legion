/**
 * RollbackSystem - Comprehensive rollback and state restoration
 * 
 * Provides state restoration, handle state rollback, partial rollback,
 * and rollback validation functionality
 */

export class RollbackSystem {
  constructor(plan, handleRegistry, checkpointManager, stateCaptureSystem, options = {}) {
    this.plan = plan;
    this.handleRegistry = handleRegistry;
    this.checkpointManager = checkpointManager;
    this.stateCaptureSystem = stateCaptureSystem;
    
    this.options = {
      validateBeforeRollback: options.validateBeforeRollback !== false,
      createBackupBeforeRollback: options.createBackupBeforeRollback !== false,
      preserveRollbackHistory: options.preserveRollbackHistory !== false,
      maxRollbackDepth: options.maxRollbackDepth || 10,
      ...options
    };

    this.statistics = {
      totalRollbacks: 0,
      successfulRollbacks: 0,
      failedRollbacks: 0,
      lastRollbackTime: null
    };

    this.rollbackHistory = [];
    this.backups = new Map();
  }

  /**
   * Restore state from checkpoint
   */
  restoreFromCheckpoint(checkpointId) {
    if (!checkpointId || typeof checkpointId !== 'string') {
      throw new Error('Invalid checkpoint ID');
    }

    const startTime = Date.now();
    let backupId = null;

    try {
      // Get checkpoint
      const checkpoint = this.checkpointManager.getCheckpoint(checkpointId);
      if (!checkpoint) {
        this.statistics.totalRollbacks++;
        this.statistics.failedRollbacks++;
        return this._createResult(false, 'Checkpoint not found', 'CHECKPOINT_NOT_FOUND', { checkpointId });
      }

      // Validate checkpoint integrity
      if (!checkpoint.planState || !checkpoint.handleSnapshot) {
        this.statistics.totalRollbacks++;
        this.statistics.failedRollbacks++;
        return this._createResult(false, 'Checkpoint is corrupted or incomplete', 'CORRUPTED_CHECKPOINT', { checkpointId });
      }

      // Validate before rollback
      if (this.options.validateBeforeRollback) {
        const validation = this.validateCurrentState();
        if (!validation.valid) {
          this.statistics.totalRollbacks++;
          this.statistics.failedRollbacks++;
          return this._createResult(false, `Current state validation failed: ${validation.issues.join(', ')}`, 'VALIDATION_FAILED', { validation });
        }
      }

      // Create backup before rollback
      if (this.options.createBackupBeforeRollback) {
        backupId = this.createRollbackBackup(`auto-backup-${Date.now()}`);
      } else {
        backupId = undefined; // Explicitly set to undefined when disabled
      }

      // Restore plan state
      this._restorePlanState(checkpoint.planState);

      // Restore handle state and collect warnings
      const warnings = this._restoreHandleState(checkpoint.handleSnapshot);

      // Update statistics
      this.statistics.totalRollbacks++;
      this.statistics.successfulRollbacks++;
      this.statistics.lastRollbackTime = new Date();

      // Add to history
      if (this.options.preserveRollbackHistory) {
        this._addToHistory({
          type: 'checkpoint',
          checkpointId,
          timestamp: new Date(),
          duration: Date.now() - startTime,
          backupId
        });
      }

      const resultDetails = { 
        checkpointId, 
        duration: Date.now() - startTime
      };
      
      // Only include backupId if it was created
      if (backupId !== undefined) {
        resultDetails.backupId = backupId;
      }
      
      // Include warnings if any
      if (warnings && warnings.length > 0) {
        resultDetails.warnings = warnings;
      }
      
      return this._createResult(true, 'Successfully restored from checkpoint', null, resultDetails);

    } catch (error) {
      this.statistics.totalRollbacks++;
      this.statistics.failedRollbacks++;
      
      return this._createResult(false, `Rollback failed: ${error.message}`, 'ROLLBACK_ERROR', { 
        checkpointId, 
        error: error.message,
        backupId
      });
    }
  }

  /**
   * Restore state from capture
   */
  restoreFromCapture(capture) {
    if (!capture || !capture.planState) {
      return this._createResult(false, 'Invalid capture data', 'INVALID_CAPTURE');
    }

    const startTime = Date.now();
    let backupId = null;

    try {
      // Validate capture
      const validation = this.stateCaptureSystem.validateCapture(capture);
      if (!validation.valid) {
        return this._createResult(false, `Capture validation failed: ${validation.errors.join(', ')}`, 'CAPTURE_INVALID', { validation });
      }

      // Create backup
      if (this.options.createBackupBeforeRollback) {
        backupId = this.createRollbackBackup(`capture-backup-${Date.now()}`);
      }

      // Get decompressed capture if needed
      const captureData = this.stateCaptureSystem._getDecompressedCapture(capture);

      // Restore states
      this._restorePlanState(captureData.planState);
      this._restoreHandleState(captureData.handles);

      // Update statistics
      this.statistics.totalRollbacks++;
      this.statistics.successfulRollbacks++;
      this.statistics.lastRollbackTime = new Date();

      return this._createResult(true, 'Successfully restored from capture', null, {
        captureId: capture.id,
        backupId,
        duration: Date.now() - startTime
      });

    } catch (error) {
      this.statistics.totalRollbacks++;
      this.statistics.failedRollbacks++;
      
      return this._createResult(false, `Capture rollback failed: ${error.message}`, 'CAPTURE_ROLLBACK_ERROR', { 
        error: error.message,
        backupId
      });
    }
  }

  /**
   * Rollback handle registry state only
   */
  rollbackHandleState(capture) {
    try {
      const captureData = this.stateCaptureSystem._getDecompressedCapture(capture);
      this._restoreHandleState(captureData.handles);
      
      return this._createResult(true, 'Handle state rolled back successfully');
    } catch (error) {
      return this._createResult(false, `Handle rollback failed: ${error.message}`, 'HANDLE_ROLLBACK_ERROR');
    }
  }

  /**
   * Rollback specific handles only
   */
  rollbackSpecificHandles(capture, handleNames) {
    try {
      const captureData = this.stateCaptureSystem._getDecompressedCapture(capture);
      
      // Update only the specified handles, preserve others
      for (const handleName of handleNames) {
        if (captureData.handles[handleName]) {
          const handleData = captureData.handles[handleName];
          
          // Delete existing handle if it exists
          if (this.handleRegistry.existsByName(handleName)) {
            const existingHandle = this.handleRegistry.getByName(handleName);
            this.handleRegistry.delete(existingHandle.id);
          }
          
          // Recreate with captured data
          this.handleRegistry.create(handleName, handleData.data, {
            ...handleData.metadata,
            restoredAt: new Date()
          });
        }
      }
      
      return this._createResult(true, `Successfully rolled back ${handleNames.length} handles`);
    } catch (error) {
      return this._createResult(false, `Selective handle rollback failed: ${error.message}`, 'SELECTIVE_ROLLBACK_ERROR');
    }
  }

  /**
   * Partial rollback with options
   */
  partialRollback(checkpointId, options = {}) {
    try {
      const checkpoint = this.checkpointManager.getCheckpoint(checkpointId);
      if (!checkpoint) {
        return this._createResult(false, 'Checkpoint not found', 'CHECKPOINT_NOT_FOUND');
      }

      let restoredComponents = [];

      if (options.includePlanState !== false) {
        this._restorePlanState(checkpoint.planState);
        restoredComponents.push('plan state');
      }

      if (options.includeHandleState !== false) {
        this._restoreHandleState(checkpoint.handleSnapshot);
        restoredComponents.push('handle state');
      }

      return this._createResult(true, `Partial rollback completed: ${restoredComponents.join(', ')}`);
    } catch (error) {
      return this._createResult(false, `Partial rollback failed: ${error.message}`, 'PARTIAL_ROLLBACK_ERROR');
    }
  }

  /**
   * Rollback specific steps
   */
  rollbackSteps(checkpointId, stepIds) {
    try {
      const checkpoint = this.checkpointManager.getCheckpoint(checkpointId);
      if (!checkpoint) {
        return this._createResult(false, 'Checkpoint not found', 'CHECKPOINT_NOT_FOUND');
      }

      const checkpointPlanState = checkpoint.planState;
      
      // Remove specified steps from completed/failed lists
      for (const stepId of stepIds) {
        const stepIndex = this.plan.state.completedSteps.indexOf(stepId);
        if (stepIndex !== -1) {
          this.plan.state.completedSteps.splice(stepIndex, 1);
        }
        
        const failedIndex = this.plan.state.failedSteps.indexOf(stepId);
        if (failedIndex !== -1) {
          this.plan.state.failedSteps.splice(failedIndex, 1);
        }
        
        // Remove step state
        delete this.plan.state.stepStates[stepId];
      }

      return this._createResult(true, `Successfully rolled back steps: ${stepIds.join(', ')}`);
    } catch (error) {
      return this._createResult(false, `Step rollback failed: ${error.message}`, 'STEP_ROLLBACK_ERROR');
    }
  }

  /**
   * Rollback with custom filter
   */
  rollbackWithFilter(checkpointId, filters = {}) {
    try {
      const checkpoint = this.checkpointManager.getCheckpoint(checkpointId);
      if (!checkpoint) {
        return this._createResult(false, 'Checkpoint not found', 'CHECKPOINT_NOT_FOUND');
      }

      // Apply plan state filter
      if (!filters.planFilter || filters.planFilter(checkpoint.planState)) {
        this._restorePlanState(checkpoint.planState);
      }

      // Apply handle filter - selectively rollback handles
      if (checkpoint.handleSnapshot && filters.handleFilter) {
        // Only rollback handles that match the filter, preserve others
        for (const [handleName, handleData] of Object.entries(checkpoint.handleSnapshot)) {
          if (filters.handleFilter(handleName, handleData)) {
            // Delete existing handle if it exists
            if (this.handleRegistry.existsByName(handleName)) {
              const existingHandle = this.handleRegistry.getByName(handleName);
              this.handleRegistry.delete(existingHandle.id);
            }
            
            // Recreate with checkpoint data
            this.handleRegistry.create(handleName, handleData.data, {
              ...handleData.metadata,
              restoredAt: new Date()
            });
          }
        }
      } else if (checkpoint.handleSnapshot) {
        this._restoreHandleState(checkpoint.handleSnapshot);
      }

      return this._createResult(true, 'Filtered rollback completed successfully');
    } catch (error) {
      return this._createResult(false, `Filtered rollback failed: ${error.message}`, 'FILTERED_ROLLBACK_ERROR');
    }
  }

  /**
   * Conditional rollback
   */
  conditionalRollback(checkpointId, condition) {
    try {
      const shouldRollback = condition.condition ? 
        condition.condition(this.plan.state) : 
        condition(this.plan.state);
      
      if (!shouldRollback) {
        return this._createResult(true, 'Rollback condition not met', null, { triggered: false });
      }

      const result = this.restoreFromCheckpoint(checkpointId);
      return { ...result, triggered: true };
    } catch (error) {
      return this._createResult(false, `Conditional rollback failed: ${error.message}`, 'CONDITIONAL_ROLLBACK_ERROR');
    }
  }

  /**
   * Rollback with transformations
   */
  rollbackWithTransform(checkpointId, transforms = {}) {
    try {
      const checkpoint = this.checkpointManager.getCheckpoint(checkpointId);
      if (!checkpoint) {
        return this._createResult(false, 'Checkpoint not found', 'CHECKPOINT_NOT_FOUND');
      }

      // Restore plan state with transformation
      let planState = checkpoint.planState;
      if (transforms.planTransform) {
        planState = transforms.planTransform(planState);
      }
      this._restorePlanState(planState);

      // Restore handles with transformation
      if (checkpoint.handleSnapshot) {
        const transformedHandles = {};
        for (const [handleName, handleData] of Object.entries(checkpoint.handleSnapshot)) {
          const transformedData = transforms.handleTransform ? 
            transforms.handleTransform(handleName, handleData.data) : 
            handleData.data;
          
          transformedHandles[handleName] = {
            ...handleData,
            data: transformedData
          };
        }
        this._restoreHandleState(transformedHandles);
      }

      return this._createResult(true, 'Transform rollback completed successfully');
    } catch (error) {
      return this._createResult(false, `Transform rollback failed: ${error.message}`, 'TRANSFORM_ROLLBACK_ERROR');
    }
  }

  /**
   * Rollback using incremental chain
   */
  rollbackIncrementalChain(captures, targetId) {
    try {
      const targetCapture = captures.find(c => c.id === targetId || c.name === targetId);
      if (!targetCapture) {
        return this._createResult(false, 'Target capture not found in chain', 'TARGET_NOT_FOUND');
      }

      // If target is a full capture, restore directly
      if (targetCapture.type === 'full') {
        return this.restoreFromCapture(targetCapture);
      }

      // For incremental, find base and apply up to target
      const baseCapture = captures.find(c => c.type === 'full');
      if (!baseCapture) {
        return this._createResult(false, 'No base capture found in chain', 'NO_BASE_CAPTURE');
      }

      const applied = this.stateCaptureSystem.applyIncremental(baseCapture, targetCapture);
      return this.restoreFromCapture(applied);
    } catch (error) {
      return this._createResult(false, `Incremental rollback failed: ${error.message}`, 'INCREMENTAL_ROLLBACK_ERROR');
    }
  }

  /**
   * Validate rollback target
   */
  validateRollbackTarget(checkpointId) {
    const validation = {
      valid: true,
      issues: [],
      canRollback: true
    };

    try {
      const checkpoint = this.checkpointManager.getCheckpoint(checkpointId);
      if (!checkpoint) {
        validation.valid = false;
        validation.canRollback = false;
        validation.issues.push('Checkpoint not found');
        return validation;
      }

      // Validate checkpoint integrity
      const checkpointValidation = this.checkpointManager.validateSpecificCheckpoint(checkpointId);
      if (!checkpointValidation.valid) {
        validation.valid = false;
        validation.canRollback = false;
        validation.issues.push(...checkpointValidation.issues);
      }

    } catch (error) {
      validation.valid = false;
      validation.canRollback = false;
      validation.issues.push(`Validation error: ${error.message}`);
    }

    return validation;
  }

  /**
   * Validate current state for rollback
   */
  validateCurrentState() {
    const validation = {
      valid: true,
      issues: [],
      canRollback: true
    };

    try {
      // Use plan's built-in state validation
      const planValidation = this.plan.validateState();
      if (!planValidation.valid) {
        validation.valid = false;
        validation.canRollback = false;
        validation.issues.push(...planValidation.errors);
      }

    } catch (error) {
      validation.valid = false;
      validation.canRollback = false;
      validation.issues.push(`State validation error: ${error.message}`);
    }

    return validation;
  }

  /**
   * Validate rollback compatibility
   */
  validateRollbackCompatibility(checkpointId) {
    const compatibility = {
      compatible: true,
      conflicts: []
    };

    try {
      const checkpoint = this.checkpointManager.getCheckpoint(checkpointId);
      if (!checkpoint) {
        compatibility.compatible = false;
        compatibility.conflicts.push('Checkpoint not found');
        return compatibility;
      }

      // Check for handle conflicts
      const currentHandles = this.handleRegistry.listHandles();
      const checkpointHandles = checkpoint.handleSnapshot || {};

      for (const currentHandle of currentHandles) {
        const checkpointHandle = checkpointHandles[currentHandle.name];
        if (checkpointHandle && 
            typeof currentHandle.data !== typeof checkpointHandle.data) {
          compatibility.compatible = false;
          compatibility.conflicts.push(`Type conflict for handle: ${currentHandle.name}`);
        }
      }

      // Check for version conflicts (simulate some conflict conditions)
      const currentPlanState = this.plan.state;
      const checkpointPlanState = checkpoint.planState;
      
      // If current state has more completed steps than checkpoint, flag as potential conflict
      if (currentPlanState.completedSteps.length > checkpointPlanState.completedSteps.length) {
        compatibility.compatible = false;
        compatibility.conflicts.push('Current plan has more completed steps than checkpoint');
      }

      // Check for handle data structure changes
      for (const currentHandle of currentHandles) {
        const checkpointHandle = checkpointHandles[currentHandle.name];
        if (checkpointHandle && currentHandle.data && checkpointHandle.data) {
          const currentKeys = Object.keys(currentHandle.data);
          const checkpointKeys = Object.keys(checkpointHandle.data);
          
          if (currentKeys.length !== checkpointKeys.length || 
              !currentKeys.every(key => checkpointKeys.includes(key))) {
            compatibility.compatible = false;
            compatibility.conflicts.push(`Handle structure changed: ${currentHandle.name}`);
          }
        }
      }

    } catch (error) {
      compatibility.compatible = false;
      compatibility.conflicts.push(`Compatibility check error: ${error.message}`);
    }

    return compatibility;
  }

  /**
   * Create rollback backup
   */
  createRollbackBackup(name) {
    // Use incremental timestamp to avoid collisions
    const timestamp = Date.now() + (this.backups.size * 10); // Add 10ms per existing backup
    const backupId = `backup-${timestamp}-${Math.random().toString(36).substr(2, 9)}`;
    
    const backup = {
      id: backupId,
      name,
      createdAt: new Date(timestamp),
      planState: this._deepCopy(this.plan.state),
      handleSnapshot: this._createHandleSnapshot()
    };

    this.backups.set(backupId, backup);
    return backupId;
  }

  /**
   * Restore from backup
   */
  restoreFromBackup(backupId) {
    try {
      const backup = this.backups.get(backupId);
      if (!backup) {
        return this._createResult(false, 'Backup not found', 'BACKUP_NOT_FOUND');
      }

      this._restorePlanState(backup.planState);
      this._restoreHandleState(backup.handleSnapshot);

      return this._createResult(true, 'Successfully restored from backup', null, { backupId });
    } catch (error) {
      return this._createResult(false, `Backup restoration failed: ${error.message}`, 'BACKUP_RESTORE_ERROR');
    }
  }

  /**
   * Check if backup exists
   */
  hasBackup(backupId) {
    return this.backups.has(backupId);
  }

  /**
   * Get backup
   */
  getBackup(backupId) {
    return this.backups.get(backupId);
  }

  /**
   * Delete backup
   */
  deleteBackup(backupId) {
    return this.backups.delete(backupId);
  }

  /**
   * Clean up old backups
   */
  cleanupBackups(maxBackups = 3) {
    if (maxBackups <= 0) return 0;
    
    const backups = Array.from(this.backups.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    let cleaned = 0;
    // Keep only maxBackups (most recent ones)
    for (let i = maxBackups; i < backups.length; i++) {
      this.backups.delete(backups[i].id);
      cleaned++;
    }
    
    return cleaned;
  }

  /**
   * Get rollback history
   */
  getRollbackHistory() {
    return [...this.rollbackHistory];
  }

  /**
   * Clean up rollback history
   */
  cleanupRollbackHistory(maxEntries) {
    const excess = this.rollbackHistory.length - maxEntries;
    if (excess > 0) {
      this.rollbackHistory.splice(0, excess);
      return excess;
    }
    return 0;
  }

  /**
   * Get rollback statistics
   */
  getStatistics() {
    return { ...this.statistics };
  }

  /**
   * Restore plan state
   * @private
   */
  _restorePlanState(planState) {
    this.plan.state = this._deepCopy(planState);
  }

  /**
   * Restore handle state
   * @private
   */
  _restoreHandleState(handleSnapshot) {
    const warnings = [];
    
    // Store current handles for conflict detection
    const currentHandles = this.handleRegistry.listHandles();
    
    // Check for conflicts before clearing
    for (const currentHandle of currentHandles) {
      const snapshotHandle = handleSnapshot[currentHandle.name];
      if (snapshotHandle && 
          typeof currentHandle.data !== typeof snapshotHandle.data) {
        warnings.push(`Type conflict detected for handle: ${currentHandle.name}`);
      }
    }
    
    // Clear current handles
    this.handleRegistry.clear();
    
    // Restore handles from snapshot
    for (const [handleName, handleData] of Object.entries(handleSnapshot)) {
      try {
        this.handleRegistry.create(handleName, handleData.data, {
          ...handleData.metadata,
          restoredAt: new Date()
        });
      } catch (error) {
        warnings.push(`Failed to restore handle: ${handleName} - ${error.message}`);
      }
    }
    
    return warnings;
  }

  /**
   * Create handle snapshot
   * @private
   */
  _createHandleSnapshot() {
    const snapshot = {};
    const handles = this.handleRegistry.listHandles();
    
    for (const handle of handles) {
      snapshot[handle.name] = {
        id: handle.id,
        name: handle.name,
        data: this._deepCopy(handle.data),
        metadata: this._deepCopy(handle.metadata)
      };
    }
    
    return snapshot;
  }

  /**
   * Add to rollback history
   * @private
   */
  _addToHistory(entry) {
    this.rollbackHistory.push(entry);
    
    // Limit history size
    if (this.rollbackHistory.length > this.options.maxRollbackDepth) {
      this.rollbackHistory.shift();
    }
  }

  /**
   * Create result object
   * @private
   */
  _createResult(success, message, errorCode = null, details = {}) {
    const result = {
      success,
      message,
      ...details
    };

    if (!success) {
      result.error = message;
      if (errorCode) {
        result.errorCode = errorCode;
      }
      // Add detailed error information
      result.details = {
        timestamp: new Date(),
        rollbackSystemState: {
          totalRollbacks: this.statistics.totalRollbacks,
          failedRollbacks: this.statistics.failedRollbacks
        },
        ...details
      };
    }

    return result;
  }

  /**
   * Deep copy object
   * @private
   */
  _deepCopy(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj);
    if (Array.isArray(obj)) return obj.map(item => this._deepCopy(item));
    
    const copied = {};
    for (const [key, value] of Object.entries(obj)) {
      copied[key] = this._deepCopy(value);
    }
    return copied;
  }
}