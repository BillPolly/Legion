/**
 * ConfigurableAgent - Main agent implementation that integrates all components
 * Follows the Actor pattern for message-based communication
 */

import { AgentState } from '../state/AgentState.js';
import { CapabilityManager } from '../capabilities/CapabilityManager.js';
import { PromptManager } from '../prompts/PromptManager.js';
import { KnowledgeGraphInterface } from '../knowledge/KnowledgeGraphInterface.js';
import { AgentBehaviorTreeExecutor } from '../bt/AgentBehaviorTreeExecutor.js';
import { validateAgentBTConfiguration } from '../bt/AgentBTConfig.js';
import { validateAgentConfig } from '../ConfigurationSchema.js';
import { createAgentError } from '../utils/ErrorHandling.js';

/**
 * Core agent class that orchestrates all components
 */
export class ConfigurableAgent {
  constructor(config, resourceManager) {
    if (!config) {
      throw createAgentError('INITIALIZATION_ERROR', 'Configuration is required');
    }
    if (!resourceManager) {
      throw createAgentError('INITIALIZATION_ERROR', 'ResourceManager is required');
    }

    // Handle both wrapped and unwrapped configurations
    let agentConfig = config;
    if (config.agent) {
      agentConfig = config.agent;
    }

    // Wrap for validation if needed
    const configToValidate = config.agent ? config : { agent: config };
    const validation = validateAgentConfig(configToValidate);
    if (!validation.valid) {
      throw createAgentError('VALIDATION_ERROR', `Invalid configuration: ${validation.errors.join(', ')}`);
    }

    this.config = agentConfig;
    this.resourceManager = resourceManager;
    this.id = agentConfig.id;
    this.name = agentConfig.name;
    this.description = agentConfig.description || '';
    this.version = agentConfig.version;
    // Store responseFormat separately if needed
    this.responseFormat = 'json'; // Default, can be overridden by prompts.responseFormats
    this.autoSaveOnShutdown = false; // Default
    
    // Component instances (initialized in initialize())
    this.state = null;
    this.capabilityManager = null;
    this.promptManager = null;
    this.btExecutor = null;
    this.knowledgeGraph = null;
    this.llmClient = null;
    
    this.initialized = false;
  }

  /**
   * Initialize all agent components
   */
  async initialize() {
    if (this.initialized) {
      throw createAgentError('INITIALIZATION_ERROR', 'Agent already initialized');
    }

    try {
      // Initialize state management
      this.state = new AgentState({
        maxMessages: this.config.state?.maxHistorySize || 100,
        pruningStrategy: this.config.state?.pruneStrategy || 'sliding-window'
      });
      await this.state.initialize();

      // Initialize capability manager
      // Convert capabilities array to the format CapabilityManager expects
      const capabilityConfig = {};
      if (Array.isArray(this.config.capabilities)) {
        capabilityConfig.modules = this.config.capabilities.map(cap => cap.module);
        capabilityConfig.tools = [];
        capabilityConfig.permissions = {};
        
        for (const cap of this.config.capabilities) {
          if (cap.tools) {
            capabilityConfig.tools.push(...cap.tools);
          }
          if (cap.permissions) {
            capabilityConfig.permissions[cap.module] = cap.permissions;
          }
        }
      }
      
      this.capabilityManager = new CapabilityManager(capabilityConfig);
      await this.capabilityManager.initialize(this.resourceManager);

      // Initialize prompt manager (pass system prompt from llm config)
      const promptConfig = { ...(this.config.prompts || {}) };
      if (this.config.llm?.systemPrompt) {
        promptConfig.systemPrompt = this.config.llm.systemPrompt;
      }
      this.promptManager = new PromptManager(promptConfig);
      await this.promptManager.initialize();

      // Initialize knowledge graph if enabled
      if (this.config.knowledge?.enabled) {
        this.knowledgeGraph = new KnowledgeGraphInterface({
          namespace: this.name,
          storageMode: this.config.knowledge.persistence || 'session'
        });
        await this.knowledgeGraph.initialize();
      }

      // Get LLM client from ResourceManager
      this.llmClient = await this.resourceManager.get('llmClient');
      if (!this.llmClient) {
        throw new Error('LLM client not available in ResourceManager');
      }

      this.initialized = true;
    } catch (error) {
      throw createAgentError(
        'INITIALIZATION_ERROR',
        `Failed to initialize agent: ${error.message}`
      );
    }
  }

  /**
   * Main message handler following Actor pattern
   */
  async receive(message) {
    if (!this.initialized) {
      return {
        type: 'error',
        error: 'Agent not initialized',
        to: message?.from
      };
    }

    // Validate message structure
    if (!message || typeof message !== 'object') {
      return {
        type: 'error',
        error: 'Invalid message format: message must be an object',
        to: message?.from
      };
    }

    if (!message.type) {
      return {
        type: 'error',
        error: 'Invalid message format: message type is required',
        to: message?.from
      };
    }

    try {
      // Route message based on type
      switch (message.type) {
        case 'chat':
          return await this._handleChatMessage(message);
        
        case 'message':
          return await this._handleBasicMessage(message);
        
        case 'tool_request':
          return await this._handleToolRequest(message);
        
        case 'query':
          return await this._handleQuery(message);
        
        case 'state_update':
          return await this._handleStateUpdate(message);
        
        case 'save_state':
          return await this._handleSaveState(message);
        
        case 'load_state':
          return await this._handleLoadState(message);
        
        case 'export_state':
          return await this._handleExportState(message);
        
        case 'shutdown':
          return await this._handleShutdown(message);
        
        case 'execute_bt':
          return await this._handleBehaviorTreeExecution(message);
        
        case 'create_bt_executor':
          return await this._handleCreateBTExecutor(message);
        
        default:
          return {
            type: 'error',
            error: `Unsupported message type: ${message.type}`,
            to: message.from
          };
      }
    } catch (error) {
      return {
        type: 'error',
        error: `Error processing message: ${error.message}`,
        to: message.from
      };
    }
  }

  /**
   * Handle chat messages with LLM
   */
  async _handleChatMessage(message) {
    if (!message.content) {
      return {
        type: 'error',
        error: 'Message content is required for chat messages',
        to: message.from,
        sessionId: message.sessionId
      };
    }

    try {
      // Add to conversation history
      this.state.addToHistory({
        role: 'user',
        content: message.content,
        timestamp: new Date().toISOString(),
        from: message.from,
        sessionId: message.sessionId
      });

      // Extract context if KG is enabled
      if (this.knowledgeGraph) {
        const history = this.state.getConversationHistory();
        const context = await this.knowledgeGraph.extractContext(history);
        
        // Store extracted entities
        for (const entity of context.entities || []) {
          await this.knowledgeGraph.storeEntity({
            id: entity.value.toLowerCase(),
            type: entity.type,
            properties: { name: entity.value }
          });
        }
        
        // Store relationships
        for (const rel of context.relationships || []) {
          await this.knowledgeGraph.addRelationship(
            rel.subject.toLowerCase(),
            rel.predicate,
            rel.object.toLowerCase()
          );
        }
      }

      // Prepare messages for LLM
      const messages = this._prepareLLMMessages(message);
      
      // Convert messages array to a single prompt string
      const promptParts = [];
      for (const msg of messages) {
        if (msg.role === 'system') {
          promptParts.push(`System: ${msg.content}`);
        } else if (msg.role === 'user') {
          promptParts.push(`User: ${msg.content}`);
        } else if (msg.role === 'assistant') {
          promptParts.push(`Assistant: ${msg.content}`);
        }
      }
      promptParts.push('Assistant:'); // End with Assistant: to prompt for response
      const prompt = promptParts.join('\n\n');

      // Call LLM with retry logic
      let response;
      let attempts = 0;
      const maxAttempts = message.retryOnError ? 2 : 1;

      while (attempts < maxAttempts) {
        try {
          attempts++;
          response = await this.llmClient.complete(
            prompt,
            this.config.llm?.maxTokens || 1000
          );
          break;
        } catch (error) {
          if (attempts >= maxAttempts) {
            throw error;
          }
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Add response to history
      this.state.addToHistory({
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString(),
        to: message.from,
        sessionId: message.sessionId
      });

      // Format response based on configuration
      const formattedContent = this._formatResponse(response);

      return {
        type: 'chat_response',
        to: message.from,
        sessionId: message.sessionId,
        content: formattedContent
      };
    } catch (error) {
      return {
        type: 'chat_response',
        to: message.from,
        sessionId: message.sessionId,
        error: `Failed to process message: ${error.message}`
      };
    }
  }

  /**
   * Handle basic messages
   */
  async _handleBasicMessage(message) {
    // Simple echo-like response for basic messages
    return {
      type: 'response',
      to: message.from,
      content: `Received your message: ${message.content}`
    };
  }

  /**
   * Handle tool execution requests
   */
  async _handleToolRequest(message) {
    const { tool, operation, params } = message;

    try {
      // Check if tool exists
      const hasAccess = await this.capabilityManager.hasToolAccess(tool, operation);
      
      if (!hasAccess) {
        const toolExists = this.capabilityManager.getTool(tool);
        if (!toolExists) {
          throw new Error(`Tool not found: ${tool}`);
        } else {
          throw new Error(`Permission denied for operation: ${operation} on tool: ${tool}`);
        }
      }

      // Execute tool
      const toolResult = await this.capabilityManager.executeTool(tool, params);
      
      // Extract result from tool response if it's wrapped
      const result = (toolResult && typeof toolResult === 'object' && 'result' in toolResult) 
        ? toolResult.result 
        : toolResult;

      return {
        type: 'tool_response',
        to: message.from,
        sessionId: message.sessionId,
        success: true,
        result
      };
    } catch (error) {
      return {
        type: 'tool_response',
        to: message.from,
        sessionId: message.sessionId,
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Handle query messages
   */
  async _handleQuery(message) {
    const { query } = message;

    try {
      let data;
      
      // Handle different query types
      if (query === 'What tools are available?') {
        data = this.capabilityManager.getAvailableTools();
      } else if (query === 'What is your configuration?') {
        data = {
          name: this.name,
          version: this.version,
          capabilities: this.config.capabilities,
          responseFormat: this.responseFormat
        };
      } else {
        // Default: try to answer via LLM but maintain query response type
        const llmMessage = {
          ...message,
          type: 'chat',
          content: query
        };
        const llmResponse = await this._handleChatMessage(llmMessage);
        
        // Convert chat response to query response
        return {
          type: 'query_response',
          to: message.from,
          sessionId: message.sessionId,
          data: {
            answer: llmResponse.content,
            query: query
          }
        };
      }

      return {
        type: 'query_response',
        to: message.from,
        sessionId: message.sessionId,
        data
      };
    } catch (error) {
      return {
        type: 'query_response',
        to: message.from,
        sessionId: message.sessionId,
        error: error.message
      };
    }
  }

  /**
   * Handle state update messages
   */
  async _handleStateUpdate(message) {
    const { updates } = message;

    try {
      for (const [key, value] of Object.entries(updates)) {
        // Pass strict: false to allow setting undefined variables
        this.state.setContextVariable(key, value, false);
      }

      return {
        type: 'state_updated',
        to: message.from,
        success: true
      };
    } catch (error) {
      return {
        type: 'state_updated',
        to: message.from,
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Handle save state request
   */
  async _handleSaveState(message) {
    try {
      const stateData = this.state.getState();
      
      // If KG is enabled, include KG export
      if (this.knowledgeGraph) {
        stateData.knowledgeGraph = await this.knowledgeGraph.exportToJSON();
      }

      // In real implementation, would save to persistent storage
      // For now, just return success
      return {
        type: 'state_saved',
        to: message.from,
        success: true,
        stateId: `state-${Date.now()}`
      };
    } catch (error) {
      return {
        type: 'state_saved',
        to: message.from,
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Handle load state request
   */
  async _handleLoadState(message) {
    const { stateId } = message;

    try {
      // In real implementation, would load from persistent storage
      // For now, just return success
      return {
        type: 'state_loaded',
        to: message.from,
        success: true,
        stateId
      };
    } catch (error) {
      return {
        type: 'state_loaded',
        to: message.from,
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Handle export state request
   */
  async _handleExportState(message) {
    try {
      const stateData = this.state.getState();
      
      // Include KG export if enabled
      if (this.knowledgeGraph) {
        stateData.knowledgeGraph = await this.knowledgeGraph.exportToJSON();
      }

      return {
        type: 'state_export',
        to: message.from,
        data: {
          agentName: this.name,
          agentVersion: this.version,
          exportedAt: new Date().toISOString(),
          state: stateData
        }
      };
    } catch (error) {
      return {
        type: 'state_export',
        to: message.from,
        error: error.message
      };
    }
  }

  /**
   * Handle shutdown request
   */
  async _handleShutdown(message) {
    const warnings = [];

    try {
      // Save state if configured
      if (this.autoSaveOnShutdown) {
        try {
          await this._handleSaveState({ from: 'system' });
        } catch (error) {
          warnings.push(`State save failed: ${error.message}`);
        }
      }

      // Cleanup components
      const cleanupTasks = [];
      
      if (this.state) {
        cleanupTasks.push(
          this.state.cleanup().catch(e => {
            warnings.push(`State cleanup failed: ${e.message}`);
          })
        );
      }

      if (this.capabilityManager) {
        cleanupTasks.push(
          this.capabilityManager.cleanup().catch(e => {
            warnings.push(`Capability manager cleanup failed: ${e.message}`);
          })
        );
      }

      if (this.knowledgeGraph) {
        cleanupTasks.push(
          this.knowledgeGraph.cleanup().catch(e => {
            warnings.push(`Knowledge graph cleanup failed: ${e.message}`);
          })
        );
      }

      await Promise.all(cleanupTasks);

      this.initialized = false;

      const response = {
        type: 'shutdown_complete',
        to: message.from
      };

      if (this.autoSaveOnShutdown) {
        response.stateSaved = true;
      }

      if (warnings.length > 0) {
        response.warnings = warnings;
      }

      return response;
    } catch (error) {
      return {
        type: 'shutdown_complete',
        to: message.from,
        error: error.message,
        warnings
      };
    }
  }

  /**
   * Prepare messages for LLM including system prompt and history
   */
  _prepareLLMMessages(message) {
    const messages = [];

    // Add system prompt
    const systemPrompt = this.promptManager.getSystemPrompt();
    messages.push({
      role: 'system',
      content: systemPrompt
    });

    // Add conversation history (limited)
    const history = this.state.getConversationHistory();
    const recentHistory = history.slice(-10); // Last 10 messages
    
    for (const msg of recentHistory) {
      if (msg.content !== message.content) { // Don't duplicate current message
        messages.push({
          role: msg.role,
          content: msg.content
        });
      }
    }

    // Process template if specified
    let content = message.content;
    if (message.metadata?.template) {
      content = this.promptManager.processTemplate(
        message.metadata.template,
        message.metadata.variables || {}
      );
    }

    // Add current message
    messages.push({
      role: 'user',
      content
    });

    return messages;
  }

  /**
   * Format response based on configuration
   */
  _formatResponse(response) {
    if (this.responseFormat === 'json') {
      // Try to parse as JSON, or wrap in object
      try {
        return typeof response === 'string' ? JSON.parse(response) : response;
      } catch {
        return { content: response };
      }
    } else if (this.responseFormat === 'markdown') {
      // Ensure it's a string
      return typeof response === 'string' ? response : JSON.stringify(response, null, 2);
    } else {
      // Default: return as-is
      return response;
    }
  }

  /**
   * Get agent metadata
   */
  getMetadata() {
    // Extract tool names from capabilities array
    const capabilityTools = [];
    if (Array.isArray(this.config.capabilities)) {
      for (const cap of this.config.capabilities) {
        capabilityTools.push(cap.module);
      }
    }
    
    return {
      name: this.name,
      description: this.description,
      version: this.version,
      capabilities: capabilityTools,
      responseFormat: this.responseFormat,
      initialized: this.initialized
    };
  }

  /**
   * Handle behavior tree execution request
   */
  async _handleBehaviorTreeExecution(message) {
    try {
      if (!message.btConfig) {
        return {
          type: 'bt_execution_error',
          error: 'Behavior tree configuration is required',
          to: message.from,
          sessionId: message.sessionId
        };
      }

      // Validate BT configuration
      const validation = validateAgentBTConfiguration(message.btConfig);
      if (!validation.valid) {
        return {
          type: 'bt_execution_error', 
          error: `Invalid BT configuration: ${validation.errors.join(', ')}`,
          to: message.from,
          sessionId: message.sessionId
        };
      }

      // Create or use existing BT executor
      if (!this.btExecutor) {
        await this._createBTExecutor();
      }

      // Execute the behavior tree
      const executionContext = {
        sessionId: message.sessionId || `bt-${Date.now()}`,
        requestId: message.requestId,
        userInput: message.userInput,
        ...message.context
      };

      const result = await this.btExecutor.executeTree(message.btConfig, executionContext);

      return {
        type: 'bt_execution_result',
        success: result.success,
        status: result.status,
        data: result.data,
        agentData: result.agentData,
        artifacts: result.context?.artifacts,
        executionTime: result.executionTime,
        to: message.from,
        sessionId: message.sessionId,
        requestId: message.requestId
      };

    } catch (error) {
      console.error('[ConfigurableAgent] BT execution error:', error.message);
      console.error('[ConfigurableAgent] BT execution stack:', error.stack);
      
      return {
        type: 'bt_execution_error',
        error: `BT execution failed: ${error.message}`,
        stack: error.stack,
        to: message.from,
        sessionId: message.sessionId
      };
    }
  }

  /**
   * Handle BT executor creation request
   */
  async _handleCreateBTExecutor(message) {
    try {
      const options = {
        sessionId: message.sessionId || `executor-${Date.now()}`,
        debugMode: message.debugMode || false,
        ...message.options
      };

      await this._createBTExecutor(options);

      return {
        type: 'bt_executor_created',
        success: true,
        metadata: this.btExecutor?.getAgentMetadata(),
        to: message.from,
        sessionId: message.sessionId
      };

    } catch (error) {
      return {
        type: 'bt_executor_error',
        error: `Failed to create BT executor: ${error.message}`,
        to: message.from,
        sessionId: message.sessionId
      };
    }
  }

  /**
   * Create behavior tree executor instance
   * @param {Object} options - Executor options
   */
  async _createBTExecutor(options = {}) {
    if (!this.btExecutor) {
      // Get tool registry from capability manager
      const toolRegistry = this.capabilityManager?.toolRegistry || null;
      
      this.btExecutor = new AgentBehaviorTreeExecutor(toolRegistry, this, {
        debugMode: options.debugMode || false,
        sessionId: options.sessionId || `bt-${Date.now()}`,
        ...options
      });

      // Set up event forwarding from BT executor
      if (this.eventEmitter && this.btExecutor) {
        this.btExecutor.on('agent:execution_error', (data) => {
          this.eventEmitter.emit('bt_execution_error', data);
        });

        this.btExecutor.on('tree:complete', (data) => {
          this.eventEmitter.emit('bt_execution_complete', data);
        });

        this.btExecutor.on('tree:start', (data) => {
          this.eventEmitter.emit('bt_execution_start', data);
        });
      }
    }
  }

  /**
   * Execute a simple agent chat through behavior tree
   * @param {string} userMessage - User message
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Execution result
   */
  async executeAgentChat(userMessage, options = {}) {
    if (!this.btExecutor) {
      await this._createBTExecutor();
    }
    
    return await this.btExecutor.executeAgentChat(userMessage, options);
  }

  /**
   * Execute tool through behavior tree
   * @param {string} toolName - Tool name
   * @param {string} operation - Operation
   * @param {Object} params - Parameters
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Execution result
   */
  async executeAgentTool(toolName, operation, params = {}, options = {}) {
    if (!this.btExecutor) {
      await this._createBTExecutor();
    }
    
    return await this.btExecutor.executeAgentTool(toolName, operation, params, options);
  }

  /**
   * Get behavior tree executor metadata
   * @returns {Object} BT executor metadata
   */
  getBTExecutorMetadata() {
    if (!this.btExecutor) {
      return { btExecutorAvailable: false };
    }
    
    return {
      btExecutorAvailable: true,
      ...this.btExecutor.getAgentMetadata()
    };
  }
}