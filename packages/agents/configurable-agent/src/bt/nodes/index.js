/**
 * Configurable Agent Behavior Tree Node Types
 * 
 * Custom BT nodes that integrate with ConfigurableAgent message handling system
 */

import { AgentChatNode } from './AgentChatNode.js';
import { AgentToolNode } from './AgentToolNode.js';
import { AgentQueryNode } from './AgentQueryNode.js';
import { AgentStateNode } from './AgentStateNode.js';

// Re-export for external use
export { AgentChatNode, AgentToolNode, AgentQueryNode, AgentStateNode };

/**
 * Registry of agent-specific node types
 */
export const AGENT_NODE_TYPES = {
  'agent_chat': 'AgentChatNode',
  'agent_tool': 'AgentToolNode', 
  'agent_query': 'AgentQueryNode',
  'agent_state': 'AgentStateNode'
};

/**
 * Get all agent node classes
 */
export function getAgentNodeClasses() {
  return {
    AgentChatNode,
    AgentToolNode,
    AgentQueryNode,
    AgentStateNode
  };
}

/**
 * Register agent node types with a BehaviorTreeExecutor
 * @param {BehaviorTreeExecutor} executor - The BT executor to register with
 * @param {ConfigurableAgent} agent - Agent instance to bind to nodes
 */
export function registerAgentNodeTypes(executor, agent = null) {
  const nodeClasses = getAgentNodeClasses();
  
  for (const [typeName, NodeClass] of Object.entries(AGENT_NODE_TYPES)) {
    // Create a bound version of the node class if agent is provided
    if (agent) {
      const BoundNodeClass = class extends nodeClasses[NodeClass] {
        constructor(config, toolRegistry, btExecutor) {
          // Ensure config exists and inject agent instance
          const configWithAgent = {
            ...(config || {}),
            agent: (config && config.agent) || agent
          };
          super(configWithAgent, toolRegistry, btExecutor);
        }
      };
      
      // Preserve static methods
      BoundNodeClass.getTypeName = nodeClasses[NodeClass].getTypeName;
      BoundNodeClass.validateConfiguration = nodeClasses[NodeClass].validateConfiguration;
      
      executor.registerNodeType(typeName, BoundNodeClass);
    } else {
      executor.registerNodeType(typeName, nodeClasses[NodeClass]);
    }
  }
}

/**
 * Create behavior tree configuration template for agent interactions
 * @param {string} sessionId - Session ID for the interaction
 * @param {Object} options - Configuration options
 */
export function createAgentBTTemplate(sessionId = 'bt-session', options = {}) {
  const {
    chatMessage = 'Hello, how can you help?',
    queryType = 'capabilities',
    toolName = 'add',
    toolOperation = 'add',
    toolParams = { a: 5, b: 3 },
    stateUpdates = { lastInteraction: 'bt-interaction' }
  } = options;

  return {
    type: 'sequence',
    id: 'agent-interaction-sequence',
    name: 'Agent Interaction Sequence',
    children: [
      {
        type: 'agent_query',
        id: 'query-capabilities',
        name: 'Query Agent Capabilities',
        queryType: queryType,
        sessionId: sessionId,
        outputVariable: 'capabilities'
      },
      {
        type: 'agent_chat',
        id: 'chat-interaction',
        name: 'Chat with Agent',
        message: chatMessage,
        sessionId: sessionId,
        outputVariable: 'chatResponse'
      },
      {
        type: 'agent_tool',
        id: 'tool-execution',
        name: 'Execute Tool through Agent',
        tool: toolName,
        operation: toolOperation,
        params: toolParams,
        sessionId: sessionId,
        outputVariable: 'toolResult'
      },
      {
        type: 'agent_state',
        id: 'update-state',
        name: 'Update Agent State',
        action: 'update',
        updates: stateUpdates,
        outputVariable: 'stateUpdate'
      }
    ]
  };
}

/**
 * Validate agent node configuration
 * @param {Object} nodeConfig - Node configuration to validate
 * @returns {Object} Validation result
 */
export function validateAgentNodeConfig(nodeConfig) {
  if (!nodeConfig.type || !AGENT_NODE_TYPES[nodeConfig.type]) {
    return {
      valid: false,
      errors: [`Unknown agent node type: ${nodeConfig.type}`],
      warnings: []
    };
  }

  const NodeClass = getAgentNodeClasses()[AGENT_NODE_TYPES[nodeConfig.type]];
  if (NodeClass.validateConfiguration) {
    return NodeClass.validateConfiguration(nodeConfig);
  }

  return {
    valid: true,
    errors: [],
    warnings: []
  };
}