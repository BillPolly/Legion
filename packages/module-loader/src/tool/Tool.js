import ToolResult from './ToolResult.js';

/**
 * Base class for all tools in the jsEnvoy system
 * Provides standard interface for function calling format
 */
class Tool {
  constructor() {
    this.name = '';
    this.description = '';
    this.module = null; // Reference to parent module for event emission
  }

  /**
   * Returns the tool description in standard function calling format
   * MUST include output schema defining success and failure data structures
   * @returns {Object} Tool description object with the following structure:
   * {
   *   type: 'function',
   *   function: {
   *     name: string,
   *     description: string,
   *     parameters: { ... },  // Input schema
   *     output: {             // Output schema (REQUIRED)
   *       success: { ... },   // Schema for successful execution
   *       failure: { ... }    // Schema for failed execution
   *     }
   *   }
   * }
   */
  getToolDescription() {
    throw new Error('getToolDescription() must be implemented by subclass');
  }

  /**
   * Invokes the tool with the given tool call from the LLM
   * MUST return a ToolResult instance (never throw exceptions)
   * @param {Object} toolCall - The tool call object from the LLM
   * @param {string} toolCall.id - Unique identifier for this tool call
   * @param {string} toolCall.type - Should be "function"
   * @param {Object} toolCall.function - Function details
   * @param {string} toolCall.function.name - Name of the function to call
   * @param {string} toolCall.function.arguments - JSON string of arguments
   * @returns {Promise<ToolResult>} ToolResult with success/failure status and data
   */
  async invoke(toolCall) {
    throw new Error('invoke() must be implemented by subclass');
  }

  /**
   * Safe wrapper for invoke that guarantees a ToolResult is returned
   * Catches any exceptions from poorly implemented tools
   * @param {Object} toolCall - The tool call object
   * @returns {Promise<ToolResult>} Always returns a ToolResult
   */
  async safeInvoke(toolCall) {
    try {
      const result = await this.invoke(toolCall);
      
      // Ensure we got a ToolResult
      if (!(result instanceof ToolResult)) {
        console.warn(`Tool ${this.name} did not return a ToolResult, wrapping response`);
        // Try to interpret the result
        if (result && typeof result === 'object' && 'success' in result) {
          return new ToolResult(result.success, result.data || {}, result.error);
        }
        // Assume success if we got a result
        return ToolResult.success({ result });
      }
      
      // Validate against output schema if available
      const toolDesc = this.getToolDescription();
      if (toolDesc?.function?.output) {
        result.validate(toolDesc.function.output);
      }
      
      return result;
    } catch (error) {
      // Tool threw an exception - wrap it in a failure
      console.error(`Tool ${this.name} threw an exception:`, error);
      return ToolResult.failure(
        error.message || 'Tool execution failed',
        { 
          toolName: this.name,
          errorType: 'exception',
          stack: error.stack
        }
      );
    }
  }

  /**
   * Helper method to create a successful tool response
   * @param {string} toolCallId - The tool call ID
   * @param {string} functionName - The function name
   * @param {*} content - The response content (will be JSON stringified)
   * @returns {Object} Tool response object
   */
  createSuccessResponse(toolCallId, functionName, content) {
    return {
      tool_call_id: toolCallId,
      role: 'tool',
      name: functionName,
      content: typeof content === 'string' ? content : JSON.stringify(content)
    };
  }

  /**
   * Helper method to create an error tool response
   * @param {string} toolCallId - The tool call ID
   * @param {string} functionName - The function name
   * @param {Error|string} error - The error to report
   * @returns {Object} Tool response object
   */
  createErrorResponse(toolCallId, functionName, error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      tool_call_id: toolCallId,
      role: 'tool',
      name: functionName,
      content: JSON.stringify({ error: errorMessage })
    };
  }

  /**
   * Converts a ToolResult to OpenAI tool response format
   * @param {string} toolCallId - The tool call ID
   * @param {string} functionName - The function name
   * @param {ToolResult} toolResult - The tool result
   * @returns {Object} OpenAI format tool response
   */
  toolResultToResponse(toolCallId, functionName, toolResult) {
    if (!(toolResult instanceof ToolResult)) {
      throw new Error('toolResult must be an instance of ToolResult');
    }

    const responseData = {
      success: toolResult.success,
      data: toolResult.data
    };

    if (!toolResult.success && toolResult.error) {
      responseData.error = toolResult.error;
    }

    return {
      tool_call_id: toolCallId,
      role: 'tool',
      name: functionName,
      content: JSON.stringify(responseData)
    };
  }

  /**
   * Helper method to parse and validate tool call arguments
   * @param {string} argumentsJson - JSON string of arguments
   * @returns {Object} Parsed arguments
   * @throws {Error} If arguments are invalid JSON
   */
  parseArguments(argumentsJson) {
    try {
      return JSON.parse(argumentsJson);
    } catch (error) {
      throw new Error(`Invalid JSON arguments: ${error.message}`);
    }
  }

  /**
   * Helper method to validate required parameters
   * @param {Object} args - The arguments object
   * @param {string[]} required - Array of required parameter names
   * @throws {Error} If required parameters are missing
   */
  validateRequiredParameters(args, required) {
    const missing = required.filter(param => !(param in args));
    if (missing.length > 0) {
      throw new Error(`Missing required parameters: ${missing.join(', ')}`);
    }
  }

  /**
   * Execute method for CLI compatibility
   * Adapts simple arguments to the OpenAI function calling format
   * @param {Object} args - Simple key-value arguments
   * @param {string} functionName - Optional function name for multi-function tools
   * @returns {Promise<*>} The result of the tool execution
   */
  async execute(args, functionName = null) {
    // If no function name provided, get it from the tool description
    if (!functionName) {
      const toolDesc = this.getToolDescription();
      functionName = toolDesc.function.name;
    }
    
    // Create a mock tool call in OpenAI format
    const toolCall = {
      id: `cli-${Date.now()}`,
      type: 'function',
      function: {
        name: functionName,
        arguments: JSON.stringify(args)
      }
    };
    
    // Use safeInvoke to ensure we get a ToolResult
    const toolResult = await this.safeInvoke(toolCall);
    
    // For CLI compatibility, throw on failure
    if (!toolResult.success) {
      throw new Error(toolResult.error || 'Tool execution failed');
    }
    
    // Return the data directly for CLI use
    return toolResult.data;
  }

  /**
   * Set the parent module for event emission
   * @param {Module} module - The parent module instance
   */
  setModule(module) {
    this.module = module;
  }

  /**
   * Emit an event through the parent module
   * @param {string} type - Event type: 'progress', 'warning', 'error', 'info'
   * @param {string} message - Human readable message
   * @param {Object} data - Optional structured data
   * @param {string} level - Optional priority level: 'low', 'medium', 'high'
   */
  emitEvent(type, message, data = {}, level = 'medium') {
    if (this.module && typeof this.module.emitEvent === 'function') {
      this.module.emitEvent(type, message, data, this.name, level);
    }
  }

  /**
   * Emit a progress event
   * @param {string} message - Progress message
   * @param {Object} data - Optional progress data (percentage, step, etc.)
   */
  emitProgress(message, data = {}) {
    this.emitEvent('progress', message, data, 'low');
  }

  /**
   * Emit a warning event
   * @param {string} message - Warning message
   * @param {Object} data - Optional warning data
   */
  emitWarning(message, data = {}) {
    this.emitEvent('warning', message, data, 'medium');
  }

  /**
   * Emit an error event
   * @param {string} message - Error message
   * @param {Object} data - Optional error data
   */
  emitError(message, data = {}) {
    this.emitEvent('error', message, data, 'high');
  }

  /**
   * Emit an info event
   * @param {string} message - Info message
   * @param {Object} data - Optional info data
   */
  emitInfo(message, data = {}) {
    this.emitEvent('info', message, data, 'low');
  }
}

export default Tool;