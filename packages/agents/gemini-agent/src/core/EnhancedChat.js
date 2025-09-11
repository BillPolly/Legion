/**
 * EnhancedChat - Ported from Gemini CLI geminiChat.ts to Legion patterns
 * Provides sophisticated chat management with retry logic and validation
 */

/**
 * Stream event types (ported from Gemini CLI)
 */
export const StreamEventType = {
  CHUNK: 'chunk',
  RETRY: 'retry'
};

/**
 * Enhanced chat class with retry logic and validation (ported from Gemini CLI)
 */
export class EnhancedChat {
  constructor(resourceManager, chatRecordingService) {
    this.resourceManager = resourceManager;
    this.chatRecordingService = chatRecordingService;
    
    // Chat configuration (ported from Gemini CLI)
    this.generationConfig = {
      temperature: 0.1,
      topP: 1,
      maxOutputTokens: 100000
    };
    
    // Chat history and state
    this.history = [];
    this.tools = [];
    this.isInitialized = false;
    
    // Retry configuration (ported from Gemini CLI)
    this.retryConfig = {
      maxAttempts: 3,
      initialDelayMs: 500,
      shouldRetry: this._shouldRetry.bind(this)
    };
  }

  /**
   * Initialize chat session (ported from Gemini CLI)
   */
  async initialize() {
    try {
      this.llmClient = await this.resourceManager.get('llmClient');
      if (!this.llmClient) {
        throw new Error('LLM client not available');
      }
      
      this.isInitialized = true;
      console.log('✅ Enhanced chat initialized');
    } catch (error) {
      throw new Error(`Chat initialization failed: ${error.message}`);
    }
  }

  /**
   * Send message with retry logic and validation (ported from Gemini CLI)
   * @param {Object} params - Message parameters
   * @param {string} promptId - Prompt identifier
   * @returns {Promise<Object>} Chat response
   */
  async sendMessage(params, promptId = null) {
    if (!this.isInitialized) {
      throw new Error('Chat not initialized');
    }

    try {
      // Create user content (ported pattern)
      const userContent = this._createUserContent(params.message);
      
      // Record user message (ported from Gemini CLI)
      if (this.chatRecordingService) {
        await this.chatRecordingService.recordUserMessage(userContent, {
          promptId,
          timestamp: new Date().toISOString()
        });
      }
      
      // Add to history
      this.history.push({
        role: 'user',
        parts: [{ text: userContent }],
        timestamp: new Date().toISOString()
      });
      
      // Generate response with retry logic (ported from Gemini CLI)
      const response = await this._generateWithRetry(promptId, params.config || {});
      
      // Add assistant response to history
      this.history.push({
        role: 'model', 
        parts: [{ text: response.text || response }],
        timestamp: new Date().toISOString()
      });
      
      // Record assistant message (ported from Gemini CLI)
      if (this.chatRecordingService) {
        await this.chatRecordingService.recordAssistantMessage(
          response.text || response,
          [], // Tool calls would be added here
          response.usageMetadata || null
        );
      }
      
      return {
        text: response.text || response,
        usageMetadata: response.usageMetadata,
        candidates: response.candidates,
        functionCalls: response.functionCalls || []
      };
      
    } catch (error) {
      throw new Error(`Send message failed: ${error.message}`);
    }
  }

  /**
   * Send message with streaming (ported concept from Gemini CLI)
   * @param {Object} params - Message parameters
   * @param {string} promptId - Prompt identifier
   * @returns {AsyncGenerator} Stream of responses
   */
  async* sendMessageStream(params, promptId) {
    try {
      // For MVP: Convert regular response to stream format
      const response = await this.sendMessage(params, promptId);
      
      yield {
        type: StreamEventType.CHUNK,
        value: response
      };
      
    } catch (error) {
      yield {
        type: StreamEventType.RETRY
      };
      
      // Retry logic would go here
      const retryResponse = await this.sendMessage(params, promptId);
      yield {
        type: StreamEventType.CHUNK,
        value: retryResponse
      };
    }
  }

  /**
   * Generate content with retry logic (ported from Gemini CLI)
   * @param {string} promptId - Prompt identifier
   * @param {Object} config - Generation config
   * @returns {Promise<Object>} Generated response
   * @private
   */
  async _generateWithRetry(promptId, config = {}) {
    let lastError;
    
    for (let attempt = 0; attempt < this.retryConfig.maxAttempts; attempt++) {
      try {
        // Build complete prompt from history
        const fullPrompt = this._buildPromptFromHistory();
        
        // Call LLM with retry protection
        const response = await this.llmClient.complete(fullPrompt);
        
        // Validate response (ported validation from Gemini CLI)
        if (this._isValidResponse(response)) {
          return { text: response };
        } else {
          throw new Error('Invalid response from LLM');
        }
        
      } catch (error) {
        lastError = error;
        
        // Check if we should retry (ported logic from Gemini CLI)
        if (!this._shouldRetry(error) || attempt === this.retryConfig.maxAttempts - 1) {
          throw error;
        }
        
        // Wait before retry with exponential backoff
        const delay = this.retryConfig.initialDelayMs * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        console.warn(`Retry ${attempt + 1}/${this.retryConfig.maxAttempts} after error:`, error.message);
      }
    }
    
    throw lastError;
  }

  /**
   * Build prompt from conversation history (ported from Gemini CLI)
   * @returns {string} Complete prompt
   * @private
   */
  _buildPromptFromHistory() {
    let prompt = '';
    
    for (const entry of this.history) {
      if (entry.role === 'user') {
        prompt += `User: ${entry.parts[0]?.text || ''}\\n\\n`;
      } else if (entry.role === 'model') {
        prompt += `Assistant: ${entry.parts[0]?.text || ''}\\n\\n`;
      }
    }
    
    return prompt;
  }

  /**
   * Create user content from message (ported from Gemini CLI)
   * @param {string|Object} message - User message
   * @returns {string} Processed user content
   * @private
   */
  _createUserContent(message) {
    if (typeof message === 'string') {
      return message;
    }
    
    // Handle complex message objects (multimodal, etc.)
    if (message.text) {
      return message.text;
    }
    
    return JSON.stringify(message);
  }

  /**
   * Validate LLM response (ported from Gemini CLI)
   * @param {Object} response - LLM response
   * @returns {boolean} Whether response is valid
   * @private
   */
  _isValidResponse(response) {
    if (!response) return false;
    if (typeof response === 'string' && response.length > 0) return true;
    if (response.text && response.text.length > 0) return true;
    if (response.candidates && response.candidates.length > 0) return true;
    
    return false;
  }

  /**
   * Check if error should trigger retry (ported from Gemini CLI)
   * @param {Error} error - Error to check
   * @returns {boolean} Whether to retry
   * @private
   */
  _shouldRetry(error) {
    if (!error || !error.message) return false;
    
    const message = error.message.toLowerCase();
    
    // Retry on rate limits and server errors (ported from Gemini CLI)
    if (message.includes('429') || message.includes('rate limit')) return true;
    if (message.match(/5\\d{2}/)) return true; // 5xx server errors
    if (message.includes('timeout') || message.includes('network')) return true;
    
    return false;
  }

  /**
   * Set tools for function calling (ported from Gemini CLI)
   * @param {Array} tools - Tool declarations
   */
  setTools(tools) {
    this.tools = tools || [];
  }

  /**
   * Get conversation history (ported from Gemini CLI)
   * @param {boolean} curated - Whether to return curated history
   * @returns {Array} Chat history
   */
  getHistory(curated = false) {
    if (curated) {
      // Return curated history (filter out system messages, etc.)
      return this.history.filter(entry => 
        entry.role === 'user' || entry.role === 'model'
      );
    }
    
    return [...this.history];
  }

  /**
   * Set conversation history (ported from Gemini CLI)
   * @param {Array} history - New history
   */
  setHistory(history) {
    this.history = history || [];
  }

  /**
   * Add content to history (ported from Gemini CLI)
   * @param {Object} content - Content to add
   */
  addHistory(content) {
    this.history.push(content);
  }

  /**
   * Strip thoughts from history (ported from Gemini CLI)
   * Used for cleaning conversation before compression
   */
  stripThoughtsFromHistory() {
    this.history = this.history.filter(entry => 
      !entry.thought && !entry.reasoning
    );
  }

  /**
   * Get chat statistics
   * @returns {Object} Chat stats
   */
  getChatStats() {
    return {
      messageCount: this.history.length,
      toolCount: this.tools.length,
      isInitialized: this.isInitialized,
      retryConfig: this.retryConfig
    };
  }

  /**
   * Clear chat history (for testing)
   */
  clearHistory() {
    this.history = [];
  }
}

export default EnhancedChat;