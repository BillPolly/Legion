/**
 * Unit tests for RDFTypeMapper
 */

import { describe, it, expect } from '@jest/globals';
import { RDFTypeMapper } from '../../src/RDFTypeMapper.js';

describe('RDFTypeMapper', () => {
  describe('jsTypeToRDF()', () => {
    describe('String types', () => {
      it('should map string to xsd:string', () => {
        const result = RDFTypeMapper.jsTypeToRDF('hello');
        expect(result).toEqual({
          value: 'hello',
          datatype: 'http://www.w3.org/2001/XMLSchema#string'
        });
      });

      it('should handle empty string', () => {
        const result = RDFTypeMapper.jsTypeToRDF('');
        expect(result).toEqual({
          value: '',
          datatype: 'http://www.w3.org/2001/XMLSchema#string'
        });
      });

      it('should handle strings with special characters', () => {
        const result = RDFTypeMapper.jsTypeToRDF('Hello\nWorld\t!');
        expect(result.value).toBe('Hello\nWorld\t!');
        expect(result.datatype).toBe('http://www.w3.org/2001/XMLSchema#string');
      });
    });

    describe('Number types', () => {
      it('should map integer to xsd:integer', () => {
        const result = RDFTypeMapper.jsTypeToRDF(42);
        expect(result).toEqual({
          value: '42',
          datatype: 'http://www.w3.org/2001/XMLSchema#integer'
        });
      });

      it('should map float to xsd:decimal', () => {
        const result = RDFTypeMapper.jsTypeToRDF(3.14);
        expect(result).toEqual({
          value: '3.14',
          datatype: 'http://www.w3.org/2001/XMLSchema#decimal'
        });
      });

      it('should map negative integer to xsd:integer', () => {
        const result = RDFTypeMapper.jsTypeToRDF(-123);
        expect(result).toEqual({
          value: '-123',
          datatype: 'http://www.w3.org/2001/XMLSchema#integer'
        });
      });

      it('should map zero to xsd:integer', () => {
        const result = RDFTypeMapper.jsTypeToRDF(0);
        expect(result).toEqual({
          value: '0',
          datatype: 'http://www.w3.org/2001/XMLSchema#integer'
        });
      });

      it('should map large numbers correctly', () => {
        const result = RDFTypeMapper.jsTypeToRDF(999999999);
        expect(result).toEqual({
          value: '999999999',
          datatype: 'http://www.w3.org/2001/XMLSchema#integer'
        });
      });
    });

    describe('Boolean types', () => {
      it('should map true to xsd:boolean', () => {
        const result = RDFTypeMapper.jsTypeToRDF(true);
        expect(result).toEqual({
          value: 'true',
          datatype: 'http://www.w3.org/2001/XMLSchema#boolean'
        });
      });

      it('should map false to xsd:boolean', () => {
        const result = RDFTypeMapper.jsTypeToRDF(false);
        expect(result).toEqual({
          value: 'false',
          datatype: 'http://www.w3.org/2001/XMLSchema#boolean'
        });
      });
    });

    describe('Date types', () => {
      it('should map Date to xsd:dateTime', () => {
        const date = new Date('2024-01-15T10:30:00Z');
        const result = RDFTypeMapper.jsTypeToRDF(date);
        expect(result).toEqual({
          value: '2024-01-15T10:30:00.000Z',
          datatype: 'http://www.w3.org/2001/XMLSchema#dateTime'
        });
      });

      it('should handle different date formats', () => {
        const date = new Date('2024-12-25T00:00:00Z');
        const result = RDFTypeMapper.jsTypeToRDF(date);
        expect(result.datatype).toBe('http://www.w3.org/2001/XMLSchema#dateTime');
        expect(result.value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      });
    });

    describe('Null and undefined', () => {
      it('should return null for null', () => {
        const result = RDFTypeMapper.jsTypeToRDF(null);
        expect(result).toBe(null);
      });

      it('should return null for undefined', () => {
        const result = RDFTypeMapper.jsTypeToRDF(undefined);
        expect(result).toBe(null);
      });
    });

    describe('Unsupported types', () => {
      it('should throw for objects', () => {
        expect(() => RDFTypeMapper.jsTypeToRDF({ foo: 'bar' })).toThrow();
      });

      it('should throw for arrays', () => {
        expect(() => RDFTypeMapper.jsTypeToRDF([1, 2, 3])).toThrow();
      });

      it('should throw for functions', () => {
        expect(() => RDFTypeMapper.jsTypeToRDF(() => {})).toThrow();
      });
    });
  });

  describe('rdfToJSType()', () => {
    describe('String types', () => {
      it('should map xsd:string to JS string', () => {
        const rdfLiteral = {
          value: 'hello',
          datatype: 'http://www.w3.org/2001/XMLSchema#string'
        };
        const result = RDFTypeMapper.rdfToJSType(rdfLiteral);
        expect(result).toBe('hello');
        expect(typeof result).toBe('string');
      });

      it('should handle empty string', () => {
        const rdfLiteral = {
          value: '',
          datatype: 'http://www.w3.org/2001/XMLSchema#string'
        };
        const result = RDFTypeMapper.rdfToJSType(rdfLiteral);
        expect(result).toBe('');
      });
    });

    describe('Number types', () => {
      it('should map xsd:integer to JS number', () => {
        const rdfLiteral = {
          value: '42',
          datatype: 'http://www.w3.org/2001/XMLSchema#integer'
        };
        const result = RDFTypeMapper.rdfToJSType(rdfLiteral);
        expect(result).toBe(42);
        expect(typeof result).toBe('number');
        expect(Number.isInteger(result)).toBe(true);
      });

      it('should map xsd:decimal to JS number', () => {
        const rdfLiteral = {
          value: '3.14',
          datatype: 'http://www.w3.org/2001/XMLSchema#decimal'
        };
        const result = RDFTypeMapper.rdfToJSType(rdfLiteral);
        expect(result).toBe(3.14);
        expect(typeof result).toBe('number');
      });

      it('should map xsd:float to JS number', () => {
        const rdfLiteral = {
          value: '2.5',
          datatype: 'http://www.w3.org/2001/XMLSchema#float'
        };
        const result = RDFTypeMapper.rdfToJSType(rdfLiteral);
        expect(result).toBe(2.5);
      });

      it('should map xsd:double to JS number', () => {
        const rdfLiteral = {
          value: '1.23',
          datatype: 'http://www.w3.org/2001/XMLSchema#double'
        };
        const result = RDFTypeMapper.rdfToJSType(rdfLiteral);
        expect(result).toBe(1.23);
      });

      it('should handle negative numbers', () => {
        const rdfLiteral = {
          value: '-123',
          datatype: 'http://www.w3.org/2001/XMLSchema#integer'
        };
        const result = RDFTypeMapper.rdfToJSType(rdfLiteral);
        expect(result).toBe(-123);
      });
    });

    describe('Boolean types', () => {
      it('should map xsd:boolean true to JS boolean', () => {
        const rdfLiteral = {
          value: 'true',
          datatype: 'http://www.w3.org/2001/XMLSchema#boolean'
        };
        const result = RDFTypeMapper.rdfToJSType(rdfLiteral);
        expect(result).toBe(true);
        expect(typeof result).toBe('boolean');
      });

      it('should map xsd:boolean false to JS boolean', () => {
        const rdfLiteral = {
          value: 'false',
          datatype: 'http://www.w3.org/2001/XMLSchema#boolean'
        };
        const result = RDFTypeMapper.rdfToJSType(rdfLiteral);
        expect(result).toBe(false);
        expect(typeof result).toBe('boolean');
      });

      it('should handle 1 as true', () => {
        const rdfLiteral = {
          value: '1',
          datatype: 'http://www.w3.org/2001/XMLSchema#boolean'
        };
        const result = RDFTypeMapper.rdfToJSType(rdfLiteral);
        expect(result).toBe(true);
      });

      it('should handle 0 as false', () => {
        const rdfLiteral = {
          value: '0',
          datatype: 'http://www.w3.org/2001/XMLSchema#boolean'
        };
        const result = RDFTypeMapper.rdfToJSType(rdfLiteral);
        expect(result).toBe(false);
      });
    });

    describe('Date types', () => {
      it('should map xsd:dateTime to JS Date', () => {
        const rdfLiteral = {
          value: '2024-01-15T10:30:00.000Z',
          datatype: 'http://www.w3.org/2001/XMLSchema#dateTime'
        };
        const result = RDFTypeMapper.rdfToJSType(rdfLiteral);
        expect(result).toBeInstanceOf(Date);
        expect(result.toISOString()).toBe('2024-01-15T10:30:00.000Z');
      });

      it('should handle various date formats', () => {
        const rdfLiteral = {
          value: '2024-12-25',
          datatype: 'http://www.w3.org/2001/XMLSchema#dateTime'
        };
        const result = RDFTypeMapper.rdfToJSType(rdfLiteral);
        expect(result).toBeInstanceOf(Date);
      });
    });

    describe('Null and undefined', () => {
      it('should return null for null', () => {
        const result = RDFTypeMapper.rdfToJSType(null);
        expect(result).toBe(null);
      });

      it('should return null for undefined', () => {
        const result = RDFTypeMapper.rdfToJSType(undefined);
        expect(result).toBe(null);
      });
    });

    describe('Unknown types', () => {
      it('should return string value for unknown datatype', () => {
        const rdfLiteral = {
          value: 'custom',
          datatype: 'http://example.org/customType'
        };
        const result = RDFTypeMapper.rdfToJSType(rdfLiteral);
        expect(result).toBe('custom');
      });

      it('should handle missing datatype', () => {
        const rdfLiteral = {
          value: 'no-datatype'
        };
        const result = RDFTypeMapper.rdfToJSType(rdfLiteral);
        expect(result).toBe('no-datatype');
      });
    });
  });

  describe('Type preservation round-trips', () => {
    it('should preserve string through round-trip', () => {
      const original = 'Hello World';
      const rdf = RDFTypeMapper.jsTypeToRDF(original);
      const restored = RDFTypeMapper.rdfToJSType(rdf);
      expect(restored).toBe(original);
      expect(typeof restored).toBe('string');
    });

    it('should preserve integer through round-trip', () => {
      const original = 42;
      const rdf = RDFTypeMapper.jsTypeToRDF(original);
      const restored = RDFTypeMapper.rdfToJSType(rdf);
      expect(restored).toBe(original);
      expect(typeof restored).toBe('number');
      expect(Number.isInteger(restored)).toBe(true);
    });

    it('should preserve float through round-trip', () => {
      const original = 3.14;
      const rdf = RDFTypeMapper.jsTypeToRDF(original);
      const restored = RDFTypeMapper.rdfToJSType(rdf);
      expect(restored).toBeCloseTo(original, 10);
      expect(typeof restored).toBe('number');
    });

    it('should preserve boolean true through round-trip', () => {
      const original = true;
      const rdf = RDFTypeMapper.jsTypeToRDF(original);
      const restored = RDFTypeMapper.rdfToJSType(rdf);
      expect(restored).toBe(original);
      expect(typeof restored).toBe('boolean');
    });

    it('should preserve boolean false through round-trip', () => {
      const original = false;
      const rdf = RDFTypeMapper.jsTypeToRDF(original);
      const restored = RDFTypeMapper.rdfToJSType(rdf);
      expect(restored).toBe(original);
      expect(typeof restored).toBe('boolean');
    });

    it('should preserve Date through round-trip', () => {
      const original = new Date('2024-01-15T10:30:00Z');
      const rdf = RDFTypeMapper.jsTypeToRDF(original);
      const restored = RDFTypeMapper.rdfToJSType(rdf);
      expect(restored).toBeInstanceOf(Date);
      expect(restored.toISOString()).toBe(original.toISOString());
    });

    it('should handle multiple round-trips', () => {
      const original = 'test';
      const rdf1 = RDFTypeMapper.jsTypeToRDF(original);
      const js1 = RDFTypeMapper.rdfToJSType(rdf1);
      const rdf2 = RDFTypeMapper.jsTypeToRDF(js1);
      const js2 = RDFTypeMapper.rdfToJSType(rdf2);
      expect(js2).toBe(original);
    });
  });
});