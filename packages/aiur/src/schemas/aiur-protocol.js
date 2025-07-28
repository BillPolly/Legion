/**
 * Aiur Protocol Schema Definitions
 * Defines message schemas for Aiur's custom WebSocket protocol
 */

/**
 * Welcome message sent by server when client connects
 */
export const WELCOME_MESSAGE = {
  $id: 'aiur_welcome',
  type: 'object',
  properties: {
    type: { type: 'string', const: 'welcome' },
    clientId: { type: 'string', pattern: '^client_\\d+_[a-zA-Z0-9]+$' },
    serverVersion: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+$' },
    capabilities: {
      type: 'array',
      items: { type: 'string' },
      contains: { const: 'sessions' }
    },
    // New codec-related fields
    codecSupported: { type: 'boolean', default: true },
    schemaVersion: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+$' },
    supportedSchemas: {
      type: 'array',
      items: { type: 'string' }
    },
    messageId: { type: 'string' },
    timestamp: { type: 'string', format: 'date-time' }
  },
  required: ['type', 'clientId', 'serverVersion', 'capabilities', 'messageId', 'timestamp'],
  additionalProperties: false
};

/**
 * Session creation request from client
 */
export const SESSION_CREATE_REQUEST = {
  $id: 'session_create_request',
  type: 'object',
  properties: {
    type: { type: 'string', const: 'session_create' },
    requestId: { type: 'string', pattern: '^req_\\d+$' },
    codecNegotiation: {
      type: 'object',
      properties: {
        supported: { type: 'boolean' },
        requestedSchemas: {
          type: 'array',
          items: { type: 'string' }
        }
      }
    },
    messageId: { type: 'string' },
    timestamp: { type: 'string', format: 'date-time' }
  },
  required: ['type', 'requestId', 'messageId', 'timestamp'],
  additionalProperties: false
};

/**
 * Session created response from server
 */
export const SESSION_CREATE_RESPONSE = {
  $id: 'session_create_response',
  type: 'object',
  properties: {
    type: { type: 'string', const: 'session_created' },
    requestId: { type: 'string', pattern: '^req_\\d+$' },
    sessionId: { type: 'string', pattern: '^session_\\d+_[a-zA-Z0-9]+$' },
    success: { type: 'boolean' },
    codecEnabled: { type: 'boolean', default: false },
    messageId: { type: 'string' },
    timestamp: { type: 'string', format: 'date-time' }
  },
  required: ['type', 'requestId', 'sessionId', 'success', 'messageId', 'timestamp'],
  additionalProperties: false
};

/**
 * Schema request from client (new message type)
 */
export const SCHEMA_REQUEST = {
  $id: 'schema_request',
  type: 'object',
  properties: {
    type: { type: 'string', const: 'schema_request' },
    requestId: { type: 'string', pattern: '^req_\\d+$' },
    requestedSchemas: {
      type: 'array',
      items: { type: 'string' },
      minItems: 1
    },
    messageId: { type: 'string' },
    timestamp: { type: 'string', format: 'date-time' }
  },
  required: ['type', 'requestId', 'messageId', 'timestamp'],
  additionalProperties: false
};

/**
 * MCP-style request (tool execution)
 */
export const MCP_REQUEST = {
  $id: 'mcp_request',
  type: 'object',
  properties: {
    type: { type: 'string', const: 'mcp_request' },
    requestId: { type: 'string', pattern: '^req_\\d+$' },
    method: { type: 'string' },
    params: { type: 'object' },
    messageId: { type: 'string' },
    timestamp: { type: 'string', format: 'date-time' }
  },
  required: ['type', 'requestId', 'method', 'messageId', 'timestamp'],
  additionalProperties: false
};

/**
 * MCP-style response (tool execution result)
 */
export const MCP_RESPONSE = {
  $id: 'mcp_response',
  type: 'object',
  properties: {
    type: { type: 'string', const: 'mcp_response' },
    requestId: { type: 'string', pattern: '^req_\\d+$' },
    result: { type: 'object' },
    error: {
      type: 'object',
      properties: {
        code: { type: 'integer' },
        message: { type: 'string' },
        data: { type: 'object' }
      }
    },
    messageId: { type: 'string' },
    timestamp: { type: 'string', format: 'date-time' }
  },
  required: ['type', 'requestId', 'messageId', 'timestamp'],
  additionalProperties: false
};

/**
 * Tool list request
 */
export const TOOLS_LIST_REQUEST = {
  $id: 'tools_list_request',
  type: 'object',
  properties: {
    type: { type: 'string', const: 'tools_list' },
    requestId: { type: 'string', pattern: '^req_\\d+$' },
    messageId: { type: 'string' },
    timestamp: { type: 'string', format: 'date-time' }
  },
  required: ['type', 'requestId', 'messageId', 'timestamp'],
  additionalProperties: false
};

/**
 * Tool list response
 */
export const TOOLS_LIST_RESPONSE = {
  $id: 'tools_list_response',
  type: 'object',
  properties: {
    type: { type: 'string', const: 'tools_list_response' },
    requestId: { type: 'string', pattern: '^req_\\d+$' },
    tools: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          inputSchema: { type: 'object' }
        },
        required: ['name', 'description', 'inputSchema']
      }
    },
    messageId: { type: 'string' },
    timestamp: { type: 'string', format: 'date-time' }
  },
  required: ['type', 'requestId', 'tools', 'messageId', 'timestamp'],
  additionalProperties: false
};

/**
 * Context operation request
 */
export const CONTEXT_REQUEST = {
  $id: 'context_request',
  type: 'object',
  properties: {
    type: { type: 'string', const: 'context_request' },
    requestId: { type: 'string', pattern: '^req_\\d+$' },
    operation: { 
      type: 'string', 
      enum: ['add', 'get', 'list', 'remove'] 
    },
    contextName: { type: 'string' },
    data: { type: 'object' },
    description: { type: 'string' },
    filter: { type: 'string' },
    messageId: { type: 'string' },
    timestamp: { type: 'string', format: 'date-time' }
  },
  required: ['type', 'requestId', 'operation', 'messageId', 'timestamp'],
  additionalProperties: false
};

/**
 * Context operation response
 */
export const CONTEXT_RESPONSE = {
  $id: 'context_response',
  type: 'object',
  properties: {
    type: { type: 'string', const: 'context_response' },
    requestId: { type: 'string', pattern: '^req_\\d+$' },
    success: { type: 'boolean' },
    operation: { 
      type: 'string', 
      enum: ['add', 'get', 'list', 'remove'] 
    },
    contextName: { type: 'string' },
    data: { type: ['object', 'array'] },
    contextList: { 
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          created: { type: 'string', format: 'date-time' },
          description: { type: 'string' }
        }
      }
    },
    error: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        message: { type: 'string' }
      }
    },
    messageId: { type: 'string' },
    timestamp: { type: 'string', format: 'date-time' }
  },
  required: ['type', 'requestId', 'success', 'messageId', 'timestamp'],
  additionalProperties: false
};

/**
 * Module operation request  
 */
export const MODULE_REQUEST = {
  $id: 'module_request',
  type: 'object',
  properties: {
    type: { type: 'string', const: 'module_request' },
    requestId: { type: 'string', pattern: '^req_\\d+$' },
    operation: { 
      type: 'string', 
      enum: ['load', 'unload', 'list', 'info', 'tools', 'discover'] 
    },
    moduleName: { type: 'string' },
    moduleConfig: { type: 'object' },
    messageId: { type: 'string' },
    timestamp: { type: 'string', format: 'date-time' }
  },
  required: ['type', 'requestId', 'operation', 'messageId', 'timestamp'],
  additionalProperties: false
};

/**
 * Module operation response
 */
export const MODULE_RESPONSE = {
  $id: 'module_response',
  type: 'object',
  properties: {
    type: { type: 'string', const: 'module_response' },
    requestId: { type: 'string', pattern: '^req_\\d+$' },
    success: { type: 'boolean' },
    operation: { 
      type: 'string', 
      enum: ['load', 'unload', 'list', 'info', 'tools', 'discover'] 
    },
    moduleName: { type: 'string' },
    modules: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          version: { type: 'string' },
          description: { type: 'string' },
          loaded: { type: 'boolean' },
          toolCount: { type: 'integer' }
        }
      }
    },
    moduleInfo: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        version: { type: 'string' },
        description: { type: 'string' },
        tools: { type: 'array' },
        dependencies: { type: 'array' }
      }
    },
    tools: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          module: { type: 'string' },
          description: { type: 'string' }
        }
      }
    },
    error: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        message: { type: 'string' }
      }
    },
    messageId: { type: 'string' },
    timestamp: { type: 'string', format: 'date-time' }  
  },
  required: ['type', 'requestId', 'success', 'messageId', 'timestamp'],
  additionalProperties: false
};

/**
 * Plan operation request
 */
export const PLAN_REQUEST = {
  $id: 'plan_request',
  type: 'object',
  properties: {
    type: { type: 'string', const: 'plan_request' },
    requestId: { type: 'string', pattern: '^req_\\d+$' },
    operation: { 
      type: 'string', 
      enum: ['create', 'execute', 'status', 'validate', 'cancel'] 
    },
    planHandle: { type: 'string' },
    planDefinition: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        steps: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              action: { type: 'string' },
              parameters: { type: 'object' },
              dependsOn: { 
                type: 'array',
                items: { type: 'string' }
              }
            }
          }
        }
      }
    },
    saveAs: { type: 'string' },
    options: {
      type: 'object',
      properties: {
        parallel: { type: 'boolean' },
        stopOnError: { type: 'boolean' },
        timeout: { type: 'integer' }
      }
    },
    messageId: { type: 'string' },
    timestamp: { type: 'string', format: 'date-time' }
  },
  required: ['type', 'requestId', 'operation', 'messageId', 'timestamp'],
  additionalProperties: false
};

/**
 * Plan operation response
 */
export const PLAN_RESPONSE = {
  $id: 'plan_response',
  type: 'object',
  properties: {
    type: { type: 'string', const: 'plan_response' },
    requestId: { type: 'string', pattern: '^req_\\d+$' },
    success: { type: 'boolean' },
    operation: { 
      type: 'string', 
      enum: ['create', 'execute', 'status', 'validate', 'cancel'] 
    },
    planHandle: { type: 'string' },
    planStatus: {
      type: 'object',
      properties: {
        status: { 
          type: 'string',
          enum: ['pending', 'running', 'completed', 'failed', 'cancelled']
        },
        progress: { type: 'number', minimum: 0, maximum: 1 },
        currentStep: { type: 'string' },
        completedSteps: { type: 'array' },
        failedSteps: { type: 'array' }
      }
    },
    executionResult: { type: 'object' },
    validationResult: {
      type: 'object',
      properties: {
        valid: { type: 'boolean' },
        errors: { type: 'array' }
      }
    },
    savedToContext: {
      type: 'object',
      properties: {
        contextName: { type: 'string' },
        handleId: { type: 'string' }
      }
    },
    error: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        message: { type: 'string' }
      }
    },
    messageId: { type: 'string' },
    timestamp: { type: 'string', format: 'date-time' }
  },
  required: ['type', 'requestId', 'success', 'messageId', 'timestamp'],
  additionalProperties: false
};

/**
 * All Aiur protocol schemas
 */
export const AIUR_SCHEMAS = [
  WELCOME_MESSAGE,
  SESSION_CREATE_REQUEST,
  SESSION_CREATE_RESPONSE,
  SCHEMA_REQUEST,
  MCP_REQUEST,
  MCP_RESPONSE,
  TOOLS_LIST_REQUEST,
  TOOLS_LIST_RESPONSE,
  CONTEXT_REQUEST,
  CONTEXT_RESPONSE,
  MODULE_REQUEST,
  MODULE_RESPONSE,
  PLAN_REQUEST,
  PLAN_RESPONSE
];

/**
 * Schema registry for Aiur protocol
 */
export async function createAiurSchemaRegistry() {
  const { SchemaRegistry } = await import('../../../shared/codec/src/index.js');
  const registry = new SchemaRegistry();
  
  // Register all Aiur schemas
  for (const schema of AIUR_SCHEMAS) {
    registry.register(schema);
  }
  
  return registry;
}