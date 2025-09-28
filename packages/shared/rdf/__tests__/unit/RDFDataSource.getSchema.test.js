/**
 * Unit tests for RDFDataSource.getSchema()
 * 
 * Tests schema retrieval functionality:
 * - Retrieve schema from RDF ontology in triple store
 * - Integration with RDFSchemaExtractor
 * - Handle empty triple store
 * - Return Handle-compatible schema format
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { RDFDataSource } from '../../src/RDFDataSource.js';
import { NamespaceManager } from '../../src/NamespaceManager.js';
import { SimpleTripleStore } from '../../src/SimpleTripleStore.js';

describe('RDFDataSource.getSchema()', () => {
  let dataSource;
  let tripleStore;
  let namespaceManager;

  beforeEach(() => {
    tripleStore = new SimpleTripleStore();
    namespaceManager = new NamespaceManager();
    namespaceManager.addNamespace('ex', 'http://example.org/');
    namespaceManager.addNamespace('foaf', 'http://xmlns.com/foaf/0.1/');
    
    dataSource = new RDFDataSource(tripleStore, namespaceManager);
  });

  describe('Basic schema retrieval', () => {
    it('should return empty schema for empty triple store', () => {
      const schema = dataSource.getSchema();
      
      expect(schema).toBeDefined();
      expect(typeof schema).toBe('object');
      expect(Object.keys(schema)).toHaveLength(0);
    });

    it('should retrieve schema with single entity type', () => {
      // Define simple ontology
      tripleStore.add('ex:Person', 'rdf:type', 'owl:Class');
      tripleStore.add('ex:name', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:name', 'rdfs:domain', 'ex:Person');
      tripleStore.add('ex:name', 'rdfs:range', 'xsd:string');
      
      const schema = dataSource.getSchema();
      
      expect(schema).toHaveProperty('Person/name');
      expect(schema['Person/name']).toEqual({
        type: 'string',
        cardinality: 'many'
      });
    });

    it('should retrieve schema with multiple entity types', () => {
      // Define two entity types
      tripleStore.add('ex:Person', 'rdf:type', 'owl:Class');
      tripleStore.add('ex:Organization', 'rdf:type', 'owl:Class');
      
      tripleStore.add('ex:name', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:name', 'rdfs:domain', 'ex:Person');
      
      tripleStore.add('ex:orgName', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:orgName', 'rdfs:domain', 'ex:Organization');
      
      const schema = dataSource.getSchema();
      
      expect(schema).toHaveProperty('Person/name');
      expect(schema).toHaveProperty('Organization/orgName');
    });

    it('should retrieve schema with all property types', () => {
      tripleStore.add('ex:Person', 'rdf:type', 'owl:Class');
      
      // String property
      tripleStore.add('ex:name', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:name', 'rdfs:domain', 'ex:Person');
      tripleStore.add('ex:name', 'rdfs:range', 'xsd:string');
      
      // Number property
      tripleStore.add('ex:age', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:age', 'rdfs:domain', 'ex:Person');
      tripleStore.add('ex:age', 'rdfs:range', 'xsd:integer');
      
      // Boolean property
      tripleStore.add('ex:active', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:active', 'rdfs:domain', 'ex:Person');
      tripleStore.add('ex:active', 'rdfs:range', 'xsd:boolean');
      
      // Date property
      tripleStore.add('ex:birthDate', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:birthDate', 'rdfs:domain', 'ex:Person');
      tripleStore.add('ex:birthDate', 'rdfs:range', 'xsd:dateTime');
      
      // Reference property
      tripleStore.add('ex:knows', 'rdf:type', 'owl:ObjectProperty');
      tripleStore.add('ex:knows', 'rdfs:domain', 'ex:Person');
      tripleStore.add('ex:knows', 'rdfs:range', 'ex:Person');
      
      const schema = dataSource.getSchema();
      
      expect(schema['Person/name'].type).toBe('string');
      expect(schema['Person/age'].type).toBe('number');
      expect(schema['Person/active'].type).toBe('boolean');
      expect(schema['Person/birthDate'].type).toBe('date');
      expect(schema['Person/knows'].type).toBe('ref');
      expect(schema['Person/knows'].ref).toBe('Person');
    });
  });

  describe('Cardinality constraints', () => {
    it('should retrieve cardinality one for functional properties', () => {
      tripleStore.add('ex:Person', 'rdf:type', 'owl:Class');
      tripleStore.add('ex:email', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:email', 'rdf:type', 'owl:FunctionalProperty');
      tripleStore.add('ex:email', 'rdfs:domain', 'ex:Person');
      
      const schema = dataSource.getSchema();
      
      expect(schema['Person/email'].cardinality).toBe('one');
    });

    it('should retrieve cardinality many for non-functional properties', () => {
      tripleStore.add('ex:Person', 'rdf:type', 'owl:Class');
      tripleStore.add('ex:hobby', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:hobby', 'rdfs:domain', 'ex:Person');
      
      const schema = dataSource.getSchema();
      
      expect(schema['Person/hobby'].cardinality).toBe('many');
    });

    it('should handle mixed cardinality properties', () => {
      tripleStore.add('ex:Person', 'rdf:type', 'owl:Class');
      
      tripleStore.add('ex:id', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:id', 'rdf:type', 'owl:FunctionalProperty');
      tripleStore.add('ex:id', 'rdfs:domain', 'ex:Person');
      
      tripleStore.add('ex:tag', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:tag', 'rdfs:domain', 'ex:Person');
      
      const schema = dataSource.getSchema();
      
      expect(schema['Person/id'].cardinality).toBe('one');
      expect(schema['Person/tag'].cardinality).toBe('many');
    });
  });

  describe('FOAF ontology', () => {
    it('should retrieve FOAF Person schema', () => {
      // Define subset of FOAF ontology
      tripleStore.add('foaf:Person', 'rdf:type', 'owl:Class');
      
      tripleStore.add('foaf:name', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('foaf:name', 'rdfs:domain', 'foaf:Person');
      tripleStore.add('foaf:name', 'rdfs:range', 'xsd:string');
      
      tripleStore.add('foaf:age', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('foaf:age', 'rdfs:domain', 'foaf:Person');
      tripleStore.add('foaf:age', 'rdfs:range', 'xsd:integer');
      
      tripleStore.add('foaf:knows', 'rdf:type', 'owl:ObjectProperty');
      tripleStore.add('foaf:knows', 'rdfs:domain', 'foaf:Person');
      tripleStore.add('foaf:knows', 'rdfs:range', 'foaf:Person');
      
      const schema = dataSource.getSchema();
      
      expect(schema).toHaveProperty('Person/name');
      expect(schema).toHaveProperty('Person/age');
      expect(schema).toHaveProperty('Person/knows');
      
      expect(schema['Person/name'].type).toBe('string');
      expect(schema['Person/age'].type).toBe('number');
      expect(schema['Person/knows'].type).toBe('ref');
      expect(schema['Person/knows'].ref).toBe('Person');
    });
  });

  describe('Schema format validation', () => {
    it('should return plain object', () => {
      tripleStore.add('ex:Person', 'rdf:type', 'owl:Class');
      tripleStore.add('ex:name', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:name', 'rdfs:domain', 'ex:Person');
      
      const schema = dataSource.getSchema();
      
      expect(typeof schema).toBe('object');
      expect(schema.constructor).toBe(Object);
      expect(Array.isArray(schema)).toBe(false);
    });

    it('should use TypeName/propertyName format for keys', () => {
      tripleStore.add('ex:Person', 'rdf:type', 'owl:Class');
      tripleStore.add('ex:name', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:name', 'rdfs:domain', 'ex:Person');
      
      const schema = dataSource.getSchema();
      
      const keys = Object.keys(schema);
      expect(keys).toContain('Person/name');
      expect(keys[0]).toMatch(/^[^/]+\/[^/]+$/);
    });

    it('should include all required schema fields', () => {
      tripleStore.add('ex:Person', 'rdf:type', 'owl:Class');
      tripleStore.add('ex:name', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:name', 'rdfs:domain', 'ex:Person');
      tripleStore.add('ex:name', 'rdfs:range', 'xsd:string');
      
      const schema = dataSource.getSchema();
      const entry = schema['Person/name'];
      
      expect(entry).toHaveProperty('type');
      expect(entry).toHaveProperty('cardinality');
      expect(entry.type).toMatch(/^(string|number|boolean|date|ref)$/);
      expect(entry.cardinality).toMatch(/^(one|many)$/);
    });

    it('should include ref field for object properties', () => {
      tripleStore.add('ex:Person', 'rdf:type', 'owl:Class');
      tripleStore.add('ex:knows', 'rdf:type', 'owl:ObjectProperty');
      tripleStore.add('ex:knows', 'rdfs:domain', 'ex:Person');
      tripleStore.add('ex:knows', 'rdfs:range', 'ex:Person');
      
      const schema = dataSource.getSchema();
      const entry = schema['Person/knows'];
      
      expect(entry).toHaveProperty('ref');
      expect(typeof entry.ref).toBe('string');
      expect(entry.ref).toBe('Person');
    });
  });

  describe('Schema caching', () => {
    it('should return same schema object on repeated calls', () => {
      tripleStore.add('ex:Person', 'rdf:type', 'owl:Class');
      tripleStore.add('ex:name', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:name', 'rdfs:domain', 'ex:Person');
      
      const schema1 = dataSource.getSchema();
      const schema2 = dataSource.getSchema();
      
      // Should return equivalent schemas
      expect(schema1).toEqual(schema2);
    });

    it('should reflect changes after triple store is modified', () => {
      tripleStore.add('ex:Person', 'rdf:type', 'owl:Class');
      tripleStore.add('ex:name', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:name', 'rdfs:domain', 'ex:Person');
      
      const schema1 = dataSource.getSchema();
      expect(Object.keys(schema1)).toHaveLength(1);
      
      // Add another property
      tripleStore.add('ex:age', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:age', 'rdfs:domain', 'ex:Person');
      
      const schema2 = dataSource.getSchema();
      expect(Object.keys(schema2)).toHaveLength(2);
      expect(schema2).toHaveProperty('Person/age');
    });
  });

  describe('Complex ontologies', () => {
    it('should retrieve schema with multiple entity types and relationships', () => {
      tripleStore.add('ex:Person', 'rdf:type', 'owl:Class');
      tripleStore.add('ex:Document', 'rdf:type', 'owl:Class');
      
      tripleStore.add('ex:name', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:name', 'rdfs:domain', 'ex:Person');
      
      tripleStore.add('ex:title', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:title', 'rdfs:domain', 'ex:Document');
      
      tripleStore.add('ex:authored', 'rdf:type', 'owl:ObjectProperty');
      tripleStore.add('ex:authored', 'rdfs:domain', 'ex:Person');
      tripleStore.add('ex:authored', 'rdfs:range', 'ex:Document');
      
      const schema = dataSource.getSchema();
      
      expect(schema).toHaveProperty('Person/name');
      expect(schema).toHaveProperty('Person/authored');
      expect(schema).toHaveProperty('Document/title');
      
      expect(schema['Person/authored'].type).toBe('ref');
      expect(schema['Person/authored'].ref).toBe('Document');
    });
  });
});