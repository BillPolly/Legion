/**
 * Tests for base message schemas
 */

import { 
  SCHEMA_DEFINITION_MESSAGE,
  ERROR_MESSAGE,
  ACK_MESSAGE,
  PING_MESSAGE,
  PONG_MESSAGE
} from '../../src/schemas/base.js';
import { SchemaValidator } from '../../src/validators/SchemaValidator.js';
import { SchemaRegistry } from '../../src/schemas/index.js';

describe('Base Schema Definitions', () => {
  let validator;

  beforeEach(() => {
    validator = new SchemaValidator();
  });

  describe('SCHEMA_DEFINITION_MESSAGE', () => {
    beforeEach(() => {
      validator.addSchema('schema_definition', SCHEMA_DEFINITION_MESSAGE);
    });

    test('validates correct schema definition message', () => {
      const validMessage = {
        type: 'schema_definition',
        version: '1.2.3',
        schemas: {
          test_schema: {
            $id: 'test_schema',
            type: 'object',
            properties: { name: { type: 'string' } }
          }
        },
        messageId: 'msg_123',
        timestamp: '2025-07-28T16:30:00.000Z'
      };

      const result = validator.validate('schema_definition', validMessage);
      expect(result.success).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('rejects message with invalid version format', () => {
      const invalidMessage = {
        type: 'schema_definition',
        version: '1.2', // Invalid semver
        schemas: {},
        timestamp: '2025-07-28T16:30:00.000Z'
      };

      const result = validator.validate('schema_definition', invalidMessage);
      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.message.includes('pattern'))).toBe(true);
    });

    test('rejects message with missing required fields', () => {
      const invalidMessage = {
        type: 'schema_definition',
        // Missing version, schemas, timestamp
      };

      const result = validator.validate('schema_definition', invalidMessage);
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('rejects message with invalid timestamp format', () => {
      const invalidMessage = {
        type: 'schema_definition',
        version: '1.0.0',
        schemas: {},
        timestamp: 'not-a-datetime'
      };

      const result = validator.validate('schema_definition', invalidMessage);
      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.message.includes('format'))).toBe(true);
    });

    test('validates empty schemas object', () => {
      const validMessage = {
        type: 'schema_definition',
        version: '1.0.0',
        schemas: {},
        messageId: 'msg_456',
        timestamp: '2025-07-28T16:30:00.000Z'
      };

      const result = validator.validate('schema_definition', validMessage);
      expect(result.success).toBe(true);
    });
  });

  describe('ERROR_MESSAGE', () => {
    beforeEach(() => {
      validator.addSchema('error_message', ERROR_MESSAGE);
    });

    test('validates correct error message', () => {
      const validMessage = {
        type: 'error',
        code: 'VALIDATION_ERROR',
        message: 'Schema validation failed',
        details: { field: 'username', reason: 'too short' },
        messageId: 'msg_error_123',
        timestamp: '2025-07-28T16:30:00.000Z'
      };

      const result = validator.validate('error_message', validMessage);
      expect(result.success).toBe(true);
    });

    test('validates all error codes', () => {
      const errorCodes = ['VALIDATION_ERROR', 'UNKNOWN_MESSAGE_TYPE', 'ENCODING_ERROR', 'DECODING_ERROR', 'SCHEMA_ERROR'];

      for (const code of errorCodes) {
        const message = {
          type: 'error',
          code,
          message: 'Test error',
          messageId: `msg_${code}`,
          timestamp: '2025-07-28T16:30:00.000Z'
        };

        const result = validator.validate('error_message', message);
        expect(result.success).toBe(true);
      }
    });

    test('rejects invalid error code', () => {
      const invalidMessage = {
        type: 'error',
        code: 'INVALID_CODE',
        message: 'Test error',
        timestamp: '2025-07-28T16:30:00.000Z'
      };

      const result = validator.validate('error_message', invalidMessage);
      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.message.includes('must be equal to one of the allowed values'))).toBe(true);
    });

    test('allows optional details field', () => {
      const messageWithoutDetails = {
        type: 'error',
        code: 'ENCODING_ERROR',
        message: 'Failed to encode message',
        messageId: 'msg_no_details',
        timestamp: '2025-07-28T16:30:00.000Z'
      };

      const result = validator.validate('error_message', messageWithoutDetails);
      expect(result.success).toBe(true);
    });

    test('rejects message with missing required fields', () => {
      const invalidMessage = {
        type: 'error',
        // Missing code, message, timestamp
      };

      const result = validator.validate('error_message', invalidMessage);
      expect(result.success).toBe(false);
    });
  });

  describe('ACK_MESSAGE', () => {
    beforeEach(() => {
      validator.addSchema('ack_message', ACK_MESSAGE);
    });

    test('validates correct acknowledgment message', () => {
      const validMessage = {
        type: 'ack',
        messageId: 'msg_ack_12345',
        originalMessageId: 'msg_original_123',
        status: 'success',
        timestamp: '2025-07-28T16:30:00.000Z'
      };

      const result = validator.validate('ack_message', validMessage);
      expect(result.success).toBe(true);
    });

    test('validates both status values', () => {
      const statuses = ['success', 'error'];

      for (const status of statuses) {
        const message = {
          type: 'ack',
          messageId: `msg_ack_${status}`,
          originalMessageId: 'msg_original_123',
          status,
          timestamp: '2025-07-28T16:30:00.000Z'
        };

        const result = validator.validate('ack_message', message);
        expect(result.success).toBe(true);
      }
    });

    test('rejects invalid status value', () => {
      const invalidMessage = {
        type: 'ack',
        messageId: 'msg_12345',
        status: 'pending',
        timestamp: '2025-07-28T16:30:00.000Z'
      };

      const result = validator.validate('ack_message', invalidMessage);
      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.message.includes('must be equal to one of the allowed values'))).toBe(true);
    });

    test('rejects message with missing required fields', () => {
      const invalidMessage = {
        type: 'ack',
        // Missing messageId, status, timestamp
      };

      const result = validator.validate('ack_message', invalidMessage);
      expect(result.success).toBe(false);
    });
  });

  describe('PING_MESSAGE', () => {
    beforeEach(() => {
      validator.addSchema('ping_message', PING_MESSAGE);
    });

    test('validates correct ping message', () => {
      const validMessage = {
        type: 'ping',
        messageId: 'msg_ping_123',
        timestamp: '2025-07-28T16:30:00.000Z'
      };

      const result = validator.validate('ping_message', validMessage);
      expect(result.success).toBe(true);
    });

    test('rejects message with wrong type', () => {
      const invalidMessage = {
        type: 'pong',
        timestamp: '2025-07-28T16:30:00.000Z'
      };

      const result = validator.validate('ping_message', invalidMessage);
      expect(result.success).toBe(false);
    });

    test('rejects message with missing timestamp', () => {
      const invalidMessage = {
        type: 'ping'
      };

      const result = validator.validate('ping_message', invalidMessage);
      expect(result.success).toBe(false);
    });

    test('rejects message with invalid timestamp format', () => {
      const invalidMessage = {
        type: 'ping',
        timestamp: 'invalid-date'
      };

      const result = validator.validate('ping_message', invalidMessage);
      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.message.includes('format'))).toBe(true);
    });
  });

  describe('PONG_MESSAGE', () => {
    beforeEach(() => {
      validator.addSchema('pong_message', PONG_MESSAGE);
    });

    test('validates correct pong message', () => {
      const validMessage = {
        type: 'pong',
        messageId: 'msg_pong_123',
        timestamp: '2025-07-28T16:30:00.000Z'
      };

      const result = validator.validate('pong_message', validMessage);
      expect(result.success).toBe(true);
    });

    test('rejects message with wrong type', () => {
      const invalidMessage = {
        type: 'ping',
        timestamp: '2025-07-28T16:30:00.000Z'
      };

      const result = validator.validate('pong_message', invalidMessage);
      expect(result.success).toBe(false);
    });

    test('rejects message with missing timestamp', () => {
      const invalidMessage = {
        type: 'pong'
      };

      const result = validator.validate('pong_message', invalidMessage);
      expect(result.success).toBe(false);
    });
  });

  describe('Base Schema Structure Validation', () => {
    test('all base schemas have required $id property', () => {
      const schemas = [SCHEMA_DEFINITION_MESSAGE, ERROR_MESSAGE, ACK_MESSAGE, PING_MESSAGE, PONG_MESSAGE];
      
      for (const schema of schemas) {
        expect(schema).toHaveProperty('$id');
        expect(typeof schema.$id).toBe('string');
        expect(schema.$id.length).toBeGreaterThan(0);
      }
    });

    test('all base schemas have valid JSON Schema structure', () => {
      const schemas = [SCHEMA_DEFINITION_MESSAGE, ERROR_MESSAGE, ACK_MESSAGE, PING_MESSAGE, PONG_MESSAGE];
      
      for (const schema of schemas) {
        expect(schema).toHaveProperty('type');
        expect(schema).toHaveProperty('properties');
        expect(schema).toHaveProperty('required');
        expect(Array.isArray(schema.required)).toBe(true);
      }
    });

    test('all base schemas can be compiled by AJV', () => {
      const schemas = [
        { id: 'schema_definition', schema: SCHEMA_DEFINITION_MESSAGE },
        { id: 'error_message', schema: ERROR_MESSAGE },
        { id: 'ack_message', schema: ACK_MESSAGE },
        { id: 'ping_message', schema: PING_MESSAGE },
        { id: 'pong_message', schema: PONG_MESSAGE }
      ];

      for (const { id, schema } of schemas) {
        expect(() => {
          validator.addSchema(id, schema);
        }).not.toThrow();
      }
    });
  });

  describe('SchemaRegistry Integration with Base Schemas', () => {
    test('SchemaRegistry loads all base schemas automatically', () => {
      const registry = new SchemaRegistry();

      expect(registry.has('schema_definition')).toBe(true);
      expect(registry.has('error_message')).toBe(true);
      expect(registry.has('ack_message')).toBe(true);
      expect(registry.has('ping_message')).toBe(true);
      expect(registry.has('pong_message')).toBe(true);
    });

    test('Base schemas in registry match exported schemas', () => {
      const registry = new SchemaRegistry();

      expect(registry.get('schema_definition')).toEqual(SCHEMA_DEFINITION_MESSAGE);
      expect(registry.get('error_message')).toEqual(ERROR_MESSAGE);
      expect(registry.get('ack_message')).toEqual(ACK_MESSAGE);
      expect(registry.get('ping_message')).toEqual(PING_MESSAGE);
      expect(registry.get('pong_message')).toEqual(PONG_MESSAGE);
    });
  });
});