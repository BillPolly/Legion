/**
 * Tool Adapter
 * 
 * Provides a unified interface for all tools regardless of their original format.
 * Handles execution, validation, schema conversion, and error handling.
 */

import { z } from 'zod';

export class ToolAdapter {
  constructor(options = {}) {
    this.verbose = options.verbose || false;
    this.validateInput = options.validateInput !== false;
    this.validateOutput = options.validateOutput || false;
    this.timeout = options.timeout || 30000;
    this.retryOnFailure = options.retryOnFailure || false;
    this.maxRetries = options.maxRetries || 3;
    
    // Cache for converted schemas
    this.schemaCache = new Map();
    
    // Statistics
    this.stats = {
      executions: 0,
      successes: 0,
      failures: 0,
      validationErrors: 0,
      timeouts: 0,
      retries: 0
    };
  }

  /**
   * Adapt a tool to the unified interface
   */
  adaptTool(tool, metadata = {}) {
    if (!tool || !tool.name) {
      throw new Error('Tool must have at least a name property');
    }
    
    const adaptedTool = {
      // Core properties
      name: tool.name,
      description: tool.description || `${tool.name} tool`,
      moduleName: metadata.moduleName || tool.moduleName,
      moduleType: metadata.moduleType || tool.moduleType,
      
      // Schema properties
      inputSchema: this.normalizeSchema(tool.inputSchema || tool.schema || tool.parameters),
      outputSchema: this.normalizeSchema(tool.outputSchema || tool.output),
      
      // Metadata
      category: tool.category || metadata.category,
      tags: tool.tags || metadata.tags || [],
      complexity: tool.complexity || 'simple',
      permissions: tool.permissions || [],
      examples: tool.examples || [],
      
      // Original reference
      _original: tool,
      _metadata: metadata,
      
      // Unified execution method
      execute: this.createExecutor(tool, metadata),
      
      // Additional methods
      validate: this.createValidator(tool),
      getSchema: () => this.getSchema(tool),
      getExample: () => this.getExample(tool),
      getDocumentation: () => this.getDocumentation(tool)
    };
    
    // Add invoke method for compatibility
    adaptedTool.invoke = adaptedTool.execute;
    
    return adaptedTool;
  }

  /**
   * Create unified executor function
   */
  createExecutor(tool, metadata) {
    return async (params = {}) => {
      this.stats.executions++;
      
      const startTime = Date.now();
      let attempt = 0;
      let lastError = null;
      
      while (attempt <= (this.retryOnFailure ? this.maxRetries : 0)) {
        try {
          if (attempt > 0) {
            this.stats.retries++;
            if (this.verbose) {
              console.log(`🔄 Retry attempt ${attempt} for ${tool.name}`);
            }
          }
          
          // Validate input if enabled
          if (this.validateInput && tool.inputSchema) {
            const validation = await this.validateParams(params, tool.inputSchema);
            if (!validation.valid) {
              this.stats.validationErrors++;
              throw new Error(`Input validation failed: ${validation.error}`);
            }
          }
          
          // Execute with timeout
          const result = await this.executeWithTimeout(
            () => this.executeOriginal(tool, params),
            this.timeout
          );
          
          // Validate output if enabled
          if (this.validateOutput && tool.outputSchema) {
            const validation = await this.validateParams(result, tool.outputSchema);
            if (!validation.valid) {
              throw new Error(`Output validation failed: ${validation.error}`);
            }
          }
          
          // Format result
          const formattedResult = this.formatResult(result, tool);
          
          this.stats.successes++;
          
          // Add execution metadata
          formattedResult._metadata = {
            tool: tool.name,
            module: metadata.moduleName,
            executionTime: Date.now() - startTime,
            attempts: attempt + 1,
            timestamp: new Date().toISOString()
          };
          
          return formattedResult;
          
        } catch (error) {
          lastError = error;
          
          if (error.name === 'TimeoutError') {
            this.stats.timeouts++;
          }
          
          if (attempt < (this.retryOnFailure ? this.maxRetries : 0)) {
            // Wait before retry with exponential backoff
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
            attempt++;
          } else {
            break;
          }
        }
      }
      
      // All attempts failed
      this.stats.failures++;
      
      const errorResult = {
        success: false,
        error: lastError.message,
        errorType: this.classifyError(lastError),
        tool: tool.name,
        module: metadata.moduleName,
        executionTime: Date.now() - startTime,
        attempts: attempt + 1,
        timestamp: new Date().toISOString()
      };
      
      if (this.verbose) {
        console.log(`❌ Tool execution failed: ${tool.name}`, lastError.message);
      }
      
      throw new ToolExecutionError(lastError.message, errorResult);
    };
  }

  /**
   * Execute original tool method
   */
  async executeOriginal(tool, params) {
    // Try various execution methods
    if (tool.execute && typeof tool.execute === 'function') {
      return await tool.execute(params);
    }
    
    if (tool.invoke && typeof tool.invoke === 'function') {
      return await tool.invoke(params);
    }
    
    if (tool.run && typeof tool.run === 'function') {
      return await tool.run(params);
    }
    
    if (tool.call && typeof tool.call === 'function') {
      return await tool.call(params);
    }
    
    if (typeof tool === 'function') {
      return await tool(params);
    }
    
    // Check for method name in tool definition
    if (tool.method && tool.instance) {
      const method = tool.instance[tool.method];
      if (typeof method === 'function') {
        return await method.call(tool.instance, params);
      }
    }
    
    throw new Error(`Tool ${tool.name} has no executable method`);
  }

  /**
   * Execute with timeout
   */
  async executeWithTimeout(fn, timeout) {
    return Promise.race([
      fn(),
      new Promise((_, reject) => 
        setTimeout(() => {
          const error = new Error(`Execution timed out after ${timeout}ms`);
          error.name = 'TimeoutError';
          reject(error);
        }, timeout)
      )
    ]);
  }

  /**
   * Create validator function
   */
  createValidator(tool) {
    return async (params, schema = null) => {
      const targetSchema = schema || tool.inputSchema;
      
      if (!targetSchema) {
        return { valid: true };
      }
      
      return await this.validateParams(params, targetSchema);
    };
  }

  /**
   * Validate parameters against schema
   */
  async validateParams(params, schema) {
    try {
      // Handle Zod schemas
      if (schema._def || schema.parse) {
        try {
          schema.parse(params);
          return { valid: true };
        } catch (error) {
          return { 
            valid: false, 
            error: error.errors ? error.errors.map(e => e.message).join(', ') : error.message 
          };
        }
      }
      
      // Handle JSON Schema
      if (schema.type || schema.properties) {
        // Convert to Zod for validation
        const zodSchema = this.jsonSchemaToZod(schema);
        if (zodSchema) {
          try {
            zodSchema.parse(params);
            return { valid: true };
          } catch (error) {
            return { 
              valid: false, 
              error: error.errors ? error.errors.map(e => e.message).join(', ') : error.message 
            };
          }
        }
      }
      
      // No validation available
      return { valid: true };
      
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * Normalize schema to standard format
   */
  normalizeSchema(schema) {
    if (!schema) return null;
    
    // Already normalized
    if (schema._normalized) return schema;
    
    // Zod schema
    if (schema._def || schema.parse) {
      return {
        type: 'zod',
        schema: schema,
        _normalized: true
      };
    }
    
    // JSON Schema
    if (schema.type || schema.properties) {
      return {
        type: 'json-schema',
        schema: schema,
        _normalized: true
      };
    }
    
    // OpenAI function format
    if (schema.parameters) {
      return {
        type: 'openai',
        schema: schema.parameters,
        _normalized: true
      };
    }
    
    // Unknown format
    return {
      type: 'unknown',
      schema: schema,
      _normalized: true
    };
  }

  /**
   * Convert JSON Schema to Zod schema
   */
  jsonSchemaToZod(jsonSchema) {
    const cacheKey = JSON.stringify(jsonSchema);
    
    if (this.schemaCache.has(cacheKey)) {
      return this.schemaCache.get(cacheKey);
    }
    
    try {
      let zodSchema;
      
      if (jsonSchema.type === 'object') {
        const shape = {};
        
        if (jsonSchema.properties) {
          for (const [key, prop] of Object.entries(jsonSchema.properties)) {
            shape[key] = this.propertyToZod(prop);
            
            // Make optional if not required
            if (!jsonSchema.required || !jsonSchema.required.includes(key)) {
              shape[key] = shape[key].optional();
            }
          }
        }
        
        zodSchema = z.object(shape);
        
        if (jsonSchema.additionalProperties) {
          zodSchema = zodSchema.passthrough();
        }
      } else {
        zodSchema = this.propertyToZod(jsonSchema);
      }
      
      this.schemaCache.set(cacheKey, zodSchema);
      return zodSchema;
      
    } catch (error) {
      if (this.verbose) {
        console.log(`⚠️ Failed to convert JSON Schema to Zod: ${error.message}`);
      }
      return null;
    }
  }

  /**
   * Convert JSON Schema property to Zod
   */
  propertyToZod(prop) {
    if (!prop.type) return z.any();
    
    switch (prop.type) {
      case 'string':
        let stringSchema = z.string();
        if (prop.minLength) stringSchema = stringSchema.min(prop.minLength);
        if (prop.maxLength) stringSchema = stringSchema.max(prop.maxLength);
        if (prop.pattern) stringSchema = stringSchema.regex(new RegExp(prop.pattern));
        if (prop.enum) stringSchema = z.enum(prop.enum);
        return stringSchema;
        
      case 'number':
      case 'integer':
        let numberSchema = prop.type === 'integer' ? z.number().int() : z.number();
        if (prop.minimum !== undefined) numberSchema = numberSchema.min(prop.minimum);
        if (prop.maximum !== undefined) numberSchema = numberSchema.max(prop.maximum);
        return numberSchema;
        
      case 'boolean':
        return z.boolean();
        
      case 'array':
        let itemSchema = prop.items ? this.propertyToZod(prop.items) : z.any();
        let arraySchema = z.array(itemSchema);
        if (prop.minItems) arraySchema = arraySchema.min(prop.minItems);
        if (prop.maxItems) arraySchema = arraySchema.max(prop.maxItems);
        return arraySchema;
        
      case 'object':
        return this.jsonSchemaToZod(prop) || z.object({}).passthrough();
        
      case 'null':
        return z.null();
        
      default:
        return z.any();
    }
  }

  /**
   * Format execution result
   */
  formatResult(result, tool) {
    // Already formatted with success property
    if (result && typeof result === 'object' && 'success' in result) {
      return result;
    }
    
    // Format based on result type
    if (result === undefined || result === null) {
      return {
        success: true,
        data: null,
        message: `${tool.name} executed successfully`
      };
    }
    
    if (typeof result === 'boolean') {
      return {
        success: result,
        data: result,
        message: result ? 'Operation succeeded' : 'Operation failed'
      };
    }
    
    if (result instanceof Error) {
      return {
        success: false,
        error: result.message,
        errorType: result.name,
        stack: result.stack
      };
    }
    
    // Wrap other results
    return {
      success: true,
      data: result,
      message: `${tool.name} executed successfully`
    };
  }

  /**
   * Classify error type
   */
  classifyError(error) {
    if (error.name === 'TimeoutError') return 'timeout';
    if (error.name === 'ValidationError') return 'validation';
    if (error.name === 'TypeError') return 'type_error';
    if (error.name === 'ReferenceError') return 'reference_error';
    if (error.message.includes('permission')) return 'permission_denied';
    if (error.message.includes('not found')) return 'not_found';
    if (error.message.includes('network')) return 'network_error';
    if (error.message.includes('auth')) return 'authentication_error';
    return 'execution_error';
  }

  /**
   * Get schema information
   */
  getSchema(tool) {
    return {
      input: tool.inputSchema || tool.schema || tool.parameters,
      output: tool.outputSchema || tool.output,
      format: this.detectSchemaFormat(tool.inputSchema || tool.schema)
    };
  }

  /**
   * Detect schema format
   */
  detectSchemaFormat(schema) {
    if (!schema) return 'none';
    if (schema._def || schema.parse) return 'zod';
    if (schema.type || schema.properties) return 'json-schema';
    if (schema.parameters) return 'openai';
    return 'unknown';
  }

  /**
   * Get tool example
   */
  getExample(tool) {
    if (tool.examples && tool.examples.length > 0) {
      return tool.examples[0];
    }
    
    if (tool.example) {
      return tool.example;
    }
    
    // Generate basic example from schema
    if (tool.inputSchema) {
      return this.generateExampleFromSchema(tool.inputSchema);
    }
    
    return null;
  }

  /**
   * Generate example from schema
   */
  generateExampleFromSchema(schema) {
    if (!schema) return {};
    
    const normalized = this.normalizeSchema(schema);
    
    if (normalized.type === 'json-schema' && normalized.schema.properties) {
      const example = {};
      
      for (const [key, prop] of Object.entries(normalized.schema.properties)) {
        example[key] = this.generateExampleValue(prop);
      }
      
      return example;
    }
    
    return {};
  }

  /**
   * Generate example value for property
   */
  generateExampleValue(prop) {
    switch (prop.type) {
      case 'string':
        if (prop.enum) return prop.enum[0];
        if (prop.example) return prop.example;
        return 'example-string';
        
      case 'number':
      case 'integer':
        if (prop.example) return prop.example;
        if (prop.minimum !== undefined) return prop.minimum;
        return prop.type === 'integer' ? 1 : 1.0;
        
      case 'boolean':
        return true;
        
      case 'array':
        return [];
        
      case 'object':
        return {};
        
      default:
        return null;
    }
  }

  /**
   * Get tool documentation
   */
  getDocumentation(tool) {
    const doc = {
      name: tool.name,
      description: tool.description || 'No description available',
      module: tool.moduleName,
      category: tool.category,
      tags: tool.tags || [],
      
      usage: {
        input: this.getSchema(tool).input,
        output: this.getSchema(tool).output,
        example: this.getExample(tool)
      },
      
      metadata: {
        complexity: tool.complexity || 'simple',
        permissions: tool.permissions || [],
        version: tool.version || '1.0.0'
      }
    };
    
    if (tool.documentation) {
      Object.assign(doc, tool.documentation);
    }
    
    return doc;
  }

  /**
   * Adapt multiple tools
   */
  adaptTools(tools, metadata = {}) {
    return tools.map(tool => this.adaptTool(tool, metadata));
  }

  /**
   * Get adapter statistics
   */
  getStats() {
    return {
      ...this.stats,
      successRate: this.stats.executions > 0 
        ? (this.stats.successes / this.stats.executions * 100).toFixed(2) + '%'
        : '0%',
      failureRate: this.stats.executions > 0
        ? (this.stats.failures / this.stats.executions * 100).toFixed(2) + '%'
        : '0%',
      avgRetries: this.stats.failures > 0
        ? (this.stats.retries / this.stats.failures).toFixed(2)
        : '0'
    };
  }
}

/**
 * Custom error class for tool execution errors
 */
export class ToolExecutionError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'ToolExecutionError';
    this.details = details;
  }
}