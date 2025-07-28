/**
 * Tests for Codec class
 */

import { Codec } from '../src/Codec.js';
import { createTestSchemas } from './utils/testUtils.js';

describe('Codec', () => {
  let codec;
  let testSchemas;

  beforeEach(() => {
    codec = new Codec();
    testSchemas = createTestSchemas();
  });

  describe('Constructor and Configuration', () => {
    test('creates codec with default options', () => {
      const codec = new Codec();
      expect(codec).toBeInstanceOf(Codec);
      expect(codec.getMessageTypes()).toContain('schema_definition');
      expect(codec.getMessageTypes()).toContain('error_message');
    });

    test('creates codec with custom options', () => {
      const customOptions = {
        strictValidation: false,
        injectMetadata: false
      };
      const codec = new Codec(customOptions);
      expect(codec).toBeInstanceOf(Codec);
    });

    test('loads base schemas automatically', () => {
      const messageTypes = codec.getMessageTypes();
      expect(messageTypes).toContain('schema_definition');
      expect(messageTypes).toContain('error_message');
      expect(messageTypes).toContain('ack_message');
      expect(messageTypes).toContain('ping_message');
      expect(messageTypes).toContain('pong_message');
    });
  });

  describe('registerSchema method', () => {
    test('successfully registers custom schema', () => {
      codec.registerSchema(testSchemas.simpleMessage);
      expect(codec.hasMessageType('simple_message')).toBe(true);
      expect(codec.getSchema('simple_message')).toEqual(testSchemas.simpleMessage);
    });

    test('throws error for schema without $id', () => {
      const schemaWithoutId = {
        type: 'object',
        properties: { name: { type: 'string' } }
      };
      
      expect(() => {
        codec.registerSchema(schemaWithoutId);
      }).toThrow('Schema must have an $id property');
    });

    test('allows overwriting existing schema', () => {
      codec.registerSchema(testSchemas.simpleMessage);
      expect(codec.getSchema('simple_message')).toEqual(testSchemas.simpleMessage);
      
      const modifiedSchema = {
        ...testSchemas.simpleMessage,
        description: 'Modified schema'
      };
      
      codec.registerSchema(modifiedSchema);
      expect(codec.getSchema('simple_message')).toEqual(modifiedSchema);
    });
  });

  describe('encode method', () => {
    beforeEach(() => {
      codec.registerSchema(testSchemas.simpleMessage);
      codec.registerSchema(testSchemas.complexMessage);
    });

    test('successfully encodes valid message', () => {
      const messageData = {
        content: 'Hello world'
      };

      const result = codec.encode('simple_message', messageData);
      expect(result.success).toBe(true);
      expect(result.encoded).toBeDefined();
      expect(typeof result.encoded).toBe('string');
      
      const parsed = JSON.parse(result.encoded);
      expect(parsed.type).toBe('simple_message');
      expect(parsed.content).toBe('Hello world');
      expect(parsed.messageId).toBeDefined();
      expect(parsed.timestamp).toBeDefined();
    });

    test('returns error for unknown message type', () => {
      const result = codec.encode('unknown_type', {});
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error.code).toBe('UNKNOWN_MESSAGE_TYPE');
    });

    test('returns validation error for invalid data', () => {
      const invalidData = {
        // Missing required 'content' field
      };

      const result = codec.encode('simple_message', invalidData);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error.code).toBe('VALIDATION_ERROR');
    });

    test('preserves existing messageId and timestamp', () => {
      const messageData = {
        content: 'Hello',
        messageId: 'custom_id',
        timestamp: '2025-01-01T00:00:00.000Z'
      };

      const result = codec.encode('simple_message', messageData);
      expect(result.success).toBe(true);
      
      const parsed = JSON.parse(result.encoded);
      expect(parsed.messageId).toBe('custom_id');
      expect(parsed.timestamp).toBe('2025-01-01T00:00:00.000Z');
    });

    test('handles complex nested messages', () => {
      const complexData = {
        user: {
          id: 'user123',
          username: 'testuser',
          email: 'test@example.com'
        },
        items: [
          { name: 'item1', value: 42 }
        ]
      };

      const result = codec.encode('complex_message', complexData);
      expect(result.success).toBe(true);
      
      const parsed = JSON.parse(result.encoded);
      expect(parsed.user).toEqual(complexData.user);
      expect(parsed.items).toEqual(complexData.items);
    });

    test('works with disabled metadata injection', () => {
      const codec = new Codec({ injectMetadata: false });
      codec.registerSchema(testSchemas.simpleMessage);
      
      const messageData = {
        type: 'simple_message',
        content: 'Hello',
        messageId: 'msg_123',
        timestamp: '2025-01-01T00:00:00.000Z'
      };

      const result = codec.encode('simple_message', messageData);
      expect(result.success).toBe(true);
      
      const parsed = JSON.parse(result.encoded);
      expect(parsed).toEqual(messageData);
    });

    test('works with disabled strict validation', () => {
      const codec = new Codec({ strictValidation: false });
      codec.registerSchema(testSchemas.simpleMessage);
      
      const invalidData = {
        // Missing required fields, but validation is disabled
      };

      const result = codec.encode('simple_message', invalidData);
      expect(result.success).toBe(true);
    });
  });

  describe('decode method', () => {
    beforeEach(() => {
      codec.registerSchema(testSchemas.simpleMessage);
      codec.registerSchema(testSchemas.complexMessage);
    });

    test('successfully decodes valid message', () => {
      const messageData = {
        type: 'simple_message',
        content: 'Hello world',
        messageId: 'msg_123',
        timestamp: '2025-01-28T16:30:00.000Z'
      };
      
      const encodedMessage = JSON.stringify(messageData);
      const result = codec.decode(encodedMessage);
      
      expect(result.success).toBe(true);
      expect(result.decoded).toEqual(messageData);
      expect(result.messageType).toBe('simple_message');
    });

    test('returns error for invalid JSON', () => {
      const invalidJson = '{ invalid json }';
      const result = codec.decode(invalidJson);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error.code).toBe('DECODING_ERROR');
    });

    test('returns error for message without type', () => {
      const messageWithoutType = JSON.stringify({
        content: 'Hello'
      });
      
      const result = codec.decode(messageWithoutType);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error.code).toBe('DECODING_ERROR');
    });

    test('returns error for unknown message type', () => {
      const messageWithUnknownType = JSON.stringify({
        type: 'unknown_type',
        content: 'Hello'
      });
      
      const result = codec.decode(messageWithUnknownType);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error.code).toBe('UNKNOWN_MESSAGE_TYPE');
    });

    test('returns validation error for invalid message data', () => {
      const invalidMessage = JSON.stringify({
        type: 'simple_message',
        // Missing required 'content' field
        messageId: 'msg_123',
        timestamp: '2025-01-28T16:30:00.000Z'
      });
      
      const result = codec.decode(invalidMessage);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error.code).toBe('VALIDATION_ERROR');
    });

    test('handles complex nested messages', () => {
      const complexMessage = {
        type: 'complex_message',
        user: {
          id: 'user123',
          username: 'testuser',
          email: 'test@example.com'
        },
        items: [
          { name: 'item1', value: 42 }
        ],
        messageId: 'msg_456',
        timestamp: '2025-01-28T16:30:00.000Z'
      };
      
      const encoded = JSON.stringify(complexMessage);
      const result = codec.decode(encoded);
      
      expect(result.success).toBe(true);
      expect(result.decoded).toEqual(complexMessage);
      expect(result.messageType).toBe('complex_message');
    });

    test('works with disabled strict validation', () => {
      const codec = new Codec({ strictValidation: false });
      codec.registerSchema(testSchemas.simpleMessage);
      
      const invalidMessage = JSON.stringify({
        type: 'simple_message',
        // Missing required fields, but validation is disabled
      });
      
      const result = codec.decode(invalidMessage);
      expect(result.success).toBe(true);
    });
  });

  describe('Utility methods', () => {
    beforeEach(() => {
      codec.registerSchema(testSchemas.simpleMessage);
      codec.registerSchema(testSchemas.complexMessage);
    });

    test('getMessageTypes returns all registered types', () => {
      const types = codec.getMessageTypes();
      expect(types).toContain('simple_message');
      expect(types).toContain('complex_message');
      expect(types).toContain('schema_definition'); // Base schema
    });

    test('hasMessageType returns correct boolean', () => {
      expect(codec.hasMessageType('simple_message')).toBe(true);
      expect(codec.hasMessageType('unknown_type')).toBe(false);
    });

    test('getSchema returns correct schema', () => {
      const schema = codec.getSchema('simple_message');
      expect(schema).toEqual(testSchemas.simpleMessage);
    });

    test('getSchema returns null for unknown type', () => {
      const schema = codec.getSchema('unknown_type');
      expect(schema).toBe(null);
    });

    test('generateMessageId creates unique IDs', () => {
      const id1 = codec.generateMessageId();
      const id2 = codec.generateMessageId();
      
      expect(typeof id1).toBe('string');
      expect(typeof id2).toBe('string');
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^msg_/);
      expect(id2).toMatch(/^msg_/);
    });
  });

  describe('Protocol message creation', () => {
    test('createSchemaDefinitionMessage returns valid message', () => {
      const message = codec.createSchemaDefinitionMessage();
      
      expect(message.type).toBe('schema_definition');
      expect(message.version).toBeDefined();
      expect(message.schemas).toBeDefined();
      expect(message.timestamp).toBeDefined();
    });

    test('createErrorMessage returns valid error message', () => {
      const message = codec.createErrorMessage('VALIDATION_ERROR', 'Test error', { field: 'test' });
      
      expect(message.type).toBe('error');
      expect(message.code).toBe('VALIDATION_ERROR');
      expect(message.message).toBe('Test error');
      expect(message.details.field).toBe('test');
      expect(message.timestamp).toBeDefined();
    });

    test('createAckMessage returns valid acknowledgment message', () => {
      const message = codec.createAckMessage('msg_123', 'success');
      
      expect(message.type).toBe('ack');
      expect(message.originalMessageId).toBe('msg_123');
      expect(message.messageId).toBeDefined(); // Ack has its own message ID
      expect(message.status).toBe('success');
      expect(message.timestamp).toBeDefined();
    });
  });

  describe('loadSchemaDefinition method', () => {
    test('loads schemas from schema definition message', () => {
      const schemaDefinition = {
        type: 'schema_definition',
        version: '1.0.0',
        schemas: {
          test_schema: testSchemas.simpleMessage
        },
        timestamp: '2025-01-28T16:30:00.000Z'
      };

      codec.loadSchemaDefinition(schemaDefinition);
      expect(codec.hasMessageType('test_schema')).toBe(true);
    });

    test('replaces existing schemas when replace=true', () => {
      codec.registerSchema(testSchemas.simpleMessage);
      expect(codec.hasMessageType('simple_message')).toBe(true);

      const schemaDefinition = {
        type: 'schema_definition',
        version: '1.0.0',
        schemas: {
          new_schema: testSchemas.complexMessage
        },
        timestamp: '2025-01-28T16:30:00.000Z'
      };

      codec.loadSchemaDefinition(schemaDefinition, true);
      expect(codec.hasMessageType('new_schema')).toBe(true);
      expect(codec.hasMessageType('simple_message')).toBe(false);
      expect(codec.hasMessageType('schema_definition')).toBe(true); // Base schemas re-added
    });

    test('throws error for invalid schema definition', () => {
      const invalidDefinition = {
        type: 'schema_definition',
        // Missing required fields
      };

      expect(() => {
        codec.loadSchemaDefinition(invalidDefinition);
      }).toThrow();
    });
  });

  describe('Integration - encode/decode round trips', () => {
    beforeEach(() => {
      codec.registerSchema(testSchemas.simpleMessage);
      codec.registerSchema(testSchemas.complexMessage);
    });

    test('simple message round trip', () => {
      const originalData = {
        content: 'Hello world'
      };

      const encodeResult = codec.encode('simple_message', originalData);
      expect(encodeResult.success).toBe(true);

      const decodeResult = codec.decode(encodeResult.encoded);
      expect(decodeResult.success).toBe(true);
      expect(decodeResult.messageType).toBe('simple_message');
      expect(decodeResult.decoded.content).toBe(originalData.content);
    });

    test('complex message round trip', () => {
      const originalData = {
        user: {
          id: 'user123',
          username: 'testuser',
          email: 'test@example.com'
        },
        items: [
          { name: 'item1', value: 42 },
          { name: 'item2', value: 84 }
        ]
      };

      const encodeResult = codec.encode('complex_message', originalData);
      expect(encodeResult.success).toBe(true);

      const decodeResult = codec.decode(encodeResult.encoded);
      expect(decodeResult.success).toBe(true);
      expect(decodeResult.messageType).toBe('complex_message');
      expect(decodeResult.decoded.user).toEqual(originalData.user);
      expect(decodeResult.decoded.items).toEqual(originalData.items);
    });

    test('error message round trip', () => {
      const errorMessage = codec.createErrorMessage('VALIDATION_ERROR', 'Test error');
      const encoded = JSON.stringify(errorMessage);
      
      const decodeResult = codec.decode(encoded);
      expect(decodeResult.success).toBe(true);
      expect(decodeResult.messageType).toBe('error');
      expect(decodeResult.decoded.code).toBe('VALIDATION_ERROR');
    });

    test('ack message round trip', () => {
      const ackMessage = codec.createAckMessage('msg_123', 'success');
      const encoded = JSON.stringify(ackMessage);
      
      const decodeResult = codec.decode(encoded);
      expect(decodeResult.success).toBe(true);
      expect(decodeResult.messageType).toBe('ack');
      expect(decodeResult.decoded.originalMessageId).toBe('msg_123');
      expect(decodeResult.decoded.status).toBe('success');
    });
  });
});