/**
 * Unit tests for RDFSchemaExtractor.getPropertyCardinality()
 * 
 * Tests extraction of cardinality constraints from RDF ontologies:
 * - Detect owl:FunctionalProperty (cardinality one)
 * - Default to many for non-functional properties
 * - Handle both DatatypeProperty and ObjectProperty
 * - Handle properties without explicit cardinality
 * - Test with standard vocabularies (FOAF, Schema.org)
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { RDFSchemaExtractor } from '../../src/RDFSchemaExtractor.js';
import { NamespaceManager } from '../../src/NamespaceManager.js';
import { SimpleTripleStore } from '../../src/SimpleTripleStore.js';

describe('RDFSchemaExtractor.getPropertyCardinality()', () => {
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

  describe('Functional properties (cardinality one)', () => {
    it('should return "one" for owl:FunctionalProperty', () => {
      // Define functional property
      tripleStore.add('ex:email', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:email', 'rdf:type', 'owl:FunctionalProperty');
      
      const cardinality = schemaExtractor.getPropertyCardinality('http://example.org/email');
      
      expect(cardinality).toBe('one');
    });

    it('should return "one" for functional DatatypeProperty', () => {
      tripleStore.add('ex:primaryEmail', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:primaryEmail', 'rdf:type', 'owl:FunctionalProperty');
      tripleStore.add('ex:primaryEmail', 'rdfs:range', 'xsd:string');
      
      const cardinality = schemaExtractor.getPropertyCardinality('http://example.org/primaryEmail');
      
      expect(cardinality).toBe('one');
    });

    it('should return "one" for functional ObjectProperty', () => {
      tripleStore.add('ex:spouse', 'rdf:type', 'owl:ObjectProperty');
      tripleStore.add('ex:spouse', 'rdf:type', 'owl:FunctionalProperty');
      tripleStore.add('ex:spouse', 'rdfs:domain', 'ex:Person');
      tripleStore.add('ex:spouse', 'rdfs:range', 'ex:Person');
      
      const cardinality = schemaExtractor.getPropertyCardinality('http://example.org/spouse');
      
      expect(cardinality).toBe('one');
    });

    it('should return "one" for property with only owl:FunctionalProperty type', () => {
      // Some ontologies might only specify FunctionalProperty
      tripleStore.add('ex:uniqueId', 'rdf:type', 'owl:FunctionalProperty');
      
      const cardinality = schemaExtractor.getPropertyCardinality('http://example.org/uniqueId');
      
      expect(cardinality).toBe('one');
    });
  });

  describe('Non-functional properties (cardinality many)', () => {
    it('should return "many" for regular DatatypeProperty', () => {
      tripleStore.add('ex:hobby', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:hobby', 'rdfs:range', 'xsd:string');
      
      const cardinality = schemaExtractor.getPropertyCardinality('http://example.org/hobby');
      
      expect(cardinality).toBe('many');
    });

    it('should return "many" for regular ObjectProperty', () => {
      tripleStore.add('ex:knows', 'rdf:type', 'owl:ObjectProperty');
      tripleStore.add('ex:knows', 'rdfs:domain', 'ex:Person');
      tripleStore.add('ex:knows', 'rdfs:range', 'ex:Person');
      
      const cardinality = schemaExtractor.getPropertyCardinality('http://example.org/knows');
      
      expect(cardinality).toBe('many');
    });

    it('should return "many" for rdf:Property', () => {
      tripleStore.add('ex:label', 'rdf:type', 'rdf:Property');
      
      const cardinality = schemaExtractor.getPropertyCardinality('http://example.org/label');
      
      expect(cardinality).toBe('many');
    });

    it('should return "many" for property without cardinality constraints', () => {
      tripleStore.add('ex:tag', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:tag', 'rdfs:domain', 'ex:Resource');
      
      const cardinality = schemaExtractor.getPropertyCardinality('http://example.org/tag');
      
      expect(cardinality).toBe('many');
    });
  });

  describe('CURIE and URI handling', () => {
    it('should accept property URI as CURIE', () => {
      tripleStore.add('ex:email', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:email', 'rdf:type', 'owl:FunctionalProperty');
      
      // Query with CURIE
      const cardinality = schemaExtractor.getPropertyCardinality('ex:email');
      
      expect(cardinality).toBe('one');
    });

    it('should accept property URI as full URI', () => {
      tripleStore.add('ex:email', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:email', 'rdf:type', 'owl:FunctionalProperty');
      
      // Query with full URI
      const cardinality = schemaExtractor.getPropertyCardinality('http://example.org/email');
      
      expect(cardinality).toBe('one');
    });

    it('should handle properties from different namespaces', () => {
      tripleStore.add('myonto:primaryKey', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('myonto:primaryKey', 'rdf:type', 'owl:FunctionalProperty');
      
      const cardinality = schemaExtractor.getPropertyCardinality('http://myonto.example.com/primaryKey');
      
      expect(cardinality).toBe('one');
    });
  });

  describe('Standard vocabularies', () => {
    it('should detect cardinality for FOAF properties', () => {
      // FOAF doesn't have many functional properties, but let's test a custom one
      tripleStore.add('foaf:mbox', 'rdf:type', 'owl:ObjectProperty');
      tripleStore.add('foaf:mbox', 'rdf:type', 'owl:FunctionalProperty');
      
      const cardinality = schemaExtractor.getPropertyCardinality('http://xmlns.com/foaf/0.1/mbox');
      
      expect(cardinality).toBe('one');
    });

    it('should default to many for FOAF knows property', () => {
      tripleStore.add('foaf:knows', 'rdf:type', 'owl:ObjectProperty');
      
      const cardinality = schemaExtractor.getPropertyCardinality('http://xmlns.com/foaf/0.1/knows');
      
      expect(cardinality).toBe('many');
    });

    it('should detect cardinality for Schema.org properties', () => {
      // Schema.org example
      tripleStore.add('schema:isbn', 'rdf:type', 'rdf:Property');
      tripleStore.add('schema:isbn', 'rdf:type', 'owl:FunctionalProperty');
      
      const cardinality = schemaExtractor.getPropertyCardinality('https://schema.org/isbn');
      
      expect(cardinality).toBe('one');
    });
  });

  describe('Edge cases', () => {
    it('should return "many" for non-existent property', () => {
      // Property doesn't exist in triple store
      const cardinality = schemaExtractor.getPropertyCardinality('http://example.org/nonExistent');
      
      // Default to many when property not found
      expect(cardinality).toBe('many');
    });

    it('should return "many" for property with no type information', () => {
      // Property exists but has no rdf:type triple
      tripleStore.add('ex:mystery', 'rdfs:domain', 'ex:Thing');
      
      const cardinality = schemaExtractor.getPropertyCardinality('http://example.org/mystery');
      
      expect(cardinality).toBe('many');
    });

    it('should handle empty triple store', () => {
      const cardinality = schemaExtractor.getPropertyCardinality('http://example.org/property');
      
      expect(cardinality).toBe('many');
    });

    it('should throw error for null property URI', () => {
      expect(() => {
        schemaExtractor.getPropertyCardinality(null);
      }).toThrow('Property URI must be a non-empty string');
    });

    it('should throw error for undefined property URI', () => {
      expect(() => {
        schemaExtractor.getPropertyCardinality(undefined);
      }).toThrow('Property URI must be a non-empty string');
    });

    it('should throw error for empty string property URI', () => {
      expect(() => {
        schemaExtractor.getPropertyCardinality('');
      }).toThrow('Property URI must be a non-empty string');
    });

    it('should throw error for non-string property URI', () => {
      expect(() => {
        schemaExtractor.getPropertyCardinality(123);
      }).toThrow('Property URI must be a non-empty string');
    });
  });

  describe('Complex scenarios', () => {
    it('should handle property with multiple type declarations', () => {
      // Property is both DatatypeProperty and FunctionalProperty
      tripleStore.add('ex:code', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:code', 'rdf:type', 'owl:FunctionalProperty');
      tripleStore.add('ex:code', 'rdfs:range', 'xsd:string');
      
      const cardinality = schemaExtractor.getPropertyCardinality('http://example.org/code');
      
      // Should detect FunctionalProperty
      expect(cardinality).toBe('one');
    });

    it('should distinguish between different properties with similar names', () => {
      // One functional, one not
      tripleStore.add('ex:id', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:id', 'rdf:type', 'owl:FunctionalProperty');
      
      tripleStore.add('ex:ids', 'rdf:type', 'owl:DatatypeProperty');
      
      const idCardinality = schemaExtractor.getPropertyCardinality('http://example.org/id');
      const idsCardinality = schemaExtractor.getPropertyCardinality('http://example.org/ids');
      
      expect(idCardinality).toBe('one');
      expect(idsCardinality).toBe('many');
    });

    it('should handle properties with domain and range but no functional constraint', () => {
      tripleStore.add('ex:relatedTo', 'rdf:type', 'owl:ObjectProperty');
      tripleStore.add('ex:relatedTo', 'rdfs:domain', 'ex:Thing');
      tripleStore.add('ex:relatedTo', 'rdfs:range', 'ex:Thing');
      
      const cardinality = schemaExtractor.getPropertyCardinality('http://example.org/relatedTo');
      
      expect(cardinality).toBe('many');
    });
  });

  describe('Consistency with getPropertiesForType()', () => {
    it('should return same cardinality as getPropertiesForType()', () => {
      // Set up a type with properties
      tripleStore.add('ex:Person', 'rdf:type', 'owl:Class');
      
      tripleStore.add('ex:email', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:email', 'rdf:type', 'owl:FunctionalProperty');
      tripleStore.add('ex:email', 'rdfs:domain', 'ex:Person');
      
      tripleStore.add('ex:hobby', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:hobby', 'rdfs:domain', 'ex:Person');
      
      // Get properties from getPropertiesForType
      const properties = schemaExtractor.getPropertiesForType('http://example.org/Person');
      const emailProp = properties.find(p => p.name === 'email');
      const hobbyProp = properties.find(p => p.name === 'hobby');
      
      // Get cardinality directly
      const emailCardinality = schemaExtractor.getPropertyCardinality('http://example.org/email');
      const hobbyCardinality = schemaExtractor.getPropertyCardinality('http://example.org/hobby');
      
      // Should match
      expect(emailProp.cardinality).toBe(emailCardinality);
      expect(hobbyProp.cardinality).toBe(hobbyCardinality);
      expect(emailCardinality).toBe('one');
      expect(hobbyCardinality).toBe('many');
    });
  });
});