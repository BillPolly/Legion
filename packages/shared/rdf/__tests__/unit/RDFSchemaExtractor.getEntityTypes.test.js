/**
 * Unit tests for RDFSchemaExtractor.getEntityTypes()
 * 
 * Tests extraction of entity types from RDF ontologies:
 * - Extract rdf:type definitions
 * - Extract owl:Class definitions
 * - Extract rdfs:Class definitions
 * - Handle multiple types
 * - Filter out non-class entities
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { RDFSchemaExtractor } from '../../src/RDFSchemaExtractor.js';
import { NamespaceManager } from '../../src/NamespaceManager.js';
import { SimpleTripleStore } from '../../src/SimpleTripleStore.js';

describe('RDFSchemaExtractor.getEntityTypes()', () => {
  let schemaExtractor;
  let tripleStore;
  let namespaceManager;

  beforeEach(() => {
    tripleStore = new SimpleTripleStore();
    namespaceManager = new NamespaceManager();
    
    // Add common namespaces
    namespaceManager.addNamespace('ex', 'http://example.org/');
    namespaceManager.addNamespace('myonto', 'http://myonto.example.com/');
    
    schemaExtractor = new RDFSchemaExtractor(tripleStore, namespaceManager);
  });

  describe('Basic owl:Class extraction', () => {
    it('should extract single owl:Class definition', () => {
      // Add ontology triple: ex:Person a owl:Class
      tripleStore.add('ex:Person', 'rdf:type', 'owl:Class');
      
      const types = schemaExtractor.getEntityTypes();
      
      expect(types).toHaveLength(1);
      expect(types).toContain('http://example.org/Person');
    });

    it('should extract multiple owl:Class definitions', () => {
      tripleStore.add('ex:Person', 'rdf:type', 'owl:Class');
      tripleStore.add('ex:Organization', 'rdf:type', 'owl:Class');
      tripleStore.add('ex:Document', 'rdf:type', 'owl:Class');
      
      const types = schemaExtractor.getEntityTypes();
      
      expect(types).toHaveLength(3);
      expect(types).toContain('http://example.org/Person');
      expect(types).toContain('http://example.org/Organization');
      expect(types).toContain('http://example.org/Document');
    });

    it('should handle full URIs for owl:Class', () => {
      tripleStore.add('http://example.org/Person', 'rdf:type', 'owl:Class');
      
      const types = schemaExtractor.getEntityTypes();
      
      expect(types).toHaveLength(1);
      expect(types).toContain('http://example.org/Person');
    });
  });

  describe('rdfs:Class extraction', () => {
    it('should extract rdfs:Class definitions', () => {
      tripleStore.add('ex:Person', 'rdf:type', 'rdfs:Class');
      
      const types = schemaExtractor.getEntityTypes();
      
      expect(types).toHaveLength(1);
      expect(types).toContain('http://example.org/Person');
    });

    it('should extract both owl:Class and rdfs:Class', () => {
      tripleStore.add('ex:Person', 'rdf:type', 'owl:Class');
      tripleStore.add('ex:Document', 'rdf:type', 'rdfs:Class');
      
      const types = schemaExtractor.getEntityTypes();
      
      expect(types).toHaveLength(2);
      expect(types).toContain('http://example.org/Person');
      expect(types).toContain('http://example.org/Document');
    });

    it('should not duplicate types with both owl:Class and rdfs:Class', () => {
      // Same entity marked as both owl:Class and rdfs:Class
      tripleStore.add('ex:Person', 'rdf:type', 'owl:Class');
      tripleStore.add('ex:Person', 'rdf:type', 'rdfs:Class');
      
      const types = schemaExtractor.getEntityTypes();
      
      expect(types).toHaveLength(1);
      expect(types).toContain('http://example.org/Person');
    });
  });

  describe('Filtering non-class entities', () => {
    it('should exclude properties from entity types', () => {
      tripleStore.add('ex:Person', 'rdf:type', 'owl:Class');
      tripleStore.add('ex:name', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:knows', 'rdf:type', 'owl:ObjectProperty');
      
      const types = schemaExtractor.getEntityTypes();
      
      expect(types).toHaveLength(1);
      expect(types).toContain('http://example.org/Person');
      expect(types).not.toContain('http://example.org/name');
      expect(types).not.toContain('http://example.org/knows');
    });

    it('should exclude instances from entity types', () => {
      tripleStore.add('ex:Person', 'rdf:type', 'owl:Class');
      tripleStore.add('ex:alice', 'rdf:type', 'ex:Person'); // Instance
      tripleStore.add('ex:bob', 'rdf:type', 'ex:Person'); // Instance
      
      const types = schemaExtractor.getEntityTypes();
      
      expect(types).toHaveLength(1);
      expect(types).toContain('http://example.org/Person');
      expect(types).not.toContain('http://example.org/alice');
      expect(types).not.toContain('http://example.org/bob');
    });

    it('should exclude rdf:Property from entity types', () => {
      tripleStore.add('ex:Person', 'rdf:type', 'owl:Class');
      tripleStore.add('ex:age', 'rdf:type', 'rdf:Property');
      
      const types = schemaExtractor.getEntityTypes();
      
      expect(types).toHaveLength(1);
      expect(types).toContain('http://example.org/Person');
      expect(types).not.toContain('http://example.org/age');
    });
  });

  describe('Multiple namespaces', () => {
    it('should extract classes from different namespaces', () => {
      tripleStore.add('ex:Person', 'rdf:type', 'owl:Class');
      tripleStore.add('myonto:User', 'rdf:type', 'owl:Class');
      
      const types = schemaExtractor.getEntityTypes();
      
      expect(types).toHaveLength(2);
      expect(types).toContain('http://example.org/Person');
      expect(types).toContain('http://myonto.example.com/User');
    });

    it('should handle classes without registered namespace', () => {
      tripleStore.add('ex:Person', 'rdf:type', 'owl:Class');
      tripleStore.add('http://unknown.org/Thing', 'rdf:type', 'owl:Class');
      
      const types = schemaExtractor.getEntityTypes();
      
      expect(types).toHaveLength(2);
      expect(types).toContain('http://example.org/Person');
      expect(types).toContain('http://unknown.org/Thing');
    });
  });

  describe('Standard vocabularies', () => {
    it('should extract FOAF vocabulary classes', () => {
      tripleStore.add('foaf:Person', 'rdf:type', 'owl:Class');
      tripleStore.add('foaf:Organization', 'rdf:type', 'owl:Class');
      tripleStore.add('foaf:Document', 'rdf:type', 'owl:Class');
      
      const types = schemaExtractor.getEntityTypes();
      
      expect(types).toHaveLength(3);
      expect(types).toContain('http://xmlns.com/foaf/0.1/Person');
      expect(types).toContain('http://xmlns.com/foaf/0.1/Organization');
      expect(types).toContain('http://xmlns.com/foaf/0.1/Document');
    });

    it('should extract Schema.org vocabulary classes', () => {
      tripleStore.add('schema:Person', 'rdf:type', 'rdfs:Class');
      tripleStore.add('schema:Article', 'rdf:type', 'rdfs:Class');
      
      const types = schemaExtractor.getEntityTypes();
      
      expect(types).toHaveLength(2);
      expect(types).toContain('https://schema.org/Person');
      expect(types).toContain('https://schema.org/Article');
    });
  });

  describe('Edge cases', () => {
    it('should return empty array when no classes defined', () => {
      // Only add properties, no classes
      tripleStore.add('ex:name', 'rdf:type', 'owl:DatatypeProperty');
      
      const types = schemaExtractor.getEntityTypes();
      
      expect(types).toEqual([]);
    });

    it('should handle empty triple store', () => {
      const types = schemaExtractor.getEntityTypes();
      
      expect(types).toEqual([]);
    });

    it('should handle malformed class definitions gracefully', () => {
      tripleStore.add('ex:Person', 'rdf:type', 'owl:Class');
      // Add some noise
      tripleStore.add('ex:Invalid', 'rdfs:label', 'This is not a class');
      
      const types = schemaExtractor.getEntityTypes();
      
      expect(types).toHaveLength(1);
      expect(types).toContain('http://example.org/Person');
    });
  });

  describe('Constructor validation', () => {
    it('should throw without triple store', () => {
      expect(() => {
        new RDFSchemaExtractor(null, namespaceManager);
      }).toThrow('RDFSchemaExtractor requires a triple store');
    });

    it('should throw without namespace manager', () => {
      expect(() => {
        new RDFSchemaExtractor(tripleStore, null);
      }).toThrow('RDFSchemaExtractor requires a namespace manager');
    });
  });

  describe('Return format', () => {
    it('should return array of full URI strings', () => {
      tripleStore.add('ex:Person', 'rdf:type', 'owl:Class');
      
      const types = schemaExtractor.getEntityTypes();
      
      expect(Array.isArray(types)).toBe(true);
      expect(typeof types[0]).toBe('string');
      expect(types[0].startsWith('http://')).toBe(true);
    });

    it('should return unique types (no duplicates)', () => {
      // Add same class multiple times
      tripleStore.add('ex:Person', 'rdf:type', 'owl:Class');
      tripleStore.add('ex:Person', 'rdf:type', 'rdfs:Class');
      tripleStore.add('ex:Person', 'rdfs:label', 'Person');
      
      const types = schemaExtractor.getEntityTypes();
      
      expect(types).toHaveLength(1);
    });

    it('should return sorted types for consistent ordering', () => {
      tripleStore.add('ex:Zebra', 'rdf:type', 'owl:Class');
      tripleStore.add('ex:Apple', 'rdf:type', 'owl:Class');
      tripleStore.add('ex:Banana', 'rdf:type', 'owl:Class');
      
      const types = schemaExtractor.getEntityTypes();
      
      // Should be alphabetically sorted
      expect(types[0]).toBe('http://example.org/Apple');
      expect(types[1]).toBe('http://example.org/Banana');
      expect(types[2]).toBe('http://example.org/Zebra');
    });
  });
});