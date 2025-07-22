/**
 * PlanExecutor - Engine for executing AiurPlans step by step
 * 
 * Provides step-by-step plan execution with handle creation, dependency resolution,
 * and checkpoint integration
 */

import { EventEmitter } from 'events';

export class PlanExecutor extends EventEmitter {
  constructor(toolRegistry, handleRegistry, options = {}) {
    super();
    
    this.toolRegistry = toolRegistry;
    this.handleRegistry = handleRegistry;
    
    // Checkpoint-related options
    this.checkpointManager = options.checkpointManager;
    this.rollbackSystem = options.rollbackSystem;
    
    this.options = {
      parallel: options.parallel || false,
      stopOnError: options.stopOnError !== false,
      timeout: options.timeout || 30000, // 30 seconds
      autoCheckpoint: options.autoCheckpoint || false,
      validateBeforeExecution: options.validateBeforeExecution !== false,
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 1000,
      // Checkpoint options
      rollbackOnFailure: options.rollbackOnFailure || false,
      rollbackStrategy: options.rollbackStrategy || 'full',
      rollbackOptions: options.rollbackOptions || {},
      continueAfterRollback: options.continueAfterRollback || false,
      checkpointOptions: options.checkpointOptions || {},
      checkpointInterval: options.checkpointInterval || 1,
      checkpointFilter: options.checkpointFilter || null,
      checkpointNaming: options.checkpointNaming || null,
      synchronizeCheckpoints: options.synchronizeCheckpoints || false,
      trackCheckpointStats: options.trackCheckpointStats || false,
      ...options
    };

    this.executionContext = {
      version: '1.0.0',
      startTime: null,
      environment: process.env.NODE_ENV || 'development'
    };
    
    // Checkpoint statistics
    this.checkpointStats = {
      totalCheckpoints: 0,
      successfulCheckpoints: 0,
      failedCheckpoints: 0,
      checkpointTimes: []
    };
    
    // Execution state
    this.stepCount = 0;
  }

  /**
   * Execute a complete plan
   */
  async executePlan(plan) {
    const startTime = new Date();
    this.executionContext.startTime = startTime;
    this.stepCount = 0; // Reset step count for new execution
    
    const result = {
      success: false,
      planId: plan.id,
      completedSteps: [],
      failedSteps: [],
      skippedSteps: [],
      statistics: {
        totalSteps: plan.steps.length,
        completedSteps: 0,
        failedSteps: 0,
        skippedSteps: 0,
        totalExecutionTime: 0,
        averageStepTime: 0
      },
      metadata: {
        executorVersion: this.executionContext.version,
        startTime,
        endTime: null,
        environment: this.executionContext.environment
      }
    };

    try {
      // Validate plan before execution if enabled
      if (this.options.validateBeforeExecution) {
        const validation = plan.validate();
        if (!validation.valid) {
          result.error = `Plan validation failed: ${validation.errors.join(', ')}`;
          return result;
        }
      }

      // Update plan status
      plan.updateStatus('running');

      // Initialize result with rollback tracking
      result.rollbacks = [];

      // Execute steps
      if (this.options.parallel) {
        await this._executeParallel(plan, result);
      } else {
        await this._executeSequential(plan, result);
      }

      // Determine overall success
      result.success = result.failedSteps.length === 0;
      
      // Update plan status
      if (result.success && plan.isComplete()) {
        plan.updateStatus('completed');
      } else if (!result.success) {
        plan.updateStatus('failed');
      }

    } catch (error) {
      result.success = false;
      result.error = error.message;
      plan.updateStatus('failed');
    }

    // Finalize result
    const endTime = new Date();
    result.metadata.endTime = endTime;
    result.statistics.totalExecutionTime = Math.max(endTime.getTime() - startTime.getTime(), 1);
    result.statistics.completedSteps = result.completedSteps.length;
    result.statistics.failedSteps = result.failedSteps.length;
    result.statistics.skippedSteps = result.skippedSteps.length;
    
    if (result.completedSteps.length > 0) {
      result.statistics.averageStepTime = Math.max(result.statistics.totalExecutionTime / result.completedSteps.length, 1);
    }

    return result;
  }

  /**
   * Execute a single step
   */
  async executeStep(plan, stepId, context = {}) {
    const step = plan.steps.find(s => s.id === stepId);
    if (!step) {
      return {
        success: false,
        stepId,
        error: `Step not found: ${stepId}`
      };
    }

    const startTime = Date.now();

    const result = {
      success: false,
      stepId,
      output: null,
      error: null,
      executionTime: 0,
      context: {
        planId: plan.id,
        stepId,
        ...context
      }
    };

    try {
      // Check if tool exists
      const tool = this.toolRegistry.getTool(step.action);
      if (!tool) {
        throw new Error(`Tool not found: ${step.action}`);
      }

      // Update plan state
      plan.startStep(stepId);
      
      this.emit('step-started', { 
        planId: plan.id, 
        stepId, 
        step: step.title || stepId,
        timestamp: new Date()
      });

      // Resolve parameters
      const resolvedParams = plan.resolveStepParameters(step.parameters || {});

      // Execute tool with timeout
      const toolExecution = this._executeWithTimeout(
        () => tool.execute(resolvedParams, result.context),
        this.options.timeout
      );

      const output = await toolExecution;
      result.output = output;
      result.success = true;

      // Create handles for expected outputs
      if (step.expectedOutputs && output) {
        for (const outputName of step.expectedOutputs) {
          if (output[outputName] !== undefined) {
            plan.createStepHandle(stepId, outputName, output[outputName]);
          } else {
            // Create handle with entire output if specific output not found
            plan.createStepHandle(stepId, outputName, output);
          }
        }
      }

      // Complete step in plan
      plan.completeStep(stepId, output);

      // Auto checkpoint if enabled
      if (this.options.autoCheckpoint) {
        await this._createStepCheckpoint(plan, step);
      }

      this.emit('step-completed', { 
        planId: plan.id, 
        stepId, 
        output,
        executionTime: result.executionTime,
        timestamp: new Date()
      });

    } catch (error) {
      result.error = error.message;
      
      // Fail step in plan
      plan.failStep(stepId, { message: error.message, stack: error.stack });

      // Handle rollback if enabled
      if (this.options.rollbackOnFailure && this.rollbackSystem) {
        const rollbackInfo = await this._handleStepFailureRollback(plan, stepId);
        if (rollbackInfo) {
          result.rollback = rollbackInfo;
        }
      }

      this.emit('step-failed', { 
        planId: plan.id, 
        stepId, 
        error: error.message,
        timestamp: new Date()
      });
    }

    result.executionTime = Math.max(Date.now() - startTime, 1);
    return result;
  }

  /**
   * Execute step with retry logic
   */
  async executeStepWithRetry(plan, stepId, maxRetries = null, customExecutor = null) {
    const retries = maxRetries !== null ? maxRetries : this.options.maxRetries;
    let lastError;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        if (customExecutor) {
          // Use custom executor for testing
          const result = await customExecutor();
          return { success: true, output: result, retries: attempt };
        } else {
          const result = await this.executeStep(plan, stepId);
          if (result.success) {
            return { ...result, retries: attempt };
          } else {
            lastError = result.error;
            if (attempt < retries) {
              // Wait before retry
              await this._sleep(this.options.retryDelay);
            }
          }
        }
      } catch (error) {
        lastError = error.message;
        if (attempt < retries) {
          await this._sleep(this.options.retryDelay);
        }
      }
    }

    return {
      success: false,
      stepId,
      error: lastError,
      retries
    };
  }

  /**
   * Execute plan steps sequentially
   * @private
   */
  async _executeSequential(plan, result) {
    const totalSteps = plan.steps.length;
    let stepIndex = 0;

    while (!plan.isComplete() && (this.options.stopOnError ? result.failedSteps.length === 0 : true)) {
      const nextSteps = plan.getNextExecutableSteps();
      
      if (nextSteps.length === 0) {
        // No more executable steps - either done or blocked
        break;
      }

      for (const stepId of nextSteps) {
        stepIndex++;
        
        const stepResult = await this.executeStep(plan, stepId);
        
        if (stepResult.success) {
          result.completedSteps.push(stepId);
        } else {
          result.failedSteps.push(stepId);
          
          // Add rollback info if present
          if (stepResult.rollback) {
            if (!result.rollbacks) {
              result.rollbacks = [];
            }
            result.rollbacks.push(stepResult.rollback);
          }
          
          if (this.options.stopOnError) {
            result.error = stepResult.error;
            break;
          }
        }

        // Emit progress
        this.emit('progress', {
          planId: plan.id,
          completed: result.completedSteps.length,
          failed: result.failedSteps.length,
          total: totalSteps,
          percentage: Math.round((stepIndex / totalSteps) * 100),
          currentStep: stepId
        });
      }

      if (this.options.stopOnError && result.failedSteps.length > 0) {
        break;
      }
    }

    // Mark remaining steps as skipped if we stopped early
    if (!plan.isComplete()) {
      for (const step of plan.steps) {
        if (!result.completedSteps.includes(step.id) && !result.failedSteps.includes(step.id)) {
          result.skippedSteps.push(step.id);
        }
      }
    }
  }

  /**
   * Execute plan steps in parallel where possible
   * @private
   */
  async _executeParallel(plan, result) {
    const totalSteps = plan.steps.length;
    const executing = new Set();

    while (!plan.isComplete() && (this.options.stopOnError ? result.failedSteps.length === 0 : true)) {
      const nextSteps = plan.getNextExecutableSteps();
      
      if (nextSteps.length === 0) {
        // Wait for any executing steps to complete
        if (executing.size > 0) {
          await this._sleep(100); // Small delay
          continue;
        } else {
          break; // No more steps to execute
        }
      }

      // Start all available steps in parallel
      const promises = nextSteps.map(async stepId => {
        if (executing.has(stepId)) {
          return null; // Already executing
        }

        executing.add(stepId);
        
        try {
          const stepResult = await this.executeStep(plan, stepId);
          
          if (stepResult.success) {
            result.completedSteps.push(stepId);
          } else {
            result.failedSteps.push(stepId);
            
            // Add rollback info if present
            if (stepResult.rollback) {
              if (!result.rollbacks) {
                result.rollbacks = [];
              }
              result.rollbacks.push(stepResult.rollback);
            }
            
            if (this.options.stopOnError) {
              result.error = stepResult.error;
            }
          }

          // Emit progress
          this.emit('progress', {
            planId: plan.id,
            completed: result.completedSteps.length,
            failed: result.failedSteps.length,
            total: totalSteps,
            percentage: Math.round(((result.completedSteps.length + result.failedSteps.length) / totalSteps) * 100),
            currentStep: stepId
          });

        } finally {
          executing.delete(stepId);
        }
      });

      // Wait for this batch to complete
      await Promise.all(promises.filter(p => p !== null));

      if (this.options.stopOnError && result.failedSteps.length > 0) {
        break;
      }
    }

    // Mark remaining steps as skipped if we stopped early
    if (!plan.isComplete()) {
      for (const step of plan.steps) {
        if (!result.completedSteps.includes(step.id) && 
            !result.failedSteps.includes(step.id) &&
            !executing.has(step.id)) {
          result.skippedSteps.push(step.id);
        }
      }
    }
  }

  /**
   * Execute function with timeout
   * @private
   */
  async _executeWithTimeout(fn, timeout) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Execution timeout after ${timeout}ms`));
      }, timeout);

      Promise.resolve(fn())
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Sleep for specified milliseconds
   * @private
   */
  async _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create checkpoint after step execution
   * @private
   */
  async _createStepCheckpoint(plan, step) {
    // Check if should create checkpoint based on interval and filter
    this.stepCount++;
    if (this.options.checkpointInterval > 1 && this.stepCount % this.options.checkpointInterval !== 0) {
      return;
    }
    
    if (this.options.checkpointFilter && !this.options.checkpointFilter(step.id)) {
      return;
    }
    
    const checkpointName = this.options.checkpointNaming ?
      this.options.checkpointNaming(step.id, step.title) :
      `After ${step.id}`;
    
    try {
      const startTime = Date.now();
      let checkpointId;
      
      // Use checkpoint manager if available, otherwise use plan's built-in checkpoint
      if (this.checkpointManager) {
        checkpointId = this.checkpointManager.createCheckpoint(
          checkpointName,
          {
            ...this.options.checkpointOptions,
            stepId: step.id,
            stepTitle: step.title
          }
        );
      } else {
        // Use plan's built-in checkpoint functionality
        checkpointId = plan.createCheckpoint(checkpointName, {
          ...this.options.checkpointOptions,
          stepId: step.id,
          stepTitle: step.title
        });
      }
      
      const duration = Date.now() - startTime;
      
      if (this.options.trackCheckpointStats) {
        this.checkpointStats.totalCheckpoints++;
        this.checkpointStats.successfulCheckpoints++;
        this.checkpointStats.checkpointTimes.push(duration);
      }
      
      this.emit('checkpoint-created', {
        planId: plan.id,
        stepId: step.id,
        checkpointId,
        checkpointName,
        timestamp: new Date()
      });
    } catch (error) {
      if (this.options.trackCheckpointStats) {
        this.checkpointStats.totalCheckpoints++;
        this.checkpointStats.failedCheckpoints++;
      }
      
      this.emit('checkpoint-failed', {
        planId: plan.id,
        stepId: step.id,
        error: error.message,
        timestamp: new Date()
      });
    }
  }
  
  /**
   * Handle rollback on step failure
   * @private
   */
  async _handleStepFailureRollback(plan, stepId) {
    try {
      // Find last checkpoint before this step
      const checkpoints = this.checkpointManager.listCheckpoints();
      if (checkpoints.length === 0) {
        // No checkpoints available for rollback
        return null;
      }
      
      const lastCheckpoint = checkpoints[checkpoints.length - 1];
      
      // Perform rollback based on strategy
      let rollbackResult;
      switch (this.options.rollbackStrategy) {
        case 'partial':
          rollbackResult = this.rollbackSystem.partialRollback(
            lastCheckpoint.id,
            this.options.rollbackOptions
          );
          break;
        case 'steps':
          rollbackResult = this.rollbackSystem.rollbackSteps(
            lastCheckpoint.id,
            [stepId]
          );
          break;
        case 'conditional':
          const condition = () => plan.state.failedSteps.length > 0;
          rollbackResult = this.rollbackSystem.conditionalRollback(
            lastCheckpoint.id,
            condition
          );
          break;
        case 'transform':
          rollbackResult = this.rollbackSystem.rollbackWithTransform(
            lastCheckpoint.id,
            this.options.rollbackOptions
          );
          break;
        case 'filtered':
          rollbackResult = this.rollbackSystem.rollbackWithFilter(
            lastCheckpoint.id,
            this.options.rollbackOptions
          );
          break;
        default:
          rollbackResult = this.rollbackSystem.restoreFromCheckpoint(lastCheckpoint.id);
      }
      
      return {
        stepId,
        checkpointId: lastCheckpoint.id,
        strategy: this.options.rollbackStrategy,
        success: rollbackResult.success,
        timestamp: new Date()
      };
    } catch (error) {
      // Rollback failed, but don't throw - let execution continue
      this.emit('rollback-failed', {
        planId: plan.id,
        stepId,
        error: error.message
      });
      return null;
    }
  }
  
  /**
   * Create checkpoint manually
   */
  async createCheckpoint(name) {
    if (!this.checkpointManager) {
      throw new Error('Checkpoint manager not configured');
    }
    return this.checkpointManager.createCheckpoint(name);
  }
  
  /**
   * Rollback to specific checkpoint
   */
  async rollbackToCheckpoint(checkpointId) {
    if (!this.rollbackSystem) {
      throw new Error('Rollback system not configured');
    }
    return this.rollbackSystem.restoreFromCheckpoint(checkpointId);
  }
  
  /**
   * List available checkpoints
   */
  listCheckpoints() {
    if (!this.checkpointManager) {
      return [];
    }
    return this.checkpointManager.listCheckpoints();
  }
  
  /**
   * Resume execution from checkpoint
   */
  async resumeFromCheckpoint(plan, checkpointId) {
    try {
      if (!this.checkpointManager || !this.rollbackSystem) {
        return {
          success: false,
          error: 'Checkpoint system not configured'
        };
      }
      
      const checkpoint = this.checkpointManager.getCheckpoint(checkpointId);
      if (!checkpoint) {
        return {
          success: false,
          error: 'Checkpoint corrupted or not found'
        };
      }
      
      // Restore to checkpoint
      const rollbackResult = this.rollbackSystem.restoreFromCheckpoint(checkpointId);
      if (!rollbackResult.success) {
        return {
          success: false,
          error: 'Failed to restore from checkpoint'
        };
      }
      
      // Get last completed step from checkpoint
      const lastCompletedStep = checkpoint.planState.completedSteps[
        checkpoint.planState.completedSteps.length - 1
      ];
      
      // Continue execution from next step
      const remainingResult = await this.executePlan(plan);
      
      return {
        success: remainingResult.success,
        resumedFrom: lastCompletedStep,
        completedSteps: remainingResult.completedSteps,
        failedSteps: remainingResult.failedSteps
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Get checkpoint statistics
   */
  getCheckpointStatistics() {
    const avgTime = this.checkpointStats.checkpointTimes.length > 0 ?
      this.checkpointStats.checkpointTimes.reduce((a, b) => a + b, 0) / 
      this.checkpointStats.checkpointTimes.length : 0;
    
    return {
      ...this.checkpointStats,
      averageCheckpointTime: avgTime
    };
  }
  
  /**
   * Get executor statistics
   */
  getStatistics() {
    return {
      version: this.executionContext.version,
      environment: this.executionContext.environment,
      configuration: {
        parallel: this.options.parallel,
        stopOnError: this.options.stopOnError,
        timeout: this.options.timeout,
        autoCheckpoint: this.options.autoCheckpoint,
        maxRetries: this.options.maxRetries,
        rollbackOnFailure: this.options.rollbackOnFailure,
        checkpointManager: this.checkpointManager ? 'configured' : 'not configured',
        rollbackSystem: this.rollbackSystem ? 'configured' : 'not configured'
      },
      toolsAvailable: this.toolRegistry.getToolCount(),
      capabilities: {
        parallelExecution: true,
        checkpointSupport: true,
        retryLogic: true,
        timeoutHandling: true,
        rollbackSupport: !!this.rollbackSystem
      },
      checkpointStats: this.options.trackCheckpointStats ? 
        this.getCheckpointStatistics() : null
    };
  }

  /**
   * Validate execution environment
   */
  validateEnvironment() {
    const issues = [];

    if (!this.toolRegistry) {
      issues.push('Tool registry not available');
    } else if (this.toolRegistry.getToolCount() === 0) {
      issues.push('No tools available in registry');
    }

    if (!this.handleRegistry) {
      issues.push('Handle registry not available');
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }
}