/**
 * AgentBehaviorTreeExecutor - Behavior tree executor specialized for ConfigurableAgent integration
 * 
 * Extends the base BehaviorTreeExecutor with agent-specific functionality
 */

import { BehaviorTreeExecutor } from '@legion/bt-task';
import { registerAgentNodeTypes } from './nodes/index.js';

export class AgentBehaviorTreeExecutor extends BehaviorTreeExecutor {
  constructor(toolRegistry, agent = null, options = {}) {
    super(toolRegistry, options);
    
    this.agent = agent;
    this.options = options;  // Store options for later use
    this.agentNodeTypes = new Set();
    this.executionContext = {
      sessionId: options.sessionId || 'bt-session',
      agentId: agent?.id || 'unknown-agent',
      startTime: null,
      artifacts: {},
      ...options.context
    };
    
    // Register agent-specific node types
    this.initializeAgentNodes();
    
    // Set up event handlers for agent integration
    this.setupAgentIntegration();
  }

  /**
   * Initialize agent-specific behavior tree nodes
   */
  initializeAgentNodes() {
    if (this.agent) {
      // Register all agent node types with the agent bound to them
      registerAgentNodeTypes(this, this.agent);
      
      // Track which node types are agent-specific
      this.agentNodeTypes.add('agent_chat');
      this.agentNodeTypes.add('agent_tool'); 
      this.agentNodeTypes.add('agent_query');
      this.agentNodeTypes.add('agent_state');
      
      if (this.options && this.options.debugMode) {
        console.log(`[AgentBehaviorTreeExecutor] Registered agent node types for agent: ${this.agent.name}`);
      }
    }
  }

  /**
   * Set up agent integration event handlers
   */
  setupAgentIntegration() {
    // Listen for agent events and forward them to BT execution context
    if (this.agent && this.agent.eventEmitter) {
      this.agent.eventEmitter.on('message_processed', (data) => {
        this.emit('agent:message_processed', data);
      });
      
      this.agent.eventEmitter.on('tool_executed', (data) => {
        this.emit('agent:tool_executed', data);
      });
      
      this.agent.eventEmitter.on('state_changed', (data) => {
        this.emit('agent:state_changed', data);
      });
    }

    // Handle BT execution events
    this.on('tree:start', (data) => {
      this.executionContext.startTime = Date.now();
      if (this.options && this.options.debugMode) {
        console.log(`[AgentBehaviorTreeExecutor] Tree execution started for agent: ${this.agent?.name}`);
      }
    });

    this.on('tree:complete', (data) => {
      const executionTime = Date.now() - this.executionContext.startTime;
      if (this.options && this.options.debugMode) {
        console.log(`[AgentBehaviorTreeExecutor] Tree execution completed in ${executionTime}ms`);
      }
    });
  }

  /**
   * Execute behavior tree with agent context
   * @param {Object} treeConfig - BT configuration
   * @param {Object} context - Execution context (optional)
   * @returns {Promise<Object>} Execution result
   */
  async executeTree(treeConfig, context = {}) {
    // Merge provided context with agent execution context
    const mergedContext = {
      ...this.executionContext,
      ...context,
      artifacts: {
        ...this.executionContext.artifacts,
        ...context.artifacts
      }
    };

    try {
      // Validate tree configuration contains agent nodes properly
      this.validateAgentTreeConfig(treeConfig);
      
      // Execute with merged context
      const result = await super.executeTree(treeConfig, mergedContext);
      
      // Post-process result with agent-specific information
      return this.enrichResultWithAgentData(result, mergedContext);
      
    } catch (error) {
      // Handle agent-specific errors
      return this.handleAgentExecutionError(error, treeConfig, mergedContext);
    }
  }

  /**
   * Validate that tree configuration is compatible with agent nodes
   * @param {Object} treeConfig - BT configuration to validate
   */
  validateAgentTreeConfig(treeConfig) {
    if (!treeConfig) {
      throw new Error('Tree configuration is required');
    }

    // Check if tree uses agent nodes but no agent is bound
    const usesAgentNodes = this.containsAgentNodes(treeConfig);
    if (usesAgentNodes && !this.agent) {
      throw new Error('Tree configuration contains agent nodes but no agent is bound to executor');
    }

    // Validate agent node configurations
    this.validateAgentNodeConfigurations(treeConfig);
  }

  /**
   * Recursively check if tree configuration contains agent-specific nodes
   * @param {Object} nodeConfig - Node configuration
   * @returns {boolean} True if contains agent nodes
   */
  containsAgentNodes(nodeConfig) {
    if (!nodeConfig) return false;
    
    if (this.agentNodeTypes.has(nodeConfig.type)) {
      return true;
    }
    
    if (nodeConfig.children) {
      return nodeConfig.children.some(child => this.containsAgentNodes(child));
    }
    
    return false;
  }

  /**
   * Validate agent node configurations in the tree
   * @param {Object} nodeConfig - Root node configuration
   */
  validateAgentNodeConfigurations(nodeConfig) {
    if (!nodeConfig) return;
    
    // If this is an agent node, validate its configuration
    if (this.agentNodeTypes.has(nodeConfig.type)) {
      const NodeClass = this.nodeTypes.get(nodeConfig.type);
      if (NodeClass && NodeClass.validateConfiguration) {
        const validation = NodeClass.validateConfiguration(nodeConfig);
        if (!validation.valid) {
          throw new Error(`Invalid ${nodeConfig.type} configuration: ${validation.errors.join(', ')}`);
        }
      }
    }
    
    // Recursively validate children
    if (nodeConfig.children) {
      nodeConfig.children.forEach(child => this.validateAgentNodeConfigurations(child));
    }
  }

  /**
   * Enrich execution result with agent-specific data
   * @param {Object} result - BT execution result
   * @param {Object} context - Execution context
   * @returns {Object} Enhanced result
   */
  enrichResultWithAgentData(result, context) {
    return {
      ...result,
      artifacts: context.artifacts || {},  // Include artifacts directly in result
      agentData: {
        agentId: this.agent?.id || 'unknown',
        agentName: this.agent?.name || 'unknown',
        sessionId: context.sessionId,
        executionTime: Date.now() - context.startTime,
        nodeTypesUsed: this.getNodeTypesUsed(result),
        artifactsGenerated: Object.keys(context.artifacts || {}),
        agentInteractions: this.countAgentInteractions(result)
      }
    };
  }

  /**
   * Get list of node types that were used in execution
   * @param {Object} result - Execution result
   * @returns {Array<string>} Node types used
   */
  getNodeTypesUsed(result) {
    const nodeTypes = new Set();
    
    if (result.nodeResults) {
      Object.values(result.nodeResults).forEach(nodeResult => {
        if (nodeResult.type) {
          nodeTypes.add(nodeResult.type);
        }
      });
    }
    
    return Array.from(nodeTypes);
  }

  /**
   * Count agent-specific interactions in the execution
   * @param {Object} result - Execution result
   * @returns {Object} Interaction counts
   */
  countAgentInteractions(result) {
    const interactions = {
      chatMessages: 0,
      toolExecutions: 0,
      queries: 0,
      stateOperations: 0
    };

    if (result.nodeResults) {
      Object.values(result.nodeResults).forEach(nodeResult => {
        if (nodeResult.type === 'agent_chat') interactions.chatMessages++;
        if (nodeResult.type === 'agent_tool') interactions.toolExecutions++;
        if (nodeResult.type === 'agent_query') interactions.queries++;
        if (nodeResult.type === 'agent_state') interactions.stateOperations++;
      });
    }

    return interactions;
  }

  /**
   * Handle agent-specific execution errors
   * @param {Error} error - The error that occurred
   * @param {Object} treeConfig - Tree configuration
   * @param {Object} context - Execution context
   * @returns {Object} Error result
   */
  handleAgentExecutionError(error, treeConfig, context) {
    const errorResult = {
      success: false,
      status: 'FAILED',
      error: error.message,
      stack: error.stack,  // Include stack trace for debugging
      agentData: {
        agentId: this.agent?.id || 'unknown',
        agentName: this.agent?.name || 'unknown',
        sessionId: context.sessionId,
        errorType: 'AGENT_BT_EXECUTION_ERROR',
        timestamp: Date.now()
      }
    };

    // Always log error details for debugging
    console.error(`[AgentBehaviorTreeExecutor] Execution failed for agent ${this.agent?.name}:`, error.message);
    console.error('Error stack:', error.stack);
    console.error('Tree config type:', treeConfig?.type, 'id:', treeConfig?.id);
    
    // Log agent-specific error details
    if (this.options && this.options.debugMode) {
      console.error('Full tree config:', JSON.stringify(treeConfig, null, 2));
    }

    // Emit agent error event
    this.emit('agent:execution_error', {
      error: error.message,
      stack: error.stack,
      agentId: this.agent?.id,
      sessionId: context.sessionId,
      treeConfig
    });

    return errorResult;
  }

  /**
   * Create execution context with agent data
   * @param {Object} options - Context options
   * @returns {Object} Execution context
   */
  createAgentExecutionContext(options = {}) {
    return {
      sessionId: options.sessionId || `bt-session-${Date.now()}`,
      agentId: this.agent?.id || 'unknown-agent',
      agentName: this.agent?.name || 'unknown',
      startTime: Date.now(),
      artifacts: {},
      userInput: options.userInput || null,
      goalDescription: options.goalDescription || null,
      ...options
    };
  }

  /**
   * Execute a simple agent interaction tree
   * @param {string} userMessage - User message to process
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Execution result
   */
  async executeAgentChat(userMessage, options = {}) {
    const sessionId = options.sessionId || `chat-${Date.now()}`;
    
    const chatTreeConfig = {
      type: 'agent_chat',
      id: 'simple-chat',
      name: 'Simple Agent Chat',
      message: userMessage,
      sessionId: sessionId,
      outputVariable: 'chatResponse'
    };

    const context = this.createAgentExecutionContext({
      sessionId,
      userInput: userMessage,
      ...options
    });

    return await this.executeTree(chatTreeConfig, context);
  }

  /**
   * Execute tool through agent
   * @param {string} toolName - Name of tool to execute
   * @param {string} operation - Operation to perform
   * @param {Object} params - Tool parameters
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Execution result
   */
  async executeAgentTool(toolName, operation, params = {}, options = {}) {
    const sessionId = options.sessionId || `tool-${Date.now()}`;
    
    const toolTreeConfig = {
      type: 'agent_tool',
      id: 'simple-tool',
      name: 'Simple Agent Tool',
      tool: toolName,
      operation: operation,
      params: params,
      sessionId: sessionId,
      outputVariable: 'toolResponse'
    };

    const context = this.createAgentExecutionContext({
      sessionId,
      toolName,
      operation,
      params,
      ...options
    });

    return await this.executeTree(toolTreeConfig, context);
  }

  /**
   * Get agent metadata for BT execution
   */
  getAgentMetadata() {
    if (!this.agent) {
      return { agentAvailable: false };
    }

    return {
      agentAvailable: true,
      agentId: this.agent.id,
      agentName: this.agent.name,
      agentType: this.agent.type,
      agentVersion: this.agent.version,
      capabilities: this.agent.capabilities?.map(cap => cap.module) || [],
      initialized: this.agent.initialized,
      nodeTypesRegistered: Array.from(this.agentNodeTypes)
    };
  }

  /**
   * Bind a new agent to this executor
   * @param {ConfigurableAgent} newAgent - Agent to bind
   */
  bindAgent(newAgent) {
    if (this.agent !== newAgent) {
      this.agent = newAgent;
      this.executionContext.agentId = newAgent?.id || 'unknown-agent';
      
      // Re-initialize agent nodes with new agent
      this.initializeAgentNodes();
      this.setupAgentIntegration();
      
      if (this.options.debugMode) {
        console.log(`[AgentBehaviorTreeExecutor] Bound to new agent: ${newAgent?.name}`);
      }
    }
  }
}