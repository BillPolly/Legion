/**
 * MCPToolProxy - Proxy for executing MCP tools through Legion interface
 * 
 * Provides a Legion-compatible interface for MCP tools:
 * - Implements standard Legion Tool interface
 * - Handles MCP-specific communication
 * - Manages format conversion between Legion and MCP
 * - Provides error handling and retry logic
 * - Emits events for monitoring and observability
 */

import { EventEmitter } from 'events';

export class MCPToolProxy extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.serverId = options.serverId;
    this.toolName = options.toolName;
    this.toolInfo = options.toolInfo;
    this.serverProcess = options.serverProcess;
    this.registry = options.registry;
    
    // Configuration
    this.options = {
      timeout: options.timeout || 30000,
      retryAttempts: options.retryAttempts || 2,
      retryDelay: options.retryDelay || 1000,
      validateInput: options.validateInput !== false,
      formatOutput: options.formatOutput !== false,
      enableEvents: options.enableEvents !== false,
      ...options
    };
    
    // State
    this.executionCount = 0;
    this.errorCount = 0;
    this.totalExecutionTime = 0;
    this.lastExecuted = null;
    this.lastError = null;
    
    // Tool metadata (Legion format)
    this.name = this.toolInfo.name;
    this.description = this.toolInfo.description || '';
    this.inputSchema = this.toolInfo.inputSchema;
    this.category = this.toolInfo.category || 'mcp-tool';
    this.tags = this.toolInfo.tags || ['mcp'];
    this.source = 'mcp';
  }

  /**
   * Execute the MCP tool (main Legion Tool interface method)
   */
  async execute(input = {}) {
    const executionId = `${this.serverId}-${this.toolName}-${Date.now()}`;
    const startTime = Date.now();
    
    this.executionCount++;
    this.lastExecuted = startTime;
    
    if (this.options.enableEvents) {
      this.emit('execution:start', {
        executionId,
        serverId: this.serverId,
        toolName: this.toolName,
        input: this.sanitizeInputForLogging(input)
      });
    }
    
    try {
      // Validate input against schema
      if (this.options.validateInput) {
        this.validateInput(input);
      }
      
      // Execute with retry logic
      const result = await this.executeWithRetry(input, executionId);
      
      // Format output for Legion
      const formattedResult = this.options.formatOutput ? 
        this.formatOutputForLegion(result) : result;
      
      // Update statistics
      const executionTime = Date.now() - startTime;
      this.totalExecutionTime += executionTime;
      
      if (this.options.enableEvents) {
        this.emit('execution:complete', {
          executionId,
          serverId: this.serverId,
          toolName: this.toolName,
          executionTime,
          success: true,
          outputSize: this.calculateOutputSize(formattedResult)
        });
      }
      
      return formattedResult;
      
    } catch (error) {
      this.errorCount++;
      this.lastError = {
        message: error.message,
        timestamp: Date.now()
      };
      
      const executionTime = Date.now() - startTime;
      
      if (this.options.enableEvents) {
        this.emit('execution:error', {
          executionId,
          serverId: this.serverId,
          toolName: this.toolName,
          executionTime,
          error: error.message,
          success: false
        });
      }
      
      // Re-throw as Legion-formatted error
      throw this.formatErrorForLegion(error);
    }
  }

  /**
   * Execute with retry logic
   */
  async executeWithRetry(input, executionId, attempt = 1) {
    try {
      return await this.executeOnServer(input, executionId);
    } catch (error) {
      if (attempt < this.options.retryAttempts && this.isRetryableError(error)) {
        this.emit('retry-attempt', {
          executionId,
          attempt,
          maxAttempts: this.options.retryAttempts,
          error: error.message
        });
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, this.options.retryDelay * attempt));
        
        return this.executeWithRetry(input, executionId, attempt + 1);
      }
      
      throw error;
    }
  }

  /**
   * Execute the tool on the MCP server
   */
  async executeOnServer(input, executionId) {
    // Check if server is available
    if (!this.serverProcess || this.serverProcess.status !== 'running') {
      throw new Error(`MCP server ${this.serverId} is not running`);
    }
    
    // Check if tool is still available
    if (!this.serverProcess.haseTool(this.toolName)) {
      throw new Error(`Tool ${this.toolName} is no longer available on server ${this.serverId}`);
    }
    
    try {
      // Convert Legion input to MCP format
      const mcpInput = this.convertInputToMCP(input);
      
      // Execute on MCP server
      const mcpResult = await Promise.race([
        this.serverProcess.callTool(this.toolName, mcpInput),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Tool execution timeout')), this.options.timeout)
        )
      ]);
      
      return mcpResult;
      
    } catch (error) {
      // Enhance error with context
      const enhancedError = new Error(
        `MCP tool execution failed: ${error.message}`
      );
      enhancedError.originalError = error;
      enhancedError.serverId = this.serverId;
      enhancedError.toolName = this.toolName;
      enhancedError.executionId = executionId;
      
      throw enhancedError;
    }
  }

  /**
   * Validate input against tool schema
   */
  validateInput(input) {
    if (!this.inputSchema) return; // No schema to validate against
    
    try {
      // Basic validation - could be enhanced with proper JSON Schema validation
      if (this.inputSchema.required) {
        for (const requiredParam of this.inputSchema.required) {
          if (!(requiredParam in input)) {
            throw new Error(`Required parameter '${requiredParam}' is missing`);
          }
        }
      }
      
      // Validate parameter types if schema provides them
      if (this.inputSchema.properties) {
        for (const [param, value] of Object.entries(input)) {
          const paramSchema = this.inputSchema.properties[param];
          if (paramSchema && paramSchema.type) {
            this.validateParameterType(param, value, paramSchema.type);
          }
        }
      }
      
    } catch (error) {
      throw new Error(`Input validation failed: ${error.message}`);
    }
  }

  /**
   * Validate parameter type
   */
  validateParameterType(param, value, expectedType) {
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    
    if (expectedType === 'integer' && (typeof value !== 'number' || !Number.isInteger(value))) {
      throw new Error(`Parameter '${param}' must be an integer`);
    } else if (expectedType === 'number' && typeof value !== 'number') {
      throw new Error(`Parameter '${param}' must be a number`);
    } else if (expectedType !== 'integer' && expectedType !== actualType) {
      throw new Error(`Parameter '${param}' must be of type '${expectedType}', got '${actualType}'`);
    }
  }

  /**
   * Convert Legion input format to MCP format
   */
  convertInputToMCP(legionInput) {
    // Most MCP tools expect the same format as Legion tools
    // But we can add any necessary transformations here
    
    // Handle special cases
    const mcpInput = { ...legionInput };
    
    // Convert any Legion-specific formats to MCP equivalents
    // (This would be tool-specific and could be enhanced)
    
    return mcpInput;
  }

  /**
   * Format MCP output for Legion consumers
   */
  formatOutputForLegion(mcpResult) {
    // MCP tools return results in this format:
    // { content: [{ type, text?, data?, mimeType? }], isError: boolean }
    
    if (!mcpResult) {
      return { success: false, error: 'No result from MCP server' };
    }
    
    // Handle error responses
    if (mcpResult.isError) {
      const errorContent = mcpResult.content?.[0]?.text || 'Unknown error';
      return { 
        success: false, 
        error: errorContent,
        mcpResponse: mcpResult 
      };
    }
    
    // Handle successful responses
    if (mcpResult.content && Array.isArray(mcpResult.content)) {
      const result = {
        success: true,
        content: mcpResult.content,
        mcpResponse: mcpResult
      };
      
      // Extract text content for convenience
      const textContent = mcpResult.content
        .filter(item => item.type === 'text')
        .map(item => item.text)
        .join('\n');
      
      if (textContent) {
        result.text = textContent;
      }
      
      // Extract resource references
      const resources = mcpResult.content
        .filter(item => item.type === 'resource')
        .map(item => ({ uri: item.resource?.uri, text: item.text }));
      
      if (resources.length > 0) {
        result.resources = resources;
      }
      
      return result;
    }
    
    // Fallback for unexpected formats
    return {
      success: true,
      data: mcpResult,
      mcpResponse: mcpResult
    };
  }

  /**
   * Format error for Legion consumers
   */
  formatErrorForLegion(error) {
    const legionError = new Error(error.message);
    legionError.source = 'mcp';
    legionError.serverId = this.serverId;
    legionError.toolName = this.toolName;
    legionError.originalError = error;
    
    return legionError;
  }

  /**
   * Check if error is retryable
   */
  isRetryableError(error) {
    const retryablePatterns = [
      'timeout',
      'connection',
      'network',
      'temporary',
      'busy',
      'rate limit'
    ];
    
    const errorMessage = error.message.toLowerCase();
    return retryablePatterns.some(pattern => errorMessage.includes(pattern));
  }

  /**
   * Calculate output size for statistics
   */
  calculateOutputSize(output) {
    try {
      return JSON.stringify(output).length;
    } catch {
      return 0;
    }
  }

  /**
   * Sanitize input for logging (remove sensitive data)
   */
  sanitizeInputForLogging(input) {
    const sanitized = { ...input };
    
    // Remove common sensitive field names
    const sensitiveFields = [
      'password', 'token', 'key', 'secret', 'credential', 
      'auth', 'authorization', 'api_key', 'apiKey'
    ];
    
    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }

  /**
   * Get tool metadata (Legion Tool interface)
   */
  getMetadata() {
    return {
      name: this.name,
      description: this.description,
      inputSchema: this.inputSchema,
      category: this.category,
      tags: this.tags,
      source: this.source,
      serverId: this.serverId,
      
      // MCP-specific metadata
      mcpToolName: this.toolName,
      mcpMetadata: this.toolInfo.mcpMetadata,
      
      // Runtime statistics
      statistics: this.getStatistics()
    };
  }

  /**
   * Get execution statistics
   */
  getStatistics() {
    return {
      executionCount: this.executionCount,
      errorCount: this.errorCount,
      errorRate: this.executionCount > 0 ? this.errorCount / this.executionCount : 0,
      averageExecutionTime: this.executionCount > 0 ? 
        this.totalExecutionTime / this.executionCount : 0,
      lastExecuted: this.lastExecuted,
      lastError: this.lastError
    };
  }

  /**
   * Check if tool is available
   */
  isAvailable() {
    return this.serverProcess && 
           this.serverProcess.status === 'running' && 
           this.serverProcess.haseTool(this.toolName);
  }

  /**
   * Get server health status
   */
  getServerHealth() {
    if (!this.serverProcess) {
      return { status: 'unknown', healthy: false };
    }
    
    return {
      status: this.serverProcess.status,
      healthy: this.serverProcess.status === 'running',
      uptime: this.serverProcess.getUptime(),
      serverId: this.serverId
    };
  }

  /**
   * Refresh tool metadata (if tool schema changes)
   */
  async refreshMetadata() {
    if (!this.registry || !this.registry.metadataExtractor) return;
    
    try {
      const serverMetadata = await this.registry.metadataExtractor
        .extractServerMetadata(this.serverProcess);
      
      const updatedTool = serverMetadata.tools.find(t => t.name === this.toolName);
      if (updatedTool) {
        this.toolInfo = updatedTool;
        this.inputSchema = updatedTool.inputSchema;
        this.description = updatedTool.description;
        this.category = updatedTool.category;
        this.tags = updatedTool.tags;
        
        this.emit('metadata-refreshed', {
          toolName: this.toolName,
          serverId: this.serverId
        });
      }
    } catch (error) {
      this.emit('metadata-refresh-failed', {
        toolName: this.toolName,
        serverId: this.serverId,
        error: error.message
      });
    }
  }

  /**
   * Create a clone of this proxy with different options
   */
  clone(overrideOptions = {}) {
    return new MCPToolProxy({
      serverId: this.serverId,
      toolName: this.toolName,
      toolInfo: this.toolInfo,
      serverProcess: this.serverProcess,
      registry: this.registry,
      ...this.options,
      ...overrideOptions
    });
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.removeAllListeners();
    this.serverProcess = null;
    this.registry = null;
  }

  /**
   * String representation for debugging
   */
  toString() {
    return `MCPToolProxy(${this.serverId}/${this.toolName})`;
  }

  /**
   * JSON representation for serialization
   */
  toJSON() {
    return {
      type: 'MCPToolProxy',
      serverId: this.serverId,
      toolName: this.toolName,
      name: this.name,
      description: this.description,
      category: this.category,
      tags: this.tags,
      available: this.isAvailable(),
      statistics: this.getStatistics(),
      health: this.getServerHealth()
    };
  }
}