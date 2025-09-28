/**
 * Unit tests for RDFConverter.triplesToEntity()
 * 
 * Tests conversion of RDF triples to Handle entities:
 * - Simple triple-to-entity conversion
 * - Multi-valued properties reconstruction
 * - Reference properties reconstruction
 * - Type reconstruction
 * - Namespace contraction
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { RDFConverter } from '../../src/RDFConverter.js';
import { NamespaceManager } from '../../src/NamespaceManager.js';

describe('RDFConverter.triplesToEntity()', () => {
  let converter;
  let namespaceManager;

  beforeEach(() => {
    namespaceManager = new NamespaceManager();
    namespaceManager.addNamespace('ex', 'http://example.org/');
    namespaceManager.addNamespace('foaf', 'http://xmlns.com/foaf/0.1/');
    namespaceManager.addNamespace('user', 'http://myapp.example.com/user/');
    
    converter = new RDFConverter(namespaceManager);
  });

  describe('Simple triple-to-entity conversion', () => {
    it('should convert simple string property triples to entity', () => {
      const triples = [
        ['ex:alice', 'user:name', 'Alice Smith'],
        ['ex:alice', 'user:email', 'alice@example.com']
      ];
      
      const entityId = 'http://example.org/alice';
      const entity = converter.triplesToEntity(triples, entityId);
      
      expect(entity).toEqual({
        'user/name': 'Alice Smith',
        'user/email': 'alice@example.com'
      });
    });

    it('should convert number property triple to entity', () => {
      const triples = [
        ['ex:alice', 'user:age', 30]
      ];
      
      const entityId = 'http://example.org/alice';
      const entity = converter.triplesToEntity(triples, entityId);
      
      expect(entity).toEqual({
        'user/age': 30
      });
      expect(typeof entity['user/age']).toBe('number');
    });

    it('should convert boolean property triples to entity', () => {
      const triples = [
        ['ex:alice', 'user:active', true],
        ['ex:alice', 'user:verified', false]
      ];
      
      const entityId = 'http://example.org/alice';
      const entity = converter.triplesToEntity(triples, entityId);
      
      expect(entity).toEqual({
        'user/active': true,
        'user/verified': false
      });
      expect(typeof entity['user/active']).toBe('boolean');
      expect(typeof entity['user/verified']).toBe('boolean');
    });

    it('should handle empty triple array', () => {
      const triples = [];
      
      const entityId = 'http://example.org/alice';
      const entity = converter.triplesToEntity(triples, entityId);
      
      expect(entity).toEqual({});
    });
  });

  describe('Multi-valued properties reconstruction', () => {
    it('should group multiple triples with same predicate into array', () => {
      const triples = [
        ['ex:alice', 'user:name', 'Alice'],
        ['ex:alice', 'user:hobby', 'reading'],
        ['ex:alice', 'user:hobby', 'coding'],
        ['ex:alice', 'user:hobby', 'gaming']
      ];
      
      const entityId = 'http://example.org/alice';
      const entity = converter.triplesToEntity(triples, entityId);
      
      expect(entity['user/name']).toBe('Alice');
      expect(Array.isArray(entity['user/hobby'])).toBe(true);
      expect(entity['user/hobby']).toHaveLength(3);
      expect(entity['user/hobby']).toContain('reading');
      expect(entity['user/hobby']).toContain('coding');
      expect(entity['user/hobby']).toContain('gaming');
    });

    it('should keep single-valued properties as non-arrays', () => {
      const triples = [
        ['ex:alice', 'user:name', 'Alice'],
        ['ex:alice', 'user:age', 30]
      ];
      
      const entityId = 'http://example.org/alice';
      const entity = converter.triplesToEntity(triples, entityId);
      
      expect(entity['user/name']).toBe('Alice');
      expect(Array.isArray(entity['user/name'])).toBe(false);
      expect(entity['user/age']).toBe(30);
      expect(Array.isArray(entity['user/age'])).toBe(false);
    });

    it('should handle multiple values with different types', () => {
      const triples = [
        ['ex:alice', 'user:score', 100],
        ['ex:alice', 'user:score', 95],
        ['ex:alice', 'user:score', 88]
      ];
      
      const entityId = 'http://example.org/alice';
      const entity = converter.triplesToEntity(triples, entityId);
      
      expect(Array.isArray(entity['user/score'])).toBe(true);
      expect(entity['user/score']).toHaveLength(3);
      expect(entity['user/score']).toEqual([100, 95, 88]);
    });
  });

  describe('Reference properties reconstruction', () => {
    it('should expand CURIE references to full URIs', () => {
      const triples = [
        ['ex:alice', 'user:name', 'Alice'],
        ['ex:alice', 'user:friend', 'ex:bob']
      ];
      
      const entityId = 'http://example.org/alice';
      const entity = converter.triplesToEntity(triples, entityId);
      
      expect(entity['user/friend']).toBe('http://example.org/bob');
    });

    it('should handle multiple entity references', () => {
      const triples = [
        ['ex:alice', 'user:name', 'Alice'],
        ['ex:alice', 'user:knows', 'ex:bob'],
        ['ex:alice', 'user:knows', 'ex:charlie']
      ];
      
      const entityId = 'http://example.org/alice';
      const entity = converter.triplesToEntity(triples, entityId);
      
      expect(Array.isArray(entity['user/knows'])).toBe(true);
      expect(entity['user/knows']).toHaveLength(2);
      expect(entity['user/knows']).toContain('http://example.org/bob');
      expect(entity['user/knows']).toContain('http://example.org/charlie');
    });

    it('should expand references from different namespaces', () => {
      const triples = [
        ['ex:alice', 'foaf:name', 'Alice'],
        ['ex:alice', 'foaf:knows', 'ex:bob']
      ];
      
      const entityId = 'http://example.org/alice';
      const entity = converter.triplesToEntity(triples, entityId);
      
      expect(entity['foaf/knows']).toBe('http://example.org/bob');
    });

    it('should keep full URIs that cannot be contracted', () => {
      const triples = [
        ['ex:alice', 'user:name', 'Alice'],
        ['ex:alice', 'user:friend', 'http://other.org/person/123']
      ];
      
      const entityId = 'http://example.org/alice';
      const entity = converter.triplesToEntity(triples, entityId);
      
      expect(entity['user/friend']).toBe('http://other.org/person/123');
    });
  });

  describe('Type reconstruction', () => {
    it('should preserve string types', () => {
      const triples = [
        ['ex:alice', 'user:name', 'Alice Smith'],
        ['ex:alice', 'user:bio', 'Software developer']
      ];
      
      const entityId = 'http://example.org/alice';
      const entity = converter.triplesToEntity(triples, entityId);
      
      expect(typeof entity['user/name']).toBe('string');
      expect(typeof entity['user/bio']).toBe('string');
    });

    it('should preserve number types', () => {
      const triples = [
        ['ex:alice', 'user:age', 30],
        ['ex:alice', 'user:score', 95.5]
      ];
      
      const entityId = 'http://example.org/alice';
      const entity = converter.triplesToEntity(triples, entityId);
      
      expect(typeof entity['user/age']).toBe('number');
      expect(typeof entity['user/score']).toBe('number');
      expect(entity['user/age']).toBe(30);
      expect(entity['user/score']).toBe(95.5);
    });

    it('should preserve boolean types', () => {
      const triples = [
        ['ex:alice', 'user:active', true],
        ['ex:alice', 'user:verified', false]
      ];
      
      const entityId = 'http://example.org/alice';
      const entity = converter.triplesToEntity(triples, entityId);
      
      expect(typeof entity['user/active']).toBe('boolean');
      expect(typeof entity['user/verified']).toBe('boolean');
      expect(entity['user/active']).toBe(true);
      expect(entity['user/verified']).toBe(false);
    });

    it('should convert ISO date strings back to Date objects', () => {
      const dateStr = '2024-01-15T10:30:00.000Z';
      const triples = [
        ['ex:alice', 'user:created', dateStr]
      ];
      
      const entityId = 'http://example.org/alice';
      const entity = converter.triplesToEntity(triples, entityId);
      
      // ISO date strings should be converted to Date objects
      expect(entity['user/created'] instanceof Date).toBe(true);
      expect(entity['user/created'].toISOString()).toBe(dateStr);
    });
  });

  describe('Namespace contraction', () => {
    it('should convert CURIE predicates to namespace/property format', () => {
      const triples = [
        ['ex:alice', 'user:name', 'Alice']
      ];
      
      const entityId = 'http://example.org/alice';
      const entity = converter.triplesToEntity(triples, entityId);
      
      expect(entity).toHaveProperty('user/name');
      expect(entity['user/name']).toBe('Alice');
    });

    it('should handle predicates from multiple namespaces', () => {
      const triples = [
        ['ex:alice', 'foaf:name', 'Alice'],
        ['ex:alice', 'user:email', 'alice@example.com']
      ];
      
      const entityId = 'http://example.org/alice';
      const entity = converter.triplesToEntity(triples, entityId);
      
      expect(entity).toHaveProperty('foaf/name');
      expect(entity).toHaveProperty('user/email');
    });

    it('should handle full URI predicates without namespace', () => {
      const triples = [
        ['ex:alice', 'http://unknown.org/property', 'value']
      ];
      
      const entityId = 'http://example.org/alice';
      const entity = converter.triplesToEntity(triples, entityId);
      
      // Should use the full URI as the property key
      const propertyKey = 'http://unknown.org/property';
      expect(entity[propertyKey]).toBe('value');
      expect(Object.keys(entity)).toContain(propertyKey);
    });
  });

  describe('Complex scenarios', () => {
    it('should handle entity with mixed property types', () => {
      const triples = [
        ['ex:alice', 'user:name', 'Alice'],
        ['ex:alice', 'user:age', 30],
        ['ex:alice', 'user:active', true],
        ['ex:alice', 'user:hobby', 'reading'],
        ['ex:alice', 'user:hobby', 'coding'],
        ['ex:alice', 'user:friend', 'ex:bob']
      ];
      
      const entityId = 'http://example.org/alice';
      const entity = converter.triplesToEntity(triples, entityId);
      
      expect(entity['user/name']).toBe('Alice');
      expect(entity['user/age']).toBe(30);
      expect(entity['user/active']).toBe(true);
      expect(Array.isArray(entity['user/hobby'])).toBe(true);
      expect(entity['user/hobby']).toHaveLength(2);
      expect(entity['user/friend']).toBe('http://example.org/bob');
    });

    it('should filter triples by entity ID', () => {
      const triples = [
        ['ex:alice', 'user:name', 'Alice'],
        ['ex:bob', 'user:name', 'Bob'],
        ['ex:alice', 'user:age', 30]
      ];
      
      const entityId = 'http://example.org/alice';
      const entity = converter.triplesToEntity(triples, entityId);
      
      // Should only include Alice's triples
      expect(entity['user/name']).toBe('Alice');
      expect(entity['user/age']).toBe(30);
      expect(Object.keys(entity)).toHaveLength(2);
    });

    it('should handle triples with contracted subject', () => {
      const triples = [
        ['ex:alice', 'user:name', 'Alice'],
        ['ex:alice', 'user:age', 30]
      ];
      
      // Entity ID as CURIE should also work
      const entity = converter.triplesToEntity(triples, 'ex:alice');
      
      expect(entity['user/name']).toBe('Alice');
      expect(entity['user/age']).toBe(30);
    });

    it('should maintain property ordering', () => {
      const triples = [
        ['ex:alice', 'user:name', 'Alice'],
        ['ex:alice', 'user:age', 30],
        ['ex:alice', 'user:email', 'alice@example.com']
      ];
      
      const entityId = 'http://example.org/alice';
      const entity1 = converter.triplesToEntity(triples, entityId);
      const entity2 = converter.triplesToEntity(triples, entityId);
      
      // Should produce consistent property ordering
      expect(Object.keys(entity1)).toEqual(Object.keys(entity2));
    });
  });

  describe('Edge cases', () => {
    it('should throw on invalid triples array', () => {
      expect(() => {
        converter.triplesToEntity(null, 'ex:alice');
      }).toThrow();
      
      expect(() => {
        converter.triplesToEntity('not an array', 'ex:alice');
      }).toThrow();
    });

    it('should throw on invalid entity ID', () => {
      const triples = [['ex:alice', 'user:name', 'Alice']];
      
      expect(() => {
        converter.triplesToEntity(triples, null);
      }).toThrow();
      
      expect(() => {
        converter.triplesToEntity(triples, '');
      }).toThrow();
    });

    it('should handle triples with invalid structure gracefully', () => {
      const triples = [
        ['ex:alice', 'user:name', 'Alice'],
        ['incomplete'], // Invalid triple
        ['ex:alice', 'user:age', 30]
      ];
      
      const entityId = 'http://example.org/alice';
      
      // Should skip invalid triple and process valid ones
      const entity = converter.triplesToEntity(triples, entityId);
      expect(entity['user/name']).toBe('Alice');
      expect(entity['user/age']).toBe(30);
    });
  });
});