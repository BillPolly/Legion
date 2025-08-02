/**
 * Message schemas for WebSocket communication with Aiur server
 * Defines the structure and validation for all message types
 */

// Client to Server message schemas
export const clientMessages = {
  // Create a new session
  session_create: {
    type: 'session_create',
    requestId: { type: 'string', required: true },
    metadata: { type: 'object', required: false }
  },
  
  // Attach to existing session
  session_attach: {
    type: 'session_attach',
    requestId: { type: 'string', required: true },
    sessionId: { type: 'string', required: true }
  },
  
  // Execute a tool
  tool_request: {
    type: 'tool_request',
    requestId: { type: 'string', required: true },
    method: { type: 'string', required: true },
    params: { type: 'object', required: false }
  },
  
  // Request schema definitions
  schema_request: {
    type: 'schema_request',
    requestId: { type: 'string', required: true }
  },
  
  // Heartbeat ping
  ping: {
    type: 'ping',
    timestamp: { type: 'number', required: false }
  }
};

// Server to Client message schemas
export const serverMessages = {
  // Welcome message on connection
  welcome: {
    type: 'welcome',
    clientId: { type: 'string', required: true },
    serverVersion: { type: 'string', required: true },
    capabilities: { type: 'array', required: true },
    schemas: { type: 'object', required: false },
    messageTypes: { type: 'array', required: false }
  },
  
  // Session created response
  session_created: {
    type: 'session_created',
    requestId: { type: 'string', required: true },
    sessionId: { type: 'string', required: true },
    success: { type: 'boolean', required: true },
    codecEnabled: { type: 'boolean', required: false },
    created: { type: 'string', required: false },
    capabilities: { type: 'object', required: false }  // Server sends object, not array
  },
  
  // Tool execution response
  tool_response: {
    type: 'tool_response',
    requestId: { type: 'string', required: true },
    result: { type: 'any', required: false },
    error: { type: 'object', required: false }
  },
  
  // Schema definition response
  schema_definition: {
    type: 'schema_definition',
    requestId: { type: 'string', required: true },
    schemas: { type: 'object', required: true },
    messageTypes: { type: 'array', required: true }
  },
  
  // Error response
  error: {
    type: 'error',
    requestId: { type: 'string', required: false },
    error: {
      type: 'object',
      required: true,
      properties: {
        code: { type: 'number', required: true },
        message: { type: 'string', required: true }
      }
    }
  },
  
  // Pong response to ping
  pong: {
    type: 'pong',
    timestamp: { type: 'number', required: true }
  }
};

// Tool method names used by the server
export const toolMethods = {
  // Session management
  LIST_SESSIONS: 'sessions/list',
  GET_SESSION: 'sessions/get',
  
  // Tool operations
  LIST_TOOLS: 'tools/list',
  CALL_TOOL: 'tools/call',
  
  // Context operations
  LIST_CONTEXT: 'context/list',
  GET_CONTEXT: 'context/get',
  ADD_CONTEXT: 'context/add',
  REMOVE_CONTEXT: 'context/remove',
  
  // Module operations
  LIST_MODULES: 'module_list',
  LOAD_MODULE: 'module_load',
  UNLOAD_MODULE: 'module_unload'
};

// Helper to create a properly formatted request message
export function createRequest(type, params = {}) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  switch (type) {
    case 'session_create':
      return {
        type: 'session_create',
        requestId,
        metadata: params.metadata || {}
      };
      
    case 'session_attach':
      if (!params.sessionId) {
        throw new Error('sessionId is required for session_attach');
      }
      return {
        type: 'session_attach',
        requestId,
        sessionId: params.sessionId
      };
      
    case 'tool_request':
      if (!params.method) {
        throw new Error('method is required for tool_request');
      }
      return {
        type: 'tool_request',
        requestId,
        method: params.method,
        params: params.params || {}
      };
      
    case 'schema_request':
      return {
        type: 'schema_request',
        requestId
      };
      
    case 'ping':
      return {
        type: 'ping',
        timestamp: Date.now()
      };
      
    default:
      throw new Error(`Unknown request type: ${type}`);
  }
}

// Validate a message against its schema
export function validateMessage(message, isServerMessage = false) {
  const schemas = isServerMessage ? serverMessages : clientMessages;
  
  if (!message || typeof message !== 'object') {
    return { valid: false, error: 'Message must be an object' };
  }
  
  if (!message.type) {
    return { valid: false, error: 'Message must have a type field' };
  }
  
  const schema = schemas[message.type];
  if (!schema) {
    return { valid: false, error: `Unknown message type: ${message.type}` };
  }
  
  // Check required fields
  for (const [field, config] of Object.entries(schema)) {
    if (field === 'type') continue;
    
    if (config.required && !(field in message)) {
      return { valid: false, error: `Missing required field: ${field}` };
    }
    
    // Basic type checking (could be expanded)
    if (field in message && config.type !== 'any') {
      const actualType = Array.isArray(message[field]) ? 'array' : typeof message[field];
      if (actualType !== config.type) {
        return { valid: false, error: `Field ${field} should be ${config.type}, got ${actualType}` };
      }
    }
  }
  
  return { valid: true };
}