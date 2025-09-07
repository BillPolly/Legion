/**
 * @legion/configurable-agent - JSON-configured agent runtime
 * 
 * Main exports for the configurable agent system
 */

// Core agent class
export { ConfigurableAgent } from './core/ConfigurableAgent.js';

// State management
export { AgentState } from './state/AgentState.js';
export { KGStatePersistence } from './state/KGStatePersistence.js';

// Capability management
export { CapabilityManager } from './capabilities/CapabilityManager.js';

// Prompt management
export { PromptManager } from './prompts/PromptManager.js';

// Knowledge graph interface
export { KnowledgeGraphInterface } from './knowledge/KnowledgeGraphInterface.js';

// Configuration schema and validation
export { 
  AgentConfigSchema, 
  validateAgentConfig,
  validateBehaviorTreeNode,
  getDefaultConfig
} from './ConfigurationSchema.js';

// Error handling utilities
export * from './utils/ErrorHandling.js';

// Resource access utilities
export * from './utils/ResourceAccess.js';

// Utility function to create agent from config
export async function createAgentFromConfig(config, resourceManager) {
  const { validateAgentConfig } = await import('./ConfigurationSchema.js');
  const { ConfigurationError } = await import('./utils/ErrorHandling.js');
  const { getResourceManager } = await import('./utils/ResourceAccess.js');
  const { ConfigurableAgent } = await import('./core/ConfigurableAgent.js');
  
  // Validate configuration
  const validation = validateAgentConfig(config);
  if (!validation.valid) {
    throw new ConfigurationError(
      'Invalid agent configuration',
      validation.errors
    );
  }
  
  // Get ResourceManager (use provided or get singleton)
  const rm = resourceManager || await getResourceManager();
  
  // Create and initialize agent
  const agent = new ConfigurableAgent(config, rm);
  await agent.initialize();
  
  return agent;
}

// Helper function for quick agent creation
export async function createAgent(config, resourceManager) {
  return createAgentFromConfig(config, resourceManager);
}