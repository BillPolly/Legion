import { LLMClient } from '@legion/llm';
import { Actor } from '../../../shared/actors/src/Actor.js';

/**
 * ChatAgent - Handles chat interactions with LLM as a backend actor
 * Maintains conversation history and manages streaming responses
 */
export class ChatAgent extends Actor {
  constructor(config = {}) {
    super();
    
    // Agent identification
    this.id = `chat-agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.sessionId = config.sessionId;
    
    // Reference to the remote actor (frontend ChatActor)
    this.remoteActor = config.remoteActor || null;
    
    // Tool access - sessionManager or moduleLoader
    this.sessionManager = config.sessionManager || null;
    this.moduleLoader = config.moduleLoader || null;
    
    // Conversation state
    this.conversationHistory = [];
    this.isProcessing = false;
    
    // LLM configuration
    this.llmConfig = {
      provider: config.provider || 'anthropic',
      apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY,
      model: config.model || 'claude-3-5-sonnet-20241022',
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
   * Emit function that sends messages through the remote actor
   * This replaces EventEmitter.emit() with actor protocol communication
   */
  emit(eventName, data) {
    if (this.remoteActor) {
      // Send the event as a message to the remote actor
      this.remoteActor.receive({
        ...data,
        eventName: eventName  // Include event name for compatibility
      });
    } else {
      console.warn(`ChatAgent: No remote actor to send ${eventName} event to`);
    }
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
   * Process a chat message from the user with tool support
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
      
      // Get available tools if we have access to them
      const tools = await this.getAvailableTools();
      
      // Build messages array for the LLM
      const messages = this.buildMessages();
      
      // Call LLM with tools if available
      let finalResponse;
      if (tools && tools.length > 0 && this.llmClient.executeWithTools) {
        finalResponse = await this.processWithTools(messages, tools);
      } else {
        // Fallback to regular completion without tools
        const prompt = this.buildPrompt(userMessage);
        finalResponse = await this.llmClient.complete(prompt, this.llmConfig.maxTokens);
      }
      
      // Add assistant response to history
      this.conversationHistory.push({
        role: 'assistant',
        content: finalResponse,
        timestamp: new Date().toISOString()
      });
      
      // Send response back through the remote actor
      this.emit('message', {
        type: 'chat_response',
        content: finalResponse,
        isComplete: true,
        sessionId: this.sessionId
      });
      
    } catch (error) {
      console.error('Error processing message:', error);
      
      // Send error back through the remote actor
      this.emit('error', {
        type: 'chat_error',
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
   * Process message with tool calling support
   */
  async processWithTools(messages, tools) {
    // Call LLM with tools
    const response = await this.llmClient.executeWithTools(messages, tools, {
      temperature: this.llmConfig.temperature,
      maxTokens: this.llmConfig.maxTokens
    });
    
    // Check if LLM wants to use tools
    if (response.toolCalls && response.toolCalls.length > 0) {
      // Save assistant message with tool calls to history
      const assistantMessage = {
        role: 'assistant',
        content: response.content || '',
        tool_calls: response.toolCalls,
        timestamp: new Date().toISOString()
      };
      this.conversationHistory.push(assistantMessage);
      
      // Execute the tool calls
      const toolResults = await this.executeTools(response.toolCalls);
      
      // Save tool results to history as user messages
      for (const result of toolResults) {
        this.conversationHistory.push({
          role: 'user',
          content: result.content,
          tool_result: true,
          tool_use_id: result.tool_use_id,
          timestamp: new Date().toISOString()
        });
      }
      
      // Build updated messages for final response
      const updatedMessages = this.buildMessages();
      
      // Call LLM again with tool results to get final response
      const finalResponse = await this.llmClient.executeWithTools(updatedMessages, tools, {
        temperature: this.llmConfig.temperature,
        maxTokens: this.llmConfig.maxTokens
      });
      
      return finalResponse.content || 'I executed the requested tools.';
    }
    
    // No tools needed, return the response
    return response.content || '';
  }
  
  /**
   * Execute tool calls
   */
  async executeTools(toolCalls) {
    const results = [];
    
    for (const toolCall of toolCalls) {
      try {
        // Execute tool via moduleLoader
        let result;
        if (this.moduleLoader && this.moduleLoader.hasTool(toolCall.name)) {
          result = await this.moduleLoader.executeTool(toolCall.name, toolCall.input);
        } else {
          result = {
            success: false,
            error: `Tool '${toolCall.name}' not found`
          };
        }
        
        results.push({
          tool_use_id: toolCall.id,
          content: JSON.stringify(result)
        });
        
        // Emit tool execution event
        this.emit('tool_executed', {
          type: 'tool_execution',
          tool: toolCall.name,
          success: result.success !== false,
          sessionId: this.sessionId
        });
        
      } catch (error) {
        results.push({
          tool_use_id: toolCall.id,
          content: JSON.stringify({
            success: false,
            error: error.message
          })
        });
      }
    }
    
    return results;
  }
  
  /**
   * Get available tools
   */
  async getAvailableTools() {
    const tools = [];
    
    try {
      // Get tools from moduleLoader if available
      if (this.moduleLoader) {
        const allTools = await this.moduleLoader.getAllTools();
        
        for (const tool of allTools) {
          // Convert to standard format
          if (tool.toJSON) {
            const toolDef = tool.toJSON();
            tools.push({
              name: toolDef.name,
              description: toolDef.description,
              input_schema: toolDef.inputSchema
            });
          } else if (tool.name) {
            tools.push({
              name: tool.name,
              description: tool.description || 'No description',
              input_schema: tool.inputSchema || { type: 'object', properties: {} }
            });
          }
        }
      }
    } catch (error) {
      console.error('Error getting tools:', error);
    }
    
    return tools;
  }
  
  /**
   * Build messages array from conversation history
   */
  buildMessages() {
    const messages = [
      {
        role: 'system',
        content: this.systemPrompt
      }
    ];
    
    // Add recent conversation history with proper formatting
    const recentHistory = this.conversationHistory.slice(-20);
    
    for (const msg of recentHistory) {
      if (msg.tool_result) {
        // This is a tool result - format as user message with tool_result content
        messages.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: msg.tool_use_id,
              content: msg.content
            }
          ]
        });
      } else if (msg.tool_calls && msg.tool_calls.length > 0) {
        // Assistant message with tool calls
        const content = [];
        
        // Add text content if present
        if (msg.content) {
          content.push({
            type: 'text',
            text: msg.content
          });
        }
        
        // Add tool use blocks
        for (const toolCall of msg.tool_calls) {
          content.push({
            type: 'tool_use',
            id: toolCall.id,
            name: toolCall.name,
            input: toolCall.input
          });
        }
        
        messages.push({
          role: 'assistant',
          content: content
        });
      } else {
        // Regular text message
        messages.push({
          role: msg.role,
          content: msg.content
        });
      }
    }
    
    return messages;
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
   * Actor receive method - handles incoming messages from the actor system
   * This is the main entry point for actor communication
   */
  async receive(payload, envelope) {
    console.log('ChatAgent: Received message via actor system:', payload);
    
    // If payload is a message object, handle it
    if (payload && typeof payload === 'object') {
      await this.handleMessage(payload);
    } else {
      console.warn('ChatAgent: Received unknown payload type:', typeof payload);
    }
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
        // Send response back through the remote actor
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
    this.conversationHistory = [];
    this.llmClient = null;
    this.remoteActor = null;
    console.log(`ChatAgent ${this.id} destroyed`);
  }
}