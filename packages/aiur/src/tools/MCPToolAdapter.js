/**
 * MCPToolAdapter - Wraps Legion tools for MCP compatibility
 * 
 * Provides parameter resolution, response formatting, and error handling
 * for Legion tools to work seamlessly with the MCP protocol
 */

export class MCPToolAdapter {
  constructor(handleRegistry, handleResolver, options = {}) {
    this.handleRegistry = handleRegistry;
    this.handleResolver = handleResolver;
    
    // Configuration options
    this.options = {
      enableParameterResolution: options.enableParameterResolution !== false,
      validateInput: options.validateInput || false,
      timeout: options.timeout || 30000, // 30 second default timeout
      errorFormatter: options.errorFormatter || ((error) => error.message),
      responseProcessor: options.responseProcessor || null,
      ...options
    };
  }

  /**
   * Wrap a Legion tool for MCP compatibility
   * @param {Object} legionTool - The Legion tool to wrap
   * @param {Object} wrapOptions - Per-tool wrapping options
   * @returns {Object} MCP-compatible tool
   */
  wrapTool(legionTool, wrapOptions = {}) {
    this._validateTool(legionTool);

    const options = { ...this.options, ...wrapOptions };

    return {
      name: legionTool.name,
      description: legionTool.description || '',
      inputSchema: legionTool.inputSchema || { type: 'object' },
      metadata: legionTool.metadata || {},
      
      execute: async (params) => {
        try {
          // Apply timeout if configured
          const executePromise = this._executeWithResolution(legionTool, params, options);
          
          if (options.timeout > 0) {
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error(`Tool execution timeout after ${options.timeout}ms`)), options.timeout);
            });
            
            return await Promise.race([executePromise, timeoutPromise]);
          }
          
          return await executePromise;
        } catch (error) {
          return {
            success: false,
            error: options.errorFormatter(error)
          };
        }
      }
    };
  }

  /**
   * Execute tool with parameter resolution
   * @private
   */
  async _executeWithResolution(legionTool, params, options) {
    let resolvedParams = params;

    // Resolve handle references if enabled
    if (options.enableParameterResolution) {
      try {
        resolvedParams = this.handleResolver.resolveParameters(params);
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    }

    // Validate input if enabled
    if (options.validateInput && legionTool.inputSchema) {
      try {
        this._validateInput(resolvedParams, legionTool.inputSchema);
      } catch (error) {
        return {
          success: false,
          error: `Input validation failed: ${error.message}`
        };
      }
    }

    // Execute the Legion tool
    let result;
    try {
      const toolResult = await legionTool.execute(resolvedParams);
      
      // Format the response
      result = this._formatResponse(toolResult);
    } catch (error) {
      return {
        success: false,
        error: options.errorFormatter(error)
      };
    }

    // Apply custom response processor if provided
    if (options.responseProcessor) {
      result = options.responseProcessor(result);
    }

    return result;
  }

  /**
   * Format tool response to MCP standard
   * @private
   */
  _formatResponse(toolResult) {
    // If the tool result already has a success field, respect it
    if (toolResult && typeof toolResult.success === 'boolean') {
      return toolResult;
    }

    // If tool result is null or undefined, consider it successful but empty
    if (toolResult == null) {
      return { success: true };
    }

    // For all other results, wrap them in a success response
    const response = { success: true };

    // Preserve common response fields
    if (toolResult.data !== undefined) {
      response.data = toolResult.data;
    }

    // Preserve metadata
    if (toolResult.metadata) {
      response.metadata = toolResult.metadata;
    }

    // Preserve saveAs functionality
    if (toolResult.saveAs) {
      response.saveAs = toolResult.saveAs;
    }

    // Preserve error information (for tools that return error info without throwing)
    if (toolResult.error) {
      response.error = toolResult.error;
      response.success = false;
    }

    // Preserve warnings
    if (toolResult.warning) {
      response.warning = toolResult.warning;
    }

    // If no data field but the result has direct properties, spread them into response
    if (toolResult.data === undefined && typeof toolResult === 'object') {
      // Copy all properties except the ones we've already handled
      const excludeKeys = ['metadata', 'saveAs', 'error', 'warning', 'success'];
      for (const [key, value] of Object.entries(toolResult)) {
        if (!excludeKeys.includes(key)) {
          response[key] = value;
        }
      }
    }

    return response;
  }

  /**
   * Validate input parameters against schema
   * @private
   */
  _validateInput(params, schema) {
    // Basic validation - in a full implementation you'd use a proper JSON schema validator
    if (schema.type === 'object' && schema.required) {
      for (const requiredField of schema.required) {
        if (!(requiredField in params)) {
          throw new Error(`Missing required field: ${requiredField}`);
        }
      }
    }

    // Additional validation could be added here
    return true;
  }

  /**
   * Validate tool structure
   * @private
   */
  _validateTool(tool) {
    if (!tool || typeof tool !== 'object') {
      throw new Error('Tool must be an object');
    }

    if (!tool.name || typeof tool.name !== 'string') {
      throw new Error('Tool must have name and execute function');
    }

    if (!tool.execute || typeof tool.execute !== 'function') {
      throw new Error('Tool must have name and execute function');
    }

    return true;
  }

  /**
   * Wrap multiple tools at once
   * @param {Array} legionTools - Array of Legion tools to wrap
   * @param {Object} wrapOptions - Options for wrapping
   * @returns {Array} Array of MCP-compatible tools
   */
  wrapTools(legionTools, wrapOptions = {}) {
    return legionTools.map(tool => this.wrapTool(tool, wrapOptions));
  }

  /**
   * Create a tool registry with wrapped tools
   * @param {Array} legionTools - Array of Legion tools
   * @returns {Map} Map of tool name to wrapped tool
   */
  createToolRegistry(legionTools) {
    const registry = new Map();
    const wrappedTools = this.wrapTools(legionTools);
    
    for (const tool of wrappedTools) {
      registry.set(tool.name, tool);
    }
    
    return registry;
  }

  /**
   * Get adapter statistics
   * @returns {Object} Statistics about the adapter
   */
  getStatistics() {
    return {
      handleRegistrySize: this.handleRegistry.size(),
      options: { ...this.options },
      capabilities: [
        'parameter-resolution',
        'response-formatting',
        'error-handling',
        'timeout-management'
      ]
    };
  }

  /**
   * Test tool compatibility
   * @param {Object} legionTool - Tool to test
   * @returns {Object} Compatibility test results
   */
  testToolCompatibility(legionTool) {
    const results = {
      compatible: true,
      issues: [],
      warnings: []
    };

    try {
      this._validateTool(legionTool);
    } catch (error) {
      results.compatible = false;
      results.issues.push(`Tool validation failed: ${error.message}`);
    }

    // Check for optional best practices
    if (!legionTool.description) {
      results.warnings.push('Tool should have a description');
    }

    if (!legionTool.inputSchema) {
      results.warnings.push('Tool should have an input schema for better validation');
    }

    if (legionTool.inputSchema && !legionTool.inputSchema.type) {
      results.warnings.push('Input schema should specify a type');
    }

    // Test that execute function is async
    if (legionTool.execute) {
      const executeStr = legionTool.execute.toString();
      if (!executeStr.includes('async') && !executeStr.includes('Promise')) {
        results.warnings.push('Tool execute function should be async or return a Promise');
      }
    }

    return results;
  }

  /**
   * Update adapter configuration
   * @param {Object} newOptions - New configuration options
   */
  updateOptions(newOptions) {
    this.options = { ...this.options, ...newOptions };
  }

  /**
   * Clone adapter with different options
   * @param {Object} newOptions - Options for the new adapter
   * @returns {MCPToolAdapter} New adapter instance
   */
  clone(newOptions = {}) {
    return new MCPToolAdapter(
      this.handleRegistry, 
      this.handleResolver, 
      { ...this.options, ...newOptions }
    );
  }
}