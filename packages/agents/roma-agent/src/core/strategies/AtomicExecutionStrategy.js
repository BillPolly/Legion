/**
 * AtomicExecutionStrategy - Direct execution without decomposition
 * Handles simple tasks that can be executed directly
 * 
 * Features:
 * - Direct tool execution
 * - LLM prompt execution
 * - Function execution
 * - No decomposition
 * - Result validation
 */

import { ExecutionStrategy } from './ExecutionStrategy.js';
import { ResponseValidator } from '@legion/output-schema';
import { RetryHandler } from '@legion/prompting-manager';
import { RetryManager } from '../retry/RetryManager.js';

export class AtomicExecutionStrategy extends ExecutionStrategy {
  constructor(injectedDependencies = {}) {
    super(injectedDependencies);
    this.name = 'AtomicExecutionStrategy';
    this.maxRetries = injectedDependencies.maxRetries ?? 3;
    this.retryDelay = injectedDependencies.retryDelay ?? 1000;
    this.retryHandler = injectedDependencies.retryHandler || null;
    this.retryManager = injectedDependencies.retryManager || null;
    
    // Initialize ResponseValidator for tool calling (same as Gemini agent)
    this.toolCallSchema = {
      type: 'object',
      properties: {
        response: { type: 'string', description: 'Your response to the user' },
        use_tool: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Tool name to execute' },
            args: { type: 'object', description: 'Tool arguments' }
          },
          required: ['name', 'args']
        },
        use_tools: {
          type: 'array',
          description: 'Array of tools to execute in sequence',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Tool name' },
              args: { type: 'object', description: 'Tool arguments' }
            },
            required: ['name', 'args']
          }
        }
      },
      required: ['response']
    };
    this.responseValidator = new ResponseValidator(this.toolCallSchema);
    
    // Initialize dependencies with injection
    this.initializeDependencies(injectedDependencies);
    this.configureRetrySystems(injectedDependencies);
  }

  /**
   * Initialize dependencies for better testability
   * @param {Object} dependencies - Injected dependencies
   */
  initializeDependencies(dependencies) {
    this.toolRegistry = dependencies.toolRegistry || null;
    this.llmClient = dependencies.llmClient || null;
    this.resourceManager = dependencies.resourceManager || null;
    this.logger = dependencies.logger || null;
    this.errorRecovery = dependencies.errorRecovery || null;
    this.retryHandler = dependencies.retryHandler || this.retryHandler;
    this.retryManager = dependencies.retryManager || this.retryManager;
  }

  /**
   * Configure retry systems (RetryHandler for LLM, RetryManager for tools)
   * @param {Object} dependencies - Optional configuration overrides
   */
  configureRetrySystems(dependencies = {}) {
    const retryMaxAttempts = dependencies.maxRetries ?? this.maxRetries;

    if (!this.retryHandler) {
      this.retryHandler = new RetryHandler({
        maxAttempts: retryMaxAttempts,
        ...(dependencies.llmRetryConfig || dependencies.retryHandlerConfig || {})
      });
    } else if (dependencies.llmRetryConfig || dependencies.retryHandlerConfig) {
      this.retryHandler.updateConfiguration({
        maxAttempts: retryMaxAttempts,
        ...dependencies.llmRetryConfig,
        ...dependencies.retryHandlerConfig
      });
    } else if (this.retryHandler?.updateConfiguration) {
      this.retryHandler.updateConfiguration({ maxAttempts: retryMaxAttempts });
    }

    if (!this.retryManager) {
      this.retryManager = new RetryManager({
        maxAttempts: retryMaxAttempts,
        baseDelay: dependencies.retryDelay ?? this.retryDelay,
        logger: this.logger,
        ...(dependencies.retryManagerOptions || {})
      });
    } else {
      if (dependencies.retryManagerOptions) {
        Object.assign(this.retryManager, dependencies.retryManagerOptions);
      }
      this.retryManager.maxAttempts = retryMaxAttempts;
      if (dependencies.retryDelay !== undefined) {
        this.retryManager.baseDelay = dependencies.retryDelay;
      }
      if (this.logger) {
        this.retryManager.logger = this.logger;
      }
    }

    // Ensure RetryHandler configuration is valid where possible
    if (this.retryHandler?.validateConfiguration) {
      try {
        this.retryHandler.validateConfiguration();
      } catch (error) {
        if (this.logger) {
          this.logger.warn('RetryHandler configuration invalid', { error: error.message });
        }
      }
    }
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
    if (updatedDependencies.maxRetries !== undefined) {
      this.maxRetries = updatedDependencies.maxRetries;
    }
    if (updatedDependencies.retryDelay !== undefined) {
      this.retryDelay = updatedDependencies.retryDelay;
    }
    if (updatedDependencies.retryHandler) {
      this.retryHandler = updatedDependencies.retryHandler;
    }
    if (updatedDependencies.retryManager) {
      this.retryManager = updatedDependencies.retryManager;
    }

    if (updatedDependencies.retryHandlerConfig ||
        updatedDependencies.retryManagerOptions ||
        updatedDependencies.llmRetryConfig ||
        updatedDependencies.maxRetries !== undefined ||
        updatedDependencies.retryDelay !== undefined ||
        updatedDependencies.retryHandler ||
        updatedDependencies.retryManager) {
      this.configureRetrySystems({
        maxRetries: this.maxRetries,
        retryDelay: this.retryDelay,
        retryHandlerConfig: updatedDependencies.retryHandlerConfig,
        llmRetryConfig: updatedDependencies.llmRetryConfig,
        retryManagerOptions: updatedDependencies.retryManagerOptions
      });
    }

    if (this.logger) {
      this.logger.debug('AtomicExecutionStrategy dependencies updated', {
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
      resourceManager: this.resourceManager,
      logger: this.logger,
      errorRecovery: this.errorRecovery,
      maxRetries: this.maxRetries,
      retryDelay: this.retryDelay,
      retryHandler: this.retryHandler,
      retryManager: this.retryManager
    };
  }

  /**
   * Check if this strategy can handle the task
   */
  canHandle(task, context) {
    // Cannot handle tasks explicitly marked for recursive execution
    if (task.recursive === true || task.strategy === 'recursive') {
      return false;
    }

    // Can handle if task is marked as atomic
    if (task.atomic || task.strategy === 'atomic') {
      return true;
    }

    // Can handle if task has a direct tool
    if (task.tool || task.toolName) {
      return true;
    }

    // Can handle if task has a function (we'll validate the type during execution)
    if (task.execute !== undefined || task.fn !== undefined) {
      return true;
    }

    // Can handle simple prompts/descriptions, but reject complex decomposition tasks
    if (task.prompt || task.description) {
      // Check if this is a complex task requiring decomposition
      const text = (task.prompt || task.description || '').toLowerCase();
      const complexityIndicators = [
        'step by step', 'then do', 'first do', 'multiple steps', 'break this down',
        'break down', 'decompose', 'analyze and', 'plan and execute',
        'step 1', 'step 2', 'then', 'after that', 'finally'
      ];
      
      // If task contains complexity indicators, don't handle it atomically
      if (complexityIndicators.some(indicator => text.includes(indicator))) {
        return false;
      }
      
      return true;
    }

    return false;
  }

  /**
   * Execute the task atomically
   */
  async execute(task, context) {
    this.validateTask(task);
    const taskId = this.getTaskId(task);

    return this.executeWithMonitoring(task, context, async (task, ctx, emitter) => {
      // Check if we can handle this task
      if (!this.canHandle(task, ctx)) {
        throw new Error(`AtomicExecutionStrategy cannot handle task: ${taskId}`);
      }

      // Track execution in context
      const executionContext = ctx.withMetadata('strategy', 'atomic');

      // Determine execution type
      const executionType = this.determineExecutionType(task);
      emitter.custom('execution_type', { type: executionType });

      // Execute based on type
      let result;
      switch (executionType) {
        case 'tool':
          result = await this.executeTool(task, executionContext, emitter);
          break;
        case 'function':
          result = await this.executeFunction(task, executionContext, emitter);
          break;
        case 'llm':
          result = await this.executeLLM(task, executionContext, emitter);
          break;
        default:
          throw new Error(`Unknown execution type: ${executionType}`);
      }

      // Validate result
      if (task.outputSchema) {
        this.validateResult(result, task.outputSchema);
      }

      // Store result in context
      const updatedContext = executionContext.withResult(result);

      return result;
    });
  }

  /**
   * Determine how to execute the task
   */
  determineExecutionType(task) {
    if (task.tool || task.toolName) {
      return 'tool';
    }
    if (task.execute !== undefined || task.fn !== undefined) {
      return 'function';
    }
    if (task.prompt || task.description || task.operation) {
      return 'llm';
    }
    throw new Error('Cannot determine execution type for task');
  }

  /**
   * Execute a tool
   */
  async executeTool(task, context, emitter) {
    const toolName = task.tool || task.toolName;
    
    if (!this.toolRegistry) {
      throw new Error('Tool registry not configured');
    }

    emitter.custom('tool_execution_start', { 
      tool: toolName,
      taskId: this.getTaskId(task),
      timestamp: Date.now()
    });

    // Emit progress for tool initialization
    emitter.custom('tool_progress', {
      tool: toolName,
      phase: 'initializing',
      percentage: 30
    });

    // Get the tool
    const tool = await this.toolRegistry.getTool(toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    // Prepare parameters
    const params = this.prepareToolParams(task, context);

    // Execute with retries
    return this.executeWithRetries(
      async () => {
        // Emit progress for tool execution
        emitter.custom('tool_progress', {
          tool: toolName,
          phase: 'executing',
          percentage: 70
        });

        const result = await tool.execute(params);
        const extractedResult = this.extractToolResult(result);
        
        // Emit completion progress
        emitter.custom('tool_progress', {
          tool: toolName,
          phase: 'completed',
          percentage: 100,
          success: !!result.success
        });
        
        // Emit tool completion event with result details
        emitter.custom('tool_execution_complete', {
          tool: toolName,
          taskId: this.getTaskId(task),
          params: params,
          result: extractedResult,
          timestamp: Date.now()
        });
        
        return extractedResult;
      },
      { 
        taskId: this.getTaskId(task),
        toolName,
        emitter,
        operationType: 'tool',
        operationId: `tool:${toolName}`
      }
    );
  }

  /**
   * Execute a function
   */
  async executeFunction(task, context, emitter) {
    const fn = task.execute || task.fn;
    
    if (typeof fn !== 'function') {
      throw new Error('Task function is not callable');
    }

    emitter.custom('function_execution', { 
      hasContext: task.requiresContext,
      isAsync: fn.constructor.name === 'AsyncFunction'
    });

    // Emit function progress for initialization
    emitter.custom('function_progress', {
      function: fn.name || 'anonymous',
      phase: 'initializing',
      percentage: 30
    });

    // Prepare function arguments
    const args = this.prepareFunctionArgs(task, context);

    // Execute with retries
    return this.executeWithRetries(
      async () => {
        // Emit progress for function execution
        emitter.custom('function_progress', {
          function: fn.name || 'anonymous',
          phase: 'executing',
          percentage: 70
        });

        let result;
        if (task.requiresContext) {
          result = await fn(args, context);
        } else {
          result = await fn(args);
        }
        
        // Emit completion progress
        emitter.custom('function_progress', {
          function: fn.name || 'anonymous',
          phase: 'completed',
          percentage: 100
        });
        
        return result;
      },
      {
        taskId: this.getTaskId(task),
        functionName: fn.name || 'anonymous',
        emitter,
        operationType: 'function',
        operationId: `function:${fn.name || 'anonymous'}`
      }
    );
  }

  /**
   * Execute with LLM
   */
  async executeLLM(task, context, emitter) {
    // Ensure we have SimplePromptClient
    if (!this.simplePromptClient) {
      await this.initialize();
      if (!this.simplePromptClient) {
        throw new Error('SimplePromptClient not configured');
      }
    }

    const prompt = task.prompt || task.description || task.operation;
    
    // Build request parameters for SimplePromptClient
    const requestParams = this.buildSimplePromptRequest(task, context, prompt);

    // Emit LLM request event
    emitter.custom('llm_request', {
      taskId: this.getTaskId(task),
      model: task.model || 'default',
      temperature: task.temperature,
      maxTokens: task.maxTokens,
      prompt: prompt,
      toolsAvailable: requestParams.tools?.length || 0,
      timestamp: Date.now()
    });

    // Emit LLM progress for sending request
    emitter.custom('llm_progress', {
      phase: 'sending_request',
      percentage: 40,
      tokensExpected: requestParams.maxTokens || task.maxTokens,
      model: task.model || 'default'
    });

    const basePrompt = requestParams.prompt;

    // Execute with retries (RetryHandler for LLM requests)
    return this.executeWithRetries(
      async ({ attempt = 1, lastAttemptResult }) => {
        const attemptParams = {
          ...requestParams,
          prompt: requestParams.prompt,
          chatHistory: requestParams.chatHistory ? [...requestParams.chatHistory] : undefined,
          tools: requestParams.tools ? [...requestParams.tools] : undefined
        };

        if (attempt > 1 && lastAttemptResult?.errors?.length && this.retryHandler?.generateErrorFeedback) {
          attemptParams.prompt = this.retryHandler.generateErrorFeedback(lastAttemptResult.errors, basePrompt);
          emitter.custom('llm_progress', {
            phase: 'retry_feedback_applied',
            percentage: 60,
            model: task.model || 'default',
            attempt,
            errors: lastAttemptResult.errors.map(error => error.message)
          });
        }

        // Emit progress for processing response
        emitter.custom('llm_progress', {
          phase: 'processing_response',
          percentage: 80,
          model: task.model || 'default',
          attempt
        });

        const response = await this.simplePromptClient.request(attemptParams);
        const result = await this.extractLLMResult(response, task);
        
        // Emit completion progress
        emitter.custom('llm_progress', {
          phase: 'completed',
          percentage: 100,
          model: task.model || 'default',
          toolsExecuted: result.toolsExecuted || 0,
          attempt
        });
        
        // Emit LLM response event
        emitter.custom('llm_response', {
          taskId: this.getTaskId(task),
          model: task.model || 'default',
          result: result,
          toolsExecuted: result.toolsExecuted || 0,
          timestamp: Date.now(),
          attempt
        });
        
        return result;
      },
      {
        taskId: this.getTaskId(task),
        model: task.model || 'default',
        emitter,
        operationType: 'llm',
        operationId: `llm:${task.model || 'default'}`
      },
      {
        strategy: 'handler',
        maxAttempts: task.maxRetries || this.maxRetries
      }
    );
  }

  /**
   * Execute with retry logic using appropriate retry mechanism
   */
  async executeWithRetries(executeFn, metadata = {}, options = {}) {
    const strategy = options.strategy || (metadata.operationType === 'llm' ? 'handler' : 'manager');

    if (strategy === 'handler') {
      return this.executeWithRetryHandler(executeFn, metadata, options);
    }

    return this.executeWithRetryManager(executeFn, metadata, options);
  }

  /**
   * Retry workflow for tool/function execution using RetryManager
   */
  async executeWithRetryManager(executeFn, metadata = {}, options = {}) {
    const emitter = metadata.emitter;
    const retryManager = this.retryManager;
    const maxAttempts = options.maxAttempts || retryManager?.maxAttempts || this.maxRetries;
    const operationId = metadata.operationId || metadata.toolName || metadata.functionName || metadata.taskId || 'atomic-operation';

    let lastError = null;
    let lastAttemptResult = null;

    if (retryManager && await retryManager.isCircuitOpen(operationId)) {
      const circuitError = new Error(`Circuit breaker is open for operation: ${operationId}`);
      circuitError.code = 'CIRCUIT_OPEN';
      throw circuitError;
    }

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await executeFn({ attempt, lastAttemptResult });
        if (attempt > 1) {
          emitter?.custom?.('retry_success', {
            attempt,
            maxAttempts
          });
        }
        retryManager?.recordSuccess(operationId);
        return result;
      } catch (error) {
        lastError = error;
        const errorType = retryManager?.classifyError ? retryManager.classifyError(error) : 'unknown';
        lastAttemptResult = { error, errorType };
        retryManager?.recordFailure(operationId);

        const canRetry = retryManager
          ? retryManager.shouldRetry(error, attempt, errorType)
          : attempt < maxAttempts;

        if (this.errorRecovery && attempt < maxAttempts) {
          try {
            const recoveryResult = await this.errorRecovery.recover(error, {
              ...metadata,
              attemptNumber: attempt,
              maxAttempts,
              errorType,
              strategy: this.name
            });

            if (recoveryResult.success) {
              if (this.logger) {
                this.logger.info('Error recovery successful for atomic task', {
                  taskId: metadata.taskId,
                  attempt,
                  recoveryAction: recoveryResult.action
                });
              }

              emitter?.custom?.('error_recovery_success', {
                attempt,
                recoveryAction: recoveryResult.action,
                delay: recoveryResult.delay
              });

              if (recoveryResult.delay) {
                await this.delay(recoveryResult.delay);
              }
            }
          } catch (recoveryError) {
            if (this.logger) {
              this.logger.warn('Error recovery failed for atomic task', {
                taskId: metadata.taskId,
                attempt,
                originalError: error.message,
                recoveryError: recoveryError.message
              });
            }
          }
        }

        if (!canRetry || attempt >= maxAttempts) {
          break;
        }

        emitter?.retrying(attempt, maxAttempts, error.message);

        let delayMs = this.retryDelay * Math.pow(2, attempt - 1);
        if (retryManager) {
          const policyMap = retryManager.retryPolicies || new Map();
          const policy = policyMap.get(errorType) || policyMap.get('unknown');
          delayMs = retryManager.calculateDelay(
            attempt,
            policy?.baseDelay ?? retryManager.baseDelay,
            policy?.backoffFactor ?? retryManager.backoffFactor ?? 2
          );
        }

        await this.delay(delayMs);
      }
    }

    throw lastError;
  }

  /**
   * Retry workflow for LLM execution using RetryHandler
   */
  async executeWithRetryHandler(executeFn, metadata = {}, options = {}) {
    if (!this.retryHandler || typeof this.retryHandler.executeWithRetry !== 'function') {
      const result = await executeFn({ attempt: 1, lastAttemptResult: null });
      return result;
    }

    const emitter = metadata.emitter;
    const maxAttempts = options.maxAttempts || this.retryHandler.config?.maxAttempts || this.maxRetries;

    if (typeof this.retryHandler.updateConfiguration === 'function') {
      this.retryHandler.updateConfiguration({ maxAttempts });
    }

    if (typeof this.retryHandler.reset === 'function') {
      this.retryHandler.reset();
    }

    let lastCaughtError = null;

    const retryResult = await this.retryHandler.executeWithRetry(async (attempt, lastAttemptResult) => {
      try {
        const value = await executeFn({ attempt, lastAttemptResult });
        if (attempt > 1) {
           emitter?.custom?.('retry_success', { attempt, maxAttempts });
        }
        return {
          success: true,
          data: value,
          metadata: {
            attempt
          }
        };
      } catch (error) {
        lastCaughtError = error;
        const errorType = this.retryManager?.classifyError ? this.retryManager.classifyError(error) : 'unknown';

        if (this.errorRecovery && attempt < maxAttempts) {
          try {
            const recoveryResult = await this.errorRecovery.recover(error, {
              ...metadata,
              attemptNumber: attempt,
              maxAttempts,
              errorType,
              strategy: this.name
            });

            if (recoveryResult.success) {
              emitter?.custom?.('error_recovery_success', {
                attempt,
                recoveryAction: recoveryResult.action,
                delay: recoveryResult.delay
              });

              if (recoveryResult.delay) {
                await this.delay(recoveryResult.delay);
              }
            }
          } catch (recoveryError) {
            if (this.logger) {
              this.logger.warn('Error recovery failed for LLM execution', {
                taskId: metadata.taskId,
                attempt,
                originalError: error.message,
                recoveryError: recoveryError.message
              });
            }
          }
        }

        emitter?.retrying(attempt, maxAttempts, error.message);

        return {
          success: false,
          errors: [{
            message: error.message,
            type: errorType
          }],
          metadata: {
            attempt,
            errorType
          }
        };
      }
    }, { maxAttempts });

    if (retryResult.success) {
      return retryResult.data;
    }

    if (lastCaughtError) {
      throw lastCaughtError;
    }

    throw new Error('LLM execution failed after retries');
  }

  /**
   * Helper to await for a specified duration
   */
  async delay(durationMs) {
    return new Promise(resolve => setTimeout(resolve, durationMs));
  }

  /**
   * Prepare tool parameters
   */
  prepareToolParams(task, context) {
    const params = {
      ...task.params,
      ...task.parameters,
      ...task.inputs
    };

    // Add context data if needed
    if (task.includeContext) {
      params.context = {
        taskId: context.taskId,
        sessionId: context.sessionId,
        depth: context.depth,
        previousResults: context.previousResults,
        sharedState: context.getAllSharedState()
      };
    }

    // Resolve parameter references
    return this.resolveParameterReferences(params, context);
  }

  /**
   * Prepare function arguments
   */
  prepareFunctionArgs(task, context) {
    if (task.args !== undefined) {
      return task.args;
    }

    if (task.params !== undefined) {
      return task.params;
    }

    if (task.inputs !== undefined) {
      return task.inputs;
    }

    // Default to task itself minus the function
    const { execute, fn, ...args } = task;
    return args;
  }

  /**
   * Build SimplePromptClient request parameters with proper tool integration
   */
  buildSimplePromptRequest(task, context, prompt) {
    const params = {
      prompt: prompt || task.prompt || task.description || task.operation,
      maxTokens: task.maxTokens || 1000,
      temperature: task.temperature
    };

    // Add system prompt with tool usage instructions
    let systemPrompt = task.systemPrompt || task.systemMessage || context.userContext?.systemPrompt || 'You are a helpful assistant.';
    
    // Add ResponseValidator format instructions for proper tool usage
    if (this.responseValidator) {
      const formatInstructions = this.responseValidator.generateInstructions({
        response: "I understand and will help you.",
        use_tool: {
          name: "file_write",
          args: { filePath: "/path/to/file.txt", content: "example content" }
        }
      });
      systemPrompt += '\n\n' + formatInstructions;
    }
    
    params.systemPrompt = systemPrompt;

    // Add chat history if provided
    if (task.messages && Array.isArray(task.messages)) {
      params.chatHistory = task.messages;
    }

    // Add context from previous results if needed
    if (task.includeHistory && context.previousResults.length > 0) {
      const historyMessage = this.buildHistoryMessage(context.previousResults);
      params.chatHistory = params.chatHistory || [];
      params.chatHistory.push({
        role: 'assistant',
        content: historyMessage
      });
    }

    // Add tools - CRITICAL: Automatically include all available tools
    if (task.tools && Array.isArray(task.tools)) {
      params.tools = task.tools;
    } else {
      // Get all available tools from registry (like Gemini agent does)
      params.tools = this.getAvailableToolsForLLM();
    }

    // Add any additional LLM options
    if (task.llmOptions) {
      Object.assign(params, task.llmOptions);
    }

    // Enrich prompt with context
    if (params.prompt) {
      params.prompt = this.enrichPrompt(params.prompt, context);
    }

    return params;
  }


  /**
   * Build history message from previous results
   */
  buildHistoryMessage(previousResults) {
    const relevant = previousResults.slice(-3); // Last 3 results
    return relevant.map((result, index) => 
      `Previous Result ${index + 1}: ${JSON.stringify(result)}`
    ).join('\n');
  }

  /**
   * Enrich prompt with context
   */
  enrichPrompt(prompt, context) {
    let enriched = prompt;

    // Replace context variables
    const variables = {
      taskId: context.taskId,
      sessionId: context.sessionId,
      depth: context.depth,
      ...context.getAllSharedState()
    };

    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      enriched = enriched.replace(regex, value);
    });

    return enriched;
  }

  /**
   * Resolve parameter references
   */
  resolveParameterReferences(params, context) {
    if (!params || typeof params !== 'object') {
      return params;
    }

    const resolved = {};
    
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string' && value.startsWith('$')) {
        // Reference to context or previous result
        const path = value.slice(1);
        resolved[key] = this.resolveReference(path, context);
      } else if (typeof value === 'object' && value !== null) {
        // Recursively resolve nested objects
        resolved[key] = this.resolveParameterReferences(value, context);
      } else {
        resolved[key] = value;
      }
    }

    return resolved;
  }

  /**
   * Resolve a reference path
   */
  resolveReference(path, context) {
    const parts = path.split('.');
    
    if (parts[0] === 'context') {
      return this.getNestedValue(context, parts.slice(1));
    }
    
    if (parts[0] === 'previous') {
      const index = parseInt(parts[1]) || 0;
      const result = context.previousResults[context.previousResults.length - 1 - index];
      if (parts.length > 2) {
        return this.getNestedValue(result, parts.slice(2));
      }
      return result;
    }
    
    if (parts[0] === 'shared') {
      return context.getSharedState(parts[1]);
    }

    // Check if it's a dependency reference
    if (context.hasDependency(parts[0])) {
      const dep = context.getDependency(parts[0]);
      if (parts.length > 1) {
        return this.getNestedValue(dep, parts.slice(1));
      }
      return dep;
    }

    return null;
  }

  /**
   * Get nested value from object
   */
  getNestedValue(obj, path) {
    return path.reduce((current, key) => {
      return current?.[key];
    }, obj);
  }

  /**
   * Extract result from tool execution
   */
  extractToolResult(toolResult) {
    if (!toolResult) {
      return null;
    }

    // Standard tool result format
    if (toolResult.success !== undefined) {
      if (!toolResult.success) {
        throw new Error(toolResult.error || 'Tool execution failed');
      }
      // Return the actual result value, even if it's null/undefined
      if ('result' in toolResult) {
        return toolResult.result;
      }
      if ('data' in toolResult) {
        return toolResult.data;
      }
      return toolResult;
    }

    // Direct result
    return toolResult;
  }

  /**
   * Get available tools for LLM in SimplePromptClient format
   */
  getAvailableToolsForLLM() {
    if (!this.toolRegistry) {
      return [];
    }

    try {
      // Get tools from tool registry (synchronous method)
      const tools = this.toolRegistry.getAllTools();
      
      // Convert to SimplePromptClient format (same as Gemini agent)
      return tools.map(tool => ({
        name: tool.name || tool.toolName,
        description: tool.description || `Execute ${tool.name}`,
        parameters: tool.inputSchema || {
          type: 'object',
          properties: {},
          additionalProperties: true
        }
      }));
    } catch (error) {
      if (this.logger) {
        this.logger.warn('Failed to get available tools for LLM', { error: error.message });
      }
      return [];
    }
  }

  /**
   * Extract result from LLM response with proper tool call handling
   */
  async extractLLMResult(response, task) {
    if (!response) {
      throw new Error('No response from LLM');
    }

    // Extract content based on response format
    let content;
    if (typeof response === 'string') {
      content = response;
    } else if (response.content) {
      content = response.content;
    } else if (response.choices?.[0]?.message?.content) {
      content = response.choices[0].message.content;
    } else if (response.text) {
      content = response.text;
    } else {
      throw new Error('Cannot extract content from LLM response');
    }

    // Process response through ResponseValidator for tool call detection
    if (this.responseValidator && this.toolRegistry) {
      const validationResult = this.responseValidator.process(content);
      
      if (validationResult.success && (validationResult.data.use_tool || validationResult.data.use_tools)) {
        // Execute tool calls (same pattern as Gemini agent)
        const toolCalls = validationResult.data.use_tools || [validationResult.data.use_tool];
        
        let finalContent = validationResult.data.response || content;
        const toolResults = [];
        
        for (const toolCall of toolCalls) {
          try {
            // Get tool from registry
            const tool = await this.toolRegistry.getTool(toolCall.name);
            if (!tool) {
              throw new Error(`Tool '${toolCall.name}' not found`);
            }
            
            // Execute tool
            const result = await tool.execute(toolCall.args);
            toolResults.push({
              name: toolCall.name,
              args: toolCall.args,
              result: result
            });
            
            // Check for file creation and emit specific event
            if (toolCall.name === 'file_write' && result.success && toolCall.args.filepath) {
              // File creation event for UI visibility
              if (this.progressEmitter) {
                this.progressEmitter.custom('file_created', {
                  filepath: toolCall.args.filepath,
                  content: toolCall.args.content,
                  size: toolCall.args.content?.length || 0,
                  timestamp: Date.now()
                });
              }
            }
            
            // Append tool result to content
            const resultSummary = this.extractToolResult(result);
            finalContent += `\n\n🔧 ${toolCall.name} executed: ${JSON.stringify(resultSummary)}`;
            
          } catch (error) {
            toolResults.push({
              name: toolCall.name,
              args: toolCall.args,
              error: error.message
            });
            finalContent += `\n\n❌ ${toolCall.name} failed: ${error.message}`;
          }
        }
        
        return {
          content: finalContent,
          toolResults: toolResults,
          toolsExecuted: toolResults.length
        };
      }
      
      // Return validated response even if no tools were used
      if (validationResult.success) {
        return validationResult.data.response || content;
      }
    }

    // Parse if JSON is expected (fallback)
    if (task.expectJSON || task.parseJSON) {
      try {
        return JSON.parse(content);
      } catch (error) {
        throw new Error(`Failed to parse JSON from LLM response: ${error.message}`);
      }
    }

    // Parse if specific format is expected (fallback)
    if (task.parseFormat) {
      return this.parseFormat(content, task.parseFormat);
    }

    return content;
  }

  /**
   * Parse content based on format
   */
  parseFormat(content, format) {
    switch (format) {
      case 'lines':
        return content.split('\n').filter(line => line.trim());
      case 'csv':
        return content.split('\n').map(line => line.split(','));
      case 'list':
        // Split by list markers and filter out empty items
        const items = content.split(/\n?[-*]\s+/);
        return items.filter(item => item.trim()).map(item => item.trim());
      case 'number':
        return parseFloat(content);
      case 'boolean':
        return content.toLowerCase() === 'true' || content.toLowerCase() === 'yes';
      default:
        return content;
    }
  }

  /**
   * Validate result against schema
   */
  validateResult(result, schema) {
    // This would integrate with a schema validation library
    // For now, basic validation
    if (schema.required && !result) {
      throw new Error('Result is required but was null/undefined');
    }

    if (schema.type) {
      const actualType = Array.isArray(result) ? 'array' : typeof result;
      if (actualType !== schema.type) {
        throw new Error(`Result type mismatch. Expected ${schema.type}, got ${actualType}`);
      }
    }

    if (schema.properties && typeof result === 'object') {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (propSchema.required && !(key in result)) {
          throw new Error(`Required property missing: ${key}`);
        }
      }
    }
  }

  /**
   * Get task ID from task object
   */
  getTaskId(task) {
    return task.id || task.taskId || `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Estimate execution complexity
   */
  async estimateComplexity(task, context) {
    const executionType = this.determineExecutionType(task);
    
    let estimatedTime = 0;
    let estimatedCost = 0;
    let confidence = 0.8;

    switch (executionType) {
      case 'tool':
        estimatedTime = 100; // Base tool execution time
        if (task.tool?.includes('api') || task.tool?.includes('http')) {
          estimatedTime = 500; // Network calls take longer
        }
        confidence = 0.9;
        break;

      case 'function':
        estimatedTime = 50; // Function execution is fast
        confidence = 0.95;
        break;

      case 'llm':
        estimatedTime = 2000; // LLM calls are slower
        estimatedCost = 0.001; // Token costs
        if (task.model?.includes('gpt-4')) {
          estimatedCost = 0.01;
        }
        confidence = 0.7; // LLM timing is less predictable
        break;
    }

    // Adjust for retries
    if (this.maxRetries > 1) {
      estimatedTime *= 1.5; // Account for potential retries
      confidence *= 0.9;
    }

    return {
      estimatedTime,
      estimatedCost,
      confidence,
      reasoning: `Atomic execution via ${executionType}`
    };
  }
}
