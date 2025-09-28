/**
 * Unit tests for RDFParser
 * 
 * Tests parsing of RDF formats (Turtle, N-Triples, JSON-LD) into triples
 * with type preservation and namespace handling.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { RDFParser } from '../../src/RDFParser.js';
import { NamespaceManager } from '../../src/NamespaceManager.js';

describe('RDFParser', () => {
  let parser;
  let namespaceManager;
  let capturedTriples;

  beforeEach(() => {
    namespaceManager = new NamespaceManager();
    namespaceManager.addNamespace('ex', 'http://example.org/');
    
    // Mock triple store that captures triples
    capturedTriples = [];
    const mockTripleStore = {
      add: (subject, predicate, object) => {
        capturedTriples.push([subject, predicate, object]);
      }
    };
    
    parser = new RDFParser(mockTripleStore, namespaceManager);
  });

  describe('parseTurtle()', () => {
    it('should parse simple Turtle triple', () => {
      const turtle = `ex:alice ex:name "Alice Smith" .`;
      
      parser.parseTurtle(turtle);
      
      expect(capturedTriples).toHaveLength(1);
      expect(capturedTriples[0]).toEqual([
        'ex:alice',
        'ex:name',
        'Alice Smith'
      ]);
    });

    it('should parse Turtle triple with typed integer literal', () => {
      const turtle = `ex:alice ex:age "30"^^xsd:integer .`;
      
      parser.parseTurtle(turtle);
      
      expect(capturedTriples).toHaveLength(1);
      expect(capturedTriples[0][2]).toBe(30);
      expect(typeof capturedTriples[0][2]).toBe('number');
    });

    it('should parse Turtle triple with typed decimal literal', () => {
      const turtle = `ex:alice ex:height "5.6"^^xsd:decimal .`;
      
      parser.parseTurtle(turtle);
      
      expect(capturedTriples[0][2]).toBe(5.6);
    });

    it('should parse Turtle triple with typed boolean literal', () => {
      const turtle = `ex:alice ex:active "true"^^xsd:boolean .`;
      
      parser.parseTurtle(turtle);
      
      expect(capturedTriples[0][2]).toBe(true);
      expect(typeof capturedTriples[0][2]).toBe('boolean');
    });

    it('should parse Turtle with prefix declarations', () => {
      const turtle = `
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix ex: <http://example.org/> .

ex:alice foaf:name "Alice" .
`;
      
      parser.parseTurtle(turtle);
      
      expect(capturedTriples).toHaveLength(1);
      expect(capturedTriples[0][1]).toBe('foaf:name');
    });

    it('should parse multiple Turtle triples', () => {
      const turtle = `
ex:alice ex:name "Alice" .
ex:alice ex:age "30"^^xsd:integer .
ex:alice ex:active "true"^^xsd:boolean .
`;
      
      parser.parseTurtle(turtle);
      
      expect(capturedTriples).toHaveLength(3);
      expect(capturedTriples[0][2]).toBe('Alice');
      expect(capturedTriples[1][2]).toBe(30);
      expect(capturedTriples[2][2]).toBe(true);
    });

    it('should parse Turtle with full URIs in angle brackets', () => {
      const turtle = `<http://example.org/alice> <http://xmlns.com/foaf/0.1/name> "Alice" .`;
      
      parser.parseTurtle(turtle);
      
      expect(capturedTriples).toHaveLength(1);
      expect(capturedTriples[0][0]).toBe('ex:alice');
      expect(capturedTriples[0][1]).toBe('foaf:name');
    });

    it('should handle empty strings', () => {
      parser.parseTurtle('');
      expect(capturedTriples).toHaveLength(0);
    });

    it('should handle comments in Turtle', () => {
      const turtle = `
# This is a comment
ex:alice ex:name "Alice" . # Inline comment
# Another comment
`;
      
      parser.parseTurtle(turtle);
      
      expect(capturedTriples).toHaveLength(1);
    });

    it('should parse strings with escaped characters', () => {
      const turtle = `ex:alice ex:bio "Alice\\nSmith\\t2024" .`;
      
      parser.parseTurtle(turtle);
      
      expect(capturedTriples[0][2]).toBe('Alice\nSmith\t2024');
    });
  });

  describe('parseNTriples()', () => {
    it('should parse simple N-Triple', () => {
      const ntriples = `<http://example.org/alice> <http://example.org/name> "Alice" .`;
      
      parser.parseNTriples(ntriples);
      
      expect(capturedTriples).toHaveLength(1);
      expect(capturedTriples[0][0]).toBe('ex:alice');
      expect(capturedTriples[0][1]).toBe('ex:name');
      expect(capturedTriples[0][2]).toBe('Alice');
    });

    it('should parse N-Triple with typed integer', () => {
      const ntriples = `<http://example.org/alice> <http://example.org/age> "30"^^<http://www.w3.org/2001/XMLSchema#integer> .`;
      
      parser.parseNTriples(ntriples);
      
      expect(capturedTriples[0][2]).toBe(30);
      expect(typeof capturedTriples[0][2]).toBe('number');
    });

    it('should parse N-Triple with typed boolean', () => {
      const ntriples = `<http://example.org/alice> <http://example.org/active> "true"^^<http://www.w3.org/2001/XMLSchema#boolean> .`;
      
      parser.parseNTriples(ntriples);
      
      expect(capturedTriples[0][2]).toBe(true);
    });

    it('should parse multiple N-Triples', () => {
      const ntriples = `
<http://example.org/alice> <http://example.org/name> "Alice" .
<http://example.org/alice> <http://example.org/age> "30"^^<http://www.w3.org/2001/XMLSchema#integer> .
`;
      
      parser.parseNTriples(ntriples);
      
      expect(capturedTriples).toHaveLength(2);
      expect(capturedTriples[0][2]).toBe('Alice');
      expect(capturedTriples[1][2]).toBe(30);
    });

    it('should handle empty strings', () => {
      parser.parseNTriples('');
      expect(capturedTriples).toHaveLength(0);
    });

    it('should handle comments in N-Triples', () => {
      const ntriples = `
# Comment
<http://example.org/alice> <http://example.org/name> "Alice" .
`;
      
      parser.parseNTriples(ntriples);
      
      expect(capturedTriples).toHaveLength(1);
    });
  });

  describe('parseJsonLD()', () => {
    it('should parse simple JSON-LD entity', () => {
      const jsonld = {
        '@id': 'http://example.org/alice',
        'http://example.org/name': 'Alice Smith',
        'http://example.org/age': 30
      };
      
      parser.parseJsonLD(jsonld);
      
      expect(capturedTriples).toHaveLength(2);
      expect(capturedTriples[0]).toEqual(['http://example.org/alice', 'ex:name', 'Alice Smith']);
      expect(capturedTriples[1]).toEqual(['http://example.org/alice', 'ex:age', 30]);
    });

    it('should parse JSON-LD with context', () => {
      const jsonld = {
        '@context': {
          'name': 'http://xmlns.com/foaf/0.1/name',
          'age': 'http://example.org/age'
        },
        '@id': 'http://example.org/alice',
        'name': 'Alice',
        'age': 30
      };
      
      parser.parseJsonLD(jsonld);
      
      expect(capturedTriples).toHaveLength(2);
      expect(capturedTriples[0][1]).toBe('foaf:name');
      expect(capturedTriples[1][1]).toBe('ex:age');
    });

    it('should parse JSON-LD with @graph', () => {
      const jsonld = {
        '@context': {},
        '@graph': [
          {
            '@id': 'http://example.org/alice',
            'http://example.org/name': 'Alice'
          },
          {
            '@id': 'http://example.org/bob',
            'http://example.org/name': 'Bob'
          }
        ]
      };
      
      parser.parseJsonLD(jsonld);
      
      expect(capturedTriples).toHaveLength(2);
      expect(capturedTriples[0][0]).toBe('http://example.org/alice');
      expect(capturedTriples[1][0]).toBe('http://example.org/bob');
    });

    it('should parse JSON-LD from string', () => {
      const jsonldString = JSON.stringify({
        '@id': 'http://example.org/alice',
        'http://example.org/name': 'Alice'
      });
      
      parser.parseJsonLD(jsonldString);
      
      expect(capturedTriples).toHaveLength(1);
    });

    it('should handle multi-valued properties as arrays', () => {
      const jsonld = {
        '@id': 'http://example.org/alice',
        'http://example.org/knows': [
          { '@id': 'http://example.org/bob' },
          { '@id': 'http://example.org/charlie' }
        ]
      };
      
      parser.parseJsonLD(jsonld);
      
      expect(capturedTriples).toHaveLength(2);
      expect(capturedTriples[0][2]).toBe('ex:bob');
      expect(capturedTriples[1][2]).toBe('ex:charlie');
    });

    it('should preserve number types from JSON-LD', () => {
      const jsonld = {
        '@id': 'http://example.org/alice',
        'http://example.org/age': 30,
        'http://example.org/height': 5.6,
        'http://example.org/active': true
      };
      
      parser.parseJsonLD(jsonld);
      
      expect(typeof capturedTriples[0][2]).toBe('number');
      expect(typeof capturedTriples[1][2]).toBe('number');
      expect(typeof capturedTriples[2][2]).toBe('boolean');
    });

    it('should handle empty JSON-LD', () => {
      parser.parseJsonLD(null);
      expect(capturedTriples).toHaveLength(0);
    });
  });

  describe('Type preservation', () => {
    it('should preserve integers through Turtle parsing', () => {
      parser.parseTurtle(`ex:alice ex:age "42"^^xsd:integer .`);
      
      expect(capturedTriples[0][2]).toBe(42);
      expect(Number.isInteger(capturedTriples[0][2])).toBe(true);
    });

    it('should preserve decimals through Turtle parsing', () => {
      parser.parseTurtle(`ex:alice ex:height "5.6"^^xsd:decimal .`);
      
      expect(capturedTriples[0][2]).toBe(5.6);
    });

    it('should preserve booleans through Turtle parsing', () => {
      parser.parseTurtle(`ex:alice ex:active "true"^^xsd:boolean .`);
      
      expect(capturedTriples[0][2]).toBe(true);
      expect(typeof capturedTriples[0][2]).toBe('boolean');
    });

    it('should preserve strings through Turtle parsing', () => {
      parser.parseTurtle(`ex:alice ex:name "Alice Smith" .`);
      
      expect(capturedTriples[0][2]).toBe('Alice Smith');
      expect(typeof capturedTriples[0][2]).toBe('string');
    });
  });
});