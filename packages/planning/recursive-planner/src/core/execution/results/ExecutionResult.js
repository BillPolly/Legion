/**
 * ExecutionResult - Captures the state and results of plan execution
 */

import { ValidationUtils } from '../../../foundation/utils/validation/ValidationUtils.js';

/**
 * Represents the result of executing a plan step
 */
export class StepResult {
  constructor(stepId, success, data = null, error = null, executionTime = 0, artifacts = {}) {
    this.stepId = stepId;
    this.success = success;
    this.data = data;
    this.error = error;
    this.executionTime = executionTime;
    this.artifacts = artifacts; // Named artifacts produced by this step
    this.timestamp = Date.now();
  }

  /**
   * Create a successful step result
   * @param {string} stepId - Step identifier
   * @param {any} data - Tool execution result
   * @param {number} executionTime - Time taken in milliseconds
   * @param {Object} artifacts - Named artifacts produced
   * @returns {StepResult} Success result
   */
  static success(stepId, data, executionTime = 0, artifacts = {}) {
    return new StepResult(stepId, true, data, null, executionTime, artifacts);
  }

  /**
   * Create a failed step result
   * @param {string} stepId - Step identifier
   * @param {Error} error - Error that occurred
   * @param {number} executionTime - Time taken in milliseconds
   * @returns {StepResult} Failure result
   */
  static failure(stepId, error, executionTime = 0) {
    return new StepResult(stepId, false, null, error, executionTime, {});
  }
}

/**
 * Execution state constants
 */
export const ExecutionState = {
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

/**
 * Represents the complete result of executing a plan
 */
export class ExecutionResult {
  constructor(planId = null) {
    this.planId = planId;
    this.state = ExecutionState.RUNNING;
    this.startTime = Date.now();
    this.endTime = null;
    this.completedSteps = [];
    this.failedSteps = [];
    this.skippedSteps = [];
    this.artifactRegistry = new Map();
    this.errors = [];
    this.metrics = {
      totalSteps: 0,
      completedCount: 0,
      failedCount: 0,
      skippedCount: 0,
      totalExecutionTime: 0
    };
  }

  /**
   * Add a completed step result
   * @param {Object} step - Original plan step
   * @param {StepResult} result - Step execution result
   */
  addCompletedStep(step, result) {
    ValidationUtils.required(step, 'step');
    ValidationUtils.required(result, 'result');

    this.completedSteps.push({
      step: { ...step },
      result,
      completedAt: Date.now()
    });

    // Update artifacts registry
    for (const [artifactName, artifactData] of Object.entries(result.artifacts)) {
      this.artifactRegistry.set(artifactName, {
        ...artifactData,
        sourceStep: step.id,
        createdAt: Date.now()
      });
    }

    this.metrics.completedCount++;
    this.metrics.totalExecutionTime += result.executionTime;
  }

  /**
   * Add a failed step result
   * @param {Object} step - Original plan step
   * @param {Error} error - Error that occurred
   * @param {number} executionTime - Time taken before failure
   */
  addFailedStep(step, error, executionTime = 0) {
    ValidationUtils.required(step, 'step');
    ValidationUtils.required(error, 'error');

    const failedStep = {
      step: { ...step },
      error,
      failedAt: Date.now(),
      executionTime
    };

    this.failedSteps.push(failedStep);
    this.errors.push(error);

    this.state = ExecutionState.FAILED;
    this.endTime = Date.now();
    this.metrics.failedCount++;
    this.metrics.totalExecutionTime += executionTime;
  }

  /**
   * Add a skipped step (due to dependency failure)
   * @param {Object} step - Original plan step
   * @param {string} reason - Reason for skipping
   */
  addSkippedStep(step, reason) {
    ValidationUtils.required(step, 'step');
    ValidationUtils.nonEmptyString(reason, 'reason');

    this.skippedSteps.push({
      step: { ...step },
      reason,
      skippedAt: Date.now()
    });

    this.metrics.skippedCount++;
  }

  /**
   * Mark execution as completed successfully
   * @param {number} totalSteps - Total number of steps in the plan
   */
  markCompleted(totalSteps) {
    this.state = ExecutionState.COMPLETED;
    this.endTime = Date.now();
    this.metrics.totalSteps = totalSteps;
  }

  /**
   * Mark execution as cancelled
   * @param {string} reason - Reason for cancellation
   */
  markCancelled(reason = 'Execution cancelled') {
    this.state = ExecutionState.CANCELLED;
    this.endTime = Date.now();
    this.errors.push(new Error(reason));
  }

  /**
   * Check if execution is complete (either successfully or failed)
   * @returns {boolean} True if execution is finished
   */
  isComplete() {
    return this.state === ExecutionState.COMPLETED;
  }

  /**
   * Check if execution failed
   * @returns {boolean} True if execution failed
   */
  isFailed() {
    return this.state === ExecutionState.FAILED;
  }

  /**
   * Check if execution is still running
   * @returns {boolean} True if execution is running
   */
  isRunning() {
    return this.state === ExecutionState.RUNNING;
  }

  /**
   * Get execution duration in milliseconds
   * @returns {number} Duration or 0 if still running
   */
  getDuration() {
    if (this.endTime) {
      return this.endTime - this.startTime;
    }
    return Date.now() - this.startTime;
  }

  /**
   * Get success rate as percentage
   * @returns {number} Success rate (0-100)
   */
  getSuccessRate() {
    const total = this.metrics.completedCount + this.metrics.failedCount;
    if (total === 0) return 100;
    return (this.metrics.completedCount / total) * 100;
  }

  /**
   * Get artifact by name
   * @param {string} name - Artifact name
   * @returns {any} Artifact data or undefined
   */
  getArtifact(name) {
    return this.artifactRegistry.get(name);
  }

  /**
   * Get all available artifact names
   * @returns {Array<string>} List of artifact names
   */
  getArtifactNames() {
    return Array.from(this.artifactRegistry.keys());
  }

  /**
   * Get the last failed step for replanning
   * @returns {Object|null} Last failed step or null
   */
  getLastFailedStep() {
    return this.failedSteps.length > 0 ? this.failedSteps[this.failedSteps.length - 1] : null;
  }

  /**
   * Get all steps that should be considered for replanning
   * @returns {Array} Steps that need to be replanned
   */
  getStepsForReplanning() {
    return [...this.failedSteps, ...this.skippedSteps];
  }

  /**
   * Create a summary for logging/display
   * @returns {Object} Execution summary
   */
  getSummary() {
    return {
      planId: this.planId,
      state: this.state,
      duration: this.getDuration(),
      metrics: { ...this.metrics },
      successRate: this.getSuccessRate(),
      artifactsCreated: this.artifactRegistry.size,
      errors: this.errors.length,
      lastError: this.errors.length > 0 ? this.errors[this.errors.length - 1].message : null
    };
  }

  /**
   * Create replanning context from execution results
   * @returns {Object} Context for replanning
   */
  getReplanningContext() {
    const lastFailedStep = this.getLastFailedStep();
    
    return {
      completedSteps: this.completedSteps.map(cs => ({
        id: cs.step.id,
        description: cs.step.description,
        status: 'done',
        result: cs.result.data
      })),
      failedSteps: this.failedSteps.map(fs => ({
        id: fs.step.id,
        description: fs.step.description,
        tool: fs.step.tool,
        error: fs.error,
        status: 'failed'
      })),
      remainingSteps: this.skippedSteps.map(ss => ({
        id: ss.step.id,
        description: ss.step.description,
        status: 'pending'
      })),
      artifactRegistry: Object.fromEntries(this.artifactRegistry),
      currentState: {
        executionTime: this.getDuration(),
        successRate: this.getSuccessRate(),
        artifactsAvailable: this.getArtifactNames()
      },
      lastFailure: lastFailedStep ? {
        step: lastFailedStep.step,
        error: lastFailedStep.error.message,
        stackTrace: lastFailedStep.error.stack
      } : null
    };
  }
}