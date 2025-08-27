/**
 * Integration tests for Schema validation with @legion/schema
 * Tests real JSON Schema to Zod conversion and validation
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { BTValidator } from '../../src/BTValidator.js';
import { createValidator } from '@legion/schema';

describe('Schema Integration Tests', () => {
  let validator;

  beforeEach(() => {
    validator = new BTValidator({
      strictMode: true,
      validateTools: true,
      applyDefaults: true,
      coerceTypes: false
    });
  });

  describe('Complex Schema Validation', () => {
    test('should validate complex nested object schema', async () => {
      const tools = [{
        name: 'createUser',
        inputSchema: {
          type: 'object',
          properties: {
            user: {
              type: 'object',
              properties: {
                name: { type: 'string', minLength: 1, maxLength: 100 },
                email: { type: 'string', format: 'email' },
                age: { type: 'integer', minimum: 0, maximum: 150 },
                preferences: {
                  type: 'object',
                  properties: {
                    newsletter: { type: 'boolean', default: false },
                    theme: { type: 'string', enum: ['light', 'dark', 'auto'], default: 'auto' }
                  }
                }
              },
              required: ['name', 'email']
            }
          },
          required: ['user']
        }
      }];

      const validBT = {
        type: 'action',
        id: 'create',
        tool: 'createUser',
        inputs: {
          user: {
            name: 'John Doe',
            email: 'john@example.com',
            age: 30,
            preferences: {
              newsletter: true,
              theme: 'dark'
            }
          }
        }
      };

      const result = await validator.validate(validBT, tools);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect nested schema validation errors', async () => {
      const tools = [{
        name: 'createUser',
        inputSchema: {
          type: 'object',
          properties: {
            user: {
              type: 'object',
              properties: {
                name: { type: 'string', minLength: 1 },
                email: { type: 'string', format: 'email' },
                age: { type: 'integer', minimum: 0 }
              },
              required: ['name', 'email']
            }
          },
          required: ['user']
        }
      }];

      const invalidBT = {
        type: 'action',
        id: 'create',
        tool: 'createUser',
        inputs: {
          user: {
            name: '', // Too short
            email: 'not-an-email', // Invalid format
            age: -5 // Below minimum
          }
        }
      };

      const result = await validator.validate(invalidBT, tools);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.type === 'SCHEMA_VALIDATION_ERROR')).toBe(true);
    });
  });

  describe('Array Schema Validation', () => {
    test('should validate array parameters', async () => {
      const tools = [{
        name: 'batchProcess',
        inputSchema: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: { type: 'string' },
              minItems: 1,
              maxItems: 10
            },
            tags: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  value: { type: 'string' }
                },
                required: ['name', 'value']
              }
            }
          },
          required: ['items']
        }
      }];

      const validBT = {
        type: 'action',
        id: 'batch',
        tool: 'batchProcess',
        inputs: {
          items: ['item1', 'item2', 'item3'],
          tags: [
            { name: 'priority', value: 'high' },
            { name: 'category', value: 'test' }
          ]
        }
      };

      const result = await validator.validate(validBT, tools);
      expect(result.valid).toBe(true);
    });

    test('should detect array constraint violations', async () => {
      const tools = [{
        name: 'batchProcess',
        inputSchema: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: { type: 'string' },
              minItems: 1,
              maxItems: 5
            }
          },
          required: ['items']
        }
      }];

      const invalidBT = {
        type: 'action',
        id: 'batch',
        tool: 'batchProcess',
        inputs: {
          items: ['1', '2', '3', '4', '5', '6'] // Too many items
        }
      };

      const result = await validator.validate(invalidBT, tools);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'SCHEMA_VALIDATION_ERROR')).toBe(true);
    });
  });

  describe('Optional vs Required Parameters', () => {
    test('should allow missing optional parameters', async () => {
      const tools = [{
        name: 'search',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            limit: { type: 'integer', default: 10 },
            offset: { type: 'integer', default: 0 },
            sort: { type: 'string', enum: ['asc', 'desc'], default: 'asc' }
          },
          required: ['query'] // Only query is required
        }
      }];

      const bt = {
        type: 'action',
        id: 'search',
        tool: 'search',
        inputs: {
          query: 'test' // Only providing required field
        }
      };

      const result = await validator.validate(bt, tools);
      expect(result.valid).toBe(true);
    });

    test('should detect missing required parameters', async () => {
      const tools = [{
        name: 'upload',
        inputSchema: {
          type: 'object',
          properties: {
            file: { type: 'string' },
            destination: { type: 'string' },
            overwrite: { type: 'boolean', default: false }
          },
          required: ['file', 'destination']
        }
      }];

      const bt = {
        type: 'action',
        id: 'upload',
        tool: 'upload',
        inputs: {
          file: 'test.txt'
          // Missing required 'destination'
        }
      };

      const result = await validator.validate(bt, tools);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'SCHEMA_VALIDATION_ERROR')).toBe(true);
    });
  });

  describe('Type Coercion', () => {
    test('should coerce types when enabled', async () => {
      const coerceValidator = new BTValidator({
        strictMode: false,
        validateTools: true,
        coerceTypes: true // Enable coercion
      });

      const tools = [{
        name: 'processNumber',
        inputSchema: {
          type: 'object',
          properties: {
            value: { type: 'number' },
            flag: { type: 'boolean' }
          },
          required: ['value']
        }
      }];

      const bt = {
        type: 'action',
        id: 'process',
        tool: 'processNumber',
        inputs: {
          value: 42, // Use actual number
          flag: true // Use actual boolean
        }
      };

      const result = await coerceValidator.validate(bt, tools);
      expect(result.valid).toBe(true);
    });

    test('should not coerce types when disabled', async () => {
      const strictValidator = new BTValidator({
        strictMode: true,
        validateTools: true,
        coerceTypes: false // Disable coercion
      });

      const tools = [{
        name: 'processNumber',
        inputSchema: {
          type: 'object',
          properties: {
            value: { type: 'number' }
          },
          required: ['value']
        }
      }];

      const bt = {
        type: 'action',
        id: 'process',
        tool: 'processNumber',
        inputs: {
          value: '42' // String when number expected
        }
      };

      const result = await strictValidator.validate(bt, tools);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'SCHEMA_VALIDATION_ERROR')).toBe(true);
    });
  });

  describe('Format Validators', () => {
    test('should validate string formats', async () => {
      const tools = [{
        name: 'sendEmail',
        inputSchema: {
          type: 'object',
          properties: {
            to: { type: 'string', format: 'email' },
            website: { type: 'string', format: 'uri' },
            sendAt: { type: 'string', format: 'date-time' },
            ipAddress: { type: 'string', format: 'ipv4' }
          },
          required: ['to']
        }
      }];

      const validBT = {
        type: 'action',
        id: 'email',
        tool: 'sendEmail',
        inputs: {
          to: 'user@example.com',
          website: 'https://example.com',
          sendAt: '2024-01-01T12:00:00Z',
          ipAddress: '192.168.1.1'
        }
      };

      const result = await validator.validate(validBT, tools);
      expect(result.valid).toBe(true);
    });

    test('should detect format violations', async () => {
      const tools = [{
        name: 'sendEmail',
        inputSchema: {
          type: 'object',
          properties: {
            to: { type: 'string', format: 'email' },
            website: { type: 'string', format: 'uri' }
          },
          required: ['to', 'website']
        }
      }];

      const invalidBT = {
        type: 'action',
        id: 'email',
        tool: 'sendEmail',
        inputs: {
          to: 'not-an-email',
          website: 'not a url'
        }
      };

      const result = await validator.validate(invalidBT, tools);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Pattern Validation', () => {
    test('should validate regex patterns', async () => {
      const tools = [{
        name: 'createAccount',
        inputSchema: {
          type: 'object',
          properties: {
            username: { 
              type: 'string', 
              pattern: '^[a-zA-Z0-9_]{3,20}$',
              description: 'Alphanumeric with underscore, 3-20 chars'
            },
            phone: { 
              type: 'string', 
              pattern: '^\\+?[1-9]\\d{1,14}$',
              description: 'International phone number'
            }
          },
          required: ['username']
        }
      }];

      const validBT = {
        type: 'action',
        id: 'create',
        tool: 'createAccount',
        inputs: {
          username: 'valid_user123',
          phone: '+1234567890'
        }
      };

      const result = await validator.validate(validBT, tools);
      expect(result.valid).toBe(true);
    });

    test('should detect pattern violations', async () => {
      const tools = [{
        name: 'createAccount',
        inputSchema: {
          type: 'object',
          properties: {
            username: { 
              type: 'string', 
              pattern: '^[a-zA-Z0-9_]{3,20}$'
            }
          },
          required: ['username']
        }
      }];

      const invalidBT = {
        type: 'action',
        id: 'create',
        tool: 'createAccount',
        inputs: {
          username: 'invalid-user!' // Contains invalid characters
        }
      };

      const result = await validator.validate(invalidBT, tools);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'SCHEMA_VALIDATION_ERROR')).toBe(true);
    });
  });

  describe('Direct createValidator Usage', () => {
    test('should work with createValidator directly', async () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1 },
          age: { type: 'integer', minimum: 0, maximum: 150 },
          email: { type: 'string', format: 'email' }
        },
        required: ['name', 'email']
      };

      const validator = createValidator(schema, {
        strict: true,
        coerce: false
      });

      const validData = {
        name: 'John',
        age: 30,
        email: 'john@example.com'
      };

      const invalidData = {
        name: '',
        age: 200,
        email: 'not-an-email'
      };

      const validResult = validator.validate(validData);
      expect(validResult.valid).toBe(true);

      const invalidResult = validator.validate(invalidData);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors.length).toBeGreaterThan(0);
    });
  });
});