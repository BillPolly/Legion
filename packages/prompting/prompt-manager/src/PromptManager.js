/**
 * PromptManager - Complete LLM interaction orchestrator
 * 
 * Coordinates Handle-based data extraction → prompt-builder → LLM → output-schema pipeline
 * with intelligent retry logic and error handling
 */

import { SimpleObjectHandle } from '@legion/handle';
import { SimpleObjectDataSource } from '@legion/handle';
import { PromptBuilder } from '@legion/prompt-builder';
import { ResponseValidator } from '@legion/output-schema';
import { RetryHandler } from './RetryHandler.js';

export class PromptManager {
  /**
   * Create a prompt manager with complete pipeline configuration
   * @param {Object} configuration - Complete pipeline configuration
   */
  constructor(configuration) {
    if (!configuration || typeof configuration !== 'object') {
      throw new Error('Configuration is required');
    }

    this.config = configuration;
    this.executionHistory = [];
    this.llmClient = null;

    // Validate required configurations
    this._validateRequiredConfiguration();

    // Create pipeline components
    this._createPipelineComponents();

    // Validate cross-component compatibility
    this._validateComponentCompatibility();
  }

  /**
   * Execute complete pipeline on source object
   * @param {Object} sourceObject - Source object to process
   * @param {Object} options - Execution options
   * @returns {Object} Execution result
   */
  async execute(sourceObject, options = {}) {
    const executionId = this._generateExecutionId();
    const startTime = Date.now();

    try {
      // Input validation
      if (!sourceObject || typeof sourceObject !== 'object') {
        throw new Error('Source object must be a non-null object');
      }

      // Execute with retry logic
      const result = await this.retryHandler.executeWithRetry(
        (attempt, lastError) => this._executePipelineAttempt(sourceObject, options, attempt, lastError),
        options
      );

      // Add execution metadata
      result.metadata = {
        ...result.metadata,
        executionId: executionId,
        executionTimeMs: Date.now() - startTime
      };

      // Store in history
      this.executionHistory.push({
        executionId: executionId,
        timestamp: new Date().toISOString(),
        success: result.success,
        attempts: result.metadata?.attempts || 1,
        durationMs: Date.now() - startTime
      });

      return result;

    } catch (error) {
      // Fatal error - return immediately
      const errorResult = {
        success: false,
        stage: 'fatal',
        error: error.message,
        metadata: {
          executionId: executionId,
          executionTimeMs: Date.now() - startTime
        }
      };

      this.executionHistory.push({
        executionId: executionId,
        timestamp: new Date().toISOString(),
        success: false,
        error: error.message,
        durationMs: Date.now() - startTime
      });

      return errorResult;
    }
  }

  /**
   * Unified request method that accepts rich request objects
   * Combines the power of PromptManager's orchestration with LLMClient's provider adaptation
   * @param {Object} requestObj - Rich request object with all desired features
   * @param {Object} options - Execution options
   * @returns {Object} Execution result with structured response
   */
  async request(requestObj, options = {}) {
    const executionId = this._generateExecutionId();
    const startTime = Date.now();

    try {
      // Input validation
      if (!requestObj || typeof requestObj !== 'object') {
        throw new Error('Request object must be a non-null object');
      }

      // Execute with retry logic using the unified interface
      const result = await this.retryHandler.executeWithRetry(
        (attempt, lastError) => this._executeUnifiedRequestAttempt(requestObj, options, attempt, lastError),
        options
      );

      // Add execution metadata
      result.metadata = {
        ...result.metadata,
        executionId: executionId,
        executionTimeMs: Date.now() - startTime,
        interface: 'unified_request'
      };

      // Store in history
      this.executionHistory.push({
        executionId: executionId,
        timestamp: new Date().toISOString(),
        success: result.success,
        attempts: result.metadata?.attempts || 1,
        durationMs: Date.now() - startTime,
        interface: 'unified_request'
      });

      return result;

    } catch (error) {
      // Fatal error - return immediately
      const errorResult = {
        success: false,
        stage: 'fatal',
        error: error.message,
        metadata: {
          executionId: executionId,
          executionTimeMs: Date.now() - startTime,
          interface: 'unified_request'
        }
      };

      this.executionHistory.push({
        executionId: executionId,
        timestamp: new Date().toISOString(),
        success: false,
        error: error.message,
        durationMs: Date.now() - startTime,
        interface: 'unified_request'
      });

      return errorResult;
    }
  }

  /**
   * Execute single unified request attempt
   * @private
   */
  async _executeUnifiedRequestAttempt(requestObj, options = {}, attempt = 1, lastError = null) {
    const metadata = { interface: 'unified_request' };

    // Step 1: Prepare LLM request with PromptManager enhancements
    const llmStart = Date.now();
    await this._ensureLLMClient();

    // Enhanced request object that combines requestObj with PromptManager capabilities
    let enhancedRequest = { ...requestObj };

    // Step 2: Add output schema instructions if configured
    if (this.responseValidator && requestObj.outputSchema !== false) {
      const exampleData = this._generateExampleFromSchema();
      const outputInstructions = this.responseValidator.generateInstructions(exampleData);
      
      // Add schema instructions to system prompt
      const schemaInstructions = `\n\nResponse format requirements:\n${outputInstructions}`;
      enhancedRequest.systemPrompt = (enhancedRequest.systemPrompt || '') + schemaInstructions;
      metadata.addedSchemaInstructions = true;
    }

    // Step 3: Apply error feedback on retry attempts
    if (attempt > 1 && lastError && this.retryConfig.errorFeedback.enabled) {
      const errorFeedback = this.retryHandler.generateErrorFeedback(lastError.errors || [], enhancedRequest.prompt || '');
      enhancedRequest.prompt = errorFeedback;
      metadata.appliedErrorFeedback = true;
    }

    // Step 4: Use LLMClient's unified request interface
    const llmResponse = await this.llmClient.request(enhancedRequest, options);
    
    metadata.llmCall = {
      durationMs: Date.now() - llmStart,
      model: llmResponse.metadata?.model,
      provider: llmResponse.metadata?.provider,
      adaptations: llmResponse.metadata?.adaptations
    };

    // Step 5: Response validation (if configured)
    if (this.responseValidator && requestObj.outputSchema !== false) {
      const validationStart = Date.now();
      const validationResult = this.responseValidator.process(llmResponse.content);
      
      metadata.outputSchema = {
        durationMs: Date.now() - validationStart,
        format: validationResult.format,
        confidence: validationResult.confidence,
        validationPassed: validationResult.success
      };

      // If validation failed, return error for retry
      if (!validationResult.success && validationResult.errors) {
        return {
          success: false,
          stage: 'validation',
          errors: validationResult.errors,
          response: llmResponse.content,
          metadata
        };
      }

      // Return successful result with parsed data
      return {
        success: true,
        stage: 'completed',
        data: validationResult.data,
        rawResponse: llmResponse.content,
        toolCalls: llmResponse.toolCalls,
        metadata
      };
    }

    // Return successful result without validation
    return {
      success: true,
      stage: 'completed',
      content: llmResponse.content,
      toolCalls: llmResponse.toolCalls,
      metadata
    };
  }

  /**
   * Execute single pipeline attempt
   * @private
   */
  async _executePipelineAttempt(sourceObject, options = {}, attempt = 1, lastError = null) {
    const metadata = {};

    // Step 1: Data extraction using Handle pattern
    const extractionStart = Date.now();
    const labeledInputs = await this._extractDataWithHandle(sourceObject, options);
    
    metadata.dataExtraction = {
      durationMs: Date.now() - extractionStart,
      bindingsExtracted: Object.keys(labeledInputs).length
    };

    // Step 2: Generate output format instructions
    const exampleData = this._generateExampleFromSchema();
    const outputInstructions = this.responseValidator.generateInstructions(exampleData);
    labeledInputs.outputInstructions = outputInstructions;

    // Step 3: Build optimized prompt
    const promptStart = Date.now();
    let prompt = this.promptBuilder.build(labeledInputs, {
      priority: options.optimizationPriority || 'balanced'
    });

    // Apply error feedback on retry attempts
    if (attempt > 1 && lastError && this.retryConfig.errorFeedback.enabled) {
      prompt = this.retryHandler.generateErrorFeedback(lastError.errors || [], prompt);
    }
    
    metadata.promptBuilder = {
      durationMs: Date.now() - promptStart,
      finalPromptSize: prompt.length,
      tokensEstimated: Math.ceil(prompt.length / 4)
    };

    // Step 4: LLM API call
    const llmStart = Date.now();
    await this._ensureLLMClient();
    const llmResponse = await this._callLLM(prompt, options);
    
    metadata.llmCall = {
      durationMs: Date.now() - llmStart,
      promptTokens: metadata.promptBuilder.tokensEstimated,
      model: this.llmClient.model || 'unknown'
    };

    // Step 5: Response validation
    const validationStart = Date.now();
    const validationResult = this.responseValidator.process(llmResponse);
    
    metadata.outputSchema = {
      durationMs: Date.now() - validationStart,
      format: validationResult.format,
      confidence: validationResult.confidence,
      validationPassed: validationResult.success
    };

    // Return result with metadata
    return {
      ...validationResult,
      metadata: metadata,
      originalPrompt: prompt,
      llmResponse: llmResponse
    };
  }

  /**
   * Extract data using Handle pattern instead of ObjectQuery
   * @private
   */
  _extractDataWithHandle(sourceObject, options = {}) {
    // Create a DataSource and Handle for the source object
    const dataSource = new SimpleObjectDataSource(sourceObject);
    const handle = new SimpleObjectHandle(dataSource);
    
    const result = {};
    const querySpec = this.config.objectQuery;
    
    // Process bindings
    if (querySpec.bindings) {
      for (const [key, binding] of Object.entries(querySpec.bindings)) {
        try {
          if (binding.value !== undefined) {
            // Direct value assignment
            result[key] = binding.value;
          } else if (binding.path) {
            // Path-based extraction
            const value = this._extractPath(handle, binding.path);
            
            // Check for required fields in strict mode
            if (value === undefined && binding.required && options.strict) {
              throw new Error(`Required binding path not found: ${binding.path}`);
            }
            
            // Apply fallback if value is undefined
            if (value === undefined && binding.fallback !== undefined) {
              result[key] = binding.fallback;
            } else if (binding.filter) {
              // Apply filter
              result[key] = this._applyFilter(value, binding.filter);
            } else if (binding.transform) {
              // Apply transformation
              result[key] = this._applyTransform(value, binding.transform, binding.options);
            } else {
              result[key] = value;
            }
          } else if (binding.aggregate) {
            // Handle aggregation
            result[key] = this._processAggregation(handle, binding.aggregate);
          }
        } catch (error) {
          if (options.strict) {
            throw error;
          }
          // In non-strict mode, set undefined for failed extractions
          result[key] = undefined;
        }
      }
    }
    
    // Process context variables
    if (querySpec.contextVariables) {
      for (const [key, varDef] of Object.entries(querySpec.contextVariables)) {
        const contextKey = '@' + key;
        if (varDef.value !== undefined) {
          result[contextKey] = varDef.value;
        } else if (varDef.path) {
          result[contextKey] = this._extractPath(handle, varDef.path);
        }
      }
    }
    
    return result;
  }
  
  /**
   * Extract value from Handle using dot notation path
   * @private
   */
  _extractPath(handle, path) {
    const parts = path.split('.');
    return handle.select(data => {
      let value = data;
      for (const part of parts) {
        if (value === null || value === undefined) {
          return undefined;
        }
        value = value[part];
      }
      return value;
    }).value();
  }
  
  /**
   * Apply filter to value
   * @private
   */
  _applyFilter(value, filter) {
    if (!Array.isArray(value)) {
      return value;
    }
    
    return value.filter(item => {
      for (const [key, filterValue] of Object.entries(filter)) {
        if (typeof filterValue === 'object' && filterValue !== null) {
          // Handle operators like $gt, $lt, etc.
          for (const [op, opValue] of Object.entries(filterValue)) {
            switch(op) {
              case '$gt': if (!(item[key] > opValue)) return false; break;
              case '$gte': if (!(item[key] >= opValue)) return false; break;
              case '$lt': if (!(item[key] < opValue)) return false; break;
              case '$lte': if (!(item[key] <= opValue)) return false; break;
              case '$ne': if (item[key] === opValue) return false; break;
              default: if (item[key] !== filterValue) return false;
            }
          }
        } else {
          // Simple equality filter
          if (item[key] !== filterValue) return false;
        }
      }
      return true;
    });
  }
  
  /**
   * Apply transformation to value
   * @private
   */
  _applyTransform(value, transform, options = {}) {
    if (value === undefined || value === null) {
      return value;
    }
    
    switch(transform) {
      case 'uppercase': return typeof value === 'string' ? value.toUpperCase() : value;
      case 'lowercase': return typeof value === 'string' ? value.toLowerCase() : value;
      case 'trim': return typeof value === 'string' ? value.trim() : value;
      case 'capitalize': 
        return typeof value === 'string' ? 
          value.charAt(0).toUpperCase() + value.slice(1) : value;
      case 'truncate':
        const maxLength = options.maxLength || 100;
        return typeof value === 'string' && value.length > maxLength ?
          value.substring(0, maxLength) + '...' : value;
      case 'join':
        const separator = options.separator || ', ';
        return Array.isArray(value) ? value.join(separator) : value;
      case 'jsonStringify':
        return JSON.stringify(value, null, options.indent || 2);
      case 'jsonParse':
        try {
          return typeof value === 'string' ? JSON.parse(value) : value;
        } catch {
          return value;
        }
      default:
        return value;
    }
  }
  
  /**
   * Process aggregation using Handle
   * @private
   */
  _processAggregation(handle, aggregateDef) {
    if (!Array.isArray(aggregateDef)) {
      throw new Error('Aggregate must be an array');
    }
    
    const values = [];
    let totalWeight = 0;
    
    for (const item of aggregateDef) {
      const value = this._extractPath(handle, item.path);
      const weight = item.weight || 1;
      
      if (value !== undefined) {
        values.push({ value, weight });
        totalWeight += weight;
      }
    }
    
    // Weighted combination
    return values.map(({ value, weight }) => {
      const contribution = weight / totalWeight;
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      return `${stringValue} (${(contribution * 100).toFixed(0)}% weight)`;
    }).join('\n\n');
  }

  /**
   * Validate configuration requirements
   * @private
   */
  _validateRequiredConfiguration() {
    if (!this.config.objectQuery) {
      throw new Error('objectQuery configuration is required');
    }
    
    if (!this.config.promptBuilder) {
      throw new Error('promptBuilder configuration is required');
    }
    
    if (!this.config.outputSchema) {
      throw new Error('outputSchema configuration is required');
    }

    // LLM client can be provided or will be lazy-loaded from ResourceManager
  }

  /**
   * Create pipeline components
   * @private
   */
  _createPipelineComponents() {
    // Store the query configuration directly (no longer creating ObjectQuery instance)
    this.querySpec = this.config.objectQuery;
    
    // Validate query spec structure
    if (!this.querySpec.bindings && !this.querySpec.contextVariables) {
      throw new Error('Query specification must have bindings or contextVariables');
    }

    try {
      this.promptBuilder = new PromptBuilder(this.config.promptBuilder);
    } catch (error) {
      throw new Error(`Invalid promptBuilder configuration: ${error.message}`);
    }

    try {
      this.responseValidator = new ResponseValidator(this.config.outputSchema);
    } catch (error) {
      throw new Error(`Invalid outputSchema configuration: ${error.message}`);
    }

    // Set up retry configuration
    this.retryConfig = {
      maxAttempts: 3,
      errorFeedback: { enabled: true },
      backoffMs: 1000,
      timeoutMs: 30000,
      ...this.config.retryConfig
    };

    this.retryHandler = new RetryHandler(this.retryConfig);

    // Store LLM client reference
    this.llmClient = this.config.llmClient || null;
  }

  /**
   * Validate cross-component compatibility
   * @private
   */
  _validateComponentCompatibility() {
    // Check that prompt template placeholders match query bindings
    const promptPlaceholders = this.promptBuilder.getPlaceholders();
    const queryBindings = Object.keys(this.config.objectQuery.bindings || {});
    const contextVariables = Object.keys(this.config.objectQuery.contextVariables || {});

    // Remove outputInstructions placeholder (added automatically)
    const requiredPlaceholders = promptPlaceholders.filter(p => p !== 'outputInstructions');
    
    for (const placeholder of requiredPlaceholders) {
      const isBinding = queryBindings.includes(placeholder);
      const isContextVar = placeholder.startsWith('@') && 
                           contextVariables.includes(placeholder.replace('@', ''));
      
      if (!isBinding && !isContextVar) {
        throw new Error(`Component compatibility validation failed: placeholder '${placeholder}' not found in query bindings or context variables`);
      }
    }
  }

  /**
   * Validate configuration
   */
  validateConfiguration() {
    // Validate query spec
    this.validateQuerySpec();
    this.promptBuilder.validateTemplate();
    this.responseValidator.validateSchema();
  }

  /**
   * Validate query specification
   */
  validateQuerySpec() {
    if (!this.querySpec || typeof this.querySpec !== 'object') {
      throw new Error('Query specification must be an object');
    }

    if (!this.querySpec.bindings) {
      throw new Error('Query specification must have bindings');
    }

    // Validate each binding
    for (const [name, binding] of Object.entries(this.querySpec.bindings)) {
      if (!name || typeof name !== 'string') {
        throw new Error('Binding name must be a non-empty string');
      }

      if (!binding || typeof binding !== 'object') {
        throw new Error(`Binding ${name} must be an object`);
      }

      if (!binding.path && binding.value === undefined && !binding.aggregate) {
        throw new Error(`Binding ${name} must have path, value, or aggregate`);
      }

      if (binding.path && typeof binding.path !== 'string') {
        throw new Error(`Path must be a string for binding ${name}`);
      }
    }

    // Validate context variables if present
    if (this.querySpec.contextVariables) {
      for (const [name, varDef] of Object.entries(this.querySpec.contextVariables)) {
        if (!name || typeof name !== 'string') {
          throw new Error('Context variable name must be a non-empty string');
        }

        if (!varDef || typeof varDef !== 'object') {
          throw new Error(`Context variable ${name} must be an object`);
        }

        if (!varDef.path && varDef.value === undefined) {
          throw new Error(`Context variable ${name} must have path or value`);
        }
      }
    }
  }

  /**
   * Get component status
   */
  getComponentStatus() {
    return {
      dataExtraction: 'handle-based',
      promptBuilder: this.promptBuilder ? 'ready' : 'not_initialized',
      outputSchema: this.responseValidator ? 'ready' : 'not_initialized',
      llmClient: this.llmClient ? 'configured' : 'not_configured',
      retryHandler: this.retryHandler ? 'ready' : 'not_initialized'
    };
  }

  /**
   * Analyze pipeline configuration
   */
  analyzePipeline() {
    const promptComplexity = this.promptBuilder.analyzeComplexity();
    const queryPaths = this.getRequiredPaths();
    
    return {
      estimatedComplexity: promptComplexity.estimatedComplexity + queryPaths.length,
      expectedTokenRange: {
        min: 500,
        max: this.config.promptBuilder.maxTokens || 4000
      },
      placeholderBindings: this.config.objectQuery.bindings,
      contextVariables: Object.keys(this.config.objectQuery.contextVariables || {}),
      requiredPaths: queryPaths
    };
  }

  /**
   * Get required paths from query specification
   */
  getRequiredPaths() {
    const paths = [];
    
    if (this.querySpec.bindings) {
      for (const binding of Object.values(this.querySpec.bindings)) {
        if (binding.path) {
          paths.push(binding.path);
        }
        if (binding.aggregate) {
          for (const item of binding.aggregate) {
            if (item.path) {
              paths.push(item.path);
            }
          }
        }
      }
    }
    
    if (this.querySpec.contextVariables) {
      for (const varDef of Object.values(this.querySpec.contextVariables)) {
        if (varDef.path) {
          paths.push(varDef.path);
        }
      }
    }
    
    return [...new Set(paths)]; // Remove duplicates
  }

  /**
   * Update configuration
   */
  updateConfiguration(updates) {
    if (updates.objectQuery || updates.promptBuilder || updates.outputSchema) {
      throw new Error('Core component configurations cannot be updated after creation');
    }

    if (updates.retryConfig) {
      this.retryConfig = { ...this.retryConfig, ...updates.retryConfig };
      this.retryHandler.updateConfiguration(this.retryConfig);
    }

    if (updates.llmClient) {
      this.llmClient = updates.llmClient;
    }
  }

  /**
   * Get execution history
   */
  getExecutionHistory() {
    return [...this.executionHistory];
  }

  /**
   * Clear execution history
   */
  clearHistory() {
    this.executionHistory = [];
  }

  /**
   * Get last attempt information
   */
  getLastAttemptInfo() {
    return this.executionHistory[this.executionHistory.length - 1] || null;
  }

  /**
   * Reset retry state
   */
  resetRetryState() {
    this.retryHandler.reset();
  }

  /**
   * Validate individual components
   */
  validateObjectQuery() { this.validateQuerySpec(); }
  validatePromptBuilder() { this.promptBuilder.validateTemplate(); }
  validateOutputSchema() { this.responseValidator.validateSchema(); }
  validateRetryConfig() { this.retryHandler.validateConfiguration(); }

  /**
   * Generate example data from schema for output instructions
   * @private
   */
  _generateExampleFromSchema() {
    // Basic example generation from schema properties
    const schema = this.config.outputSchema;
    const example = {};

    if (schema.properties) {
      for (const [propName, propDef] of Object.entries(schema.properties)) {
        if (propDef.type === 'string') {
          example[propName] = `Example ${propName}`;
        } else if (propDef.type === 'number') {
          const min = propDef.minimum || 0;
          const max = propDef.maximum || 10;
          example[propName] = Math.floor((min + max) / 2);
        } else if (propDef.type === 'array') {
          example[propName] = [`Example item 1`, `Example item 2`];
        } else if (propDef.type === 'boolean') {
          example[propName] = true;
        } else if (propDef.type === 'object') {
          example[propName] = { key: 'value' };
        }
      }
    }

    return example;
  }

  /**
   * Ensure LLM client is available
   * @private
   */
  async _ensureLLMClient() {
    if (!this.llmClient) {
      // Try to get from ResourceManager
      try {
        const { ResourceManager } = await import('@legion/resource-manager');
        const resourceManager = await ResourceManager.getInstance();
        this.llmClient = await resourceManager.get('llmClient');
      } catch (error) {
        throw new Error('LLM client not available and could not load from ResourceManager');
      }
    }

    if (!this.llmClient || typeof this.llmClient.complete !== 'function') {
      throw new Error('LLM client must have a complete() method');
    }
  }

  /**
   * Call LLM with error handling
   * @private
   */
  async _callLLM(prompt, options = {}) {
    const callOptions = {
      maxTokens: (this.config.promptBuilder.reserveTokens || 500),
      temperature: options.temperature || 0.1,
      timeout: this.retryConfig.timeoutMs || 30000
    };

    return await this.llmClient.complete(prompt, callOptions);
  }

  /**
   * Generate execution ID
   * @private
   */
  _generateExecutionId() {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}