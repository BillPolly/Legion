/**
 * ActionNode - Executes atomic tools from the ToolRegistry
 * 
 * Features:
 * - Bridge between BT coordination and atomic tool execution
 * - Parameter resolution with context substitution
 * - Result transformation and error handling
 * - Tool caching and performance optimization
 */

import { BehaviorTreeNode, NodeStatus } from '../core/BehaviorTreeNode.js';

export class ActionNode extends BehaviorTreeNode {
  static getTypeName() {
    return 'action';
  }

  constructor(config, toolRegistry, executor) {
    super(config, toolRegistry, executor);
    
    // Validate configuration
    if (!config.tool) {
      throw new Error('ActionNode requires tool specification');
    }
    
    this.toolName = config.tool;
    this.toolInstance = null; // Cached tool instance
  }

  async executeNode(context) {
    try {
      // Get tool instance
      const tool = await this.getTool();
      if (!tool) {
        return {
          status: NodeStatus.FAILURE,
          data: {
            error: `Tool not found: ${this.toolName}`,
            toolName: this.toolName
          }
        };
      }

      // Get tool metadata for schema validation
      const toolMeta = tool.getMetadata ? tool.getMetadata() : {};
      
      // Validate we have required inputs for the tool
      const missingInputs = this.validateToolInputs(toolMeta.input, context);
      if (missingInputs.length > 0) {
        return {
          status: NodeStatus.FAILURE,
          data: {
            error: `Missing required tool inputs: ${missingInputs.join(', ')}`,
            toolName: this.toolName,
            requiredSchema: toolMeta.input,
            missingInputs
          }
        };
      }

      // Transform BT context to tool-specific parameters
      const toolParams = this.transformContextToToolParams(context, toolMeta.input);
      
      if (this.config.debugMode) {
        console.log(`[ActionNode:${this.id}] Executing tool '${this.toolName}' with params:`, toolParams);
      }

      // Execute the tool
      const startTime = Date.now();
      const toolResult = await tool.execute(toolParams);
      const executionTime = Date.now() - startTime;

      // Transform tool result to BT result format with schema validation
      const btResult = this.transformToolResultToBTResult(toolResult, executionTime, toolMeta.output);
      
      // Handle tool execution result
      if (btResult.status === NodeStatus.SUCCESS) {
        // Notify parent of successful execution
        this.sendToParent({
          type: 'ACTION_COMPLETED',
          toolName: this.toolName,
          result: btResult.data,
          executionTime
        });
      } else {
        // Report failure to parent
        this.sendToParent({
          type: 'ACTION_FAILED',
          toolName: this.toolName,
          error: btResult.data.error,
          executionTime
        });
      }

      return btResult;
    } catch (error) {
      return {
        status: NodeStatus.FAILURE,
        data: {
          error: error.message,
          toolName: this.toolName,
          stackTrace: error.stack
        }
      };
    }
  }

  /**
   * Get tool instance with caching
   * @returns {Promise<Object|null>} Tool instance or null if not found
   */
  async getTool() {
    // Use cached instance if available
    if (this.toolInstance) {
      return this.toolInstance;
    }

    try {
      this.toolInstance = await this.toolRegistry.getTool(this.toolName);
      return this.toolInstance;
    } catch (error) {
      console.warn(`[ActionNode] Failed to get tool '${this.toolName}':`, error.message);
      return null;
    }
  }

  /**
   * Prepare tool parameters from configuration and context
   * @param {Object} context - Execution context
   * @returns {Object} Resolved parameters for tool execution
   */
  prepareToolParameters(context) {
    const params = { ...this.config.params };
    
    // Resolve parameters with context substitution
    const resolvedParams = this.resolveParams(params, context);
    
    // Add context-specific parameters if configured
    if (this.config.includeContext) {
      resolvedParams._context = context;
    }
    
    // Add BT-specific metadata
    if (this.config.includeBTInfo) {
      resolvedParams._btInfo = {
        nodeId: this.id,
        nodeType: this.constructor.getTypeName(),
        executionPath: this.getPathFromRoot().map(n => n.id)
      };
    }

    return resolvedParams;
  }

  /**
   * Validate that we have required inputs for the tool
   * @param {Object} toolInputSchema - Tool's input schema
   * @param {Object} context - Current execution context
   * @returns {Array<string>} List of missing required inputs
   */
  validateToolInputs(toolInputSchema, context) {
    const missingInputs = [];
    
    if (!toolInputSchema) return missingInputs;
    
    // Check each required input
    for (const [inputName, inputSpec] of Object.entries(toolInputSchema)) {
      if (inputSpec.required) {
        // Check if we can resolve this input from context or config params
        const hasInContext = this.getNestedValue(context, inputName) !== undefined;
        const hasInParams = this.config.params && this.getNestedValue(this.config.params, inputName) !== undefined;
        
        if (!hasInContext && !hasInParams) {
          missingInputs.push(inputName);
        }
      }
    }
    
    return missingInputs;
  }

  /**
   * Transform BT context to tool-specific parameters based on tool schema
   * @param {Object} context - BT execution context
   * @param {Object} toolInputSchema - Tool's expected input format
   * @returns {Object} Tool-compatible parameters
   */
  transformContextToToolParams(context, toolInputSchema) {
    const toolParams = {};
    
    // If no schema provided, use direct parameter mapping
    if (!toolInputSchema) {
      return this.resolveParams(this.config.params || {}, context);
    }
    
    // Map each input from schema
    for (const [inputName, inputSpec] of Object.entries(toolInputSchema)) {
      let value;
      
      // First check explicit config params
      if (this.config.params && this.config.params[inputName] !== undefined) {
        value = this.resolveParams({ [inputName]: this.config.params[inputName] }, context)[inputName];
      }
      // Then check context
      else if (this.getNestedValue(context, inputName) !== undefined) {
        value = this.getNestedValue(context, inputName);
      }
      // Use default if available
      else if (inputSpec.default !== undefined) {
        value = inputSpec.default;
      }
      
      // Validate and transform value based on schema
      if (value !== undefined) {
        toolParams[inputName] = this.transformValueToType(value, inputSpec);
      }
    }
    
    return toolParams;
  }

  /**
   * Transform value to match expected type from schema
   * @param {*} value - Value to transform
   * @param {Object} typeSpec - Type specification from schema
   * @returns {*} Transformed value
   */
  transformValueToType(value, typeSpec) {
    if (!typeSpec.type) return value;
    
    switch (typeSpec.type) {
      case 'string':
        return String(value);
      case 'number':
        const num = Number(value);
        if (isNaN(num)) return value; // Return original if can't convert
        return num;
      case 'boolean':
        if (typeof value === 'boolean') return value;
        return value === 'true' || value === true;
      case 'array':
        if (Array.isArray(value)) return value;
        if (typeof value === 'string' && value.includes(',')) {
          return value.split(',').map(s => s.trim());
        }
        return [value];
      case 'object':
        return typeof value === 'object' ? value : {};
      default:
        return value;
    }
  }

  /**
   * Transform tool result back to BT format with schema awareness
   * @param {Object} toolResult - Tool execution result
   * @param {number} executionTime - Tool execution time
   * @param {Object} toolOutputSchema - Tool's output schema
   * @returns {Object} BT-compatible result
   */
  transformToolResultToBTResult(toolResult, executionTime, toolOutputSchema = null) {
    const btResult = this.transformToolResult(toolResult, executionTime);
    
    // If tool has output schema, validate the result matches
    if (toolOutputSchema && toolResult.success && toolResult.data) {
      const validationResult = this.validateToolOutput(toolResult.data, toolOutputSchema);
      if (!validationResult.valid) {
        console.warn(`[ActionNode:${this.id}] Tool output validation failed:`, validationResult.errors);
        // Still return result but mark validation issues
        btResult.data.validationWarnings = validationResult.errors;
      }
    }
    
    return btResult;
  }

  /**
   * Validate tool output against expected schema
   * @param {Object} output - Tool output data
   * @param {Object} outputSchema - Expected output schema
   * @returns {Object} Validation result
   */
  validateToolOutput(output, outputSchema) {
    const errors = [];
    
    for (const [outputName, outputSpec] of Object.entries(outputSchema)) {
      if (outputSpec.required && output[outputName] === undefined) {
        errors.push(`Missing required output: ${outputName}`);
      }
      
      if (output[outputName] !== undefined && outputSpec.type) {
        const actualType = Array.isArray(output[outputName]) ? 'array' : typeof output[outputName];
        if (actualType !== outputSpec.type) {
          errors.push(`Output ${outputName} expected ${outputSpec.type}, got ${actualType}`);
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Transform tool result to BT result format
   * @param {Object} toolResult - Raw tool execution result
   * @param {number} executionTime - Tool execution time in ms
   * @returns {Object} BT-formatted result
   */
  transformToolResult(toolResult, executionTime) {
    // Handle different tool result formats
    if (toolResult.success !== undefined) {
      // Standard tool result format
      return {
        status: toolResult.success ? NodeStatus.SUCCESS : NodeStatus.FAILURE,
        data: {
          ...toolResult.data,
          toolName: this.toolName,
          executionTime,
          toolMetadata: this.toolInstance?.getMetadata?.()
        },
        toolResult: toolResult // Keep original for reference
      };
    } else if (toolResult.status) {
      // Tool returns status directly
      return {
        status: this.mapToolStatusToNodeStatus(toolResult.status),
        data: {
          ...toolResult.data,
          toolName: this.toolName,
          executionTime
        },
        toolResult: toolResult
      };
    } else {
      // Assume success if no explicit status
      return {
        status: NodeStatus.SUCCESS,
        data: {
          result: toolResult,
          toolName: this.toolName,
          executionTime
        },
        toolResult: { success: true, data: toolResult }
      };
    }
  }

  /**
   * Map tool status to node status
   * @param {string} toolStatus - Tool-specific status
   * @returns {string} Node status
   */
  mapToolStatusToNodeStatus(toolStatus) {
    const statusMapping = {
      'success': NodeStatus.SUCCESS,
      'failure': NodeStatus.FAILURE,
      'running': NodeStatus.RUNNING,
      'pending': NodeStatus.RUNNING,
      'error': NodeStatus.FAILURE,
      'cancelled': NodeStatus.FAILURE
    };

    const normalizedStatus = toolStatus.toLowerCase();
    return statusMapping[normalizedStatus] || NodeStatus.FAILURE;
  }

  /**
   * Handle messages from parent
   * @param {Object} message - Message from parent
   */
  handleParentMessage(message) {
    super.handleParentMessage(message);

    switch (message.type) {
      case 'CANCEL_ACTION':
        // Cancel tool execution if supported
        if (this.toolInstance && this.toolInstance.cancel) {
          this.toolInstance.cancel();
        }
        break;

      case 'UPDATE_PARAMETERS':
        // Update tool parameters dynamically
        if (message.params) {
          this.config.params = { ...this.config.params, ...message.params };
        }
        break;

      case 'RETRY_ACTION':
        // Retry the action (would need to be handled by parent)
        this.sendToParent({
          type: 'ACTION_RETRY_REQUESTED',
          reason: 'Parent requested retry'
        });
        break;
    }
  }

  /**
   * Validate action configuration
   * @param {Object} config - Node configuration
   * @returns {Object} Validation result
   */
  static validateConfiguration(config) {
    const errors = [];
    const warnings = [];

    if (!config.tool) {
      errors.push('ActionNode must specify tool name');
    }

    if (config.params && typeof config.params !== 'object') {
      errors.push('ActionNode params must be an object');
    }

    if (config.timeout && (typeof config.timeout !== 'number' || config.timeout <= 0)) {
      warnings.push('ActionNode timeout should be a positive number');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get action-specific metadata
   * @returns {Object} Extended metadata
   */
  getMetadata() {
    const baseMetadata = super.getMetadata();
    
    return {
      ...baseMetadata,
      coordinationPattern: 'action',
      toolName: this.toolName,
      parameters: this.config.params || {},
      timeout: this.config.timeout,
      isLeafNode: true,
      executesAtomicTool: true,
      toolMetadata: this.toolInstance?.getMetadata?.()
    };
  }

  /**
   * Get tool dependencies for planning
   * @returns {Promise<Array<string>>} Required tool names
   */
  async getToolDependencies() {
    const dependencies = [this.toolName];
    
    // Get tool metadata to find additional dependencies
    try {
      const tool = await this.getTool();
      if (tool && tool.getMetadata) {
        const metadata = tool.getMetadata();
        if (metadata.dependencies) {
          dependencies.push(...metadata.dependencies);
        }
      }
    } catch (error) {
      console.warn(`[ActionNode] Failed to get tool dependencies for ${this.toolName}:`, error.message);
    }

    return dependencies;
  }

  /**
   * Check if tool is available
   * @returns {Promise<boolean>} True if tool is available
   */
  async isToolAvailable() {
    try {
      const tool = await this.getTool();
      return tool !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Clone action node with different parameters
   * @param {Object} newParams - New parameters
   * @returns {ActionNode} Cloned node
   */
  clone(newParams = {}) {
    const newConfig = {
      ...this.config,
      params: { ...this.config.params, ...newParams }
    };

    return new ActionNode(newConfig, this.toolRegistry, this.executor);
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    // Clear cached tool instance
    this.toolInstance = null;
    
    await super.cleanup();
  }
}