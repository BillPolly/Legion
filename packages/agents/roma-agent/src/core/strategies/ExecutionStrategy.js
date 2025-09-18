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

  // ========================================
  // ARTIFACT MANAGEMENT METHODS
  // ========================================

  /**
   * Resolve artifact references in tool inputs
   * Extracts ONLY the value field from artifact records for tool use
   * 
   * @param {Object} inputs - Tool inputs that may contain @artifact_name references
   * @param {ExecutionContext} context - Execution context with artifact registry
   * @returns {Object} - Inputs with artifact references resolved to values
   */
  resolveToolInputs(inputs, context) {
    if (!inputs || typeof inputs !== 'object') {
      return inputs;
    }

    const resolved = {};

    for (const [key, value] of Object.entries(inputs)) {
      if (typeof value === 'string' && value.startsWith('@')) {
        // Artifact reference - get the artifact record
        const artifactName = value.substring(1);
        const artifactRecord = context.getArtifact(artifactName);
        
        if (!artifactRecord) {
          throw new Error(`Artifact not found: @${artifactName}`);
        }
        
        // Extract ONLY the value field (the actual data) from the record
        // Defensive clone prevents callers from mutating stored artifacts
        resolved[key] = this.cloneArtifactValue(artifactRecord.value);
      } else if (Array.isArray(value)) {
        // Recursively resolve arrays
        resolved[key] = value.map(item => 
          typeof item === 'string' && item.startsWith('@') 
            ? this.cloneArtifactValue(context.getArtifactValue(item.substring(1)))
            : item
        );
      } else if (typeof value === 'object' && value !== null) {
        // Recursively resolve nested objects
        resolved[key] = this.resolveToolInputs(value, context);
      } else {
        // Direct value
        resolved[key] = value;
      }
    }

    return resolved;
  }

  /**
   * Clone artifact values to avoid mutation of stored records
   * Uses structuredClone when available with defensive fallbacks
   *
   * @param {any} value - Artifact value to clone
   * @returns {any} - Cloned artifact value
   */
  cloneArtifactValue(value) {
    if (value === null || typeof value !== 'object') {
      return value;
    }

    if (typeof globalThis.structuredClone === 'function') {
      try {
        return structuredClone(value);
      } catch (error) {
        // Fall back to manual cloning below
      }
    }

    if (Buffer.isBuffer?.(value)) {
      return Buffer.from(value);
    }

    if (value instanceof Date) {
      return new Date(value.getTime());
    }

    if (value instanceof Map) {
      return new Map(Array.from(value.entries()).map(([k, v]) => [k, this.cloneArtifactValue(v)]));
    }

    if (value instanceof Set) {
      return new Set(Array.from(value.values()).map(v => this.cloneArtifactValue(v)));
    }

    if (Array.isArray(value)) {
      return value.map(item => this.cloneArtifactValue(item));
    }

    const cloned = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      cloned[key] = this.cloneArtifactValue(nestedValue);
    }
    return cloned;
  }

  /**
   * Execute tool with artifact-aware input resolution and output storage
   * 
   * @param {Object} toolCall - Tool call specification with inputs and outputs
   * @param {ExecutionContext} context - Execution context for artifact storage
   * @returns {Promise<Object>} - Tool execution result
   */
  async executeToolWithArtifacts(toolCall, context) {
    const { tool: toolName, inputs, outputs } = toolCall;
    
    // Step 1: Resolve artifact references in inputs
    // This extracts ONLY the value fields from referenced artifacts
    const resolvedInputs = this.resolveToolInputs(inputs, context);
    
    // Step 2: Get and execute the tool with the extracted VALUES
    const tool = await this.toolRegistry.getTool(toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }
    
    const result = await tool.execute(resolvedInputs);
    
    // Step 3: Create and store NEW artifact records for outputs
    if (outputs && Array.isArray(outputs)) {
      for (const outputSpec of outputs) {
        // Extract the specific output value
        // Tools may return { data: { output1: ..., output2: ... } }
        // or { data: singleValue } or just the value directly
        let outputValue;
        
        if (result.data && typeof result.data === 'object') {
          // Try to get named property from data
          outputValue = result.data[outputSpec.name] || result.data;
        } else if (result.data !== undefined) {
          outputValue = result.data;
        } else {
          outputValue = result;
        }
        
        // Create a NEW artifact record that DESCRIBES this output
        // Each output has its own specific type (file, data, process, etc.)
        const artifactRecord = {
          type: outputSpec.type,  // The SPECIFIC type of THIS output
          value: outputValue,  // THE ACTUAL DATA from the tool
          description: outputSpec.description,  // What this artifact IS
          purpose: outputSpec.purpose || outputSpec.description,  // Why it exists
          timestamp: Date.now(),
          metadata: {
            toolName: toolName,
            success: result.success !== undefined ? result.success : true,
            inputArtifacts: this.extractArtifactReferences(inputs),
            ...result.metadata
          }
        };
        
        // Store the ENTIRE artifact record AS-IS in the Map
        context.addArtifact(outputSpec.name, artifactRecord);
        
        // Add to conversation history with artifact reference
        context.conversationHistory.push({
          role: 'assistant',
          content: `Executed ${toolName} and stored output as @${outputSpec.name}`,
          timestamp: Date.now()
        });
      }
    }
    
    return result;
  }

  /**
   * Format conversation history for LLM prompts
   * 
   * @param {ExecutionContext} context - Execution context with conversation history
   * @param {number} limit - Maximum number of messages to include (default: 10)
   * @returns {string} - Formatted conversation history
   */
  formatConversationHistory(context, limit = 10) {
    const messages = context.conversationHistory.slice(-limit);
    
    if (messages.length === 0) {
      return "No previous conversation.";
    }
    
    return messages.map(msg => {
      const role = msg.role === 'user' ? 'User' : 
                   msg.role === 'assistant' ? 'Assistant' : 'System';
      return `${role}: ${msg.content}`;
    }).join('\n');
  }

  /**
   * Format artifacts catalog for LLM prompts
   * 
   * @param {ExecutionContext} context - Execution context with artifact registry
   * @returns {string} - Formatted artifacts catalog
   */
  formatArtifactsCatalog(context) {
    const artifacts = context.listArtifacts();  // Returns [name, artifactRecord] pairs
    
    if (artifacts.length === 0) {
      return "No artifacts available.";
    }
    
    // Format each artifact record for display (the record itself, NOT destructured)
    const catalog = artifacts.map(([name, artifactRecord]) => {
      // We access properties of the artifact record for DISPLAY only
      // The record itself remains intact in the Map
      const size = this.getArtifactSize(artifactRecord.value);
      return `- @${name} (${artifactRecord.type}): ${artifactRecord.description}\n` +
             `  Purpose: ${artifactRecord.purpose}\n` +
             `  Created: ${new Date(artifactRecord.timestamp).toISOString()}\n` +
             `  Size: ${size}`;
    }).join('\n');
    
    return `Available Artifacts (${artifacts.length}):\n${catalog}`;
  }

  /**
   * Build LLM prompt with two sections: conversation history and artifacts catalog
   * 
   * @param {Object} task - Current task to execute
   * @param {ExecutionContext} context - Execution context
   * @returns {string} - Complete LLM prompt
   */
  buildPrompt(task, context) {
    return `
## Conversation History
${this.formatConversationHistory(context)}

## Available Artifacts
${this.formatArtifactsCatalog(context)}

## Current Task
${task.description}

## Instructions

When you need to use a tool, specify it in this format:
{
  "tool": "tool_name",
  "inputs": {
    "parameter1": "direct value or @artifact_name",
    "parameter2": "@another_artifact"
  },
  "outputs": [
    {
      "name": "output_artifact_name",
      "type": "file|data|process|config|etc",
      "description": "Clear description of what this output is",
      "purpose": "Why this output is needed for the task"
    }
  ]
}

Important:
- Reference existing artifacts using @artifact_name in tool inputs
- Always specify meaningful names for outputs
- Each output MUST have a specific type (file, data, process, config, etc.)
- Include clear descriptions and purposes for outputs
- Artifact names should be descriptive (e.g., "server_config", "user_data", "api_response")

Your response:`;
  }

  /**
   * Extract artifact references from tool inputs (helper method)
   * 
   * @param {Object} inputs - Tool inputs to scan for artifact references
   * @returns {Array<string>} - Array of artifact names referenced
   */
  extractArtifactReferences(inputs) {
    const refs = [];
    const extract = (obj) => {
      if (typeof obj === 'string' && obj.startsWith('@')) {
        refs.push(obj.substring(1));
      } else if (Array.isArray(obj)) {
        obj.forEach(extract);
      } else if (typeof obj === 'object' && obj !== null) {
        Object.values(obj).forEach(extract);
      }
    };
    extract(inputs);
    return refs;
  }

  /**
   * Get human-readable size description for artifact values (helper method)
   * 
   * @param {any} value - Artifact value to describe
   * @returns {string} - Human-readable size description
   */
  getArtifactSize(value) {
    if (value === null || value === undefined) return 'empty';
    if (typeof value === 'string') return `${value.length} chars`;
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (Array.isArray(value)) return `array[${value.length}]`;
    if (typeof value === 'object') {
      const keys = Object.keys(value);
      return `object{${keys.length} keys}`;
    }
    return typeof value;
  }
}
