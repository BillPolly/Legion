/**
 * BTAgentBase - Base class for all Behavior Tree-based agents in Aiur
 * 
 * Integrates the BehaviorTreeExecutor with Aiur's Actor system to create
 * configurable, composable agents that can be defined through JSON workflows.
 */

import { Actor } from '../../../../shared/actors/src/Actor.js';
import { BehaviorTreeExecutor } from '../../../../shared/actor-BT/src/core/BehaviorTreeExecutor.js';
import { AgentNodeRegistry } from './AgentNodeRegistry.js';
import { AgentConfigurator } from './AgentConfigurator.js';

export class BTAgentBase extends Actor {
  constructor(config = {}) {
    super();
    
    this.agentId = config.agentId || `bt-agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.sessionId = config.sessionId;
    this.agentType = config.agentType || 'generic';
    
    // Aiur infrastructure dependencies
    this.sessionManager = config.sessionManager || null;
    this.moduleLoader = config.moduleLoader || null;
    this.resourceManager = config.resourceManager || null;
    
    // BT system components
    this.btExecutor = null;
    this.nodeRegistry = new AgentNodeRegistry();
    this.configurator = new AgentConfigurator();
    
    // Agent state
    this.remoteActor = config.remoteActor || null;
    this.initialized = false;
    this.agentConfig = null;
    this.currentWorkflow = null;
    
    // Configuration
    this.configPath = config.configPath || null;
    this.debugMode = config.debugMode || false;
    
    console.log(`BTAgentBase ${this.agentId} (${this.agentType}) initialized for session ${this.sessionId}`);
  }
  
  /**
   * Initialize the BT agent with configuration and dependencies
   */
  async initialize() {
    if (this.initialized) {
      return;
    }
    
    try {
      // Load agent configuration
      await this.loadConfiguration();
      
      // Initialize BT executor with Aiur's tool registry
      this.btExecutor = new BehaviorTreeExecutor(this.getToolRegistry());
      
      // Register agent-specific BT nodes
      await this.registerAgentNodes();
      
      // Validate the loaded configuration
      await this.validateConfiguration();
      
      // Perform agent-specific initialization
      await this.initializeAgent();
      
      this.initialized = true;
      console.log(`BTAgentBase ${this.agentId} initialized successfully`);
      
    } catch (error) {
      console.error(`BTAgentBase ${this.agentId} initialization failed:`, error);
      throw error;
    }
  }
  
  /**
   * Load agent configuration from JSON file or provided config
   */
  async loadConfiguration() {
    if (this.configPath) {
      this.agentConfig = await this.configurator.loadConfig(this.configPath);
    } else {
      // Use default configuration for the agent type
      this.agentConfig = this.getDefaultConfiguration();
    }
    
    if (this.debugMode) {
      console.log(`Agent ${this.agentId} loaded configuration:`, 
        JSON.stringify(this.agentConfig, null, 2));
    }
  }
  
  /**
   * Register agent-specific BT nodes with the executor
   */
  async registerAgentNodes() {
    // Register core agent nodes
    const coreNodes = await this.nodeRegistry.getCoreNodes();
    for (const [nodeType, NodeClass] of coreNodes) {
      this.btExecutor.registerNodeType(nodeType, NodeClass);
    }
    
    // Register agent-type-specific nodes
    const agentNodes = await this.nodeRegistry.getNodesForAgentType(this.agentType);
    for (const [nodeType, NodeClass] of agentNodes) {
      this.btExecutor.registerNodeType(nodeType, NodeClass);
    }
    
    if (this.debugMode) {
      console.log(`Agent ${this.agentId} registered BT nodes:`, 
        this.btExecutor.getAvailableNodeTypes());
    }
  }
  
  /**
   * Validate the loaded configuration against available nodes
   */
  async validateConfiguration() {
    if (!this.agentConfig) {
      throw new Error('No agent configuration loaded');
    }
    
    const validation = this.btExecutor.validateTreeConfiguration(this.agentConfig);
    if (!validation.valid) {
      throw new Error(`Invalid agent configuration: ${validation.errors.join(', ')}`);
    }
    
    if (validation.warnings.length > 0 && this.debugMode) {
      console.warn(`Agent ${this.agentId} configuration warnings:`, validation.warnings);
    }
  }
  
  /**
   * Get tool registry from moduleLoader or create a mock one
   */
  getToolRegistry() {
    if (this.moduleLoader && this.moduleLoader.toolRegistry) {
      return this.moduleLoader.toolRegistry;
    }
    
    // Create a minimal tool registry wrapper
    return {
      getTool: async (name) => {
        if (this.moduleLoader) {
          return this.moduleLoader.getTool ? 
            await this.moduleLoader.getTool(name) : null;
        }
        return null;
      },
      hasTool: (name) => {
        if (this.moduleLoader) {
          return this.moduleLoader.hasTool ? 
            this.moduleLoader.hasTool(name) : false;
        }
        return false;
      }
    };
  }
  
  /**
   * Main Actor receive method - routes messages to BT workflows
   */
  async receive(payload, envelope) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (this.debugMode) {
      console.log(`BTAgent ${this.agentId} received message:`, payload?.type);
    }
    
    try {
      // Create execution context from the message
      const context = this.createExecutionContext(payload, envelope);
      
      // Execute the agent's workflow using the BT
      const result = await this.btExecutor.executeTree(this.agentConfig, context);
      
      // Handle the execution result
      const response = await this.handleExecutionResult(result, payload);
      
      // Return the response for Actor protocol
      return response;
      
    } catch (error) {
      console.error(`BTAgent ${this.agentId} execution error:`, error);
      const errorResponse = await this.handleExecutionError(error, payload);
      return errorResponse;
    }
  }
  
  /**
   * Create execution context for BT from incoming message
   */
  createExecutionContext(payload, envelope) {
    return {
      // Message information
      message: payload,
      messageType: payload?.type,
      envelope: envelope,
      
      // Agent context
      agentId: this.agentId,
      agentType: this.agentType,
      sessionId: this.sessionId,
      
      // Aiur infrastructure
      sessionManager: this.sessionManager,
      moduleLoader: this.moduleLoader,
      resourceManager: this.resourceManager,
      remoteActor: this.remoteActor,
      
      // Execution metadata
      timestamp: new Date().toISOString(),
      requestId: payload?.requestId,
      
      // Agent-specific context (override in subclasses)
      ...this.getAgentSpecificContext(payload)
    };
  }
  
  /**
   * Handle successful BT execution result
   */
  async handleExecutionResult(result, originalMessage) {
    if (this.debugMode) {
      console.log(`BTAgent ${this.agentId} execution result:`, 
        { success: result.success, status: result.status });
    }
    
    // Extract response from result context
    let response = result.context?.response || result.data?.response;
    
    // If no response was generated, create a default one
    if (!response) {
      response = {
        type: `${this.agentType}_response`,
        success: result.success,
        agentId: this.agentId,
        requestId: originalMessage?.requestId,
        data: result.data
      };
    }
    
    // If the workflow produced a response, send it to the remote actor
    if (this.remoteActor) {
      await this.sendToRemote(response);
    }
    
    // Handle agent-specific result processing
    await this.processAgentResult(result, originalMessage);
    
    // Return the response for Actor protocol
    return response;
  }
  
  /**
   * Handle BT execution errors
   */
  async handleExecutionError(error, originalMessage) {
    const errorResponse = {
      type: 'error',
      error: error.message,
      agentId: this.agentId,
      requestId: originalMessage?.requestId
    };
    
    if (this.remoteActor) {
      await this.sendToRemote(errorResponse);
    }
    
    // Allow agent-specific error handling
    await this.processAgentError(error, originalMessage);
    
    // Return the error response for Actor protocol
    return errorResponse;
  }
  
  /**
   * Send message to remote actor
   */
  async sendToRemote(message) {
    if (this.remoteActor && this.remoteActor.receive) {
      this.remoteActor.receive(message);
    } else if (this.debugMode) {
      console.warn(`BTAgent ${this.agentId}: No remote actor to send message to`);
    }
  }
  
  /**
   * Set the remote actor reference
   */
  setRemoteActor(remoteActor) {
    this.remoteActor = remoteActor;
  }
  
  // Override in subclasses for agent-specific behavior
  
  /**
   * Get default configuration for this agent type
   * @returns {Object} Default BT configuration
   */
  getDefaultConfiguration() {
    return {
      type: 'sequence',
      name: `${this.agentType}_default_workflow`,
      children: [
        {
          type: 'message_handler',
          name: 'route_message'
        }
      ]
    };
  }
  
  /**
   * Agent-specific initialization logic
   */
  async initializeAgent() {
    // Override in subclasses
  }
  
  /**
   * Get agent-specific context for BT execution
   */
  getAgentSpecificContext(payload) {
    // Override in subclasses to add agent-specific context
    return {};
  }
  
  /**
   * Process successful agent execution result
   */
  async processAgentResult(result, originalMessage) {
    // Override in subclasses for agent-specific result processing
  }
  
  /**
   * Process agent execution error
   */
  async processAgentError(error, originalMessage) {
    // Override in subclasses for agent-specific error handling
  }
  
  /**
   * Reload configuration (useful for development/testing)
   */
  async reloadConfiguration() {
    if (this.configPath) {
      await this.loadConfiguration();
      await this.validateConfiguration();
      console.log(`BTAgent ${this.agentId} configuration reloaded`);
    }
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
      configLoaded: !!this.agentConfig,
      availableNodes: this.btExecutor ? this.btExecutor.getAvailableNodeTypes() : [],
      remoteActorConnected: !!this.remoteActor
    };
  }
  
  /**
   * Clean up resources
   */
  async destroy() {
    if (this.btExecutor) {
      await this.btExecutor.shutdown();
    }
    
    this.remoteActor = null;
    this.sessionManager = null;
    this.moduleLoader = null;
    this.resourceManager = null;
    this.initialized = false;
    
    console.log(`BTAgent ${this.agentId} destroyed`);
  }
}