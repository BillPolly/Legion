/**
 * PromptManager - Complete LLM interaction orchestrator
 * 
 * Coordinates object-query → prompt-builder → LLM → output-schema pipeline
 * with intelligent retry logic and error handling
 */

import { ObjectQuery } from '@legion/kg-object-query';
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
   * Execute single pipeline attempt
   * @private
   */
  async _executePipelineAttempt(sourceObject, options = {}, attempt = 1, lastError = null) {
    const metadata = {};

    // Step 1: Data extraction with object-query
    const extractionStart = Date.now();
    const labeledInputs = await this.objectQuery.execute(sourceObject, {
      strict: options.strictValidation || false
    });
    
    metadata.objectQuery = {
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
    try {
      this.objectQuery = new ObjectQuery(this.config.objectQuery);
    } catch (error) {
      throw new Error(`Invalid objectQuery configuration: ${error.message}`);
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
    // Check that prompt template placeholders match object-query bindings
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
        throw new Error(`Component compatibility validation failed: placeholder '${placeholder}' not found in object-query bindings or context variables`);
      }
    }
  }

  /**
   * Validate configuration
   */
  validateConfiguration() {
    this.objectQuery.validateQuery();
    this.promptBuilder.validateTemplate();
    this.responseValidator.validateSchema();
  }

  /**
   * Get component status
   */
  getComponentStatus() {
    return {
      objectQuery: this.objectQuery ? 'ready' : 'not_initialized',
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
    const queryPaths = this.objectQuery.getRequiredPaths();
    
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
  validateObjectQuery() { this.objectQuery.validateQuery(); }
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