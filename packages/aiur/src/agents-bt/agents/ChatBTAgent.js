/**
 * ChatBTAgent - Behavior Tree-based Chat Agent
 * 
 * A next-generation chat agent built on the BT framework, providing
 * configurable, composable, and extensible conversation handling.
 */

import { Actor } from '../../../../shared/actors/src/Actor.js';
import { TaskOrchestrator } from '../task-orchestrator/TaskOrchestrator.js';

export class ChatBTAgent extends Actor {
  constructor(config = {}) {
    super();
    
    this.agentId = config.agentId || `chat-agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.sessionId = config.sessionId;
    this.agentType = 'chat';
    
    // Aiur infrastructure dependencies
    this.sessionManager = config.sessionManager || null;
    this.moduleLoader = config.moduleLoader || null;
    this.resourceManager = config.resourceManager || null;
    this.remoteActor = config.remoteActor || null;
    
    // Initialization state
    this.initialized = false;
    
    // Chat-specific components
    this.conversationHistory = [];
    this.isProcessing = false;
    
    // Task orchestration
    this.taskOrchestrator = null;
    
    // LLM configuration 
    this.llmConfig = {
      provider: config.provider || 'anthropic',
      model: config.model || 'claude-3-5-sonnet-20241022',
      maxRetries: config.maxRetries || 3,
      temperature: config.temperature || 0.7,
      maxTokens: config.maxTokens || 2000
    };
    
    // System prompt for the assistant
    this.systemPrompt = config.systemPrompt || this.getDefaultSystemPrompt();
    
    console.log(`ChatBTAgent ${this.agentId} initialized for session ${this.sessionId}`);
  }
  
  /**
   * Initialize the agent
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      await this.initializeAgent();
      this.initialized = true;
      console.log(`ChatBTAgent ${this.agentId} fully initialized`);
    } catch (error) {
      console.error(`ChatBTAgent ${this.agentId} initialization failed:`, error);
      throw error;
    }
  }
  
  /**
   * Agent-specific initialization
   */
  async initializeAgent() {
    // Initialize LLM client
    await this.initializeLLMClient();
    
    // Initialize TaskOrchestrator
    await this.initializeTaskOrchestrator();
    
    console.log(`ChatBTAgent ${this.agentId} fully initialized`);
  }
  
  /**
   * Initialize LLM client
   */
  async initializeLLMClient() {
    try {
      if (!this.resourceManager) {
        console.error('ChatBTAgent: No ResourceManager provided, cannot create LLMClient');
        return;
      }
      
      this.llmClient = await this.resourceManager.createLLMClient({
        provider: this.llmConfig.provider,
        model: this.llmConfig.model,
        maxRetries: this.llmConfig.maxRetries
      });
      
      console.log(`ChatBTAgent: LLM client initialized (${this.llmConfig.provider})`);
      
    } catch (error) {
      console.error('ChatBTAgent: Failed to initialize LLM client:', error);
    }
  }
  
  /**
   * Initialize TaskOrchestrator
   */
  async initializeTaskOrchestrator() {
    try {
      this.taskOrchestrator = new TaskOrchestrator({
        sessionId: this.sessionId,
        chatAgent: this,
        resourceManager: this.resourceManager,
        moduleLoader: this.moduleLoader
      });
      
      await this.taskOrchestrator.initialize();
      
      console.log('ChatBTAgent: TaskOrchestrator initialized');
      
    } catch (error) {
      console.error('ChatBTAgent: Failed to initialize TaskOrchestrator:', error);
    }
  }
  
  /**
   * Load common development modules
   */
  async loadCommonModules() {
    if (!this.moduleLoader) return;
    
    try {
      // Only try to load modules that actually exist
      const availableModules = ['file', 'command-executor'];
      
      for (const moduleName of availableModules) {
        try {
          await this.moduleLoader.loadModuleByName(moduleName);
          console.log(`ChatBTAgent: Loaded ${moduleName}`);
        } catch (error) {
          console.warn(`ChatBTAgent: Failed to load ${moduleName}:`, error.message);
        }
      }
      
      console.log('ChatBTAgent: Common modules loaded');
      
    } catch (error) {
      console.warn('ChatBTAgent: Error loading common modules:', error);
    }
  }
  
  /**
   * Get agent-specific context for BT execution
   */
  getAgentSpecificContext(payload) {
    return {
      // Conversation state
      conversationHistory: this.conversationHistory,
      isProcessing: this.isProcessing,
      
      // LLM client and configuration
      llmClient: this.llmClient,
      llmConfig: this.llmConfig,
      systemPrompt: this.systemPrompt,
      
      // Module loader for tools
      moduleLoader: this.moduleLoader,
      
      // Helper functions
      emit: this.emit.bind(this),
      sendToRemote: this.sendToRemote.bind(this),
      
      // Agent metadata
      agentType: 'chat'
    };
  }
  
  /**
   * Process agent execution result
   */
  async processAgentResult(result, originalMessage) {
    console.log("RESULTS>>>",result);
    // Update processing state
    this.isProcessing = false;
    
    // Send processing complete event
    this.emit('processing_complete', {
      type: 'chat_complete',
      sessionId: this.sessionId
    });
    
    // Handle conversation history updates
    if (result.context && result.context.conversationHistory) {
      this.conversationHistory = result.context.conversationHistory;
    }
  }
  
  /**
   * Process agent execution error
   */
  async processAgentError(error, originalMessage) {
    this.isProcessing = false;
    
    console.error('ChatBTAgent: Execution error:', error);
    
    // Send error to remote actor (already handled by base class)
    // Just update internal state here
  }
  
  /**
   * Emit function that sends messages through the remote actor
   */
  emit(eventName, data) {
    if (this.remoteActor) {
      this.remoteActor.receive({
        ...data,
        eventName: eventName
      });
    } else {
      console.warn(`ChatBTAgent: No remote actor to send ${eventName} event to`);
    }
  }
  
  /**
   * Execute a tool directly without going through the node system
   */
  async executeTool(toolName, args) {
    console.log(`[ChatBTAgent] Executing tool '${toolName}' with args:`, args);
    
    if (!this.moduleLoader) {
      console.error('[ChatBTAgent] No moduleLoader available');
      return { success: false, error: 'Module loader not available' };
    }
    
    // Get the tool instance from the moduleLoader's tools Map
    const tool = this.moduleLoader.tools ? this.moduleLoader.tools.get(toolName) : null;
    
    if (!tool) {
      console.error(`[ChatBTAgent] Tool '${toolName}' not found`);
      const availableTools = this.moduleLoader.tools ? Array.from(this.moduleLoader.tools.keys()) : [];
      console.log('[ChatBTAgent] Available tools:', availableTools);
      return { 
        success: false, 
        error: `Tool '${toolName}' not found`,
        availableTools 
      };
    }
    
    try {
      // Execute the tool instance directly
      console.log(`[ChatBTAgent] Found tool instance, executing...`);
      const result = await tool.execute(args);
      console.log(`[ChatBTAgent] Tool '${toolName}' execution result:`, JSON.stringify(result, null, 2));
      return result;
    } catch (error) {
      console.error(`[ChatBTAgent] Tool execution failed:`, error);
      return { 
        success: false, 
        error: error.message,
        stack: error.stack 
      };
    }
  }
  
  /**
   * Handle incoming chat message directly
   */
  async handleChatMessage(message) {
    console.log('[ChatBTAgent] Handling chat message:', message.content);
    
    try {
      // Add user message to history
      this.conversationHistory.push({
        role: 'user',
        content: message.content
      });
      
      // Use TaskOrchestrator to create and execute a plan for the user's request
      if (this.taskOrchestrator) {
        console.log('[ChatBTAgent] Starting task orchestration for:', message.content);
        
        // Create agent context for the orchestrator
        const agentContext = {
          sessionId: this.sessionId,
          conversationHistory: this.conversationHistory,
          emit: this.emit.bind(this)
        };
        
        // Start task orchestration
        await this.taskOrchestrator.receive({
          type: 'start_task',
          description: message.content,
          agentContext: agentContext
        });
        
        return { success: true, message: 'Task orchestration started' };
        
      } else {
        // Fallback to direct LLM response if orchestrator not available
        const response = await this.getLLMResponse(message.content);
        
        // Add assistant response to history
        this.conversationHistory.push({
          role: 'assistant',
          content: response
        });
        
        // Send response to UI
        console.log('[ChatBTAgent] Sending response to UI:', response.substring(0, 100) + '...');
        this.sendToRemote({
          type: 'chat_response',
          content: response,
          isComplete: true,
          sessionId: this.sessionId,
          timestamp: new Date().toISOString()
        });
        
        return { success: true, response };
      }
      
    } catch (error) {
      console.error('[ChatBTAgent] Error handling chat message:', error);
      
      this.sendToRemote({
        type: 'error',
        content: `Error: ${error.message}`,
        sessionId: this.sessionId
      });
      
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Get LLM response with tool support
   */
  async getLLMResponse(userMessage) {
    if (!this.llmClient) {
      throw new Error('LLM client not initialized');
    }
    
    // Build messages for LLM
    const messages = [
      { role: 'system', content: this.systemPrompt },
      ...this.conversationHistory.slice(-20), // Include recent history
      { role: 'user', content: userMessage }
    ];
    
    // Get available tools
    const tools = this.getToolsForLLM();
    
    // Call LLM with tools
    if (tools.length > 0 && this.llmClient.executeWithTools) {
      const result = await this.llmClient.executeWithTools(messages, tools, this.llmConfig);
      
      // Handle tool calls if any
      if (result.toolCalls && result.toolCalls.length > 0) {
        return await this.handleToolCalls(result.toolCalls, result.content);
      }
      
      return result.content || 'I apologize, but I was unable to generate a response.';
    } else {
      // Fallback to basic completion
      const prompt = messages.map(m => `${m.role}: ${m.content}`).join('\n\n');
      return await this.llmClient.complete(prompt, this.llmConfig.maxTokens);
    }
  }
  
  /**
   * Get tools formatted for LLM
   */
  getToolsForLLM() {
    const tools = [];
    
    if (!this.moduleLoader || !this.moduleLoader.tools) {
      return tools;
    }
    
    for (const [name, tool] of this.moduleLoader.tools) {
      if (tool.toJSON) {
        const toolDef = tool.toJSON();
        tools.push({
          name: toolDef.name,
          description: toolDef.description,
          input_schema: this.cleanSchemaForAnthropic(toolDef.inputSchema)
        });
      }
    }
    
    return tools;
  }
  
  /**
   * Clean schema for Anthropic compatibility
   */
  cleanSchemaForAnthropic(inputSchema) {
    if (!inputSchema || typeof inputSchema !== 'object') {
      return { type: 'object', properties: {}, required: [] };
    }
    
    const cleanSchema = {
      type: inputSchema.type || 'object',
      properties: {},
      required: []
    };
    
    if (inputSchema.properties) {
      for (const [key, prop] of Object.entries(inputSchema.properties)) {
        if (prop && typeof prop === 'object') {
          cleanSchema.properties[key] = {
            type: prop.type,
            description: prop.description,
            ...(prop.enum && { enum: prop.enum }),
            ...(prop.default !== undefined && { default: prop.default })
          };
        }
      }
    }
    
    if (Array.isArray(inputSchema.required)) {
      cleanSchema.required = inputSchema.required;
    }
    
    return cleanSchema;
  }
  
  /**
   * Handle tool calls from LLM
   */
  async handleToolCalls(toolCalls, assistantMessage) {
    console.log('[ChatBTAgent] Handling tool calls:', toolCalls.map(t => t.name));
    
    const toolResults = [];
    
    for (const toolCall of toolCalls) {
      console.log(`[ChatBTAgent] Executing tool: ${toolCall.name}`);
      const result = await this.executeTool(toolCall.name, toolCall.input);
      
      // Properly stringify the entire result including nested objects
      toolResults.push({
        tool_use_id: toolCall.id,
        content: JSON.stringify(result, null, 2)  // Pretty print for readability
      });
    }
    
    // Add tool execution to history
    this.conversationHistory.push({
      role: 'assistant',
      content: assistantMessage || '',
      tool_calls: toolCalls
    });
    
    this.conversationHistory.push({
      role: 'user',
      tool_results: toolResults
    });
    
    // Build messages with tool results for LLM - properly formatted
    const messages = [
      { role: 'system', content: this.systemPrompt },
      ...this.conversationHistory.slice(-10), // Keep history manageable
      {
        role: 'user',
        content: `The tool results have been provided above. Please provide a helpful response to the user based on these results. Do not call any more tools.`
      }
    ];
    
    // Get final response WITHOUT allowing more tool calls
    const prompt = messages.map(m => {
      if (m.role === 'system') return `System: ${m.content}`;
      if (m.role === 'user') {
        // Handle tool results specially
        if (m.tool_results) {
          const results = m.tool_results.map(r => 
            `Tool Result (${r.tool_use_id}):\n${r.content}`
          ).join('\n\n');
          return `Human: Here are the tool execution results:\n${results}`;
        }
        return `Human: ${m.content}`;
      }
      if (m.role === 'assistant') {
        // Handle assistant messages with tool calls
        if (m.tool_calls && m.tool_calls.length > 0) {
          const toolInfo = m.tool_calls.map(t => 
            `Calling tool: ${t.name} with args: ${JSON.stringify(t.input)}`
          ).join('\n');
          return `Assistant: ${m.content || 'I need to use a tool.'}\n${toolInfo}`;
        }
        return `Assistant: ${m.content}`;
      }
      return '';
    }).join('\n\n');
    
    const finalResponse = await this.llmClient.complete(prompt, this.llmConfig.maxTokens);
    
    // Return the final response
    return finalResponse || 'Tool execution completed.';
  }
  
  /**
   * Main receive method - handles all incoming messages
   */
  async receive(payload, envelope) {
    console.log(`[ChatBTAgent] Received message type: ${payload.type}`);
    
    // Initialize if not already done
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      if (payload.type === 'chat_message') {
        return await this.handleChatMessage(payload);
      } else {
        console.warn(`[ChatBTAgent] Unknown message type: ${payload.type}`);
        return { success: false, error: `Unknown message type: ${payload.type}` };
      }
    } catch (error) {
      console.error(`[ChatBTAgent] Error handling message:`, error);
      
      if (this.remoteActor) {
        this.sendToRemote({
          type: 'error',
          content: `Error: ${error.message}`,
          sessionId: this.sessionId
        });
      }
      
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Send message to remote actor
   */
  async sendToRemote(message) {
    if (this.remoteActor && this.remoteActor.receive) {
      this.remoteActor.receive(message);
    } else {
      console.warn(`ChatBTAgent ${this.agentId}: No remote actor to send message to`);
    }
  }
  
  /**
   * Set the remote actor reference
   */
  setRemoteActor(remoteActor) {
    this.remoteActor = remoteActor;
  }
  
  /**
   * Get default system prompt
   */
  getDefaultSystemPrompt() {
    return `You are Claude, an AI assistant with access to various tools for file operations and system management.

You can:
- Read and write files
- List directory contents  
- Load additional modules for more capabilities
- Have natural conversations

When the user asks you to perform file operations or other actions, use the appropriate tools.
When the user just wants to chat, respond conversationally without tools.

Keep responses concise but complete. Use markdown for code and formatting when helpful.`;
  }
  
  /**
   * Get current agent status
   */
  getStatus() {
    return {
      agentId: this.agentId,
      agentType: this.agentType,
      sessionId: this.sessionId,
      initialized: this.initialized,
      conversationLength: this.conversationHistory.length,
      isProcessing: this.isProcessing,
      llmClientAvailable: !!this.llmClient,
      taskOrchestratorAvailable: !!this.taskOrchestrator,
      remoteActorConnected: !!this.remoteActor
    };
  }
  
  /**
   * Clean up resources
   */
  async destroy() {
    // Cleanup chat-specific resources
    this.conversationHistory = [];
    this.llmClient = null;
    
    // Cleanup TaskOrchestrator
    if (this.taskOrchestrator) {
      this.taskOrchestrator.destroy();
      this.taskOrchestrator = null;
    }
    
    // Clear references
    this.remoteActor = null;
    this.sessionManager = null;
    this.moduleLoader = null;
    this.resourceManager = null;
    this.initialized = false;
    
    console.log(`ChatBTAgent ${this.agentId} destroyed`);
  }
}