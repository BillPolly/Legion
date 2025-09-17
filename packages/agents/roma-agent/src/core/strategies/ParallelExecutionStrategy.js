/**
 * ParallelExecutionStrategy - Execute multiple tasks concurrently
 * Handles parallel execution with concurrency control and result aggregation
 * 
 * Features:
 * - Concurrent task execution
 * - Concurrency limits
 * - Result aggregation
 * - Failure handling (fail-fast or continue)
 * - Progress tracking for parallel tasks
 */

import { ExecutionStrategy } from './ExecutionStrategy.js';

export class ParallelExecutionStrategy extends ExecutionStrategy {
  constructor(injectedDependencies = {}) {
    super(injectedDependencies);
    this.name = 'ParallelExecutionStrategy';
    this.maxConcurrency = injectedDependencies.maxConcurrency ?? 5;
    this.failFast = injectedDependencies.failFast ?? false;
    this.aggregateResults = injectedDependencies.aggregateResults ?? true;
    this.timeoutPerTask = injectedDependencies.timeoutPerTask ?? 30000;
    
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
    this.errorRecovery = dependencies.errorRecovery || null;
    this.options = dependencies; // Store for subtask strategy creation
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
    if (updatedDependencies.errorRecovery) {
      this.errorRecovery = updatedDependencies.errorRecovery;
    }
    if (updatedDependencies.maxConcurrency !== undefined) {
      this.maxConcurrency = updatedDependencies.maxConcurrency;
    }
    if (updatedDependencies.failFast !== undefined) {
      this.failFast = updatedDependencies.failFast;
    }
    if (updatedDependencies.aggregateResults !== undefined) {
      this.aggregateResults = updatedDependencies.aggregateResults;
    }
    if (updatedDependencies.timeoutPerTask !== undefined) {
      this.timeoutPerTask = updatedDependencies.timeoutPerTask;
    }

    // Update options for subtask strategy creation
    this.options = { ...this.options, ...updatedDependencies };

    if (this.logger) {
      this.logger.debug('ParallelExecutionStrategy dependencies updated', {
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
      errorRecovery: this.errorRecovery,
      maxConcurrency: this.maxConcurrency,
      failFast: this.failFast,
      aggregateResults: this.aggregateResults,
      timeoutPerTask: this.timeoutPerTask
    };
  }

  /**
   * Check if this strategy can handle the task
   */
  canHandle(task, context) {
    // Can handle if task is marked as parallel
    if (task.parallel || task.strategy === 'parallel') {
      return true;
    }

    // Can handle if task has subtasks array
    if (Array.isArray(task.subtasks) && task.subtasks.length > 0) {
      return true;
    }

    // Can handle if task has parallel operations
    if (task.operations && Array.isArray(task.operations)) {
      return true;
    }

    // Can handle if task indicates parallelism
    if (task.concurrent || task.batch) {
      return true;
    }

    return false;
  }

  /**
   * Execute tasks in parallel
   */
  async execute(task, context) {
    this.validateTask(task);
    const taskId = this.getTaskId(task);

    return this.executeWithMonitoring(task, context, async (task, ctx, emitter) => {
      // Check if we can handle this task
      if (!this.canHandle(task, ctx)) {
        throw new Error(`ParallelExecutionStrategy cannot handle task: ${taskId}`);
      }

      // Get subtasks to execute
      const subtasks = this.extractSubtasks(task);
      if (!subtasks || subtasks.length === 0) {
        throw new Error('No subtasks found for parallel execution');
      }

      emitter.custom('parallel_start', {
        totalTasks: subtasks.length,
        maxConcurrency: this.maxConcurrency,
        failFast: this.failFast
      });

      // Create child contexts for parallel execution
      const childContexts = ctx.createParallelContexts(
        subtasks.map(st => this.getTaskId(st))
      );

      // Execute tasks in parallel with concurrency control
      const results = await this.executeParallel(
        subtasks,
        childContexts,
        ctx,
        emitter
      );

      // Merge contexts and aggregate results
      const mergedContext = ctx.mergeParallelResults(
        results.map(r => r.context)
      );

      // Count successful and failed results
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      emitter.custom('parallel_complete', {
        totalTasks: subtasks.length,
        successful,
        failed
      });

      // Aggregate results based on configuration
      let aggregatedResult = this.aggregateResults
        ? this.aggregateTaskResults(results, task)
        : results.map(r => r.result);

      // Add execution details to the result when there are failures or when requested
      if (failed > 0 || task.includeDetails) {
        // For 'all' aggregation type, don't wrap since it already includes failure info
        if (task.aggregationType === 'all' && Array.isArray(aggregatedResult)) {
          // Return the array directly with failures included
          return aggregatedResult;
        } else if (typeof aggregatedResult === 'object' && aggregatedResult !== null && !Array.isArray(aggregatedResult)) {
          aggregatedResult.details = { successful, failed };
        } else {
          // For non-object results, wrap with details
          aggregatedResult = {
            result: aggregatedResult,
            details: { successful, failed }
          };
        }
      }

      return aggregatedResult;
    });
  }

  /**
   * Extract subtasks from task definition
   */
  extractSubtasks(task) {
    // Direct subtasks array
    if (Array.isArray(task.subtasks)) {
      return task.subtasks;
    }

    // Operations array
    if (Array.isArray(task.operations)) {
      return task.operations.map((op, index) => ({
        id: `${task.id || 'task'}-op-${index}`,
        ...op
      }));
    }

    // Batch processing
    if (task.batch && task.items) {
      return task.items.map((item, index) => ({
        id: `${task.id || 'task'}-item-${index}`,
        ...task.template,
        input: item
      }));
    }

    // Map operation
    if (task.map && task.collection) {
      return task.collection.map((item, index) => ({
        id: `${task.id || 'task'}-map-${index}`,
        operation: task.map,
        input: item
      }));
    }

    return [];
  }

  /**
   * Execute tasks in parallel with concurrency control
   */
  async executeParallel(tasks, contexts, parentContext, emitter) {
    const results = [];
    const executing = new Set();
    const queue = [...tasks.map((task, index) => ({ task, context: contexts[index], index }))];
    const errors = [];

    // Process queue with concurrency limit
    while (queue.length > 0 || executing.size > 0) {
      // Start new tasks up to concurrency limit
      while (queue.length > 0 && executing.size < this.maxConcurrency) {
        const { task, context, index } = queue.shift();
        
        const execution = this.executeSubtask(task, context, index, emitter)
          .then(result => {
            executing.delete(execution);
            results[index] = result;
            
            emitter.progress((results.filter(r => r).length / tasks.length) * 100, {
              completed: results.filter(r => r).length,
              total: tasks.length
            });

            // Check for fail-fast
            if (!result.success && this.failFast) {
              throw new Error(`Subtask failed: ${result.error}`);
            }
          })
          .catch(error => {
            executing.delete(execution);
            errors.push(error);
            
            if (this.failFast) {
              // Cancel remaining tasks
              queue.length = 0;
              throw error;
            } else {
              // Record failure but continue
              results[index] = {
                taskId: this.getTaskId(task),
                success: false,
                error: error.message,
                result: null,
                context
              };
            }
          });

        executing.add(execution);
      }

      // Wait for at least one task to complete
      if (executing.size > 0) {
        await Promise.race(executing);
      }
    }

    // Check if all tasks failed
    if (this.failFast && errors.length > 0) {
      throw new Error(`Parallel execution failed: ${errors[0].message}`);
    }

    return results;
  }

  /**
   * Execute a single subtask
   */
  async executeSubtask(task, context, index, emitter) {
    const taskId = this.getTaskId(task);
    
    emitter.custom('subtask_start', {
      taskId,
      index,
      parallel: true
    });

    try {
      // Determine execution strategy for subtask
      const strategy = await this.selectSubtaskStrategy(task, context);
      
      // Execute with timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Subtask timeout: ${taskId}`)), this.timeoutPerTask);
      });

      const executionPromise = strategy
        ? strategy.execute(task, context)
        : this.executeDirectly(task, context);

      const result = await Promise.race([executionPromise, timeoutPromise]);

      emitter.custom('subtask_complete', {
        taskId,
        index,
        success: true
      });

      return {
        taskId,
        success: true,
        result: this.extractResultValue(result),
        context: result.context || context.withResult(result),
        error: null
      };
    } catch (error) {
      // Attempt error recovery if available
      if (this.errorRecovery) {
        try {
          const recoveryResult = await this.errorRecovery.recover(error, {
            taskId,
            index,
            context: context.getMetadata ? context.getMetadata() : {},
            strategy: 'ParallelExecutionStrategy',
            parallel: true
          });
          
          if (recoveryResult.success) {
            if (this.logger) {
              this.logger.info('Error recovery successful for parallel subtask', {
                taskId,
                index,
                recoveryAction: recoveryResult.action
              });
            }
            
            emitter.custom('subtask_recovery_success', {
              taskId,
              index,
              recoveryAction: recoveryResult.action
            });
            
            // For parallel execution, return the recovery result as success
            return {
              taskId,
              success: true,
              result: recoveryResult.result || null,
              context: context.withResult(recoveryResult.result),
              error: null,
              recovered: true
            };
          }
        } catch (recoveryError) {
          if (this.logger) {
            this.logger.warn('Error recovery failed for parallel subtask', {
              taskId,
              index,
              originalError: error.message,
              recoveryError: recoveryError.message
            });
          }
        }
      }
      
      emitter.custom('subtask_failed', {
        taskId,
        index,
        error: error.message
      });

      return {
        taskId,
        success: false,
        result: null,
        context,
        error: error.message
      };
    }
  }

  /**
   * Select strategy for subtask execution
   */
  async selectSubtaskStrategy(task, context) {
    // Use atomic strategy for simple tasks
    if (task.tool || task.toolName || task.execute || task.fn || task.prompt) {
      if (this.options.atomicStrategy) {
        return this.options.atomicStrategy;
      }
      // Import dynamically to avoid circular dependencies
      const { AtomicExecutionStrategy } = await import('./AtomicExecutionStrategy.js');
      return new AtomicExecutionStrategy({
        toolRegistry: this.toolRegistry,
        llmClient: this.llmClient,
        simplePromptClient: this.simplePromptClient,
        progressStream: this.progressStream
      });
    }

    // Nested parallel tasks
    if (task.parallel || Array.isArray(task.subtasks)) {
      return this; // Use self for nested parallel
    }

    return null;
  }

  /**
   * Execute task directly (fallback)
   */
  async executeDirectly(task, context) {
    // Simple prompt execution
    if (task.prompt || task.description || task.operation) {
      // Ensure we have SimplePromptClient
      if (!this.simplePromptClient) {
        await this.initialize();
        if (!this.simplePromptClient) {
          throw new Error('SimplePromptClient not configured for direct execution');
        }
      }

      const response = await this.simplePromptClient.request({
        prompt: task.prompt || task.description || task.operation,
        maxTokens: task.maxTokens || 1000,
        temperature: task.temperature
      });

      return {
        success: true,
        result: response.content || response
      };
    }

    // Direct data return
    if (task.data !== undefined) {
      return {
        success: true,
        result: task.data
      };
    }

    throw new Error(`Cannot execute task directly: ${this.getTaskId(task)}`);
  }

  /**
   * Aggregate results from parallel tasks
   */
  aggregateTaskResults(results, task) {
    const successfulResults = results
      .filter(r => r.success)
      .map(r => r.result);

    // Custom aggregation function
    if (task.aggregate && typeof task.aggregate === 'function') {
      return task.aggregate(successfulResults);
    }

    // Aggregation type
    switch (task.aggregationType || 'array') {
      case 'array':
        return successfulResults;
      
      case 'object':
        // Merge objects
        return successfulResults.reduce((acc, result) => {
          if (typeof result === 'object' && result !== null) {
            return { ...acc, ...result };
          }
          return acc;
        }, {});
      
      case 'sum':
        // Sum numeric results
        return successfulResults.reduce((acc, result) => {
          const num = typeof result === 'number' ? result : parseFloat(result);
          return acc + (isNaN(num) ? 0 : num);
        }, 0);
      
      case 'concat':
        // Concatenate arrays
        return successfulResults.reduce((acc, result) => {
          if (Array.isArray(result)) {
            return acc.concat(result);
          }
          return acc;
        }, []);
      
      case 'first':
        // Return first successful result
        return successfulResults[0];
      
      case 'last':
        // Return last successful result
        return successfulResults[successfulResults.length - 1];
      
      case 'all':
        // Return all results including failures
        return results.map(r => r.success ? r.result : { error: r.error });
      
      default:
        return successfulResults;
    }
  }

  /**
   * Estimate execution complexity
   */
  async estimateComplexity(task, context) {
    const subtasks = this.extractSubtasks(task);
    const subtaskCount = subtasks.length;
    
    if (subtaskCount === 0) {
      return {
        estimatedTime: 0,
        estimatedCost: 0,
        confidence: 0,
        reasoning: 'No subtasks found'
      };
    }

    // Estimate individual task complexity
    let totalCost = 0;
    let maxTime = 0;
    let minConfidence = 1;

    for (const subtask of subtasks) {
      const estimate = await this.estimateSubtaskComplexity(subtask, context);
      totalCost += estimate.estimatedCost;
      maxTime = Math.max(maxTime, estimate.estimatedTime);
      minConfidence = Math.min(minConfidence, estimate.confidence);
    }

    // Calculate parallel execution time
    const batchCount = Math.ceil(subtaskCount / this.maxConcurrency);
    const estimatedTime = maxTime * batchCount;

    return {
      estimatedTime,
      estimatedCost: totalCost,
      confidence: minConfidence * 0.9, // Slightly lower confidence for parallel
      reasoning: `Parallel execution of ${subtaskCount} tasks in ${batchCount} batches`
    };
  }

  /**
   * Estimate subtask complexity
   */
  async estimateSubtaskComplexity(subtask, context) {
    // Basic estimates based on task type
    if (subtask.tool || subtask.toolName) {
      return {
        estimatedTime: 500,
        estimatedCost: 0,
        confidence: 0.8
      };
    }

    if (subtask.prompt || subtask.description) {
      return {
        estimatedTime: 2000,
        estimatedCost: 0.001,
        confidence: 0.7
      };
    }

    if (subtask.execute || subtask.fn) {
      return {
        estimatedTime: 100,
        estimatedCost: 0,
        confidence: 0.9
      };
    }

    return {
      estimatedTime: 1000,
      estimatedCost: 0,
      confidence: 0.5
    };
  }

  /**
   * Validate parallel task configuration
   */
  validateParallelTask(task) {
    this.validateTask(task);

    const subtasks = this.extractSubtasks(task);
    if (!subtasks || subtasks.length === 0) {
      throw new Error('Parallel task must have subtasks');
    }

    if (this.maxConcurrency < 1) {
      throw new Error('Max concurrency must be at least 1');
    }

    if (this.timeoutPerTask < 0) {
      throw new Error('Timeout per task must be positive');
    }

    return true;
  }
}