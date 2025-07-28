/**
 * Integration tests for complete codec workflows
 */

import { Codec } from '../../src/Codec.js';
import { createTestSchemas } from '../utils/testUtils.js';

describe('Codec Integration Tests', () => {
  let serverCodec;
  let clientCodec;
  let testSchemas;

  beforeEach(() => {
    serverCodec = new Codec();
    clientCodec = new Codec();
    testSchemas = createTestSchemas();
  });

  describe('Client-Server Schema Negotiation Workflow', () => {
    test('complete schema negotiation flow', () => {
      // Step 1: Server registers custom schemas
      serverCodec.registerSchema(testSchemas.simpleMessage);
      serverCodec.registerSchema(testSchemas.complexMessage);

      // Step 2: Server creates schema definition message
      const schemaDefinition = serverCodec.createSchemaDefinitionMessage();
      
      expect(schemaDefinition.type).toBe('schema_definition');
      expect(schemaDefinition.schemas).toHaveProperty('simple_message');
      expect(schemaDefinition.schemas).toHaveProperty('complex_message');

      // Step 3: Server encodes schema definition for transmission
      const encodeResult = serverCodec.encode('schema_definition', schemaDefinition);
      expect(encodeResult.success).toBe(true);

      // Step 4: Client receives and decodes schema definition
      const decodeResult = clientCodec.decode(encodeResult.encoded);
      expect(decodeResult.success).toBe(true);
      expect(decodeResult.messageType).toBe('schema_definition');

      // Step 5: Client loads schemas from definition
      clientCodec.loadSchemaDefinition(decodeResult.decoded);
      
      // Step 6: Verify client now has server's schemas
      expect(clientCodec.hasMessageType('simple_message')).toBe(true);
      expect(clientCodec.hasMessageType('complex_message')).toBe(true);

      // Step 7: Client can now encode/decode messages using server schemas
      const testMessage = { content: 'Hello from client' };
      const clientEncode = clientCodec.encode('simple_message', testMessage);
      expect(clientEncode.success).toBe(true);

      const serverDecode = serverCodec.decode(clientEncode.encoded);
      expect(serverDecode.success).toBe(true);
      expect(serverDecode.decoded.content).toBe('Hello from client');
    });

    test('schema negotiation with version mismatch handling', () => {
      // Server with version 2.0.0
      serverCodec.registry.setVersion('2.0.0');
      serverCodec.registerSchema(testSchemas.simpleMessage);

      const schemaDefinition = serverCodec.createSchemaDefinitionMessage();
      expect(schemaDefinition.version).toBe('2.0.0');

      // Client receives and loads newer schema version
      const encoded = serverCodec.encode('schema_definition', schemaDefinition);
      const decoded = clientCodec.decode(encoded.encoded);
      
      clientCodec.loadSchemaDefinition(decoded.decoded);
      
      // Verify schemas are loaded despite version difference
      expect(clientCodec.hasMessageType('simple_message')).toBe(true);
    });

    test('error handling during schema negotiation', () => {
      // Create invalid schema definition
      const invalidSchemaDefinition = {
        type: 'schema_definition',
        version: 'invalid-version', // Invalid semver
        schemas: {},
        timestamp: '2025-07-28T16:30:00.000Z'
      };

      // Server cannot encode invalid schema definition
      const encodeResult = serverCodec.encode('schema_definition', invalidSchemaDefinition);
      expect(encodeResult.success).toBe(false);
      expect(encodeResult.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Custom Message Type Registration and Usage', () => {
    test('register and use custom message types', () => {
      const customSchema = {
        $id: 'custom_message',
        type: 'object',
        properties: {
          type: { type: 'string', const: 'custom_message' },
          customField: { type: 'string' },
          messageId: { type: 'string' },
          timestamp: { type: 'string', format: 'date-time' }
        },
        required: ['type', 'customField', 'messageId', 'timestamp'],
        additionalProperties: false
      };

      // Register on both codecs
      serverCodec.registerSchema(customSchema);
      clientCodec.registerSchema(customSchema);

      // Test encoding and decoding
      const customData = { customField: 'test value' };
      const encoded = serverCodec.encode('custom_message', customData);
      expect(encoded.success).toBe(true);

      const decoded = clientCodec.decode(encoded.encoded);
      expect(decoded.success).toBe(true);
      expect(decoded.decoded.customField).toBe('test value');
    });

    test('multiple codecs with shared custom schemas', () => {
      const codec1 = new Codec();
      const codec2 = new Codec();
      const codec3 = new Codec();

      // Register same schema on all codecs
      [codec1, codec2, codec3].forEach(codec => {
        codec.registerSchema(testSchemas.simpleMessage);
      });

      // Message created by codec1
      const message1 = codec1.encode('simple_message', { content: 'From codec1' });
      
      // Can be decoded by codec2 and codec3
      const decoded2 = codec2.decode(message1.encoded);
      const decoded3 = codec3.decode(message1.encoded);

      expect(decoded2.success).toBe(true);
      expect(decoded3.success).toBe(true);
      expect(decoded2.decoded.content).toBe('From codec1');
      expect(decoded3.decoded.content).toBe('From codec1');
    });
  });

  describe('Complex Nested Message Schemas', () => {
    test('deeply nested message structures', () => {
      const deeplyNestedSchema = {
        $id: 'deeply_nested',
        type: 'object',
        properties: {
          type: { type: 'string', const: 'deeply_nested' },
          level1: {
            type: 'object',
            properties: {
              level2: {
                type: 'object',
                properties: {
                  level3: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        data: {
                          type: 'object',
                          properties: {
                            values: { type: 'array', items: { type: 'number' } }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          messageId: { type: 'string' },
          timestamp: { type: 'string', format: 'date-time' }
        },
        required: ['type', 'level1', 'messageId', 'timestamp']
      };

      serverCodec.registerSchema(deeplyNestedSchema);
      clientCodec.registerSchema(deeplyNestedSchema);

      const complexData = {
        level1: {
          level2: {
            level3: [
              {
                id: 'item1',
                data: {
                  values: [1, 2, 3, 4, 5]
                }
              },
              {
                id: 'item2',
                data: {
                  values: [10, 20, 30]
                }
              }
            ]
          }
        }
      };

      const encoded = serverCodec.encode('deeply_nested', complexData);
      expect(encoded.success).toBe(true);

      const decoded = clientCodec.decode(encoded.encoded);
      expect(decoded.success).toBe(true);
      expect(decoded.decoded.level1.level2.level3).toHaveLength(2);
      expect(decoded.decoded.level1.level2.level3[0].data.values).toEqual([1, 2, 3, 4, 5]);
    });

    test('schema with complex validation rules', () => {
      const complexValidationSchema = {
        $id: 'complex_validation',
        type: 'object',
        properties: {
          type: { type: 'string', const: 'complex_validation' },
          email: { type: 'string', format: 'email' },
          age: { type: 'integer', minimum: 0, maximum: 150 },
          tags: {
            type: 'array',
            items: { type: 'string', minLength: 1 },
            minItems: 1,
            maxItems: 10
          },
          preferences: {
            type: 'object',
            properties: {
              theme: { type: 'string', enum: ['light', 'dark'] },
              notifications: { type: 'boolean' }
            },
            required: ['theme']
          },
          messageId: { type: 'string' },
          timestamp: { type: 'string', format: 'date-time' }
        },
        required: ['type', 'email', 'age', 'tags', 'preferences', 'messageId', 'timestamp']
      };

      serverCodec.registerSchema(complexValidationSchema);

      // Valid data
      const validData = {
        email: 'test@example.com',
        age: 25,
        tags: ['developer', 'javascript'],
        preferences: {
          theme: 'dark',
          notifications: true
        }
      };

      const validEncoded = serverCodec.encode('complex_validation', validData);
      expect(validEncoded.success).toBe(true);

      // Invalid data - bad email
      const invalidData = {
        email: 'not-an-email',
        age: 25,
        tags: ['developer'],
        preferences: {
          theme: 'dark'
        }
      };

      const invalidEncoded = serverCodec.encode('complex_validation', invalidData);
      expect(invalidEncoded.success).toBe(false);
      expect(invalidEncoded.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Protocol Error Handling and Recovery', () => {
    test('graceful handling of unknown message types', () => {
      // Server has schema that client doesn't
      serverCodec.registerSchema(testSchemas.simpleMessage);

      const message = serverCodec.encode('simple_message', { content: 'Hello' });
      expect(message.success).toBe(true);

      // Client doesn't know about this message type
      const decoded = clientCodec.decode(message.encoded);
      expect(decoded.success).toBe(false);
      expect(decoded.error.code).toBe('UNKNOWN_MESSAGE_TYPE');

      // Client can send error response
      const errorMessage = clientCodec.createErrorMessage(
        'UNKNOWN_MESSAGE_TYPE',
        'Unknown message type: simple_message',
        { messageType: 'simple_message' }
      );

      const errorEncoded = JSON.stringify(errorMessage);
      const errorDecoded = serverCodec.decode(errorEncoded);
      expect(errorDecoded.success).toBe(true);
      expect(errorDecoded.messageType).toBe('error');
    });

    test('validation error propagation', () => {
      serverCodec.registerSchema(testSchemas.simpleMessage);
      clientCodec.registerSchema(testSchemas.simpleMessage);

      // Server sends invalid message (bypasses validation)
      const invalidMessage = JSON.stringify({
        type: 'simple_message',
        // Missing required 'content' field
        messageId: 'msg_123',
        timestamp: '2025-07-28T16:30:00.000Z'
      });

      // Client detects validation error
      const decoded = clientCodec.decode(invalidMessage);
      expect(decoded.success).toBe(false);
      expect(decoded.error.code).toBe('VALIDATION_ERROR');

      // Client can respond with error message
      const errorResponse = clientCodec.createErrorMessage(
        'VALIDATION_ERROR',
        'Message validation failed',
        { errors: decoded.error.details.errors }
      );

      expect(errorResponse.type).toBe('error');
      expect(errorResponse.code).toBe('VALIDATION_ERROR');
    });

    test('JSON parsing error handling', () => {
      const invalidJson = '{ invalid json structure }';
      
      const result = serverCodec.decode(invalidJson);
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('DECODING_ERROR');
      expect(result.error.message).toBe('Invalid JSON format');
    });
  });

  describe('Message Metadata and Tracing', () => {
    test('message ID generation and preservation', () => {
      serverCodec.registerSchema(testSchemas.simpleMessage);

      const message1 = serverCodec.encode('simple_message', { content: 'Message 1' });
      const message2 = serverCodec.encode('simple_message', { content: 'Message 2' });

      expect(message1.success).toBe(true);
      expect(message2.success).toBe(true);

      const parsed1 = JSON.parse(message1.encoded);
      const parsed2 = JSON.parse(message2.encoded);

      // Messages should have different IDs
      expect(parsed1.messageId).not.toBe(parsed2.messageId);
      expect(parsed1.messageId).toMatch(/^msg_/);
      expect(parsed2.messageId).toMatch(/^msg_/);
    });

    test('timestamp injection and validation', () => {
      serverCodec.registerSchema(testSchemas.simpleMessage);

      const beforeTime = new Date().toISOString();
      const message = serverCodec.encode('simple_message', { content: 'Test' });
      const afterTime = new Date().toISOString();

      expect(message.success).toBe(true);
      const parsed = JSON.parse(message.encoded);
      
      expect(parsed.timestamp).toBeDefined();
      expect(parsed.timestamp >= beforeTime).toBe(true);
      expect(parsed.timestamp <= afterTime).toBe(true);
    });

    test('acknowledgment message workflow', () => {
      const originalMessageId = 'msg_original_123';
      
      // Create acknowledgment
      const ack = serverCodec.createAckMessage(originalMessageId, 'success');
      expect(ack.type).toBe('ack');
      expect(ack.originalMessageId).toBe(originalMessageId);
      expect(ack.status).toBe('success');
      expect(ack.messageId).toBeDefined(); // Ack has its own message ID

      // Encode and decode ack
      const encoded = JSON.stringify(ack);
      const decoded = clientCodec.decode(encoded);
      
      expect(decoded.success).toBe(true);
      expect(decoded.messageType).toBe('ack');
      expect(decoded.decoded.originalMessageId).toBe(originalMessageId);
    });
  });

  describe('End-to-End WebSocket Communication Simulation', () => {
    test('simulates complete WebSocket message exchange', () => {
      // Setup: Both sides have custom schema
      const chatSchema = {
        $id: 'chat_message',
        type: 'object',
        properties: {
          type: { type: 'string', const: 'chat_message' },
          username: { type: 'string', minLength: 1 },
          message: { type: 'string', minLength: 1 },
          channel: { type: 'string' },
          messageId: { type: 'string' },
          timestamp: { type: 'string', format: 'date-time' }
        },
        required: ['type', 'username', 'message', 'messageId', 'timestamp']
      };

      serverCodec.registerSchema(chatSchema);
      clientCodec.registerSchema(chatSchema);

      // Simulation: Client sends chat message
      const chatData = {
        username: 'alice',
        message: 'Hello everyone!',
        channel: 'general'
      };

      const clientMessage = clientCodec.encode('chat_message', chatData);
      expect(clientMessage.success).toBe(true);

      // Simulation: Server receives and processes message
      const serverReceived = serverCodec.decode(clientMessage.encoded);
      expect(serverReceived.success).toBe(true);
      expect(serverReceived.decoded.username).toBe('alice');

      // Simulation: Server acknowledges receipt
      const ackMessage = serverCodec.createAckMessage(
        serverReceived.decoded.messageId, 
        'success'
      );
      const ackEncoded = JSON.stringify(ackMessage);

      // Simulation: Client receives acknowledgment
      const clientAck = clientCodec.decode(ackEncoded);
      expect(clientAck.success).toBe(true);
      expect(clientAck.decoded.status).toBe('success');
      expect(clientAck.decoded.originalMessageId).toBe(serverReceived.decoded.messageId);

      // Simulation: Server broadcasts to other clients
      const broadcastData = {
        username: 'system',
        message: `${chatData.username} joined the channel`,
        channel: chatData.channel
      };

      const broadcast = serverCodec.encode('chat_message', broadcastData);
      expect(broadcast.success).toBe(true);

      const clientBroadcast = clientCodec.decode(broadcast.encoded);
      expect(clientBroadcast.success).toBe(true);
      expect(clientBroadcast.decoded.username).toBe('system');
    });

    test('handles connection health checks with ping/pong', () => {
      // Server sends ping
      const pingMessage = {
        type: 'ping',
        messageId: 'msg_ping_123',
        timestamp: new Date().toISOString()
      };
      const pingEncoded = JSON.stringify(pingMessage);

      // Client receives ping
      const clientPing = clientCodec.decode(pingEncoded);
      expect(clientPing.success).toBe(true);
      expect(clientPing.messageType).toBe('ping');

      // Client responds with pong
      const pongMessage = {
        type: 'pong',
        messageId: 'msg_pong_456',
        timestamp: new Date().toISOString()
      };
      const pongEncoded = JSON.stringify(pongMessage);

      // Server receives pong
      const serverPong = serverCodec.decode(pongEncoded);
      expect(serverPong.success).toBe(true);
      expect(serverPong.messageType).toBe('pong');
    });
  });
});