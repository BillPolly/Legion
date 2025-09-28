/**
 * Unit tests for RDFConverter bidirectional conversion
 * 
 * Tests round-trip conversion: entity → triples → entity
 * - Type preservation through round-trip
 * - Property preservation
 * - Complex entities with relationships
 * - Edge cases
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { RDFConverter } from '../../src/RDFConverter.js';
import { NamespaceManager } from '../../src/NamespaceManager.js';

describe('RDFConverter bidirectional conversion', () => {
  let converter;
  let namespaceManager;

  beforeEach(() => {
    namespaceManager = new NamespaceManager();
    namespaceManager.addNamespace('ex', 'http://example.org/');
    namespaceManager.addNamespace('foaf', 'http://xmlns.com/foaf/0.1/');
    namespaceManager.addNamespace('user', 'http://myapp.example.com/user/');
    
    converter = new RDFConverter(namespaceManager);
  });

  describe('Simple entity round-trip', () => {
    it('should preserve simple string properties', () => {
      const originalEntity = {
        'user/name': 'Alice Smith',
        'user/email': 'alice@example.com'
      };
      
      const entityId = 'http://example.org/alice';
      
      // Convert to triples
      const triples = converter.entityToTriples(originalEntity, entityId);
      
      // Convert back to entity
      const reconstructedEntity = converter.triplesToEntity(triples, entityId);
      
      // Should match original
      expect(reconstructedEntity).toEqual(originalEntity);
    });

    it('should preserve number properties', () => {
      const originalEntity = {
        'user/age': 30,
        'user/score': 95.5
      };
      
      const entityId = 'http://example.org/alice';
      
      const triples = converter.entityToTriples(originalEntity, entityId);
      const reconstructedEntity = converter.triplesToEntity(triples, entityId);
      
      expect(reconstructedEntity).toEqual(originalEntity);
      expect(typeof reconstructedEntity['user/age']).toBe('number');
      expect(typeof reconstructedEntity['user/score']).toBe('number');
    });

    it('should preserve boolean properties', () => {
      const originalEntity = {
        'user/active': true,
        'user/verified': false
      };
      
      const entityId = 'http://example.org/alice';
      
      const triples = converter.entityToTriples(originalEntity, entityId);
      const reconstructedEntity = converter.triplesToEntity(triples, entityId);
      
      expect(reconstructedEntity).toEqual(originalEntity);
      expect(typeof reconstructedEntity['user/active']).toBe('boolean');
      expect(typeof reconstructedEntity['user/verified']).toBe('boolean');
    });

    it('should preserve Date objects', () => {
      const date = new Date('2024-01-15T10:30:00.000Z');
      const originalEntity = {
        'user/created': date
      };
      
      const entityId = 'http://example.org/alice';
      
      const triples = converter.entityToTriples(originalEntity, entityId);
      const reconstructedEntity = converter.triplesToEntity(triples, entityId);
      
      // Should be a Date object
      expect(reconstructedEntity['user/created'] instanceof Date).toBe(true);
      // Should have the same timestamp
      expect(reconstructedEntity['user/created'].getTime()).toBe(date.getTime());
    });
  });

  describe('Multi-valued property round-trip', () => {
    it('should preserve array properties', () => {
      const originalEntity = {
        'user/name': 'Alice',
        'user/hobby': ['reading', 'coding', 'gaming']
      };
      
      const entityId = 'http://example.org/alice';
      
      const triples = converter.entityToTriples(originalEntity, entityId);
      const reconstructedEntity = converter.triplesToEntity(triples, entityId);
      
      // Should preserve array
      expect(Array.isArray(reconstructedEntity['user/hobby'])).toBe(true);
      expect(reconstructedEntity['user/hobby']).toHaveLength(3);
      expect(reconstructedEntity['user/hobby']).toEqual(
        expect.arrayContaining(['reading', 'coding', 'gaming'])
      );
      
      // Single-valued property should remain non-array
      expect(reconstructedEntity['user/name']).toBe('Alice');
      expect(Array.isArray(reconstructedEntity['user/name'])).toBe(false);
    });

    it('should preserve numeric arrays', () => {
      const originalEntity = {
        'user/scores': [100, 95, 88]
      };
      
      const entityId = 'http://example.org/alice';
      
      const triples = converter.entityToTriples(originalEntity, entityId);
      const reconstructedEntity = converter.triplesToEntity(triples, entityId);
      
      expect(Array.isArray(reconstructedEntity['user/scores'])).toBe(true);
      expect(reconstructedEntity['user/scores']).toEqual(
        expect.arrayContaining([100, 95, 88])
      );
      
      // All values should still be numbers
      reconstructedEntity['user/scores'].forEach(score => {
        expect(typeof score).toBe('number');
      });
    });
  });

  describe('Reference property round-trip', () => {
    it('should preserve entity references', () => {
      const originalEntity = {
        'user/name': 'Alice',
        'user/friend': 'http://example.org/bob'
      };
      
      const entityId = 'http://example.org/alice';
      
      const triples = converter.entityToTriples(originalEntity, entityId);
      const reconstructedEntity = converter.triplesToEntity(triples, entityId);
      
      expect(reconstructedEntity).toEqual(originalEntity);
      expect(reconstructedEntity['user/friend']).toBe('http://example.org/bob');
    });

    it('should preserve multiple entity references', () => {
      const originalEntity = {
        'user/name': 'Alice',
        'user/knows': [
          'http://example.org/bob',
          'http://example.org/charlie'
        ]
      };
      
      const entityId = 'http://example.org/alice';
      
      const triples = converter.entityToTriples(originalEntity, entityId);
      const reconstructedEntity = converter.triplesToEntity(triples, entityId);
      
      expect(Array.isArray(reconstructedEntity['user/knows'])).toBe(true);
      expect(reconstructedEntity['user/knows']).toHaveLength(2);
      expect(reconstructedEntity['user/knows']).toEqual(
        expect.arrayContaining([
          'http://example.org/bob',
          'http://example.org/charlie'
        ])
      );
    });
  });

  describe('Complex entity round-trip', () => {
    it('should preserve complex entity with mixed property types', () => {
      const originalEntity = {
        'user/name': 'Alice Smith',
        'user/age': 30,
        'user/active': true,
        'user/score': 95.5,
        'user/hobbies': ['reading', 'coding'],
        'user/friend': 'http://example.org/bob',
        'user/created': new Date('2024-01-15T10:30:00.000Z')
      };
      
      const entityId = 'http://example.org/alice';
      
      const triples = converter.entityToTriples(originalEntity, entityId);
      const reconstructedEntity = converter.triplesToEntity(triples, entityId);
      
      // Check each property
      expect(reconstructedEntity['user/name']).toBe('Alice Smith');
      expect(reconstructedEntity['user/age']).toBe(30);
      expect(reconstructedEntity['user/active']).toBe(true);
      expect(reconstructedEntity['user/score']).toBe(95.5);
      expect(reconstructedEntity['user/hobbies']).toEqual(
        expect.arrayContaining(['reading', 'coding'])
      );
      expect(reconstructedEntity['user/friend']).toBe('http://example.org/bob');
      expect(reconstructedEntity['user/created'] instanceof Date).toBe(true);
      expect(reconstructedEntity['user/created'].getTime()).toBe(
        originalEntity['user/created'].getTime()
      );
    });

    it('should preserve entity with multiple namespaces', () => {
      const originalEntity = {
        'foaf/name': 'Alice Smith',
        'user/email': 'alice@example.com',
        'foaf/knows': 'http://example.org/bob'
      };
      
      const entityId = 'http://example.org/alice';
      
      const triples = converter.entityToTriples(originalEntity, entityId);
      const reconstructedEntity = converter.triplesToEntity(triples, entityId);
      
      expect(reconstructedEntity).toEqual(originalEntity);
      expect(Object.keys(reconstructedEntity)).toHaveLength(3);
    });
  });

  describe('Type preservation', () => {
    it('should preserve all JavaScript types through round-trip', () => {
      const originalEntity = {
        'user/string': 'text value',
        'user/integer': 42,
        'user/decimal': 3.14,
        'user/boolean': true,
        'user/date': new Date('2024-01-15T10:30:00.000Z'),
        'user/array': ['a', 'b', 'c']
      };
      
      const entityId = 'http://example.org/test';
      
      const triples = converter.entityToTriples(originalEntity, entityId);
      const reconstructedEntity = converter.triplesToEntity(triples, entityId);
      
      // Check types
      expect(typeof reconstructedEntity['user/string']).toBe('string');
      expect(typeof reconstructedEntity['user/integer']).toBe('number');
      expect(typeof reconstructedEntity['user/decimal']).toBe('number');
      expect(typeof reconstructedEntity['user/boolean']).toBe('boolean');
      expect(reconstructedEntity['user/date'] instanceof Date).toBe(true);
      expect(Array.isArray(reconstructedEntity['user/array'])).toBe(true);
      
      // Check values
      expect(reconstructedEntity['user/string']).toBe('text value');
      expect(reconstructedEntity['user/integer']).toBe(42);
      expect(reconstructedEntity['user/decimal']).toBe(3.14);
      expect(reconstructedEntity['user/boolean']).toBe(true);
      expect(reconstructedEntity['user/date'].getTime()).toBe(
        originalEntity['user/date'].getTime()
      );
      expect(reconstructedEntity['user/array']).toEqual(['a', 'b', 'c']);
    });

    it('should distinguish between integers and decimals', () => {
      const originalEntity = {
        'user/count': 100,
        'user/score': 95.5
      };
      
      const entityId = 'http://example.org/test';
      
      const triples = converter.entityToTriples(originalEntity, entityId);
      const reconstructedEntity = converter.triplesToEntity(triples, entityId);
      
      // Both should be numbers
      expect(typeof reconstructedEntity['user/count']).toBe('number');
      expect(typeof reconstructedEntity['user/score']).toBe('number');
      
      // Values should be exact
      expect(reconstructedEntity['user/count']).toBe(100);
      expect(reconstructedEntity['user/score']).toBe(95.5);
      
      // Integer check
      expect(Number.isInteger(reconstructedEntity['user/count'])).toBe(true);
      expect(Number.isInteger(reconstructedEntity['user/score'])).toBe(false);
    });
  });

  describe('Property ordering', () => {
    it('should maintain consistent property ordering', () => {
      const originalEntity = {
        'user/name': 'Alice',
        'user/age': 30,
        'user/email': 'alice@example.com'
      };
      
      const entityId = 'http://example.org/alice';
      
      // Convert multiple times
      const triples1 = converter.entityToTriples(originalEntity, entityId);
      const triples2 = converter.entityToTriples(originalEntity, entityId);
      
      const entity1 = converter.triplesToEntity(triples1, entityId);
      const entity2 = converter.triplesToEntity(triples2, entityId);
      
      // Should produce consistent results
      expect(entity1).toEqual(entity2);
      expect(Object.keys(entity1)).toEqual(Object.keys(entity2));
    });
  });

  describe('Edge cases', () => {
    it('should handle empty entity', () => {
      const originalEntity = {};
      
      const entityId = 'http://example.org/empty';
      
      const triples = converter.entityToTriples(originalEntity, entityId);
      const reconstructedEntity = converter.triplesToEntity(triples, entityId);
      
      expect(reconstructedEntity).toEqual({});
      expect(triples).toHaveLength(0);
    });

    it('should handle entity with single property', () => {
      const originalEntity = {
        'user/name': 'Alice'
      };
      
      const entityId = 'http://example.org/alice';
      
      const triples = converter.entityToTriples(originalEntity, entityId);
      const reconstructedEntity = converter.triplesToEntity(triples, entityId);
      
      expect(reconstructedEntity).toEqual(originalEntity);
    });

    it('should handle large entity with many properties', () => {
      const originalEntity = {};
      for (let i = 0; i < 50; i++) {
        originalEntity[`user/prop${i}`] = `value${i}`;
      }
      
      const entityId = 'http://example.org/large';
      
      const triples = converter.entityToTriples(originalEntity, entityId);
      const reconstructedEntity = converter.triplesToEntity(triples, entityId);
      
      expect(reconstructedEntity).toEqual(originalEntity);
      expect(Object.keys(reconstructedEntity)).toHaveLength(50);
    });

    it('should handle entity with long array properties', () => {
      const originalEntity = {
        'user/tags': []
      };
      for (let i = 0; i < 100; i++) {
        originalEntity['user/tags'].push(`tag${i}`);
      }
      
      const entityId = 'http://example.org/tagged';
      
      const triples = converter.entityToTriples(originalEntity, entityId);
      const reconstructedEntity = converter.triplesToEntity(triples, entityId);
      
      expect(Array.isArray(reconstructedEntity['user/tags'])).toBe(true);
      expect(reconstructedEntity['user/tags']).toHaveLength(100);
      expect(reconstructedEntity['user/tags']).toEqual(originalEntity['user/tags']);
    });
  });

  describe('Multiple round-trips', () => {
    it('should preserve data through multiple round-trips', () => {
      const originalEntity = {
        'user/name': 'Alice',
        'user/age': 30,
        'user/hobbies': ['reading', 'coding'],
        'user/friend': 'http://example.org/bob'
      };
      
      const entityId = 'http://example.org/alice';
      
      // First round-trip
      let triples = converter.entityToTriples(originalEntity, entityId);
      let entity = converter.triplesToEntity(triples, entityId);
      
      // Second round-trip
      triples = converter.entityToTriples(entity, entityId);
      entity = converter.triplesToEntity(triples, entityId);
      
      // Third round-trip
      triples = converter.entityToTriples(entity, entityId);
      entity = converter.triplesToEntity(triples, entityId);
      
      // Should still match original after 3 round-trips
      expect(entity['user/name']).toBe(originalEntity['user/name']);
      expect(entity['user/age']).toBe(originalEntity['user/age']);
      expect(entity['user/hobbies']).toEqual(
        expect.arrayContaining(originalEntity['user/hobbies'])
      );
      expect(entity['user/friend']).toBe(originalEntity['user/friend']);
    });
  });
});