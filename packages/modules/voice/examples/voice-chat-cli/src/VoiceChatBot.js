import { LLMClient } from '@legion/llm-client';

/**
 * VoiceChatBot - Chatbot with conversation history
 *
 * Manages a conversation with an LLM, maintaining message history
 * and providing a simple interface for sending/receiving messages.
 */
export class VoiceChatBot {
  constructor(config) {
    this.llmClient = new LLMClient({
      provider: config.provider || 'zai',
      apiKey: config.apiKey,
      model: config.model || 'glm-4.6',
      baseURL: config.baseURL,
      maxRetries: config.maxRetries !== undefined ? config.maxRetries : 3
    });

    this.systemPrompt = config.systemPrompt || 'You are a helpful assistant.';
    this.history = [];
    this.maxHistoryLength = config.maxHistoryLength || 20;
  }

  /**
   * Send a message and get a response
   * @param {string} userMessage - The user's message
   * @returns {Promise<string>} The assistant's response
   */
  async sendMessage(userMessage) {
    // Add user message to history
    this.history.push({
      role: 'user',
      content: userMessage
    });

    // Build messages array for LLM
    const messages = [
      { role: 'system', content: this.systemPrompt },
      ...this.history
    ];

    // Get response from LLM
    const response = await this.llmClient.request({
      systemPrompt: this.systemPrompt,
      chatHistory: this.history.slice(), // Send copy of history
      prompt: '' // Already in chat history
    });

    // Extract response text
    const responseText = response.content || response;

    // Add assistant response to history
    this.history.push({
      role: 'assistant',
      content: responseText
    });

    // Trim history if it's too long
    this._trimHistory();

    return responseText;
  }

  /**
   * Clear conversation history
   */
  clearHistory() {
    this.history = [];
  }

  /**
   * Get conversation history
   * @returns {Array} Array of message objects
   */
  getHistory() {
    return [...this.history];
  }

  /**
   * Get history as formatted text
   * @returns {string} Formatted conversation history
   */
  getHistoryText() {
    return this.history.map(msg => {
      const role = msg.role === 'user' ? 'You' : 'Assistant';
      return `${role}: ${msg.content}`;
    }).join('\n\n');
  }

  /**
   * Trim history to max length, keeping most recent messages
   * @private
   */
  _trimHistory() {
    if (this.history.length > this.maxHistoryLength) {
      // Keep the most recent messages
      this.history = this.history.slice(-this.maxHistoryLength);
    }
  }

  /**
   * Update system prompt
   * @param {string} newPrompt - New system prompt
   */
  setSystemPrompt(newPrompt) {
    this.systemPrompt = newPrompt;
  }

  /**
   * Get provider info
   * @returns {Object} Provider information
   */
  getProviderInfo() {
    return {
      provider: this.llmClient.getProviderName(),
      model: this.llmClient.currentModel
    };
  }
}
