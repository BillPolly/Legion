/**
 * Unit tests for RDFSerializer
 * 
 * Tests serialization of triples to various RDF formats (Turtle, N-Triples, JSON-LD)
 * with type preservation and namespace handling.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { RDFSerializer } from '../../src/RDFSerializer.js';
import { NamespaceManager } from '../../src/NamespaceManager.js';

describe('RDFSerializer', () => {
  let serializer;
  let namespaceManager;
  let mockTripleStore;

  beforeEach(() => {
    namespaceManager = new NamespaceManager();
    namespaceManager.addNamespace('ex', 'http://example.org/');
    namespaceManager.addNamespace('foaf', 'http://xmlns.com/foaf/0.1/');
    
    // Mock triple store that returns test triples
    mockTripleStore = {
      query: (s, p, o) => {
        // Return all triples when called with (null, null, null)
        if (s === null && p === null && o === null) {
          return [
            ['ex:alice', 'foaf:name', 'Alice Smith'],
            ['ex:alice', 'ex:age', 30],
            ['ex:alice', 'ex:active', true]
          ];
        }
        return [];
      }
    };
    
    serializer = new RDFSerializer(mockTripleStore, namespaceManager);
  });

  describe('toTurtle()', () => {
    it('should serialize simple triples to Turtle format', () => {
      mockTripleStore.query = () => [
        ['ex:alice', 'foaf:name', 'Alice Smith']
      ];
      
      const turtle = serializer.toTurtle();
      
      expect(turtle).toContain('@prefix ex: <http://example.org/>');
      expect(turtle).toContain('@prefix foaf: <http://xmlns.com/foaf/0.1/>');
      expect(turtle).toContain('ex:alice foaf:name "Alice Smith" .');
    });

    it('should serialize typed integers to Turtle', () => {
      mockTripleStore.query = () => [
        ['ex:alice', 'ex:age', 30]
      ];
      
      const turtle = serializer.toTurtle();
      
      expect(turtle).toContain('ex:alice ex:age "30"^^xsd:integer .');
    });

    it('should serialize typed decimals to Turtle', () => {
      mockTripleStore.query = () => [
        ['ex:alice', 'ex:height', 5.6]
      ];
      
      const turtle = serializer.toTurtle();
      
      expect(turtle).toContain('ex:alice ex:height "5.6"^^xsd:decimal .');
    });

    it('should serialize typed booleans to Turtle', () => {
      mockTripleStore.query = () => [
        ['ex:alice', 'ex:active', true]
      ];
      
      const turtle = serializer.toTurtle();
      
      expect(turtle).toContain('ex:alice ex:active "true"^^xsd:boolean .');
    });

    it('should serialize multiple triples', () => {
      const turtle = serializer.toTurtle();
      
      expect(turtle).toContain('ex:alice foaf:name "Alice Smith" .');
      expect(turtle).toContain('ex:alice ex:age "30"^^xsd:integer .');
      expect(turtle).toContain('ex:alice ex:active "true"^^xsd:boolean .');
    });

    it('should serialize URIs in angle brackets when not contractable', () => {
      mockTripleStore.query = () => [
        ['http://example.com/person', 'http://xmlns.com/foaf/0.1/name', 'Bob']
      ];
      
      const turtle = serializer.toTurtle();
      
      expect(turtle).toContain('<http://example.com/person>');
      expect(turtle).toContain('foaf:name');
    });

    it('should handle strings with special characters', () => {
      mockTripleStore.query = () => [
        ['ex:alice', 'ex:bio', 'Alice "The Great" Smith']
      ];
      
      const turtle = serializer.toTurtle();
      
      expect(turtle).toContain('Alice \\"The Great\\" Smith');
    });
  });

  describe('toNTriples()', () => {
    it('should serialize simple triple to N-Triples format', () => {
      mockTripleStore.query = () => [
        ['ex:alice', 'foaf:name', 'Alice Smith']
      ];
      
      const ntriples = serializer.toNTriples();
      
      expect(ntriples).toContain('<http://example.org/alice>');
      expect(ntriples).toContain('<http://xmlns.com/foaf/0.1/name>');
      expect(ntriples).toContain('"Alice Smith"');
      expect(ntriples).toContain(' .');
    });

    it('should serialize typed integer to N-Triples', () => {
      mockTripleStore.query = () => [
        ['ex:alice', 'ex:age', 30]
      ];
      
      const ntriples = serializer.toNTriples();
      
      expect(ntriples).toContain('"30"^^<http://www.w3.org/2001/XMLSchema#integer>');
    });

    it('should serialize typed boolean to N-Triples', () => {
      mockTripleStore.query = () => [
        ['ex:alice', 'ex:active', true]
      ];
      
      const ntriples = serializer.toNTriples();
      
      expect(ntriples).toContain('"true"^^<http://www.w3.org/2001/XMLSchema#boolean>');
    });

    it('should serialize multiple triples with full URIs', () => {
      const ntriples = serializer.toNTriples();
      
      expect(ntriples).toContain('<http://example.org/alice>');
      expect(ntriples).toContain('<http://xmlns.com/foaf/0.1/name>');
      expect(ntriples).toContain('<http://example.org/age>');
    });

    it('should end each triple with space-dot', () => {
      mockTripleStore.query = () => [
        ['ex:alice', 'foaf:name', 'Alice']
      ];
      
      const ntriples = serializer.toNTriples();
      const lines = ntriples.trim().split('\n');
      
      lines.forEach(line => {
        expect(line.trim()).toMatch(/\s\.$/);
      });
    });
  });

  describe('toJsonLD()', () => {
    it('should serialize simple triple to JSON-LD', () => {
      mockTripleStore.query = () => [
        ['ex:alice', 'foaf:name', 'Alice Smith']
      ];
      
      const jsonld = serializer.toJsonLD();
      
      expect(jsonld).toHaveProperty('@context');
      expect(jsonld['@context']).toHaveProperty('ex', 'http://example.org/');
      expect(jsonld['@context']).toHaveProperty('foaf', 'http://xmlns.com/foaf/0.1/');
      expect(jsonld).toHaveProperty('@graph');
      expect(jsonld['@graph']).toHaveLength(1);
      expect(jsonld['@graph'][0]).toEqual({
        '@id': 'ex:alice',
        'foaf:name': 'Alice Smith'
      });
    });

    it('should preserve number types in JSON-LD', () => {
      mockTripleStore.query = () => [
        ['ex:alice', 'ex:age', 30],
        ['ex:alice', 'ex:height', 5.6]
      ];
      
      const jsonld = serializer.toJsonLD();
      
      const entity = jsonld['@graph'][0];
      expect(entity['ex:age']).toBe(30);
      expect(typeof entity['ex:age']).toBe('number');
      expect(entity['ex:height']).toBe(5.6);
      expect(typeof entity['ex:height']).toBe('number');
    });

    it('should preserve boolean types in JSON-LD', () => {
      mockTripleStore.query = () => [
        ['ex:alice', 'ex:active', true]
      ];
      
      const jsonld = serializer.toJsonLD();
      
      const entity = jsonld['@graph'][0];
      expect(entity['ex:active']).toBe(true);
      expect(typeof entity['ex:active']).toBe('boolean');
    });

    it('should group multiple properties for same subject', () => {
      const jsonld = serializer.toJsonLD();
      
      expect(jsonld['@graph']).toHaveLength(1);
      const entity = jsonld['@graph'][0];
      expect(entity['@id']).toBe('ex:alice');
      expect(entity['foaf:name']).toBe('Alice Smith');
      expect(entity['ex:age']).toBe(30);
      expect(entity['ex:active']).toBe(true);
    });

    it('should handle multi-valued properties as arrays', () => {
      mockTripleStore.query = () => [
        ['ex:alice', 'ex:knows', 'ex:bob'],
        ['ex:alice', 'ex:knows', 'ex:charlie']
      ];
      
      const jsonld = serializer.toJsonLD();
      
      const entity = jsonld['@graph'][0];
      expect(Array.isArray(entity['ex:knows'])).toBe(true);
      expect(entity['ex:knows']).toEqual(['ex:bob', 'ex:charlie']);
    });

    it('should handle object references', () => {
      mockTripleStore.query = () => [
        ['ex:alice', 'ex:knows', 'ex:bob']
      ];
      
      const jsonld = serializer.toJsonLD();
      
      const entity = jsonld['@graph'][0];
      expect(entity['ex:knows']).toBe('ex:bob');
    });

    it('should handle multiple subjects', () => {
      mockTripleStore.query = () => [
        ['ex:alice', 'foaf:name', 'Alice'],
        ['ex:bob', 'foaf:name', 'Bob']
      ];
      
      const jsonld = serializer.toJsonLD();
      
      expect(jsonld['@graph']).toHaveLength(2);
      expect(jsonld['@graph'][0]['@id']).toBe('ex:alice');
      expect(jsonld['@graph'][1]['@id']).toBe('ex:bob');
    });
  });

  describe('Type preservation', () => {
    it('should preserve integer types through Turtle serialization', () => {
      mockTripleStore.query = () => [
        ['ex:alice', 'ex:age', 42]
      ];
      
      const turtle = serializer.toTurtle();
      
      expect(turtle).toContain('"42"^^xsd:integer');
    });

    it('should preserve decimal types through Turtle serialization', () => {
      mockTripleStore.query = () => [
        ['ex:alice', 'ex:height', 5.6]
      ];
      
      const turtle = serializer.toTurtle();
      
      expect(turtle).toContain('"5.6"^^xsd:decimal');
    });

    it('should preserve boolean types through Turtle serialization', () => {
      mockTripleStore.query = () => [
        ['ex:alice', 'ex:active', false]
      ];
      
      const turtle = serializer.toTurtle();
      
      expect(turtle).toContain('"false"^^xsd:boolean');
    });

    it('should preserve string types through all formats', () => {
      mockTripleStore.query = () => [
        ['ex:alice', 'foaf:name', 'Alice Smith']
      ];
      
      const turtle = serializer.toTurtle();
      const ntriples = serializer.toNTriples();
      const jsonld = serializer.toJsonLD();
      
      expect(turtle).toContain('"Alice Smith"');
      expect(ntriples).toContain('"Alice Smith"');
      expect(jsonld['@graph'][0]['foaf:name']).toBe('Alice Smith');
    });
  });

  describe('Namespace handling', () => {
    it('should include all used prefixes in Turtle output', () => {
      mockTripleStore.query = () => [
        ['ex:alice', 'foaf:name', 'Alice'],
        ['ex:alice', 'ex:age', 30]
      ];
      
      const turtle = serializer.toTurtle();
      
      expect(turtle).toContain('@prefix ex:');
      expect(turtle).toContain('@prefix foaf:');
      expect(turtle).toContain('@prefix xsd:');
    });

    it('should expand CURIEs to full URIs in N-Triples', () => {
      mockTripleStore.query = () => [
        ['ex:alice', 'foaf:name', 'Alice']
      ];
      
      const ntriples = serializer.toNTriples();
      
      expect(ntriples).toContain('<http://example.org/alice>');
      expect(ntriples).toContain('<http://xmlns.com/foaf/0.1/name>');
    });

    it('should include context in JSON-LD output', () => {
      const jsonld = serializer.toJsonLD();
      
      expect(jsonld['@context']).toHaveProperty('ex');
      expect(jsonld['@context']).toHaveProperty('foaf');
      expect(jsonld['@context']['ex']).toBe('http://example.org/');
      expect(jsonld['@context']['foaf']).toBe('http://xmlns.com/foaf/0.1/');
    });
  });
});