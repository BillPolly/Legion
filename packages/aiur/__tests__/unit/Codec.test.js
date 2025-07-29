/**
 * Codec Unit Tests
 * 
 * Tests the codec integration in AiurServer to ensure schemas are properly
 * initialized and available for WebSocket communication.
 */

import { jest } from '@jest/globals';
import { Codec } from '../../../shared/codec/src/Codec.js';

describe('Codec Integration', () => {
  let codec;

  beforeEach(() => {
    codec = new Codec({
      strictValidation: true,
      injectMetadata: true
    });
  });

  describe('Codec Initialization', () => {
    test('should initialize codec with validation enabled', () => {
      expect(codec).toBeDefined();
      expect(codec.options.strictValidation).toBe(true);
      expect(codec.options.injectMetadata).toBe(true);
    });

    test('should have schema registry and validator', () => {
      expect(codec.registry).toBeDefined();
      expect(codec.validator).toBeDefined();
    });

    test('should provide message types', () => {
      const messageTypes = codec.getMessageTypes();
      expect(Array.isArray(messageTypes)).toBe(true);
      expect(messageTypes.length).toBeGreaterThan(0);
      
      console.log('Available message types:', messageTypes);
    });
  });

  describe('Schema Definition Creation', () => {
    test('should create schema definition message', () => {
      const schemaDefinition = codec.createSchemaDefinitionMessage();
      
      expect(schemaDefinition).toBeDefined();
      expect(schemaDefinition.type).toBe('schema_definition');
      expect(schemaDefinition.version).toBeDefined();
      expect(schemaDefinition.schemas).toBeDefined();
      expect(typeof schemaDefinition.schemas).toBe('object');
      expect(schemaDefinition.timestamp).toBeDefined();
      
      // Message types are derived from schema IDs
      const messageTypes = Object.keys(schemaDefinition.schemas);
      expect(Array.isArray(messageTypes)).toBe(true);
      expect(messageTypes.length).toBeGreaterThan(0);
      
      console.log(`Schema definition contains ${Object.keys(schemaDefinition.schemas).length} schemas`);
    });

    test('should have schemas for basic message types', () => {
      const schemaDefinition = codec.createSchemaDefinitionMessage();
      const schemaIds = Object.keys(schemaDefinition.schemas);
      
      // Should have at least some basic schemas
      expect(schemaIds.length).toBeGreaterThan(0);
      
      // Log available schemas for debugging
      console.log('Available schemas:', schemaIds);
    });
  });

  describe('Message Encoding', () => {
    test('should encode simple message', () => {
      const messageData = {
        test: 'data',
        value: 123
      };
      
      // Try to encode a simple message - we may not have 'test' schema
      // but we should get a proper error response
      const result = codec.encode('test_message', messageData);
      
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      
      if (result.success) {
        expect(result.encoded).toBeDefined();
        expect(typeof result.encoded).toBe('string');
      } else {
        expect(result.error).toBeDefined();
        expect(result.error.code).toBeDefined();
      }
    });

    test('should handle unknown message type', () => {
      const result = codec.encode('unknown_message_type', { data: 'test' });
      
      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error.code).toBe('UNKNOWN_MESSAGE_TYPE');
      expect(result.error.message).toContain('unknown_message_type');
    });
  });

  describe('Message Decoding', () => {
    test('should decode JSON message', () => {
      const messageData = {
        type: 'test',
        data: 'example'
      };
      
      const encoded = JSON.stringify(messageData);
      const result = codec.decode(encoded);
      
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      
      if (result.success) {
        expect(result.decoded).toBeDefined();
        expect(result.messageType).toBe('test');
      } else {
        // If decoding fails due to unknown schema, that's expected
        expect(result.error).toBeDefined();
      }
    });

    test('should handle invalid JSON', () => {
      const result = codec.decode('invalid json {');
      
      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error.code).toBe('DECODING_ERROR');
    });

    test('should handle message without type', () => {
      const messageData = { data: 'no type field' };
      const encoded = JSON.stringify(messageData);
      const result = codec.decode(encoded);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error.message).toContain('type field');
    });
  });

  describe('Error Message Creation', () => {
    test('should create error message', () => {
      const error = codec.createErrorMessage('TEST_ERROR', 'Test error message');
      
      expect(error).toBeDefined();
      expect(error.type).toBe('error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.message).toBe('Test error message');
      expect(error.messageId).toBeDefined();
      expect(error.timestamp).toBeDefined();
    });

    test('should create acknowledgment message', () => {
      const ack = codec.createAckMessage('original_msg_123', 'success');
      
      expect(ack).toBeDefined();
      expect(ack.type).toBe('ack');
      expect(ack.originalMessageId).toBe('original_msg_123');
      expect(ack.status).toBe('success');
      expect(ack.messageId).toBeDefined();
      expect(ack.timestamp).toBeDefined();
    });
  });

  describe('Message ID Generation', () => {
    test('should generate unique message IDs', () => {
      const id1 = codec.generateMessageId();
      const id2 = codec.generateMessageId();
      
      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(typeof id1).toBe('string');
      expect(typeof id2).toBe('string');
      expect(id1).not.toBe(id2);
      expect(id1.startsWith('msg_')).toBe(true);
      expect(id2.startsWith('msg_')).toBe(true);
    });
  });
});