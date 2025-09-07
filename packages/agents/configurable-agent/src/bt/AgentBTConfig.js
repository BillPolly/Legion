/**
 * AgentBTConfig - Configuration helpers for agent behavior trees
 * 
 * Provides utilities for creating, validating, and managing BT configurations
 * that integrate with ConfigurableAgent
 */

import { createValidator } from '@legion/schema';

/**
 * JSON Schema for agent behavior tree configuration
 */
export const AgentBTConfigSchema = {
  type: 'object',
  properties: {
    // Tree structure
    type: {
      type: 'string',
      enum: [
        'sequence', 'selector', 'parallel',
        'agent_chat', 'agent_tool', 'agent_query', 'agent_state',
        'condition', 'action', 'decorator'
      ]
    },
    id: {
      type: 'string',
      minLength: 1,
      description: 'Unique identifier for the node'
    },
    name: {
      type: 'string', 
      minLength: 1,
      description: 'Human-readable name for the node'
    },
    
    // Agent-specific configuration
    agent: {
      type: 'object',
      description: 'Reference to agent instance (set at runtime)'
    },
    sessionId: {
      type: 'string',
      minLength: 1,
      description: 'Session ID for agent interactions'
    },
    
    // Agent chat node configuration
    message: {
      type: 'string',
      description: 'Message content for agent_chat nodes'
    },
    from: {
      type: 'string',
      description: 'Message sender identifier'
    },
    
    // Agent tool node configuration  
    tool: {
      type: 'string',
      description: 'Tool name for agent_tool nodes'
    },
    operation: {
      type: 'string', 
      description: 'Operation to perform for agent_tool nodes'
    },
    params: {
      type: 'object',
      description: 'Parameters for tool execution'
    },
    
    // Agent query node configuration
    query: {
      type: 'string',
      description: 'Query content for agent_query nodes'
    },
    queryType: {
      type: 'string',
      enum: ['capabilities', 'status', 'history', 'knowledge', 'custom'],
      description: 'Type of query to perform'
    },
    
    // Agent state node configuration
    action: {
      type: 'string',
      enum: ['update', 'save', 'load', 'export'],
      description: 'State management action to perform'
    },
    updates: {
      type: 'object',
      description: 'State updates for update action'
    },
    stateId: {
      type: 'string',
      description: 'State ID for load action'
    },
    
    // Output configuration
    outputVariable: {
      type: 'string',
      description: 'Variable name to store result in artifacts'
    },
    
    // Tree structure
    children: {
      type: 'array',
      items: { type: 'object' },
      description: 'Child nodes for composite nodes'
    },
    
    // Execution configuration
    timeout: {
      type: 'number',
      minimum: 0,
      description: 'Execution timeout in milliseconds'
    },
    retryCount: {
      type: 'number',
      minimum: 0,
      maximum: 10,
      description: 'Number of retries on failure'
    },
    
    // Debug and monitoring
    debugMode: {
      type: 'boolean',
      description: 'Enable debug logging for this node'
    },
    tags: {
      type: 'array',
      items: { type: 'string' },
      description: 'Tags for categorization and filtering'
    }
  },
  required: ['type', 'id'],
  additionalProperties: false
};

// Create validator for agent BT configuration
const validateAgentBTConfig = createValidator(AgentBTConfigSchema);

/**
 * Validate agent behavior tree configuration
 * @param {Object} config - BT configuration to validate
 * @returns {Object} Validation result
 */
export function validateAgentBTConfiguration(config) {
  try {
    // Use simple validation to avoid circular reference issues
    return validateAgentBTConfigSimple(config);
  } catch (error) {
    return {
      valid: false,
      errors: [error.message],
      warnings: []
    };
  }
}

/**
 * Simple validation for agent BT configuration without complex schema
 * @param {Object} config - BT configuration to validate
 * @returns {Object} Validation result
 */
function validateAgentBTConfigSimple(config) {
  const errors = [];
  const warnings = [];

  if (!config || typeof config !== 'object') {
    return { valid: false, errors: ['Configuration must be an object'], warnings: [] };
  }

  // Required fields
  if (!config.type) {
    errors.push('Node type is required');
  } else {
    const validTypes = [
      'sequence', 'selector', 'parallel',
      'agent_chat', 'agent_tool', 'agent_query', 'agent_state',
      'condition', 'action', 'decorator'
    ];
    if (!validTypes.includes(config.type)) {
      errors.push(`Invalid node type: ${config.type}`);
    }
  }

  if (!config.id) {
    errors.push('Node id is required');
  }

  // Type-specific validation
  if (config.type === 'agent_chat') {
    if (!config.message) {
      errors.push('agent_chat nodes require a message');
    }
  } else if (config.type === 'agent_tool') {
    if (!config.tool) {
      errors.push('agent_tool nodes require a tool name');
    }
    if (!config.operation) {
      errors.push('agent_tool nodes require an operation');
    }
  } else if (config.type === 'agent_query') {
    if (!config.query) {
      errors.push('agent_query nodes require a query');
    }
  } else if (config.type === 'agent_state') {
    if (!config.action) {
      errors.push('agent_state nodes require an action');
    }
  }

  // Recursively validate children if present
  if (config.children) {
    if (!Array.isArray(config.children)) {
      errors.push('children must be an array');
    } else {
      config.children.forEach((child, index) => {
        const childValidation = validateAgentBTConfigSimple(child);
        if (!childValidation.valid) {
          childValidation.errors.forEach(error => {
            errors.push(`Child ${index}: ${error}`);
          });
        }
        warnings.push(...childValidation.warnings);
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Create agent behavior tree configuration with defaults
 * @param {Object} options - Configuration options
 * @returns {Object} BT configuration
 */
export function createAgentBTConfig(options = {}) {
  const {
    type = 'sequence',
    id = `node-${Date.now()}`,
    name = 'Agent BT Node',
    sessionId = `session-${Date.now()}`,
    children = [],
    ...otherOptions
  } = options;

  const baseConfig = {
    type,
    id, 
    name,
    sessionId,
    ...otherOptions
  };

  // Add children if provided
  if (children.length > 0) {
    baseConfig.children = children;
  }

  return baseConfig;
}

/**
 * Create agent chat node configuration
 * @param {Object} options - Chat node options
 * @returns {Object} Chat node configuration
 */
export function createAgentChatNodeConfig(options = {}) {
  const {
    id = `chat-${Date.now()}`,
    name = 'Agent Chat',
    message = '',
    sessionId = `session-${Date.now()}`,
    from = 'user',
    outputVariable = null,
    ...otherOptions
  } = options;

  const config = {
    type: 'agent_chat',
    id,
    name,
    message,
    sessionId,
    from,
    ...otherOptions
  };

  if (outputVariable) {
    config.outputVariable = outputVariable;
  }

  return config;
}

/**
 * Create agent tool node configuration
 * @param {Object} options - Tool node options
 * @returns {Object} Tool node configuration
 */
export function createAgentToolNodeConfig(options = {}) {
  const {
    id = `tool-${Date.now()}`,
    name = 'Agent Tool',
    tool = '',
    operation = '',
    params = {},
    sessionId = `session-${Date.now()}`,
    outputVariable = null,
    ...otherOptions
  } = options;

  const config = {
    type: 'agent_tool',
    id,
    name,
    tool,
    operation,
    params,
    sessionId,
    ...otherOptions
  };

  if (outputVariable) {
    config.outputVariable = outputVariable;
  }

  return config;
}

/**
 * Create agent query node configuration
 * @param {Object} options - Query node options
 * @returns {Object} Query node configuration
 */
export function createAgentQueryNodeConfig(options = {}) {
  const {
    id = `query-${Date.now()}`,
    name = 'Agent Query',
    query = '',
    queryType = 'capabilities',
    sessionId = `session-${Date.now()}`,
    outputVariable = null,
    ...otherOptions
  } = options;

  const config = {
    type: 'agent_query',
    id,
    name,
    query,
    queryType,
    sessionId,
    ...otherOptions
  };

  if (outputVariable) {
    config.outputVariable = outputVariable;
  }

  return config;
}

/**
 * Create agent state node configuration
 * @param {Object} options - State node options  
 * @returns {Object} State node configuration
 */
export function createAgentStateNodeConfig(options = {}) {
  const {
    id = `state-${Date.now()}`,
    name = 'Agent State',
    action = 'update',
    updates = {},
    stateId = null,
    outputVariable = null,
    ...otherOptions
  } = options;

  const config = {
    type: 'agent_state',
    id,
    name,
    action,
    ...otherOptions
  };

  if (action === 'update' && updates) {
    config.updates = updates;
  }

  if (action === 'load' && stateId) {
    config.stateId = stateId;
  }

  if (outputVariable) {
    config.outputVariable = outputVariable;
  }

  return config;
}

/**
 * Create conversation flow behavior tree
 * @param {Object} options - Flow options
 * @returns {Object} BT configuration for conversation flow
 */
export function createConversationFlowConfig(options = {}) {
  const {
    sessionId = `conversation-${Date.now()}`,
    userMessage = 'Hello',
    queryCapabilities = true,
    saveState = false,
    ...otherOptions
  } = options;

  const children = [];

  // Optional: Query capabilities first
  if (queryCapabilities) {
    children.push(createAgentQueryNodeConfig({
      id: 'query-capabilities',
      name: 'Query Agent Capabilities',
      query: 'What can you help with?',
      queryType: 'capabilities',
      sessionId,
      outputVariable: 'capabilities'
    }));
  }

  // Main chat interaction
  children.push(createAgentChatNodeConfig({
    id: 'main-chat',
    name: 'Main Chat Interaction',
    message: userMessage,
    sessionId,
    outputVariable: 'chatResponse'
  }));

  // Optional: Save state after interaction
  if (saveState) {
    children.push(createAgentStateNodeConfig({
      id: 'save-conversation',
      name: 'Save Conversation State',
      action: 'save',
      outputVariable: 'saveResult'
    }));
  }

  return createAgentBTConfig({
    type: 'sequence',
    id: `conversation-flow-${Date.now()}`,
    name: 'Agent Conversation Flow',
    sessionId,
    children,
    ...otherOptions
  });
}

/**
 * Create task execution behavior tree
 * @param {Object} options - Task options
 * @returns {Object} BT configuration for task execution
 */
export function createTaskExecutionConfig(options = {}) {
  const {
    sessionId = `task-${Date.now()}`,
    toolName = '',
    operation = '',
    params = {},
    chatAfterExecution = false,
    ...otherOptions
  } = options;

  const children = [];

  // Execute the tool
  children.push(createAgentToolNodeConfig({
    id: 'execute-tool',
    name: 'Execute Task Tool',
    tool: toolName,
    operation: operation,
    params: params,
    sessionId,
    outputVariable: 'toolResult'
  }));

  // Optional: Chat about the result
  if (chatAfterExecution) {
    children.push(createAgentChatNodeConfig({
      id: 'discuss-result',
      name: 'Discuss Tool Result',
      message: 'Task completed. Let me explain the result.',
      sessionId,
      outputVariable: 'discussionResponse'
    }));
  }

  // Update state with task completion
  children.push(createAgentStateNodeConfig({
    id: 'update-task-state',
    name: 'Update Task State',
    action: 'update',
    updates: {
      lastTask: toolName,
      lastOperation: operation,
      taskCompleted: true,
      timestamp: Date.now()
    },
    outputVariable: 'stateUpdate'
  }));

  return createAgentBTConfig({
    type: 'sequence',
    id: `task-execution-${Date.now()}`,
    name: 'Agent Task Execution',
    sessionId,
    children,
    ...otherOptions
  });
}

/**
 * Create multi-step workflow behavior tree
 * @param {Object} options - Workflow options
 * @returns {Object} BT configuration for multi-step workflow
 */
export function createWorkflowConfig(options = {}) {
  const {
    sessionId = `workflow-${Date.now()}`,
    steps = [],
    rollbackOnFailure = false,
    ...otherOptions
  } = options;

  const children = [];

  // Add initial state save for potential rollback
  if (rollbackOnFailure) {
    children.push(createAgentStateNodeConfig({
      id: 'save-initial-state',
      name: 'Save Initial State',
      action: 'save',
      outputVariable: 'initialState'
    }));
  }

  // Process each workflow step
  steps.forEach((step, index) => {
    const stepId = `step-${index + 1}`;
    
    if (step.type === 'chat') {
      children.push(createAgentChatNodeConfig({
        id: stepId,
        name: step.name || `Chat Step ${index + 1}`,
        message: step.message,
        sessionId,
        outputVariable: `step${index + 1}Result`,
        ...step.config
      }));
    } else if (step.type === 'tool') {
      children.push(createAgentToolNodeConfig({
        id: stepId,
        name: step.name || `Tool Step ${index + 1}`,
        tool: step.tool,
        operation: step.operation,
        params: step.params || {},
        sessionId,
        outputVariable: `step${index + 1}Result`,
        ...step.config
      }));
    } else if (step.type === 'query') {
      children.push(createAgentQueryNodeConfig({
        id: stepId,
        name: step.name || `Query Step ${index + 1}`,
        query: step.query,
        queryType: step.queryType || 'custom',
        sessionId,
        outputVariable: `step${index + 1}Result`,
        ...step.config
      }));
    } else if (step.type === 'state') {
      children.push(createAgentStateNodeConfig({
        id: stepId,
        name: step.name || `State Step ${index + 1}`,
        action: step.action,
        updates: step.updates,
        stateId: step.stateId,
        outputVariable: `step${index + 1}Result`,
        ...step.config
      }));
    }
  });

  // Final state update with workflow completion
  children.push(createAgentStateNodeConfig({
    id: 'complete-workflow',
    name: 'Complete Workflow',
    action: 'update',
    updates: {
      workflowCompleted: true,
      workflowSteps: steps.length,
      completionTime: Date.now()
    },
    outputVariable: 'workflowCompletion'
  }));

  return createAgentBTConfig({
    type: 'sequence',
    id: `workflow-${Date.now()}`,
    name: 'Agent Workflow',
    sessionId,
    children,
    ...otherOptions
  });
}

/**
 * Validate and normalize agent BT configuration
 * @param {Object} config - Raw configuration
 * @returns {Object} Normalized and validated configuration
 */
export function normalizeAgentBTConfig(config) {
  if (!config) {
    throw new Error('Configuration is required');
  }

  // Validate configuration
  const validation = validateAgentBTConfiguration(config);
  if (!validation.valid) {
    throw new Error(`Invalid agent BT configuration: ${validation.errors.join(', ')}`);
  }

  // Add default values where needed
  const normalized = {
    ...config,
    id: config.id || `node-${Date.now()}`,
    name: config.name || 'Unnamed Node'
  };

  // Recursively normalize children
  if (normalized.children) {
    normalized.children = normalized.children.map(child => normalizeAgentBTConfig(child));
  }

  return normalized;
}

/**
 * Get agent node type requirements
 * @param {string} nodeType - Agent node type
 * @returns {Object} Requirements for the node type
 */
export function getAgentNodeRequirements(nodeType) {
  const requirements = {
    'agent_chat': {
      required: ['agent', 'message'],
      optional: ['sessionId', 'from', 'outputVariable']
    },
    'agent_tool': {
      required: ['agent', 'tool', 'operation'],
      optional: ['params', 'sessionId', 'outputVariable']
    },
    'agent_query': {
      required: ['agent', 'query'],
      optional: ['queryType', 'sessionId', 'outputVariable']
    },
    'agent_state': {
      required: ['agent', 'action'],
      optional: ['updates', 'stateId', 'outputVariable']
    }
  };

  return requirements[nodeType] || { required: [], optional: [] };
}