/**
 * ExecutionStrategy - Base class for all execution strategies
 * Defines the interface for task execution patterns
 * 
 * Each strategy implements a different execution pattern:
 * - Atomic: Direct execution without decomposition
 * - Parallel: Execute multiple tasks concurrently
 * - Sequential: Execute tasks one after another
 * - Recursive: Decompose and execute hierarchically
 */

export class ExecutionStrategy {
  constructor(options = {}) {
    this.name = this.constructor.name;
    this.taskQueue = options.taskQueue;
    this.executionLog = options.executionLog;
    this.progressStream = options.progressStream;
    this.llmClient = options.llmClient;
    this.simplePromptClient = options.simplePromptClient;
    this.toolRegistry = options.toolRegistry;
    this.options = options;
    
    // Log warning if toolRegistry not provided
    if (!this.toolRegistry) {
      console.warn(`ExecutionStrategy (${this.name}): toolRegistry not provided in constructor`);
    }
  }

  /**
   * Initialize the strategy
   */
  async initialize() {
    // Ensure toolRegistry is available
    if (!this.toolRegistry) {
      await this.getToolRegistry();
    }
    
    // Create SimplePromptClient if not provided but llmClient exists
    if (!this.simplePromptClient && this.llmClient) {
      const { SimplePromptClient } = await import('@legion/llm-client');
      this.simplePromptClient = new SimplePromptClient({
        llmClient: this.llmClient
      });
    }
    // Override in subclasses if needed
  }

  /**
   * Check if this strategy can handle the given task
   * @param {Object} task - Task to evaluate
   * @param {ExecutionContext} context - Execution context
   * @returns {boolean} - Whether strategy can handle the task
   */
  canHandle(task, context) {
    throw new Error('canHandle must be implemented by subclass');
  }

  /**
   * Execute the task using this strategy
   * @param {Object} task - Task to execute
   * @param {ExecutionContext} context - Execution context
   * @returns {Promise<Object>} - Execution result
   */
  async execute(task, context) {
    throw new Error('execute must be implemented by subclass');
  }

  /**
   * Estimate complexity/cost of execution
   * @param {Object} task - Task to evaluate
   * @param {ExecutionContext} context - Execution context
   * @returns {Object} - Complexity metrics
   */
  async estimateComplexity(task, context) {
    return {
      estimatedTime: 0,
      estimatedCost: 0,
      confidence: 0,
      reasoning: 'Not implemented'
    };
  }

  /**
   * Get tool registry with fallback initialization
   * @returns {Promise<ToolRegistry>} The tool registry instance
   */
  async getToolRegistry() {
    if (!this.toolRegistry) {
      // Try to get from singleton as fallback
      try {
        const { ToolRegistry } = await import('@legion/tools-registry');
        this.toolRegistry = await ToolRegistry.getInstance();
        console.warn(`ExecutionStrategy (${this.name}): Retrieved toolRegistry from singleton fallback`);
      } catch (error) {
        console.error(`ExecutionStrategy (${this.name}): Failed to get toolRegistry from singleton:`, error.message);
      }
    }
    return this.toolRegistry;
  }

  /**
   * Log event to execution log
   */
  logEvent(type, taskId, payload = {}) {
    if (this.executionLog) {
      return this.executionLog.append({
        type,
        taskId,
        payload: {
          ...payload,
          strategy: this.name
        }
      });
    }
  }

  /**
   * Emit progress event
   */
  emitProgress(taskId, status, details = {}) {
    if (this.progressStream) {
      this.progressStream.emit(taskId, {
        status,
        strategy: this.name,
        message: details.message || details.description || `${status} - ${this.name}`,
        percentage: details.percentage || details.progress || 0,
        ...details
      });
    }
  }

  /**
   * Create task emitter for progress tracking
   */
  createProgressEmitter(taskId) {
    if (this.progressStream) {
      return this.progressStream.createTaskEmitter(taskId);
    }
    // Return dummy emitter if no progress stream
    return {
      emit: () => {},
      progress: () => {},
      started: () => {},
      evaluating: () => {},
      decomposing: () => {},
      executing: () => {},
      aggregating: () => {},
      completed: () => {},
      failed: () => {},
      retrying: () => {},
      custom: () => {}
    };
  }

  /**
   * Add task to queue with proper configuration
   */
  async queueTask(taskFn, metadata = {}) {
    if (this.taskQueue) {
      return this.taskQueue.add(taskFn, {
        ...metadata,
        strategy: this.name
      });
    }
    // Direct execution if no queue
    return taskFn();
  }

  /**
   * Validate task structure
   */
  validateTask(task) {
    if (!task) {
      throw new Error('Task is required');
    }
    if (!task.id && !task.taskId) {
      throw new Error('Task must have an id or taskId');
    }
    // Allow tasks that have tool, function, content, or composite structure (subtasks, operations, steps, etc.)
    // Also allow tasks that are marked as sequential/parallel/atomic as they may have steps defined elsewhere
    if (!task.description && !task.operation && !task.prompt && 
        !task.tool && !task.toolName && 
        !task.execute && !task.fn &&
        !task.subtasks && !task.operations && !task.steps && !task.sequence && 
        !task.pipeline && !task.workflow && !task.batch && !task.map &&
        !task.parallel && !task.concurrent && !task.data &&
        !task.sequential && !task.atomic && task.strategy !== 'sequential' && 
        task.strategy !== 'parallel' && task.strategy !== 'atomic') {
      throw new Error('Task must have executable content (description, operation, prompt, tool, function) or composite structure (subtasks, operations, steps, etc.)');
    }
    return true;
  }

  /**
   * Extract task ID from various task formats
   */
  getTaskId(task) {
    return task.id || task.taskId || this.generateTaskId();
  }

  /**
   * Generate unique task ID
   */
  generateTaskId() {
    return `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Format result for consistency
   */
  formatResult(result, metadata = {}) {
    return {
      success: true,
      result,
      metadata: {
        strategy: this.name,
        timestamp: Date.now(),
        ...metadata
      }
    };
  }

  /**
   * Format error for consistency
   */
  formatError(error, metadata = {}) {
    return {
      success: false,
      error: error.message || error,
      errorStack: error.stack,
      metadata: {
        strategy: this.name,
        timestamp: Date.now(),
        ...metadata
      }
    };
  }

  /**
   * Create execution wrapper with logging and progress
   */
  async executeWithMonitoring(task, context, executeFn, options = {}) {
    const taskId = this.getTaskId(task);
    const emitter = this.createProgressEmitter(taskId);
    
    try {
      // Log start
      this.logEvent('TASK_STARTED', taskId, {
        strategy: this.name,
        depth: context.depth
      });
      emitter.started({ strategy: this.name });

      // Execute
      const result = await executeFn(task, context, emitter);

      // Log completion
      this.logEvent('TASK_COMPLETED', taskId, { result });
      emitter.completed(result);

      return this.formatResult(result, {
        taskId,
        executionTime: context.getElapsedTime()
      });

    } catch (error) {
      // Log failure
      this.logEvent('TASK_FAILED', taskId, {
        error: error.message,
        stack: error.stack
      });
      emitter.failed(error);

      // Re-throw if not configured to return errors
      if (!options.returnErrors) {
        throw error;
      }

      return this.formatError(error, {
        taskId,
        executionTime: context.getElapsedTime()
      });
    }
  }

  /**
   * Check if result indicates success
   */
  isSuccessResult(result) {
    if (!result) return false;
    if (typeof result === 'object' && 'success' in result) {
      return result.success;
    }
    return true; // Assume success if no explicit failure
  }

  /**
   * Extract actual result value
   */
  extractResultValue(result) {
    if (!result) return null;
    if (typeof result === 'object' && 'result' in result) {
      return result.result;
    }
    if (typeof result === 'object' && 'data' in result) {
      return result.data;
    }
    return result;
  }
}