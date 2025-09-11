import { AnthropicProvider } from './providers/AnthropicProvider.js';
import { MockProvider } from './providers/MockProvider.js';
import { OpenAIProvider } from './providers/OpenAIProvider.js';
import { DeepSeekProvider } from './providers/DeepSeekProvider.js';
import { OpenRouterProvider } from './providers/OpenRouterProvider.js';
import { SimpleEmitter } from '../../../tools-registry/src/core/SimpleEmitter.js';

/**
 * Configuration options for the LLM client
 */
export class LLMClientConfig {
  constructor() {
    this.provider = 'anthropic';
    this.apiKey = undefined;
    this.model = undefined;
    this.maxRetries = 3;
    this.baseDelay = 1000;
    this.serverErrorDelay = 5000;
  }
}

/**
 * Error thrown when maximum retry attempts are exceeded for LLM operations
 */
export class MaxRetriesExceededError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MaxRetriesExceededError';
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, MaxRetriesExceededError);
    }
  }
}

/**
 * Error thrown when validation of data or responses fails
 */
export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ValidationError);
    }
  }
}

/**
 * Response validator function type - takes response string, returns boolean
 */
export const ResponseValidator = () => {};

/**
 * Robust LLM client with retry logic and error handling for knowledge graph construction
 */
export class LLMClient {
  constructor(config = {}) {
    this.eventEmitter = new SimpleEmitter();
    
    // Generate unique client ID
    this.clientId = `llm-client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.interactionCounter = 0;
    
    // Initialize provider based on config
    const providerType = config.provider || 'anthropic';
    
    switch (providerType) {
      case 'anthropic':
        if (!config.apiKey) {
          throw new Error('API key is required for Anthropic provider');
        }
        this.provider = new AnthropicProvider(config.apiKey, config.baseURL);
        break;
      case 'openai':
        if (!config.apiKey) {
          throw new Error('API key is required for OpenAI provider');
        }
        this.provider = new OpenAIProvider(config.apiKey);
        break;
      case 'mock':
        this.provider = new MockProvider();
        break;
      case 'deepseek':
        if (!config.apiKey) {
          throw new Error('API key is required for DeepSeek provider');
        }
        this.provider = new DeepSeekProvider(config.apiKey);
        break;
      case 'openrouter':
        if (!config.apiKey) {
          throw new Error('API key is required for OpenRouter provider');
        }
        this.provider = new OpenRouterProvider(config.apiKey);
        break;
      default:
        throw new Error(`Unknown provider: ${providerType}`);
    }

    this.model = config.model || 'claude-3-sonnet-20240229';
    this.maxRetries = config.maxRetries !== undefined ? config.maxRetries : 3;
    this.baseDelay = config.baseDelay || 2000; // Increased for slower API
    this.serverErrorDelay = config.serverErrorDelay || 8000; // Increased for rate limiting
  }

  /**
   * Standard completion with retry logic and error handling
   */
  async complete(prompt, maxTokens = 4000) {
    const interactionId = `llm-${++this.interactionCounter}-${Date.now()}`;
    const timestamp = new Date().toISOString();
    
    // Log the request with client ID and short prompt snippet
    const promptSnippet = prompt.length > 50 ? prompt.substring(0, 50) + '...' : prompt;
    console.log(`[LLMClient ${this.clientId}] REQUEST ${timestamp}: "${promptSnippet}"`);
    
    // Emit request event
    this.emitInteractionEvent({
      id: interactionId,
      timestamp,
      type: 'request',
      prompt,
      model: this.model,
      provider: this.provider.getProviderName(),
      attempt: 1,
      maxTokens
    });

    // Handle zero maxRetries case
    if (this.maxRetries === 0) {
      const error = new MaxRetriesExceededError(`Failed after ${this.maxRetries} attempts`);
      this.emitInteractionEvent({
        id: interactionId,
        timestamp: new Date().toISOString(),
        type: 'error',
        prompt,
        error: error.message,
        model: this.model,
        provider: this.provider.getProviderName(),
        attempt: 1
      });
      throw error;
    }
    
    let lastError;
    
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const response = await this.provider.complete(prompt, this.model, maxTokens);
        
        // Log the response with client ID and short response snippet
        const responseSnippet = response.length > 50 ? response.substring(0, 50) + '...' : response;
        console.log(`[LLMClient ${this.clientId}] RESPONSE ${new Date().toISOString()}: "${responseSnippet}"`);
        
        // Emit successful response event
        this.emitInteractionEvent({
          id: interactionId,
          timestamp: new Date().toISOString(),
          type: 'response',
          prompt,
          response,
          model: this.model,
          provider: this.provider.getProviderName(),
          attempt: attempt + 1
        });
        
        return response;
        
      } catch (error) {
        lastError = error;
        
        // Emit error event for this attempt
        this.emitInteractionEvent({
          id: `${interactionId}-attempt-${attempt + 1}`,
          timestamp: new Date().toISOString(),
          type: 'error',
          prompt,
          error: error.message,
          model: this.model,
          provider: this.provider.getProviderName(),
          attempt: attempt + 1
        });
        
        if (error.status === 429) { // Rate limit
          if (attempt < this.maxRetries - 1) {
            await this.sleep(this.calculateBackoffDelay(attempt));
            continue;
          }
        } else if (error.status >= 500) { // Server error
          if (attempt < this.maxRetries - 1) {
            await this.sleep(this.serverErrorDelay);
            continue;
          }
        } else {
          // Client errors (4xx except 429) - don't retry
          throw error;
        }
      }
    }
    
    throw new MaxRetriesExceededError(`Failed after ${this.maxRetries} attempts`);
  }

  /**
   * Emit interaction event
   */
  emitInteractionEvent(event) {
    this.eventEmitter.emit('interaction', event);
  }

  /**
   * Subscribe to events (SimpleEmitter pattern)
   * @param {Function} callback - Function to call with (eventName, eventData)
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    return this.eventEmitter.subscribe(callback);
  }

  /**
   * Unified request method that accepts rich request objects and adapts to provider capabilities
   * @param {Object} requestObj - Rich request object with all desired features
   * @param {Object} options - Additional options
   * @returns {Object} Unified response object
   */
  async request(requestObj, options = {}) {
    // Get provider capabilities
    const capabilities = this.getProviderCapabilities();
    
    // Adapt the request to the provider
    const adaptedRequest = this.adaptRequestToProvider(requestObj, capabilities);
    
    // Execute the adapted request
    const response = await this.executeAdaptedRequest(adaptedRequest, requestObj, options);
    
    // Return unified response format
    return this.normalizeResponse(response, requestObj, adaptedRequest);
  }

  /**
   * Get the current provider's capabilities
   * @returns {Object} Provider capabilities
   */
  getProviderCapabilities() {
    const providerName = this.provider.getProviderName();
    
    // Define capabilities by provider type
    const capabilityMap = {
      'openai': {
        tools: true,
        chatHistory: true,
        systemPrompts: true,
        files: { text: true, images: true, documents: false },
        parameters: ['temperature', 'topP', 'maxTokens', 'frequencyPenalty', 'presencePenalty'],
        responseFormats: ['text', 'json_object']
      },
      'anthropic': {
        tools: true, // Converted to XML format
        chatHistory: true,
        systemPrompts: true,
        files: { text: true, images: true, documents: false },
        parameters: ['temperature', 'maxTokens'],
        responseFormats: ['text']
      },
      'mock': {
        tools: false,
        chatHistory: false,
        systemPrompts: false,
        files: { text: false, images: false, documents: false },
        parameters: ['maxTokens'],
        responseFormats: ['text']
      },
      'deepseek': {
        tools: true,
        chatHistory: true,
        systemPrompts: true,
        files: { text: true, images: false, documents: false },
        parameters: ['temperature', 'topP', 'maxTokens'],
        responseFormats: ['text', 'json_object']
      },
      'openrouter': {
        tools: true,
        chatHistory: true,
        systemPrompts: true,
        files: { text: true, images: true, documents: false },
        parameters: ['temperature', 'topP', 'maxTokens', 'frequencyPenalty', 'presencePenalty'],
        responseFormats: ['text', 'json_object']
      }
    };

    return capabilityMap[providerName] || capabilityMap['mock'];
  }

  /**
   * Adapt rich request object to provider-specific format
   * @param {Object} requestObj - Rich request object
   * @param {Object} capabilities - Provider capabilities
   * @returns {Object} Adapted request
   */
  adaptRequestToProvider(requestObj, capabilities) {
    const adapted = {
      model: this.model,
      maxTokens: requestObj.maxTokens || 1000,
      adaptations: []
    };

    // Handle different provider types
    const providerName = this.provider.getProviderName();
    
    if (providerName === 'openai' || providerName === 'deepseek' || providerName === 'openrouter') {
      return this.adaptForOpenAI(requestObj, capabilities, adapted);
    } else if (providerName === 'anthropic') {
      return this.adaptForAnthropic(requestObj, capabilities, adapted);
    } else {
      return this.adaptForBasicProvider(requestObj, capabilities, adapted);
    }
  }

  /**
   * Adapt request for OpenAI provider (full feature support)
   */
  adaptForOpenAI(requestObj, capabilities, adapted) {
    adapted.messages = [];

    // Add system prompt as system message
    if (requestObj.systemPrompt) {
      adapted.messages.push({ role: 'system', content: requestObj.systemPrompt });
    }

    // Add chat history
    if (requestObj.chatHistory && Array.isArray(requestObj.chatHistory)) {
      adapted.messages.push(...requestObj.chatHistory);
    }

    // Add tools natively
    if (requestObj.tools && Array.isArray(requestObj.tools)) {
      adapted.tools = requestObj.tools.map(tool => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters
        }
      }));
      adapted.tool_choice = requestObj.toolChoice || 'auto';
    }

    // Handle files by injecting content into messages
    let fileContent = '';
    if (requestObj.files && Array.isArray(requestObj.files)) {
      fileContent = requestObj.files.map(file => 
        `File ${file.name}:\n${file.content}\n`
      ).join('\n');
      adapted.adaptations.push('files_as_text');
    }

    // Add user prompt with file content
    const userContent = [fileContent, requestObj.prompt].filter(Boolean).join('\n\n');
    if (userContent) {
      adapted.messages.push({ role: 'user', content: userContent });
    }

    // Add supported parameters
    if (requestObj.temperature !== undefined) adapted.temperature = requestObj.temperature;
    if (requestObj.topP !== undefined) adapted.top_p = requestObj.topP;
    if (requestObj.frequencyPenalty !== undefined) adapted.frequency_penalty = requestObj.frequencyPenalty;
    if (requestObj.presencePenalty !== undefined) adapted.presence_penalty = requestObj.presencePenalty;

    return adapted;
  }

  /**
   * Adapt request for Anthropic provider (partial native support)
   */
  adaptForAnthropic(requestObj, capabilities, adapted) {
    adapted.messages = [];

    // Build system prompt with tools as XML descriptions
    let systemContent = requestObj.systemPrompt || '';
    
    if (requestObj.tools && Array.isArray(requestObj.tools)) {
      const toolsXML = requestObj.tools.map(tool => 
        `<tool name="${tool.name}">\n<description>${tool.description}</description>\n<parameters>${JSON.stringify(tool.parameters, null, 2)}</parameters>\n</tool>`
      ).join('\n\n');
      
      systemContent += `\n\nAvailable tools:\n${toolsXML}\n\nTo use a tool, respond with: <tool_use name="tool_name" parameters='{"param": "value"}'></tool_use>`;
      adapted.adaptations.push('tools_as_xml');
    }

    if (systemContent) {
      adapted.system = systemContent;
    }

    // Add chat history
    if (requestObj.chatHistory && Array.isArray(requestObj.chatHistory)) {
      adapted.messages.push(...requestObj.chatHistory.filter(msg => msg.role !== 'system'));
    }

    // Handle files by injecting content into messages
    let fileContent = '';
    if (requestObj.files && Array.isArray(requestObj.files)) {
      fileContent = requestObj.files.map(file => 
        `File ${file.name}:\n${file.content}\n`
      ).join('\n');
      adapted.adaptations.push('files_as_text');
    }

    // Add user prompt with file content
    const userContent = [fileContent, requestObj.prompt].filter(Boolean).join('\n\n');
    if (userContent) {
      adapted.messages.push({ role: 'user', content: userContent });
    }

    // Add supported parameters
    if (requestObj.temperature !== undefined) adapted.temperature = requestObj.temperature;
    adapted.max_tokens = adapted.maxTokens;

    return adapted;
  }

  /**
   * Adapt request for basic providers (text-only fallback)
   */
  adaptForBasicProvider(requestObj, capabilities, adapted) {
    let prompt = '';

    // Add system prompt
    if (requestObj.systemPrompt) {
      prompt += `${requestObj.systemPrompt}\n\n`;
    }

    // Add chat history as conversation
    if (requestObj.chatHistory && Array.isArray(requestObj.chatHistory)) {
      const conversation = requestObj.chatHistory.map(msg => 
        `${msg.role.charAt(0).toUpperCase() + msg.role.slice(1)}: ${msg.content}`
      ).join('\n');
      prompt += `Previous conversation:\n${conversation}\n\n`;
      adapted.adaptations.push('chat_history_as_text');
    }

    // Add file content
    if (requestObj.files && Array.isArray(requestObj.files)) {
      const fileContent = requestObj.files.map(file => 
        `File ${file.name}:\n${file.content}\n`
      ).join('\n');
      prompt += `Files:\n${fileContent}\n\n`;
      adapted.adaptations.push('files_as_text');
    }

    // Add tools as descriptions
    if (requestObj.tools && Array.isArray(requestObj.tools)) {
      const toolDescriptions = requestObj.tools.map(tool => 
        `- ${tool.name}: ${tool.description}`
      ).join('\n');
      prompt += `Available tools:\n${toolDescriptions}\n\n`;
      adapted.adaptations.push('tools_as_descriptions');
    }

    // Add user prompt
    if (requestObj.prompt) {
      prompt += `User: ${requestObj.prompt}\nAssistant:`;
    }

    adapted.prompt = prompt;
    return adapted;
  }

  /**
   * Execute the adapted request using the appropriate provider method
   */
  async executeAdaptedRequest(adaptedRequest, originalRequest, options) {
    const providerName = this.provider.getProviderName();
    
    // Use provider's native message-based API if available
    if ((providerName === 'openai' || providerName === 'anthropic' || providerName === 'deepseek' || providerName === 'openrouter') && this.provider.completeMessages) {
      if (adaptedRequest.messages) {
        return await this.provider.completeMessages(
          adaptedRequest.messages, 
          this.model, 
          {
            maxTokens: adaptedRequest.maxTokens,
            temperature: adaptedRequest.temperature,
            topP: adaptedRequest.top_p,
            frequencyPenalty: adaptedRequest.frequency_penalty,
            presencePenalty: adaptedRequest.presence_penalty,
            tools: adaptedRequest.tools,
            toolChoice: adaptedRequest.tool_choice,
            system: adaptedRequest.system
          }
        );
      }
    }
    
    // Fallback to simple completion for basic providers or when messages not available
    const prompt = adaptedRequest.prompt || this.messagesToPrompt(adaptedRequest.messages || []);
    return await this.complete(prompt, adaptedRequest.maxTokens);
  }

  /**
   * Convert messages array to simple prompt (fallback)
   */
  messagesToPrompt(messages) {
    return messages.map(msg => {
      if (msg.role === 'system') return msg.content;
      return `${msg.role.charAt(0).toUpperCase() + msg.role.slice(1)}: ${msg.content}`;
    }).join('\n');
  }

  /**
   * Normalize response to unified format
   */
  normalizeResponse(response, originalRequest, adaptedRequest) {
    return {
      content: response,
      toolCalls: this.extractToolCalls(response),
      metadata: {
        model: this.model,
        provider: this.provider.getProviderName(),
        adaptations: adaptedRequest.adaptations || []
      }
    };
  }

  /**
   * Extract tool calls from response (basic implementation)
   */
  extractToolCalls(response) {
    const toolCalls = [];
    
    // Look for Anthropic-style tool usage
    const toolRegex = /<tool_use name="([^"]+)" parameters='([^']+)'><\/tool_use>/g;
    let match;
    
    while ((match = toolRegex.exec(response)) !== null) {
      try {
        const parameters = JSON.parse(match[2]);
        toolCalls.push({
          name: match[1],
          args: parameters,
          id: `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        });
      } catch (e) {
        // Invalid JSON in tool parameters
      }
    }
    
    return toolCalls.length > 0 ? toolCalls : undefined;
  }

  /**
   * Complete with custom validation of response
   */
  async completeWithValidation(prompt, validator, maxTokens = 1000) {
    let currentPrompt = prompt;
    
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      const response = await this.complete(currentPrompt, maxTokens);
      
      if (validator(response)) {
        return response;
      }
      
      currentPrompt += `\n\nPrevious response was invalid: ${response}\nPlease correct and respond again.`;
    }
    
    throw new ValidationError(`Failed to get valid response after ${this.maxRetries} attempts`);
  }

  /**
   * Complete with JSON response validation
   */
  async completeWithJsonValidation(prompt, maxTokens = 1000) {
    const jsonValidator = (response) => {
      try {
        // Look for both JSON objects {} and JSON arrays []
        const jsonMatch = response.match(/[\{\[][\s\S]*[\}\]]/);
        if (!jsonMatch) return false;
        JSON.parse(jsonMatch[0]);
        return true;
      } catch {
        return false;
      }
    };

    return this.completeWithValidation(prompt, jsonValidator, maxTokens);
  }

  /**
   * Calculate exponential backoff delay
   */
  calculateBackoffDelay(attempt) {
    return this.baseDelay * Math.pow(2, attempt);
  }

  /**
   * Sleep for specified milliseconds
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get the current model being used
   */
  get currentModel() {
    return this.model;
  }

  /**
   * Get the maximum number of retries configured
   */
  get maxRetriesConfigured() {
    return this.maxRetries;
  }

  /**
   * Get available models from the current provider
   */
  async getAvailableModels() {
    return await this.provider.getAvailableModels();
  }

  /**
   * Get provider name
   */
  getProviderName() {
    return this.provider.getProviderName();
  }

  /**
   * Update the model being used
   */
  updateModel(model) {
    this.model = model;
  }

  /**
   * Generate embeddings for given text (requires provider that supports embeddings)
   */
  async generateEmbeddings(text, model) {
    if (!this.provider.generateEmbeddings) {
      throw new Error(`Provider ${this.provider.getProviderName()} does not support embeddings`);
    }

    const interactionId = `embedding-${++this.interactionCounter}-${Date.now()}`;
    const timestamp = new Date().toISOString();
    
    // Log the request
    const textSample = Array.isArray(text) ? `[${text.length} texts]` : text.substring(0, 50) + '...';
    console.log(`[LLMClient ${this.clientId}] EMBEDDING REQUEST ${timestamp}: "${textSample}"`);

    try {
      const embeddings = await this.provider.generateEmbeddings(text, model);
      
      // Log successful response
      console.log(`[LLMClient ${this.clientId}] EMBEDDING RESPONSE ${new Date().toISOString()}: Generated ${embeddings.length} embeddings`);
      
      return embeddings;
      
    } catch (error) {
      console.error(`[LLMClient ${this.clientId}] EMBEDDING ERROR ${new Date().toISOString()}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if the current provider supports embeddings
   */
  supportsEmbeddings() {
    return !!this.provider.generateEmbeddings;
  }

  /**
   * Check if the current provider supports image generation
   */
  supportsImageGeneration() {
    // Currently only OpenAI provider supports image generation
    return this.provider.getProviderName() === 'openai';
  }

  /**
   * Generate an image using DALL-E (OpenAI only)
   */
  async generateImage(params) {
    if (!this.supportsImageGeneration()) {
      throw new Error(`Provider ${this.provider.getProviderName()} does not support image generation`);
    }

    // OpenAI-specific image generation
    if (this.provider.getProviderName() === 'openai') {
      return await this.provider.generateImage(params);
    }
  }
}