/**
 * AgentNodeRegistry - Registry for agent-specific BT nodes
 * 
 * Manages the registration and loading of specialized BT nodes designed
 * for agent functionality within the Aiur system.
 */

export class AgentNodeRegistry {
  constructor() {
    this.coreNodes = new Map();
    this.agentTypeNodes = new Map();
    this.initialized = false;
  }
  
  /**
   * Initialize the registry with core and agent-specific nodes
   */
  async initialize() {
    if (this.initialized) return;
    
    await this.registerCoreNodes();
    await this.registerAgentTypeNodes();
    
    this.initialized = true;
  }
  
  /**
   * Register core nodes used by all agent types
   */
  async registerCoreNodes() {
    try {
      // MessageHandlerNode - Routes messages to appropriate workflows
      const { MessageHandlerNode } = await import('../nodes/MessageHandlerNode.js');
      this.coreNodes.set('message_handler', MessageHandlerNode);
      
      // ErrorHandlerNode - Centralized error handling
      const { ErrorHandlerNode } = await import('../nodes/ErrorHandlerNode.js');
      this.coreNodes.set('error_handler', ErrorHandlerNode);
      
      // SessionManagerNode - Session lifecycle management
      const { SessionManagerNode } = await import('../nodes/SessionManagerNode.js');
      this.coreNodes.set('session_manager', SessionManagerNode);
      
      console.log('AgentNodeRegistry: Core nodes registered');
    } catch (error) {
      console.error('AgentNodeRegistry: Failed to register core nodes:', error);
      // Continue with empty registry rather than failing
    }
  }
  
  /**
   * Register nodes specific to different agent types
   */
  async registerAgentTypeNodes() {
    // Chat agent nodes
    await this.registerChatNodes();
    
    // Terminal agent nodes  
    await this.registerTerminalNodes();
    
    // Artifact agent nodes
    await this.registerArtifactNodes();
    
    console.log('AgentNodeRegistry: Agent-specific nodes registered');
  }
  
  /**
   * Register nodes specific to chat agents
   */
  async registerChatNodes() {
    const chatNodes = new Map();
    
    try {
      // LLM interaction nodes
      const { LLMInteractionNode } = await import('../nodes/LLMInteractionNode.js');
      chatNodes.set('llm_interaction', LLMInteractionNode);
      
      const { ConversationManagerNode } = await import('../nodes/ConversationManagerNode.js');
      chatNodes.set('conversation_manager', ConversationManagerNode);
      
      // Tool execution nodes
      const { ToolExecutionNode } = await import('../nodes/ToolExecutionNode.js');
      chatNodes.set('tool_execution', ToolExecutionNode);
      
      // Response handling
      const { ResponseSenderNode } = await import('../nodes/ResponseSenderNode.js');
      chatNodes.set('response_sender', ResponseSenderNode);
      
      // Voice integration
      const { VoiceIntegrationNode } = await import('../nodes/VoiceIntegrationNode.js');
      chatNodes.set('voice_integration', VoiceIntegrationNode);
      
    } catch (error) {
      console.warn('AgentNodeRegistry: Some chat nodes failed to load:', error.message);
    }
    
    this.agentTypeNodes.set('chat', chatNodes);
  }
  
  /**
   * Register nodes specific to terminal agents
   */
  async registerTerminalNodes() {
    const terminalNodes = new Map();
    
    try {
      // Tool execution and management
      const { ToolExecutionNode } = await import('../nodes/ToolExecutionNode.js');
      terminalNodes.set('tool_execution', ToolExecutionNode);
      
      // Module management
      const { ModuleManagerNode } = await import('../nodes/ModuleManagerNode.js');
      terminalNodes.set('module_manager', ModuleManagerNode);
      
      // Tools list management
      const { ToolsListNode } = await import('../nodes/ToolsListNode.js');
      terminalNodes.set('tools_list', ToolsListNode);
      
    } catch (error) {
      console.warn('AgentNodeRegistry: Some terminal nodes failed to load:', error.message);
    }
    
    this.agentTypeNodes.set('terminal', terminalNodes);
  }
  
  /**
   * Register nodes specific to artifact agents
   */
  async registerArtifactNodes() {
    const artifactNodes = new Map();
    
    try {
      // Artifact processing
      const { ArtifactProcessingNode } = await import('../nodes/ArtifactProcessingNode.js');
      artifactNodes.set('artifact_processor', ArtifactProcessingNode);
      
      // Artifact detection
      const { ArtifactDetectionNode } = await import('../nodes/ArtifactDetectionNode.js');
      artifactNodes.set('artifact_detection', ArtifactDetectionNode);
      
      // Artifact storage and retrieval
      const { ArtifactStorageNode } = await import('../nodes/ArtifactStorageNode.js');
      artifactNodes.set('artifact_storage', ArtifactStorageNode);
      
      // Artifact synchronization
      const { ArtifactSyncNode } = await import('../nodes/ArtifactSyncNode.js');
      artifactNodes.set('artifact_sync', ArtifactSyncNode);
      
    } catch (error) {
      console.warn('AgentNodeRegistry: Some artifact nodes failed to load:', error.message);
    }
    
    this.agentTypeNodes.set('artifact', artifactNodes);
  }
  
  /**
   * Get core nodes available to all agents
   */
  async getCoreNodes() {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.coreNodes;
  }
  
  /**
   * Get nodes specific to an agent type
   */
  async getNodesForAgentType(agentType) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    const nodes = this.agentTypeNodes.get(agentType);
    return nodes || new Map();
  }
  
  /**
   * Get all nodes for an agent type (core + specific)
   */
  async getAllNodesForAgentType(agentType) {
    const coreNodes = await this.getCoreNodes();
    const agentNodes = await this.getNodesForAgentType(agentType);
    
    // Combine core and agent-specific nodes
    const allNodes = new Map();
    
    // Add core nodes first
    for (const [type, NodeClass] of coreNodes) {
      allNodes.set(type, NodeClass);
    }
    
    // Add agent-specific nodes (will override core nodes if same name)
    for (const [type, NodeClass] of agentNodes) {
      allNodes.set(type, NodeClass);
    }
    
    return allNodes;
  }
  
  /**
   * Check if a node type is available for an agent type
   */
  async hasNodeType(nodeType, agentType = null) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    // Check core nodes first
    if (this.coreNodes.has(nodeType)) {
      return true;
    }
    
    // Check agent-specific nodes if agent type provided
    if (agentType) {
      const agentNodes = this.agentTypeNodes.get(agentType);
      if (agentNodes && agentNodes.has(nodeType)) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Get node class by type and agent type
   */
  async getNodeClass(nodeType, agentType = null) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    // Check agent-specific nodes first (more specific)
    if (agentType) {
      const agentNodes = this.agentTypeNodes.get(agentType);
      if (agentNodes && agentNodes.has(nodeType)) {
        return agentNodes.get(nodeType);
      }
    }
    
    // Fallback to core nodes
    return this.coreNodes.get(nodeType);
  }
  
  /**
   * Register a custom node type dynamically
   */
  registerCustomNode(nodeType, NodeClass, agentType = null) {
    if (agentType) {
      // Register for specific agent type
      if (!this.agentTypeNodes.has(agentType)) {
        this.agentTypeNodes.set(agentType, new Map());
      }
      this.agentTypeNodes.get(agentType).set(nodeType, NodeClass);
    } else {
      // Register as core node
      this.coreNodes.set(nodeType, NodeClass);
    }
    
    console.log(`AgentNodeRegistry: Custom node '${nodeType}' registered for ${agentType || 'all agents'}`);
  }
  
  /**
   * Get available node types for an agent
   */
  async getAvailableNodeTypes(agentType = null) {
    const allNodes = agentType ? 
      await this.getAllNodesForAgentType(agentType) :
      await this.getCoreNodes();
      
    return Array.from(allNodes.keys());
  }
  
  /**
   * Get registry statistics
   */
  getStats() {
    const stats = {
      coreNodes: this.coreNodes.size,
      agentTypes: this.agentTypeNodes.size,
      agentSpecificNodes: {}
    };
    
    for (const [agentType, nodes] of this.agentTypeNodes) {
      stats.agentSpecificNodes[agentType] = nodes.size;
    }
    
    return stats;
  }
}