/**
 * BT-Based Agents for Aiur Server
 * 
 * Next-generation agents built on the Behavior Tree framework, providing
 * configurable, composable, and extensible agent functionality.
 */

// Core infrastructure
export { BTAgentBase } from './core/BTAgentBase.js';
export { AgentNodeRegistry } from './core/AgentNodeRegistry.js';
export { AgentConfigurator } from './core/AgentConfigurator.js';

// BT-based agents
import { ChatBTAgent } from './agents/ChatBTAgent.js';
import { TerminalBTAgent } from './agents/TerminalBTAgent.js'; 
import { ArtifactBTAgent } from './agents/ArtifactBTAgent.js';
import { LogCaptureBTAgent } from './agents/LogCaptureBTAgent.js';

export { ChatBTAgent, TerminalBTAgent, ArtifactBTAgent, LogCaptureBTAgent };

// Core agent nodes
export { MessageHandlerNode } from './nodes/MessageHandlerNode.js';
export { ErrorHandlerNode } from './nodes/ErrorHandlerNode.js';
export { SessionManagerNode } from './nodes/SessionManagerNode.js';
export { ResponseSenderNode } from './nodes/ResponseSenderNode.js';

// LLM and conversation nodes
export { LLMInteractionNode } from './nodes/LLMInteractionNode.js';
export { ConversationManagerNode } from './nodes/ConversationManagerNode.js';

// Tool execution nodes
export { ToolExecutionNode } from './nodes/ToolExecutionNode.js';

// Artifact processing nodes
export { ArtifactProcessingNode } from './nodes/ArtifactProcessingNode.js';

// Voice integration nodes
export { VoiceIntegrationNode } from './nodes/VoiceIntegrationNode.js';

// BT-based testing system
export { 
  TestingBTBase, 
  TestScenarioRunner,
  setupTestingEnvironment,
  quickTestAllAgents,
  testChatAgent,
  testTerminalAgent,
  testArtifactAgent,
  validateActorInterface
} from './testing/index.js';

/**
 * Factory functions for creating BT agents
 */

/**
 * Create a ChatBTAgent with default configuration
 */
export async function createChatBTAgent(config = {}) {
  const agent = new ChatBTAgent(config);
  await agent.initialize();
  return agent;
}

/**
 * Create a TerminalBTAgent with default configuration
 */
export async function createTerminalBTAgent(config = {}) {
  const agent = new TerminalBTAgent(config);
  await agent.initialize();
  return agent;
}

/**
 * Create an ArtifactBTAgent with default configuration
 */
export async function createArtifactBTAgent(config = {}) {
  const agent = new ArtifactBTAgent(config);
  await agent.initialize();
  return agent;
}

/**
 * Agent type registry for dynamic creation
 */
const AGENT_TYPES = {
  'chat': ChatBTAgent,
  'terminal': TerminalBTAgent,
  'artifact': ArtifactBTAgent
};

/**
 * Create agent by type
 */
export async function createAgentByType(agentType, config = {}) {
  const AgentClass = AGENT_TYPES[agentType];
  if (!AgentClass) {
    throw new Error(`Unknown agent type: ${agentType}. Available types: ${Object.keys(AGENT_TYPES).join(', ')}`);
  }
  
  const agent = new AgentClass(config);
  await agent.initialize();
  return agent;
}

/**
 * Get available agent types
 */
export function getAvailableAgentTypes() {
  return Object.keys(AGENT_TYPES);
}

/**
 * Agent configuration helpers
 */

/**
 * Load agent configuration from file
 */
export async function loadAgentConfig(agentType, configPath = null) {
  const configurator = new AgentConfigurator();
  
  if (configPath) {
    return await configurator.loadConfig(configPath);
  } else {
    // Use default config for agent type
    return configurator.getDefaultConfig(agentType);
  }
}

/**
 * Validate agent configuration
 */
export async function validateAgentConfig(config, agentType = null) {
  const registry = new AgentNodeRegistry();
  await registry.initialize();
  
  // Get available nodes for validation
  const availableNodes = agentType ? 
    await registry.getAllNodesForAgentType(agentType) :
    await registry.getCoreNodes();
    
  // Create a temporary BT executor for validation
  const { BehaviorTreeExecutor } = await import('../../shared/actor-BT/src/core/BehaviorTreeExecutor.js');
  const executor = new BehaviorTreeExecutor(null);
  
  // Register available nodes
  for (const [nodeType, NodeClass] of availableNodes) {
    executor.registerNodeType(nodeType, NodeClass);
  }
  
  // Validate configuration
  return executor.validateTreeConfiguration(config);
}

/**
 * Integration helpers for Aiur server
 */

/**
 * Create agent set for ServerActorSpace integration
 */
export async function createAgentSet(config = {}) {
  const {
    agentType = 'classic', // 'classic' or 'bt'
    sessionId,
    sessionManager,
    moduleLoader,
    resourceManager,
    debugMode = false
  } = config;
  
  if (agentType === 'bt') {
    // Create BT-based agents
    const chatAgent = await createChatBTAgent({
      sessionId,
      sessionManager,
      moduleLoader,
      resourceManager,
      debugMode
    });
    
    const terminalAgent = await createTerminalBTAgent({
      sessionId,
      sessionManager,
      moduleLoader,
      resourceManager,
      debugMode
    });
    
    const artifactAgent = await createArtifactBTAgent({
      sessionId,
      sessionManager,
      moduleLoader,
      resourceManager,
      debugMode
    });
    
    return {
      chatAgent,
      terminalAgent,
      artifactAgent,
      agentType: 'bt'
    };
  } else {
    // Import and create classic agents
    const { ChatAgent } = await import('../agents/ChatAgent.js');
    const { TerminalAgent } = await import('../agents/TerminalAgent.js');
    const { ArtifactAgent } = await import('../agents/ArtifactAgent.js');
    
    const chatAgent = new ChatAgent({
      sessionId,
      sessionManager,
      moduleLoader,
      resourceManager
    });
    
    const terminalAgent = new TerminalAgent({
      sessionId,
      sessionManager,
      moduleLoader
    });
    
    const artifactAgent = new ArtifactAgent({
      sessionId,
      artifactManager: chatAgent.artifactManager
    });
    
    return {
      chatAgent,
      terminalAgent,
      artifactAgent,
      agentType: 'classic'
    };
  }
}

/**
 * Agent management utilities
 */

/**
 * Get agent status information
 */
export function getAgentStatus(agent) {
  if (agent && typeof agent.getStatus === 'function') {
    return agent.getStatus();
  }
  return { error: 'Agent does not support status reporting' };
}

/**
 * Get agent metadata
 */
export function getAgentMetadata(agent) {
  if (agent && typeof agent.getMetadata === 'function') {
    return agent.getMetadata();
  }
  return { error: 'Agent does not support metadata reporting' };
}

/**
 * Reload agent configuration (BT agents only)
 */
export async function reloadAgentConfig(agent) {
  if (agent && typeof agent.reloadConfiguration === 'function') {
    await agent.reloadConfiguration();
    return { success: true };
  }
  return { error: 'Agent does not support configuration reloading' };
}

/**
 * Development utilities
 */

/**
 * Create development agent set with enhanced debugging
 */
export async function createDevAgentSet(config = {}) {
  return await createAgentSet({
    ...config,
    agentType: 'bt',
    debugMode: true
  });
}

/**
 * Test agent configuration without creating instances
 */
export async function testAgentConfig(agentType, configPath = null) {
  try {
    const config = await loadAgentConfig(agentType, configPath);
    const validation = await validateAgentConfig(config, agentType);
    
    return {
      valid: validation.valid,
      errors: validation.errors,
      warnings: validation.warnings,
      config: config
    };
  } catch (error) {
    return {
      valid: false,
      errors: [error.message],
      warnings: [],
      config: null
    };
  }
}

/**
 * Export constants and metadata
 */
export const BT_AGENT_VERSION = '1.0.0';
export const SUPPORTED_AGENT_TYPES = Object.keys(AGENT_TYPES);

export const BT_AGENT_CAPABILITIES = {
  'chat': [
    'conversation_management',
    'llm_interaction',
    'tool_execution', 
    'voice_processing',
    'complex_task_orchestration',
    'artifact_processing'
  ],
  'terminal': [
    'session_management',
    'tool_execution',
    'module_management',
    'tools_listing',
    'health_checking'
  ],
  'artifact': [
    'artifact_storage',
    'artifact_retrieval',
    'artifact_synchronization',
    'reactive_processing',
    'auto_detection',
    'label_management'
  ]
};

export const BT_AGENT_METADATA = {
  version: BT_AGENT_VERSION,
  framework: 'Legion Behavior Trees',
  author: 'Legion BT System',
  description: 'Next-generation configurable and composable agents for the Aiur server',
  capabilities: BT_AGENT_CAPABILITIES,
  supportedAgentTypes: SUPPORTED_AGENT_TYPES
};

/**
 * Default export: main factory function
 */
export default {
  // Agent creation
  createChatBTAgent,
  createTerminalBTAgent,
  createArtifactBTAgent,
  createAgentByType,
  createAgentSet,
  
  // Configuration
  loadAgentConfig,
  validateAgentConfig,
  
  // Utilities
  getAvailableAgentTypes,
  getAgentStatus,
  getAgentMetadata,
  reloadAgentConfig,
  
  // Development
  createDevAgentSet,
  testAgentConfig,
  
  // Metadata
  version: BT_AGENT_VERSION,
  capabilities: BT_AGENT_CAPABILITIES,
  metadata: BT_AGENT_METADATA
};