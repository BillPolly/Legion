/**
 * Integration tests for RDFSchemaExtractor with @legion/triplestore
 * 
 * Tests complete workflow:
 * - Parse RDF ontology (Turtle format) with RDFParser
 * - Store in SimpleTripleStore
 * - Extract schema using RDFSchemaExtractor
 * - Validate schema matches expected Handle format
 * - Test with real FOAF ontology snippets
 * - Test with custom domain ontologies
 * 
 * NO MOCKS - Uses real RDFParser, SimpleTripleStore, NamespaceManager
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { RDFSchemaExtractor } from '../../src/RDFSchemaExtractor.js';
import { RDFParser } from '../../src/RDFParser.js';
import { NamespaceManager } from '../../src/NamespaceManager.js';
import { SimpleTripleStore } from '../../src/SimpleTripleStore.js';

describe('RDFSchemaExtractor Integration with TripleStore', () => {
  let parser;
  let tripleStore;
  let namespaceManager;
  let schemaExtractor;

  beforeEach(() => {
    tripleStore = new SimpleTripleStore();
    namespaceManager = new NamespaceManager();
    parser = new RDFParser(tripleStore, namespaceManager);
    schemaExtractor = new RDFSchemaExtractor(tripleStore, namespaceManager);
  });

  describe('FOAF Ontology Schema Extraction', () => {
    it('should extract FOAF Person schema from Turtle ontology', () => {
      // FOAF Person ontology snippet in Turtle
      const foafOntology = `
        @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        @prefix owl: <http://www.w3.org/2002/07/owl#> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .

        foaf:Person a owl:Class ;
          rdfs:label "Person" .

        foaf:name a owl:DatatypeProperty ;
          rdfs:domain foaf:Person ;
          rdfs:range xsd:string ;
          rdfs:label "name" .

        foaf:age a owl:DatatypeProperty ;
          rdfs:domain foaf:Person ;
          rdfs:range xsd:integer ;
          rdfs:label "age" .

        foaf:mbox a owl:DatatypeProperty, owl:FunctionalProperty ;
          rdfs:domain foaf:Person ;
          rdfs:range xsd:string ;
          rdfs:label "email" .

        foaf:knows a owl:ObjectProperty ;
          rdfs:domain foaf:Person ;
          rdfs:range foaf:Person ;
          rdfs:label "knows" .
      `;

      // Parse ontology into triple store
      parser.parseTurtle(foafOntology);

      // Extract schema
      const schema = schemaExtractor.extractSchema();

      // Validate schema structure
      expect(schema).toHaveProperty('Person/name');
      expect(schema).toHaveProperty('Person/age');
      expect(schema).toHaveProperty('Person/mbox');
      expect(schema).toHaveProperty('Person/knows');

      // Validate data types
      expect(schema['Person/name'].type).toBe('string');
      expect(schema['Person/age'].type).toBe('number');
      expect(schema['Person/knows'].type).toBe('ref');
      expect(schema['Person/knows'].ref).toBe('Person');

      // Validate cardinality
      expect(schema['Person/mbox'].cardinality).toBe('one'); // FunctionalProperty
      expect(schema['Person/name'].cardinality).toBe('many');
      expect(schema['Person/knows'].cardinality).toBe('many');
    });

    it('should extract FOAF Organization schema', () => {
      const foafOrgOntology = `
        @prefix owl: <http://www.w3.org/2002/07/owl#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .

        foaf:Organization a owl:Class .
        foaf:Person a owl:Class .

        foaf:name a owl:DatatypeProperty ;
          rdfs:domain foaf:Organization ;
          rdfs:range xsd:string .

        foaf:homepage a owl:DatatypeProperty ;
          rdfs:domain foaf:Organization ;
          rdfs:range xsd:anyURI .

        foaf:member a owl:ObjectProperty ;
          rdfs:domain foaf:Organization ;
          rdfs:range foaf:Person .
      `;

      parser.parseTurtle(foafOrgOntology);
      const schema = schemaExtractor.extractSchema();

      expect(schema).toHaveProperty('Organization/name');
      expect(schema).toHaveProperty('Organization/homepage');
      expect(schema).toHaveProperty('Organization/member');

      expect(schema['Organization/name'].type).toBe('string');
      expect(schema['Organization/homepage'].type).toBe('string'); // anyURI → string
      expect(schema['Organization/member'].type).toBe('ref');
      expect(schema['Organization/member'].ref).toBe('Person');
    });
  });

  describe('Custom Domain Ontology Extraction', () => {
    it('should extract schema from library domain ontology', () => {
      const libraryOntology = `
        @prefix : <http://example.org/library#> .
        @prefix owl: <http://www.w3.org/2002/07/owl#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        :Book a owl:Class .
        :Author a owl:Class .
        :Publisher a owl:Class .

        :title a owl:DatatypeProperty ;
          rdfs:domain :Book ;
          rdfs:range xsd:string .

        :isbn a owl:DatatypeProperty, owl:FunctionalProperty ;
          rdfs:domain :Book ;
          rdfs:range xsd:string .

        :publishedYear a owl:DatatypeProperty ;
          rdfs:domain :Book ;
          rdfs:range xsd:integer .

        :inStock a owl:DatatypeProperty ;
          rdfs:domain :Book ;
          rdfs:range xsd:boolean .

        :writtenBy a owl:ObjectProperty ;
          rdfs:domain :Book ;
          rdfs:range :Author .

        :publishedBy a owl:ObjectProperty, owl:FunctionalProperty ;
          rdfs:domain :Book ;
          rdfs:range :Publisher .

        :authorName a owl:DatatypeProperty ;
          rdfs:domain :Author ;
          rdfs:range xsd:string .
      `;

      // Add custom namespace
      namespaceManager.addNamespace('library', 'http://example.org/library#');
      
      parser.parseTurtle(libraryOntology);
      const schema = schemaExtractor.extractSchema();

      // Validate Book entity
      expect(schema['Book/title'].type).toBe('string');
      expect(schema['Book/isbn'].type).toBe('string');
      expect(schema['Book/isbn'].cardinality).toBe('one');
      expect(schema['Book/publishedYear'].type).toBe('number');
      expect(schema['Book/inStock'].type).toBe('boolean');
      expect(schema['Book/writtenBy'].type).toBe('ref');
      expect(schema['Book/writtenBy'].ref).toBe('Author');
      expect(schema['Book/publishedBy'].type).toBe('ref');
      expect(schema['Book/publishedBy'].cardinality).toBe('one');

      // Validate Author entity
      expect(schema['Author/authorName'].type).toBe('string');

      // Should have all three entity types
      const entityTypes = schemaExtractor.getEntityTypes();
      expect(entityTypes).toHaveLength(3);
    });

    it('should extract schema from e-commerce ontology', () => {
      const ecommerceOntology = `
        @prefix : <http://example.org/shop#> .
        @prefix owl: <http://www.w3.org/2002/07/owl#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        :Product a owl:Class .
        :Customer a owl:Class .
        :Order a owl:Class .

        :productName a owl:DatatypeProperty ;
          rdfs:domain :Product ;
          rdfs:range xsd:string .

        :price a owl:DatatypeProperty ;
          rdfs:domain :Product ;
          rdfs:range xsd:decimal .

        :sku a owl:DatatypeProperty, owl:FunctionalProperty ;
          rdfs:domain :Product ;
          rdfs:range xsd:string .

        :customerEmail a owl:DatatypeProperty, owl:FunctionalProperty ;
          rdfs:domain :Customer ;
          rdfs:range xsd:string .

        :orderedBy a owl:ObjectProperty, owl:FunctionalProperty ;
          rdfs:domain :Order ;
          rdfs:range :Customer .

        :contains a owl:ObjectProperty ;
          rdfs:domain :Order ;
          rdfs:range :Product .

        :orderDate a owl:DatatypeProperty ;
          rdfs:domain :Order ;
          rdfs:range xsd:dateTime .
      `;

      namespaceManager.addNamespace('shop', 'http://example.org/shop#');
      
      parser.parseTurtle(ecommerceOntology);
      const schema = schemaExtractor.extractSchema();

      // Validate Product
      expect(schema['Product/productName'].type).toBe('string');
      expect(schema['Product/price'].type).toBe('number');
      expect(schema['Product/sku'].cardinality).toBe('one');

      // Validate Customer
      expect(schema['Customer/customerEmail'].type).toBe('string');
      expect(schema['Customer/customerEmail'].cardinality).toBe('one');

      // Validate Order
      expect(schema['Order/orderedBy'].type).toBe('ref');
      expect(schema['Order/orderedBy'].ref).toBe('Customer');
      expect(schema['Order/orderedBy'].cardinality).toBe('one');
      expect(schema['Order/contains'].type).toBe('ref');
      expect(schema['Order/contains'].ref).toBe('Product');
      expect(schema['Order/orderDate'].type).toBe('date');
    });
  });

  describe('Multiple Entity Types and Relationships', () => {
    it('should extract complete schema with multiple entity types', () => {
      const multiEntityOntology = `
        @prefix : <http://example.org/org#> .
        @prefix owl: <http://www.w3.org/2002/07/owl#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        :Employee a owl:Class .
        :Department a owl:Class .
        :Project a owl:Class .

        :employeeName a owl:DatatypeProperty ;
          rdfs:domain :Employee ;
          rdfs:range xsd:string .

        :employeeId a owl:DatatypeProperty, owl:FunctionalProperty ;
          rdfs:domain :Employee ;
          rdfs:range xsd:string .

        :salary a owl:DatatypeProperty ;
          rdfs:domain :Employee ;
          rdfs:range xsd:decimal .

        :worksIn a owl:ObjectProperty, owl:FunctionalProperty ;
          rdfs:domain :Employee ;
          rdfs:range :Department .

        :worksOn a owl:ObjectProperty ;
          rdfs:domain :Employee ;
          rdfs:range :Project .

        :departmentName a owl:DatatypeProperty ;
          rdfs:domain :Department ;
          rdfs:range xsd:string .

        :projectName a owl:DatatypeProperty ;
          rdfs:domain :Project ;
          rdfs:range xsd:string .

        :startDate a owl:DatatypeProperty ;
          rdfs:domain :Project ;
          rdfs:range xsd:date .
      `;

      namespaceManager.addNamespace('org', 'http://example.org/org#');
      
      parser.parseTurtle(multiEntityOntology);
      const schema = schemaExtractor.extractSchema();

      // Should have entries for all three entity types
      const employeeKeys = Object.keys(schema).filter(k => k.startsWith('Employee/'));
      const departmentKeys = Object.keys(schema).filter(k => k.startsWith('Department/'));
      const projectKeys = Object.keys(schema).filter(k => k.startsWith('Project/'));

      expect(employeeKeys.length).toBeGreaterThan(0);
      expect(departmentKeys.length).toBeGreaterThan(0);
      expect(projectKeys.length).toBeGreaterThan(0);

      // Validate relationships
      expect(schema['Employee/worksIn'].type).toBe('ref');
      expect(schema['Employee/worksIn'].ref).toBe('Department');
      expect(schema['Employee/worksIn'].cardinality).toBe('one');

      expect(schema['Employee/worksOn'].type).toBe('ref');
      expect(schema['Employee/worksOn'].ref).toBe('Project');
      expect(schema['Employee/worksOn'].cardinality).toBe('many');

      // Validate data types
      expect(schema['Employee/salary'].type).toBe('number');
      expect(schema['Project/startDate'].type).toBe('date');
    });

    it('should handle properties with shared names across entity types', () => {
      const sharedPropertiesOntology = `
        @prefix : <http://example.org/shared#> .
        @prefix owl: <http://www.w3.org/2002/07/owl#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        :Person a owl:Class .
        :Company a owl:Class .

        :name a owl:DatatypeProperty ;
          rdfs:domain :Person ;
          rdfs:domain :Company ;
          rdfs:range xsd:string .

        :email a owl:DatatypeProperty ;
          rdfs:domain :Person ;
          rdfs:range xsd:string .

        :website a owl:DatatypeProperty ;
          rdfs:domain :Company ;
          rdfs:range xsd:anyURI .
      `;

      namespaceManager.addNamespace('shared', 'http://example.org/shared#');
      
      parser.parseTurtle(sharedPropertiesOntology);
      const schema = schemaExtractor.extractSchema();

      // Both entity types should have 'name' property
      expect(schema).toHaveProperty('Person/name');
      expect(schema).toHaveProperty('Company/name');
      expect(schema['Person/name'].type).toBe('string');
      expect(schema['Company/name'].type).toBe('string');

      // But unique properties should be separate
      expect(schema).toHaveProperty('Person/email');
      expect(schema).toHaveProperty('Company/website');
      expect(schema).not.toHaveProperty('Person/website');
      expect(schema).not.toHaveProperty('Company/email');
    });
  });

  describe('Handle Schema Format Validation', () => {
    it('should produce schema that matches Handle format exactly', () => {
      const testOntology = `
        @prefix : <http://example.org/test#> .
        @prefix owl: <http://www.w3.org/2002/07/owl#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        :User a owl:Class .

        :username a owl:DatatypeProperty, owl:FunctionalProperty ;
          rdfs:domain :User ;
          rdfs:range xsd:string .

        :age a owl:DatatypeProperty ;
          rdfs:domain :User ;
          rdfs:range xsd:integer .

        :active a owl:DatatypeProperty ;
          rdfs:domain :User ;
          rdfs:range xsd:boolean .

        :createdAt a owl:DatatypeProperty ;
          rdfs:domain :User ;
          rdfs:range xsd:dateTime .

        :tags a owl:DatatypeProperty ;
          rdfs:domain :User ;
          rdfs:range xsd:string .

        :friend a owl:ObjectProperty ;
          rdfs:domain :User ;
          rdfs:range :User .
      `;

      namespaceManager.addNamespace('test', 'http://example.org/test#');
      
      parser.parseTurtle(testOntology);
      const schema = schemaExtractor.extractSchema();

      // Validate exact Handle schema format
      const expectedSchema = {
        'User/username': {
          type: 'string',
          cardinality: 'one'
        },
        'User/age': {
          type: 'number',
          cardinality: 'many'
        },
        'User/active': {
          type: 'boolean',
          cardinality: 'many'
        },
        'User/createdAt': {
          type: 'date',
          cardinality: 'many'
        },
        'User/tags': {
          type: 'string',
          cardinality: 'many'
        },
        'User/friend': {
          type: 'ref',
          cardinality: 'many',
          ref: 'User'
        }
      };

      expect(schema).toEqual(expectedSchema);
    });

    it('should return plain object suitable for Handle introspection', () => {
      const simpleOntology = `
        @prefix : <http://example.org/simple#> .
        @prefix owl: <http://www.w3.org/2002/07/owl#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        :Thing a owl:Class .

        :label a owl:DatatypeProperty ;
          rdfs:domain :Thing ;
          rdfs:range xsd:string .
      `;

      namespaceManager.addNamespace('simple', 'http://example.org/simple#');
      
      parser.parseTurtle(simpleOntology);
      const schema = schemaExtractor.extractSchema();

      // Must be plain object
      expect(typeof schema).toBe('object');
      expect(schema.constructor).toBe(Object);
      expect(Array.isArray(schema)).toBe(false);

      // Must have string keys
      const keys = Object.keys(schema);
      expect(keys.length).toBeGreaterThan(0);
      expect(typeof keys[0]).toBe('string');

      // Values must be plain objects with required fields
      const value = Object.values(schema)[0];
      expect(value).toHaveProperty('type');
      expect(value).toHaveProperty('cardinality');
      expect(['string', 'number', 'boolean', 'date', 'ref']).toContain(value.type);
      expect(['one', 'many']).toContain(value.cardinality);
    });
  });

  describe('Empty and Edge Cases', () => {
    it('should handle empty ontology gracefully', () => {
      const emptyOntology = `
        @prefix owl: <http://www.w3.org/2002/07/owl#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
      `;

      parser.parseTurtle(emptyOntology);
      const schema = schemaExtractor.extractSchema();

      expect(schema).toEqual({});
    });

    it('should handle ontology with only class definitions (no properties)', () => {
      const classOnlyOntology = `
        @prefix : <http://example.org/empty#> .
        @prefix owl: <http://www.w3.org/2002/07/owl#> .

        :EmptyClass a owl:Class .
        :AnotherEmpty a owl:Class .
      `;

      namespaceManager.addNamespace('empty', 'http://example.org/empty#');
      
      parser.parseTurtle(classOnlyOntology);
      const schema = schemaExtractor.extractSchema();

      // Should return empty schema (no properties to extract)
      expect(schema).toEqual({});
    });

    it('should handle large ontology with many entity types', () => {
      // Create ontology with 10 entity types, each with 5 properties
      let ontology = `
        @prefix : <http://example.org/large#> .
        @prefix owl: <http://www.w3.org/2002/07/owl#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
      `;

      for (let i = 0; i < 10; i++) {
        ontology += `\n        :Type${i} a owl:Class .`;
        
        for (let j = 0; j < 5; j++) {
          ontology += `
        :type${i}prop${j} a owl:DatatypeProperty ;
          rdfs:domain :Type${i} ;
          rdfs:range xsd:string .`;
        }
      }

      namespaceManager.addNamespace('large', 'http://example.org/large#');
      
      parser.parseTurtle(ontology);
      const schema = schemaExtractor.extractSchema();

      // Should have 10 * 5 = 50 schema entries
      const keys = Object.keys(schema);
      expect(keys.length).toBe(50);

      // Validate a sample entry
      expect(schema['Type0/type0prop0'].type).toBe('string');
      expect(schema['Type9/type9prop4'].type).toBe('string');
    });
  });
});