/**
 * BehaviorTreeTool - Wraps BT configurations as executable tools
 * 
 * This class allows BT JSON configurations to be registered as tools in the ToolRegistry,
 * making complex workflows available to LLMs as simple tool calls with clear input/output schemas.
 */

import { BehaviorTreeExecutor } from '../core/BehaviorTreeExecutor.js';

export class BehaviorTreeTool {
  constructor(config, toolRegistry = null) {
    this.config = config;
    this.toolRegistry = toolRegistry;
    this.btExecutor = null;
    
    // Validate configuration
    this.validateConfig(config);
  }

  /**
   * Execute the BT as a tool
   * @param {Object} input - Input parameters matching the tool's input schema
   * @returns {Promise<Object>} Tool execution result
   */
  async execute(input) {
    try {
      // Validate input against schema
      const validation = this.validateInput(input);
      if (!validation.valid) {
        return {
          success: false,
          data: {
            error: 'Missing required inputs',
            validationErrors: validation.errors,
            toolName: this.config.name
          }
        };
      }
      
      // Ensure BT executor is initialized
      if (!this.btExecutor) {
        this.btExecutor = new BehaviorTreeExecutor(this.toolRegistry);
      }

      // Transform tool input to BT execution context
      const context = this.transformInputToContext(input);
      
      // Execute the behavior tree
      const result = await this.btExecutor.executeTree(this.config.implementation, context);
      
      // Transform BT result to tool result format
      return this.transformBTResultToToolResult(result, input);
    } catch (error) {
      return {
        success: false,
        data: {
          error: error.message,
          toolName: this.config.name,
          stackTrace: error.stack
        }
      };
    }
  }

  /**
   * Get tool metadata for ToolRegistry
   * @returns {Object} Tool metadata
   */
  getMetadata() {
    return {
      name: this.config.name,
      description: this.config.description,
      input: this.config.input || {},
      output: this.config.output || { status: { type: 'string' } },
      domains: this.config.domains || [],
      capabilities: this.config.capabilities || [],
      toolType: 'behavior-tree',
      btDefinition: true
    };
  }

  /**
   * Transform tool input parameters to BT execution context
   * @param {Object} input - Tool input parameters
   * @returns {Object} BT execution context
   */
  transformInputToContext(input) {
    const context = {
      ...input,
      toolName: this.config.name,
      startTime: Date.now(),
      artifacts: {}
    };

    // Apply input transformations if configured
    if (this.config.inputTransform) {
      for (const [contextKey, inputKey] of Object.entries(this.config.inputTransform)) {
        if (input[inputKey] !== undefined) {
          context[contextKey] = input[inputKey];
        }
      }
    }

    return context;
  }

  /**
   * Transform BT execution result to tool result format
   * @param {Object} btResult - BT execution result
   * @param {Object} originalInput - Original tool input for reference
   * @returns {Object} Tool-compatible result
   */
  transformBTResultToToolResult(btResult, originalInput) {
    const toolResult = {
      success: btResult.success,
      data: {}
    };

    // Extract meaningful data from BT result
    if (btResult.success) {
      // Apply output transformations if configured
      if (this.config.outputTransform) {
        for (const [outputKey, contextPath] of Object.entries(this.config.outputTransform)) {
          const value = this.getNestedValue(btResult.context, contextPath);
          if (value !== undefined) {
            toolResult.data[outputKey] = value;
          }
        }
      } else {
        // Default transformation - include key execution data
        toolResult.data = {
          status: 'SUCCESS',
          executionTime: btResult.executionTime,
          artifacts: btResult.context.artifacts || {},
          context: btResult.context
        };
      }
    } else {
      toolResult.data = {
        status: 'FAILURE',
        error: btResult.error || 'BT execution failed',
        executionTime: btResult.executionTime || 0
      };
    }

    return toolResult;
  }

  /**
   * Get nested value from object by dot-separated path
   * @param {Object} obj - Object to traverse
   * @param {string} path - Dot-separated path (e.g., 'artifacts.code')
   * @returns {*} Value at path or undefined
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  /**
   * Validate BT tool configuration
   * @param {Object} config - Configuration to validate
   * @throws {Error} If configuration is invalid
   */
  validateConfig(config) {
    if (!config.name) {
      throw new Error('BT tool configuration must specify name');
    }

    if (!config.implementation) {
      throw new Error('BT tool configuration must specify implementation');
    }

    if (!config.implementation.type) {
      throw new Error('BT tool implementation must specify root node type');
    }

    // Validate input schema if present
    if (config.input) {
      for (const [inputName, inputSpec] of Object.entries(config.input)) {
        if (inputSpec.required && typeof inputSpec.required !== 'boolean') {
          throw new Error(`Input ${inputName} required field must be boolean`);
        }
      }
    }

    // Validate output schema if present
    if (config.output) {
      for (const [outputName, outputSpec] of Object.entries(config.output)) {
        if (!outputSpec.type) {
          console.warn(`Output ${outputName} should specify type`);
        }
      }
    }
  }

  /**
   * Create a ModuleProvider-compatible wrapper for ToolRegistry
   * @returns {Object} ModuleProvider-compatible object
   */
  asModuleProvider() {
    const btTool = this;

    return {
      name: this.config.name,
      definition: {
        async create(instanceConfig = {}) {
          // Create tool instance with any runtime config
          const toolInstance = new BehaviorTreeTool({
            ...btTool.config,
            ...instanceConfig
          }, btTool.toolRegistry);

          // Return module instance compatible with ToolRegistry
          return {
            [btTool.config.name]: toolInstance,
            getTool: (name) => name === btTool.config.name ? toolInstance : null,
            listTools: () => [btTool.config.name],
            getMetadata: () => toolInstance.getMetadata()
          };
        },

        getMetadata() {
          return {
            name: btTool.config.name,
            description: btTool.config.description || `BT tool: ${btTool.config.name}`,
            version: '1.0.0',
            domains: btTool.config.domains || [],
            capabilities: btTool.config.capabilities || [],
            tools: {
              [btTool.config.name]: btTool.getMetadata()
            }
          };
        }
      },
      config: {},
      lazy: false
    };
  }

  /**
   * Validate input against schema before execution
   * @param {Object} input - Input to validate
   * @returns {Object} Validation result
   */
  validateInput(input) {
    const errors = [];
    const warnings = [];

    if (!this.config.input) {
      return { valid: true, errors, warnings };
    }

    // Check required inputs
    for (const [inputName, inputSpec] of Object.entries(this.config.input)) {
      if (inputSpec.required && input[inputName] === undefined) {
        errors.push(`Missing required input: ${inputName}`);
      }

      if (input[inputName] !== undefined && inputSpec.type) {
        const actualType = Array.isArray(input[inputName]) ? 'array' : typeof input[inputName];
        if (actualType !== inputSpec.type) {
          warnings.push(`Input ${inputName} expected ${inputSpec.type}, got ${actualType}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get BT configuration for debugging/inspection
   * @returns {Object} BT configuration
   */
  getBTConfig() {
    return { ...this.config };
  }
}