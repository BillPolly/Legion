/**
 * SequentialExecutionStrategy - Execute tasks in sequential order
 * Handles sequential execution with dependency management and result passing
 * 
 * Features:
 * - Sequential task execution
 * - Dependency management
 * - Result passing between tasks
 * - Early termination on failure
 * - Progress tracking for sequential tasks
 */

import { ExecutionStrategy } from './ExecutionStrategy.js';

export class SequentialExecutionStrategy extends ExecutionStrategy {
  constructor(injectedDependencies = {}) {
    super(injectedDependencies);
    this.name = 'SequentialExecutionStrategy';
    this.stopOnFailure = injectedDependencies.stopOnFailure ?? true;
    this.passResults = injectedDependencies.passResults ?? true;
    this.accumulateResults = injectedDependencies.accumulateResults ?? true;
    
    // Initialize dependencies with injection
    this.initializeDependencies(injectedDependencies);
  }

  /**
   * Initialize dependencies for better testability
   * @param {Object} dependencies - Injected dependencies
   */
  initializeDependencies(dependencies) {
    this.toolRegistry = dependencies.toolRegistry || null;
    this.llmClient = dependencies.llmClient || null;
    this.progressStream = dependencies.progressStream || null;
    this.resourceManager = dependencies.resourceManager || null;
    this.logger = dependencies.logger || null;
    this.options = dependencies; // Store for substep strategy creation
  }

  /**
   * Update dependencies after construction for testing
   * @param {Object} updatedDependencies - New dependencies to inject
   */
  updateDependencies(updatedDependencies) {
    // Update inherited dependencies
    if (super.updateDependencies) {
      super.updateDependencies(updatedDependencies);
    }
    
    // Update strategy-specific dependencies
    if (updatedDependencies.toolRegistry) {
      this.toolRegistry = updatedDependencies.toolRegistry;
    }
    if (updatedDependencies.llmClient) {
      this.llmClient = updatedDependencies.llmClient;
    }
    if (updatedDependencies.progressStream) {
      this.progressStream = updatedDependencies.progressStream;
    }
    if (updatedDependencies.resourceManager) {
      this.resourceManager = updatedDependencies.resourceManager;
    }
    if (updatedDependencies.logger) {
      this.logger = updatedDependencies.logger;
    }
    if (updatedDependencies.stopOnFailure !== undefined) {
      this.stopOnFailure = updatedDependencies.stopOnFailure;
    }
    if (updatedDependencies.passResults !== undefined) {
      this.passResults = updatedDependencies.passResults;
    }
    if (updatedDependencies.accumulateResults !== undefined) {
      this.accumulateResults = updatedDependencies.accumulateResults;
    }

    // Update options for substep strategy creation
    this.options = { ...this.options, ...updatedDependencies };

    if (this.logger) {
      this.logger.debug('SequentialExecutionStrategy dependencies updated', {
        updatedKeys: Object.keys(updatedDependencies)
      });
    }
  }

  /**
   * Get current dependencies for testing/inspection
   * @returns {Object} - Current dependency state
   */
  getDependencies() {
    const baseDependencies = super.getDependencies ? super.getDependencies() : {};
    
    return {
      ...baseDependencies,
      toolRegistry: this.toolRegistry,
      llmClient: this.llmClient,
      progressStream: this.progressStream,
      resourceManager: this.resourceManager,
      logger: this.logger,
      stopOnFailure: this.stopOnFailure,
      passResults: this.passResults,
      accumulateResults: this.accumulateResults
    };
  }

  /**
   * Check if this strategy can handle the task
   */
  canHandle(task, context) {
    // Can handle if task is marked as sequential
    if (task.sequential || task.strategy === 'sequential') {
      return true;
    }

    // Can handle if task has steps array
    if (Array.isArray(task.steps) && task.steps.length > 0) {
      return true;
    }

    // Can handle if task has sequence array
    if (Array.isArray(task.sequence) && task.sequence.length > 0) {
      return true;
    }

    // Can handle if task indicates sequential execution
    if (task.pipeline || task.workflow) {
      return true;
    }

    // Can handle tasks with explicit ordering
    if (task.ordered && Array.isArray(task.subtasks)) {
      return true;
    }

    return false;
  }

  /**
   * Execute tasks in sequential order
   */
  async execute(task, context) {
    this.validateTask(task);
    const taskId = this.getTaskId(task);

    // When stopOnFailure is true, we want errors to be thrown not returned
    const monitoringOptions = { returnErrors: !this.stopOnFailure };

    return this.executeWithMonitoring(task, context, async (task, ctx, emitter) => {
      // Check if we can handle this task
      if (!this.canHandle(task, ctx)) {
        throw new Error(`SequentialExecutionStrategy cannot handle task: ${taskId}`);
      }

      // Get steps to execute
      const steps = this.extractSteps(task);
      if (!steps || steps.length === 0) {
        throw new Error('No steps found');
      }

      emitter.custom('sequential_start', {
        totalSteps: steps.length,
        stopOnFailure: this.stopOnFailure,
        passResults: this.passResults
      });

      // Execute steps sequentially
      const results = [];
      let currentContext = ctx;
      let accumulatedResult = null;
      let previousStepResult = null;

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const stepId = this.getTaskId(step);

        emitter.custom('step_start', {
          stepId,
          stepIndex: i,
          totalSteps: steps.length
        });

        // Create child context for this step
        const stepContext = currentContext.createChild(stepId);

        // Pass previous step result (not accumulated result) to step if configured
        const stepWithContext = this.passResults && previousStepResult !== null
          ? this.injectPreviousResult(step, previousStepResult)
          : step;

        // Execute step
        const stepResult = await this.executeStep(stepWithContext, stepContext, i, emitter);

        // Check if step failed
        if (!stepResult.success) {
          emitter.custom('step_failed', {
            stepId,
            stepIndex: i,
            error: stepResult.error
          });

          // Record failure
          results.push({
            stepId,
            stepIndex: i,
            success: false,
            error: stepResult.error,
            context: currentContext
          });

          // Check if we should stop on failure
          if (this.stopOnFailure) {
            emitter.custom('sequential_failed', {
              totalSteps: steps.length,
              completed: i,
              failed: 1,
              failedAt: i,
              error: stepResult.error
            });
            // Re-throw the error to stop execution immediately
            throw new Error(`Sequential execution failed at step ${i}: ${stepResult.error}`);
          }

          // Continue with null result for accumulation, error object for result passing
          if (this.accumulateResults) {
            accumulatedResult = this.accumulateResult(accumulatedResult, { error: stepResult.error }, task);
          }
          
          // Update previous step result to null so next step doesn't get error data
          previousStepResult = null;
          
          // Continue to next step
          continue;
        }

        // Update context with result
        currentContext = stepContext.withResult(stepResult);

        // Track successful execution
        results.push({
          stepId,
          stepIndex: i,
          success: true,
          result: this.extractResultValue(stepResult),
          context: currentContext
        });

        // Update accumulated result
        if (this.accumulateResults) {
          accumulatedResult = this.accumulateResult(accumulatedResult, stepResult, task);
        } else {
          accumulatedResult = this.extractResultValue(stepResult);
        }

        // Update previous step result for next iteration
        previousStepResult = this.extractResultValue(stepResult);

        emitter.custom('step_complete', {
          stepId,
          stepIndex: i,
          success: true,
          result: this.extractResultValue(stepResult)
        });

        emitter.progress(((i + 1) / steps.length) * 100, {
          completed: i + 1,
          total: steps.length,
          currentStep: stepId
        });
      }

      // Count successful and failed steps
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      emitter.custom('sequential_complete', {
        totalSteps: steps.length,
        successful,
        failed,
        finalResult: accumulatedResult
      });

      // Return final result
      if (this.accumulateResults) {
        return accumulatedResult;
      } else {
        // Return results array - map successful results and error objects
        return results.map(r => r.success ? r.result : { error: r.error });
      }
    }, monitoringOptions);
  }

  /**
   * Extract steps from task definition
   */
  extractSteps(task) {
    // Direct steps array
    if (Array.isArray(task.steps)) {
      return task.steps;
    }

    // Sequence array
    if (Array.isArray(task.sequence)) {
      return task.sequence;
    }

    // Ordered subtasks
    if (task.ordered && Array.isArray(task.subtasks)) {
      return task.subtasks;
    }

    // Pipeline steps
    if (task.pipeline && Array.isArray(task.pipeline.steps)) {
      return task.pipeline.steps;
    }

    // Workflow tasks
    if (task.workflow && Array.isArray(task.workflow.tasks)) {
      return task.workflow.tasks;
    }

    return [];
  }

  /**
   * Execute a single step
   */
  async executeStep(step, context, index, emitter) {
    const stepId = this.getTaskId(step);
    
    try {
      // Determine execution strategy for step
      const strategy = await this.selectStepStrategy(step, context);
      
      const executionPromise = strategy
        ? strategy.execute(step, context)
        : this.executeDirectly(step, context);

      const result = await executionPromise;

      return {
        success: true,
        result: this.extractResultValue(result),
        context: result.context || context.withResult(result),
        stepId,
        stepIndex: index
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        context,
        stepId,
        stepIndex: index
      };
    }
  }

  /**
   * Select strategy for step execution
   */
  async selectStepStrategy(step, context) {
    // Use atomic strategy for simple steps
    if (step.tool || step.toolName || step.execute || step.fn || step.prompt) {
      if (this.options.atomicStrategy) {
        return this.options.atomicStrategy;
      }
      // Import dynamically to avoid circular dependencies
      const { AtomicExecutionStrategy } = await import('./AtomicExecutionStrategy.js');
      return new AtomicExecutionStrategy({
        toolRegistry: this.toolRegistry,
        llmClient: this.llmClient,
        progressStream: this.progressStream
      });
    }

    // Nested parallel steps
    if (step.parallel || Array.isArray(step.subtasks)) {
      const { ParallelExecutionStrategy } = await import('./ParallelExecutionStrategy.js');
      return new ParallelExecutionStrategy({
        toolRegistry: this.toolRegistry,
        llmClient: this.llmClient,
        progressStream: this.progressStream
      });
    }

    // Nested sequential steps
    if (step.sequential || Array.isArray(step.steps)) {
      return this; // Use self for nested sequential
    }

    return null;
  }

  /**
   * Execute step directly (fallback)
   */
  async executeDirectly(step, context) {
    // Simple prompt execution
    if (step.prompt || step.description || step.instruction) {
      if (!this.llmClient) {
        throw new Error('LLM client not configured for direct execution');
      }

      const response = await this.llmClient.complete({
        messages: [
          { role: 'user', content: step.prompt || step.description || step.instruction }
        ]
      });

      return {
        success: true,
        result: response.content || response
      };
    }

    // Direct data return
    if (step.data !== undefined) {
      return {
        success: true,
        result: step.data
      };
    }

    // Direct value return
    if (step.value !== undefined) {
      return {
        success: true,
        result: step.value
      };
    }

    throw new Error(`Cannot execute step directly: ${this.getTaskId(step)}`);
  }

  /**
   * Inject previous result into step
   */
  injectPreviousResult(step, previousResult) {
    const enrichedStep = { ...step };

    // Add previous result to context
    if (!enrichedStep.context) {
      enrichedStep.context = {};
    }
    enrichedStep.context.previousResult = previousResult;

    // For prompt-based steps, inject result into prompt
    if (enrichedStep.prompt && typeof enrichedStep.prompt === 'string') {
      enrichedStep.prompt = enrichedStep.prompt.replace(
        /\{previousResult\}/g,
        JSON.stringify(previousResult)
      );
    }

    // For parameterized steps, inject result into params
    if (enrichedStep.params && typeof enrichedStep.params === 'object') {
      enrichedStep.params = this.injectResultIntoParams(enrichedStep.params, previousResult);
    }

    return enrichedStep;
  }

  /**
   * Inject result into parameters object
   */
  injectResultIntoParams(params, result) {
    const injected = { ...params };
    
    Object.keys(injected).forEach(key => {
      const value = injected[key];
      if (typeof value === 'string' && value.includes('{previousResult}')) {
        // If the placeholder is the entire string, use the result directly
        if (value === '{previousResult}') {
          injected[key] = result;
        } else {
          // Otherwise replace the placeholder with stringified result
          injected[key] = value.replace(/\{previousResult\}/g, JSON.stringify(result));
        }
      } else if (value === '{previousResult}') {
        injected[key] = result;
      }
    });

    return injected;
  }

  /**
   * Accumulate results from sequential steps
   */
  accumulateResult(accumulated, stepResult, task) {
    let result;
    
    // Handle error results specially - extract clean error object
    if (stepResult && typeof stepResult === 'object' && stepResult.success === false && stepResult.error) {
      result = { error: stepResult.error };
    } else {
      result = this.extractResultValue(stepResult);
    }

    // Custom accumulation function
    if (task.accumulate && typeof task.accumulate === 'function') {
      return task.accumulate(accumulated, result);
    }

    // Accumulation type
    switch (task.accumulationType || 'array') {
      case 'array':
        if (accumulated === null) {
          // First result - start as array to maintain consistency
          return [result];
        }
        // Add to existing array
        return Array.isArray(accumulated) ? [...accumulated, result] : [accumulated, result];
      
      case 'object':
        if (accumulated === null) accumulated = {};
        if (typeof result === 'object' && result !== null) {
          return { ...accumulated, ...result };
        }
        return accumulated;
      
      case 'sum':
        if (accumulated === null) accumulated = 0;
        const num = typeof result === 'number' ? result : parseFloat(result);
        return accumulated + (isNaN(num) ? 0 : num);
      
      case 'concat':
        if (accumulated === null) accumulated = [];
        if (Array.isArray(result)) {
          return Array.isArray(accumulated) ? accumulated.concat(result) : [accumulated, ...result];
        }
        return Array.isArray(accumulated) ? [...accumulated, result] : [accumulated, result];
      
      case 'last':
        return result;
      
      case 'first':
        return accumulated !== null ? accumulated : result;
      
      case 'pipeline':
        // Each step operates on the result of the previous step
        return result;
      
      default:
        return result;
    }
  }

  /**
   * Estimate execution complexity
   */
  async estimateComplexity(task, context) {
    const steps = this.extractSteps(task);
    const stepCount = steps.length;
    
    if (stepCount === 0) {
      return {
        estimatedTime: 0,
        estimatedCost: 0,
        confidence: 0,
        reasoning: 'No steps found'
      };
    }

    // Estimate individual step complexity
    let totalTime = 0;
    let totalCost = 0;
    let minConfidence = 1;

    for (const step of steps) {
      const estimate = await this.estimateStepComplexity(step, context);
      totalTime += estimate.estimatedTime;
      totalCost += estimate.estimatedCost;
      minConfidence = Math.min(minConfidence, estimate.confidence);
    }

    return {
      estimatedTime: totalTime,
      estimatedCost: totalCost,
      confidence: minConfidence * 0.95, // Slightly lower confidence for sequential
      reasoning: `Sequential execution of ${stepCount} steps`
    };
  }

  /**
   * Estimate step complexity
   */
  async estimateStepComplexity(step, context) {
    // Basic estimates based on step type
    if (step.tool || step.toolName) {
      return {
        estimatedTime: 500,
        estimatedCost: 0,
        confidence: 0.8
      };
    }

    if (step.prompt || step.description || step.instruction) {
      return {
        estimatedTime: 2000,
        estimatedCost: 0.001,
        confidence: 0.7
      };
    }

    if (step.execute || step.fn) {
      return {
        estimatedTime: 100,
        estimatedCost: 0,
        confidence: 0.9
      };
    }

    // Nested parallel steps
    if (step.parallel || Array.isArray(step.subtasks)) {
      return {
        estimatedTime: 1500,
        estimatedCost: 0.002,
        confidence: 0.6
      };
    }

    return {
      estimatedTime: 1000,
      estimatedCost: 0,
      confidence: 0.5
    };
  }

  /**
   * Validate sequential task configuration
   */
  validateSequentialTask(task) {
    this.validateTask(task);

    const steps = this.extractSteps(task);
    if (!steps || steps.length === 0) {
      throw new Error('Sequential task must have steps');
    }

    // Validate step dependencies
    if (task.dependencies) {
      this.validateStepDependencies(steps, task.dependencies);
    }

    return true;
  }

  /**
   * Validate step dependencies
   */
  validateStepDependencies(steps, dependencies) {
    const stepIds = new Set(steps.map(step => this.getTaskId(step)));
    
    Object.entries(dependencies).forEach(([stepId, deps]) => {
      if (!stepIds.has(stepId)) {
        throw new Error(`Unknown step ID in dependencies: ${stepId}`);
      }
      
      if (Array.isArray(deps)) {
        deps.forEach(depId => {
          if (!stepIds.has(depId)) {
            throw new Error(`Unknown dependency step ID: ${depId}`);
          }
        });
      }
    });
  }
}