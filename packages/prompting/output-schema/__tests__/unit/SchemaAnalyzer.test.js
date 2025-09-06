/**
 * Unit tests for SchemaAnalyzer
 * Tests intelligent analysis of JSON Schema for prompt generation
 */

import { SchemaAnalyzer } from '../../src/SchemaAnalyzer.js';

describe('SchemaAnalyzer', () => {
  describe('analyzeSchema', () => {
    test('should extract basic field information', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { 
            type: 'string',
            description: 'User full name'
          },
          age: { 
            type: 'number',
            minimum: 0,
            maximum: 120
          },
          active: { type: 'boolean' }
        },
        required: ['name', 'age']
      };

      const analysis = SchemaAnalyzer.analyzeSchema(schema);
      
      expect(analysis.fields).toBeDefined();
      expect(analysis.fields.name).toEqual({
        type: 'string',
        required: true,
        description: 'User full name',
        constraints: {}
      });
      expect(analysis.fields.age).toEqual({
        type: 'number',
        required: true,
        description: null,
        constraints: { minimum: 0, maximum: 120 }
      });
      expect(analysis.fields.active).toEqual({
        type: 'boolean',
        required: false,
        description: null,
        constraints: {}
      });
    });

    test('should analyze array properties', () => {
      const schema = {
        type: 'object',
        properties: {
          tags: {
            type: 'array',
            items: { type: 'string' },
            maxItems: 5,
            minItems: 1,
            description: 'Category tags'
          },
          scores: {
            type: 'array',
            items: { 
              type: 'number',
              minimum: 0,
              maximum: 10
            }
          }
        }
      };

      const analysis = SchemaAnalyzer.analyzeSchema(schema);
      
      expect(analysis.fields.tags).toEqual({
        type: 'array',
        required: false,
        description: 'Category tags',
        constraints: { maxItems: 5, minItems: 1 },
        items: { type: 'string', constraints: {} }
      });
      expect(analysis.fields.scores.items).toEqual({
        type: 'number',
        constraints: { minimum: 0, maximum: 10 }
      });
    });

    test('should identify validation constraints', () => {
      const schema = {
        type: 'object',
        properties: {
          email: {
            type: 'string',
            format: 'email',
            minLength: 5,
            maxLength: 100
          },
          score: {
            type: 'number',
            multipleOf: 0.1,
            exclusiveMinimum: 0,
            exclusiveMaximum: 1
          }
        }
      };

      const analysis = SchemaAnalyzer.analyzeSchema(schema);
      
      expect(analysis.fields.email.constraints).toEqual({
        format: 'email',
        minLength: 5,
        maxLength: 100
      });
      expect(analysis.fields.score.constraints).toEqual({
        multipleOf: 0.1,
        exclusiveMinimum: 0,
        exclusiveMaximum: 1
      });
    });

    test('should extract enum values', () => {
      const schema = {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['pending', 'approved', 'rejected']
          },
          priority: {
            type: 'number',
            enum: [1, 2, 3, 4, 5]
          }
        }
      };

      const analysis = SchemaAnalyzer.analyzeSchema(schema);
      
      expect(analysis.fields.status.constraints.enum).toEqual(['pending', 'approved', 'rejected']);
      expect(analysis.fields.priority.constraints.enum).toEqual([1, 2, 3, 4, 5]);
    });

    test('should handle nested object properties', () => {
      const schema = {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              contact: {
                type: 'object',
                properties: {
                  email: { type: 'string' },
                  phone: { type: 'string' }
                }
              }
            }
          }
        }
      };

      const analysis = SchemaAnalyzer.analyzeSchema(schema);
      
      expect(analysis.fields.user.type).toBe('object');
      expect(analysis.fields.user.properties).toBeDefined();
      expect(analysis.fields.user.properties.name.type).toBe('string');
    });

    test('should extract format specifications', () => {
      const schema = {
        type: 'object',
        properties: {
          data: { type: 'string' }
        },
        'x-format': {
          json: { style: 'compact' },
          xml: { 'root-element': 'response' }
        }
      };

      const analysis = SchemaAnalyzer.analyzeSchema(schema);
      
      expect(analysis.formatSpecs).toEqual({
        json: { style: 'compact' },
        xml: { 'root-element': 'response' }
      });
    });

    test('should identify required vs optional fields', () => {
      const schema = {
        type: 'object',
        properties: {
          required1: { type: 'string' },
          required2: { type: 'number' },
          optional1: { type: 'boolean' },
          optional2: { type: 'string' }
        },
        required: ['required1', 'required2']
      };

      const analysis = SchemaAnalyzer.analyzeSchema(schema);
      
      expect(analysis.requiredFields).toEqual(['required1', 'required2']);
      expect(analysis.optionalFields).toEqual(['optional1', 'optional2']);
      expect(analysis.fields.required1.required).toBe(true);
      expect(analysis.fields.optional1.required).toBe(false);
    });
  });

  describe('generateTypeHints', () => {
    test('should generate type hints for basic types', () => {
      expect(SchemaAnalyzer.generateTypeHint({ type: 'string' })).toBe('<string>');
      expect(SchemaAnalyzer.generateTypeHint({ type: 'number' })).toBe('<number>');
      expect(SchemaAnalyzer.generateTypeHint({ type: 'boolean' })).toBe('<boolean>');
    });

    test('should include constraints in type hints', () => {
      const stringWithConstraints = {
        type: 'string',
        minLength: 3,
        maxLength: 20
      };
      
      const hint = SchemaAnalyzer.generateTypeHint(stringWithConstraints);
      expect(hint).toContain('string');
      expect(hint).toContain('3-20');
    });

    test('should generate array type hints', () => {
      const arraySchema = {
        type: 'array',
        items: { type: 'string' },
        maxItems: 5
      };
      
      const hint = SchemaAnalyzer.generateTypeHint(arraySchema);
      expect(hint).toContain('string');
      expect(hint).toContain('5');
    });

    test('should handle enum values', () => {
      const enumSchema = {
        type: 'string',
        enum: ['red', 'green', 'blue']
      };
      
      const hint = SchemaAnalyzer.generateTypeHint(enumSchema);
      expect(hint).toContain('red');
      expect(hint).toContain('green');
      expect(hint).toContain('blue');
    });
  });

  describe('extractValidationRules', () => {
    test('should extract validation rules from schema', () => {
      const schema = {
        type: 'object',
        properties: {
          score: {
            type: 'number',
            minimum: 0,
            maximum: 10
          },
          tags: {
            type: 'array',
            maxItems: 3,
            items: { type: 'string' }
          }
        },
        required: ['score']
      };

      const rules = SchemaAnalyzer.extractValidationRules(schema);
      
      expect(rules).toContain('Required fields: score');
      expect(rules).toContain('score must be between 0 and 10');
      expect(rules).toContain('tags array cannot exceed 3 items');
    });

    test('should handle string format constraints', () => {
      const schema = {
        type: 'object',
        properties: {
          email: {
            type: 'string',
            format: 'email'
          },
          url: {
            type: 'string',
            format: 'uri'
          }
        }
      };

      const rules = SchemaAnalyzer.extractValidationRules(schema);
      
      expect(rules).toContain('email must be valid email format');
      expect(rules).toContain('url must be valid uri format');
    });

    test('should handle pattern constraints', () => {
      const schema = {
        type: 'object',
        properties: {
          code: {
            type: 'string',
            pattern: '^[A-Z]{3}\\d{3}$'
          }
        }
      };

      const rules = SchemaAnalyzer.extractValidationRules(schema);
      
      expect(rules.some(rule => rule.includes('code must match pattern'))).toBe(true);
    });
  });
});