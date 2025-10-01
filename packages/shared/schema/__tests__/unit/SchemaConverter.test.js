import { describe, it, expect } from '@jest/globals';
import { SchemaConverter, jsonSchemaToZod } from '../../src/SchemaConverter.js';
import { z } from 'zod';

describe('SchemaConverter', () => {
  let converter;

  beforeEach(() => {
    converter = new SchemaConverter();
  });

  describe('Basic Types', () => {
    it('should convert null type', () => {
      const schema = { type: 'null' };
      const zodSchema = converter.convert(schema);
      
      expect(zodSchema.parse(null)).toBe(null);
      expect(() => zodSchema.parse('string')).toThrow();
    });

    it('should convert boolean type', () => {
      const schema = { type: 'boolean' };
      const zodSchema = converter.convert(schema);
      
      expect(zodSchema.parse(true)).toBe(true);
      expect(zodSchema.parse(false)).toBe(false);
      expect(() => zodSchema.parse('true')).toThrow();
    });

    it('should convert integer type', () => {
      const schema = { type: 'integer' };
      const zodSchema = converter.convert(schema);
      
      expect(zodSchema.parse(42)).toBe(42);
      expect(zodSchema.parse(0)).toBe(0);
      expect(zodSchema.parse(-10)).toBe(-10);
      expect(() => zodSchema.parse(3.14)).toThrow();
      expect(() => zodSchema.parse('42')).toThrow();
    });

    it('should convert number type', () => {
      const schema = { type: 'number' };
      const zodSchema = converter.convert(schema);
      
      expect(zodSchema.parse(42)).toBe(42);
      expect(zodSchema.parse(3.14)).toBe(3.14);
      expect(zodSchema.parse(-10.5)).toBe(-10.5);
      expect(() => zodSchema.parse('42')).toThrow();
    });

    it('should convert string type', () => {
      const schema = { type: 'string' };
      const zodSchema = converter.convert(schema);
      
      expect(zodSchema.parse('hello')).toBe('hello');
      expect(zodSchema.parse('')).toBe('');
      expect(() => zodSchema.parse(42)).toThrow();
      expect(() => zodSchema.parse(null)).toThrow();
    });
  });

  describe('String Constraints', () => {
    it('should handle minLength and maxLength', () => {
      const schema = {
        type: 'string',
        minLength: 2,
        maxLength: 5
      };
      const zodSchema = converter.convert(schema);
      
      expect(zodSchema.parse('ab')).toBe('ab');
      expect(zodSchema.parse('hello')).toBe('hello');
      expect(() => zodSchema.parse('a')).toThrow();
      expect(() => zodSchema.parse('toolong')).toThrow();
    });

    it('should handle pattern constraint', () => {
      const schema = {
        type: 'string',
        pattern: '^[A-Z][0-9]+$'
      };
      const zodSchema = converter.convert(schema);
      
      expect(zodSchema.parse('A123')).toBe('A123');
      expect(() => zodSchema.parse('a123')).toThrow();
      expect(() => zodSchema.parse('ABC')).toThrow();
    });

    it('should handle string formats', () => {
      const formats = [
        { format: 'email', valid: 'test@example.com', invalid: 'not-an-email' },
        { format: 'uri', valid: 'https://example.com', invalid: 'not a url' },
        { format: 'uuid', valid: '550e8400-e29b-41d4-a716-446655440000', invalid: 'not-a-uuid' },
        { format: 'ipv4', valid: '192.168.1.1', invalid: '999.999.999.999' },
        { format: 'ipv6', valid: '2001:db8::8a2e:370:7334', invalid: 'not-an-ip' }
      ];

      formats.forEach(({ format, valid, invalid }) => {
        const schema = { type: 'string', format };
        const zodSchema = converter.convert(schema);
        
        expect(zodSchema.parse(valid)).toBe(valid);
        expect(() => zodSchema.parse(invalid)).toThrow();
      });
    });
  });

  describe('Number Constraints', () => {
    it('should handle minimum and maximum', () => {
      const schema = {
        type: 'number',
        minimum: 0,
        maximum: 100
      };
      const zodSchema = converter.convert(schema);
      
      expect(zodSchema.parse(0)).toBe(0);
      expect(zodSchema.parse(50)).toBe(50);
      expect(zodSchema.parse(100)).toBe(100);
      expect(() => zodSchema.parse(-1)).toThrow();
      expect(() => zodSchema.parse(101)).toThrow();
    });

    it('should handle exclusiveMinimum and exclusiveMaximum', () => {
      const schema = {
        type: 'number',
        exclusiveMinimum: 0,
        exclusiveMaximum: 100
      };
      const zodSchema = converter.convert(schema);
      
      expect(zodSchema.parse(1)).toBe(1);
      expect(zodSchema.parse(99)).toBe(99);
      expect(() => zodSchema.parse(0)).toThrow();
      expect(() => zodSchema.parse(100)).toThrow();
    });

    it('should handle multipleOf', () => {
      const schema = {
        type: 'integer',
        multipleOf: 5
      };
      const zodSchema = converter.convert(schema);
      
      expect(zodSchema.parse(0)).toBe(0);
      expect(zodSchema.parse(5)).toBe(5);
      expect(zodSchema.parse(15)).toBe(15);
      expect(() => zodSchema.parse(3)).toThrow();
    });
  });

  describe('Arrays', () => {
    it('should convert basic array', () => {
      const schema = { type: 'array' };
      const zodSchema = converter.convert(schema);
      
      expect(zodSchema.parse([])).toEqual([]);
      expect(zodSchema.parse([1, 'two', true])).toEqual([1, 'two', true]);
      expect(() => zodSchema.parse('not-array')).toThrow();
    });

    it('should handle array items schema', () => {
      const schema = {
        type: 'array',
        items: { type: 'number' }
      };
      const zodSchema = converter.convert(schema);
      
      expect(zodSchema.parse([1, 2, 3])).toEqual([1, 2, 3]);
      expect(() => zodSchema.parse([1, 'two', 3])).toThrow();
    });

    it('should handle minItems and maxItems', () => {
      const schema = {
        type: 'array',
        items: { type: 'string' },
        minItems: 2,
        maxItems: 4
      };
      const zodSchema = converter.convert(schema);
      
      expect(zodSchema.parse(['a', 'b'])).toEqual(['a', 'b']);
      expect(zodSchema.parse(['a', 'b', 'c', 'd'])).toEqual(['a', 'b', 'c', 'd']);
      expect(() => zodSchema.parse(['a'])).toThrow();
      expect(() => zodSchema.parse(['a', 'b', 'c', 'd', 'e'])).toThrow();
    });

    it('should handle uniqueItems', () => {
      const schema = {
        type: 'array',
        items: { type: 'number' },
        uniqueItems: true
      };
      const zodSchema = converter.convert(schema);
      
      expect(zodSchema.parse([1, 2, 3])).toEqual([1, 2, 3]);
      expect(() => zodSchema.parse([1, 2, 2, 3])).toThrow();
    });

    it('should handle tuple validation', () => {
      const schema = {
        type: 'array',
        items: [
          { type: 'string' },
          { type: 'number' },
          { type: 'boolean' }
        ],
        additionalItems: false
      };
      const zodSchema = converter.convert(schema);
      
      expect(zodSchema.parse(['hello', 42, true])).toEqual(['hello', 42, true]);
      expect(() => zodSchema.parse(['hello', 42])).toThrow();
      expect(() => zodSchema.parse(['hello', 42, true, 'extra'])).toThrow();
    });
  });

  describe('Objects', () => {
    it('should convert basic object', () => {
      const schema = { type: 'object' };
      const zodSchema = converter.convert(schema);
      
      expect(zodSchema.parse({})).toEqual({});
      expect(zodSchema.parse({ foo: 'bar' })).toEqual({ foo: 'bar' });
      expect(() => zodSchema.parse('not-object')).toThrow();
    });

    it('should handle object properties', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' }
        }
      };
      const zodSchema = converter.convert(schema);
      
      expect(zodSchema.parse({ name: 'John', age: 30 })).toEqual({ name: 'John', age: 30 });
      expect(zodSchema.parse({ name: 'John' })).toEqual({ name: 'John' });
      expect(() => zodSchema.parse({ name: 123 })).toThrow();
    });

    it('should handle required properties', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' }
        },
        required: ['name']
      };
      const zodSchema = converter.convert(schema);
      
      expect(zodSchema.parse({ name: 'John', age: 30 })).toEqual({ name: 'John', age: 30 });
      expect(zodSchema.parse({ name: 'John' })).toEqual({ name: 'John' });
      expect(() => zodSchema.parse({ age: 30 })).toThrow();
    });

    it('should handle additionalProperties', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' }
        },
        additionalProperties: false
      };
      const zodSchema = converter.convert(schema);
      
      expect(zodSchema.parse({ name: 'John' })).toEqual({ name: 'John' });
      expect(() => zodSchema.parse({ name: 'John', extra: 'field' })).toThrow();
    });

    it('should handle additionalProperties with schema', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' }
        },
        additionalProperties: { type: 'number' }
      };
      const zodSchema = converter.convert(schema);
      
      expect(zodSchema.parse({ name: 'John', extra: 42 })).toEqual({ name: 'John', extra: 42 });
      expect(() => zodSchema.parse({ name: 'John', extra: 'string' })).toThrow();
    });

    it('should handle default values', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string', default: 'Anonymous' },
          age: { type: 'number', default: 0 }
        }
      };
      const zodSchema = converter.convert(schema);
      
      expect(zodSchema.parse({})).toEqual({ name: 'Anonymous', age: 0 });
      expect(zodSchema.parse({ name: 'John' })).toEqual({ name: 'John', age: 0 });
    });
  });

  describe('Enum and Const', () => {
    it('should handle enum with strings', () => {
      const schema = {
        type: 'string',
        enum: ['red', 'green', 'blue']
      };
      const zodSchema = converter.convert(schema);
      
      expect(zodSchema.parse('red')).toBe('red');
      expect(zodSchema.parse('blue')).toBe('blue');
      expect(() => zodSchema.parse('yellow')).toThrow();
    });

    it('should handle enum with mixed types', () => {
      const schema = {
        enum: ['string', 42, true, null]
      };
      const zodSchema = converter.convert(schema);
      
      expect(zodSchema.parse('string')).toBe('string');
      expect(zodSchema.parse(42)).toBe(42);
      expect(zodSchema.parse(true)).toBe(true);
      expect(zodSchema.parse(null)).toBe(null);
      expect(() => zodSchema.parse('other')).toThrow();
    });

    it('should handle const', () => {
      const schema = { const: 42 };
      const zodSchema = converter.convert(schema);
      
      expect(zodSchema.parse(42)).toBe(42);
      expect(() => zodSchema.parse(43)).toThrow();
    });
  });

  describe('Combinators', () => {
    it('should handle oneOf', () => {
      const schema = {
        oneOf: [
          { type: 'string' },
          { type: 'number' }
        ]
      };
      const zodSchema = converter.convert(schema);
      
      expect(zodSchema.parse('hello')).toBe('hello');
      expect(zodSchema.parse(42)).toBe(42);
      expect(() => zodSchema.parse(true)).toThrow();
    });

    it('should handle anyOf', () => {
      const schema = {
        anyOf: [
          { type: 'string', minLength: 5 },
          { type: 'number', minimum: 10 }
        ]
      };
      const zodSchema = converter.convert(schema);
      
      expect(zodSchema.parse('hello')).toBe('hello');
      expect(zodSchema.parse(15)).toBe(15);
      expect(() => zodSchema.parse('hi')).toThrow();
      expect(() => zodSchema.parse(5)).toThrow();
    });

    it('should handle allOf', () => {
      const schema = {
        allOf: [
          { type: 'object', properties: { name: { type: 'string' } } },
          { type: 'object', properties: { age: { type: 'number' } } }
        ]
      };
      const zodSchema = converter.convert(schema);
      
      expect(zodSchema.parse({ name: 'John', age: 30 })).toEqual({ name: 'John', age: 30 });
    });

    it('should handle not', () => {
      const schema = {
        not: { type: 'string' }
      };
      const zodSchema = converter.convert(schema);
      
      expect(zodSchema.parse(42)).toBe(42);
      expect(zodSchema.parse(true)).toBe(true);
      expect(() => zodSchema.parse('string')).toThrow();
    });
  });

  describe('References', () => {
    it('should handle $ref to definitions', () => {
      const schema = {
        definitions: {
          person: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              age: { type: 'number' }
            }
          }
        },
        $ref: '#/definitions/person'
      };
      const zodSchema = converter.convert(schema);
      
      expect(zodSchema.parse({ name: 'John', age: 30 })).toEqual({ name: 'John', age: 30 });
    });

    it('should handle nested $ref', () => {
      const schema = {
        definitions: {
          name: { type: 'string' },
          person: {
            type: 'object',
            properties: {
              name: { $ref: '#/definitions/name' },
              friend: { $ref: '#/definitions/person' }
            }
          }
        },
        $ref: '#/definitions/person'
      };
      const zodSchema = converter.convert(schema);
      
      const data = {
        name: 'John',
        friend: {
          name: 'Jane'
        }
      };
      expect(zodSchema.parse(data)).toEqual(data);
    });
  });

  describe('Type Coercion', () => {
    it('should coerce types when enabled', () => {
      const converter = new SchemaConverter({ coerceTypes: true });
      
      const boolSchema = converter.convert({ type: 'boolean' });
      expect(boolSchema.parse('true')).toBe(true);
      expect(boolSchema.parse('false')).toBe(false);
      
      const numberSchema = converter.convert({ type: 'number' });
      expect(numberSchema.parse('42')).toBe(42);
      expect(numberSchema.parse('3.14')).toBe(3.14);
    });
  });

  describe('Helper function', () => {
    it('should work with jsonSchemaToZod helper', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' }
        },
        required: ['name']
      };
      const zodSchema = jsonSchemaToZod(schema);
      
      expect(zodSchema.parse({ name: 'John', age: 30 })).toEqual({ name: 'John', age: 30 });
      expect(() => zodSchema.parse({ age: 30 })).toThrow();
    });
  });
});