/**
 * TemplatedPrompt - A unified prompting facility for template substitution and LLM calling
 */

export default class TemplatedPrompt {
  constructor(template, options = {}) {
    if (!template || typeof template !== 'string') {
      throw new Error('Template must be a non-empty string');
    }
    
    this.template = template;
    this.name = options.name || 'unnamed';
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.schema = options.schema || null;
    this.validator = options.validator || null;
    this.systemPrompt = options.systemPrompt || null;
    this.temperature = options.temperature ?? 0.7;
    this.maxTokens = options.maxTokens || 4000;
  }

  /**
   * Substitute placeholders in the template with provided values
   */
  substitute(variables = {}) {
    if (!variables || typeof variables !== 'object') {
      throw new Error('Variables must be an object');
    }

    let result = this.template;
    
    // Find all placeholders in the template
    const placeholders = this.template.match(/\{\{(\w+)\}\}/g) || [];
    const uniquePlaceholders = [...new Set(placeholders)];
    
    // Track which placeholders were replaced
    const replaced = new Set();
    
    // Replace each placeholder
    for (const placeholder of uniquePlaceholders) {
      const key = placeholder.slice(2, -2); // Remove {{ and }}
      
      if (key in variables) {
        const value = variables[key];
        // Handle undefined, null, and empty string specially
        const replacement = value === undefined || value === null ? '' : String(value);
        result = result.replace(new RegExp(placeholder, 'g'), replacement);
        replaced.add(key);
      }
    }
    
    // Find unreplaced required placeholders
    const unreplaced = uniquePlaceholders
      .map(p => p.slice(2, -2))
      .filter(key => !replaced.has(key) && !this.isOptionalPlaceholder(key));
    
    if (unreplaced.length > 0 && !variables.allowPartial) {
      throw new Error(`Missing required template variables: ${unreplaced.join(', ')}`);
    }
    
    return result;
  }

  /**
   * Check if a placeholder is optional
   */
  isOptionalPlaceholder(key) {
    // Common optional placeholders
    const optionalKeys = [
      'artifactsSection',
      'toolsSection', 
      'outputPrompt',
      'instructions',
      'taskIntro',
      'classificationReasoning',
      'suggestedApproach'
    ];
    return optionalKeys.includes(key);
  }

  /**
   * Format the prompt for LLM consumption
   */
  format(variables = {}) {
    const content = this.substitute(variables);
    
    const messages = [];
    
    // Add system prompt if provided
    if (this.systemPrompt) {
      messages.push({
        role: 'system',
        content: this.systemPrompt
      });
    }
    
    // Add the main content
    messages.push({
      role: 'user',
      content: content
    });
    
    return messages;
  }

  /**
   * Call the LLM with the formatted prompt
   */
  async call(llmClient, variables = {}, options = {}) {
    if (!llmClient) {
      throw new Error('LLM client is required');
    }

    const messages = this.format(variables);
    const temperature = options.temperature ?? this.temperature;
    const maxTokens = options.maxTokens ?? this.maxTokens;
    
    let lastError = null;
    let attempts = 0;
    
    while (attempts < this.maxRetries) {
      attempts++;
      
      try {
        // Call LLM with appropriate method
        let response;
        if (typeof llmClient.complete === 'function') {
          // Simple complete method
          response = await llmClient.complete(
            messages[messages.length - 1].content,
            {
              temperature,
              maxTokens,
              systemPrompt: this.systemPrompt
            }
          );
        } else if (typeof llmClient.chat === 'function') {
          // Chat method
          response = await llmClient.chat(messages, {
            temperature,
            maxTokens
          });
        } else if (typeof llmClient.invoke === 'function') {
          // Invoke method
          response = await llmClient.invoke({
            messages,
            temperature,
            maxTokens
          });
        } else {
          throw new Error('LLM client does not have a recognized method (complete, chat, or invoke)');
        }
        
        // Validate response if validator provided
        if (this.validator && response) {
          const validation = await this.validate(response);
          if (!validation.valid) {
            if (attempts < this.maxRetries) {
              lastError = new Error(`Validation failed: ${validation.error}`);
              await this.delay(this.retryDelay * attempts); // Exponential backoff
              continue;
            } else {
              throw new Error(`Validation failed: ${validation.error}`);
            }
          }
          return validation.data || response;
        }
        
        return response;
        
      } catch (error) {
        lastError = error;
        
        // If validation error and we have retries left, try again
        if (error.message?.includes('Validation failed') && attempts < this.maxRetries) {
          await this.delay(this.retryDelay * attempts); // Exponential backoff
          continue;
        }
        
        // For other errors, throw immediately
        throw error;
      }
    }
    
    // If we get here, all retries failed
    throw new Error(`Failed after ${this.maxRetries} attempts: ${lastError?.message || 'Unknown error'}`);
  }

  /**
   * Validate a response
   */
  async validate(response) {
    if (!this.validator) {
      return { valid: true, data: response };
    }

    // If validator is a function, call it
    if (typeof this.validator === 'function') {
      try {
        const result = await this.validator(response);
        if (typeof result === 'boolean') {
          return { valid: result, data: result ? response : null };
        }
        return result;
      } catch (error) {
        return { valid: false, error: error.message };
      }
    }

    // If validator has a validate method
    if (typeof this.validator.validate === 'function') {
      return this.validator.validate(response);
    }

    // If validator has a parseAndValidate method  
    if (typeof this.validator.parseAndValidate === 'function') {
      return this.validator.parseAndValidate(response);
    }

    return { valid: true, data: response };
  }

  /**
   * Helper method for delays
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clone this prompt with new options
   */
  clone(options = {}) {
    return new TemplatedPrompt(this.template, {
      name: options.name || this.name,
      maxRetries: options.maxRetries ?? this.maxRetries,
      retryDelay: options.retryDelay ?? this.retryDelay,
      schema: options.schema || this.schema,
      validator: options.validator || this.validator,
      systemPrompt: options.systemPrompt || this.systemPrompt,
      temperature: options.temperature ?? this.temperature,
      maxTokens: options.maxTokens ?? this.maxTokens
    });
  }

  /**
   * Get all placeholders in the template
   */
  getPlaceholders() {
    const matches = this.template.match(/\{\{(\w+)\}\}/g) || [];
    return [...new Set(matches.map(m => m.slice(2, -2)))];
  }

  /**
   * Check if template has a specific placeholder
   */
  hasPlaceholder(key) {
    return this.template.includes(`{{${key}}}`);
  }
}