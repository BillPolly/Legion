import { LLMClient } from '@legion/llm';
import { EventEmitter } from 'events';

/**
 * ChatAgent - Handles chat interactions with LLM
 * Maintains conversation history and manages streaming responses
 */
export class ChatAgent extends EventEmitter {
  constructor(config = {}) {
    super();
    
    // Agent identification
    this.id = `chat-agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.sessionId = config.sessionId;
    
    // Conversation state
    this.conversationHistory = [];
    this.isProcessing = false;
    
    // LLM configuration
    this.llmConfig = {
      provider: config.provider || 'anthropic',
      apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY,
      model: config.model || 'claude-3-sonnet-20240229',
      maxRetries: config.maxRetries || 3,
      temperature: config.temperature || 0.7,
      maxTokens: config.maxTokens || 2000
    };
    
    // Initialize LLM client
    this.llmClient = null;
    this.initializeLLMClient();
    
    // System prompt for the assistant
    this.systemPrompt = config.systemPrompt || `You are a helpful AI assistant integrated into the Aiur development environment. 
You have access to various tools and can help with coding, file operations, and system tasks.
Be concise but thorough in your responses. Use markdown formatting when appropriate.`;
    
    console.log(`ChatAgent ${this.id} initialized for session ${this.sessionId}`);
  }
  
  /**
   * Initialize the LLM client
   */
  initializeLLMClient() {
    try {
      this.llmClient = new LLMClient({
        provider: this.llmConfig.provider,
        apiKey: this.llmConfig.apiKey,
        model: this.llmConfig.model,
        maxRetries: this.llmConfig.maxRetries
      });
      
      // Listen to LLM events for streaming
      this.llmClient.on('stream', (chunk) => {
        this.emit('stream', {
          type: 'chat_stream',
          content: chunk,
          sessionId: this.sessionId
        });
      });
      
    } catch (error) {
      console.error('Failed to initialize LLM client:', error);
      this.emit('error', {
        type: 'initialization_error',
        message: `Failed to initialize LLM: ${error.message}`,
        sessionId: this.sessionId
      });
    }
  }
  
  /**
   * Process a chat message from the user
   */
  async processMessage(userMessage) {
    if (this.isProcessing) {
      this.emit('error', {
        type: 'processing_error',
        message: 'Already processing a message',
        sessionId: this.sessionId
      });
      return;
    }
    
    this.isProcessing = true;
    
    try {
      // Add user message to history
      this.conversationHistory.push({
        role: 'user',
        content: userMessage,
        timestamp: new Date().toISOString()
      });
      
      // Emit processing started event
      this.emit('processing_started', {
        type: 'chat_processing',
        sessionId: this.sessionId
      });
      
      // Build the prompt with conversation history
      const prompt = this.buildPrompt(userMessage);
      
      // Get response from LLM
      const response = await this.llmClient.complete(prompt, this.llmConfig.maxTokens);
      
      // Add assistant response to history
      this.conversationHistory.push({
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString()
      });
      
      // Emit complete response
      this.emit('response', {
        type: 'chat_response',
        content: response,
        isComplete: true,
        sessionId: this.sessionId
      });
      
      // Store conversation for potential tool use later
      this.lastExchange = {
        user: userMessage,
        assistant: response
      };
      
    } catch (error) {
      console.error('Error processing message:', error);
      
      this.emit('error', {
        type: 'processing_error',
        message: `Failed to process message: ${error.message}`,
        sessionId: this.sessionId
      });
      
    } finally {
      this.isProcessing = false;
      
      this.emit('processing_complete', {
        type: 'chat_complete',
        sessionId: this.sessionId
      });
    }
  }
  
  /**
   * Build the prompt with conversation history
   */
  buildPrompt(currentMessage) {
    const messages = [];
    
    // Add system prompt
    messages.push(`System: ${this.systemPrompt}`);
    
    // Add conversation history (limit to last 10 exchanges to manage token usage)
    const recentHistory = this.conversationHistory.slice(-20);
    
    recentHistory.forEach((msg) => {
      if (msg.role === 'user') {
        messages.push(`Human: ${msg.content}`);
      } else if (msg.role === 'assistant' && msg.content !== currentMessage) {
        messages.push(`Assistant: ${msg.content}`);
      }
    });
    
    // Add current message if not already in history
    if (!recentHistory.some(msg => msg.content === currentMessage)) {
      messages.push(`Human: ${currentMessage}`);
    }
    
    // Add assistant prompt
    messages.push('Assistant:');
    
    return messages.join('\n\n');
  }
  
  /**
   * Clear conversation history
   */
  clearHistory() {
    this.conversationHistory = [];
    this.emit('history_cleared', {
      type: 'chat_history_cleared',
      sessionId: this.sessionId
    });
  }
  
  /**
   * Get conversation history
   */
  getHistory() {
    return this.conversationHistory;
  }
  
  /**
   * Handle incoming messages from the actor system
   */
  async handleMessage(message) {
    switch (message.type) {
      case 'chat_message':
        await this.processMessage(message.content);
        break;
        
      case 'clear_history':
        this.clearHistory();
        break;
        
      case 'get_history':
        this.emit('history', {
          type: 'chat_history',
          history: this.getHistory(),
          sessionId: this.sessionId
        });
        break;
        
      default:
        console.log(`ChatAgent: Unknown message type ${message.type}`);
    }
  }
  
  /**
   * Prepare for tool usage (future enhancement)
   */
  async executeWithTools(userMessage, availableTools) {
    // This will be implemented when tool usage is added
    // For now, just process as a regular message
    return this.processMessage(userMessage);
  }
  
  /**
   * Cleanup resources
   */
  destroy() {
    this.removeAllListeners();
    this.conversationHistory = [];
    this.llmClient = null;
    console.log(`ChatAgent ${this.id} destroyed`);
  }
}