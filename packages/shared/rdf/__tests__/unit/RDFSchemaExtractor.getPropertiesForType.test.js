/**
 * Unit tests for RDFSchemaExtractor.getPropertiesForType()
 * 
 * Tests extraction of properties for specific entity types from RDF ontologies:
 * - Extract properties with rdfs:domain matching the type
 * - Extract both owl:DatatypeProperty and owl:ObjectProperty
 * - Extract property metadata (range, cardinality)
 * - Handle inheritance and multiple domains
 * - Filter properties not applicable to the type
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { RDFSchemaExtractor } from '../../src/RDFSchemaExtractor.js';
import { NamespaceManager } from '../../src/NamespaceManager.js';
import { SimpleTripleStore } from '../../src/SimpleTripleStore.js';

describe('RDFSchemaExtractor.getPropertiesForType()', () => {
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

  describe('Basic property extraction', () => {
    it('should extract single DatatypeProperty for type', () => {
      // Define ontology:
      // ex:Person a owl:Class
      // ex:name a owl:DatatypeProperty ; rdfs:domain ex:Person ; rdfs:range xsd:string
      tripleStore.add('ex:Person', 'rdf:type', 'owl:Class');
      tripleStore.add('ex:name', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:name', 'rdfs:domain', 'ex:Person');
      tripleStore.add('ex:name', 'rdfs:range', 'xsd:string');
      
      const properties = schemaExtractor.getPropertiesForType('http://example.org/Person');
      
      expect(properties).toHaveLength(1);
      expect(properties[0]).toEqual({
        uri: 'http://example.org/name',
        name: 'name',
        type: 'datatype',
        range: 'http://www.w3.org/2001/XMLSchema#string',
        cardinality: 'many' // Default cardinality
      });
    });

    it('should extract single ObjectProperty for type', () => {
      tripleStore.add('ex:Person', 'rdf:type', 'owl:Class');
      tripleStore.add('ex:knows', 'rdf:type', 'owl:ObjectProperty');
      tripleStore.add('ex:knows', 'rdfs:domain', 'ex:Person');
      tripleStore.add('ex:knows', 'rdfs:range', 'ex:Person');
      
      const properties = schemaExtractor.getPropertiesForType('http://example.org/Person');
      
      expect(properties).toHaveLength(1);
      expect(properties[0]).toEqual({
        uri: 'http://example.org/knows',
        name: 'knows',
        type: 'object',
        range: 'http://example.org/Person',
        cardinality: 'many'
      });
    });

    it('should extract multiple properties for type', () => {
      tripleStore.add('ex:Person', 'rdf:type', 'owl:Class');
      
      tripleStore.add('ex:name', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:name', 'rdfs:domain', 'ex:Person');
      tripleStore.add('ex:name', 'rdfs:range', 'xsd:string');
      
      tripleStore.add('ex:age', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:age', 'rdfs:domain', 'ex:Person');
      tripleStore.add('ex:age', 'rdfs:range', 'xsd:integer');
      
      tripleStore.add('ex:knows', 'rdf:type', 'owl:ObjectProperty');
      tripleStore.add('ex:knows', 'rdfs:domain', 'ex:Person');
      tripleStore.add('ex:knows', 'rdfs:range', 'ex:Person');
      
      const properties = schemaExtractor.getPropertiesForType('http://example.org/Person');
      
      expect(properties).toHaveLength(3);
      
      const propertyNames = properties.map(p => p.name);
      expect(propertyNames).toContain('name');
      expect(propertyNames).toContain('age');
      expect(propertyNames).toContain('knows');
    });
  });

  describe('rdfs:domain filtering', () => {
    it('should only return properties with matching domain', () => {
      tripleStore.add('ex:Person', 'rdf:type', 'owl:Class');
      tripleStore.add('ex:Organization', 'rdf:type', 'owl:Class');
      
      // Property for Person
      tripleStore.add('ex:name', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:name', 'rdfs:domain', 'ex:Person');
      
      // Property for Organization
      tripleStore.add('ex:orgName', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:orgName', 'rdfs:domain', 'ex:Organization');
      
      const personProperties = schemaExtractor.getPropertiesForType('http://example.org/Person');
      
      expect(personProperties).toHaveLength(1);
      expect(personProperties[0].name).toBe('name');
    });

    it('should handle properties without explicit domain', () => {
      tripleStore.add('ex:Person', 'rdf:type', 'owl:Class');
      
      // Property without domain
      tripleStore.add('ex:label', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:label', 'rdfs:range', 'xsd:string');
      
      const properties = schemaExtractor.getPropertiesForType('http://example.org/Person');
      
      // Properties without domain should not be included
      expect(properties).toHaveLength(0);
    });

    it('should handle properties with multiple domains', () => {
      tripleStore.add('ex:Person', 'rdf:type', 'owl:Class');
      tripleStore.add('ex:Organization', 'rdf:type', 'owl:Class');
      
      // Property applicable to both Person and Organization
      tripleStore.add('ex:name', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:name', 'rdfs:domain', 'ex:Person');
      tripleStore.add('ex:name', 'rdfs:domain', 'ex:Organization');
      tripleStore.add('ex:name', 'rdfs:range', 'xsd:string');
      
      const personProperties = schemaExtractor.getPropertiesForType('http://example.org/Person');
      const orgProperties = schemaExtractor.getPropertiesForType('http://example.org/Organization');
      
      // Both should have the name property
      expect(personProperties).toHaveLength(1);
      expect(personProperties[0].name).toBe('name');
      expect(orgProperties).toHaveLength(1);
      expect(orgProperties[0].name).toBe('name');
    });
  });

  describe('Property metadata extraction', () => {
    it('should extract rdfs:range for DatatypeProperty', () => {
      tripleStore.add('ex:Person', 'rdf:type', 'owl:Class');
      tripleStore.add('ex:age', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:age', 'rdfs:domain', 'ex:Person');
      tripleStore.add('ex:age', 'rdfs:range', 'xsd:integer');
      
      const properties = schemaExtractor.getPropertiesForType('http://example.org/Person');
      
      expect(properties[0].range).toBe('http://www.w3.org/2001/XMLSchema#integer');
    });

    it('should extract rdfs:range for ObjectProperty', () => {
      tripleStore.add('ex:Person', 'rdf:type', 'owl:Class');
      tripleStore.add('ex:Document', 'rdf:type', 'owl:Class');
      
      tripleStore.add('ex:authored', 'rdf:type', 'owl:ObjectProperty');
      tripleStore.add('ex:authored', 'rdfs:domain', 'ex:Person');
      tripleStore.add('ex:authored', 'rdfs:range', 'ex:Document');
      
      const properties = schemaExtractor.getPropertiesForType('http://example.org/Person');
      
      expect(properties[0].range).toBe('http://example.org/Document');
    });

    it('should handle properties without explicit range', () => {
      tripleStore.add('ex:Person', 'rdf:type', 'owl:Class');
      tripleStore.add('ex:note', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:note', 'rdfs:domain', 'ex:Person');
      
      const properties = schemaExtractor.getPropertiesForType('http://example.org/Person');
      
      // Should have undefined or null range
      expect(properties[0].range).toBeUndefined();
    });

    it('should detect owl:FunctionalProperty cardinality', () => {
      tripleStore.add('ex:Person', 'rdf:type', 'owl:Class');
      tripleStore.add('ex:email', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:email', 'rdf:type', 'owl:FunctionalProperty');
      tripleStore.add('ex:email', 'rdfs:domain', 'ex:Person');
      tripleStore.add('ex:email', 'rdfs:range', 'xsd:string');
      
      const properties = schemaExtractor.getPropertiesForType('http://example.org/Person');
      
      expect(properties[0].cardinality).toBe('one');
    });

    it('should default to many cardinality for non-functional properties', () => {
      tripleStore.add('ex:Person', 'rdf:type', 'owl:Class');
      tripleStore.add('ex:hobby', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:hobby', 'rdfs:domain', 'ex:Person');
      tripleStore.add('ex:hobby', 'rdfs:range', 'xsd:string');
      
      const properties = schemaExtractor.getPropertiesForType('http://example.org/Person');
      
      expect(properties[0].cardinality).toBe('many');
    });
  });

  describe('Property types', () => {
    it('should identify owl:DatatypeProperty as datatype', () => {
      tripleStore.add('ex:Person', 'rdf:type', 'owl:Class');
      tripleStore.add('ex:name', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:name', 'rdfs:domain', 'ex:Person');
      
      const properties = schemaExtractor.getPropertiesForType('http://example.org/Person');
      
      expect(properties[0].type).toBe('datatype');
    });

    it('should identify owl:ObjectProperty as object', () => {
      tripleStore.add('ex:Person', 'rdf:type', 'owl:Class');
      tripleStore.add('ex:knows', 'rdf:type', 'owl:ObjectProperty');
      tripleStore.add('ex:knows', 'rdfs:domain', 'ex:Person');
      
      const properties = schemaExtractor.getPropertiesForType('http://example.org/Person');
      
      expect(properties[0].type).toBe('object');
    });

    it('should handle rdf:Property as datatype', () => {
      tripleStore.add('ex:Person', 'rdf:type', 'owl:Class');
      tripleStore.add('ex:label', 'rdf:type', 'rdf:Property');
      tripleStore.add('ex:label', 'rdfs:domain', 'ex:Person');
      
      const properties = schemaExtractor.getPropertiesForType('http://example.org/Person');
      
      expect(properties[0].type).toBe('datatype');
    });
  });

  describe('Multiple namespaces', () => {
    it('should extract properties from different namespaces', () => {
      tripleStore.add('ex:Person', 'rdf:type', 'owl:Class');
      
      tripleStore.add('ex:name', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:name', 'rdfs:domain', 'ex:Person');
      
      tripleStore.add('myonto:email', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('myonto:email', 'rdfs:domain', 'ex:Person');
      
      const properties = schemaExtractor.getPropertiesForType('http://example.org/Person');
      
      expect(properties).toHaveLength(2);
      
      const uris = properties.map(p => p.uri);
      expect(uris).toContain('http://example.org/name');
      expect(uris).toContain('http://myonto.example.com/email');
    });
  });

  describe('Standard vocabularies', () => {
    it('should extract FOAF Person properties', () => {
      tripleStore.add('foaf:Person', 'rdf:type', 'owl:Class');
      
      tripleStore.add('foaf:name', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('foaf:name', 'rdfs:domain', 'foaf:Person');
      tripleStore.add('foaf:name', 'rdfs:range', 'xsd:string');
      
      tripleStore.add('foaf:mbox', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('foaf:mbox', 'rdfs:domain', 'foaf:Person');
      
      tripleStore.add('foaf:knows', 'rdf:type', 'owl:ObjectProperty');
      tripleStore.add('foaf:knows', 'rdfs:domain', 'foaf:Person');
      tripleStore.add('foaf:knows', 'rdfs:range', 'foaf:Person');
      
      const properties = schemaExtractor.getPropertiesForType('http://xmlns.com/foaf/0.1/Person');
      
      expect(properties).toHaveLength(3);
      
      const propertyNames = properties.map(p => p.name);
      expect(propertyNames).toContain('name');
      expect(propertyNames).toContain('mbox');
      expect(propertyNames).toContain('knows');
    });

    it('should extract Schema.org Person properties', () => {
      tripleStore.add('schema:Person', 'rdf:type', 'rdfs:Class');
      
      tripleStore.add('schema:name', 'rdf:type', 'rdf:Property');
      tripleStore.add('schema:name', 'rdfs:domain', 'schema:Person');
      tripleStore.add('schema:name', 'rdfs:range', 'xsd:string');
      
      tripleStore.add('schema:email', 'rdf:type', 'rdf:Property');
      tripleStore.add('schema:email', 'rdfs:domain', 'schema:Person');
      
      const properties = schemaExtractor.getPropertiesForType('https://schema.org/Person');
      
      expect(properties).toHaveLength(2);
      
      const propertyNames = properties.map(p => p.name);
      expect(propertyNames).toContain('name');
      expect(propertyNames).toContain('email');
    });
  });

  describe('Edge cases', () => {
    it('should return empty array when type has no properties', () => {
      tripleStore.add('ex:Person', 'rdf:type', 'owl:Class');
      
      const properties = schemaExtractor.getPropertiesForType('http://example.org/Person');
      
      expect(properties).toEqual([]);
    });

    it('should return empty array when type does not exist', () => {
      const properties = schemaExtractor.getPropertiesForType('http://example.org/NonExistent');
      
      expect(properties).toEqual([]);
    });

    it('should handle empty triple store', () => {
      const properties = schemaExtractor.getPropertiesForType('http://example.org/Person');
      
      expect(properties).toEqual([]);
    });

    it('should handle malformed property definitions gracefully', () => {
      tripleStore.add('ex:Person', 'rdf:type', 'owl:Class');
      
      // Valid property
      tripleStore.add('ex:name', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:name', 'rdfs:domain', 'ex:Person');
      
      // Malformed property (missing type)
      tripleStore.add('ex:invalid', 'rdfs:domain', 'ex:Person');
      
      const properties = schemaExtractor.getPropertiesForType('http://example.org/Person');
      
      // Should only return valid properties
      expect(properties).toHaveLength(1);
      expect(properties[0].name).toBe('name');
    });
  });

  describe('CURIE and URI handling', () => {
    it('should accept type as CURIE', () => {
      tripleStore.add('ex:Person', 'rdf:type', 'owl:Class');
      tripleStore.add('ex:name', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:name', 'rdfs:domain', 'ex:Person');
      
      // Query with CURIE instead of full URI
      const properties = schemaExtractor.getPropertiesForType('ex:Person');
      
      expect(properties).toHaveLength(1);
      expect(properties[0].name).toBe('name');
    });

    it('should accept type as full URI', () => {
      tripleStore.add('ex:Person', 'rdf:type', 'owl:Class');
      tripleStore.add('ex:name', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:name', 'rdfs:domain', 'ex:Person');
      
      // Query with full URI
      const properties = schemaExtractor.getPropertiesForType('http://example.org/Person');
      
      expect(properties).toHaveLength(1);
      expect(properties[0].name).toBe('name');
    });

    it('should return full URIs in property metadata', () => {
      tripleStore.add('ex:Person', 'rdf:type', 'owl:Class');
      tripleStore.add('ex:name', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:name', 'rdfs:domain', 'ex:Person');
      tripleStore.add('ex:name', 'rdfs:range', 'xsd:string');
      
      const properties = schemaExtractor.getPropertiesForType('ex:Person');
      
      expect(properties[0].uri).toBe('http://example.org/name');
      expect(properties[0].range).toBe('http://www.w3.org/2001/XMLSchema#string');
    });
  });

  describe('Return format', () => {
    it('should return array of property objects', () => {
      tripleStore.add('ex:Person', 'rdf:type', 'owl:Class');
      tripleStore.add('ex:name', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:name', 'rdfs:domain', 'ex:Person');
      
      const properties = schemaExtractor.getPropertiesForType('http://example.org/Person');
      
      expect(Array.isArray(properties)).toBe(true);
      expect(typeof properties[0]).toBe('object');
    });

    it('should include all required property fields', () => {
      tripleStore.add('ex:Person', 'rdf:type', 'owl:Class');
      tripleStore.add('ex:name', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:name', 'rdfs:domain', 'ex:Person');
      tripleStore.add('ex:name', 'rdfs:range', 'xsd:string');
      
      const properties = schemaExtractor.getPropertiesForType('http://example.org/Person');
      
      const property = properties[0];
      expect(property).toHaveProperty('uri');
      expect(property).toHaveProperty('name');
      expect(property).toHaveProperty('type');
      expect(property).toHaveProperty('cardinality');
    });

    it('should return unique properties (no duplicates)', () => {
      tripleStore.add('ex:Person', 'rdf:type', 'owl:Class');
      
      // Add same property multiple times (shouldn't happen but handle it)
      tripleStore.add('ex:name', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:name', 'rdfs:domain', 'ex:Person');
      tripleStore.add('ex:name', 'rdfs:domain', 'ex:Person'); // Duplicate
      
      const properties = schemaExtractor.getPropertiesForType('http://example.org/Person');
      
      expect(properties).toHaveLength(1);
    });

    it('should return sorted properties for consistent ordering', () => {
      tripleStore.add('ex:Person', 'rdf:type', 'owl:Class');
      
      tripleStore.add('ex:zebra', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:zebra', 'rdfs:domain', 'ex:Person');
      
      tripleStore.add('ex:apple', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:apple', 'rdfs:domain', 'ex:Person');
      
      tripleStore.add('ex:banana', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:banana', 'rdfs:domain', 'ex:Person');
      
      const properties = schemaExtractor.getPropertiesForType('http://example.org/Person');
      
      // Should be alphabetically sorted by name
      expect(properties[0].name).toBe('apple');
      expect(properties[1].name).toBe('banana');
      expect(properties[2].name).toBe('zebra');
    });
  });
});