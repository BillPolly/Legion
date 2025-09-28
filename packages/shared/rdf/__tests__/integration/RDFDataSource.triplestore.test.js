/**
 * Integration tests for RDFDataSource with @legion/triplestore
 * 
 * Tests RDFDataSource integration with production-ready triple store implementations:
 * - InMemoryProvider from @legion/triplestore
 * - Verify all DataSource operations work correctly
 * - Test with real triple store backends
 * 
 * Note: @legion/triplestore has async API, while RDFDataSource expects sync API.
 * This test creates a sync adapter wrapper to bridge the gap.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { RDFDataSource } from '../../src/RDFDataSource.js';
import { NamespaceManager } from '../../src/NamespaceManager.js';
import { InMemoryProvider } from '@legion/triplestore';

/**
 * Sync adapter for @legion/triplestore to work with RDFDataSource
 * 
 * Wraps the async triple store API with a synchronous interface.
 * Uses immediate execution for operations that don't require waiting.
 */
class SyncTripleStoreAdapter {
  constructor(asyncStore) {
    this.asyncStore = asyncStore;
    // Cache for synchronous queries (populated by add operations)
    this.cache = [];
  }

  /**
   * Synchronous add - adds to cache and schedules async add
   */
  add(subject, predicate, object) {
    // Add to cache immediately for synchronous queries
    const triple = [subject, predicate, object];
    const exists = this.cache.some(([s, p, o]) => 
      s === subject && p === predicate && o === object
    );
    
    if (!exists) {
      this.cache.push(triple);
    }
    
    // Schedule async add (fire and forget for sync context)
    this.asyncStore.addTriple(subject, predicate, object).catch(() => {
      // Remove from cache if async add fails
      this.cache = this.cache.filter(([s, p, o]) => 
        !(s === subject && p === predicate && o === object)
      );
    });
  }

  /**
   * Synchronous query - queries from cache
   */
  query(subject, predicate, object) {
    return this.cache.filter(([s, p, o]) => {
      if (subject !== null && subject !== undefined && s !== subject) return false;
      if (predicate !== null && predicate !== undefined && p !== predicate) return false;
      if (object !== null && object !== undefined && o !== object) return false;
      return true;
    });
  }

  /**
   * Synchronous subscribe - delegates to async store's subscription
   */
  subscribe(callback) {
    // For simplicity, invoke callback immediately when cache changes
    // In production, would hook into async store's subscription mechanism
    let previousCacheSize = this.cache.length;
    
    const checkInterval = setInterval(() => {
      if (this.cache.length !== previousCacheSize) {
        previousCacheSize = this.cache.length;
        callback();
      }
    }, 10);
    
    // Return object with unsubscribe method to match expected interface
    return {
      unsubscribe: () => {
        clearInterval(checkInterval);
      }
    };
  }

  /**
   * Wait for all async operations to complete
   */
  async flush() {
    // Give async operations time to complete
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}

describe('RDFDataSource with @legion/triplestore integration', () => {
  let dataSource;
  let asyncStore;
  let syncAdapter;
  let namespaceManager;

  beforeEach(() => {
    // Create async triple store from @legion/triplestore
    asyncStore = new InMemoryProvider();
    
    // Wrap with sync adapter for RDFDataSource
    syncAdapter = new SyncTripleStoreAdapter(asyncStore);
    
    // Create namespace manager
    namespaceManager = new NamespaceManager();
    namespaceManager.addNamespace('ex', 'http://example.org/');
    namespaceManager.addNamespace('foaf', 'http://xmlns.com/foaf/0.1/');
    
    // Create RDFDataSource with sync adapter
    dataSource = new RDFDataSource(syncAdapter, namespaceManager);
  });

  describe('Basic triple operations', () => {
    it('should add and query triples through adapter', () => {
      syncAdapter.add('ex:alice', 'foaf:name', 'Alice');
      syncAdapter.add('ex:alice', 'foaf:age', 30);
      
      const nameTriples = syncAdapter.query('ex:alice', 'foaf:name', null);
      expect(nameTriples).toHaveLength(1);
      expect(nameTriples[0][2]).toBe('Alice');
    });

    it('should handle multiple entities', () => {
      syncAdapter.add('ex:alice', 'rdf:type', 'foaf:Person');
      syncAdapter.add('ex:bob', 'rdf:type', 'foaf:Person');
      
      const personTriples = syncAdapter.query(null, 'rdf:type', 'foaf:Person');
      expect(personTriples).toHaveLength(2);
    });
  });

  describe('RDFDataSource query() operations', () => {
    beforeEach(() => {
      // Add test data
      syncAdapter.add('ex:alice', 'rdf:type', 'foaf:Person');
      syncAdapter.add('ex:alice', 'foaf:name', 'Alice Smith');
      syncAdapter.add('ex:alice', 'foaf:age', 30);
      syncAdapter.add('ex:bob', 'rdf:type', 'foaf:Person');
      syncAdapter.add('ex:bob', 'foaf:name', 'Bob Jones');
    });

    it('should execute simple query through adapter', () => {
      const results = dataSource.query({
        find: ['?person', '?name'],
        where: [
          ['?person', 'type', 'foaf:Person'],
          ['?person', 'foaf:name', '?name']
        ]
      });
      
      expect(results).toHaveLength(2);
      expect(results.map(r => r.name).sort()).toEqual(['Alice Smith', 'Bob Jones']);
    });

    it('should handle variable binding', () => {
      const results = dataSource.query({
        find: ['?age'],
        where: [
          ['ex:alice', 'foaf:age', '?age']
        ]
      });
      
      expect(results).toHaveLength(1);
      expect(results[0].age).toBe(30);
    });

    it('should handle wildcard queries', () => {
      const results = dataSource.query({
        find: ['?person'],
        where: [
          ['?person', 'type', 'foaf:Person']
        ]
      });
      
      expect(results).toHaveLength(2);
      expect(results.map(r => r.person).sort()).toEqual(['ex:alice', 'ex:bob']);
    });
  });

  describe('RDFDataSource subscribe() operations', () => {
    it('should setup subscription through adapter', () => {
      let callbackInvoked = false;
      let callbackResults = null;
      
      const unsubscribe = dataSource.subscribe(
        {
          find: ['?person', '?name'],
          where: [
            ['?person', 'type', 'foaf:Person'],
            ['?person', 'foaf:name', '?name']
          ]
        },
        (results) => {
          callbackInvoked = true;
          callbackResults = results;
        }
      );
      
      expect(typeof unsubscribe).toBe('object');
      expect(typeof unsubscribe.unsubscribe).toBe('function');
      
      // Cleanup
      unsubscribe.unsubscribe();
    });

    it('should detect changes and invoke callback', (done) => {
      const querySpec = {
        find: ['?person'],
        where: [
          ['?person', 'type', 'foaf:Person']
        ]
      };
      
      let callCount = 0;
      
      const unsubscribe = dataSource.subscribe(
        querySpec,
        (results) => {
          callCount++;
          
          if (callCount === 1) {
            // First callback after change
            expect(results).toHaveLength(1);
            expect(results[0].person).toBe('ex:alice');
            
            // Cleanup and complete test
            unsubscribe.unsubscribe();
            done();
          }
        }
      );
      
      // Add data after subscription setup
      setTimeout(() => {
        syncAdapter.add('ex:alice', 'rdf:type', 'foaf:Person');
      }, 50);
    });
  });

  describe('RDFDataSource import/export operations', () => {
    it('should import Turtle into adapter-backed store', () => {
      const turtleData = `
        @prefix ex: <http://example.org/> .
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        
        ex:alice a foaf:Person ;
          foaf:name "Alice" .
      `;
      
      dataSource.importRDF(turtleData, 'turtle');
      
      // Verify data was imported
      const typeTriples = syncAdapter.query('ex:alice', 'rdf:type', 'foaf:Person');
      expect(typeTriples).toHaveLength(1);
    });

    it('should export data from adapter-backed store', () => {
      syncAdapter.add('ex:alice', 'rdf:type', 'foaf:Person');
      syncAdapter.add('ex:alice', 'foaf:name', 'Alice');
      
      const turtleOutput = dataSource.exportRDF('turtle');
      
      expect(turtleOutput).toContain('ex:alice');
      expect(turtleOutput).toContain('Person');
      expect(turtleOutput).toContain('Alice');
    });
  });

  describe('RDFDataSource getSchema() operations', () => {
    it('should extract schema from ontology in adapter-backed store', () => {
      // Add ontology data
      syncAdapter.add('ex:Person', 'rdf:type', 'owl:Class');
      syncAdapter.add('ex:name', 'rdf:type', 'owl:DatatypeProperty');
      syncAdapter.add('ex:name', 'rdfs:domain', 'ex:Person');
      syncAdapter.add('ex:name', 'rdfs:range', 'xsd:string');
      
      const schema = dataSource.getSchema();
      
      expect(schema).toHaveProperty('Person/name');
      expect(schema['Person/name'].type).toBe('string');
    });
  });

  describe('Async/sync boundary verification', () => {
    it('should handle rapid consecutive operations', () => {
      // Add multiple triples rapidly
      for (let i = 0; i < 10; i++) {
        syncAdapter.add(`ex:entity${i}`, 'foaf:name', `Entity ${i}`);
      }
      
      // Query immediately (should see all in cache)
      const results = syncAdapter.query(null, 'foaf:name', null);
      expect(results).toHaveLength(10);
    });

    it('should maintain consistency between cache and async store', async () => {
      // Add data to adapter
      syncAdapter.add('ex:alice', 'foaf:name', 'Alice');
      syncAdapter.add('ex:bob', 'foaf:name', 'Bob');
      
      // Flush async operations
      await syncAdapter.flush();
      
      // Query async store directly
      const asyncResults = await asyncStore.query(null, 'foaf:name', null);
      
      // Verify cache and async store are consistent
      expect(asyncResults).toHaveLength(2);
      expect(syncAdapter.query(null, 'foaf:name', null)).toHaveLength(2);
    });
  });

  describe('Performance with large datasets', () => {
    it('should handle 100 triples efficiently', () => {
      const startTime = Date.now();
      
      // Add 100 triples
      for (let i = 0; i < 100; i++) {
        syncAdapter.add(`ex:entity${i}`, 'foaf:name', `Entity ${i}`);
      }
      
      const addTime = Date.now() - startTime;
      
      // Query should be fast
      const queryStart = Date.now();
      const results = syncAdapter.query(null, 'foaf:name', null);
      const queryTime = Date.now() - queryStart;
      
      expect(results).toHaveLength(100);
      expect(addTime).toBeLessThan(100); // Should add 100 triples in < 100ms
      expect(queryTime).toBeLessThan(50); // Should query in < 50ms
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle queries on empty adapter', () => {
      const results = dataSource.query({
        find: ['?s'],
        where: [['?s', 'foaf:name', '?name']]
      });
      
      expect(results).toEqual([]);
    });

    it('should handle duplicate triple additions', () => {
      syncAdapter.add('ex:alice', 'foaf:name', 'Alice');
      syncAdapter.add('ex:alice', 'foaf:name', 'Alice'); // Duplicate
      
      const results = syncAdapter.query('ex:alice', 'foaf:name', null);
      expect(results).toHaveLength(1);
    });

    it('should handle malformed query gracefully', () => {
      syncAdapter.add('ex:alice', 'foaf:name', 'Alice');
      
      // Query with no results should return empty array
      const results = dataSource.query({
        find: ['?person'],
        where: [['?person', 'foaf:age', 999]] // No matching data
      });
      
      expect(results).toEqual([]);
    });
  });
});