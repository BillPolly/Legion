/**
 * SimplePromptClient - User-friendly interface for common LLM interactions
 * 
 * Provides a clean, intuitive API for chat-based interactions with tools, files,
 * and system prompts without requiring complex pipeline configuration.
 */

import { LLMClient } from './LLMClient.js';

export class SimplePromptClient {
  /**
   * Create a SimplePromptClient
   * @param {Object} config - Configuration options
   * @param {LLMClient} config.llmClient - Optional existing LLMClient instance
   * @param {string} config.provider - Provider type (anthropic, openai, mock)
   * @param {string} config.apiKey - API key for the provider
   * @param {string} config.model - Model to use
   * @param {Object} config.defaultOptions - Default request options
   */
  constructor(config = {}) {
    if (config.llmClient) {
      this.llmClient = config.llmClient;
    } else {
      this.llmClient = new LLMClient({
        provider: config.provider || 'anthropic',
        apiKey: config.apiKey,
        model: config.model,
        maxRetries: config.maxRetries || 3,
        ...config
      });
    }

    this.defaultOptions = {
      maxTokens: 1000,
      temperature: 0.7,
      ...config.defaultOptions
    };
  }

  /**
   * Make a request with system prompt, chat history, tools, and files
   * @param {Object} requestOptions - Request configuration
   * @param {string} requestOptions.prompt - The main user prompt/question
   * @param {string} requestOptions.systemPrompt - System prompt for behavior
   * @param {Array} requestOptions.chatHistory - Previous conversation messages
   * @param {Array} requestOptions.tools - Available tools for the LLM
   * @param {Array} requestOptions.files - Files to include in the request
   * @param {number} requestOptions.maxTokens - Maximum tokens in response
   * @param {number} requestOptions.temperature - Response randomness (0-1)
   * @param {Object} requestOptions.options - Additional provider-specific options
   * @returns {Object} Response with content, toolCalls, and metadata
   */
  async request({
    prompt,
    systemPrompt,
    chatHistory = [],
    tools = [],
    files = [],
    maxTokens,
    temperature,
    ...options
  }) {
    const requestObj = {
      prompt,
      systemPrompt,
      chatHistory,
      tools,
      files,
      maxTokens: maxTokens || this.defaultOptions.maxTokens,
      temperature: temperature !== undefined ? temperature : this.defaultOptions.temperature,
      ...options
    };

    return await this.llmClient.request(requestObj);
  }

  /**
   * Simple chat without additional context - just send a message
   * @param {string} message - The message to send
   * @param {Object} options - Optional parameters
   * @returns {string} The response content
   */
  async chat(message, options = {}) {
    const response = await this.request({
      prompt: message,
      ...options
    });
    
    return response.content;
  }

  /**
   * Chat with system prompt - useful for setting behavior
   * @param {string} message - The message to send  
   * @param {string} systemPrompt - System prompt for behavior
   * @param {Object} options - Optional parameters
   * @returns {string} The response content
   */
  async chatWith(message, systemPrompt, options = {}) {
    const response = await this.request({
      prompt: message,
      systemPrompt,
      ...options
    });
    
    return response.content;
  }

  /**
   * Continue a conversation with chat history
   * @param {string} message - The new message to add
   * @param {Array} chatHistory - Previous conversation messages
   * @param {string} systemPrompt - Optional system prompt
   * @param {Object} options - Optional parameters  
   * @returns {Object} Response with content and updated chat history
   */
  async continueChat(message, chatHistory, systemPrompt, options = {}) {
    const response = await this.request({
      prompt: message,
      chatHistory,
      systemPrompt,
      ...options
    });

    // Return response with updated chat history
    const updatedHistory = [
      ...chatHistory,
      { role: 'user', content: message },
      { role: 'assistant', content: response.content }
    ];

    return {
      ...response,
      chatHistory: updatedHistory
    };
  }

  /**
   * Use tools with a request
   * @param {string} message - The message/task for the LLM
   * @param {Array} tools - Available tools
   * @param {string} systemPrompt - Optional system prompt
   * @param {Object} options - Optional parameters
   * @returns {Object} Response with content and any tool calls
   */
  async useTools(message, tools, systemPrompt, options = {}) {
    return await this.request({
      prompt: message,
      tools,
      systemPrompt,
      ...options
    });
  }

  /**
   * Analyze files with optional tools
   * @param {Array} files - Files to analyze
   * @param {string} prompt - What to do with the files
   * @param {Array} tools - Optional tools for processing
   * @param {Object} options - Optional parameters
   * @returns {Object} Response with file analysis
   */
  async analyzeFiles(files, prompt, tools = [], options = {}) {
    return await this.request({
      prompt,
      files,
      tools,
      systemPrompt: options.systemPrompt || "You are a helpful assistant that analyzes files and provides insights.",
      ...options
    });
  }

  /**
   * Get provider capabilities
   * @returns {Object} Provider capabilities
   */
  getCapabilities() {
    return this.llmClient.getProviderCapabilities();
  }

  /**
   * Get the underlying LLMClient for advanced usage
   * @returns {LLMClient} The underlying LLMClient instance
   */
  getLLMClient() {
    return this.llmClient;
  }
}