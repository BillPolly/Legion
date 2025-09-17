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

export class AtomicExecutionStrategy extends ExecutionStrategy {
  constructor(injectedDependencies = {}) {
    super(injectedDependencies);
    this.name = 'AtomicExecutionStrategy';
    this.maxRetries = injectedDependencies.maxRetries ?? 3;
    this.retryDelay = injectedDependencies.retryDelay ?? 1000;
    
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
      retryDelay: this.retryDelay
    };
  }

  /**
   * Check if this strategy can handle the task
   */
  canHandle(task, context) {
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

    // Can handle simple prompts that don't need decomposition
    if ((task.prompt || task.description) && !this.requiresDecomposition(task, context)) {
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
      timestamp: new Date().toISOString()
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
          timestamp: new Date().toISOString()
        });
        
        return extractedResult;
      },
      { 
        taskId: this.getTaskId(task),
        toolName,
        emitter 
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
        emitter
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
      timestamp: new Date().toISOString()
    });

    // Emit LLM progress for sending request
    emitter.custom('llm_progress', {
      phase: 'sending_request',
      percentage: 40,
      tokensExpected: requestParams.maxTokens || task.maxTokens,
      model: task.model || 'default'
    });

    // Execute with retries
    return this.executeWithRetries(
      async () => {
        // Emit progress for processing response
        emitter.custom('llm_progress', {
          phase: 'processing_response',
          percentage: 80,
          model: task.model || 'default'
        });

        const response = await this.simplePromptClient.request(requestParams);
        const result = await this.extractLLMResult(response, task);
        
        // Emit completion progress
        emitter.custom('llm_progress', {
          phase: 'completed',
          percentage: 100,
          model: task.model || 'default',
          toolsExecuted: result.toolsExecuted || 0
        });
        
        // Emit LLM response event
        emitter.custom('llm_response', {
          taskId: this.getTaskId(task),
          model: task.model || 'default',
          result: result,
          toolsExecuted: result.toolsExecuted || 0,
          timestamp: new Date().toISOString()
        });
        
        return result;
      },
      {
        taskId: this.getTaskId(task),
        model: task.model || 'default',
        emitter
      }
    );
  }

  /**
   * Execute with retry logic and error recovery
   */
  async executeWithRetries(executeFn, metadata) {
    const { taskId, emitter } = metadata;
    let lastError;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await executeFn();
        
        if (attempt > 1) {
          emitter.custom('retry_success', { 
            attempt,
            maxAttempts: this.maxRetries 
          });
        }
        
        return result;
      } catch (error) {
        lastError = error;
        
        // Attempt error recovery if available
        if (this.errorRecovery && attempt < this.maxRetries) {
          try {
            const recoveryResult = await this.errorRecovery.recover(error, {
              taskId,
              attemptNumber: attempt,
              maxAttempts: this.maxRetries,
              strategy: 'AtomicExecutionStrategy',
              ...metadata
            });
            
            if (recoveryResult.success) {
              if (this.logger) {
                this.logger.info('Error recovery successful for atomic task', {
                  taskId,
                  attempt,
                  recoveryAction: recoveryResult.action
                });
              }
              
              emitter.custom('error_recovery_success', {
                attempt,
                recoveryAction: recoveryResult.action,
                delay: recoveryResult.delay
              });
              
              // Apply recovery delay if specified
              if (recoveryResult.delay) {
                await new Promise(resolve => setTimeout(resolve, recoveryResult.delay));
              }
              
              // Continue to next retry attempt
              continue;
            }
          } catch (recoveryError) {
            if (this.logger) {
              this.logger.warn('Error recovery failed for atomic task', {
                taskId,
                attempt,
                originalError: error.message,
                recoveryError: recoveryError.message
              });
            }
          }
        }
        
        if (attempt < this.maxRetries) {
          emitter.retrying(attempt, this.maxRetries, error.message);
          
          // Calculate delay with exponential backoff
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
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
                  timestamp: new Date().toISOString()
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