/**
 * Behavior Tree Integration for ConfigurableAgent
 * 
 * Main entry point for BT functionality
 */

// Export node types
export * from './nodes/index.js';

// Export BT executor integration
export { AgentBehaviorTreeExecutor } from './AgentBehaviorTreeExecutor.js';

// Export configuration helpers
export { createAgentBTConfig, validateAgentBTConfig } from './AgentBTConfig.js';