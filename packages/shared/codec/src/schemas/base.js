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
    timestamp: {
      type: 'string',
      format: 'date-time'
    }
  },
  required: ['type', 'version', 'schemas', 'timestamp'],
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
    timestamp: {
      type: 'string',
      format: 'date-time'
    }
  },
  required: ['type', 'code', 'message', 'timestamp'],
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
    status: {
      type: 'string',
      enum: ['success', 'error']
    },
    timestamp: {
      type: 'string',
      format: 'date-time'
    }
  },
  required: ['type', 'messageId', 'status', 'timestamp'],
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
    timestamp: {
      type: 'string',
      format: 'date-time'
    }
  },
  required: ['type', 'timestamp'],
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
    timestamp: {
      type: 'string',
      format: 'date-time'
    }
  },
  required: ['type', 'timestamp'],
  additionalProperties: false
};