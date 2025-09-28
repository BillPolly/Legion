/**
 * Unit tests for RDFConverter.entityToTriples()
 * 
 * Tests conversion of Handle entities to RDF triples:
 * - Simple entity conversion
 * - Multi-valued properties (cardinality many)
 * - Reference properties (entity links)
 * - Type mapping (string, number, boolean, Date)
 * - Namespace application
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { RDFConverter } from '../../src/RDFConverter.js';
import { NamespaceManager } from '../../src/NamespaceManager.js';

describe('RDFConverter.entityToTriples()', () => {
  let converter;
  let namespaceManager;

  beforeEach(() => {
    namespaceManager = new NamespaceManager();
    namespaceManager.addNamespace('ex', 'http://example.org/');
    namespaceManager.addNamespace('foaf', 'http://xmlns.com/foaf/0.1/');
    namespaceManager.addNamespace('user', 'http://myapp.example.com/user/');
    
    converter = new RDFConverter(namespaceManager);
  });

  describe('Simple entity conversion', () => {
    it('should convert simple entity with string properties', () => {
      const entity = {
        'user/name': 'Alice Smith',
        'user/email': 'alice@example.com'
      };
      
      const entityId = 'http://example.org/alice';
      const triples = converter.entityToTriples(entity, entityId);
      
      // Should have 2 property triples
      expect(triples).toHaveLength(2);
      
      // Check name triple
      const nameTriple = triples.find(([s, p, o]) => p === 'user:name');
      expect(nameTriple).toBeDefined();
      expect(nameTriple[0]).toBe('ex:alice');
      expect(nameTriple[2]).toBe('Alice Smith');
      
      // Check email triple
      const emailTriple = triples.find(([s, p, o]) => p === 'user:email');
      expect(emailTriple).toBeDefined();
      expect(emailTriple[0]).toBe('ex:alice');
      expect(emailTriple[2]).toBe('alice@example.com');
    });

    it('should handle entity with single number property', () => {
      const entity = {
        'user/age': 30
      };
      
      const entityId = 'http://example.org/alice';
      const triples = converter.entityToTriples(entity, entityId);
      
      expect(triples).toHaveLength(1);
      expect(triples[0][0]).toBe('ex:alice');
      expect(triples[0][1]).toBe('user:age');
      expect(triples[0][2]).toBe(30);
      expect(typeof triples[0][2]).toBe('number');
    });

    it('should handle entity with boolean property', () => {
      const entity = {
        'user/active': true,
        'user/verified': false
      };
      
      const entityId = 'http://example.org/alice';
      const triples = converter.entityToTriples(entity, entityId);
      
      expect(triples).toHaveLength(2);
      
      const activeTriple = triples.find(([s, p, o]) => p === 'user:active');
      expect(activeTriple[2]).toBe(true);
      expect(typeof activeTriple[2]).toBe('boolean');
      
      const verifiedTriple = triples.find(([s, p, o]) => p === 'user:verified');
      expect(verifiedTriple[2]).toBe(false);
      expect(typeof verifiedTriple[2]).toBe('boolean');
    });

    it('should omit null and undefined values', () => {
      const entity = {
        'user/name': 'Alice',
        'user/middle': null,
        'user/nickname': undefined,
        'user/age': 30
      };
      
      const entityId = 'http://example.org/alice';
      const triples = converter.entityToTriples(entity, entityId);
      
      // Should only have name and age triples
      expect(triples).toHaveLength(2);
      expect(triples.find(([s, p, o]) => p === 'user:name')).toBeDefined();
      expect(triples.find(([s, p, o]) => p === 'user:age')).toBeDefined();
      expect(triples.find(([s, p, o]) => p === 'user:middle')).toBeUndefined();
      expect(triples.find(([s, p, o]) => p === 'user:nickname')).toBeUndefined();
    });
  });

  describe('Multi-valued properties', () => {
    it('should create multiple triples for array properties', () => {
      const entity = {
        'user/name': 'Alice',
        'user/hobby': ['reading', 'coding', 'gaming']
      };
      
      const entityId = 'http://example.org/alice';
      const triples = converter.entityToTriples(entity, entityId);
      
      // Should have 1 name triple + 3 hobby triples
      expect(triples).toHaveLength(4);
      
      // Check all hobby triples exist
      const hobbyTriples = triples.filter(([s, p, o]) => p === 'user:hobby');
      expect(hobbyTriples).toHaveLength(3);
      
      const hobbyValues = hobbyTriples.map(([s, p, o]) => o);
      expect(hobbyValues).toContain('reading');
      expect(hobbyValues).toContain('coding');
      expect(hobbyValues).toContain('gaming');
    });

    it('should handle empty arrays', () => {
      const entity = {
        'user/name': 'Alice',
        'user/tags': []
      };
      
      const entityId = 'http://example.org/alice';
      const triples = converter.entityToTriples(entity, entityId);
      
      // Should only have name triple
      expect(triples).toHaveLength(1);
      expect(triples[0][1]).toBe('user:name');
    });

    it('should handle arrays with mixed types', () => {
      const entity = {
        'user/scores': [100, 95, 88]
      };
      
      const entityId = 'http://example.org/alice';
      const triples = converter.entityToTriples(entity, entityId);
      
      expect(triples).toHaveLength(3);
      expect(triples[0][2]).toBe(100);
      expect(triples[1][2]).toBe(95);
      expect(triples[2][2]).toBe(88);
      
      // All should be numbers
      triples.forEach(([s, p, o]) => {
        expect(typeof o).toBe('number');
      });
    });
  });

  describe('Reference properties', () => {
    it('should handle entity references as URIs', () => {
      const entity = {
        'user/name': 'Alice',
        'user/friend': 'http://example.org/bob'
      };
      
      const entityId = 'http://example.org/alice';
      const triples = converter.entityToTriples(entity, entityId);
      
      expect(triples).toHaveLength(2);
      
      const friendTriple = triples.find(([s, p, o]) => p === 'user:friend');
      expect(friendTriple[2]).toBe('ex:bob');
    });

    it('should handle multiple entity references', () => {
      const entity = {
        'user/name': 'Alice',
        'user/knows': [
          'http://example.org/bob',
          'http://example.org/charlie'
        ]
      };
      
      const entityId = 'http://example.org/alice';
      const triples = converter.entityToTriples(entity, entityId);
      
      expect(triples).toHaveLength(3);
      
      const knowsTriples = triples.filter(([s, p, o]) => p === 'user:knows');
      expect(knowsTriples).toHaveLength(2);
      
      const friends = knowsTriples.map(([s, p, o]) => o);
      expect(friends).toContain('ex:bob');
      expect(friends).toContain('ex:charlie');
    });

    it('should contract URIs to CURIEs for references', () => {
      const entity = {
        'foaf/name': 'Alice',
        'foaf/knows': 'http://example.org/bob'
      };
      
      const entityId = 'http://example.org/alice';
      const triples = converter.entityToTriples(entity, entityId);
      
      const knowsTriple = triples.find(([s, p, o]) => p === 'foaf:knows');
      expect(knowsTriple[2]).toBe('ex:bob');
    });
  });

  describe('Type mapping', () => {
    it('should preserve string types', () => {
      const entity = {
        'user/name': 'Alice',
        'user/bio': 'Software developer'
      };
      
      const entityId = 'http://example.org/alice';
      const triples = converter.entityToTriples(entity, entityId);
      
      triples.forEach(([s, p, o]) => {
        expect(typeof o).toBe('string');
      });
    });

    it('should preserve number types (integer)', () => {
      const entity = {
        'user/age': 30,
        'user/count': 5
      };
      
      const entityId = 'http://example.org/alice';
      const triples = converter.entityToTriples(entity, entityId);
      
      expect(triples).toHaveLength(2);
      triples.forEach(([s, p, o]) => {
        expect(typeof o).toBe('number');
        expect(Number.isInteger(o)).toBe(true);
      });
    });

    it('should preserve number types (decimal)', () => {
      const entity = {
        'user/score': 95.5,
        'user/rating': 4.8
      };
      
      const entityId = 'http://example.org/alice';
      const triples = converter.entityToTriples(entity, entityId);
      
      expect(triples).toHaveLength(2);
      triples.forEach(([s, p, o]) => {
        expect(typeof o).toBe('number');
      });
    });

    it('should preserve boolean types', () => {
      const entity = {
        'user/active': true,
        'user/verified': false
      };
      
      const entityId = 'http://example.org/alice';
      const triples = converter.entityToTriples(entity, entityId);
      
      expect(triples).toHaveLength(2);
      triples.forEach(([s, p, o]) => {
        expect(typeof o).toBe('boolean');
      });
    });

    it('should handle Date objects', () => {
      const now = new Date('2024-01-15T10:30:00Z');
      const entity = {
        'user/created': now
      };
      
      const entityId = 'http://example.org/alice';
      const triples = converter.entityToTriples(entity, entityId);
      
      expect(triples).toHaveLength(1);
      // Date should be converted to ISO string
      expect(triples[0][2]).toBe(now.toISOString());
    });
  });

  describe('Namespace application', () => {
    it('should contract entity ID to CURIE', () => {
      const entity = {
        'user/name': 'Alice'
      };
      
      const entityId = 'http://example.org/alice';
      const triples = converter.entityToTriples(entity, entityId);
      
      // Subject should be contracted
      expect(triples[0][0]).toBe('ex:alice');
    });

    it('should contract property names to CURIEs', () => {
      const entity = {
        'user/name': 'Alice',
        'user/email': 'alice@example.com'
      };
      
      const entityId = 'http://example.org/alice';
      const triples = converter.entityToTriples(entity, entityId);
      
      // Predicates should be contracted
      expect(triples[0][1]).toBe('user:name');
      expect(triples[1][1]).toBe('user:email');
    });

    it('should handle properties from different namespaces', () => {
      const entity = {
        'foaf/name': 'Alice',
        'user/email': 'alice@example.com'
      };
      
      const entityId = 'http://example.org/alice';
      const triples = converter.entityToTriples(entity, entityId);
      
      expect(triples).toHaveLength(2);
      expect(triples.find(([s, p, o]) => p === 'foaf:name')).toBeDefined();
      expect(triples.find(([s, p, o]) => p === 'user:email')).toBeDefined();
    });

    it('should handle full URIs when no namespace matches', () => {
      const entity = {
        'http://unknown.org/property': 'value'
      };
      
      const entityId = 'http://example.org/alice';
      const triples = converter.entityToTriples(entity, entityId);
      
      expect(triples).toHaveLength(1);
      // Should keep full URI if no namespace matches
      expect(triples[0][1]).toContain('http://unknown.org/property');
    });
  });

  describe('Complex scenarios', () => {
    it('should handle entity with mixed property types', () => {
      const entity = {
        'user/name': 'Alice',
        'user/age': 30,
        'user/active': true,
        'user/hobbies': ['reading', 'coding'],
        'user/friend': 'http://example.org/bob'
      };
      
      const entityId = 'http://example.org/alice';
      const triples = converter.entityToTriples(entity, entityId);
      
      // Should have 1 name + 1 age + 1 active + 2 hobbies + 1 friend = 6 triples
      expect(triples).toHaveLength(6);
      
      // All subjects should be the same
      triples.forEach(([s, p, o]) => {
        expect(s).toBe('ex:alice');
      });
    });

    it('should handle entity with no properties', () => {
      const entity = {};
      
      const entityId = 'http://example.org/alice';
      const triples = converter.entityToTriples(entity, entityId);
      
      // Should return empty array
      expect(triples).toHaveLength(0);
    });

    it('should skip :db/id property', () => {
      const entity = {
        ':db/id': 123,
        'user/name': 'Alice'
      };
      
      const entityId = 'http://example.org/alice';
      const triples = converter.entityToTriples(entity, entityId);
      
      // Should only have name triple
      expect(triples).toHaveLength(1);
      expect(triples[0][1]).toBe('user:name');
    });

    it('should maintain order for predictable output', () => {
      const entity = {
        'user/name': 'Alice',
        'user/age': 30,
        'user/email': 'alice@example.com'
      };
      
      const entityId = 'http://example.org/alice';
      const triples1 = converter.entityToTriples(entity, entityId);
      const triples2 = converter.entityToTriples(entity, entityId);
      
      // Should produce consistent ordering
      expect(triples1).toEqual(triples2);
    });
  });
});