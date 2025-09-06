/**
 * Unit tests for SchemaExtensions utility class
 * Tests schema validation and format specification extraction
 */

import { SchemaExtensions } from '../../src/SchemaExtensions.js';

describe('SchemaExtensions', () => {
  describe('validateExtendedSchema', () => {
    test('should validate basic extended schema', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' }
        },
        required: ['name'],
        'x-format': {
          json: { style: 'compact' }
        }
      };

      expect(() => SchemaExtensions.validateExtendedSchema(schema)).not.toThrow();
    });

    test('should reject schema without base JSON Schema properties', () => {
      const schema = {
        'x-format': {
          json: { style: 'compact' }
        }
      };

      expect(() => SchemaExtensions.validateExtendedSchema(schema))
        .toThrow('Schema must have a type property');
    });

    test('should reject schema with invalid x-format structure', () => {
      const schema = {
        type: 'object',
        properties: { name: { type: 'string' } },
        'x-format': 'invalid'
      };

      expect(() => SchemaExtensions.validateExtendedSchema(schema))
        .toThrow('x-format must be an object');
    });

    test('should validate x-parsing configurations', () => {
      const schema = {
        type: 'object',
        properties: { name: { type: 'string' } },
        'x-parsing': {
          'format-detection': {
            enabled: true,
            strategies: ['json', 'xml']
          },
          'error-recovery': {
            mode: 'lenient'
          }
        }
      };

      expect(() => SchemaExtensions.validateExtendedSchema(schema)).not.toThrow();
    });

    test('should reject invalid x-parsing mode', () => {
      const schema = {
        type: 'object',
        properties: { name: { type: 'string' } },
        'x-parsing': {
          'error-recovery': {
            mode: 'invalid-mode'
          }
        }
      };

      expect(() => SchemaExtensions.validateExtendedSchema(schema))
        .toThrow('Invalid error-recovery mode: invalid-mode');
    });
  });

  describe('getFormatSpecs', () => {
    test('should extract format specifications for supported format', () => {
      const schema = {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: { type: 'string' }
          }
        },
        'x-format': {
          xml: {
            'root-element': 'response',
            properties: {
              items: {
                element: 'items',
                'item-element': 'item'
              }
            }
          }
        }
      };

      const specs = SchemaExtensions.getFormatSpecs(schema, 'xml');
      expect(specs).toEqual({
        'root-element': 'response',
        properties: {
          items: {
            element: 'items',
            'item-element': 'item'
          }
        }
      });
    });

    test('should return empty object for unsupported format', () => {
      const schema = {
        type: 'object',
        properties: { name: { type: 'string' } },
        'x-format': {
          json: { style: 'compact' }
        }
      };

      const specs = SchemaExtensions.getFormatSpecs(schema, 'xml');
      expect(specs).toEqual({});
    });

    test('should merge property-level format specs with global specs', () => {
      const schema = {
        type: 'object',
        properties: {
          code: {
            type: 'string',
            'x-format': {
              xml: { cdata: true }
            }
          }
        },
        'x-format': {
          xml: {
            'root-element': 'response'
          }
        }
      };

      const specs = SchemaExtensions.getFormatSpecs(schema, 'xml');
      expect(specs).toEqual({
        'root-element': 'response',
        properties: {
          code: { cdata: true }
        }
      });
    });
  });

  describe('generateInstructions', () => {
    test('should generate basic format instructions', () => {
      const schema = {
        type: 'object',
        properties: {
          task: { 
            type: 'string',
            description: 'The task to complete'
          },
          confidence: { 
            type: 'number',
            minimum: 0,
            maximum: 1
          }
        },
        required: ['task']
      };

      const instructions = SchemaExtensions.generateInstructions(schema, 'json');
      
      expect(instructions).toContain('JSON');
      expect(instructions).toContain('task');
      expect(instructions).toContain('confidence');
      expect(instructions).toContain('Required fields');
      expect(instructions).toContain('string');
      expect(instructions).toContain('number');
    });

    test('should include constraint information in instructions', () => {
      const schema = {
        type: 'object',
        properties: {
          score: {
            type: 'number',
            minimum: 0,
            maximum: 100,
            description: 'Score from 0 to 100'
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            maxItems: 5
          }
        }
      };

      const instructions = SchemaExtensions.generateInstructions(schema, 'json');
      
      expect(instructions).toContain('0');
      expect(instructions).toContain('100');
      expect(instructions).toContain('5');
      expect(instructions).toContain('Score from 0 to 100');
    });

    test('should generate XML-specific instructions', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' }
        },
        'x-format': {
          xml: {
            'root-element': 'response'
          }
        }
      };

      const instructions = SchemaExtensions.generateInstructions(schema, 'xml');
      
      expect(instructions).toContain('XML');
      expect(instructions).toContain('<response>');
      expect(instructions).toContain('<name>');
    });

    test('should throw error for unsupported format', () => {
      const schema = {
        type: 'object',
        properties: { name: { type: 'string' } }
      };

      expect(() => SchemaExtensions.generateInstructions(schema, 'unsupported'))
        .toThrow('Unsupported format: unsupported');
    });
  });

  describe('mergeFormatOptions', () => {
    test('should merge global and property-level options', () => {
      const global = {
        'root-element': 'response',
        style: 'verbose'
      };

      const property = {
        cdata: true,
        style: 'compact' // Should override global
      };

      const merged = SchemaExtensions.mergeFormatOptions(global, property);
      
      expect(merged).toEqual({
        'root-element': 'response',
        style: 'compact',
        cdata: true
      });
    });

    test('should return global options when no property options', () => {
      const global = {
        'root-element': 'response'
      };

      const merged = SchemaExtensions.mergeFormatOptions(global, null);
      expect(merged).toEqual(global);
    });

    test('should return property options when no global options', () => {
      const property = {
        cdata: true
      };

      const merged = SchemaExtensions.mergeFormatOptions(null, property);
      expect(merged).toEqual(property);
    });
  });
});