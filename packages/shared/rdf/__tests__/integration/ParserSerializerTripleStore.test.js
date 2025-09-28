/**
 * Integration tests for RDFParser and RDFSerializer with SimpleTripleStore
 * 
 * Tests the full workflow:
 * 1. Parse RDF formats into triples
 * 2. Add triples to triple store
 * 3. Query triple store
 * 4. Serialize triples back to RDF formats
 * 5. Verify round-trip integrity
 * 
 * Uses SimpleTripleStore for synchronous operations as required by the design.
 * For production use with full features (persistence, subscriptions, etc.),
 * use @legion/triplestore with its async API.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { RDFParser } from '../../src/RDFParser.js';
import { RDFSerializer } from '../../src/RDFSerializer.js';
import { NamespaceManager } from '../../src/NamespaceManager.js';
import { SimpleTripleStore } from '../../src/SimpleTripleStore.js';

describe('RDFParser + RDFSerializer + TripleStore Integration', () => {
  let tripleStore;
  let namespaceManager;
  let parser;
  let serializer;

  beforeEach(() => {
    tripleStore = new SimpleTripleStore();
    namespaceManager = new NamespaceManager();
    namespaceManager.addNamespace('ex', 'http://example.org/');
    namespaceManager.addNamespace('foaf', 'http://xmlns.com/foaf/0.1/');
    
    parser = new RDFParser(tripleStore, namespaceManager);
    serializer = new RDFSerializer(tripleStore, namespaceManager);
  });

  describe('Turtle round-trip', () => {
    it('should parse Turtle and serialize back to Turtle', () => {
      const originalTurtle = `
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix ex: <http://example.org/> .

ex:alice foaf:name "Alice Smith" .
ex:alice ex:age "30"^^xsd:integer .
ex:alice ex:active "true"^^xsd:boolean .
`;
      
      // Parse into triple store
      parser.parseTurtle(originalTurtle);
      
      // Verify triples were added
      const triples = tripleStore.query(null, null, null);
      expect(triples).toHaveLength(3);
      
      // Serialize back to Turtle
      const serializedTurtle = serializer.toTurtle();
      
      // Verify output contains expected data
      expect(serializedTurtle).toContain('ex:alice');
      expect(serializedTurtle).toContain('foaf:name');
      expect(serializedTurtle).toContain('"Alice Smith"');
      expect(serializedTurtle).toContain('"30"^^xsd:integer');
      expect(serializedTurtle).toContain('"true"^^xsd:boolean');
    });

    it('should preserve types through Turtle round-trip', () => {
      const turtle = `ex:alice ex:age "42"^^xsd:integer .`;
      
      parser.parseTurtle(turtle);
      const triples = tripleStore.query(null, null, null);
      
      // Type should be preserved as number
      expect(typeof triples[0][2]).toBe('number');
      expect(triples[0][2]).toBe(42);
    });
  });

  describe('N-Triples round-trip', () => {
    it('should parse N-Triples and serialize back', () => {
      const ntriples = `<http://example.org/alice> <http://xmlns.com/foaf/0.1/name> "Alice Smith" .
<http://example.org/alice> <http://example.org/age> "30"^^<http://www.w3.org/2001/XMLSchema#integer> .`;
      
      // Parse into triple store
      parser.parseNTriples(ntriples);
      
      // Verify triples were added
      const triples = tripleStore.query(null, null, null);
      expect(triples).toHaveLength(2);
      
      // Serialize back to N-Triples
      const serializedNTriples = serializer.toNTriples();
      
      // Verify full URIs in output
      expect(serializedNTriples).toContain('<http://example.org/alice>');
      expect(serializedNTriples).toContain('<http://xmlns.com/foaf/0.1/name>');
      expect(serializedNTriples).toContain('"Alice Smith"');
      expect(serializedNTriples).toContain('<http://www.w3.org/2001/XMLSchema#integer>');
    });

    it('should preserve types through N-Triples round-trip', () => {
      const ntriples = `<http://example.org/alice> <http://example.org/active> "true"^^<http://www.w3.org/2001/XMLSchema#boolean> .`;
      
      parser.parseNTriples(ntriples);
      const triples = tripleStore.query(null, null, null);
      
      // Type should be preserved as boolean
      expect(typeof triples[0][2]).toBe('boolean');
      expect(triples[0][2]).toBe(true);
    });
  });

  describe('JSON-LD round-trip', () => {
    it('should parse JSON-LD and serialize back', () => {
      const jsonld = {
        '@context': {
          'foaf': 'http://xmlns.com/foaf/0.1/',
          'ex': 'http://example.org/'
        },
        '@id': 'ex:alice',
        'foaf:name': 'Alice Smith',
        'ex:age': 30,
        'ex:active': true
      };
      
      // Parse into triple store
      parser.parseJsonLD(jsonld);
      
      // Verify triples were added
      const triples = tripleStore.query(null, null, null);
      expect(triples).toHaveLength(3);
      
      // Serialize back to JSON-LD
      const serializedJsonLD = serializer.toJsonLD();
      
      // Verify structure
      expect(serializedJsonLD).toHaveProperty('@context');
      expect(serializedJsonLD).toHaveProperty('@graph');
      expect(serializedJsonLD['@graph']).toHaveLength(1);
      
      const entity = serializedJsonLD['@graph'][0];
      expect(entity['@id']).toBe('ex:alice');
      expect(entity['foaf:name']).toBe('Alice Smith');
      expect(entity['ex:age']).toBe(30);
      expect(entity['ex:active']).toBe(true);
    });

    it('should preserve all JavaScript types through JSON-LD', () => {
      const jsonld = {
        '@id': 'ex:test',
        'ex:string': 'text',
        'ex:number': 42,
        'ex:decimal': 3.14,
        'ex:boolean': true
      };
      
      parser.parseJsonLD(jsonld);
      const serializedJsonLD = serializer.toJsonLD();
      
      const entity = serializedJsonLD['@graph'][0];
      expect(typeof entity['ex:string']).toBe('string');
      expect(typeof entity['ex:number']).toBe('number');
      expect(typeof entity['ex:decimal']).toBe('number');
      expect(typeof entity['ex:boolean']).toBe('boolean');
    });
  });

  describe('Cross-format conversion', () => {
    it('should convert Turtle to JSON-LD', () => {
      const turtle = `
ex:alice foaf:name "Alice Smith" .
ex:alice ex:age "30"^^xsd:integer .
`;
      
      parser.parseTurtle(turtle);
      const jsonld = serializer.toJsonLD();
      
      expect(jsonld['@graph']).toHaveLength(1);
      const entity = jsonld['@graph'][0];
      expect(entity['foaf:name']).toBe('Alice Smith');
      expect(entity['ex:age']).toBe(30);
    });

    it('should convert JSON-LD to Turtle', () => {
      const jsonld = {
        '@context': {
          'foaf': 'http://xmlns.com/foaf/0.1/'
        },
        '@id': 'ex:bob',
        'foaf:name': 'Bob Jones'
      };
      
      parser.parseJsonLD(jsonld);
      const turtle = serializer.toTurtle();
      
      expect(turtle).toContain('ex:bob');
      expect(turtle).toContain('foaf:name');
      expect(turtle).toContain('"Bob Jones"');
    });

    it('should convert N-Triples to Turtle', () => {
      const ntriples = `<http://example.org/charlie> <http://xmlns.com/foaf/0.1/name> "Charlie Brown" .`;
      
      parser.parseNTriples(ntriples);
      const turtle = serializer.toTurtle();
      
      expect(turtle).toContain('ex:charlie');
      expect(turtle).toContain('foaf:name');
      expect(turtle).toContain('"Charlie Brown"');
    });
  });

  describe('Complex data scenarios', () => {
    it('should handle multiple entities with relationships', () => {
      const turtle = `
ex:alice foaf:name "Alice" .
ex:alice foaf:knows ex:bob .
ex:bob foaf:name "Bob" .
ex:bob foaf:knows ex:alice .
`;
      
      parser.parseTurtle(turtle);
      const triples = tripleStore.query(null, null, null);
      expect(triples).toHaveLength(4);
      
      // Verify relationships are maintained
      const aliceKnows = tripleStore.query('ex:alice', 'foaf:knows', null);
      expect(aliceKnows).toHaveLength(1);
      expect(aliceKnows[0][2]).toBe('ex:bob');
    });

    it('should handle multi-valued properties', () => {
      const jsonld = {
        '@id': 'ex:alice',
        'ex:hobby': ['reading', 'coding', 'gaming']
      };
      
      parser.parseJsonLD(jsonld);
      const triples = tripleStore.query('ex:alice', 'ex:hobby', null);
      expect(triples).toHaveLength(3);
      
      // Serialize and verify array preserved
      const serializedJsonLD = serializer.toJsonLD();
      const entity = serializedJsonLD['@graph'][0];
      expect(Array.isArray(entity['ex:hobby'])).toBe(true);
      expect(entity['ex:hobby']).toHaveLength(3);
    });

    it('should handle mixed literal and resource values', () => {
      const turtle = `
ex:alice foaf:name "Alice" .
ex:alice ex:age "30"^^xsd:integer .
ex:alice foaf:knows ex:bob .
ex:alice ex:active "true"^^xsd:boolean .
`;
      
      parser.parseTurtle(turtle);
      
      const jsonld = serializer.toJsonLD();
      const entity = jsonld['@graph'][0];
      
      expect(typeof entity['foaf:name']).toBe('string');
      expect(typeof entity['ex:age']).toBe('number');
      expect(typeof entity['ex:active']).toBe('boolean');
      expect(entity['foaf:knows']).toBe('ex:bob'); // Resource reference
    });
  });

  describe('Query integration', () => {
    it('should query triples by subject', () => {
      const turtle = `
ex:alice foaf:name "Alice" .
ex:alice ex:age "30"^^xsd:integer .
ex:bob foaf:name "Bob" .
`;
      
      parser.parseTurtle(turtle);
      
      const aliceTriples = tripleStore.query('ex:alice', null, null);
      expect(aliceTriples).toHaveLength(2);
    });

    it('should query triples by predicate', () => {
      const turtle = `
ex:alice foaf:name "Alice" .
ex:bob foaf:name "Bob" .
ex:charlie foaf:name "Charlie" .
`;
      
      parser.parseTurtle(turtle);
      
      const nameTriples = tripleStore.query(null, 'foaf:name', null);
      expect(nameTriples).toHaveLength(3);
    });

    it('should query triples by object', () => {
      const turtle = `
ex:alice ex:status "active" .
ex:bob ex:status "active" .
ex:charlie ex:status "inactive" .
`;
      
      parser.parseTurtle(turtle);
      
      const activeUsers = tripleStore.query(null, 'ex:status', 'active');
      expect(activeUsers).toHaveLength(2);
    });
  });
});