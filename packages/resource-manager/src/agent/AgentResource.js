import Resource from '../base/Resource.js';
import { RESOURCE_STATUS } from '../base/ResourceStatus.js';
import SessionManager from './SessionManager.js';
import PromptTemplate from '../utils/PromptTemplate.js';

/**
 * AgentResource manages LLM-powered agents with conversation capabilities
 * Handles session management, prompt templating, and LLM integration
 */
class AgentResource extends Resource {
  constructor(name, config, dependencies = {}) {
    super(name, config, dependencies);
    
    this.llmModule = null;
    this.sessionManager = null;
    this.promptTemplate = null;
    this.toolModules = new Map();
    this.statistics = {
      totalRequests: 0,
      totalTokens: 0,
      errorCount: 0,
      averageResponseTime: 0,
      lastRequest: null
    };
    
    // Validate configuration
    this.validateConfig();
    
    // Initialize session manager
    this.sessionManager = new SessionManager({
      maxSessions: config.maxSessions || 100,
      sessionTimeout: config.sessionTimeout || 3600000, // 1 hour
      cleanupInterval: config.cleanupInterval || 300000   // 5 minutes
    });
    
    // Initialize prompt template
    if (config.systemPrompt) {
      this.promptTemplate = PromptTemplate.withUtilities(config.systemPrompt);
    }
  }

  /**
   * Validate agent configuration
   * @private
   */
  validateConfig() {
    if (!this.config.llm) {
      throw new Error(`AgentResource '${this.name}' requires llm configuration`);
    }
    
    if (!this.config.llm.module) {
      throw new Error(`AgentResource '${this.name}' requires llm.module`);
    }
    
    if (!this.config.systemPrompt) {
      console.warn(`AgentResource '${this.name}' has no system prompt`);
    }
  }

  /**
   * Initialize the agent resource
   */
  async initialize() {
    this.updateStatus(RESOURCE_STATUS.STARTING);
    
    try {
      // Get LLM module from dependencies
      const llmModuleName = this.config.llm.module;
      this.llmModule = this.config.serviceModules?.get(llmModuleName);
      
      if (!this.llmModule) {
        throw new Error(`LLM module '${llmModuleName}' not found in dependencies`);
      }
      
      // Initialize tool modules if specified
      if (this.config.tools) {
        await this.initializeTools();
      }
      
      // Add agent-specific context to prompt template
      if (this.promptTemplate) {
        this.promptTemplate.addStaticContext('agent_name', this.name);
        this.promptTemplate.addStaticContext('model', this.config.llm.model || 'unknown');
        
        // Add any configured context
        if (this.config.context) {
          for (const [key, value] of Object.entries(this.config.context)) {
            this.promptTemplate.addStaticContext(key, this.resolveDependencies(value));
          }
        }
      }
      
      this.updateStatus(RESOURCE_STATUS.READY);
      console.log(`Agent '${this.name}' initialized successfully`);
      
    } catch (error) {
      this.updateStatus(RESOURCE_STATUS.ERROR);
      throw new Error(`Failed to initialize agent '${this.name}': ${error.message}`);
    }
  }

  /**
   * Initialize tool modules for agent use
   * @private
   */
  async initializeTools() {
    const toolNames = Array.isArray(this.config.tools) ? this.config.tools : [this.config.tools];
    
    for (const toolName of toolNames) {
      const toolModule = this.config.serviceModules?.get(toolName);
      if (toolModule) {
        this.toolModules.set(toolName, toolModule);
      } else {
        console.warn(`Tool module '${toolName}' not found for agent '${this.name}'`);
      }
    }
  }

  /**
   * Invoke a method on the agent resource
   */
  async invoke(method, args = {}) {
    const startTime = Date.now();
    
    try {
      this.statistics.totalRequests++;
      this.statistics.lastRequest = new Date();
      
      let result;
      
      switch (method) {
        case 'chat':
          result = await this.handleChat(args);
          break;
        case 'single_shot':
          result = await this.handleSingleShot(args);
          break;
        case 'create_session':
          result = this.createSession(args);
          break;
        case 'get_session':
          result = this.getSession(args);
          break;
        case 'delete_session':
          result = this.deleteSession(args);
          break;
        case 'list_sessions':
          result = this.listSessions(args);
          break;
        case 'get_statistics':
          result = this.getStatistics();
          break;
        default:
          throw new Error(`Unknown method '${method}' for AgentResource '${this.name}'`);
      }
      
      // Update statistics
      const duration = Date.now() - startTime;
      this.updateResponseTimeStatistics(duration);
      
      return result;
      
    } catch (error) {
      this.statistics.errorCount++;
      const duration = Date.now() - startTime;
      this.updateResponseTimeStatistics(duration);
      
      throw new Error(`Agent '${this.name}' method '${method}' failed: ${error.message}`);
    }
  }

  /**
   * Handle conversational chat
   */
  async handleChat(args) {
    const { sessionId, message, context = {} } = args;
    
    if (!sessionId || !message) {
      throw new Error('Chat requires sessionId and message');
    }
    
    // Get or create session
    const session = this.sessionManager.getOrCreateSession(sessionId, context);
    
    // Add user message to session
    this.sessionManager.addMessage(sessionId, {
      role: 'user',
      content: message
    });
    
    // Prepare messages for LLM
    const messages = this.prepareMessages(session, context);
    
    // Call LLM
    const llmResponse = await this.callLLM({
      messages,
      sessionId,
      context
    });
    
    // Add assistant response to session
    this.sessionManager.addMessage(sessionId, {
      role: 'assistant',
      content: llmResponse.content,
      tokens: llmResponse.tokens
    });
    
    // Update token statistics
    if (llmResponse.tokens) {
      this.statistics.totalTokens += llmResponse.tokens;
    }
    
    return {
      response: llmResponse.content,
      sessionId,
      tokens: llmResponse.tokens,
      messageCount: session.metadata.messageCount + 1
    };
  }

  /**
   * Handle single-shot (stateless) requests
   */
  async handleSingleShot(args) {
    const { prompt, context = {} } = args;
    
    if (!prompt) {
      throw new Error('Single shot requires prompt');
    }
    
    // Prepare system prompt
    const systemPrompt = this.resolveSystemPrompt(context);
    
    // Prepare messages
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ];
    
    // Call LLM
    const llmResponse = await this.callLLM({
      messages,
      context
    });
    
    // Update token statistics
    if (llmResponse.tokens) {
      this.statistics.totalTokens += llmResponse.tokens;
    }
    
    return {
      response: llmResponse.content,
      tokens: llmResponse.tokens
    };
  }

  /**
   * Prepare messages for LLM call
   * @private
   */
  prepareMessages(session, context) {
    const messages = [];
    
    // Add system message with resolved prompt
    if (this.promptTemplate) {
      const systemPrompt = this.resolveSystemPrompt({
        ...session.context,
        ...context
      });
      messages.push({
        role: 'system',
        content: systemPrompt
      });
    }
    
    // Add conversation history
    const conversationHistory = this.sessionManager.getMessages(session.id, {
      limit: this.config.maxHistoryMessages || 50
    });
    
    messages.push(...conversationHistory.map(msg => ({
      role: msg.role,
      content: msg.content
    })));
    
    return messages;
  }

  /**
   * Resolve system prompt with context
   * @private
   */
  resolveSystemPrompt(context = {}) {
    if (!this.promptTemplate) {
      return this.config.systemPrompt || '';
    }
    
    return this.promptTemplate.render(context);
  }

  /**
   * Call the LLM module
   * @private
   */
  async callLLM(args) {
    const { messages, context = {} } = args;
    
    if (!this.llmModule) {
      throw new Error('LLM module not initialized');
    }
    
    // Prepare LLM call parameters
    const llmParams = {
      model: this.config.llm.model || 'gpt-3.5-turbo',
      messages,
      ...this.config.llm.parameters
    };
    
    // Add tools if available
    if (this.toolModules.size > 0) {
      llmParams.tools = this.getAvailableTools();
    }
    
    try {
      // Call LLM (assuming the LLM module has a 'chat_completion' tool)
      const response = await this.llmModule.invoke('chat_completion', {
        toolCall: {
          id: `agent-${Date.now()}`,
          type: 'function',
          function: {
            name: 'chat_completion',
            arguments: JSON.stringify(llmParams)
          }
        }
      });
      
      if (!response.success) {
        throw new Error(response.error || 'LLM call failed');
      }
      
      // Extract content and token usage
      const content = response.data.choices?.[0]?.message?.content || response.data.content || '';
      const tokens = response.data.usage?.total_tokens || 0;
      
      return { content, tokens };
      
    } catch (error) {
      throw new Error(`LLM call failed: ${error.message}`);
    }
  }

  /**
   * Get available tools for LLM
   * @private
   */
  getAvailableTools() {
    const tools = [];
    
    for (const [toolName, toolModule] of this.toolModules) {
      try {
        // Get tool descriptions from the module
        const moduleTools = toolModule.getTools ? toolModule.getTools() : [];
        for (const tool of moduleTools) {
          if (tool.getToolDescription) {
            tools.push(tool.getToolDescription());
          }
        }
      } catch (error) {
        console.warn(`Failed to get tools from module '${toolName}':`, error);
      }
    }
    
    return tools;
  }

  /**
   * Create a new session
   */
  createSession(args) {
    const { sessionId, context = {} } = args;
    
    const session = this.sessionManager.createSession(sessionId, context);
    
    return {
      sessionId: session.id,
      created: session.metadata.created,
      context: session.context
    };
  }

  /**
   * Get session information
   */
  getSession(args) {
    const { sessionId } = args;
    
    if (!sessionId) {
      throw new Error('Session ID is required');
    }
    
    const session = this.sessionManager.getSession(sessionId);
    
    if (!session) {
      return { found: false };
    }
    
    return {
      found: true,
      sessionId: session.id,
      messageCount: session.metadata.messageCount,
      created: session.metadata.created,
      lastActivity: session.metadata.lastActivity,
      context: session.context
    };
  }

  /**
   * Delete a session
   */
  deleteSession(args) {
    const { sessionId } = args;
    
    if (!sessionId) {
      throw new Error('Session ID is required');
    }
    
    const deleted = this.sessionManager.deleteSession(sessionId);
    
    return { deleted };
  }

  /**
   * List sessions
   */
  listSessions(args = {}) {
    const { includeInactive = true, limit = 50 } = args;
    
    const sessions = this.sessionManager.listSessions({
      includeInactive,
      sortBy: 'lastActivity'
    });
    
    return {
      sessions: sessions.slice(0, limit),
      total: sessions.length
    };
  }

  /**
   * Get agent statistics
   */
  getStatistics() {
    const sessionStats = this.sessionManager.getStatistics();
    
    return {
      agent: {
        name: this.name,
        status: this.status,
        ...this.statistics
      },
      sessions: sessionStats,
      llm: {
        model: this.config.llm.model,
        module: this.config.llm.module
      },
      tools: Array.from(this.toolModules.keys())
    };
  }

  /**
   * Update response time statistics
   * @private
   */
  updateResponseTimeStatistics(duration) {
    // Simple moving average
    const alpha = 0.1; // Weight for new measurement
    if (this.statistics.averageResponseTime === 0) {
      this.statistics.averageResponseTime = duration;
    } else {
      this.statistics.averageResponseTime = 
        (1 - alpha) * this.statistics.averageResponseTime + alpha * duration;
    }
  }

  /**
   * Perform health check
   */
  async healthCheck() {
    try {
      // Check if LLM module is available
      if (!this.llmModule) {
        this.recordHealthCheck(false, 'LLM module not available');
        return false;
      }
      
      // Perform a simple LLM call to verify connectivity
      const testResponse = await this.callLLM({
        messages: [
          { role: 'system', content: 'You are a health check assistant.' },
          { role: 'user', content: 'Respond with "OK" to confirm you are working.' }
        ]
      });
      
      const healthy = testResponse.content.toLowerCase().includes('ok');
      this.recordHealthCheck(healthy, healthy ? 'LLM responding normally' : 'LLM response unexpected');
      
      return healthy;
      
    } catch (error) {
      this.recordHealthCheck(false, `Health check failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Clean up the agent resource
   */
  async cleanup() {
    this.updateStatus(RESOURCE_STATUS.STOPPING);
    
    // Cleanup session manager
    if (this.sessionManager) {
      this.sessionManager.destroy();
      this.sessionManager = null;
    }
    
    // Clear references
    this.llmModule = null;
    this.toolModules.clear();
    this.promptTemplate = null;
    
    this.updateStatus(RESOURCE_STATUS.STOPPED);
  }
}

export default AgentResource;