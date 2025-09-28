/**
 * Unit tests for RDFSchemaExtractor.extractSchema()
 * 
 * Tests full schema extraction from RDF ontologies:
 * - Extract complete schema with all entity types and properties
 * - Map RDF types to Handle schema format
 * - Test with FOAF vocabulary
 * - Test with Schema.org vocabulary
 * - Handle multiple entity types
 * - Map property types correctly (string, number, boolean, ref)
 * - Preserve cardinality constraints
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { RDFSchemaExtractor } from '../../src/RDFSchemaExtractor.js';
import { NamespaceManager } from '../../src/NamespaceManager.js';
import { SimpleTripleStore } from '../../src/SimpleTripleStore.js';

describe('RDFSchemaExtractor.extractSchema()', () => {
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

  describe('Basic schema extraction', () => {
    it('should extract schema for single entity type with properties', () => {
      // Define simple ontology
      tripleStore.add('ex:Person', 'rdf:type', 'owl:Class');
      
      tripleStore.add('ex:name', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:name', 'rdfs:domain', 'ex:Person');
      tripleStore.add('ex:name', 'rdfs:range', 'xsd:string');
      
      tripleStore.add('ex:age', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:age', 'rdfs:domain', 'ex:Person');
      tripleStore.add('ex:age', 'rdfs:range', 'xsd:integer');
      
      const schema = schemaExtractor.extractSchema();
      
      expect(schema).toHaveProperty('Person/name');
      expect(schema).toHaveProperty('Person/age');
      
      expect(schema['Person/name']).toEqual({
        type: 'string',
        cardinality: 'many'
      });
      
      expect(schema['Person/age']).toEqual({
        type: 'number',
        cardinality: 'many'
      });
    });

    it('should extract schema for multiple entity types', () => {
      // Define two entity types
      tripleStore.add('ex:Person', 'rdf:type', 'owl:Class');
      tripleStore.add('ex:Organization', 'rdf:type', 'owl:Class');
      
      tripleStore.add('ex:name', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:name', 'rdfs:domain', 'ex:Person');
      tripleStore.add('ex:name', 'rdfs:range', 'xsd:string');
      
      tripleStore.add('ex:orgName', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:orgName', 'rdfs:domain', 'ex:Organization');
      tripleStore.add('ex:orgName', 'rdfs:range', 'xsd:string');
      
      const schema = schemaExtractor.extractSchema();
      
      expect(schema).toHaveProperty('Person/name');
      expect(schema).toHaveProperty('Organization/orgName');
      expect(schema).not.toHaveProperty('Person/orgName');
      expect(schema).not.toHaveProperty('Organization/name');
    });

    it('should return empty schema for empty ontology', () => {
      const schema = schemaExtractor.extractSchema();
      
      expect(schema).toEqual({});
    });

    it('should handle entity type with no properties', () => {
      tripleStore.add('ex:EmptyClass', 'rdf:type', 'owl:Class');
      
      const schema = schemaExtractor.extractSchema();
      
      // Should not have any entries for EmptyClass
      const emptyClassKeys = Object.keys(schema).filter(k => k.startsWith('EmptyClass/'));
      expect(emptyClassKeys).toHaveLength(0);
    });
  });

  describe('Property type mapping', () => {
    it('should map xsd:string to string type', () => {
      tripleStore.add('ex:Person', 'rdf:type', 'owl:Class');
      tripleStore.add('ex:name', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:name', 'rdfs:domain', 'ex:Person');
      tripleStore.add('ex:name', 'rdfs:range', 'xsd:string');
      
      const schema = schemaExtractor.extractSchema();
      
      expect(schema['Person/name'].type).toBe('string');
    });

    it('should map xsd:integer to number type', () => {
      tripleStore.add('ex:Person', 'rdf:type', 'owl:Class');
      tripleStore.add('ex:age', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:age', 'rdfs:domain', 'ex:Person');
      tripleStore.add('ex:age', 'rdfs:range', 'xsd:integer');
      
      const schema = schemaExtractor.extractSchema();
      
      expect(schema['Person/age'].type).toBe('number');
    });

    it('should map xsd:decimal to number type', () => {
      tripleStore.add('ex:Product', 'rdf:type', 'owl:Class');
      tripleStore.add('ex:price', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:price', 'rdfs:domain', 'ex:Product');
      tripleStore.add('ex:price', 'rdfs:range', 'xsd:decimal');
      
      const schema = schemaExtractor.extractSchema();
      
      expect(schema['Product/price'].type).toBe('number');
    });

    it('should map xsd:boolean to boolean type', () => {
      tripleStore.add('ex:Person', 'rdf:type', 'owl:Class');
      tripleStore.add('ex:active', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:active', 'rdfs:domain', 'ex:Person');
      tripleStore.add('ex:active', 'rdfs:range', 'xsd:boolean');
      
      const schema = schemaExtractor.extractSchema();
      
      expect(schema['Person/active'].type).toBe('boolean');
    });

    it('should map xsd:dateTime to date type', () => {
      tripleStore.add('ex:Event', 'rdf:type', 'owl:Class');
      tripleStore.add('ex:timestamp', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:timestamp', 'rdfs:domain', 'ex:Event');
      tripleStore.add('ex:timestamp', 'rdfs:range', 'xsd:dateTime');
      
      const schema = schemaExtractor.extractSchema();
      
      expect(schema['Event/timestamp'].type).toBe('date');
    });

    it('should map ObjectProperty to ref type with range', () => {
      tripleStore.add('ex:Person', 'rdf:type', 'owl:Class');
      tripleStore.add('ex:knows', 'rdf:type', 'owl:ObjectProperty');
      tripleStore.add('ex:knows', 'rdfs:domain', 'ex:Person');
      tripleStore.add('ex:knows', 'rdfs:range', 'ex:Person');
      
      const schema = schemaExtractor.extractSchema();
      
      expect(schema['Person/knows'].type).toBe('ref');
      expect(schema['Person/knows'].ref).toBe('Person');
    });

    it('should default to string for properties without range', () => {
      tripleStore.add('ex:Person', 'rdf:type', 'owl:Class');
      tripleStore.add('ex:label', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:label', 'rdfs:domain', 'ex:Person');
      
      const schema = schemaExtractor.extractSchema();
      
      expect(schema['Person/label'].type).toBe('string');
    });
  });

  describe('Cardinality handling', () => {
    it('should set cardinality one for FunctionalProperty', () => {
      tripleStore.add('ex:Person', 'rdf:type', 'owl:Class');
      tripleStore.add('ex:email', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:email', 'rdf:type', 'owl:FunctionalProperty');
      tripleStore.add('ex:email', 'rdfs:domain', 'ex:Person');
      tripleStore.add('ex:email', 'rdfs:range', 'xsd:string');
      
      const schema = schemaExtractor.extractSchema();
      
      expect(schema['Person/email'].cardinality).toBe('one');
    });

    it('should set cardinality many for non-functional properties', () => {
      tripleStore.add('ex:Person', 'rdf:type', 'owl:Class');
      tripleStore.add('ex:hobby', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:hobby', 'rdfs:domain', 'ex:Person');
      
      const schema = schemaExtractor.extractSchema();
      
      expect(schema['Person/hobby'].cardinality).toBe('many');
    });

    it('should mix functional and non-functional properties', () => {
      tripleStore.add('ex:Person', 'rdf:type', 'owl:Class');
      
      tripleStore.add('ex:id', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:id', 'rdf:type', 'owl:FunctionalProperty');
      tripleStore.add('ex:id', 'rdfs:domain', 'ex:Person');
      
      tripleStore.add('ex:tag', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:tag', 'rdfs:domain', 'ex:Person');
      
      const schema = schemaExtractor.extractSchema();
      
      expect(schema['Person/id'].cardinality).toBe('one');
      expect(schema['Person/tag'].cardinality).toBe('many');
    });
  });

  describe('FOAF ontology', () => {
    it('should extract FOAF Person schema', () => {
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
      
      tripleStore.add('foaf:mbox', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('foaf:mbox', 'rdf:type', 'owl:FunctionalProperty');
      tripleStore.add('foaf:mbox', 'rdfs:domain', 'foaf:Person');
      
      const schema = schemaExtractor.extractSchema();
      
      expect(schema).toHaveProperty('Person/name');
      expect(schema).toHaveProperty('Person/age');
      expect(schema).toHaveProperty('Person/knows');
      expect(schema).toHaveProperty('Person/mbox');
      
      expect(schema['Person/name'].type).toBe('string');
      expect(schema['Person/age'].type).toBe('number');
      expect(schema['Person/knows'].type).toBe('ref');
      expect(schema['Person/knows'].ref).toBe('Person');
      expect(schema['Person/mbox'].cardinality).toBe('one');
    });

    it('should extract FOAF Organization schema', () => {
      tripleStore.add('foaf:Organization', 'rdf:type', 'owl:Class');
      
      tripleStore.add('foaf:name', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('foaf:name', 'rdfs:domain', 'foaf:Organization');
      tripleStore.add('foaf:name', 'rdfs:range', 'xsd:string');
      
      tripleStore.add('foaf:member', 'rdf:type', 'owl:ObjectProperty');
      tripleStore.add('foaf:member', 'rdfs:domain', 'foaf:Organization');
      tripleStore.add('foaf:member', 'rdfs:range', 'foaf:Person');
      
      const schema = schemaExtractor.extractSchema();
      
      expect(schema).toHaveProperty('Organization/name');
      expect(schema).toHaveProperty('Organization/member');
      expect(schema['Organization/member'].type).toBe('ref');
      expect(schema['Organization/member'].ref).toBe('Person');
    });
  });

  describe('Schema.org vocabulary', () => {
    it('should extract Schema.org Person schema', () => {
      tripleStore.add('schema:Person', 'rdf:type', 'rdfs:Class');
      
      tripleStore.add('schema:name', 'rdf:type', 'rdf:Property');
      tripleStore.add('schema:name', 'rdfs:domain', 'schema:Person');
      tripleStore.add('schema:name', 'rdfs:range', 'xsd:string');
      
      tripleStore.add('schema:email', 'rdf:type', 'rdf:Property');
      tripleStore.add('schema:email', 'rdfs:domain', 'schema:Person');
      tripleStore.add('schema:email', 'rdfs:range', 'xsd:string');
      
      tripleStore.add('schema:birthDate', 'rdf:type', 'rdf:Property');
      tripleStore.add('schema:birthDate', 'rdfs:domain', 'schema:Person');
      tripleStore.add('schema:birthDate', 'rdfs:range', 'xsd:dateTime');
      
      const schema = schemaExtractor.extractSchema();
      
      expect(schema).toHaveProperty('Person/name');
      expect(schema).toHaveProperty('Person/email');
      expect(schema).toHaveProperty('Person/birthDate');
      
      expect(schema['Person/birthDate'].type).toBe('date');
    });

    it('should extract Schema.org Article schema', () => {
      tripleStore.add('schema:Article', 'rdf:type', 'rdfs:Class');
      
      tripleStore.add('schema:headline', 'rdf:type', 'rdf:Property');
      tripleStore.add('schema:headline', 'rdfs:domain', 'schema:Article');
      tripleStore.add('schema:headline', 'rdfs:range', 'xsd:string');
      
      tripleStore.add('schema:author', 'rdf:type', 'rdf:Property');
      tripleStore.add('schema:author', 'rdfs:domain', 'schema:Article');
      tripleStore.add('schema:author', 'rdfs:range', 'schema:Person');
      
      tripleStore.add('schema:wordCount', 'rdf:type', 'rdf:Property');
      tripleStore.add('schema:wordCount', 'rdfs:domain', 'schema:Article');
      tripleStore.add('schema:wordCount', 'rdfs:range', 'xsd:integer');
      
      const schema = schemaExtractor.extractSchema();
      
      expect(schema).toHaveProperty('Article/headline');
      expect(schema).toHaveProperty('Article/author');
      expect(schema).toHaveProperty('Article/wordCount');
      
      expect(schema['Article/author'].type).toBe('ref');
      expect(schema['Article/author'].ref).toBe('Person');
      expect(schema['Article/wordCount'].type).toBe('number');
    });
  });

  describe('Complex ontologies', () => {
    it('should handle ontology with multiple entity types and relationships', () => {
      // Define a small ontology with Person, Document, and relationships
      tripleStore.add('ex:Person', 'rdf:type', 'owl:Class');
      tripleStore.add('ex:Document', 'rdf:type', 'owl:Class');
      
      // Person properties
      tripleStore.add('ex:name', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:name', 'rdfs:domain', 'ex:Person');
      tripleStore.add('ex:name', 'rdfs:range', 'xsd:string');
      
      // Document properties
      tripleStore.add('ex:title', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:title', 'rdfs:domain', 'ex:Document');
      tripleStore.add('ex:title', 'rdfs:range', 'xsd:string');
      
      // Relationships
      tripleStore.add('ex:authored', 'rdf:type', 'owl:ObjectProperty');
      tripleStore.add('ex:authored', 'rdfs:domain', 'ex:Person');
      tripleStore.add('ex:authored', 'rdfs:range', 'ex:Document');
      
      tripleStore.add('ex:cites', 'rdf:type', 'owl:ObjectProperty');
      tripleStore.add('ex:cites', 'rdfs:domain', 'ex:Document');
      tripleStore.add('ex:cites', 'rdfs:range', 'ex:Document');
      
      const schema = schemaExtractor.extractSchema();
      
      // Check all entity types have their properties
      expect(schema).toHaveProperty('Person/name');
      expect(schema).toHaveProperty('Person/authored');
      expect(schema).toHaveProperty('Document/title');
      expect(schema).toHaveProperty('Document/cites');
      
      // Check relationships are correct
      expect(schema['Person/authored'].ref).toBe('Document');
      expect(schema['Document/cites'].ref).toBe('Document');
    });

    it('should handle properties with multiple domains', () => {
      tripleStore.add('ex:Person', 'rdf:type', 'owl:Class');
      tripleStore.add('ex:Organization', 'rdf:type', 'owl:Class');
      
      // Property applicable to both
      tripleStore.add('ex:name', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:name', 'rdfs:domain', 'ex:Person');
      tripleStore.add('ex:name', 'rdfs:domain', 'ex:Organization');
      tripleStore.add('ex:name', 'rdfs:range', 'xsd:string');
      
      const schema = schemaExtractor.extractSchema();
      
      // Should appear for both types
      expect(schema).toHaveProperty('Person/name');
      expect(schema).toHaveProperty('Organization/name');
      expect(schema['Person/name'].type).toBe('string');
      expect(schema['Organization/name'].type).toBe('string');
    });
  });

  describe('Schema format', () => {
    it('should use TypeName/propertyName format for keys', () => {
      tripleStore.add('ex:Person', 'rdf:type', 'owl:Class');
      tripleStore.add('ex:name', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:name', 'rdfs:domain', 'ex:Person');
      
      const schema = schemaExtractor.extractSchema();
      
      const keys = Object.keys(schema);
      expect(keys).toContain('Person/name');
      expect(keys[0]).toMatch(/^[^/]+\/[^/]+$/); // TypeName/propertyName pattern
    });

    it('should return plain object (not Map or other structure)', () => {
      tripleStore.add('ex:Person', 'rdf:type', 'owl:Class');
      tripleStore.add('ex:name', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:name', 'rdfs:domain', 'ex:Person');
      
      const schema = schemaExtractor.extractSchema();
      
      expect(typeof schema).toBe('object');
      expect(schema.constructor).toBe(Object);
      expect(Array.isArray(schema)).toBe(false);
    });

    it('should include all required schema fields', () => {
      tripleStore.add('ex:Person', 'rdf:type', 'owl:Class');
      tripleStore.add('ex:name', 'rdf:type', 'owl:DatatypeProperty');
      tripleStore.add('ex:name', 'rdfs:domain', 'ex:Person');
      tripleStore.add('ex:name', 'rdfs:range', 'xsd:string');
      
      const schema = schemaExtractor.extractSchema();
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
      
      const schema = schemaExtractor.extractSchema();
      const entry = schema['Person/knows'];
      
      expect(entry).toHaveProperty('ref');
      expect(typeof entry.ref).toBe('string');
      expect(entry.ref).toBe('Person');
    });
  });
});