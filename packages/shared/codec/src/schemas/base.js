/**
 * Base message schemas for codec system
 */

/**
 * Schema definition message - sent by server to client with all schemas
 */
export const SCHEMA_DEFINITION_MESSAGE = {
  $id: 'schema_definition',
  type: 'object',
  properties: {
    type: { 
      type: 'string', 
      const: 'schema_definition' 
    },
    version: { 
      type: 'string',
      pattern: '^\\d+\\.\\d+\\.\\d+$'
    },
    schemas: {
      type: 'object',
      patternProperties: {
        '^[a-zA-Z_][a-zA-Z0-9_]*$': {
          type: 'object',
          properties: {
            $id: { type: 'string' },
            type: { type: 'string' }
          },
          required: ['$id', 'type']
        }
      }
    },
    messageId: {
      type: 'string'
    },
    timestamp: {
      type: 'string',
      format: 'date-time'
    }
  },
  required: ['type', 'version', 'schemas', 'messageId', 'timestamp'],
  additionalProperties: false
};

/**
 * Generic error message schema
 */
export const ERROR_MESSAGE = {
  $id: 'error_message',
  type: 'object',
  properties: {
    type: { 
      type: 'string', 
      const: 'error' 
    },
    code: {
      type: 'string',
      enum: ['VALIDATION_ERROR', 'UNKNOWN_MESSAGE_TYPE', 'ENCODING_ERROR', 'DECODING_ERROR', 'SCHEMA_ERROR']
    },
    message: {
      type: 'string'
    },
    details: {
      type: 'object'
    },
    messageId: {
      type: 'string'
    },
    timestamp: {
      type: 'string',
      format: 'date-time'
    }
  },
  required: ['type', 'code', 'message', 'messageId', 'timestamp'],
  additionalProperties: false
};

/**
 * Acknowledgment message schema  
 */
export const ACK_MESSAGE = {
  $id: 'ack_message',
  type: 'object',
  properties: {
    type: { 
      type: 'string', 
      const: 'ack' 
    },
    messageId: {
      type: 'string'
    },
    originalMessageId: {
      type: 'string'
    },
    status: {
      type: 'string',
      enum: ['success', 'error']
    },
    timestamp: {
      type: 'string',
      format: 'date-time'
    }
  },
  required: ['type', 'messageId', 'originalMessageId', 'status', 'timestamp'],
  additionalProperties: false
};

/**
 * Ping/Pong messages for connection health
 */
export const PING_MESSAGE = {
  $id: 'ping_message',
  type: 'object',
  properties: {
    type: { 
      type: 'string', 
      const: 'ping' 
    },
    messageId: {
      type: 'string'
    },
    timestamp: {
      type: 'string',
      format: 'date-time'
    }
  },
  required: ['type', 'messageId', 'timestamp'],
  additionalProperties: false
};

export const PONG_MESSAGE = {
  $id: 'pong_message',
  type: 'object',
  properties: {
    type: { 
      type: 'string', 
      const: 'pong' 
    },
    messageId: {
      type: 'string'
    },
    timestamp: {
      type: 'string',
      format: 'date-time'
    }
  },
  required: ['type', 'messageId', 'timestamp'],
  additionalProperties: false
};

/**
 * Session create request schema
 */
export const SESSION_CREATE_MESSAGE = {
  $id: 'session_create',
  type: 'object',
  properties: {
    type: { 
      type: 'string', 
      const: 'session_create' 
    },
    requestId: {
      type: 'string'
    }
  },
  required: ['type', 'requestId'],
  additionalProperties: false
};

/**
 * Session created response schema
 */
export const SESSION_CREATED_MESSAGE = {
  $id: 'session_created',
  type: 'object',
  properties: {
    type: { 
      type: 'string', 
      const: 'session_created' 
    },
    requestId: {
      type: 'string'
    },
    sessionId: {
      type: 'string'
    },
    success: {
      type: 'boolean'
    },
    codecEnabled: {
      type: 'boolean'
    }
  },
  required: ['type', 'requestId', 'sessionId', 'success'],
  additionalProperties: false
};

/**
 * Tool request schema
 */
export const TOOL_REQUEST_MESSAGE = {
  $id: 'tool_request',
  type: 'object',
  properties: {
    type: { 
      type: 'string', 
      const: 'tool_request' 
    },
    requestId: {
      type: 'string'
    },
    method: {
      type: 'string'
    },
    params: {
      type: 'object'
    }
  },
  required: ['type', 'requestId', 'method'],
  additionalProperties: false
};

/**
 * Tool response schema
 */
export const TOOL_RESPONSE_MESSAGE = {
  $id: 'tool_response',
  type: 'object',
  properties: {
    type: { 
      type: 'string', 
      const: 'tool_response' 
    },
    requestId: {
      type: 'string'
    },
    result: {
      type: 'object'
    },
    error: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        code: { type: 'string' }
      }
    }
  },
  required: ['type', 'requestId'],
  additionalProperties: false
};