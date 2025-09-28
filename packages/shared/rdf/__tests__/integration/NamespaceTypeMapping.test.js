/**
 * Integration tests for NamespaceManager and RDFTypeMapper working together
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { NamespaceManager } from '../../src/NamespaceManager.js';
import { RDFTypeMapper } from '../../src/RDFTypeMapper.js';

describe('NamespaceManager + RDFTypeMapper Integration', () => {
  let namespaceManager;

  beforeEach(() => {
    namespaceManager = new NamespaceManager();
    namespaceManager.addNamespace('ex', 'http://example.org/');
  });

  describe('Namespace expansion with typed literals', () => {
    it('should expand property URIs and preserve typed values', () => {
      // Simulate RDF triple with CURIE and typed literal
      const property = 'ex:age';
      const value = 30;

      // Expand property
      const expandedProperty = namespaceManager.expandPrefix(property);
      expect(expandedProperty).toBe('http://example.org/age');

      // Convert value to RDF
      const rdfValue = RDFTypeMapper.jsTypeToRDF(value);
      expect(rdfValue).toEqual({
        value: '30',
        datatype: 'http://www.w3.org/2001/XMLSchema#integer'
      });

      // Contract datatype URI
      const contractedDatatype = namespaceManager.contractUri(rdfValue.datatype);
      expect(contractedDatatype).toBe('xsd:integer');
    });

    it('should handle string properties with namespace', () => {
      const property = 'foaf:name';
      const value = 'Alice Smith';

      const expandedProperty = namespaceManager.expandPrefix(property);
      expect(expandedProperty).toBe('http://xmlns.com/foaf/0.1/name');

      const rdfValue = RDFTypeMapper.jsTypeToRDF(value);
      expect(rdfValue.datatype).toBe('http://www.w3.org/2001/XMLSchema#string');

      const contractedDatatype = namespaceManager.contractUri(rdfValue.datatype);
      expect(contractedDatatype).toBe('xsd:string');
    });

    it('should handle boolean properties with namespace', () => {
      const property = 'ex:active';
      const value = true;

      const expandedProperty = namespaceManager.expandPrefix(property);
      const rdfValue = RDFTypeMapper.jsTypeToRDF(value);

      expect(expandedProperty).toBe('http://example.org/active');
      expect(rdfValue.value).toBe('true');
      expect(namespaceManager.contractUri(rdfValue.datatype)).toBe('xsd:boolean');
    });

    it('should handle Date properties with namespace', () => {
      const property = 'schema:datePublished';
      const value = new Date('2024-01-15T10:30:00Z');

      const expandedProperty = namespaceManager.expandPrefix(property);
      const rdfValue = RDFTypeMapper.jsTypeToRDF(value);

      expect(expandedProperty).toBe('https://schema.org/datePublished');
      expect(rdfValue.datatype).toBe('http://www.w3.org/2001/XMLSchema#dateTime');
      expect(namespaceManager.contractUri(rdfValue.datatype)).toBe('xsd:dateTime');
    });
  });

  describe('Namespace contraction with typed values', () => {
    it('should contract URIs in complete RDF triple', () => {
      // Full RDF triple with URIs
      const subject = 'http://example.org/alice';
      const predicate = 'http://xmlns.com/foaf/0.1/age';
      const object = {
        value: '30',
        datatype: 'http://www.w3.org/2001/XMLSchema#integer'
      };

      // Contract all URIs
      const contractedSubject = namespaceManager.contractUri(subject);
      const contractedPredicate = namespaceManager.contractUri(predicate);
      const contractedDatatype = namespaceManager.contractUri(object.datatype);

      expect(contractedSubject).toBe('ex:alice');
      expect(contractedPredicate).toBe('foaf:age');
      expect(contractedDatatype).toBe('xsd:integer');

      // Convert value back to JS
      const jsValue = RDFTypeMapper.rdfToJSType(object);
      expect(jsValue).toBe(30);
      expect(typeof jsValue).toBe('number');
    });

    it('should handle mixed contracted and full URIs', () => {
      const triple = {
        subject: 'ex:alice',
        predicate: 'http://xmlns.com/foaf/0.1/name',
        object: {
          value: 'Alice Smith',
          datatype: 'xsd:string'
        }
      };

      // Expand what needs expanding
      const expandedSubject = namespaceManager.expandPrefix(triple.subject);
      const expandedPredicate = namespaceManager.expandPrefix(triple.predicate);
      const expandedDatatype = namespaceManager.expandPrefix(triple.object.datatype);

      expect(expandedSubject).toBe('http://example.org/alice');
      expect(expandedPredicate).toBe('http://xmlns.com/foaf/0.1/name');
      expect(expandedDatatype).toBe('http://www.w3.org/2001/XMLSchema#string');
    });
  });

  describe('Round-trip conversions', () => {
    it('should preserve data through namespace and type round-trips', () => {
      // Start with JavaScript entity
      const entity = {
        id: 'http://example.org/alice',
        name: 'Alice Smith',
        age: 30,
        active: true,
        joined: new Date('2024-01-15T10:30:00Z')
      };

      // Convert to RDF representation
      const rdfTriples = [];
      
      for (const [key, value] of Object.entries(entity)) {
        if (key === 'id') continue;
        
        const property = `ex:${key}`;
        const expandedProperty = namespaceManager.expandPrefix(property);
        const rdfValue = RDFTypeMapper.jsTypeToRDF(value);
        
        rdfTriples.push({
          subject: entity.id,
          predicate: expandedProperty,
          object: rdfValue
        });
      }

      // Verify RDF representation
      expect(rdfTriples).toHaveLength(4);
      expect(rdfTriples[0].predicate).toBe('http://example.org/name');
      expect(rdfTriples[1].predicate).toBe('http://example.org/age');
      expect(rdfTriples[2].predicate).toBe('http://example.org/active');
      expect(rdfTriples[3].predicate).toBe('http://example.org/joined');

      // Convert back to JavaScript
      const restored = { id: entity.id };
      
      for (const triple of rdfTriples) {
        const contractedPredicate = namespaceManager.contractUri(triple.predicate);
        const localName = contractedPredicate.split(':')[1];
        const jsValue = RDFTypeMapper.rdfToJSType(triple.object);
        restored[localName] = jsValue;
      }

      // Verify restoration
      expect(restored.name).toBe(entity.name);
      expect(restored.age).toBe(entity.age);
      expect(restored.active).toBe(entity.active);
      expect(restored.joined.toISOString()).toBe(entity.joined.toISOString());
    });

    it('should handle entity with multiple values and namespaces', () => {
      // Add more namespaces
      namespaceManager.addNamespace('dc', 'http://purl.org/dc/elements/1.1/');

      const entity = {
        'ex:name': 'Test Article',
        'dc:creator': 'John Doe',
        'dc:date': new Date('2024-01-01'),
        'ex:wordCount': 1500,
        'ex:published': true
      };

      // Expand all CURIEs and convert values
      const expanded = {};
      for (const [curie, value] of Object.entries(entity)) {
        const fullUri = namespaceManager.expandPrefix(curie);
        const rdfValue = RDFTypeMapper.jsTypeToRDF(value);
        expanded[fullUri] = rdfValue;
      }

      // Verify expansion
      expect(expanded['http://example.org/name']).toBeDefined();
      expect(expanded['http://purl.org/dc/elements/1.1/creator']).toBeDefined();
      expect(expanded['http://purl.org/dc/elements/1.1/date']).toBeDefined();

      // Contract back and restore
      const restored = {};
      for (const [fullUri, rdfValue] of Object.entries(expanded)) {
        const curie = namespaceManager.contractUri(fullUri);
        const jsValue = RDFTypeMapper.rdfToJSType(rdfValue);
        restored[curie] = jsValue;
      }

      // Verify restoration
      expect(restored['ex:name']).toBe('Test Article');
      expect(restored['dc:creator']).toBe('John Doe');
      expect(restored['dc:date']).toBeInstanceOf(Date);
      expect(restored['ex:wordCount']).toBe(1500);
      expect(restored['ex:published']).toBe(true);
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle values without namespace prefix', () => {
      const fullUri = 'http://example.org/property';
      const value = 'test';

      // Contract URI (has namespace)
      const contracted = namespaceManager.contractUri(fullUri);
      expect(contracted).toBe('ex:property');

      // Convert value
      const rdfValue = RDFTypeMapper.jsTypeToRDF(value);
      expect(rdfValue.value).toBe('test');
    });

    it('should handle unknown namespaces gracefully', () => {
      const unknownCurie = 'unknown:property';
      const value = 42;

      // Unknown prefix stays as-is
      const expanded = namespaceManager.expandPrefix(unknownCurie);
      expect(expanded).toBe(unknownCurie);

      // Value conversion still works
      const rdfValue = RDFTypeMapper.jsTypeToRDF(value);
      expect(rdfValue.value).toBe('42');
      expect(rdfValue.datatype).toBe('http://www.w3.org/2001/XMLSchema#integer');
    });

    it('should handle null values with namespaces', () => {
      const property = 'ex:optional';
      const value = null;

      const expandedProperty = namespaceManager.expandPrefix(property);
      expect(expandedProperty).toBe('http://example.org/optional');

      const rdfValue = RDFTypeMapper.jsTypeToRDF(value);
      expect(rdfValue).toBe(null);
    });
  });

  describe('Real-world scenarios', () => {
    it('should support FOAF vocabulary with proper types', () => {
      const person = {
        'foaf:name': 'Alice Smith',
        'foaf:age': 30,
        'foaf:homepage': 'http://alice.example.com',
        'foaf:birthday': new Date('1994-03-15')
      };

      // Process each property
      const processed = {};
      for (const [curie, value] of Object.entries(person)) {
        const fullUri = namespaceManager.expandPrefix(curie);
        const rdfValue = RDFTypeMapper.jsTypeToRDF(value);
        processed[fullUri] = rdfValue;
      }

      // Verify FOAF URIs
      expect(processed['http://xmlns.com/foaf/0.1/name']).toBeDefined();
      expect(processed['http://xmlns.com/foaf/0.1/age']).toBeDefined();
      expect(processed['http://xmlns.com/foaf/0.1/homepage']).toBeDefined();
      expect(processed['http://xmlns.com/foaf/0.1/birthday']).toBeDefined();

      // Verify types
      expect(processed['http://xmlns.com/foaf/0.1/name'].datatype).toContain('string');
      expect(processed['http://xmlns.com/foaf/0.1/age'].datatype).toContain('integer');
      expect(processed['http://xmlns.com/foaf/0.1/birthday'].datatype).toContain('dateTime');
    });

    it('should support Schema.org vocabulary', () => {
      const article = {
        'schema:headline': 'Breaking News',
        'schema:wordCount': 1500,
        'schema:datePublished': new Date('2024-01-15'),
        'schema:isAccessibleForFree': true
      };

      const triples = Object.entries(article).map(([curie, value]) => ({
        predicate: namespaceManager.expandPrefix(curie),
        object: RDFTypeMapper.jsTypeToRDF(value)
      }));

      // Verify Schema.org URIs
      expect(triples[0].predicate).toBe('https://schema.org/headline');
      expect(triples[1].predicate).toBe('https://schema.org/wordCount');
      expect(triples[2].predicate).toBe('https://schema.org/datePublished');
      expect(triples[3].predicate).toBe('https://schema.org/isAccessibleForFree');

      // Verify all have proper types
      triples.forEach(triple => {
        expect(triple.object).not.toBe(null);
        expect(triple.object.datatype).toBeDefined();
      });
    });
  });
});