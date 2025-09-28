/**
 * Unit tests for RDFDataSource.query() - Basic queries
 * 
 * Tests basic query functionality:
 * - Simple triple pattern queries
 * - Variable binding
 * - Multiple where clauses
 * - Query translation from Handle format to triple patterns
 * - Result reconstruction as entities
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { RDFDataSource } from '../../src/RDFDataSource.js';
import { NamespaceManager } from '../../src/NamespaceManager.js';
import { SimpleTripleStore } from '../../src/SimpleTripleStore.js';

describe('RDFDataSource.query() - Basic queries', () => {
  let dataSource;
  let tripleStore;
  let namespaceManager;

  beforeEach(() => {
    tripleStore = new SimpleTripleStore();
    namespaceManager = new NamespaceManager();
    namespaceManager.addNamespace('ex', 'http://example.org/');
    
    dataSource = new RDFDataSource(tripleStore, namespaceManager);
  });

  describe('Constructor validation', () => {
    it('should throw if triple store is missing', () => {
      expect(() => {
        new RDFDataSource(null, namespaceManager);
      }).toThrow('RDFDataSource requires a triple store');
    });

    it('should throw if namespace manager is missing', () => {
      expect(() => {
        new RDFDataSource(tripleStore, null);
      }).toThrow('RDFDataSource requires a NamespaceManager');
    });

    it('should create instance with valid parameters', () => {
      const ds = new RDFDataSource(tripleStore, namespaceManager);
      expect(ds).toBeInstanceOf(RDFDataSource);
    });
  });

  describe('Simple triple pattern queries', () => {
    beforeEach(() => {
      // Add test data
      tripleStore.add('ex:alice', 'rdf:type', 'ex:Person');
      tripleStore.add('ex:alice', 'ex:name', 'Alice Smith');
      tripleStore.add('ex:alice', 'ex:age', 30);
      
      tripleStore.add('ex:bob', 'rdf:type', 'ex:Person');
      tripleStore.add('ex:bob', 'ex:name', 'Bob Jones');
      tripleStore.add('ex:bob', 'ex:age', 25);
    });

    it('should query by type', () => {
      const results = dataSource.query({
        find: ['?entity'],
        where: [['?entity', 'type', 'ex:Person']]
      });

      expect(results).toHaveLength(2);
      expect(results).toContainEqual({ entity: 'ex:alice' });
      expect(results).toContainEqual({ entity: 'ex:bob' });
    });

    it('should query by property value', () => {
      const results = dataSource.query({
        find: ['?entity'],
        where: [['?entity', 'ex:name', 'Alice Smith']]
      });

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ entity: 'ex:alice' });
    });

    it('should query with numeric value', () => {
      const results = dataSource.query({
        find: ['?entity'],
        where: [['?entity', 'ex:age', 30]]
      });

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ entity: 'ex:alice' });
    });

    it('should return empty array for no matches', () => {
      const results = dataSource.query({
        find: ['?entity'],
        where: [['?entity', 'ex:name', 'Charlie']]
      });

      expect(results).toEqual([]);
    });
  });

  describe('Variable binding', () => {
    beforeEach(() => {
      tripleStore.add('ex:alice', 'ex:name', 'Alice Smith');
      tripleStore.add('ex:alice', 'ex:age', 30);
      tripleStore.add('ex:bob', 'ex:name', 'Bob Jones');
      tripleStore.add('ex:bob', 'ex:age', 25);
    });

    it('should bind variable in object position', () => {
      const results = dataSource.query({
        find: ['?name'],
        where: [['ex:alice', 'ex:name', '?name']]
      });

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ name: 'Alice Smith' });
    });

    it('should bind multiple variables', () => {
      const results = dataSource.query({
        find: ['?entity', '?name'],
        where: [['?entity', 'ex:name', '?name']]
      });

      expect(results).toHaveLength(2);
      expect(results).toContainEqual({ entity: 'ex:alice', name: 'Alice Smith' });
      expect(results).toContainEqual({ entity: 'ex:bob', name: 'Bob Jones' });
    });

    it('should bind variables with different types', () => {
      const results = dataSource.query({
        find: ['?entity', '?age'],
        where: [['?entity', 'ex:age', '?age']]
      });

      expect(results).toHaveLength(2);
      expect(results).toContainEqual({ entity: 'ex:alice', age: 30 });
      expect(results).toContainEqual({ entity: 'ex:bob', age: 25 });
    });
  });

  describe('Multiple where clauses', () => {
    beforeEach(() => {
      tripleStore.add('ex:alice', 'rdf:type', 'ex:Person');
      tripleStore.add('ex:alice', 'ex:name', 'Alice Smith');
      tripleStore.add('ex:alice', 'ex:age', 30);
      
      tripleStore.add('ex:bob', 'rdf:type', 'ex:Person');
      tripleStore.add('ex:bob', 'ex:name', 'Bob Jones');
      tripleStore.add('ex:bob', 'ex:age', 25);
      
      tripleStore.add('ex:charlie', 'rdf:type', 'ex:Person');
      tripleStore.add('ex:charlie', 'ex:name', 'Charlie Brown');
      // Charlie has no age
    });

    it('should filter with multiple constraints', () => {
      const results = dataSource.query({
        find: ['?entity'],
        where: [
          ['?entity', 'rdf:type', 'ex:Person'],
          ['?entity', 'ex:age', 30]
        ]
      });

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ entity: 'ex:alice' });
    });

    it('should bind variables across multiple clauses', () => {
      const results = dataSource.query({
        find: ['?entity', '?name', '?age'],
        where: [
          ['?entity', 'ex:name', '?name'],
          ['?entity', 'ex:age', '?age']
        ]
      });

      expect(results).toHaveLength(2);
      expect(results).toContainEqual({ entity: 'ex:alice', name: 'Alice Smith', age: 30 });
      expect(results).toContainEqual({ entity: 'ex:bob', name: 'Bob Jones', age: 25 });
      
      // Charlie is not in results because he has no age
      expect(results.find(r => r.entity === 'ex:charlie')).toBeUndefined();
    });

    it('should handle shared variable between clauses', () => {
      tripleStore.add('ex:alice', 'ex:knows', 'ex:bob');
      tripleStore.add('ex:bob', 'ex:knows', 'ex:charlie');

      const results = dataSource.query({
        find: ['?person', '?friend', '?friendName'],
        where: [
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
        person: 'ex:bob', 
        friend: 'ex:charlie', 
        friendName: 'Charlie Brown' 
      });
    });

    it('should return empty array when constraints cannot be satisfied', () => {
      const results = dataSource.query({
        find: ['?entity'],
        where: [
          ['?entity', 'rdf:type', 'ex:Person'],
          ['?entity', 'ex:age', 100] // No one is 100
        ]
      });

      expect(results).toEqual([]);
    });
  });

  describe('Query validation', () => {
    it('should throw if querySpec is missing', () => {
      expect(() => {
        dataSource.query(null);
      }).toThrow('Query spec is required');
    });

    it('should throw if find is missing', () => {
      expect(() => {
        dataSource.query({ where: [] });
      }).toThrow('Query spec must have find array');
    });

    it('should throw if where is missing', () => {
      expect(() => {
        dataSource.query({ find: ['?entity'] });
      }).toThrow('Query spec must have where array');
    });

    it('should throw if find is not an array', () => {
      expect(() => {
        dataSource.query({ find: '?entity', where: [] });
      }).toThrow('Query spec must have find array');
    });

    it('should throw if where is not an array', () => {
      expect(() => {
        dataSource.query({ find: ['?entity'], where: {} });
      }).toThrow('Query spec must have where array');
    });

    it('should handle empty where array', () => {
      const results = dataSource.query({
        find: ['?entity'],
        where: []
      });

      // Empty where means no constraints - but also no matches since nothing binds
      expect(results).toEqual([]);
    });
  });

  describe('Type translation', () => {
    it('should translate "type" predicate to rdf:type', () => {
      tripleStore.add('ex:alice', 'rdf:type', 'ex:Person');

      const results = dataSource.query({
        find: ['?entity'],
        where: [['?entity', 'type', 'ex:Person']]
      });

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ entity: 'ex:alice' });
    });

    it('should handle explicit rdf:type predicate', () => {
      tripleStore.add('ex:alice', 'rdf:type', 'ex:Person');

      const results = dataSource.query({
        find: ['?entity'],
        where: [['?entity', 'rdf:type', 'ex:Person']]
      });

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ entity: 'ex:alice' });
    });
  });

  describe('Edge cases', () => {
    it('should handle query with no variable in find', () => {
      tripleStore.add('ex:alice', 'ex:name', 'Alice Smith');

      // Query just to check if a triple exists
      const results = dataSource.query({
        find: [],
        where: [['ex:alice', 'ex:name', 'Alice Smith']]
      });

      // Should return single empty binding if pattern matches
      expect(results).toEqual([{}]);
    });

    it('should handle same variable multiple times in where', () => {
      tripleStore.add('ex:alice', 'ex:knows', 'ex:bob');
      tripleStore.add('ex:bob', 'ex:knows', 'ex:alice');

      const results = dataSource.query({
        find: ['?person'],
        where: [
          ['?person', 'ex:knows', 'ex:bob'],
          ['ex:bob', 'ex:knows', '?person']
        ]
      });

      // Alice knows Bob and Bob knows Alice
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ person: 'ex:alice' });
    });

    it('should handle literal values with special characters', () => {
      tripleStore.add('ex:alice', 'ex:email', 'alice@example.com');

      const results = dataSource.query({
        find: ['?email'],
        where: [['ex:alice', 'ex:email', '?email']]
      });

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ email: 'alice@example.com' });
    });
  });
});