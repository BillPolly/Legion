/**
 * Temporary BTAgentBase for SD package
 * 
 * This is a simplified version of Legion's BTAgentBase specifically for SD.
 * Once Legion's actor-BT package is properly exported, this can be replaced.
 */

// Temporary Actor base class for SD
class Actor {
  constructor() {
    this.id = `actor-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  async receive(message, envelope) {
    throw new Error('receive() method must be implemented by subclasses');
  }
  
  getMetadata() {
    return {
      id: this.id,
      type: 'Actor'
    };
  }
}

export class BTAgentBase extends Actor {
  constructor(config = {}) {
    super();
    
    this.agentId = config.agentId || `sd-agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.agentType = config.agentType || 'sd-generic';
    this.name = config.name || 'UnnamedAgent';
    this.description = config.description || '';
    
    // Configuration
    this.config = config;
    this.initialized = false;
    
    // SD-specific properties
    this.resourceManager = config.resourceManager || null;
    this.moduleLoader = config.moduleLoader || null;
    
    console.log(`BTAgentBase ${this.agentId} (${this.agentType}) initialized`);
  }
  
  /**
   * Initialize the BT agent
   */
  async initialize() {
    if (this.initialized) {
      return;
    }
    
    this.initialized = true;
    console.log(`BTAgentBase ${this.agentId} initialized`);
  }
  
  /**
   * Get ResourceManager instance
   */
  getResourceManager() {
    return this.resourceManager;
  }
  
  /**
   * Execute a BT workflow (placeholder)
   */
  async executeBTWorkflow(workflow, context) {
    console.log(`[${this.name}] Executing BT workflow:`, workflow.id);
    
    // This is a placeholder - in real Legion this would use BehaviorTreeExecutor
    return {
      success: true,
      data: {
        workflowId: workflow.id,
        executionTime: Date.now(),
        results: {}
      }
    };
  }
  
  /**
   * Create execution context for BT workflows
   */
  createExecutionContext(contextData) {
    return {
      timestamp: new Date().toISOString(),
      agentId: this.agentId,
      agentType: this.agentType,
      ...contextData
    };
  }
  
  /**
   * Handle incoming messages (Actor interface)
   */
  async receive(message, envelope) {
    console.log(`[${this.name}] Received message:`, message.type);
    
    // Default implementation - subclasses should override
    return {
      success: false,
      error: `${this.name} does not handle message type: ${message.type}`
    };
  }
  
  /**
   * Get agent metadata
   */
  getMetadata() {
    return {
      agentId: this.agentId,
      agentType: this.agentType,
      name: this.name,
      description: this.description,
      initialized: this.initialized
    };
  }
}