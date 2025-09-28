/**
 * Integration tests for RDFHandle with RDFDataSource
 * 
 * Tests the complete RDFHandle + RDFDataSource integration:
 * - RDFHandle works with real RDFDataSource implementation
 * - End-to-end entity lifecycle operations
 * - Real subscription notifications
 * - Cache invalidation through actual data changes
 * - RDF-specific conveniences with real RDF data
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { RDFHandle } from '../../src/RDFHandle.js';
import { RDFDataSource } from '../../src/RDFDataSource.js';
import { createInMemoryTripleStore } from '@legion/triplestore';
import { NamespaceManager } from '../../src/NamespaceManager.js';

/**
 * Create a synchronous in-memory triple store for testing
 * DataSource requires synchronous operations
 */
function createSyncInMemoryTripleStore() {
  // Create a fully synchronous triple store implementation
  const store = {
    // Store triples synchronously
    triples: new Set(),
    tripleData: new Map(),
    _subscribers: new Set(),
    
    // Synchronous query method
    query(subject, predicate, object) {
      const results = [];
      
      // Iterate through all stored triples
      for (const [key, triple] of this.tripleData) {
        const [s, p, o] = triple;
        
        // Check if this triple matches the pattern
        const subjectMatch = (subject === null || subject === undefined || s === subject);
        const predicateMatch = (predicate === null || predicate === undefined || p === predicate);
        const objectMatch = (object === null || object === undefined || o === object);
        
        if (subjectMatch && predicateMatch && objectMatch) {
          results.push([s, p, o]);
        }
      }
      
      return results;
    },
    
    // Synchronous add method
    addTriple(subject, predicate, object) {
      const key = `${subject}|${predicate}|${object}`;
      
      if (this.triples.has(key)) {
        return false;
      }
      
      this.triples.add(key);
      this.tripleData.set(key, [subject, predicate, object]);
      
      // Notify subscribers synchronously
      this._subscribers.forEach(callback => callback());
      
      return true;
    },
    
    // Synchronous subscription
    subscribe(callback) {
      this._subscribers.add(callback);
      
      return {
        unsubscribe: () => {
          this._subscribers.delete(callback);
        }
      };
    }
  };
  
  return store;
}

describe('RDFHandle + RDFDataSource Integration', () => {
  let tripleStore;
  let namespaceManager;
  let dataSource;

  beforeEach(() => {
    // Create real components for integration testing
    // We need a synchronous triple store for DataSource compatibility
    tripleStore = createSyncInMemoryTripleStore();
    namespaceManager = new NamespaceManager();
    dataSource = new RDFDataSource(tripleStore, namespaceManager);

    // Add some standard namespaces
    namespaceManager.addNamespace('foaf', 'http://xmlns.com/foaf/0.1/');
    namespaceManager.addNamespace('rdf', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#');
    namespaceManager.addNamespace('ex', 'http://example.org/');
  });

  describe('Basic entity operations', () => {
    it('should create RDFHandle and access entity data through real DataSource', () => {
      // Add triples directly to store
      tripleStore.addTriple('ex:alice', 'rdf:type', 'foaf:Person');
      tripleStore.addTriple('ex:alice', 'foaf:name', 'Alice Smith');
      tripleStore.addTriple('ex:alice', 'foaf:age', 30);
      tripleStore.addTriple('ex:alice', 'foaf:email', 'alice@example.com');

      // Create RDFHandle for Alice
      const aliceHandle = new RDFHandle(dataSource, 'ex:alice');

      // Test value() method with real data
      const alice = aliceHandle.value();
      expect(alice).toBeDefined();
      expect(alice['foaf:name']).toBe('Alice Smith');
      expect(alice['foaf:age']).toBe(30);
      expect(alice['foaf:email']).toBe('alice@example.com');
      expect(alice['rdf:type']).toBe('foaf:Person');
    });

    it('should handle non-existent entity', () => {
      const nonExistentHandle = new RDFHandle(dataSource, 'ex:nonexistent');
      const value = nonExistentHandle.value();
      expect(value).toBeNull();
    });

    it('should handle multi-valued properties', () => {
      // Add entity with multi-valued property
      tripleStore.addTriple('ex:alice', 'foaf:name', 'Alice Smith');
      tripleStore.addTriple('ex:alice', 'foaf:knows', 'ex:bob');
      tripleStore.addTriple('ex:alice', 'foaf:knows', 'ex:charlie');
      tripleStore.addTriple('ex:alice', 'foaf:nick', 'Ali');
      tripleStore.addTriple('ex:alice', 'foaf:nick', 'Allie');

      const aliceHandle = new RDFHandle(dataSource, 'ex:alice');
      const alice = aliceHandle.value();

      expect(alice['foaf:name']).toBe('Alice Smith'); // Single-valued
      expect(Array.isArray(alice['foaf:knows'])).toBe(true);
      expect(alice['foaf:knows']).toHaveLength(2);
      expect(alice['foaf:knows']).toContain('ex:bob');
      expect(alice['foaf:knows']).toContain('ex:charlie');
      expect(Array.isArray(alice['foaf:nick'])).toBe(true);
      expect(alice['foaf:nick']).toContain('Ali');
      expect(alice['foaf:nick']).toContain('Allie');
    });
  });

  describe('Query operations', () => {
    beforeEach(() => {
      // Set up test data
      tripleStore.addTriple('ex:alice', 'rdf:type', 'foaf:Person');
      tripleStore.addTriple('ex:alice', 'foaf:name', 'Alice Smith');
      tripleStore.addTriple('ex:alice', 'foaf:age', 30);
      tripleStore.addTriple('ex:alice', 'foaf:knows', 'ex:bob');

      tripleStore.addTriple('ex:bob', 'rdf:type', 'foaf:Person');
      tripleStore.addTriple('ex:bob', 'foaf:name', 'Bob Jones');
      tripleStore.addTriple('ex:bob', 'foaf:age', 25);
      tripleStore.addTriple('ex:bob', 'foaf:knows', 'ex:alice');
    });

    it('should execute queries through RDFDataSource', () => {
      const aliceHandle = new RDFHandle(dataSource, 'ex:alice');

      // Query for all people
      const results = aliceHandle.query({
        find: ['?person', '?name'],
        where: [
          ['?person', 'rdf:type', 'foaf:Person'],
          ['?person', 'foaf:name', '?name']
        ]
      });

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThanOrEqual(2);
      
      const names = results.map(r => r['name']);
      expect(names).toContain('Alice Smith');
      expect(names).toContain('Bob Jones');
    });

    it('should execute entity-specific queries', () => {
      const aliceHandle = new RDFHandle(dataSource, 'ex:alice');

      // Query for Alice's properties
      const results = aliceHandle.query({
        find: ['?property', '?value'],
        where: [['ex:alice', '?property', '?value']]
      });

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThanOrEqual(4); // name, age, type, knows

      const properties = results.map(r => r['property']);
      expect(properties).toContain('foaf:name');
      expect(properties).toContain('foaf:age');
      expect(properties).toContain('rdf:type');
      expect(properties).toContain('foaf:knows');
    });
  });

  describe('Subscription operations', () => {
    it('should receive notifications when data changes', (done) => {
      // Set up initial data
      tripleStore.addTriple('ex:alice', 'foaf:name', 'Alice Smith');
      tripleStore.addTriple('ex:alice', 'foaf:age', 30);

      const aliceHandle = new RDFHandle(dataSource, 'ex:alice');
      
      // Get initial value to populate cache
      const initialValue = aliceHandle.value();
      expect(initialValue['foaf:name']).toBe('Alice Smith');

      // Subscribe to changes
      const subscription = aliceHandle.subscribe(
        {
          find: ['?p', '?o'],
          where: [['ex:alice', '?p', '?o']]
        },
        (changes) => {
          try {
            expect(Array.isArray(changes)).toBe(true);
            
            // Cache should be invalidated - get fresh value
            const updatedValue = aliceHandle.value();
            expect(updatedValue['foaf:email']).toBe('alice@example.com');
            
            subscription.unsubscribe();
            done();
          } catch (error) {
            subscription.unsubscribe();
            done(error);
          }
        }
      );

      // Make a change that should trigger notification
      setTimeout(() => {
        tripleStore.addTriple('ex:alice', 'foaf:email', 'alice@example.com');
      }, 10);
    });

    it('should handle subscription cleanup', () => {
      tripleStore.addTriple('ex:alice', 'foaf:name', 'Alice Smith');
      
      const aliceHandle = new RDFHandle(dataSource, 'ex:alice');
      
      const subscription = aliceHandle.subscribe(
        {
          find: ['?p', '?o'],
          where: [['ex:alice', '?p', '?o']]
        },
        () => {}
      );

      expect(aliceHandle._subscriptions.size).toBe(1);
      
      subscription.unsubscribe();
      expect(aliceHandle._subscriptions.size).toBe(0);
    });
  });

  describe('RDF-specific convenience methods integration', () => {
    beforeEach(() => {
      // Set up rich test data
      tripleStore.addTriple('ex:alice', 'rdf:type', 'foaf:Person');
      tripleStore.addTriple('ex:alice', 'foaf:name', 'Alice Smith');
      tripleStore.addTriple('ex:alice', 'foaf:age', 30);
      tripleStore.addTriple('ex:alice', 'foaf:knows', 'ex:bob');
      tripleStore.addTriple('ex:alice', 'foaf:homepage', 'https://alice.example.com');

      tripleStore.addTriple('ex:bob', 'rdf:type', 'foaf:Person');
      tripleStore.addTriple('ex:bob', 'foaf:name', 'Bob Jones');
      tripleStore.addTriple('ex:bob', 'foaf:age', 25);
    });

    it('should work with getURI() method', () => {
      const aliceHandle = new RDFHandle(dataSource, 'ex:alice');
      expect(aliceHandle.getURI()).toBe('ex:alice');
    });

    it('should work with getType() method', () => {
      const aliceHandle = new RDFHandle(dataSource, 'ex:alice');
      expect(aliceHandle.getType()).toBe('foaf:Person');
    });

    it('should work with getProperties() method', () => {
      const aliceHandle = new RDFHandle(dataSource, 'ex:alice');
      const properties = aliceHandle.getProperties();
      
      expect(Array.isArray(properties)).toBe(true);
      expect(properties).toContain('rdf:type');
      expect(properties).toContain('foaf:name');
      expect(properties).toContain('foaf:age');
      expect(properties).toContain('foaf:knows');
      expect(properties).toContain('foaf:homepage');
    });

    it('should work with followLink() method for creating new handles', () => {
      const aliceHandle = new RDFHandle(dataSource, 'ex:alice');
      
      // Follow knows link to Bob
      const bobHandle = aliceHandle.followLink('foaf:knows');
      expect(bobHandle).toBeInstanceOf(RDFHandle);
      expect(bobHandle.getURI()).toBe('ex:bob');
      
      // Get Bob's data through the new handle
      const bob = bobHandle.value();
      expect(bob['foaf:name']).toBe('Bob Jones');
      expect(bob['foaf:age']).toBe(25);
    });

    it('should work with followLink() method for HTTPS URLs', () => {
      const aliceHandle = new RDFHandle(dataSource, 'ex:alice');
      
      // Follow homepage link
      const homepageHandle = aliceHandle.followLink('foaf:homepage');
      expect(homepageHandle).toBeInstanceOf(RDFHandle);
      expect(homepageHandle.getURI()).toBe('https://alice.example.com');
    });

    it('should work with followLink() method for literal values', () => {
      const aliceHandle = new RDFHandle(dataSource, 'ex:alice');
      
      // Follow literal properties
      const name = aliceHandle.followLink('foaf:name');
      expect(name).toBe('Alice Smith');
      
      const age = aliceHandle.followLink('foaf:age');
      expect(age).toBe(30);
    });
  });

  describe('Caching behavior integration', () => {
    it('should cache values and invalidate on subscription changes', (done) => {
      tripleStore.addTriple('ex:alice', 'foaf:name', 'Alice Smith');
      tripleStore.addTriple('ex:alice', 'foaf:age', 30);

      const aliceHandle = new RDFHandle(dataSource, 'ex:alice');
      
      // Get cached value
      const value1 = aliceHandle.value();
      const value2 = aliceHandle.value();
      expect(value1).toBe(value2); // Same object reference (cached)

      // Subscribe and modify data
      const subscription = aliceHandle.subscribe(
        {
          find: ['?p', '?o'],
          where: [['ex:alice', '?p', '?o']]
        },
        () => {
          // Cache should be invalidated
          const value3 = aliceHandle.value();
          expect(value3).not.toBe(value1); // Different object reference
          expect(value3['foaf:email']).toBe('alice@example.com'); // New data
          
          subscription.unsubscribe();
          done();
        }
      );

      // Trigger change
      setTimeout(() => {
        tripleStore.addTriple('ex:alice', 'foaf:email', 'alice@example.com');
      }, 10);
    });
  });

  describe('Complete workflow integration', () => {
    it('should support complete entity lifecycle through RDFHandle', () => {
      // 1. Create entity with RDF data
      tripleStore.addTriple('ex:alice', 'rdf:type', 'foaf:Person');
      tripleStore.addTriple('ex:alice', 'foaf:name', 'Alice Smith');
      tripleStore.addTriple('ex:alice', 'foaf:age', 30);
      tripleStore.addTriple('ex:alice', 'foaf:knows', 'ex:bob');

      tripleStore.addTriple('ex:bob', 'rdf:type', 'foaf:Person');
      tripleStore.addTriple('ex:bob', 'foaf:name', 'Bob Jones');

      // 2. Create RDFHandle and verify data access
      const aliceHandle = new RDFHandle(dataSource, 'ex:alice');
      
      expect(aliceHandle.getURI()).toBe('ex:alice');
      expect(aliceHandle.getType()).toBe('foaf:Person');
      
      const alice = aliceHandle.value();
      expect(alice['foaf:name']).toBe('Alice Smith');
      expect(alice['foaf:age']).toBe(30);

      // 3. Follow relationships
      const bobHandle = aliceHandle.followLink('foaf:knows');
      expect(bobHandle).toBeInstanceOf(RDFHandle);
      expect(bobHandle.getURI()).toBe('ex:bob');
      
      const bob = bobHandle.value();
      expect(bob['foaf:name']).toBe('Bob Jones');

      // 4. Query across entities
      const peopleQuery = aliceHandle.query({
        find: ['?person', '?name'],
        where: [
          ['?person', 'rdf:type', 'foaf:Person'],
          ['?person', 'foaf:name', '?name']
        ]
      });

      expect(peopleQuery.length).toBe(2);
      const names = peopleQuery.map(r => r['name']);
      expect(names).toContain('Alice Smith');
      expect(names).toContain('Bob Jones');

      // 5. Verify properties
      const aliceProps = aliceHandle.getProperties();
      expect(aliceProps).toContain('rdf:type');
      expect(aliceProps).toContain('foaf:name');
      expect(aliceProps).toContain('foaf:age');
      expect(aliceProps).toContain('foaf:knows');
    });

    it('should handle namespace resolution in practice', () => {
      // Add data using expanded URIs
      const expandedAlice = namespaceManager.expandURI('ex:alice');
      const expandedType = namespaceManager.expandURI('rdf:type');
      const expandedPerson = namespaceManager.expandURI('foaf:Person');
      const expandedName = namespaceManager.expandURI('foaf:name');

      tripleStore.addTriple(expandedAlice, expandedType, expandedPerson);
      tripleStore.addTriple(expandedAlice, expandedName, 'Alice Smith');

      // Create handle with expanded URI (matching the data in triple store)
      const aliceHandle = new RDFHandle(dataSource, expandedAlice);
      
      // Should work with namespace management
      // Note: properties in results will be expanded URIs since that's how they're stored
      const alice = aliceHandle.value();
      expect(alice).toBeDefined();
      expect(alice[expandedName]).toBe('Alice Smith');
      expect(alice[expandedType]).toBe(expandedPerson);
    });
  });

  describe('Error handling integration', () => {
    it('should handle TripleStore errors gracefully', () => {
      // Create handle for entity
      const aliceHandle = new RDFHandle(dataSource, 'ex:alice');

      // Mock TripleStore to throw error
      const originalQuery = tripleStore.query;
      tripleStore.query = () => {
        throw new Error('TripleStore connection failed');
      };

      expect(() => {
        aliceHandle.value();
      }).toThrow('TripleStore connection failed');

      // Restore for cleanup
      tripleStore.query = originalQuery;
    });

    it('should handle RDFDataSource validation errors', () => {
      const aliceHandle = new RDFHandle(dataSource, 'ex:alice');

      // Invalid query spec should be caught by RDFDataSource
      expect(() => {
        aliceHandle.query({ invalid: 'spec' });
      }).toThrow();
    });
  });

  describe('Performance and memory management integration', () => {
    it('should clean up subscriptions on handle destruction', () => {
      tripleStore.addTriple('ex:alice', 'foaf:name', 'Alice Smith');
      
      const aliceHandle = new RDFHandle(dataSource, 'ex:alice');
      
      // Create subscription
      const subscription = aliceHandle.subscribe(
        {
          find: ['?p', '?o'],
          where: [['ex:alice', '?p', '?o']]
        },
        () => {}
      );

      expect(aliceHandle._subscriptions.size).toBe(1);
      
      // Destroy handle should clean up subscriptions
      aliceHandle.destroy();
      expect(aliceHandle._subscriptions.size).toBe(0);
      expect(aliceHandle.isDestroyed()).toBe(true);
    });

    it('should handle large datasets efficiently', () => {
      // Add many triples
      for (let i = 0; i < 100; i++) {
        tripleStore.addTriple(`ex:person${i}`, 'rdf:type', 'foaf:Person');
        tripleStore.addTriple(`ex:person${i}`, 'foaf:name', `Person ${i}`);
        tripleStore.addTriple(`ex:person${i}`, 'foaf:age', i + 20);
      }

      // Query should still work efficiently
      const personHandle = new RDFHandle(dataSource, 'ex:person0');
      
      const startTime = performance.now();
      const results = personHandle.query({
        find: ['?person'],
        where: [['?person', 'rdf:type', 'foaf:Person']]
      });
      const endTime = performance.now();

      expect(results.length).toBe(100);
      expect(endTime - startTime).toBeLessThan(100); // Should be fast (< 100ms)
    });
  });
});