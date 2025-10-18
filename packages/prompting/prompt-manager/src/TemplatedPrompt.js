/**
 * TemplatedPrompt - A reusable prompt facility for LLM interactions
 * 
 * Provides a simple interface for template-based prompts with automatic
 * schema validation, retry logic, and error handling.
 */

import { ResponseValidator } from '@legion/output-schema';
import { SimpleObjectHandle, SimpleObjectDataSource } from '@legion/handle';
import Handlebars from 'handlebars';

export class TemplatedPrompt {
  constructor({
    prompt,           // Template string with placeholders
    responseSchema,   // JSON Schema for response validation
    examples = [],    // Example outputs for formatting instructions
    llmClient,        // LLM client instance
    maxRetries = 3,   // Maximum retry attempts on validation failure
    sessionLogger,    // Optional session logger for debugging
    querySpec = null  // Optional query specification for Handle-based data extraction
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
    this.querySpec = querySpec;

    // Register Handlebars helpers
    this._registerHelpers();

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
   * Register Handlebars helpers
   * @private
   */
  _registerHelpers() {
    // Register json helper for JSON stringification
    Handlebars.registerHelper('json', function(context) {
      return JSON.stringify(context, null, 2);
    });
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
   * @param {Object|Handle} sourceData - Either placeholder values object or Handle to extract data from
   * @param {Object} options - Execution options
   * @returns {Promise<{success: boolean, data?: any, errors?: string[]}>}
   */
  async execute(sourceData = {}, options = {}) {
    const errors = [];

    try {
      // Extract data from Handle if querySpec is provided
      let placeholderValues;
      if (this.querySpec && this._isHandleObject(sourceData)) {
        // Extract data using querySpec and Handle
        placeholderValues = this._extractDataWithHandle(sourceData, options);
      } else if (this.querySpec && typeof sourceData === 'object' && sourceData !== null) {
        // Create Handle from plain object and extract data
        // Wrap single object in array for SimpleObjectDataSource
        const wrappedData = [sourceData];
        const dataSource = new SimpleObjectDataSource(wrappedData);
        const handle = new SimpleObjectHandle(dataSource);
        placeholderValues = this._extractDataWithHandle(handle, options);
      } else {
        // Use sourceData directly as placeholder values
        placeholderValues = sourceData;
      }

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
      // Re-throw strict mode validation errors
      if (options.strict && error.message.includes('Required binding path not found')) {
        throw error;
      }
      
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
      // Transform {{@varname}} to {{varname}} since @ is special in Handlebars
      // Context variables from querySpec are stored without @ prefix
      const transformedTemplate = template.replace(/\{\{@(\w+)\}\}/g, '{{$1}}');

      // Compile the template with Handlebars
      const compiledTemplate = Handlebars.compile(transformedTemplate);

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

  /**
   * Check if an object is a Handle instance
   * @private
   */
  _isHandleObject(obj) {
    // Check if the object has Handle-like methods
    return obj && typeof obj === 'object' && 
           typeof obj.query === 'function' &&
           typeof obj.value === 'function';
  }

  /**
   * Extract data using Handle pattern and querySpec
   * @private
   */
  _extractDataWithHandle(handle, options = {}) {
    const result = {};
    
    // Process bindings
    if (this.querySpec.bindings) {
      for (const [key, binding] of Object.entries(this.querySpec.bindings)) {
        try {
          if (binding.value !== undefined) {
            // Direct value assignment
            result[key] = binding.value;
          } else if (binding.path) {
            // Path-based extraction using Handle
            const value = this._extractPath(handle, binding.path);
            
            // Check for required fields in strict mode
            if (value === undefined && binding.required && options.strict) {
              throw new Error(`Required binding path not found: ${binding.path}`);
            }
            
            // Apply fallback if value is undefined
            if (value === undefined && binding.fallback !== undefined) {
              result[key] = binding.fallback;
            } else if (binding.filter) {
              // Apply filter first, then transform if specified
              const filteredValue = this._applyFilter(value, binding.filter);
              if (binding.transform) {
                result[key] = this._applyTransform(filteredValue, binding.transform, binding.options);
              } else {
                result[key] = filteredValue;
              }
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
    
    // Process context variables (store without @ prefix, they'll be accessed via @key in templates)
    if (this.querySpec.contextVariables) {
      for (const [key, varDef] of Object.entries(this.querySpec.contextVariables)) {
        // Store without @ prefix (Handlebars uses @ for special variables)
        // We'll transform the template to use these values
        if (varDef.value !== undefined) {
          result[key] = varDef.value;
        } else if (varDef.path) {
          result[key] = this._extractPath(handle, varDef.path);
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
    // Get the raw data from the Handle
    let value = handle.value();
    
    // If the value is an array with one item (wrapped object), unwrap it
    if (Array.isArray(value) && value.length === 1) {
      value = value[0];
    }
    
    // Split path and traverse the object
    const parts = path.split('.');
    for (const part of parts) {
      if (value === null || value === undefined) {
        return undefined;
      }
      value = value[part];
    }
    return value;
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
        if (typeof value === 'string' && value.length > maxLength) {
          // If maxLength includes the "..." then subtract 3, otherwise use maxLength as substring length
          const substringLength = maxLength > 3 ? maxLength - 3 : maxLength;
          return value.substring(0, substringLength) + '...';
        }
        return value;
      case 'join':
        const separator = options.separator || ', ';
        if (Array.isArray(value)) {
          return value.map(item => {
            // If item is an object and has a 'name' property, use that
            if (typeof item === 'object' && item !== null && item.name) {
              return item.name;
            }
            // Otherwise convert to string
            return typeof item === 'object' ? JSON.stringify(item) : String(item);
          }).join(separator);
        }
        return value;
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
}