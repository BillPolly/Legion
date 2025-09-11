/**
 * PropertyTypeDetector Unit Tests
 * Phase 1, Step 1.4: Property Type Detection
 * 
 * Unit tests for PropertyTypeDetector class that analyzes schema to determine
 * appropriate proxy types for property access on EntityProxy objects.
 * 
 * Determines whether property access should return:
 * - StreamProxy: Scalar attributes (string, number, boolean, etc.)
 * - EntityProxy: Single reference attributes (valueType: 'ref', card: 'one')
 * - CollectionProxy: Many reference attributes (valueType: 'ref', card: 'many')
 * 
 * Tests follow TDD approach - write tests first, implement after.
 * No mocks - use real schema data structures.
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { PropertyTypeDetector } from '../../src/property-type-detector.js';

describe('PropertyTypeDetector Unit Tests', () => {
  let detector;
  let schema;
  
  beforeEach(() => {
    // Comprehensive test schema covering all attribute types
    schema = {
      // Scalar attributes (should return StreamProxy)
      ':user/name': { valueType: 'string' },
      ':user/age': { valueType: 'number' },
      ':user/verified': { valueType: 'boolean' },
      ':user/score': { valueType: 'number' },
      ':user/created-at': { valueType: 'instant' },
      ':user/tags': { valueType: 'string', card: 'many' }, // Many scalars -> CollectionProxy
      
      // Single reference attributes (should return EntityProxy)
      ':user/profile': { valueType: 'ref' },
      ':post/author': { valueType: 'ref' },
      ':order/customer': { valueType: 'ref' },
      
      // Many reference attributes (should return CollectionProxy)
      ':user/friends': { valueType: 'ref', card: 'many' },
      ':post/tags': { valueType: 'ref', card: 'many' },
      ':category/posts': { valueType: 'ref', card: 'many' },
      
      // Unique identity attributes
      ':user/id': { valueType: 'string', unique: 'identity' },
      ':user/email': { valueType: 'string', unique: 'value' },
      
      // Component relationships (owned references)
      ':order/line-items': { valueType: 'ref', card: 'many', component: true },
      ':user/address': { valueType: 'ref', component: true }
    };
    
    detector = new PropertyTypeDetector(schema);
  });

  describe('Constructor and Basic Validation', () => {
    test('should create PropertyTypeDetector with valid schema', () => {
      expect(detector).toBeDefined();
      expect(detector.schema).toBe(schema);
    });
    
    test('should throw error when schema is null or undefined', () => {
      expect(() => new PropertyTypeDetector(null)).toThrow('Schema is required');
      expect(() => new PropertyTypeDetector(undefined)).toThrow('Schema is required');
    });
    
    test('should accept empty schema object', () => {
      const emptyDetector = new PropertyTypeDetector({});
      expect(emptyDetector.schema).toEqual({});
    });
    
    test('should throw error for non-object schema', () => {
      expect(() => new PropertyTypeDetector('invalid')).toThrow('Schema must be an object');
      expect(() => new PropertyTypeDetector(123)).toThrow('Schema must be an object');
      expect(() => new PropertyTypeDetector([])).toThrow('Schema must be an object');
    });
  });

  describe('detectProxyType Method - Main Entry Point', () => {
    test('should throw error for null or undefined attribute', () => {
      expect(() => detector.detectProxyType(null)).toThrow('Attribute name is required');
      expect(() => detector.detectProxyType(undefined)).toThrow('Attribute name is required');
    });
    
    test('should throw error for empty attribute name', () => {
      expect(() => detector.detectProxyType('')).toThrow('Attribute name cannot be empty');
      expect(() => detector.detectProxyType('   ')).toThrow('Attribute name cannot be empty');
    });
    
    test('should throw error for non-string attribute', () => {
      expect(() => detector.detectProxyType(123)).toThrow('Attribute name must be a string');
      expect(() => detector.detectProxyType({})).toThrow('Attribute name must be a string');
      expect(() => detector.detectProxyType([])).toThrow('Attribute name must be a string');
    });
  });

  describe('Scalar Attribute Detection', () => {
    test('should detect StreamProxy for string attributes', () => {
      expect(detector.detectProxyType(':user/name')).toBe('StreamProxy');
    });
    
    test('should detect StreamProxy for number attributes', () => {
      expect(detector.detectProxyType(':user/age')).toBe('StreamProxy');
    });
    
    test('should detect StreamProxy for boolean attributes', () => {
      expect(detector.detectProxyType(':user/verified')).toBe('StreamProxy');
    });
    
    test('should detect StreamProxy for number (float) attributes', () => {
      expect(detector.detectProxyType(':user/score')).toBe('StreamProxy');
    });
    
    test('should detect StreamProxy for instant (date) attributes', () => {
      expect(detector.detectProxyType(':user/created-at')).toBe('StreamProxy');
    });
    
    test('should detect StreamProxy for unique scalar attributes', () => {
      expect(detector.detectProxyType(':user/id')).toBe('StreamProxy');
      expect(detector.detectProxyType(':user/email')).toBe('StreamProxy');
    });
    
    test('should detect CollectionProxy for many scalar attributes', () => {
      expect(detector.detectProxyType(':user/tags')).toBe('CollectionProxy');
    });
  });

  describe('Single Reference Attribute Detection', () => {
    test('should detect EntityProxy for single reference attributes', () => {
      expect(detector.detectProxyType(':user/profile')).toBe('EntityProxy');
      expect(detector.detectProxyType(':post/author')).toBe('EntityProxy');
      expect(detector.detectProxyType(':order/customer')).toBe('EntityProxy');
    });
    
    test('should detect EntityProxy for component references (single)', () => {
      expect(detector.detectProxyType(':user/address')).toBe('EntityProxy');
    });
  });

  describe('Many Reference Attribute Detection', () => {
    test('should detect CollectionProxy for many reference attributes', () => {
      expect(detector.detectProxyType(':user/friends')).toBe('CollectionProxy');
      expect(detector.detectProxyType(':post/tags')).toBe('CollectionProxy');
      expect(detector.detectProxyType(':category/posts')).toBe('CollectionProxy');
    });
    
    test('should detect CollectionProxy for component references (many)', () => {
      expect(detector.detectProxyType(':order/line-items')).toBe('CollectionProxy');
    });
  });

  describe('Unknown Attribute Handling', () => {
    test('should return StreamProxy for unknown attributes (default)', () => {
      expect(detector.detectProxyType(':unknown/attribute')).toBe('StreamProxy');
      expect(detector.detectProxyType(':missing/field')).toBe('StreamProxy');
      expect(detector.detectProxyType(':nonexistent/property')).toBe('StreamProxy');
    });
    
    test('should not throw error for unknown attributes', () => {
      expect(() => detector.detectProxyType(':unknown/field')).not.toThrow();
    });
  });

  describe('isScalarAttribute Method', () => {
    test('should return true for scalar attributes', () => {
      expect(detector.isScalarAttribute(':user/name')).toBe(true);
      expect(detector.isScalarAttribute(':user/age')).toBe(true);
      expect(detector.isScalarAttribute(':user/verified')).toBe(true);
      expect(detector.isScalarAttribute(':user/score')).toBe(true);
      expect(detector.isScalarAttribute(':user/created-at')).toBe(true);
    });
    
    test('should return false for reference attributes', () => {
      expect(detector.isScalarAttribute(':user/profile')).toBe(false);
      expect(detector.isScalarAttribute(':user/friends')).toBe(false);
      expect(detector.isScalarAttribute(':post/author')).toBe(false);
      expect(detector.isScalarAttribute(':post/tags')).toBe(false);
    });
    
    test('should return true for unknown attributes (default scalar)', () => {
      expect(detector.isScalarAttribute(':unknown/attribute')).toBe(true);
    });
  });

  describe('isReferenceAttribute Method', () => {
    test('should return true for reference attributes', () => {
      expect(detector.isReferenceAttribute(':user/profile')).toBe(true);
      expect(detector.isReferenceAttribute(':user/friends')).toBe(true);
      expect(detector.isReferenceAttribute(':post/author')).toBe(true);
      expect(detector.isReferenceAttribute(':post/tags')).toBe(true);
      expect(detector.isReferenceAttribute(':user/address')).toBe(true);
      expect(detector.isReferenceAttribute(':order/line-items')).toBe(true);
    });
    
    test('should return false for scalar attributes', () => {
      expect(detector.isReferenceAttribute(':user/name')).toBe(false);
      expect(detector.isReferenceAttribute(':user/age')).toBe(false);
      expect(detector.isReferenceAttribute(':user/verified')).toBe(false);
      expect(detector.isReferenceAttribute(':user/tags')).toBe(false); // Many scalars
    });
    
    test('should return false for unknown attributes (default scalar)', () => {
      expect(detector.isReferenceAttribute(':unknown/attribute')).toBe(false);
    });
  });

  describe('isManyAttribute Method', () => {
    test('should return true for many cardinality attributes', () => {
      expect(detector.isManyAttribute(':user/friends')).toBe(true);
      expect(detector.isManyAttribute(':post/tags')).toBe(true);
      expect(detector.isManyAttribute(':category/posts')).toBe(true);
      expect(detector.isManyAttribute(':user/tags')).toBe(true); // Many scalars
      expect(detector.isManyAttribute(':order/line-items')).toBe(true);
    });
    
    test('should return false for single cardinality attributes', () => {
      expect(detector.isManyAttribute(':user/name')).toBe(false);
      expect(detector.isManyAttribute(':user/profile')).toBe(false);
      expect(detector.isManyAttribute(':post/author')).toBe(false);
      expect(detector.isManyAttribute(':user/address')).toBe(false);
    });
    
    test('should return false for unknown attributes (default single)', () => {
      expect(detector.isManyAttribute(':unknown/attribute')).toBe(false);
    });
  });

  describe('isComponentAttribute Method', () => {
    test('should return true for component attributes', () => {
      expect(detector.isComponentAttribute(':user/address')).toBe(true);
      expect(detector.isComponentAttribute(':order/line-items')).toBe(true);
    });
    
    test('should return false for non-component attributes', () => {
      expect(detector.isComponentAttribute(':user/profile')).toBe(false);
      expect(detector.isComponentAttribute(':user/friends')).toBe(false);
      expect(detector.isComponentAttribute(':post/author')).toBe(false);
      expect(detector.isComponentAttribute(':user/name')).toBe(false);
    });
    
    test('should return false for unknown attributes', () => {
      expect(detector.isComponentAttribute(':unknown/attribute')).toBe(false);
    });
  });

  describe('isUniqueAttribute Method', () => {
    test('should return true for unique attributes', () => {
      expect(detector.isUniqueAttribute(':user/id')).toBe(true);
      expect(detector.isUniqueAttribute(':user/email')).toBe(true);
    });
    
    test('should return false for non-unique attributes', () => {
      expect(detector.isUniqueAttribute(':user/name')).toBe(false);
      expect(detector.isUniqueAttribute(':user/profile')).toBe(false);
      expect(detector.isUniqueAttribute(':user/friends')).toBe(false);
    });
    
    test('should return false for unknown attributes', () => {
      expect(detector.isUniqueAttribute(':unknown/attribute')).toBe(false);
    });
  });

  describe('getValueType Method', () => {
    test('should return correct value types for scalar attributes', () => {
      expect(detector.getValueType(':user/name')).toBe('string');
      expect(detector.getValueType(':user/age')).toBe('number');
      expect(detector.getValueType(':user/verified')).toBe('boolean');
      expect(detector.getValueType(':user/score')).toBe('number');
      expect(detector.getValueType(':user/created-at')).toBe('instant');
    });
    
    test('should return "ref" for reference attributes', () => {
      expect(detector.getValueType(':user/profile')).toBe('ref');
      expect(detector.getValueType(':user/friends')).toBe('ref');
      expect(detector.getValueType(':post/author')).toBe('ref');
      expect(detector.getValueType(':post/tags')).toBe('ref');
    });
    
    test('should return "unknown" for unknown attributes', () => {
      expect(detector.getValueType(':unknown/attribute')).toBe('unknown');
    });
  });

  describe('getCardinality Method', () => {
    test('should return "many" for many cardinality attributes', () => {
      expect(detector.getCardinality(':user/friends')).toBe('many');
      expect(detector.getCardinality(':post/tags')).toBe('many');
      expect(detector.getCardinality(':user/tags')).toBe('many');
      expect(detector.getCardinality(':order/line-items')).toBe('many');
    });
    
    test('should return "one" for single cardinality attributes', () => {
      expect(detector.getCardinality(':user/name')).toBe('one');
      expect(detector.getCardinality(':user/profile')).toBe('one');
      expect(detector.getCardinality(':post/author')).toBe('one');
      expect(detector.getCardinality(':user/address')).toBe('one');
    });
    
    test('should return "one" for unknown attributes (default)', () => {
      expect(detector.getCardinality(':unknown/attribute')).toBe('one');
    });
  });

  describe('analyzeAttribute Method - Comprehensive Analysis', () => {
    test('should provide complete analysis for scalar attributes', () => {
      const analysis = detector.analyzeAttribute(':user/name');
      
      expect(analysis).toEqual({
        attribute: ':user/name',
        valueType: 'string',
        cardinality: 'one',
        isReference: false,
        isScalar: true,
        isMany: false,
        isUnique: false,
        isComponent: false,
        proxyType: 'StreamProxy'
      });
    });
    
    test('should provide complete analysis for single reference attributes', () => {
      const analysis = detector.analyzeAttribute(':user/profile');
      
      expect(analysis).toEqual({
        attribute: ':user/profile',
        valueType: 'ref',
        cardinality: 'one',
        isReference: true,
        isScalar: false,
        isMany: false,
        isUnique: false,
        isComponent: false,
        proxyType: 'EntityProxy'
      });
    });
    
    test('should provide complete analysis for many reference attributes', () => {
      const analysis = detector.analyzeAttribute(':user/friends');
      
      expect(analysis).toEqual({
        attribute: ':user/friends',
        valueType: 'ref',
        cardinality: 'many',
        isReference: true,
        isScalar: false,
        isMany: true,
        isUnique: false,
        isComponent: false,
        proxyType: 'CollectionProxy'
      });
    });
    
    test('should provide complete analysis for many scalar attributes', () => {
      const analysis = detector.analyzeAttribute(':user/tags');
      
      expect(analysis).toEqual({
        attribute: ':user/tags',
        valueType: 'string',
        cardinality: 'many',
        isReference: false,
        isScalar: true,
        isMany: true,
        isUnique: false,
        isComponent: false,
        proxyType: 'CollectionProxy'
      });
    });
    
    test('should provide complete analysis for unique attributes', () => {
      const analysis = detector.analyzeAttribute(':user/id');
      
      expect(analysis).toEqual({
        attribute: ':user/id',
        valueType: 'string',
        cardinality: 'one',
        isReference: false,
        isScalar: true,
        isMany: false,
        isUnique: true,
        isComponent: false,
        proxyType: 'StreamProxy'
      });
    });
    
    test('should provide complete analysis for component attributes', () => {
      const analysis = detector.analyzeAttribute(':order/line-items');
      
      expect(analysis).toEqual({
        attribute: ':order/line-items',
        valueType: 'ref',
        cardinality: 'many',
        isReference: true,
        isScalar: false,
        isMany: true,
        isUnique: false,
        isComponent: true,
        proxyType: 'CollectionProxy'
      });
    });
    
    test('should provide default analysis for unknown attributes', () => {
      const analysis = detector.analyzeAttribute(':unknown/field');
      
      expect(analysis).toEqual({
        attribute: ':unknown/field',
        valueType: 'unknown',
        cardinality: 'one',
        isReference: false,
        isScalar: true,
        isMany: false,
        isUnique: false,
        isComponent: false,
        proxyType: 'StreamProxy'
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle malformed schema entries gracefully', () => {
      const malformedSchema = {
        ':valid/attr': { valueType: 'string' },
        ':malformed/attr1': null,
        ':malformed/attr2': undefined,
        ':malformed/attr3': 'invalid-string',
        ':malformed/attr4': 123,
        ':malformed/attr5': []
      };
      
      const malformedDetector = new PropertyTypeDetector(malformedSchema);
      
      // Should default to StreamProxy for malformed entries
      expect(malformedDetector.detectProxyType(':malformed/attr1')).toBe('StreamProxy');
      expect(malformedDetector.detectProxyType(':malformed/attr2')).toBe('StreamProxy');
      expect(malformedDetector.detectProxyType(':malformed/attr3')).toBe('StreamProxy');
      expect(malformedDetector.detectProxyType(':malformed/attr4')).toBe('StreamProxy');
      expect(malformedDetector.detectProxyType(':malformed/attr5')).toBe('StreamProxy');
      
      // Valid entry should work normally
      expect(malformedDetector.detectProxyType(':valid/attr')).toBe('StreamProxy');
    });
    
    test('should handle attributes with partial schema definitions', () => {
      const partialSchema = {
        ':partial1/attr': {}, // Empty object
        ':partial2/attr': { valueType: 'ref' }, // Missing card
        ':partial3/attr': { card: 'many' }, // Missing valueType
        ':partial4/attr': { unique: 'identity' }, // Only unique
        ':partial5/attr': { component: true } // Only component
      };
      
      const partialDetector = new PropertyTypeDetector(partialSchema);
      
      // Empty schema object should default to StreamProxy
      expect(partialDetector.detectProxyType(':partial1/attr')).toBe('StreamProxy');
      
      // Reference without cardinality should default to EntityProxy
      expect(partialDetector.detectProxyType(':partial2/attr')).toBe('EntityProxy');
      
      // Many without valueType should assume scalar -> CollectionProxy
      expect(partialDetector.detectProxyType(':partial3/attr')).toBe('CollectionProxy');
      
      // Unique only should default to StreamProxy
      expect(partialDetector.detectProxyType(':partial4/attr')).toBe('StreamProxy');
      
      // Component only should default to StreamProxy (no valueType=ref)
      expect(partialDetector.detectProxyType(':partial5/attr')).toBe('StreamProxy');
    });
    
    test('should handle very large schemas efficiently', () => {
      const largeSchema = {};
      
      // Create 1000 attributes
      for (let i = 0; i < 1000; i++) {
        largeSchema[`:attr${i}/field`] = { valueType: i % 2 === 0 ? 'string' : 'ref' };
      }
      
      const largeDetector = new PropertyTypeDetector(largeSchema);
      
      const startTime = Date.now();
      
      // Test detection on various attributes
      for (let i = 0; i < 100; i++) {
        const result = largeDetector.detectProxyType(`:attr${i}/field`);
        expect(['StreamProxy', 'EntityProxy']).toContain(result);
      }
      
      const endTime = Date.now();
      
      // Should be very fast (< 50ms for 100 detections)
      expect(endTime - startTime).toBeLessThan(50);
    });
  });

  describe('Performance and Caching', () => {
    test('should perform attribute analysis quickly', () => {
      const startTime = Date.now();
      
      // Perform 100 detections
      for (let i = 0; i < 100; i++) {
        detector.detectProxyType(':user/name');
        detector.detectProxyType(':user/friends');
        detector.detectProxyType(':post/author');
      }
      
      const endTime = Date.now();
      
      // Should complete quickly (< 20ms)
      expect(endTime - startTime).toBeLessThan(20);
    });
    
    test('should handle repeated calls efficiently', () => {
      const attribute = ':user/profile';
      
      const startTime = Date.now();
      
      // Call same attribute 1000 times
      for (let i = 0; i < 1000; i++) {
        const result = detector.detectProxyType(attribute);
        expect(result).toBe('EntityProxy');
      }
      
      const endTime = Date.now();
      
      // Should be very fast even with repeated calls (< 50ms)
      expect(endTime - startTime).toBeLessThan(50);
    });
  });
});