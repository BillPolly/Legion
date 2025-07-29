/**
 * Test Schema Definitions
 * 
 * Expected schema structures that should be provided by the server
 */

export const expectedSchemas = {
  // Welcome message schema
  welcome: {
    type: 'object',
    properties: {
      type: { const: 'welcome' },
      clientId: { type: 'string' },
      serverVersion: { type: 'string' },
      capabilities: { type: 'array', items: { type: 'string' } },
      schemas: { type: 'object' },
      messageTypes: { type: 'array', items: { type: 'string' } }
    },
    required: ['type', 'clientId', 'serverVersion', 'capabilities', 'schemas', 'messageTypes']
  },

  // Session creation request
  session_create: {
    type: 'object',
    properties: {
      type: { const: 'session_create' },
      requestId: { type: 'string' }
    },
    required: ['type', 'requestId']
  },

  // Session creation response
  session_created: {
    type: 'object',
    properties: {
      type: { const: 'session_created' },
      requestId: { type: 'string' },
      sessionId: { type: 'string' },
      success: { type: 'boolean' },
      codecEnabled: { type: 'boolean' }
    },
    required: ['type', 'requestId', 'sessionId', 'success']
  },

  // Tool request
  tool_request: {
    type: 'object',
    properties: {
      type: { const: 'tool_request' },
      requestId: { type: 'string' },
      method: { type: 'string' },
      params: { type: 'object' }
    },
    required: ['type', 'requestId', 'method', 'params']
  },

  // Tool response
  tool_response: {
    type: 'object',
    properties: {
      type: { const: 'tool_response' },
      requestId: { type: 'string' },
      result: { type: 'object' },
      error: { type: 'object' }
    },
    required: ['type', 'requestId']
  },

  // Error message
  error: {
    type: 'object',
    properties: {
      type: { const: 'error' },
      requestId: { type: 'string' },
      error: {
        type: 'object',
        properties: {
          code: { type: 'number' },
          message: { type: 'string' }
        },
        required: ['message']
      }
    },
    required: ['type', 'error']
  }
};

// Test data for tool execution
export const testData = {
  calculations: [
    { expression: '2 + 2', expected: 4 },
    { expression: '10 * 5', expected: 50 },
    { expression: 'Math.sqrt(16)', expected: 4 },
    { expression: 'Math.pow(2, 3)', expected: 8 }
  ],

  files: {
    testContent: 'Hello, World! This is test content.',
    testFilename: 'test-file.txt'
  },

  modules: [
    'calculator',
    'file',
    'json'
  ]
};

// Validation functions
export function validateSchema(data, schemaName) {
  const schema = expectedSchemas[schemaName];
  if (!schema) {
    throw new Error(`Unknown schema: ${schemaName}`);
  }

  // Simple validation - check required properties
  if (schema.required) {
    for (const prop of schema.required) {
      if (data[prop] === undefined) {
        throw new Error(`Missing required property: ${prop}`);
      }
    }
  }

  // Check property types
  if (schema.properties) {
    for (const [prop, propSchema] of Object.entries(schema.properties)) {
      if (data[prop] !== undefined) {
        if (propSchema.type && typeof data[prop] !== propSchema.type) {
          throw new Error(`Property ${prop} should be ${propSchema.type}, got ${typeof data[prop]}`);
        }
        if (propSchema.const && data[prop] !== propSchema.const) {
          throw new Error(`Property ${prop} should be ${propSchema.const}, got ${data[prop]}`);
        }
      }
    }
  }

  return true;
}