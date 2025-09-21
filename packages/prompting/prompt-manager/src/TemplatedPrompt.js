/**
 * TemplatedPrompt - A reusable prompt facility for LLM interactions
 * 
 * Provides a simple interface for template-based prompts with automatic
 * schema validation, retry logic, and error handling.
 */

import { ResponseValidator } from '@legion/output-schema';
import Handlebars from 'handlebars';

export class TemplatedPrompt {
  constructor({
    prompt,           // Template string with placeholders
    responseSchema,   // JSON Schema for response validation
    examples = [],    // Example outputs for formatting instructions
    llmClient,        // LLM client instance
    maxRetries = 3,   // Maximum retry attempts on validation failure
    sessionLogger     // Optional session logger for debugging
  }) {
    if (!prompt) {
      throw new Error('Prompt template is required');
    }
    if (!responseSchema) {
      throw new Error('Response schema is required');
    }
    if (!llmClient) {
      throw new Error('LLM client is required');
    }

    this.promptTemplate = prompt;
    this.responseSchema = responseSchema;
    this.examples = examples;
    this.llmClient = llmClient;
    this.maxRetries = maxRetries;
    this.sessionLogger = sessionLogger;

    // Detect format from schema or default to 'json'
    this.outputFormat = this._detectOutputFormat(responseSchema);

    // Initialize response validator with auto-repair enabled
    // The validator will use the format detected from schema (defaults to JSON)
    this.validator = new ResponseValidator(responseSchema, {
      autoRepair: true
    });

    // Generate and cache the output prompt
    this.outputPrompt = this.generateOutputPrompt();
  }

  /**
   * Detect the output format from the schema
   * @private
   */
  _detectOutputFormat(schema) {
    // Check for x-output-format extension in schema
    if (schema['x-output-format']) {
      return schema['x-output-format'];
    }
    
    // Check for format hint in x-format extension
    if (schema['x-format']) {
      // If x-format has properties for specific formats, use the first one
      const formats = Object.keys(schema['x-format']);
      if (formats.length > 0 && !formats.includes('preferredFormat')) {
        return formats[0];
      }
    }
    
    // Default to json
    return 'json';
  }

  /**
   * Generate the output prompt from schema and examples
   */
  generateOutputPrompt() {
    // Use generateInstructions method from ResponseValidator
    const instructions = this.validator.generateInstructions(this.examples, {
      format: this.outputFormat,
      verbosity: 'concise'
    });
    return instructions;
  }

  /**
   * Execute the prompt with the given placeholder values
   * @param {Object} placeholderValues - Values for template placeholders
   * @returns {Promise<{success: boolean, data?: any, errors?: string[]}>}
   */
  async execute(placeholderValues = {}) {
    const errors = [];

    try {
      // Check if prompt has {{outputPrompt}}, add at end if not
      let finalPrompt = this.promptTemplate;
      if (!finalPrompt.includes('{{outputPrompt}}')) {
        finalPrompt += '\n\n{{outputPrompt}}';
      }

      // Prepare values including the cached output prompt
      const values = {
        ...placeholderValues,
        outputPrompt: this.outputPrompt
      };

      // Process template and execute with retry logic
      let lastError = null;
      let lastResponse = null;
      let lastDetectedFormat = null;
      
      for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
        try {
          // Substitute placeholders in template
          const processedPrompt = this.substituteTemplate(finalPrompt, values);
          
          // Log if session logger is available
          if (this.sessionLogger) {
            this.sessionLogger.logPrompt(processedPrompt);
          }

          // Call LLM
          const response = await this.llmClient.complete(processedPrompt);
          lastResponse = response; // Save for debugging
          
          // Log response if available
          if (this.sessionLogger) {
            this.sessionLogger.logResponse(response);
          }

          // Validate and parse response using ResponseValidator's process method
          const validationResult = this.validator.process(response);
          
          // Capture detected format if available
          if (validationResult.format) {
            lastDetectedFormat = validationResult.format;
          }
          
          if (validationResult.success) {
            return {
              success: true,
              data: validationResult.data
            };
          }

          // Validation failed, prepare error for retry
          // Handle error objects properly
          let errorMessages = [];
          if (validationResult.errors) {
            errorMessages = validationResult.errors.map(err => {
              if (typeof err === 'object') {
                return err.message || JSON.stringify(err);
              }
              return err;
            });
          }
          lastError = errorMessages.length > 0 ? errorMessages.join(', ') : 'Validation failed';
          errors.push(`Attempt ${attempt}: ${lastError}`);

          // If not the last attempt, add error feedback for retry
          if (attempt < this.maxRetries) {
            values.errorContext = `\n\nThe previous response had validation errors:\n${lastError}\nPlease correct your response and ensure it follows the specified format.`;
            finalPrompt = this.promptTemplate + '\n{{errorContext}}\n{{outputPrompt}}';
          }

        } catch (error) {
          // Unexpected error during this attempt
          const errorMessage = error.message || 'Unknown error';
          errors.push(`Attempt ${attempt}: ${errorMessage}`);
          lastError = errorMessage;
          
          // For LLM errors, we might want to retry
          if (attempt < this.maxRetries && this.isRetryableError(error)) {
            continue;
          }
          
          // Non-retryable error, break out
          break;
        }
      }

      // All attempts failed - include debug information
      return {
        success: false,
        errors: errors,
        data: {
          // Include the final prompt that was sent
          prompt: this.substituteTemplate(finalPrompt, values),
          // Include the last LLM response for debugging
          lastResponse: lastResponse || null,
          // Include the format that was expected
          expectedFormat: this.outputFormat,
          // Include what format was detected
          detectedFormat: lastDetectedFormat || 'unknown'
        }
      };

    } catch (error) {
      // Fatal error before attempts
      return {
        success: false,
        errors: [`Fatal error: ${error.message}`]
      };
    }
  }

  /**
   * Substitute placeholders in template with values using Handlebars
   */
  substituteTemplate(template, values) {
    try {
      // Compile the template with Handlebars
      const compiledTemplate = Handlebars.compile(template);
      
      // Execute the template with the provided values
      return compiledTemplate(values);
    } catch (error) {
      // If Handlebars fails, fall back to simple substitution for backwards compatibility
      console.warn('Handlebars template compilation failed, falling back to simple substitution:', error.message);
      
      let result = template;

      // Replace all simple placeholders (no loops/conditionals)
      for (const [key, value] of Object.entries(values)) {
        const placeholder = `{{${key}}}`;
        const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        
        // Handle different value types
        let replacement;
        if (value === null || value === undefined) {
          replacement = '';
        } else if (typeof value === 'object') {
          replacement = JSON.stringify(value, null, 2);
        } else {
          replacement = String(value);
        }

        result = result.replace(regex, replacement);
      }

      return result;
    }
  }

  /**
   * Check if an error is retryable
   */
  isRetryableError(error) {
    // Retry on rate limits, network errors, etc.
    const retryableMessages = [
      'rate limit',
      'timeout',
      'network',
      'ECONNRESET',
      'ETIMEDOUT',
      'ECONNREFUSED'
    ];

    const errorMessage = (error.message || '').toLowerCase();
    return retryableMessages.some(msg => errorMessage.includes(msg));
  }

  /**
   * Get the generated output prompt (useful for debugging)
   */
  getOutputPrompt() {
    return this.outputPrompt;
  }
}