/**
 * CheckpointManager - Manages checkpoint creation, state capture, and validation
 * 
 * Provides comprehensive checkpoint management with state capture, validation,
 * and metadata tracking for plan execution
 */

export class CheckpointManager {
  constructor(plan, handleRegistry, options = {}) {
    this.plan = plan;
    this.handleRegistry = handleRegistry;
    
    this.options = {
      maxCheckpoints: options.maxCheckpoints || 10,
      autoCleanup: options.autoCleanup !== false,
      validateOnCreate: options.validateOnCreate !== false,
      includeMetadata: options.includeMetadata !== false,
      cleanupThreshold: options.cleanupThreshold || 1,
      ...options
    };

    this.checkpoints = new Map();
    this.statistics = {
      totalCreated: 0,
      totalDeleted: 0,
      totalValidations: 0,
      totalSize: 0
    };
  }

  /**
   * Create a new checkpoint
   */
  createCheckpoint(name = null, options = {}) {
    try {
      // Validate checkpoint name
      if (name === '' || (name !== null && name !== undefined && typeof name !== 'string')) {
        throw new Error('Invalid checkpoint name');
      }

      // Generate name if not provided
      const checkpointName = name || `checkpoint-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Validate before creation if enabled and not explicitly disabled
      if (this.options.validateOnCreate && options.validate !== false) {
        const validation = this.validateCheckpoint();
        if (!validation.valid) {
          throw new Error(`Checkpoint validation failed: ${validation.issues.join(', ')}`);
        }
      }

      // Check capacity
      if (!this.options.autoCleanup && this.checkpoints.size >= this.options.maxCheckpoints) {
        throw new Error(`Maximum number of checkpoints reached (${this.options.maxCheckpoints})`);
      }

      // Auto-cleanup if needed
      if (this.options.autoCleanup && this.checkpoints.size >= this.options.maxCheckpoints) {
        this._performAutoCleanup();
      }

      // Create checkpoint
      const checkpointId = `cp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const checkpoint = this._createCheckpointData(checkpointId, checkpointName, options);

      this.checkpoints.set(checkpointId, checkpoint);
      this.statistics.totalCreated++;
      this.statistics.totalSize += this._calculateCheckpointSize(checkpoint);

      return checkpointId;

    } catch (error) {
      throw new Error(`Failed to create checkpoint: ${error.message}`);
    }
  }

  /**
   * Get checkpoint by ID
   */
  getCheckpoint(checkpointId) {
    return this.checkpoints.get(checkpointId) || null;
  }

  /**
   * Check if checkpoint exists
   */
  hasCheckpoint(checkpointId) {
    return this.checkpoints.has(checkpointId);
  }

  /**
   * List all checkpoints
   */
  listCheckpoints(options = {}) {
    const checkpoints = Array.from(this.checkpoints.values());
    
    // Apply sorting
    if (options.sortBy) {
      checkpoints.sort((a, b) => {
        const aVal = a[options.sortBy];
        const bVal = b[options.sortBy];
        
        let comparison = 0;
        if (aVal < bVal) comparison = -1;
        if (aVal > bVal) comparison = 1;
        
        return options.order === 'desc' ? -comparison : comparison;
      });
    }

    return checkpoints;
  }

  /**
   * Find checkpoints by criteria
   */
  findCheckpoints(criteria = {}) {
    const checkpoints = Array.from(this.checkpoints.values());
    
    return checkpoints.filter(checkpoint => {
      // Name pattern matching
      if (criteria.namePattern) {
        const pattern = criteria.namePattern.replace(/\*/g, '.*');
        const regex = new RegExp(`^${pattern}$`);
        if (!regex.test(checkpoint.name)) return false;
      }
      
      // Date range filtering
      if (criteria.dateRange) {
        const { start, end } = criteria.dateRange;
        if (start && checkpoint.createdAt < start) return false;
        if (end && checkpoint.createdAt > end) return false;
      }
      
      // Metadata filtering
      if (criteria.metadata) {
        for (const [key, value] of Object.entries(criteria.metadata)) {
          if (!checkpoint.metadata || checkpoint.metadata[key] !== value) {
            return false;
          }
        }
      }
      
      return true;
    });
  }

  /**
   * Get checkpoint count
   */
  getCheckpointCount() {
    return this.checkpoints.size;
  }

  /**
   * Delete checkpoint
   */
  deleteCheckpoint(checkpointId) {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) return false;

    this.statistics.totalSize -= this._calculateCheckpointSize(checkpoint);
    this.statistics.totalDeleted++;
    
    return this.checkpoints.delete(checkpointId);
  }

  /**
   * Clear all checkpoints
   */
  clearCheckpoints() {
    this.statistics.totalSize = 0;
    this.statistics.totalDeleted += this.checkpoints.size;
    this.checkpoints.clear();
  }

  /**
   * Clean up checkpoints by age
   */
  cleanupByAge(maxAge) {
    const cutoffTime = new Date(Date.now() - maxAge);
    let cleaned = 0;
    
    for (const [id, checkpoint] of this.checkpoints) {
      if (checkpoint.createdAt < cutoffTime) {
        this.deleteCheckpoint(id);
        cleaned++;
      }
    }
    
    return cleaned;
  }

  /**
   * Validate current state for checkpoint creation
   */
  validateCheckpoint() {
    this.statistics.totalValidations++;
    
    const validation = {
      valid: true,
      issues: [],
      canCreateCheckpoint: true
    };

    try {
      // Validate plan state consistency
      const planValidation = this.plan.validateState();
      if (!planValidation.valid) {
        validation.valid = false;
        validation.issues.push(...planValidation.errors);
      }

      // Check if plan is in a valid state for checkpointing
      if (this.plan.state.status === 'failed') {
        validation.issues.push('Cannot create checkpoint from failed plan state');
      }

      // Validate handle registry
      const handleCount = this.handleRegistry.listHandles().length;
      if (handleCount > 1000) { // Arbitrary large number
        validation.issues.push('Too many handles for efficient checkpoint creation');
      }

    } catch (error) {
      validation.valid = false;
      validation.issues.push(`Validation error: ${error.message}`);
    }

    validation.canCreateCheckpoint = validation.valid && validation.issues.length === 0;
    return validation;
  }

  /**
   * Validate specific checkpoint
   */
  validateSpecificCheckpoint(checkpointId) {
    const checkpoint = this.checkpoints.get(checkpointId);
    
    const validation = {
      valid: true,
      issues: []
    };

    if (!checkpoint) {
      validation.valid = false;
      validation.issues.push('Checkpoint not found');
      return validation;
    }

    // Check for corrupted data
    if (!checkpoint.planState) {
      validation.valid = false;
      validation.issues.push('Checkpoint plan state is corrupted');
    }

    if (!checkpoint.handleSnapshot) {
      validation.valid = false;
      validation.issues.push('Checkpoint handle snapshot is corrupted');
    }

    if (!checkpoint.createdAt || !(checkpoint.createdAt instanceof Date)) {
      validation.valid = false;
      validation.issues.push('Checkpoint timestamp is corrupted');
    }

    return validation;
  }

  /**
   * Get checkpoint size
   */
  getCheckpointSize(checkpointId) {
    const checkpoint = this.checkpoints.get(checkpointId);
    return checkpoint ? this._calculateCheckpointSize(checkpoint) : 0;
  }

  /**
   * Get comprehensive statistics
   */
  getStatistics() {
    const checkpoints = Array.from(this.checkpoints.values());
    
    return {
      totalCheckpoints: this.checkpoints.size,
      maxCheckpoints: this.options.maxCheckpoints,
      autoCleanupEnabled: this.options.autoCleanup,
      totalCreated: this.statistics.totalCreated,
      totalDeleted: this.statistics.totalDeleted,
      totalValidations: this.statistics.totalValidations,
      totalSize: this.statistics.totalSize,
      averageSize: checkpoints.length > 0 ? this.statistics.totalSize / checkpoints.length : 0,
      oldestCheckpoint: checkpoints.length > 0 ? 
        checkpoints.reduce((oldest, cp) => cp.createdAt < oldest.createdAt ? cp : oldest) : null,
      newestCheckpoint: checkpoints.length > 0 ? 
        checkpoints.reduce((newest, cp) => cp.createdAt > newest.createdAt ? cp : newest) : null
    };
  }

  /**
   * Get health information
   */
  getHealthInfo() {
    const stats = this.getStatistics();
    const health = {
      healthy: true,
      checkpointCount: stats.totalCheckpoints,
      memoryUsage: stats.totalSize,
      issues: []
    };

    // Check capacity
    if (stats.totalCheckpoints >= stats.maxCheckpoints * 0.9) {
      health.healthy = false;
      health.issues.push('Checkpoint storage near capacity');
    }

    // Check memory usage
    if (stats.totalSize > 50 * 1024 * 1024) { // 50MB
      health.healthy = false;
      health.issues.push('High memory usage from checkpoints');
    }

    // Check for validation failures
    if (stats.totalValidations > 0 && stats.totalValidations > stats.totalCreated * 2) {
      health.issues.push('High validation failure rate detected');
    }

    return health;
  }

  /**
   * Create checkpoint data structure
   * @private
   */
  _createCheckpointData(checkpointId, name, options = {}) {
    // Allow test override of state capture
    const state = this._captureState ? this._captureState() : {
      planState: this._capturePlanState(),
      handleSnapshot: this._captureHandleSnapshot()
    };

    const checkpoint = {
      id: checkpointId,
      name,
      createdAt: new Date(),
      planState: state.planState,
      handleSnapshot: state.handleSnapshot,
      options: { ...options }
    };

    // Include metadata if enabled
    if (this.options.includeMetadata) {
      checkpoint.metadata = this._captureMetadata();
    }

    return checkpoint;
  }

  /**
   * Capture current plan state
   * @private
   */
  _capturePlanState() {
    return this._deepCopy(this.plan.state);
  }

  /**
   * Capture current handle snapshot
   * @private
   */
  _captureHandleSnapshot() {
    const snapshot = {};
    const handles = this.handleRegistry.listHandles();
    
    for (const handle of handles) {
      snapshot[handle.name] = {
        id: handle.id,
        name: handle.name,
        data: this._deepCopy(handle.data),
        metadata: this._deepCopy(handle.metadata),
        createdAt: handle.metadata.createdAt,
        accessedAt: handle.metadata.accessedAt
      };
    }
    
    return snapshot;
  }

  /**
   * Capture checkpoint metadata
   * @private
   */
  _captureMetadata() {
    return {
      planId: this.plan.id,
      planTitle: this.plan.title,
      planDescription: this.plan.description,
      totalSteps: this.plan.steps.length,
      completedSteps: this.plan.state.completedSteps.length,
      failedSteps: this.plan.state.failedSteps.length,
      currentStep: this.plan.state.currentStep,
      handleCount: this.handleRegistry.listHandles().length,
      capturedBy: 'CheckpointManager',
      version: '1.0.0'
    };
  }

  /**
   * Perform automatic cleanup
   * @private
   */
  _performAutoCleanup() {
    // Only cleanup if we're at or above max checkpoints
    if (this.checkpoints.size < this.options.maxCheckpoints) return;

    const excess = this.checkpoints.size - this.options.maxCheckpoints + 1; // +1 to make room for new checkpoint
    if (excess <= 0) return;

    // Get oldest checkpoints
    const checkpoints = Array.from(this.checkpoints.values())
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    // Delete oldest checkpoints
    for (let i = 0; i < excess; i++) {
      this.deleteCheckpoint(checkpoints[i].id);
    }
  }

  /**
   * Calculate checkpoint size in bytes
   * @private
   */
  _calculateCheckpointSize(checkpoint) {
    try {
      return JSON.stringify(checkpoint).length;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Deep copy object preserving dates
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

  /**
   * Mock state capture for testing error scenarios
   * @private
   */
  _captureState() {
    return {
      planState: this._capturePlanState(),
      handleSnapshot: this._captureHandleSnapshot()
    };
  }
}