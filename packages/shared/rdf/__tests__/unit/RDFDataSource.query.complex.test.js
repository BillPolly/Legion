/**
 * Unit tests for RDFDataSource.query() - Complex queries
 * 
 * Tests complex query functionality:
 * - Filter predicates
 * - Entity reconstruction from triples
 * - Relationship traversal
 * - Complex multi-hop queries
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { RDFDataSource } from '../../src/RDFDataSource.js';
import { NamespaceManager } from '../../src/NamespaceManager.js';
import { SimpleTripleStore } from '../../src/SimpleTripleStore.js';

describe('RDFDataSource.query() - Complex queries', () => {
  let dataSource;
  let tripleStore;
  let namespaceManager;

  beforeEach(() => {
    tripleStore = new SimpleTripleStore();
    namespaceManager = new NamespaceManager();
    namespaceManager.addNamespace('ex', 'http://example.org/');
    
    dataSource = new RDFDataSource(tripleStore, namespaceManager);
  });

  describe('Filter predicates', () => {
    beforeEach(() => {
      // Add test data
      tripleStore.add('ex:alice', 'rdf:type', 'ex:Person');
      tripleStore.add('ex:alice', 'ex:name', 'Alice Smith');
      tripleStore.add('ex:alice', 'ex:age', 30);
      tripleStore.add('ex:alice', 'ex:score', 85);
      
      tripleStore.add('ex:bob', 'rdf:type', 'ex:Person');
      tripleStore.add('ex:bob', 'ex:name', 'Bob Jones');
      tripleStore.add('ex:bob', 'ex:age', 25);
      tripleStore.add('ex:bob', 'ex:score', 92);
      
      tripleStore.add('ex:charlie', 'rdf:type', 'ex:Person');
      tripleStore.add('ex:charlie', 'ex:name', 'Charlie Brown');
      tripleStore.add('ex:charlie', 'ex:age', 35);
      tripleStore.add('ex:charlie', 'ex:score', 78);
    });

    it('should filter results with filter predicate', () => {
      const results = dataSource.query({
        find: ['?entity', '?age'],
        where: [
          ['?entity', 'rdf:type', 'ex:Person'],
          ['?entity', 'ex:age', '?age']
        ],
        filter: (bindings) => bindings.age >= 30
      });

      expect(results).toHaveLength(2);
      expect(results).toContainEqual({ entity: 'ex:alice', age: 30 });
      expect(results).toContainEqual({ entity: 'ex:charlie', age: 35 });
    });

    it('should filter with multiple conditions', () => {
      const results = dataSource.query({
        find: ['?entity', '?age', '?score'],
        where: [
          ['?entity', 'rdf:type', 'ex:Person'],
          ['?entity', 'ex:age', '?age'],
          ['?entity', 'ex:score', '?score']
        ],
        filter: (bindings) => bindings.age >= 25 && bindings.score >= 85
      });

      expect(results).toHaveLength(2);
      expect(results).toContainEqual({ entity: 'ex:alice', age: 30, score: 85 });
      expect(results).toContainEqual({ entity: 'ex:bob', age: 25, score: 92 });
    });

    it('should filter with string comparison', () => {
      const results = dataSource.query({
        find: ['?entity', '?name'],
        where: [
          ['?entity', 'rdf:type', 'ex:Person'],
          ['?entity', 'ex:name', '?name']
        ],
        filter: (bindings) => bindings.name.includes('Alice')
      });

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ entity: 'ex:alice', name: 'Alice Smith' });
    });

    it('should return empty array if all results filtered out', () => {
      const results = dataSource.query({
        find: ['?entity', '?age'],
        where: [
          ['?entity', 'rdf:type', 'ex:Person'],
          ['?entity', 'ex:age', '?age']
        ],
        filter: (bindings) => bindings.age >= 100
      });

      expect(results).toEqual([]);
    });

    it('should work without filter (all results)', () => {
      const results = dataSource.query({
        find: ['?entity'],
        where: [['?entity', 'rdf:type', 'ex:Person']]
      });

      expect(results).toHaveLength(3);
    });
  });

  describe('Entity reconstruction from triples', () => {
    beforeEach(() => {
      // Add entity data as separate triples
      tripleStore.add('ex:alice', 'rdf:type', 'ex:Person');
      tripleStore.add('ex:alice', 'ex:name', 'Alice Smith');
      tripleStore.add('ex:alice', 'ex:age', 30);
      tripleStore.add('ex:alice', 'ex:email', 'alice@example.com');
      tripleStore.add('ex:alice', 'ex:active', true);
      
      tripleStore.add('ex:bob', 'rdf:type', 'ex:Person');
      tripleStore.add('ex:bob', 'ex:name', 'Bob Jones');
      tripleStore.add('ex:bob', 'ex:age', 25);
    });

    it('should reconstruct entity with all properties', () => {
      const results = dataSource.query({
        find: ['?entity', '?name', '?age', '?email', '?active'],
        where: [
          ['?entity', 'ex:name', '?name'],
          ['?entity', 'ex:age', '?age'],
          ['?entity', 'ex:email', '?email'],
          ['?entity', 'ex:active', '?active']
        ]
      });

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        entity: 'ex:alice',
        name: 'Alice Smith',
        age: 30,
        email: 'alice@example.com',
        active: true
      });
    });

    it('should handle missing properties in entity reconstruction', () => {
      const results = dataSource.query({
        find: ['?entity', '?name', '?email'],
        where: [
          ['?entity', 'rdf:type', 'ex:Person'],
          ['?entity', 'ex:name', '?name'],
          ['?entity', 'ex:email', '?email']
        ]
      });

      // Only Alice has email
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        entity: 'ex:alice',
        name: 'Alice Smith',
        email: 'alice@example.com'
      });
    });

    it('should reconstruct multiple entities', () => {
      const results = dataSource.query({
        find: ['?entity', '?name', '?age'],
        where: [
          ['?entity', 'rdf:type', 'ex:Person'],
          ['?entity', 'ex:name', '?name'],
          ['?entity', 'ex:age', '?age']
        ]
      });

      expect(results).toHaveLength(2);
      expect(results).toContainEqual({
        entity: 'ex:alice',
        name: 'Alice Smith',
        age: 30
      });
      expect(results).toContainEqual({
        entity: 'ex:bob',
        name: 'Bob Jones',
        age: 25
      });
    });

    it('should preserve JavaScript types in reconstruction', () => {
      const results = dataSource.query({
        find: ['?entity', '?age', '?active'],
        where: [
          ['?entity', 'ex:age', '?age'],
          ['?entity', 'ex:active', '?active']
        ]
      });

      expect(results).toHaveLength(1);
      expect(typeof results[0].age).toBe('number');
      expect(typeof results[0].active).toBe('boolean');
      expect(results[0].age).toBe(30);
      expect(results[0].active).toBe(true);
    });
  });

  describe('Relationship traversal', () => {
    beforeEach(() => {
      // Create relationship graph
      tripleStore.add('ex:alice', 'rdf:type', 'ex:Person');
      tripleStore.add('ex:alice', 'ex:name', 'Alice Smith');
      tripleStore.add('ex:alice', 'ex:knows', 'ex:bob');
      tripleStore.add('ex:alice', 'ex:knows', 'ex:charlie');
      
      tripleStore.add('ex:bob', 'rdf:type', 'ex:Person');
      tripleStore.add('ex:bob', 'ex:name', 'Bob Jones');
      tripleStore.add('ex:bob', 'ex:knows', 'ex:charlie');
      tripleStore.add('ex:bob', 'ex:knows', 'ex:diana');
      
      tripleStore.add('ex:charlie', 'rdf:type', 'ex:Person');
      tripleStore.add('ex:charlie', 'ex:name', 'Charlie Brown');
      
      tripleStore.add('ex:diana', 'rdf:type', 'ex:Person');
      tripleStore.add('ex:diana', 'ex:name', 'Diana Prince');
    });

    it('should traverse single relationship', () => {
      const results = dataSource.query({
        find: ['?person', '?friend'],
        where: [
          ['?person', 'ex:name', 'Alice Smith'],
          ['?person', 'ex:knows', '?friend']
        ]
      });

      expect(results).toHaveLength(2);
      expect(results).toContainEqual({ person: 'ex:alice', friend: 'ex:bob' });
      expect(results).toContainEqual({ person: 'ex:alice', friend: 'ex:charlie' });
    });

    it('should traverse relationship with friend properties', () => {
      const results = dataSource.query({
        find: ['?person', '?friend', '?friendName'],
        where: [
          ['?person', 'ex:name', 'Alice Smith'],
          ['?person', 'ex:knows', '?friend'],
          ['?friend', 'ex:name', '?friendName']
        ]
      });

      expect(results).toHaveLength(2);
      expect(results).toContainEqual({
        person: 'ex:alice',
        friend: 'ex:bob',
        friendName: 'Bob Jones'
      });
      expect(results).toContainEqual({
        person: 'ex:alice',
        friend: 'ex:charlie',
        friendName: 'Charlie Brown'
      });
    });

    it('should traverse multi-hop relationships', () => {
      // Find friends of friends
      const results = dataSource.query({
        find: ['?person', '?friend', '?friendOfFriend'],
        where: [
          ['?person', 'ex:name', 'Alice Smith'],
          ['?person', 'ex:knows', '?friend'],
          ['?friend', 'ex:knows', '?friendOfFriend']
        ]
      });

      // Alice knows Bob and Charlie
      // Bob knows Charlie and Diana
      // Charlie knows no one
      expect(results).toHaveLength(2);
      expect(results).toContainEqual({
        person: 'ex:alice',
        friend: 'ex:bob',
        friendOfFriend: 'ex:charlie'
      });
      expect(results).toContainEqual({
        person: 'ex:alice',
        friend: 'ex:bob',
        friendOfFriend: 'ex:diana'
      });
    });

    it('should find all who know a specific person', () => {
      const results = dataSource.query({
        find: ['?person', '?personName'],
        where: [
          ['?person', 'ex:knows', 'ex:charlie'],
          ['?person', 'ex:name', '?personName']
        ]
      });

      expect(results).toHaveLength(2);
      expect(results).toContainEqual({
        person: 'ex:alice',
        personName: 'Alice Smith'
      });
      expect(results).toContainEqual({
        person: 'ex:bob',
        personName: 'Bob Jones'
      });
    });

    it('should handle bidirectional relationships', () => {
      // Add reverse relationship
      tripleStore.add('ex:charlie', 'ex:knows', 'ex:alice');

      const results = dataSource.query({
        find: ['?person', '?friend'],
        where: [
          ['?person', 'ex:name', 'Alice Smith'],
          ['?person', 'ex:knows', '?friend'],
          ['?friend', 'ex:knows', '?person']
        ]
      });

      // Only Charlie has bidirectional relationship with Alice
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        person: 'ex:alice',
        friend: 'ex:charlie'
      });
    });
  });

  describe('Complex multi-hop queries', () => {
    beforeEach(() => {
      // Create document authorship graph
      tripleStore.add('ex:alice', 'rdf:type', 'ex:Person');
      tripleStore.add('ex:alice', 'ex:name', 'Alice Smith');
      tripleStore.add('ex:alice', 'ex:authored', 'ex:doc1');
      tripleStore.add('ex:alice', 'ex:authored', 'ex:doc2');
      
      tripleStore.add('ex:bob', 'rdf:type', 'ex:Person');
      tripleStore.add('ex:bob', 'ex:name', 'Bob Jones');
      tripleStore.add('ex:bob', 'ex:authored', 'ex:doc3');
      
      tripleStore.add('ex:doc1', 'rdf:type', 'ex:Document');
      tripleStore.add('ex:doc1', 'ex:title', 'Introduction to RDF');
      tripleStore.add('ex:doc1', 'ex:cites', 'ex:doc3');
      
      tripleStore.add('ex:doc2', 'rdf:type', 'ex:Document');
      tripleStore.add('ex:doc2', 'ex:title', 'Advanced RDF Patterns');
      
      tripleStore.add('ex:doc3', 'rdf:type', 'ex:Document');
      tripleStore.add('ex:doc3', 'ex:title', 'Triple Store Basics');
    });

    it('should query author and their documents', () => {
      const results = dataSource.query({
        find: ['?author', '?authorName', '?document', '?title'],
        where: [
          ['?author', 'ex:name', '?authorName'],
          ['?author', 'ex:authored', '?document'],
          ['?document', 'ex:title', '?title']
        ]
      });

      expect(results).toHaveLength(3);
      expect(results).toContainEqual({
        author: 'ex:alice',
        authorName: 'Alice Smith',
        document: 'ex:doc1',
        title: 'Introduction to RDF'
      });
    });

    it('should query citation chains', () => {
      const results = dataSource.query({
        find: ['?doc', '?citedDoc', '?citedTitle'],
        where: [
          ['?doc', 'ex:title', 'Introduction to RDF'],
          ['?doc', 'ex:cites', '?citedDoc'],
          ['?citedDoc', 'ex:title', '?citedTitle']
        ]
      });

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        doc: 'ex:doc1',
        citedDoc: 'ex:doc3',
        citedTitle: 'Triple Store Basics'
      });
    });

    it('should find author of cited document', () => {
      const results = dataSource.query({
        find: ['?doc', '?citedDoc', '?citedAuthor', '?citedAuthorName'],
        where: [
          ['?doc', 'ex:title', 'Introduction to RDF'],
          ['?doc', 'ex:cites', '?citedDoc'],
          ['?citedAuthor', 'ex:authored', '?citedDoc'],
          ['?citedAuthor', 'ex:name', '?citedAuthorName']
        ]
      });

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        doc: 'ex:doc1',
        citedDoc: 'ex:doc3',
        citedAuthor: 'ex:bob',
        citedAuthorName: 'Bob Jones'
      });
    });

    it('should combine multiple hops with filter', () => {
      tripleStore.add('ex:doc3', 'ex:year', 2020);
      tripleStore.add('ex:doc1', 'ex:year', 2021);

      const results = dataSource.query({
        find: ['?doc', '?citedDoc', '?year'],
        where: [
          ['?doc', 'ex:title', 'Introduction to RDF'],
          ['?doc', 'ex:cites', '?citedDoc'],
          ['?citedDoc', 'ex:year', '?year']
        ],
        filter: (bindings) => bindings.year >= 2020
      });

      expect(results).toHaveLength(1);
      expect(results[0].year).toBe(2020);
    });
  });

  describe('Query performance edge cases', () => {
    it('should handle queries with many results', () => {
      // Add many entities
      for (let i = 0; i < 100; i++) {
        tripleStore.add(`ex:person${i}`, 'rdf:type', 'ex:Person');
        tripleStore.add(`ex:person${i}`, 'ex:id', i);
      }

      const results = dataSource.query({
        find: ['?person'],
        where: [['?person', 'rdf:type', 'ex:Person']]
      });

      expect(results).toHaveLength(100);
    });

    it('should handle deeply nested queries', () => {
      // Create a chain: alice -> bob -> charlie -> diana
      tripleStore.add('ex:alice', 'ex:next', 'ex:bob');
      tripleStore.add('ex:bob', 'ex:next', 'ex:charlie');
      tripleStore.add('ex:charlie', 'ex:next', 'ex:diana');

      const results = dataSource.query({
        find: ['?a', '?b', '?c', '?d'],
        where: [
          ['?a', 'ex:next', '?b'],
          ['?b', 'ex:next', '?c'],
          ['?c', 'ex:next', '?d']
        ]
      });

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        a: 'ex:alice',
        b: 'ex:bob',
        c: 'ex:charlie',
        d: 'ex:diana'
      });
    });

    it('should handle queries with no matching pattern efficiently', () => {
      tripleStore.add('ex:alice', 'ex:name', 'Alice');

      const results = dataSource.query({
        find: ['?person'],
        where: [
          ['?person', 'ex:name', 'Alice'],
          ['?person', 'ex:age', 30],
          ['?person', 'ex:city', 'NYC']
        ]
      });

      // Should short-circuit after first missing pattern
      expect(results).toEqual([]);
    });
  });
});