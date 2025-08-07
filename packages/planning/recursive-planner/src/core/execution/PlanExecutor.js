/**
 * PlanExecutor - Handles the execution of validated plans
 */

import { ExecutionResult, StepResult, ExecutionState } from './results/ExecutionResult.js';
import { ValidationUtils } from '../../foundation/utils/validation/ValidationUtils.js';
import { ToolExecutionError } from '../../foundation/types/errors/errors.js';

/**
 * Execution strategy constants
 */
export const ExecutionStrategy = {
  SEQUENTIAL: 'sequential',
  PARALLEL: 'parallel',
  DEPENDENCY_AWARE: 'dependency_aware'
};

/**
 * Configuration for plan execution
 */
export class ExecutionConfig {
  constructor(options = {}) {
    this.strategy = options.strategy || ExecutionStrategy.SEQUENTIAL;
    this.maxParallelSteps = options.maxParallelSteps || 3;
    this.stepTimeout = options.stepTimeout || 30000; // 30 seconds
    this.continueOnFailure = options.continueOnFailure || false;
    this.debugMode = options.debugMode || false;
    this.artifactResolver = options.artifactResolver || null; // Function to resolve artifacts
  }
}

/**
 * Executes validated plans with support for different execution strategies
 */
export class PlanExecutor {
  constructor(config = {}) {
    this.config = config instanceof ExecutionConfig ? config : new ExecutionConfig(config);
    this.isExecuting = false;
    this.currentExecution = null;
    this.executionHistory = [];
  }

  /**
   * Execute a validated plan
   * @param {Array} plan - Array of PlanStep objects
   * @param {Array} tools - Available tools
   * @param {Object} artifactRegistry - Initial artifact registry
   * @param {Object} context - Execution context
   * @returns {Promise<ExecutionResult>} Execution result
   */
  async execute(plan, tools, artifactRegistry = null, context = {}) {
    ValidationUtils.array(plan, 'plan');
    ValidationUtils.array(tools, 'tools');

    if (this.isExecuting) {
      throw new Error('PlanExecutor is already executing a plan');
    }

    this.isExecuting = true;
    const executionId = this.generateExecutionId();
    const result = new ExecutionResult(executionId);
    this.currentExecution = result;

    // Initialize artifact registry
    if (artifactRegistry) {
      for (const [key, value] of Object.entries(artifactRegistry)) {
        result.artifactRegistry.set(key, value);
      }
    }

    try {
      if (this.config.debugMode) {
        console.log(`[PlanExecutor] Starting execution of ${plan.length} steps with strategy: ${this.config.strategy}`);
      }

      // Create tool lookup map
      const toolMap = new Map(tools.map(tool => [tool.name, tool]));

      // Execute based on strategy
      switch (this.config.strategy) {
        case ExecutionStrategy.SEQUENTIAL:
          await this.executeSequential(plan, toolMap, result, context);
          break;
        case ExecutionStrategy.PARALLEL:
          await this.executeParallel(plan, toolMap, result, context);
          break;
        case ExecutionStrategy.DEPENDENCY_AWARE:
          await this.executeDependencyAware(plan, toolMap, result, context);
          break;
        default:
          throw new Error(`Unknown execution strategy: ${this.config.strategy}`);
      }

      // Mark as completed if no failures
      if (!result.isFailed()) {
        result.markCompleted(plan.length);
      }

      if (this.config.debugMode) {
        console.log(`[PlanExecutor] Execution completed:`, result.getSummary());
      }

    } catch (error) {
      console.error(`[PlanExecutor] Execution failed:`, error.message);
      if (!result.isFailed()) {
        result.markCancelled(`Execution error: ${error.message}`);
      }
    } finally {
      this.isExecuting = false;
      this.currentExecution = null;
      this.executionHistory.push(result);
    }

    return result;
  }

  /**
   * Execute steps sequentially one by one
   * @param {Array} plan - Plan steps
   * @param {Map} toolMap - Tools by name
   * @param {ExecutionResult} result - Execution result
   * @param {Object} context - Execution context
   */
  async executeSequential(plan, toolMap, result, context) {
    for (const step of plan) {
      try {
        const stepResult = await this.executeStep(step, toolMap, result, context);
        result.addCompletedStep(step, stepResult);

        if (this.config.debugMode) {
          console.log(`[PlanExecutor] Step ${step.id} completed in ${stepResult.executionTime}ms`);
        }

      } catch (error) {
        result.addFailedStep(step, error);
        
        if (!this.config.continueOnFailure) {
          // Skip remaining steps
          for (let i = plan.indexOf(step) + 1; i < plan.length; i++) {
            result.addSkippedStep(plan[i], 'Previous step failed');
          }
          break;
        }
      }
    }
  }

  /**
   * Execute steps in parallel batches
   * @param {Array} plan - Plan steps
   * @param {Map} toolMap - Tools by name
   * @param {ExecutionResult} result - Execution result
   * @param {Object} context - Execution context
   */
  async executeParallel(plan, toolMap, result, context) {
    const batches = this.createParallelBatches(plan, this.config.maxParallelSteps);
    
    for (const batch of batches) {
      const batchPromises = batch.map(async (step) => {
        try {
          const stepResult = await this.executeStep(step, toolMap, result, context);
          result.addCompletedStep(step, stepResult);
          return { step, success: true, result: stepResult };
        } catch (error) {
          result.addFailedStep(step, error);
          return { step, success: false, error };
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);
      
      // Check if we should continue after batch failures
      const failures = batchResults.filter(r => r.status === 'rejected' || !r.value.success);
      if (failures.length > 0 && !this.config.continueOnFailure) {
        // Skip remaining batches
        const remainingSteps = batches.slice(batches.indexOf(batch) + 1).flat();
        remainingSteps.forEach(step => {
          result.addSkippedStep(step, 'Batch execution failed');
        });
        break;
      }
    }
  }

  /**
   * Execute steps respecting dependencies
   * @param {Array} plan - Plan steps
   * @param {Map} toolMap - Tools by name
   * @param {ExecutionResult} result - Execution result
   * @param {Object} context - Execution context
   */
  async executeDependencyAware(plan, toolMap, result, context) {
    const stepMap = new Map(plan.map(step => [step.id, step]));
    const completed = new Set();
    const failed = new Set();
    
    while (completed.size + failed.size < plan.length) {
      // Find steps that can run (all dependencies completed)
      const readySteps = plan.filter(step => 
        !completed.has(step.id) && 
        !failed.has(step.id) &&
        (step.dependencies || []).every(depId => completed.has(depId))
      );

      if (readySteps.length === 0) {
        // Check for circular dependencies or unreachable steps
        const remaining = plan.filter(step => !completed.has(step.id) && !failed.has(step.id));
        remaining.forEach(step => {
          result.addSkippedStep(step, 'Unresolved dependencies or circular dependency detected');
          failed.add(step.id);
        });
        break;
      }

      // Execute ready steps in parallel (up to maxParallelSteps)
      const batch = readySteps.slice(0, this.config.maxParallelSteps);
      const batchPromises = batch.map(async (step) => {
        try {
          const stepResult = await this.executeStep(step, toolMap, result, context);
          result.addCompletedStep(step, stepResult);
          completed.add(step.id);
          return { step, success: true };
        } catch (error) {
          result.addFailedStep(step, error);
          failed.add(step.id);
          return { step, success: false, error };
        }
      });

      await Promise.allSettled(batchPromises);

      // If any step failed and we don't continue on failure, skip dependent steps
      if (!this.config.continueOnFailure) {
        const newFailures = batch.filter(step => failed.has(step.id));
        if (newFailures.length > 0) {
          // Find and skip all steps that depend on failed steps
          const dependentSteps = this.findDependentSteps(newFailures, plan, completed, failed);
          dependentSteps.forEach(step => {
            result.addSkippedStep(step, 'Dependency failed');
            failed.add(step.id);
          });
        }
      }
    }
  }

  /**
   * Execute a single step
   * @param {Object} step - Plan step to execute
   * @param {Map} toolMap - Tools by name
   * @param {ExecutionResult} result - Current execution result
   * @param {Object} context - Execution context
   * @returns {Promise<StepResult>} Step execution result
   */
  async executeStep(step, toolMap, result, context) {
    const startTime = Date.now();
    
    try {
      // Get the tool
      const tool = toolMap.get(step.tool);
      if (!tool) {
        throw new ToolExecutionError(`Tool '${step.tool}' not found`, step.tool, step.params);
      }

      // Resolve artifact references in parameters
      const resolvedParams = this.resolveArtifactReferences(step.params, result.artifactRegistry);

      if (this.config.debugMode) {
        console.log(`[PlanExecutor] Executing step ${step.id} with tool ${step.tool}`);
        console.log(`  Parameters:`, resolvedParams);
      }

      // Execute the tool with timeout
      const toolResult = await this.executeWithTimeout(
        () => tool.run ? tool.run(resolvedParams) : tool.execute(resolvedParams),
        this.config.stepTimeout,
        `Step ${step.id} timed out after ${this.config.stepTimeout}ms`
      );

      const executionTime = Date.now() - startTime;

      // Extract named artifacts from the result based on saveOutputs
      const artifacts = this.extractNamedArtifacts(step.saveOutputs, toolResult);

      return StepResult.success(step.id, toolResult, executionTime, artifacts);

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      if (this.config.debugMode) {
        console.error(`[PlanExecutor] Step ${step.id} failed:`, error.message);
      }

      // Wrap the error with step context
      const wrappedError = new ToolExecutionError(
        `Step ${step.id} failed: ${error.message}`,
        step.tool,
        step.params,
        error
      );

      throw wrappedError;
    }
  }

  /**
   * Resolve @artifact references in parameters
   * @param {Object} params - Step parameters
   * @param {Map} artifactRegistry - Available artifacts
   * @returns {Object} Resolved parameters
   */
  resolveArtifactReferences(params, artifactRegistry) {
    if (!params || typeof params !== 'object') return params;

    const resolved = {};
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string' && value.startsWith('@')) {
        const artifactName = value.substring(1);
        const artifact = artifactRegistry.get(artifactName);
        
        if (artifact === undefined) {
          throw new Error(`Artifact '${artifactName}' not found in registry`);
        }
        
        resolved[key] = artifact.value || artifact;
      } else if (typeof value === 'object') {
        resolved[key] = this.resolveArtifactReferences(value, artifactRegistry);
      } else {
        resolved[key] = value;
      }
    }
    return resolved;
  }

  /**
   * Extract named artifacts from tool result based on saveOutputs configuration
   * @param {Object} saveOutputs - Step's saveOutputs configuration
   * @param {Object} toolResult - Tool execution result
   * @returns {Object} Named artifacts
   */
  extractNamedArtifacts(saveOutputs, toolResult) {
    if (!saveOutputs || !toolResult) return {};

    const artifacts = {};
    
    for (const [outputField, artifactConfig] of Object.entries(saveOutputs)) {
      if (toolResult.success && toolResult.data && toolResult.data[outputField] !== undefined) {
        artifacts[artifactConfig.name] = {
          name: artifactConfig.name,
          description: artifactConfig.description,
          value: toolResult.data[outputField],
          type: typeof toolResult.data[outputField],
          sourceField: outputField
        };
      }
    }

    return artifacts;
  }

  /**
   * Execute a function with timeout
   * @param {Function} fn - Function to execute
   * @param {number} timeout - Timeout in milliseconds
   * @param {string} errorMessage - Error message for timeout
   * @returns {Promise} Function result
   */
  async executeWithTimeout(fn, timeout, errorMessage) {
    return Promise.race([
      fn(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error(errorMessage)), timeout)
      )
    ]);
  }

  /**
   * Create parallel execution batches
   * @param {Array} steps - Plan steps
   * @param {number} batchSize - Maximum batch size
   * @returns {Array<Array>} Batches of steps
   */
  createParallelBatches(steps, batchSize) {
    const batches = [];
    for (let i = 0; i < steps.length; i += batchSize) {
      batches.push(steps.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Find steps that depend on failed steps
   * @param {Array} failedSteps - Steps that failed
   * @param {Array} allSteps - All plan steps
   * @param {Set} completed - Completed step IDs
   * @param {Set} failed - Failed step IDs
   * @returns {Array} Dependent steps to skip
   */
  findDependentSteps(failedSteps, allSteps, completed, failed) {
    const failedIds = new Set(failedSteps.map(step => step.id));
    const toSkip = [];

    const checkDependencies = (step) => {
      if (completed.has(step.id) || failed.has(step.id)) return false;
      
      const dependencies = step.dependencies || [];
      return dependencies.some(depId => failedIds.has(depId));
    };

    // Find directly dependent steps
    for (const step of allSteps) {
      if (checkDependencies(step)) {
        toSkip.push(step);
        failedIds.add(step.id); // Mark as failed for transitive dependencies
      }
    }

    // Recursively find transitively dependent steps
    let foundNew = true;
    while (foundNew) {
      foundNew = false;
      for (const step of allSteps) {
        if (!toSkip.includes(step) && checkDependencies(step)) {
          toSkip.push(step);
          failedIds.add(step.id);
          foundNew = true;
        }
      }
    }

    return toSkip;
  }

  /**
   * Generate unique execution ID
   * @returns {string} Execution ID
   */
  generateExecutionId() {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cancel current execution
   * @param {string} reason - Cancellation reason
   */
  async cancelExecution(reason = 'Execution cancelled') {
    if (this.currentExecution && this.isExecuting) {
      this.currentExecution.markCancelled(reason);
      this.isExecuting = false;
    }
  }

  /**
   * Get execution statistics
   * @returns {Object} Statistics
   */
  getExecutionStats() {
    return {
      isExecuting: this.isExecuting,
      totalExecutions: this.executionHistory.length,
      successfulExecutions: this.executionHistory.filter(r => r.isComplete()).length,
      failedExecutions: this.executionHistory.filter(r => r.isFailed()).length,
      averageExecutionTime: this.executionHistory.length > 0 
        ? this.executionHistory.reduce((sum, r) => sum + r.getDuration(), 0) / this.executionHistory.length
        : 0
    };
  }
}