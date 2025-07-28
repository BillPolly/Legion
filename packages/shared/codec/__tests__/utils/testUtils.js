/**
 * Test utilities for codec testing
 */

/**
 * Generate test schemas for various testing scenarios
 */
export const createTestSchemas = () => ({
  simpleMessage: {
    $id: 'simple_message',
    type: 'object',
    properties: {
      type: { type: 'string', const: 'simple_message' },
      content: { type: 'string' },
      messageId: { type: 'string' },
      timestamp: { type: 'string', format: 'date-time' }
    },
    required: ['type', 'content'],
    additionalProperties: false
  },

  complexMessage: {
    $id: 'complex_message',
    type: 'object',
    properties: {
      type: { type: 'string', const: 'complex_message' },
      user: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          username: { type: 'string', minLength: 1, maxLength: 50 },
          email: { type: 'string', format: 'email' }
        },
        required: ['id', 'username'],
        additionalProperties: false
      },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            value: { type: 'number' }
          },
          required: ['name', 'value']
        }
      },
      messageId: { type: 'string' },
      timestamp: { type: 'string', format: 'date-time' }
    },
    required: ['type', 'user', 'items'],
    additionalProperties: false
  },

  invalidSchema: {
    // Missing $id property
    type: 'object',
    properties: {
      type: { type: 'string', const: 'invalid' }
    }
  }
});

/**
 * Generate test data for various message types
 */
export const createTestData = () => ({
  simpleMessage: {
    content: 'Hello, world!'
  },

  complexMessage: {
    user: {
      id: 'user123',
      username: 'testuser',
      email: 'test@example.com'
    },
    items: [
      { name: 'item1', value: 42 },
      { name: 'item2', value: 84 }
    ]
  },

  invalidSimpleMessage: {
    // Missing required content field
  },

  invalidComplexMessage: {
    user: {
      id: 'user123',
      username: '', // Too short
      email: 'not-an-email' // Invalid email format
    },
    items: [
      { name: 'item1' } // Missing required value field
    ]
  }
});

/**
 * Generate mock JSON strings for decode testing
 */
export const createTestJsonStrings = () => ({
  validMessage: JSON.stringify({
    type: 'simple_message',
    content: 'Test message',
    messageId: 'msg_123',
    timestamp: '2025-07-28T16:30:00.000Z'
  }),

  invalidJson: '{ "type": "simple_message", invalid json }',

  messageWithoutType: JSON.stringify({
    content: 'Message without type field'
  }),

  unknownMessageType: JSON.stringify({
    type: 'unknown_message_type',
    content: 'Test content'
  })
});

/**
 * Create a mock schema definition message
 */
export const createMockSchemaDefinition = () => ({
  type: 'schema_definition',
  version: '1.0.0',
  schemas: createTestSchemas(),
  timestamp: new Date().toISOString()
});

/**
 * Validate message ID format
 */
export const isValidMessageId = (messageId) => {
  return typeof messageId === 'string' && 
         messageId.startsWith('msg_') && 
         messageId.length > 4;
};

/**
 * Validate ISO 8601 timestamp format
 */
export const isValidTimestamp = (timestamp) => {
  const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
  return isoRegex.test(timestamp) && !isNaN(Date.parse(timestamp));
};