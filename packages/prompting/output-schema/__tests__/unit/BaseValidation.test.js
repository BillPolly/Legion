/**
 * Unit tests for base schema validation integration with @legion/schema
 * Tests extended schema validation and integration with existing schema infrastructure
 */

import { BaseValidator } from '../../src/BaseValidator.js';

describe('BaseValidator', () => {
  describe('constructor', () => {
    test('should create validator with valid extended schema', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number', minimum: 0 }
        },
        required: ['name'],
        'x-format': {
          json: { style: 'compact' }
        }
      };

      expect(() => new BaseValidator(schema)).not.toThrow();
    });

    test('should throw error for invalid schema', () => {
      const invalidSchema = {
        // Missing type property
        properties: {
          name: { type: 'string' }
        }
      };

      expect(() => new BaseValidator(invalidSchema))
        .toThrow('Schema must have a type property');
    });

    test('should validate x-format extensions during construction', () => {
      const schemaWithInvalidFormat = {
        type: 'object',
        properties: {
          name: { type: 'string' }
        },
        'x-format': {
          'unsupported-format': { option: 'value' }
        }
      };

      expect(() => new BaseValidator(schemaWithInvalidFormat))
        .toThrow('Unsupported format in x-format: unsupported-format');
    });
  });

  describe('extractBaseSchema', () => {
    test('should extract pure JSON Schema from extended schema', () => {
      const extendedSchema = {
        type: 'object',
        properties: {
          name: { 
            type: 'string',
            'x-format': {
              xml: { element: 'fullName' }
            }
          },
          age: { type: 'number' }
        },
        required: ['name'],
        'x-format': {
          xml: { 'root-element': 'person' }
        },
        'x-parsing': {
          'error-recovery': { mode: 'lenient' }
        }
      };

      const validator = new BaseValidator(extendedSchema);
      const baseSchema = validator.extractBaseSchema();

      expect(baseSchema).toEqual({
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' }
        },
        required: ['name']
      });

      // Should not contain x-format or x-parsing
      expect(baseSchema['x-format']).toBeUndefined();
      expect(baseSchema['x-parsing']).toBeUndefined();
      expect(baseSchema.properties.name['x-format']).toBeUndefined();
    });

    test('should preserve standard JSON Schema properties', () => {
      const schema = {
        $schema: 'https://json-schema.org/draft-07/schema#',
        $id: 'https://example.com/schema',
        title: 'Test Schema',
        description: 'A test schema',
        type: 'object',
        properties: {
          value: {
            type: 'number',
            minimum: 0,
            maximum: 100,
            multipleOf: 5
          }
        },
        'x-format': {
          json: { style: 'compact' }
        }
      };

      const validator = new BaseValidator(schema);
      const baseSchema = validator.extractBaseSchema();

      expect(baseSchema.$schema).toBe('https://json-schema.org/draft-07/schema#');
      expect(baseSchema.$id).toBe('https://example.com/schema');
      expect(baseSchema.title).toBe('Test Schema');
      expect(baseSchema.description).toBe('A test schema');
      expect(baseSchema.properties.value.minimum).toBe(0);
      expect(baseSchema.properties.value.maximum).toBe(100);
      expect(baseSchema.properties.value.multipleOf).toBe(5);
    });
  });

  describe('validateData', () => {
    test('should validate data against base schema successfully', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number', minimum: 0 }
        },
        required: ['name']
      };

      const validator = new BaseValidator(schema);
      const validData = { name: 'John', age: 25 };

      const result = validator.validateData(validData);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(validData);
    });

    test('should return validation errors for invalid data', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number', minimum: 0 }
        },
        required: ['name']
      };

      const validator = new BaseValidator(schema);
      const invalidData = { age: -5 }; // Missing required name, invalid age

      const result = validator.validateData(invalidData);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should handle type coercion when enabled', () => {
      const schema = {
        type: 'object',
        properties: {
          count: { type: 'number' },
          active: { type: 'boolean' }
        }
      };

      const validator = new BaseValidator(schema, { coerceTypes: true });
      const dataWithStrings = { count: '42', active: 'true' };

      const result = validator.validateData(dataWithStrings);

      expect(result.success).toBe(true);
      expect(result.data.count).toBe(42);
      expect(result.data.active).toBe(true);
    });
  });

  describe('getFormatSpecs', () => {
    test('should return format specifications for requested format', () => {
      const schema = {
        type: 'object',
        properties: {
          content: {
            type: 'string',
            'x-format': {
              xml: { cdata: true }
            }
          }
        },
        'x-format': {
          xml: {
            'root-element': 'document',
            'namespace': 'http://example.com'
          }
        }
      };

      const validator = new BaseValidator(schema);
      const formatSpecs = validator.getFormatSpecs('xml');

      expect(formatSpecs).toEqual({
        'root-element': 'document',
        'namespace': 'http://example.com',
        properties: {
          content: { cdata: true }
        }
      });
    });

    test('should return empty object for unsupported format', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' }
        }
      };

      const validator = new BaseValidator(schema);
      const formatSpecs = validator.getFormatSpecs('xml');

      expect(formatSpecs).toEqual({});
    });
  });

  describe('getParsingConfig', () => {
    test('should return parsing configuration', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' }
        },
        'x-parsing': {
          'format-detection': {
            enabled: true,
            strategies: ['json', 'xml']
          },
          'error-recovery': {
            mode: 'aggressive',
            'auto-repair': true
          }
        }
      };

      const validator = new BaseValidator(schema);
      const config = validator.getParsingConfig();

      expect(config).toEqual({
        'format-detection': {
          enabled: true,
          strategies: ['json', 'xml']
        },
        'error-recovery': {
          mode: 'aggressive',
          'auto-repair': true
        }
      });
    });

    test('should return default config when no x-parsing specified', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' }
        }
      };

      const validator = new BaseValidator(schema);
      const config = validator.getParsingConfig();

      expect(config).toEqual({
        'format-detection': {
          enabled: true,
          strategies: ['json', 'xml', 'delimited', 'tagged', 'markdown'],
          'fallback-order': ['json', 'xml', 'delimited']
        },
        'error-recovery': {
          mode: 'lenient',
          'auto-repair': true,
          'partial-results': true
        }
      });
    });
  });

  describe('getSupportedFormats', () => {
    test('should return formats specified in x-format', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' }
        },
        'x-format': {
          json: { style: 'compact' },
          xml: { 'root-element': 'data' },
          delimited: { 'section-pattern': '---{NAME}---' }
        }
      };

      const validator = new BaseValidator(schema);
      const formats = validator.getSupportedFormats();

      expect(formats).toEqual(['json', 'xml', 'delimited']);
    });

    test('should return all formats when no x-format specified', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' }
        }
      };

      const validator = new BaseValidator(schema);
      const formats = validator.getSupportedFormats();

      expect(formats).toEqual(['json', 'xml', 'delimited', 'tagged', 'markdown']);
    });
  });
});