/**
 * Integration tests for RDFConverter with SimpleTripleStore
 * 
 * Tests RDFConverter integration with triple store:
 * - Convert entity → triples → add to store
 * - Query store → triples → convert to entity
 * - Complex entities with relationships
 * - Multiple entities in store
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { RDFConverter } from '../../src/RDFConverter.js';
import { NamespaceManager } from '../../src/NamespaceManager.js';
import { SimpleTripleStore } from '../../src/SimpleTripleStore.js';

describe('RDFConverter integration with SimpleTripleStore', () => {
  let converter;
  let namespaceManager;
  let tripleStore;

  beforeEach(() => {
    namespaceManager = new NamespaceManager();
    namespaceManager.addNamespace('ex', 'http://example.org/');
    namespaceManager.addNamespace('foaf', 'http://xmlns.com/foaf/0.1/');
    namespaceManager.addNamespace('user', 'http://myapp.example.com/user/');
    
    converter = new RDFConverter(namespaceManager);
    tripleStore = new SimpleTripleStore();
  });

  describe('Entity to store workflow', () => {
    it('should convert entity to triples and add to store', () => {
      const entity = {
        'user/name': 'Alice Smith',
        'user/email': 'alice@example.com',
        'user/age': 30
      };
      
      const entityId = 'http://example.org/alice';
      
      // Convert entity to triples
      const triples = converter.entityToTriples(entity, entityId);
      
      // Add triples to store
      triples.forEach(([s, p, o]) => {
        tripleStore.add(s, p, o);
      });
      
      // Verify triples are in store
      const storedTriples = tripleStore.query(null, null, null);
      expect(storedTriples).toHaveLength(3);
      
      // Check each property is stored
      const nameTriples = tripleStore.query('ex:alice', 'user:name', null);
      expect(nameTriples).toHaveLength(1);
      expect(nameTriples[0][2]).toBe('Alice Smith');
      
      const emailTriples = tripleStore.query('ex:alice', 'user:email', null);
      expect(emailTriples).toHaveLength(1);
      expect(emailTriples[0][2]).toBe('alice@example.com');
      
      const ageTriples = tripleStore.query('ex:alice', 'user:age', null);
      expect(ageTriples).toHaveLength(1);
      expect(ageTriples[0][2]).toBe(30);
    });

    it('should handle multi-valued properties in store', () => {
      const entity = {
        'user/name': 'Alice',
        'user/hobby': ['reading', 'coding', 'gaming']
      };
      
      const entityId = 'http://example.org/alice';
      
      const triples = converter.entityToTriples(entity, entityId);
      triples.forEach(([s, p, o]) => {
        tripleStore.add(s, p, o);
      });
      
      // Should have 4 triples total (1 name + 3 hobbies)
      const allTriples = tripleStore.query('ex:alice', null, null);
      expect(allTriples).toHaveLength(4);
      
      // Query hobbies specifically
      const hobbyTriples = tripleStore.query('ex:alice', 'user:hobby', null);
      expect(hobbyTriples).toHaveLength(3);
      
      const hobbies = hobbyTriples.map(([s, p, o]) => o);
      expect(hobbies).toContain('reading');
      expect(hobbies).toContain('coding');
      expect(hobbies).toContain('gaming');
    });

    it('should handle entity references in store', () => {
      const aliceEntity = {
        'user/name': 'Alice',
        'user/friend': 'http://example.org/bob'
      };
      
      const bobEntity = {
        'user/name': 'Bob'
      };
      
      const aliceId = 'http://example.org/alice';
      const bobId = 'http://example.org/bob';
      
      // Add both entities to store
      const aliceTriples = converter.entityToTriples(aliceEntity, aliceId);
      const bobTriples = converter.entityToTriples(bobEntity, bobId);
      
      [...aliceTriples, ...bobTriples].forEach(([s, p, o]) => {
        tripleStore.add(s, p, o);
      });
      
      // Verify reference is stored correctly
      const friendTriples = tripleStore.query('ex:alice', 'user:friend', null);
      expect(friendTriples).toHaveLength(1);
      expect(friendTriples[0][2]).toBe('ex:bob');
      
      // Verify we can query Bob's data
      const bobNameTriples = tripleStore.query('ex:bob', 'user:name', null);
      expect(bobNameTriples).toHaveLength(1);
      expect(bobNameTriples[0][2]).toBe('Bob');
    });
  });

  describe('Store to entity workflow', () => {
    it('should query store and convert triples back to entity', () => {
      // Add triples directly to store
      tripleStore.add('ex:alice', 'user:name', 'Alice Smith');
      tripleStore.add('ex:alice', 'user:email', 'alice@example.com');
      tripleStore.add('ex:alice', 'user:age', 30);
      
      // Query all triples for Alice
      const triples = tripleStore.query('ex:alice', null, null);
      expect(triples).toHaveLength(3);
      
      // Convert triples to entity
      const entity = converter.triplesToEntity(triples, 'http://example.org/alice');
      
      expect(entity).toEqual({
        'user/name': 'Alice Smith',
        'user/email': 'alice@example.com',
        'user/age': 30
      });
    });

    it('should reconstruct multi-valued properties from store', () => {
      // Add multi-valued property triples
      tripleStore.add('ex:alice', 'user:name', 'Alice');
      tripleStore.add('ex:alice', 'user:hobby', 'reading');
      tripleStore.add('ex:alice', 'user:hobby', 'coding');
      tripleStore.add('ex:alice', 'user:hobby', 'gaming');
      
      const triples = tripleStore.query('ex:alice', null, null);
      const entity = converter.triplesToEntity(triples, 'ex:alice');
      
      expect(entity['user/name']).toBe('Alice');
      expect(Array.isArray(entity['user/hobby'])).toBe(true);
      expect(entity['user/hobby']).toHaveLength(3);
      expect(entity['user/hobby']).toEqual(
        expect.arrayContaining(['reading', 'coding', 'gaming'])
      );
    });

    it('should expand entity references from store', () => {
      // Add triples with references
      tripleStore.add('ex:alice', 'user:name', 'Alice');
      tripleStore.add('ex:alice', 'user:friend', 'ex:bob');
      tripleStore.add('ex:bob', 'user:name', 'Bob');
      
      // Query Alice's triples
      const aliceTriples = tripleStore.query('ex:alice', null, null);
      const aliceEntity = converter.triplesToEntity(aliceTriples, 'ex:alice');
      
      // Friend reference should be expanded to full URI
      expect(aliceEntity['user/friend']).toBe('http://example.org/bob');
      
      // We can then query Bob's data
      const bobTriples = tripleStore.query('ex:bob', null, null);
      const bobEntity = converter.triplesToEntity(bobTriples, 'ex:bob');
      expect(bobEntity['user/name']).toBe('Bob');
    });
  });

  describe('Complete round-trip through store', () => {
    it('should preserve entity through store round-trip', () => {
      const originalEntity = {
        'user/name': 'Alice Smith',
        'user/age': 30,
        'user/active': true,
        'user/hobbies': ['reading', 'coding']
      };
      
      const entityId = 'http://example.org/alice';
      
      // Convert to triples and add to store
      const triples = converter.entityToTriples(originalEntity, entityId);
      triples.forEach(([s, p, o]) => {
        tripleStore.add(s, p, o);
      });
      
      // Query from store and convert back
      const storedTriples = tripleStore.query('ex:alice', null, null);
      const reconstructedEntity = converter.triplesToEntity(storedTriples, entityId);
      
      // Should match original (accounting for array order)
      expect(reconstructedEntity['user/name']).toBe('Alice Smith');
      expect(reconstructedEntity['user/age']).toBe(30);
      expect(reconstructedEntity['user/active']).toBe(true);
      expect(reconstructedEntity['user/hobbies']).toEqual(
        expect.arrayContaining(['reading', 'coding'])
      );
    });

    it('should preserve Date objects through store round-trip', () => {
      const originalEntity = {
        'user/name': 'Alice',
        'user/created': new Date('2024-01-15T10:30:00.000Z')
      };
      
      const entityId = 'http://example.org/alice';
      
      // Convert to triples and add to store
      const triples = converter.entityToTriples(originalEntity, entityId);
      triples.forEach(([s, p, o]) => {
        tripleStore.add(s, p, o);
      });
      
      // Query from store and convert back
      const storedTriples = tripleStore.query('ex:alice', null, null);
      const reconstructedEntity = converter.triplesToEntity(storedTriples, entityId);
      
      // Date should be reconstructed
      expect(reconstructedEntity['user/created'] instanceof Date).toBe(true);
      expect(reconstructedEntity['user/created'].getTime()).toBe(
        originalEntity['user/created'].getTime()
      );
    });
  });

  describe('Multiple entities in store', () => {
    it('should handle multiple entities independently', () => {
      const alice = {
        'user/name': 'Alice',
        'user/age': 30
      };
      
      const bob = {
        'user/name': 'Bob',
        'user/age': 35
      };
      
      const aliceId = 'http://example.org/alice';
      const bobId = 'http://example.org/bob';
      
      // Add both entities
      const aliceTriples = converter.entityToTriples(alice, aliceId);
      const bobTriples = converter.entityToTriples(bob, bobId);
      
      [...aliceTriples, ...bobTriples].forEach(([s, p, o]) => {
        tripleStore.add(s, p, o);
      });
      
      // Query and reconstruct Alice
      const aliceStoredTriples = tripleStore.query('ex:alice', null, null);
      const reconstructedAlice = converter.triplesToEntity(aliceStoredTriples, aliceId);
      
      expect(reconstructedAlice).toEqual(alice);
      
      // Query and reconstruct Bob
      const bobStoredTriples = tripleStore.query('ex:bob', null, null);
      const reconstructedBob = converter.triplesToEntity(bobStoredTriples, bobId);
      
      expect(reconstructedBob).toEqual(bob);
      
      // Verify total triple count
      const allTriples = tripleStore.query(null, null, null);
      expect(allTriples).toHaveLength(4); // 2 properties × 2 entities
    });

    it('should handle relationships between multiple entities', () => {
      const alice = {
        'user/name': 'Alice',
        'user/knows': ['http://example.org/bob', 'http://example.org/charlie']
      };
      
      const bob = {
        'user/name': 'Bob'
      };
      
      const charlie = {
        'user/name': 'Charlie'
      };
      
      // Add all entities to store
      const aliceTriples = converter.entityToTriples(alice, 'http://example.org/alice');
      const bobTriples = converter.entityToTriples(bob, 'http://example.org/bob');
      const charlieTriples = converter.entityToTriples(charlie, 'http://example.org/charlie');
      
      [...aliceTriples, ...bobTriples, ...charlieTriples].forEach(([s, p, o]) => {
        tripleStore.add(s, p, o);
      });
      
      // Verify Alice's relationships
      const aliceStoredTriples = tripleStore.query('ex:alice', null, null);
      const reconstructedAlice = converter.triplesToEntity(aliceStoredTriples, 'http://example.org/alice');
      
      expect(Array.isArray(reconstructedAlice['user/knows'])).toBe(true);
      expect(reconstructedAlice['user/knows']).toHaveLength(2);
      expect(reconstructedAlice['user/knows']).toEqual(
        expect.arrayContaining([
          'http://example.org/bob',
          'http://example.org/charlie'
        ])
      );
      
      // Verify we can follow relationships
      const bobStoredTriples = tripleStore.query('ex:bob', null, null);
      const reconstructedBob = converter.triplesToEntity(bobStoredTriples, 'http://example.org/bob');
      expect(reconstructedBob['user/name']).toBe('Bob');
      
      const charlieStoredTriples = tripleStore.query('ex:charlie', null, null);
      const reconstructedCharlie = converter.triplesToEntity(charlieStoredTriples, 'http://example.org/charlie');
      expect(reconstructedCharlie['user/name']).toBe('Charlie');
    });
  });

  describe('Complex integration scenarios', () => {
    it('should handle complex entity with all features', () => {
      const complexEntity = {
        'user/name': 'Alice Smith',
        'user/age': 30,
        'user/active': true,
        'user/score': 95.5,
        'user/hobbies': ['reading', 'coding', 'gaming'],
        'user/friends': [
          'http://example.org/bob',
          'http://example.org/charlie'
        ],
        'user/created': new Date('2024-01-15T10:30:00.000Z')
      };
      
      const entityId = 'http://example.org/alice';
      
      // Store entity
      const triples = converter.entityToTriples(complexEntity, entityId);
      triples.forEach(([s, p, o]) => {
        tripleStore.add(s, p, o);
      });
      
      // Retrieve and reconstruct
      const storedTriples = tripleStore.query('ex:alice', null, null);
      const reconstructed = converter.triplesToEntity(storedTriples, entityId);
      
      // Verify all properties
      expect(reconstructed['user/name']).toBe('Alice Smith');
      expect(reconstructed['user/age']).toBe(30);
      expect(reconstructed['user/active']).toBe(true);
      expect(reconstructed['user/score']).toBe(95.5);
      expect(reconstructed['user/hobbies']).toEqual(
        expect.arrayContaining(['reading', 'coding', 'gaming'])
      );
      expect(reconstructed['user/friends']).toEqual(
        expect.arrayContaining([
          'http://example.org/bob',
          'http://example.org/charlie'
        ])
      );
      expect(reconstructed['user/created'] instanceof Date).toBe(true);
    });

    it('should support property queries across entities', () => {
      // Add multiple people with ages
      const people = [
        { id: 'alice', name: 'Alice', age: 30 },
        { id: 'bob', name: 'Bob', age: 35 },
        { id: 'charlie', name: 'Charlie', age: 30 }
      ];
      
      people.forEach(({ id, name, age }) => {
        const entity = { 'user/name': name, 'user/age': age };
        const triples = converter.entityToTriples(
          entity,
          `http://example.org/${id}`
        );
        triples.forEach(([s, p, o]) => {
          tripleStore.add(s, p, o);
        });
      });
      
      // Query all people with age 30
      const age30Triples = tripleStore.query(null, 'user:age', 30);
      expect(age30Triples).toHaveLength(2); // Alice and Charlie
      
      // Get their subjects
      const subjects = age30Triples.map(([s, p, o]) => s);
      expect(subjects).toContain('ex:alice');
      expect(subjects).toContain('ex:charlie');
      expect(subjects).not.toContain('ex:bob');
    });
  });
});