/**
 * Tests for SchemaVocabulary class
 */

import { SchemaVocabulary } from '../../../../src/schema/core/SchemaVocabulary.js';
import { InMemoryTripleStore } from '@legion/kg-storage-memory';
import { KGEngine } from '../../../../src/core/KGEngine.js';

describe('SchemaVocabulary', () => {
  let kg;
  let vocabulary;

  beforeEach(() => {
    const store = new InMemoryTripleStore();
    kg = new KGEngine(store);
    vocabulary = new SchemaVocabulary(kg);
  });

  describe('constructor', () => {
    test('should create vocabulary with KG engine', () => {
      expect(vocabulary.kg).toBe(kg);
      expect(vocabulary.initialized).toBe(false);
    });
  });

  describe('initialize', () => {
    test('should initialize vocabulary triples', async () => {
      await vocabulary.initialize();
      
      expect(vocabulary.initialized).toBe(true);
      
      // Check that core vocabulary terms exist
      const schemaTriples = kg.query('kg:Schema', 'rdf:type', 'rdfs:Class');
      expect(schemaTriples).toHaveLength(1);
      
      const propertyTriples = kg.query('kg:Property', 'rdf:type', 'rdfs:Class');
      expect(propertyTriples).toHaveLength(1);
    });

    test('should not reinitialize if already initialized', async () => {
      await vocabulary.initialize();
      const initialSize = await kg.size();
      
      await vocabulary.initialize();
      const finalSize = await kg.size();
      
      expect(finalSize).toBe(initialSize);
    });
  });

  describe('getVocabularyTriples', () => {
    test('should return all vocabulary triples', () => {
      const triples = vocabulary.getVocabularyTriples();
      
      expect(Array.isArray(triples)).toBe(true);
      expect(triples.length).toBeGreaterThan(0);
      
      // Check structure of triples
      triples.forEach(triple => {
        expect(Array.isArray(triple)).toBe(true);
        expect(triple).toHaveLength(3);
      });
    });

    test('should include core types', () => {
      const triples = vocabulary.getVocabularyTriples();
      
      // Check for essential vocabulary terms
      const hasSchemaClass = triples.some(([s, p, o]) => 
        s === 'kg:Schema' && p === 'rdf:type' && o === 'rdfs:Class'
      );
      expect(hasSchemaClass).toBe(true);
      
      const hasPropertyClass = triples.some(([s, p, o]) => 
        s === 'kg:Property' && p === 'rdf:type' && o === 'rdfs:Class'
      );
      expect(hasPropertyClass).toBe(true);
    });
  });

  describe('getCoreTypes', () => {
    test('should return core type definitions', () => {
      const coreTypes = vocabulary.getCoreTypes();
      
      expect(Array.isArray(coreTypes)).toBe(true);
      expect(coreTypes.length).toBeGreaterThan(0);
      
      // Check for specific core types
      const hasSchema = coreTypes.some(([s, p, o]) => 
        s === 'kg:Schema' && p === 'rdf:type' && o === 'rdfs:Class'
      );
      expect(hasSchema).toBe(true);
    });
  });

  describe('getDataTypes', () => {
    test('should return data type definitions', () => {
      const dataTypes = vocabulary.getDataTypes();
      
      expect(Array.isArray(dataTypes)).toBe(true);
      expect(dataTypes.length).toBeGreaterThan(0);
      
      // Check for primitive types
      const hasStringType = dataTypes.some(([s, p, o]) => 
        s === 'kg:StringType' && p === 'rdf:type' && o === 'kg:DataType'
      );
      expect(hasStringType).toBe(true);
      
      const hasNumberType = dataTypes.some(([s, p, o]) => 
        s === 'kg:NumberType' && p === 'rdf:type' && o === 'kg:DataType'
      );
      expect(hasNumberType).toBe(true);
    });

    test('should include type hierarchy', () => {
      const dataTypes = vocabulary.getDataTypes();
      
      // Integer should be subclass of Number
      const hasIntegerHierarchy = dataTypes.some(([s, p, o]) => 
        s === 'kg:IntegerType' && p === 'rdfs:subClassOf' && o === 'kg:NumberType'
      );
      expect(hasIntegerHierarchy).toBe(true);
    });
  });

  describe('getSchemaProperties', () => {
    test('should return schema property definitions', () => {
      const properties = vocabulary.getSchemaProperties();
      
      expect(Array.isArray(properties)).toBe(true);
      expect(properties.length).toBeGreaterThan(0);
      
      // Check for essential properties
      const hasPropertyProp = properties.some(([s, p, o]) => 
        s === 'kg:hasProperty' && p === 'rdf:type' && o === 'rdf:Property'
      );
      expect(hasPropertyProp).toBe(true);
    });
  });

  describe('getConstraintProperties', () => {
    test('should return constraint property definitions', () => {
      const constraints = vocabulary.getConstraintProperties();
      
      expect(Array.isArray(constraints)).toBe(true);
      expect(constraints.length).toBeGreaterThan(0);
      
      // Check for string constraints
      const hasMinLength = constraints.some(([s, p, o]) => 
        s === 'kg:minLength' && p === 'rdf:type' && o === 'rdf:Property'
      );
      expect(hasMinLength).toBe(true);
      
      // Check for numeric constraints
      const hasMinimum = constraints.some(([s, p, o]) => 
        s === 'kg:minimum' && p === 'rdf:type' && o === 'rdf:Property'
      );
      expect(hasMinimum).toBe(true);
    });
  });

  describe('getCompositionProperties', () => {
    test('should return composition property definitions', () => {
      const composition = vocabulary.getCompositionProperties();
      
      expect(Array.isArray(composition)).toBe(true);
      expect(composition.length).toBeGreaterThan(0);
      
      // Check for composition properties
      const hasAllOf = composition.some(([s, p, o]) => 
        s === 'kg:allOf' && p === 'rdf:type' && o === 'rdf:Property'
      );
      expect(hasAllOf).toBe(true);
      
      const hasOneOf = composition.some(([s, p, o]) => 
        s === 'kg:oneOf' && p === 'rdf:type' && o === 'rdf:Property'
      );
      expect(hasOneOf).toBe(true);
    });
  });

  describe('getValidationProperties', () => {
    test('should return validation property definitions', () => {
      const validation = vocabulary.getValidationProperties();
      
      expect(Array.isArray(validation)).toBe(true);
      expect(validation.length).toBeGreaterThan(0);
      
      // Check for validation properties
      const hasIsValid = validation.some(([s, p, o]) => 
        s === 'kg:isValid' && p === 'rdf:type' && o === 'rdf:Property'
      );
      expect(hasIsValid).toBe(true);
    });
  });

  describe('getNamespacePrefixes', () => {
    test('should return namespace prefixes', () => {
      const prefixes = vocabulary.getNamespacePrefixes();
      
      expect(typeof prefixes).toBe('object');
      expect(prefixes.kg).toBeDefined();
      expect(prefixes.rdf).toBeDefined();
      expect(prefixes.rdfs).toBeDefined();
      expect(prefixes.xsd).toBeDefined();
    });
  });

  describe('getTerm', () => {
    test('should return full URI for prefixed terms', () => {
      const term = vocabulary.getTerm('kg:Schema');
      expect(term).toBe('http://example.org/kg#Schema');
    });

    test('should return kg namespace for unprefixed terms', () => {
      const term = vocabulary.getTerm('Schema');
      expect(term).toBe('http://example.org/kg#Schema');
    });

    test('should handle unknown prefixes', () => {
      const term = vocabulary.getTerm('unknown:term');
      expect(term).toBe('http://example.org/kg#unknown:term');
    });
  });

  describe('isInitialized', () => {
    test('should return false before initialization', () => {
      expect(vocabulary.isInitialized()).toBe(false);
    });

    test('should return true after initialization', async () => {
      await vocabulary.initialize();
      expect(vocabulary.isInitialized()).toBe(true);
    });
  });

  describe('validateVocabulary', () => {
    test('should validate that required terms exist', async () => {
      await vocabulary.initialize();
      
      const isValid = await vocabulary.validateVocabulary();
      expect(isValid).toBe(true);
    });

    test('should throw error if required terms are missing', async () => {
      // Don't initialize vocabulary
      
      await expect(vocabulary.validateVocabulary()).rejects.toThrow('Missing vocabulary terms');
    });
  });

  describe('integration', () => {
    test('should work with KG engine synchronous API', () => {
      const syncVocabulary = new SchemaVocabulary(kg);
      
      // Test synchronous initialization
      expect(() => {
        syncVocabulary.initialize();
      }).not.toThrow();
    });

    test('should handle large vocabulary without performance issues', async () => {
      const startTime = Date.now();
      
      await vocabulary.initialize();
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should initialize in reasonable time (less than 1 second)
      expect(duration).toBeLessThan(1000);
    });

    test('should maintain vocabulary integrity', async () => {
      await vocabulary.initialize();
      
      // Check that all vocabulary terms have proper structure
      const allTriples = vocabulary.getVocabularyTriples();
      
      allTriples.forEach(([subject, predicate, object]) => {
        expect(typeof subject).toBe('string');
        expect(typeof predicate).toBe('string');
        expect(typeof object).toBe('string');
        expect(subject.length).toBeGreaterThan(0);
        expect(predicate.length).toBeGreaterThan(0);
        expect(object.length).toBeGreaterThan(0);
      });
    });
  });
});
