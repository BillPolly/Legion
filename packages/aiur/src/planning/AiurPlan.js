/**
 * AiurPlan - Enhanced plan with checkpoint management and handle integration
 * 
 * Extends basic plan functionality with state capture, handle tracking, and validation
 */

import { EventEmitter } from 'events';
import { HandleResolver } from '../handles/HandleResolver.js';

export class AiurPlan extends EventEmitter {
  constructor(planData, handleRegistry, options = {}) {
    super();
    
    this.id = planData.id;
    this.title = planData.title || 'Untitled Plan';
    this.description = planData.description || '';
    this.steps = planData.steps || [];
    this.metadata = planData.metadata || {};
    
    this.handleRegistry = handleRegistry;
    this.handleResolver = new HandleResolver(handleRegistry);
    
    this.options = {
      maxCheckpoints: options.maxCheckpoints || 10,
      autoCheckpoint: options.autoCheckpoint || false,
      validateOnCreate: options.validateOnCreate !== false,
      ...options
    };

    // Initialize execution state
    this.state = {
      status: 'created',
      currentStep: null,
      completedSteps: [],
      failedSteps: [],
      stepStates: {},
      handles: {},
      statusHistory: [{
        status: 'created',
        timestamp: new Date()
      }],
      lastCheckpoint: null,
      createdAt: new Date(),
      startedAt: null,
      completedAt: null
    };

    // Initialize checkpoint system
    this.checkpoints = {};

    // Initialize step states
    for (const step of this.steps) {
      this.state.stepStates[step.id] = {
        status: 'pending',
        startedAt: null,
        completedAt: null,
        failedAt: null,
        output: null,
        error: null
      };
    }

    // Validate plan if enabled
    if (this.options.validateOnCreate) {
      const validation = this.validate();
      if (!validation.valid) {
        throw new Error(`Invalid plan: ${validation.errors.join(', ')}`);
      }
    }
  }

  /**
   * Validate plan structure and dependencies
   */
  validate() {
    const errors = [];

    // Check basic structure
    if (!this.id) errors.push('Plan must have an ID');
    if (!this.steps || this.steps.length === 0) errors.push('Plan must have steps');

    // Validate steps
    const stepIds = new Set();
    for (const step of this.steps) {
      if (!step.id) errors.push('Step must have an ID');
      if (!step.action) errors.push(`Step ${step.id} must have an action`);
      
      if (stepIds.has(step.id)) {
        errors.push(`Duplicate step ID: ${step.id}`);
      }
      stepIds.add(step.id);
    }

    // Check dependencies exist
    for (const step of this.steps) {
      if (step.dependsOn) {
        for (const dep of step.dependsOn) {
          if (!stepIds.has(dep)) {
            errors.push(`Step ${step.id} has invalid dependency: ${dep}`);
          }
        }
      }
    }

    // Check for circular dependencies
    const circularCheck = this._detectCircularDependencies();
    if (circularCheck.hasCircular) {
      errors.push(`Circular dependency detected: ${circularCheck.cycle.join(' -> ')}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate a specific step
   */
  validateStep(stepId) {
    const step = this.steps.find(s => s.id === stepId);
    if (!step) {
      return { valid: false, error: `Step not found: ${stepId}` };
    }

    const errors = [];
    let resolvedParameters = null;

    try {
      resolvedParameters = this.resolveStepParameters(step.parameters || {});
    } catch (error) {
      errors.push(`Parameter resolution failed: ${error.message}`);
    }

    // Check dependencies are satisfied
    if (step.dependsOn) {
      for (const dep of step.dependsOn) {
        if (!this.state.completedSteps.includes(dep)) {
          errors.push(`Dependency not satisfied: ${dep}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      resolvedParameters
    };
  }

  /**
   * Create handle for step output
   */
  createStepHandle(stepId, handleName, data) {
    const handle = this.handleRegistry.create(handleName, data);
    
    this.state.handles[handleName] = {
      stepId,
      createdAt: new Date()
    };

    this.emit('handle-created', { stepId, handleName, handle });
    
    return handle;
  }

  /**
   * Get handles created by a specific step
   */
  getStepHandles(stepId) {
    const stepHandles = [];
    
    for (const [handleName, info] of Object.entries(this.state.handles)) {
      if (info.stepId === stepId) {
        const handle = this.handleRegistry.getByName(handleName);
        if (handle) {
          stepHandles.push({ name: handleName, handle, ...info });
        }
      }
    }
    
    return stepHandles;
  }

  /**
   * Resolve handle references in step parameters
   */
  resolveStepParameters(parameters) {
    try {
      return this.handleResolver.resolveReferences(parameters);
    } catch (error) {
      // If resolution fails, try to resolve what we can
      if (typeof parameters === 'object' && parameters !== null) {
        const resolved = {};
        for (const [key, value] of Object.entries(parameters)) {
          if (typeof value === 'string' && value.startsWith('@')) {
            const handleName = value.substring(1);
            const handle = this.handleRegistry.getByName(handleName);
            resolved[key] = handle ? handle.data : value;
          } else if (typeof value === 'object' && value !== null) {
            resolved[key] = this.resolveStepParameters(value);
          } else {
            resolved[key] = value;
          }
        }
        return resolved;
      }
      return parameters;
    }
  }

  /**
   * Create checkpoint
   */
  createCheckpoint(name = null) {
    const checkpointId = `checkpoint-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date();
    
    // Validate checkpoint can be created
    const validation = this.validateCheckpoint();
    if (!validation.canCreateCheckpoint) {
      throw new Error(`Cannot create checkpoint: ${validation.reason}`);
    }

    // Clean up old checkpoints if at limit
    this._cleanupCheckpoints();

    // Capture handle state
    const handleSnapshot = {};
    const handles = this.handleRegistry.listHandles();
    for (const handle of handles) {
      handleSnapshot[handle.name] = {
        data: JSON.parse(JSON.stringify(handle.data)),
        metadata: { ...handle.metadata }
      };
    }

    const checkpoint = {
      id: checkpointId,
      name: name || `Checkpoint ${Object.keys(this.checkpoints).length + 1}`,
      timestamp,
      planState: this._deepCopy(this.state),
      handleSnapshot,
      metadata: {
        stepCount: this.steps.length,
        completedCount: this.state.completedSteps.length,
        activeHandles: Object.keys(this.state.handles).length
      }
    };

    this.checkpoints[checkpointId] = checkpoint;
    this.state.lastCheckpoint = checkpointId;

    this.emit('checkpoint-created', { checkpointId, name, timestamp });

    return checkpointId;
  }

  /**
   * Restore from checkpoint
   */
  restoreFromCheckpoint(checkpointId) {
    const checkpoint = this.checkpoints[checkpointId];
    if (!checkpoint) {
      throw new Error(`Checkpoint not found: ${checkpointId}`);
    }

    // Restore plan state
    this.state = this._deepCopy(checkpoint.planState);
    this.state.lastCheckpoint = checkpointId;

    // Restore handle state
    this.handleRegistry.clear();
    for (const [name, handleData] of Object.entries(checkpoint.handleSnapshot)) {
      this.handleRegistry.create(name, handleData.data, handleData.metadata);
    }

    this.emit('checkpoint-restored', { checkpointId, timestamp: new Date() });
  }

  /**
   * Validate checkpoint creation
   */
  validateCheckpoint() {
    const canCreate = this.state.status !== 'failed';
    const reason = !canCreate ? 'Cannot checkpoint failed plan' : null;

    return {
      valid: true,
      canCreateCheckpoint: canCreate,
      reason,
      currentCheckpoints: Object.keys(this.checkpoints).length,
      maxCheckpoints: this.options.maxCheckpoints
    };
  }

  /**
   * List available checkpoints
   */
  listCheckpoints() {
    return Object.values(this.checkpoints).map(cp => ({
      id: cp.id,
      name: cp.name,
      timestamp: cp.timestamp,
      metadata: cp.metadata
    })).sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Delete checkpoint
   */
  deleteCheckpoint(checkpointId) {
    if (this.checkpoints[checkpointId]) {
      delete this.checkpoints[checkpointId];
      this.emit('checkpoint-deleted', { checkpointId });
      return true;
    }
    return false;
  }

  /**
   * Update plan execution status
   */
  updateStatus(newStatus) {
    const oldStatus = this.state.status;
    this.state.status = newStatus;
    
    this.state.statusHistory.push({
      status: newStatus,
      timestamp: new Date(),
      previousStatus: oldStatus
    });

    if (newStatus === 'running' && !this.state.startedAt) {
      this.state.startedAt = new Date();
    } else if (['completed', 'failed'].includes(newStatus) && !this.state.completedAt) {
      this.state.completedAt = new Date();
    }

    this.emit('status-changed', { oldStatus, newStatus, timestamp: new Date() });
  }

  /**
   * Start step execution
   */
  startStep(stepId) {
    const step = this.steps.find(s => s.id === stepId);
    if (!step) {
      throw new Error(`Step not found: ${stepId}`);
    }

    if (!this.canExecuteStep(stepId)) {
      throw new Error(`Cannot execute step: ${stepId} (dependencies not satisfied)`);
    }

    this.state.currentStep = stepId;
    this.state.stepStates[stepId] = {
      ...this.state.stepStates[stepId],
      status: 'running',
      startedAt: new Date()
    };

    this.emit('step-started', { stepId, timestamp: new Date() });

    // Auto checkpoint if enabled
    if (this.options.autoCheckpoint) {
      this.createCheckpoint(`Before ${stepId}`);
    }
  }

  /**
   * Complete step execution
   */
  completeStep(stepId, output = null) {
    if (this.state.stepStates[stepId]?.status !== 'running') {
      throw new Error(`Step not running: ${stepId}`);
    }

    this.state.completedSteps.push(stepId);
    this.state.stepStates[stepId] = {
      ...this.state.stepStates[stepId],
      status: 'completed',
      completedAt: new Date(),
      output
    };

    // Create handles from expected outputs
    const step = this.steps.find(s => s.id === stepId);
    if (step && step.expectedOutputs && output) {
      for (const outputName of step.expectedOutputs) {
        if (output[outputName] !== undefined) {
          this.createStepHandle(stepId, outputName, output[outputName]);
        }
      }
    }

    // Reset current step since this one is complete
    if (this.state.currentStep === stepId) {
      this.state.currentStep = null;
    }

    // Check if plan is complete
    if (this.isComplete()) {
      this.updateStatus('completed');
    }

    this.emit('step-completed', { stepId, output, timestamp: new Date() });
  }

  /**
   * Fail step execution
   */
  failStep(stepId, error) {
    this.state.failedSteps.push(stepId);
    this.state.stepStates[stepId] = {
      ...this.state.stepStates[stepId],
      status: 'failed',
      failedAt: new Date(),
      error
    };

    this.updateStatus('failed');

    this.emit('step-failed', { stepId, error, timestamp: new Date() });
  }

  /**
   * Get step dependencies
   */
  getStepDependencies(stepId) {
    const step = this.steps.find(s => s.id === stepId);
    return step?.dependsOn || [];
  }

  /**
   * Get step dependents
   */
  getStepDependents(stepId) {
    return this.steps
      .filter(step => step.dependsOn && step.dependsOn.includes(stepId))
      .map(step => step.id);
  }

  /**
   * Check if step can be executed
   */
  canExecuteStep(stepId) {
    const dependencies = this.getStepDependencies(stepId);
    return dependencies.every(dep => this.state.completedSteps.includes(dep));
  }

  /**
   * Get next executable steps
   */
  getNextExecutableSteps() {
    return this.steps
      .filter(step => 
        !this.state.completedSteps.includes(step.id) && 
        !this.state.failedSteps.includes(step.id) &&
        this.canExecuteStep(step.id)
      )
      .map(step => step.id);
  }

  /**
   * Check if plan is complete
   */
  isComplete() {
    return this.state.completedSteps.length === this.steps.length;
  }

  /**
   * Get execution progress
   */
  getProgress() {
    const total = this.steps.length;
    const completed = this.state.completedSteps.length;
    const failed = this.state.failedSteps.length;
    const running = this.state.currentStep ? 1 : 0;
    
    return {
      total,
      completed,
      failed,
      running,
      pending: total - completed - failed - running,
      percentage: Math.round((completed / total) * 100)
    };
  }

  /**
   * Get execution duration
   */
  getExecutionDuration() {
    if (!this.state.startedAt) return 0;
    
    const endTime = this.state.completedAt || new Date();
    return endTime.getTime() - this.state.startedAt.getTime();
  }

  /**
   * Export plan state
   */
  exportState() {
    return {
      planId: this.id,
      state: this._deepCopy(this.state),
      checkpoints: this._deepCopy(this.checkpoints),
      exportedAt: new Date()
    };
  }

  /**
   * Import plan state
   */
  importState(exportedState) {
    if (exportedState.planId !== this.id) {
      throw new Error('Plan ID mismatch during import');
    }

    this.state = exportedState.state;
    this.checkpoints = exportedState.checkpoints || {};
    
    this.emit('state-imported', { timestamp: new Date() });
  }

  /**
   * Clone plan
   */
  clone() {
    const cloned = new AiurPlan({
      id: this.id,
      title: this.title,
      description: this.description,
      steps: this._deepCopy(this.steps),
      metadata: { ...this.metadata }
    }, this.handleRegistry, this.options);

    cloned.state = this._deepCopy(this.state);
    cloned.checkpoints = this._deepCopy(this.checkpoints);

    return cloned;
  }

  /**
   * Validate state consistency
   */
  validateState() {
    const errors = [];

    // Check completed steps exist
    for (const stepId of this.state.completedSteps) {
      if (!this.steps.find(s => s.id === stepId)) {
        errors.push(`Completed step not found: ${stepId}`);
      }
    }

    // Check failed steps exist
    for (const stepId of this.state.failedSteps) {
      if (!this.steps.find(s => s.id === stepId)) {
        errors.push(`Failed step not found: ${stepId}`);
      }
    }

    // Check current step exists
    if (this.state.currentStep && !this.steps.find(s => s.id === this.state.currentStep)) {
      errors.push(`Current step not found: ${this.state.currentStep}`);
    }

    // Check for steps that are both completed and failed
    const completedSet = new Set(this.state.completedSteps);
    const failedSet = new Set(this.state.failedSteps);
    for (const stepId of completedSet) {
      if (failedSet.has(stepId)) {
        errors.push(`Step cannot be both completed and failed: ${stepId}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Detect circular dependencies
   * @private
   */
  _detectCircularDependencies() {
    const visited = new Set();
    const recursionStack = new Set();

    const hasCycle = (stepId, path = []) => {
      if (recursionStack.has(stepId)) {
        // Found back edge - cycle detected
        const cycleStart = path.indexOf(stepId);
        return { hasCircular: true, cycle: path.slice(cycleStart).concat([stepId]) };
      }

      if (visited.has(stepId)) {
        return { hasCircular: false };
      }

      visited.add(stepId);
      recursionStack.add(stepId);
      
      const currentPath = [...path, stepId];
      
      const step = this.steps.find(s => s.id === stepId);
      if (step && step.dependsOn) {
        for (const dep of step.dependsOn) {
          const result = hasCycle(dep, currentPath);
          if (result.hasCircular) {
            return result;
          }
        }
      }

      recursionStack.delete(stepId);
      return { hasCircular: false };
    };

    for (const step of this.steps) {
      if (!visited.has(step.id)) {
        const result = hasCycle(step.id);
        if (result.hasCircular) {
          return result;
        }
      }
    }

    return { hasCircular: false };
  }

  /**
   * Deep copy object preserving Date objects
   * @private
   */
  _deepCopy(obj) {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (obj instanceof Date) {
      return new Date(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this._deepCopy(item));
    }

    const copy = {};
    for (const [key, value] of Object.entries(obj)) {
      copy[key] = this._deepCopy(value);
    }

    return copy;
  }

  /**
   * Clean up old checkpoints
   * @private
   */
  _cleanupCheckpoints() {
    const checkpointEntries = Object.entries(this.checkpoints);
    
    if (checkpointEntries.length >= this.options.maxCheckpoints) {
      // Sort by timestamp and remove oldest
      checkpointEntries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toRemove = checkpointEntries.length - this.options.maxCheckpoints + 1;
      for (let i = 0; i < toRemove; i++) {
        const [checkpointId] = checkpointEntries[i];
        delete this.checkpoints[checkpointId];
      }
    }
  }
  
  /**
   * Add a new step to the plan
   */
  addStep(step) {
    if (!step.id) {
      throw new Error('Step must have an id');
    }
    
    // Check if step already exists
    if (this.steps.find(s => s.id === step.id)) {
      throw new Error(`Step with id ${step.id} already exists`);
    }
    
    // Add the step
    this.steps.push(step);
    
    // Initialize step state
    this.state.stepStates[step.id] = {
      status: 'pending',
      startedAt: null,
      completedAt: null,
      output: null,
      error: null
    };
    
    // Emit event
    this.emit('step-added', {
      planId: this.id,
      stepId: step.id,
      step
    });
  }
}