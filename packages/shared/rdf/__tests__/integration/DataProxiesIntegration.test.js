/**
 * Integration tests for @legion/rdf with @legion/data-proxies
 * 
 * Tests RDF data access through DataStoreProxy pattern:
 * - EntityProxy over RDF data
 * - Property get/set operations
 * - Relationship navigation
 * - Subscription handling
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { RDFDataSource } from '../../src/RDFDataSource.js';
import { RDFHandle } from '../../src/RDFHandle.js';
import { NamespaceManager } from '../../src/NamespaceManager.js';
import { SimpleTripleStore } from '../../src/SimpleTripleStore.js';

// Import data-proxies components
// Note: DataStoreResourceManager is not available, so we'll test the concept
// of integrating RDF with proxy-style access patterns

describe('RDF + Data Proxies Integration', () => {
  let tripleStore;
  let namespaceManager;
  let rdfDataSource;
  
  beforeEach(() => {
    // Create RDF infrastructure
    tripleStore = new SimpleTripleStore();
    namespaceManager = new NamespaceManager();
    
    // Add standard namespaces
    namespaceManager.addNamespace('rdf', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#');
    namespaceManager.addNamespace('foaf', 'http://xmlns.com/foaf/0.1/');
    namespaceManager.addNamespace('ex', 'http://example.org/');
    
    rdfDataSource = new RDFDataSource(tripleStore, namespaceManager);
    
    // Add test RDF data
    tripleStore.add('ex:alice', 'rdf:type', 'foaf:Person');
    tripleStore.add('ex:alice', 'foaf:name', 'Alice Smith');
    tripleStore.add('ex:alice', 'foaf:age', 30);
    tripleStore.add('ex:alice', 'foaf:email', 'alice@example.com');
    tripleStore.add('ex:alice', 'foaf:knows', 'ex:bob');
    
    tripleStore.add('ex:bob', 'rdf:type', 'foaf:Person');
    tripleStore.add('ex:bob', 'foaf:name', 'Bob Johnson');
    tripleStore.add('ex:bob', 'foaf:age', 25);
    tripleStore.add('ex:bob', 'foaf:email', 'bob@example.com');
  });
  
  describe('DataStoreProxy with RDF DataSource', () => {
    test('should create DataStoreProxy over RDF data source', () => {
      // This test verifies that we can potentially create a DataStoreProxy-style
      // interface over RDF data. Since DataStoreProxy expects a DataStore,
      // we'll test the concept using our RDFDataSource directly.
      
      expect(rdfDataSource).toBeDefined();
      expect(rdfDataSource.query).toBeDefined();
      expect(rdfDataSource.subscribe).toBeDefined();
      expect(rdfDataSource.getSchema).toBeDefined();
      
      // Verify RDF data is accessible
      const results = rdfDataSource.query({
        find: ['?person', '?name'],
        where: [
          ['?person', 'rdf:type', 'foaf:Person'],
          ['?person', 'foaf:name', '?name']
        ]
      });
      
      expect(results).toHaveLength(2);
      expect(results).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ person: 'ex:alice', name: 'Alice Smith' }),
          expect.objectContaining({ person: 'ex:bob', name: 'Bob Johnson' })
        ])
      );
    });
  });
  
  describe('EntityProxy-style access over RDF data', () => {
    test('should provide entity-like access to RDF resources', () => {
      // Create RDFHandle for Alice entity
      const aliceHandle = new RDFHandle(rdfDataSource, 'ex:alice');
      
      // Test property access similar to EntityProxy
      const alice = aliceHandle.value();
      
      expect(alice).toBeDefined();
      expect(alice['foaf:name']).toBe('Alice Smith');
      expect(alice['foaf:age']).toBe(30);
      expect(alice['foaf:email']).toBe('alice@example.com');
      expect(alice['foaf:knows']).toBe('ex:bob');
    });
    
    test('should support relationship navigation', () => {
      // Create RDFHandle for Alice
      const aliceHandle = new RDFHandle(rdfDataSource, 'ex:alice');
      const alice = aliceHandle.value();
      
      // Navigate to known person (Bob)
      const bobUri = alice['foaf:knows'];
      expect(bobUri).toBe('ex:bob');
      
      // Create RDFHandle for Bob
      const bobHandle = new RDFHandle(rdfDataSource, bobUri);
      const bob = bobHandle.value();
      
      expect(bob).toBeDefined();
      expect(bob['foaf:name']).toBe('Bob Johnson');
      expect(bob['foaf:age']).toBe(25);
    });
    
    test('should support RDF-specific convenience methods', () => {
      const aliceHandle = new RDFHandle(rdfDataSource, 'ex:alice');
      
      // Test RDF-specific methods
      expect(aliceHandle.getURI()).toBe('ex:alice');
      expect(aliceHandle.getType()).toBe('foaf:Person');
      
      const properties = aliceHandle.getProperties();
      expect(properties).toEqual(
        expect.arrayContaining([
          'rdf:type',
          'foaf:name', 
          'foaf:age',
          'foaf:email',
          'foaf:knows'
        ])
      );
      
      // Test following links
      const bobHandle = aliceHandle.followLink('foaf:knows');
      expect(bobHandle).toBeInstanceOf(RDFHandle);
      expect(bobHandle.getURI()).toBe('ex:bob');
    });
  });
  
  describe('Property modification and updates', () => {
    test('should support property updates through triple store', () => {
      const aliceHandle = new RDFHandle(rdfDataSource, 'ex:alice');
      
      // Verify initial state
      let alice = aliceHandle.value();
      expect(alice['foaf:age']).toBe(30);
      
      // Update through triple store (simulating property setter)
      tripleStore.remove('ex:alice', 'foaf:age', 30);
      tripleStore.add('ex:alice', 'foaf:age', 31);
      
      // Clear cache to ensure fresh data
      aliceHandle._valueCache = null;
      
      // Verify update reflected in handle
      alice = aliceHandle.value();
      expect(alice['foaf:age']).toBe(31);
    });
    
    test('should support adding new properties', () => {
      const aliceHandle = new RDFHandle(rdfDataSource, 'ex:alice');
      
      // Add new property
      tripleStore.add('ex:alice', 'foaf:phone', '+1-555-0123');
      
      // Verify new property accessible
      const alice = aliceHandle.value();
      expect(alice['foaf:phone']).toBe('+1-555-0123');
      
      // Verify in properties list
      const properties = aliceHandle.getProperties();
      expect(properties).toContain('foaf:phone');
    });
  });
  
  describe('Subscription integration', () => {
    test('should support subscriptions similar to EntityProxy', () => {
      const aliceHandle = new RDFHandle(rdfDataSource, 'ex:alice');
      
      const changes = [];
      const subscription = aliceHandle.subscribe(
        {
          find: ['?p', '?o'],
          where: [['ex:alice', '?p', '?o']]
        },
        (results) => {
          changes.push(results);
        }
      );
      
      expect(subscription).toBeDefined();
      expect(subscription.unsubscribe).toBeDefined();
      
      // Modify data
      tripleStore.add('ex:alice', 'foaf:nickname', 'Ali');
      
      // Verify subscription fired
      expect(changes.length).toBeGreaterThan(0);
      
      // Clean up
      subscription.unsubscribe();
    });
    
    test('should support query-based subscriptions', () => {
      const callbacks = [];
      
      const subscription = rdfDataSource.subscribe(
        {
          find: ['?person'],
          where: [['?person', 'rdf:type', 'foaf:Person']]
        },
        (results) => {
          callbacks.push(results);
        }
      );
      
      expect(subscription).toBeDefined();
      expect(subscription.unsubscribe).toBeDefined();
      
      // Add new person
      tripleStore.add('ex:charlie', 'rdf:type', 'foaf:Person');
      tripleStore.add('ex:charlie', 'foaf:name', 'Charlie Brown');
      
      // Verify subscription fired
      expect(callbacks.length).toBeGreaterThan(0);
      
      // Clean up
      subscription.unsubscribe();
    });
  });
  
  describe('Cross-proxy consistency', () => {
    test('should maintain consistency across multiple handles', () => {
      // Create two handles to same entity
      const aliceHandle1 = new RDFHandle(rdfDataSource, 'ex:alice');
      const aliceHandle2 = new RDFHandle(rdfDataSource, 'ex:alice');
      
      // Verify both see same initial data
      const alice1 = aliceHandle1.value();
      const alice2 = aliceHandle2.value();
      
      expect(alice1['foaf:name']).toBe(alice2['foaf:name']);
      expect(alice1['foaf:age']).toBe(alice2['foaf:age']);
      
      // Update through triple store
      tripleStore.remove('ex:alice', 'foaf:age', 30);
      tripleStore.add('ex:alice', 'foaf:age', 31);
      
      // Clear caches to ensure fresh data
      aliceHandle1._valueCache = null;
      aliceHandle2._valueCache = null;
      
      // Verify both handles see update
      const updatedAlice1 = aliceHandle1.value();
      const updatedAlice2 = aliceHandle2.value();
      
      expect(updatedAlice1['foaf:age']).toBe(31);
      expect(updatedAlice2['foaf:age']).toBe(31);
    });
  });
  
  describe('Schema integration', () => {
    test('should provide schema information for proxy introspection', () => {
      // Test schema extraction capability
      const schema = rdfDataSource.getSchema();
      
      expect(schema).toBeDefined();
      expect(typeof schema).toBe('object');
      
      // Note: Schema content depends on ontology data in triple store
      // For this test, we just verify the method works
    });
  });
});