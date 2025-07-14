/**
 * LLMClient - Wrapper for LLM providers with planning-specific features
 */

import { EventEmitter } from 'events';
import { ResponseParser } from '../utils/ResponseParser.js';

class LLMClient extends EventEmitter {
  constructor(config = {}) {
    super();
    
    if (!config.provider) {
      throw new Error('Provider is required');
    }

    this.provider = config.provider;
    this.responseParser = new ResponseParser();
    
    this.config = {
      maxRetries: config.maxRetries || 3,
      timeout: config.timeout || 30000,
      temperature: config.temperature || 0.7,
      backoffMultiplier: config.backoffMultiplier || 1000,
      ...config
    };

    this.tokenUsage = {
      total: 0,
      prompt: 0,
      completion: 0
    };

    this.middleware = {
      request: [],
      response: []
    };

    this.cache = null;
    this.cacheOptions = {};
  }

  /**
   * Complete a prompt
   * @param {string|Array} prompt - Prompt string or messages array
   * @param {Object} options - Completion options
   * @returns {Promise<string>} Completion result
   */
  async complete(prompt, options = {}) {
    const messages = this._prepareMessages(prompt, options);
    
    // Check cache first
    if (this.cache) {
      const cacheKey = JSON.stringify(messages);
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.cacheOptions.ttl) {
        return cached.response;
      }
    }

    const request = this._prepareRequest(messages, options);

    // Apply request middleware
    const processedRequest = await this._applyMiddleware('request', request);

    // Handle streaming with callback
    if (options.streaming && options.onChunk) {
      return this._completeStreamingWithCallback(processedRequest, options);
    }

    // Retry logic
    let lastError;
    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        const response = await this._executeWithTimeout(
          () => this.provider.complete(processedRequest),
          options.timeout || this.config.timeout
        );

        // Apply response middleware
        const processedResponse = await this._applyMiddleware('response', response);

        // Track token usage
        if (response.usage) {
          this.tokenUsage.total += response.usage.total_tokens || 0;
          this.tokenUsage.prompt += response.usage.prompt_tokens || 0;
          this.tokenUsage.completion += response.usage.completion_tokens || 0;
        }

        const content = this._extractContent(processedResponse);
        
        // Cache the response
        if (this.cache) {
          const cacheKey = JSON.stringify(messages);
          this.cache.set(cacheKey, {
            response: content,
            timestamp: Date.now()
          });

          // Evict old entries if cache is full
          if (this.cache.size > this.cacheOptions.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
          }
        }

        return content;
      } catch (error) {
        lastError = error;
        this.emit('error', error);

        if (attempt < this.config.maxRetries - 1) {
          const delay = Math.min(
            this.config.backoffMultiplier * Math.pow(2, attempt),
            10000
          );
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  /**
   * Complete and parse JSON response
   * @param {string} prompt - Prompt
   * @param {Object} options - Options including schema
   * @returns {Promise<Object>} Parsed JSON
   */
  async completeJSON(prompt, options = {}) {
    const enhancedPrompt = this._enhancePromptForJSON(prompt);
    const response = await this.complete(enhancedPrompt, options);

    // Parse response
    const parsed = this.responseParser.parse(response);
    if (!parsed) {
      throw new Error('Failed to parse JSON response');
    }

    // Validate against schema if provided
    if (options.schema) {
      const isValid = this.responseParser.validate(parsed, options.schema);
      if (!isValid) {
        const errors = this.responseParser.getValidationErrors(parsed, options.schema);
        throw new Error(`Validation failed: ${JSON.stringify(errors)}`);
      }
    }

    return parsed;
  }

  /**
   * Stream completion
   * @param {string|Array} prompt - Prompt
   * @param {Object} options - Options
   * @returns {AsyncGenerator} Stream of chunks
   */
  async* completeStreaming(prompt, options = {}) {
    const messages = this._prepareMessages(prompt, options);
    const request = this._prepareRequest(messages, options);

    const stream = this.provider.completeStreaming(request);
    
    for await (const chunk of stream) {
      yield chunk;
    }
  }

  /**
   * Create a plan
   * @param {Object} params - Planning parameters
   * @returns {Promise<Object>} Generated plan
   */
  async createPlan(params) {
    const prompt = this._buildPlanningPrompt(params);
    const plan = await this.completeJSON(prompt, {
      schema: {
        name: { required: true, type: 'string' },
        steps: { required: true, type: 'array' }
      }
    });

    return this._normalizePlan(plan);
  }

  /**
   * Refine an existing plan
   * @param {Object} plan - Original plan
   * @param {Object} options - Refinement options
   * @returns {Promise<Object>} Refined plan
   */
  async refinePlan(plan, options = {}) {
    const prompt = this._buildRefinementPrompt(plan, options);
    const refined = await this.completeJSON(prompt);
    return this._normalizePlan(refined);
  }

  /**
   * Validate a plan
   * @param {Object} plan - Plan to validate
   * @returns {Promise<Object>} Validation result
   */
  async validatePlan(plan) {
    const prompt = this._buildValidationPrompt(plan);
    return await this.completeJSON(prompt, {
      schema: {
        isValid: { required: true, type: 'boolean' },
        issues: { required: false, type: 'array' },
        suggestions: { required: false, type: 'array' }
      }
    });
  }

  /**
   * Estimate tokens for text
   * @param {string} text - Text to estimate
   * @returns {number} Estimated token count
   */
  estimateTokens(text) {
    // Simple estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Get token usage statistics
   * @returns {Object} Token usage
   */
  getTokenUsage() {
    return { ...this.tokenUsage };
  }

  /**
   * Enable response caching
   * @param {Object} options - Cache options
   */
  enableCache(options = {}) {
    this.cache = new Map();
    this.cacheOptions = {
      ttl: options.ttl || 3600000, // 1 hour default
      maxSize: options.maxSize || 100
    };
  }

  /**
   * Add middleware
   * @param {string} type - Middleware type (request/response)
   * @param {Function} fn - Middleware function
   */
  use(type, fn) {
    if (this.middleware[type]) {
      this.middleware[type].push(fn);
    }
  }

  // Private methods

  _prepareMessages(prompt, options) {
    if (Array.isArray(prompt)) {
      return prompt;
    }

    const messages = [];
    
    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }

    messages.push({ role: 'user', content: prompt });
    
    return messages;
  }

  _prepareRequest(messages, options) {
    const request = {
      messages,
      temperature: options.temperature || this.config.temperature,
      max_tokens: options.maxTokens || this.provider.maxTokens,
      ...options
    };

    // Truncate if needed
    if (options.maxTokens) {
      const totalTokens = messages.reduce((sum, msg) => 
        sum + this.estimateTokens(msg.content), 0
      );
      
      if (totalTokens > options.maxTokens * 0.8) {
        // Truncate messages to fit
        request.messages = this._truncateMessages(messages, options.maxTokens);
      }
    }

    return request;
  }

  _truncateMessages(messages, maxTokens) {
    const targetTokens = Math.floor(maxTokens * 0.7);
    let currentTokens = 0;
    const truncated = [];

    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      const tokens = this.estimateTokens(msg.content);
      
      if (currentTokens + tokens <= targetTokens) {
        truncated.unshift(msg);
        currentTokens += tokens;
      } else {
        // Truncate this message
        const remainingTokens = targetTokens - currentTokens;
        const charLimit = remainingTokens * 4;
        truncated.unshift({
          ...msg,
          content: msg.content.substring(0, charLimit) + '...'
        });
        break;
      }
    }

    return truncated;
  }

  async _executeWithTimeout(fn, timeout) {
    return Promise.race([
      fn(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), timeout)
      )
    ]);
  }

  _extractContent(response) {
    if (response.choices && response.choices[0] && response.choices[0].message) {
      return response.choices[0].message.content;
    }
    
    throw new Error('Invalid response format');
  }

  async _completeStreamingWithCallback(request, options) {
    const chunks = [];
    const stream = this.provider.completeStreaming(request);

    for await (const chunk of stream) {
      chunks.push(chunk.content);
      if (options.onChunk) {
        options.onChunk(chunk);
      }
    }

    return chunks.join('');
  }

  async _applyMiddleware(type, data) {
    let processed = data;
    
    for (const middleware of this.middleware[type]) {
      processed = await middleware(processed);
    }
    
    return processed;
  }

  _enhancePromptForJSON(prompt) {
    return `${prompt}

Please respond with valid JSON only. Do not include any explanatory text outside the JSON structure.`;
  }

  _buildPlanningPrompt(params) {
    return `Create a detailed implementation plan for the following task:

Task: ${params.task}
Requirements: ${JSON.stringify(params.requirements, null, 2)}
${params.constraints ? `Constraints: ${JSON.stringify(params.constraints, null, 2)}` : ''}

Generate a structured plan with:
- A descriptive name
- Ordered steps with clear actions
- Dependencies between steps
- Estimated duration for each step

Respond with a JSON object containing 'name' and 'steps' array.`;
  }

  _buildRefinementPrompt(plan, options) {
    return `Please refine the following plan based on the feedback provided:

Original Plan:
${JSON.stringify(plan, null, 2)}

Feedback: ${options.feedback}
${options.additionalRequirements ? `Additional Requirements: ${JSON.stringify(options.additionalRequirements, null, 2)}` : ''}

Provide an improved version of the plan that addresses the feedback while maintaining the overall structure.`;
  }

  _buildValidationPrompt(plan) {
    return `Please validate the following plan:

${JSON.stringify(plan, null, 2)}

Check for:
- Completeness of steps
- Logical dependencies
- Missing actions
- Potential issues

Respond with a JSON object containing:
- isValid (boolean)
- issues (array of identified problems)
- suggestions (array of improvement suggestions)`;
  }

  _normalizePlan(plan) {
    return {
      name: plan.name || 'Untitled Plan',
      version: plan.version || '1.0.0',
      steps: (plan.steps || []).map((step, index) => ({
        id: step.id || `step-${index + 1}`,
        name: step.name || `Step ${index + 1}`,
        type: step.type || 'implementation',
        description: step.description || '',
        dependencies: step.dependencies || [],
        actions: step.actions || [],
        estimatedDuration: step.estimatedDuration || 30
      })),
      metadata: plan.metadata || {},
      context: plan.context || {}
    };
  }
}

export { LLMClient };