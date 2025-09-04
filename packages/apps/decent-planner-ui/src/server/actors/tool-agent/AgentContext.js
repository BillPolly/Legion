/**
 * AgentContext - Serializable context for AgentTools
 * 
 * Provides full agent capabilities to tools while handling serialization properly
 */

export class AgentContext {
  constructor(capabilities = {}) {
    // Store all agent capabilities for tool execution
    this.resourceActor = capabilities.resourceActor;
    this.toolRegistry = capabilities.toolRegistry;
    this.llmClient = capabilities.llmClient;
    this.plannerActor = capabilities.plannerActor;
    this.chatActor = capabilities.chatActor;
    this.parentActor = capabilities.parentActor;
    this.artifacts = capabilities.artifacts;
  }
  
  /**
   * Custom serialization method to handle circular references
   * Returns simple object for client transmission
   */
  serialize() {
    return {
      type: 'AgentContext',
      hasResourceActor: !!this.resourceActor,
      hasToolRegistry: !!this.toolRegistry,
      hasLLMClient: !!this.llmClient,
      hasPlannerActor: !!this.plannerActor,
      capabilities: [
        'resourceActor',
        'toolRegistry', 
        'llmClient',
        'plannerActor',
        'chatActor'
      ].filter(cap => !!this[cap])
    };
  }
  
  /**
   * Get the ResourceServerSubActor (same as /show command uses)
   */
  getResourceActor() {
    return this.resourceActor;
  }
  
  /**
   * Get tool registry for tool discovery
   */
  getToolRegistry() {
    return this.toolRegistry;
  }
  
  /**
   * Get LLM client for AI operations
   */
  getLLMClient() {
    return this.llmClient;
  }
}