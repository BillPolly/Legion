import { Actor } from '../../../shared/actors/src/Actor.js';
import { ArtifactDetector } from './artifacts/ArtifactDetector.js';
import { ArtifactManager } from './artifacts/ArtifactManager.js';

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
    
    // ResourceManager for getting LLMClient
    this.resourceManager = config.resourceManager || null;
    
    // Conversation state
    this.conversationHistory = [];
    this.isProcessing = false;
    this.initialized = false;
    
    // LLM configuration (NO API KEY HERE!)
    this.llmConfig = {
      provider: config.provider || 'anthropic',
      model: config.model || 'claude-3-5-sonnet-20241022',
      maxRetries: config.maxRetries || 3,
      temperature: config.temperature || 0.7,
      maxTokens: config.maxTokens || 2000
    };
    
    // Initialize LLM client
    this.llmClient = null;
    
    // Initialize artifact system
    this.artifactDetector = new ArtifactDetector();
    this.artifactManager = new ArtifactManager({ sessionId: this.sessionId });
    
    // System prompt for the assistant
    this.systemPrompt = config.systemPrompt || `You are a helpful AI assistant integrated into the Aiur development environment.

You can:
1. Have conversations and answer questions
2. Use tools when needed to perform actions like reading/writing files, running commands, etc.

When the user asks you to perform an action (like writing a file, reading data, etc.), you should use the appropriate tool.
When the user just wants to chat or ask questions, respond conversationally.

You will automatically choose whether to use tools or just respond based on what the user needs.
Be concise but thorough in your responses. Use markdown formatting when appropriate.`;
    
    console.log(`ChatAgent ${this.id} initialized for session ${this.sessionId}`);
  }
  
  /**
   * Initialize the ChatAgent (must be called after construction)
   */
  async initialize() {
    if (this.initialized) {
      return;
    }
    
    await this.initializeLLMClient();
    this.initialized = true;
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
   * Initialize the LLM client using ResourceManager
   */
  async initializeLLMClient() {
    try {
      if (!this.resourceManager) {
        console.error('ChatAgent: No ResourceManager provided, cannot create LLMClient');
        return;
      }
      
      // Request LLMClient from ResourceManager with our config (NO API KEY!)
      this.llmClient = await this.resourceManager.createLLMClient({
        provider: this.llmConfig.provider,
        model: this.llmConfig.model,
        maxRetries: this.llmConfig.maxRetries
      });
      
      // Listen to LLM events for streaming
      if (this.llmClient.on) {
        this.llmClient.on('stream', (chunk) => {
          this.emit('stream', {
            type: 'chat_stream',
            content: chunk,
            sessionId: this.sessionId
          });
        });
      }
      
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
    // Ensure we're initialized
    if (!this.initialized) {
      await this.initialize();
    }
    
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
      
      // Get all artifacts from this conversation turn
      const currentArtifacts = this.artifactManager.getAllArtifacts()
        .filter(artifact => {
          // Include artifacts created in the last few seconds (during this tool execution)
          const artifactTime = new Date(artifact.createdAt).getTime();
          const now = Date.now();
          return (now - artifactTime) < 30000; // 30 seconds window
        });

      // Send response back through the remote actor with artifacts
      this.emit('message', {
        type: 'chat_response',
        content: finalResponse,
        isComplete: true,
        artifacts: currentArtifacts,
        sessionId: this.sessionId
      });
      
      // ALSO send raw LLM response as a separate debug message
      this.emit('llm_debug', {
        type: 'llm_raw_response',
        rawResponse: finalResponse,
        sessionId: this.sessionId,
        timestamp: new Date().toISOString()
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
   * Process message with tool calling support - supports multiple rounds
   */
  async processWithTools(messages, tools) {
    let currentMessages = messages;
    let iterations = 0;
    const maxIterations = 10; // Prevent infinite loops
    let finalContent = '';
    
    // Keep processing until no more tools are needed
    while (iterations < maxIterations) {
      iterations++;
      
      // Send thinking status
      this.emit('agent_thinking', {
        type: 'agent_thinking',
        iteration: iterations,
        sessionId: this.sessionId
      });
      
      // Call LLM with tools
      const response = await this.llmClient.executeWithTools(currentMessages, tools, {
        temperature: this.llmConfig.temperature,
        maxTokens: this.llmConfig.maxTokens
      });
      
      // Send the complete LLM response for debugging
      this.emit('llm_complete_response', {
        type: 'llm_complete_response',
        response: response,
        sessionId: this.sessionId,
        timestamp: new Date().toISOString()
      });
      
      // Check if LLM wants to use tools
      if (response.toolCalls && response.toolCalls.length > 0) {
        // Send the LLM's reasoning if any
        if (response.content) {
          this.emit('agent_thought', {
            type: 'agent_thought',
            thought: response.content,
            sessionId: this.sessionId
          });
        }
        
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
          
          // Send tool result to UI
          this.emit('tool_result', {
            type: 'tool_result',
            toolId: result.tool_use_id,
            result: result.content,
            sessionId: this.sessionId
          });
        }
        
        // Build updated messages for next iteration
        currentMessages = this.buildMessages();
        
        // Continue loop to see if more tools are needed
      } else {
        // No more tools needed, we have the final response
        finalContent = response.content || 'I completed the requested tasks.';
        
        // Send completion status
        this.emit('agent_complete', {
          type: 'agent_complete',
          iterations: iterations,
          sessionId: this.sessionId
        });
        
        break;
      }
    }
    
    if (iterations >= maxIterations) {
      console.warn('ChatAgent: Reached maximum tool iterations');
      finalContent = 'I reached the maximum number of tool operations. The task may be incomplete.';
    }
    
    return finalContent;
  }
  
  /**
   * Execute tool calls
   */
  async executeTools(toolCalls) {
    const results = [];
    const allArtifacts = [];
    
    for (const toolCall of toolCalls) {
      try {
        // Send tool execution start status
        this.emit('tool_executing', {
          type: 'tool_executing',
          toolName: toolCall.name,
          toolId: toolCall.id,
          parameters: toolCall.input,
          sessionId: this.sessionId,
          timestamp: new Date().toISOString()
        });
        
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
        
        // Detect artifacts from tool result
        let artifacts = [];
        if (result && result.success !== false) {
          try {
            artifacts = await this.artifactDetector.detectArtifacts(toolCall.name, result);
            
            // Register artifacts with the manager
            for (const artifact of artifacts) {
              const registered = this.artifactManager.registerArtifact(artifact);
              allArtifacts.push(registered);
            }
            
            if (artifacts.length > 0) {
              console.log(`ChatAgent: Detected ${artifacts.length} artifacts from ${toolCall.name}`);
              
              // Emit artifact detection event
              this.emit('artifacts_detected', {
                type: 'artifacts_detected',
                toolName: toolCall.name,
                toolId: toolCall.id,
                artifacts: artifacts,
                sessionId: this.sessionId,
                timestamp: new Date().toISOString()
              });
            }
          } catch (artifactError) {
            console.warn(`ChatAgent: Error detecting artifacts for ${toolCall.name}:`, artifactError);
          }
        }
        
        results.push({
          tool_use_id: toolCall.id,
          content: JSON.stringify(result)
        });
        
        // Emit tool execution event (existing functionality)
        this.emit('tool_executed', {
          type: 'tool_execution',
          tool: toolCall.name,
          success: result.success !== false,
          artifacts: artifacts, // Include artifacts in the event
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
    
    // If we detected any artifacts, emit a summary event
    if (allArtifacts.length > 0) {
      this.emit('tool_artifacts_summary', {
        type: 'tool_artifacts_summary',
        artifacts: allArtifacts,
        totalCount: allArtifacts.length,
        sessionId: this.sessionId,
        timestamp: new Date().toISOString()
      });
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
    
    // Cleanup artifact system
    if (this.artifactManager) {
      this.artifactManager.destroy();
      this.artifactManager = null;
    }
    this.artifactDetector = null;
    
    console.log(`ChatAgent ${this.id} destroyed`);
  }
}