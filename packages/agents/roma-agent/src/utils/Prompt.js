/**
 * Prompt - Unified LLM interaction abstraction
 * 
 * Encapsulates the complete LLM interaction lifecycle:
 * - Template loading and variable substitution
 * - Schema-based output instruction generation
 * - LLM calling with retry logic and error feedback
 * - Response validation and parsing
 * - Session logging integration
 * - Centralized error handling
 */

import PromptBuilder from './PromptBuilder.js';
import { ResponseValidator } from '@legion/output-schema';

export default class Prompt {
  /**
   * Create a new Prompt instance
   * @param {string} templateName - Name of the template file (without .md extension)
   * @param {Object} schema - JSON schema for response validation
   * @param {Object} options - Configuration options
   * @param {Object} options.llmClient - LLM client for making requests
   * @param {Object} options.sessionLogger - Session logger for audit trail
   * @param {number} options.maxRetries - Maximum retry attempts (default: 3)
   * @param {Object} options.validatorOptions - Options for ResponseValidator
   * @param {Object} options.exampleData - Example data for output instruction generation
   */
  constructor(templateName, schema, options = {}) {
    this.templateName = templateName;
    this.schema = schema;
    this.llmClient = options.llmClient;
    this.sessionLogger = options.sessionLogger;
    this.maxRetries = options.maxRetries || 3;
    
    // Initialize PromptBuilder
    this.promptBuilder = new PromptBuilder();
    this.isInitialized = false;
    
    // Initialize ResponseValidator
    const validatorOptions = {
      preferredFormat: 'json',
      autoRepair: true,
      ...options.validatorOptions
    };
    this.responseValidator = new ResponseValidator(schema, validatorOptions);
    
    // Store example data for output instruction generation
    this.exampleData = options.exampleData;
  }
  
  /**
   * Initialize the prompt builder
   */
  async initialize() {
    if (!this.isInitialized) {
      await this.promptBuilder.initialize();
      this.isInitialized = true;
    }
  }
  
  /**
   * Execute the prompt with variables and return parsed result
   * @param {Object} variables - Variables to substitute in the template
   * @param {Object} context - Additional context for logging and debugging
   * @returns {Promise<Object>} Result object with success flag and data/error
   */
  async execute(variables = {}, context = {}) {
    await this.initialize();
    
    if (!this.llmClient) {
      return {
        success: false,
        error: 'No LLM client configured for this prompt'
      };
    }
    
    // Generate output instructions using ResponseValidator
    const outputPrompt = this.exampleData 
      ? this.responseValidator.generateInstructions(this.exampleData, {
          verbosity: 'detailed',
          errorPrevention: true
        })
      : this.responseValidator.generateInstructions({}, {
          verbosity: 'detailed',
          errorPrevention: true
        });
    
    // Add output instructions to variables
    const allVariables = {
      ...variables,
      outputPrompt
    };
    
    // Build the initial prompt
    let currentPrompt;
    try {
      currentPrompt = this.promptBuilder.buildPrompt(this.templateName, allVariables);
    } catch (error) {
      return {
        success: false,
        error: `Failed to build prompt from template '${this.templateName}': ${error.message}`
      };
    }
    
    // Attempt execution with retry logic
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        // Call LLM
        const response = await this.llmClient.complete(currentPrompt);
        
        // Log the interaction if logger is provided
        if (this.sessionLogger) {
          await this.sessionLogger.logInteraction(
            context.task || { description: 'Unknown task' },
            context.interactionType || 'prompt-execution',
            currentPrompt,
            response,
            {
              templateName: this.templateName,
              attempt,
              ...context.metadata
            }
          );
        }
        
        // Validate and parse the response
        const parseResult = this.responseValidator.process(response);
        
        if (parseResult.success) {
          return {
            success: true,
            data: parseResult.data,
            metadata: {
              attempts: attempt,
              templateName: this.templateName
            }
          };
        }
        
        // If validation failed and we have retries left, build error feedback
        if (attempt < this.maxRetries) {
          const errorList = parseResult.errors.map((error, index) => 
            `${index + 1}. ${error}`
          ).join('\n');
          
          // Rebuild prompt with error feedback
          const errorFeedbackVariables = {
            ...allVariables,
            errorFeedback: `PREVIOUS RESPONSE HAD VALIDATION ERRORS:\n\n${errorList}\n\nORIGINAL REQUEST:`
          };
          
          try {
            // Use error feedback template if available, otherwise prepend to original
            currentPrompt = this._buildRetryPrompt(errorFeedbackVariables, currentPrompt);
          } catch (error) {
            // If retry prompt building fails, use the error feedback approach
            currentPrompt = `PREVIOUS RESPONSE HAD VALIDATION ERRORS:\n\n${errorList}\n\nORIGINAL REQUEST:\n${currentPrompt}\n\nPLEASE PROVIDE CORRECTED RESPONSE:`;
          }
        } else {
          // Final attempt failed
          return {
            success: false,
            error: `Validation failed after ${this.maxRetries} attempts: ${parseResult.errors.join('; ')}`,
            metadata: {
              attempts: attempt,
              templateName: this.templateName,
              lastResponse: response,
              validationErrors: parseResult.errors
            }
          };
        }
        
      } catch (error) {
        // LLM call failed
        if (attempt === this.maxRetries) {
          return {
            success: false,
            error: `LLM call failed after ${this.maxRetries} attempts: ${error.message}`,
            metadata: {
              attempts: attempt,
              templateName: this.templateName
            }
          };
        }
        
        // For non-final attempts, we could add a delay here if needed
        console.warn(`LLM call attempt ${attempt} failed, retrying: ${error.message}`);
      }
    }
    
    // Should not reach here, but just in case
    return {
      success: false,
      error: 'Unexpected error in prompt execution',
      metadata: {
        attempts: this.maxRetries,
        templateName: this.templateName
      }
    };
  }
  
  /**
   * Execute with a custom prompt instead of a template
   * @param {string} promptText - The full prompt text to send to the LLM
   * @param {Object} context - Additional context for logging and debugging
   * @returns {Promise<Object>} Result object with success flag and data/error
   */
  async executeCustom(promptText, context = {}) {
    if (!this.llmClient) {
      return {
        success: false,
        error: 'No LLM client configured for this prompt'
      };
    }
    
    let currentPrompt = promptText;
    
    // Attempt execution with retry logic
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        // Call LLM
        const response = await this.llmClient.complete(currentPrompt);
        
        // Log the interaction if logger is provided
        if (this.sessionLogger) {
          await this.sessionLogger.logInteraction(
            context.task || { description: 'Unknown task' },
            context.interactionType || 'custom-prompt-execution',
            currentPrompt,
            response,
            {
              attempt,
              ...context.metadata
            }
          );
        }
        
        // Validate and parse the response
        const parseResult = this.responseValidator.process(response);
        
        if (parseResult.success) {
          return {
            success: true,
            data: parseResult.data,
            metadata: {
              attempts: attempt
            }
          };
        }
        
        // If validation failed and we have retries left, build error feedback
        if (attempt < this.maxRetries) {
          const errorList = parseResult.errors.map((error, index) => 
            `${index + 1}. ${error}`
          ).join('\n');
          
          // Build retry prompt with error feedback
          currentPrompt = `PREVIOUS RESPONSE HAD VALIDATION ERRORS:\n\n${errorList}\n\nORIGINAL REQUEST:\n${promptText}\n\nPLEASE PROVIDE CORRECTED RESPONSE:`;
        } else {
          // Final attempt failed
          return {
            success: false,
            error: `Validation failed after ${this.maxRetries} attempts: ${parseResult.errors.join('; ')}`,
            metadata: {
              attempts: attempt,
              lastResponse: response,
              validationErrors: parseResult.errors
            }
          };
        }
        
      } catch (error) {
        // LLM call failed
        if (attempt === this.maxRetries) {
          return {
            success: false,
            error: `LLM call failed after ${this.maxRetries} attempts: ${error.message}`,
            metadata: {
              attempts: attempt
            }
          };
        }
        
        // For non-final attempts, we could add a delay here if needed
        console.warn(`LLM call attempt ${attempt} failed, retrying: ${error.message}`);
      }
    }
    
    // Should not reach here, but just in case
    return {
      success: false,
      error: 'Unexpected error in custom prompt execution',
      metadata: {
        attempts: this.maxRetries
      }
    };
  }
  
  /**
   * Build a retry prompt with error feedback
   * @param {Object} variables - Variables including error feedback
   * @param {string} originalPrompt - The original prompt that failed
   * @returns {string} Retry prompt with error feedback
   * @private
   */
  _buildRetryPrompt(variables, originalPrompt) {
    // Try to use a retry template if it exists
    try {
      const retryTemplateName = `${this.templateName}-retry`;
      return this.promptBuilder.buildPrompt(retryTemplateName, variables);
    } catch (error) {
      // Fallback to prepending error feedback to original prompt
      return `${variables.errorFeedback}\n${originalPrompt}\n\nPLEASE PROVIDE CORRECTED RESPONSE:`;
    }
  }
  
  /**
   * Create a prompt instance with fluent interface
   * @param {string} templateName - Template name
   * @returns {FluentPromptBuilder} Fluent prompt builder
   */
  static template(templateName) {
    return new FluentPromptBuilder(templateName);
  }
}

/**
 * Fluent prompt builder for easier configuration
 */
class FluentPromptBuilder {
  constructor(templateName) {
    this.templateName = templateName;
    this.config = {};
  }
  
  schema(schema) {
    this.config.schema = schema;
    return this;
  }
  
  llmClient(client) {
    this.config.llmClient = client;
    return this;
  }
  
  sessionLogger(logger) {
    this.config.sessionLogger = logger;
    return this;
  }
  
  maxRetries(retries) {
    this.config.maxRetries = retries;
    return this;
  }
  
  exampleData(data) {
    this.config.exampleData = data;
    return this;
  }
  
  validatorOptions(options) {
    this.config.validatorOptions = options;
    return this;
  }
  
  build() {
    if (!this.config.schema) {
      throw new Error('Schema is required for prompt creation');
    }
    
    return new Prompt(this.templateName, this.config.schema, this.config);
  }
}