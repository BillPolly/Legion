/**
 * Integration tests for trie-store coordination
 * Tests complete coordination between Store and TrieManager per design §2
 */

import { Store } from '../../src/Store.js';
import { TrieManager } from '../../src/trie/TrieManager.js';
import { Edge } from '../../src/Edge.js';

describe('Trie-Store Coordination Integration', () => {
  let store;
  let trieManager;

  beforeEach(() => {
    store = new Store();
    trieManager = new TrieManager();
  });

  describe('relationship type coordination', () => {
    it('should coordinate relationship type registration', () => {
      // Register in store
      const storeType = store.defineRelationType('worksAt', 'workedBy');
      
      // Register in trie manager
      const { outTrie, inTrie } = trieManager.registerRelationType('worksAt', 'workedBy');
      
      expect(store.hasRelationType('worksAt')).toBe(true);
      expect(trieManager.hasRelationType('worksAt')).toBe(true);
      
      expect(outTrie.relationName).toBe('worksAt');
      expect(inTrie.relationName).toBe('workedBy');
      
      expect(storeType.forwardName).toBe('worksAt');
      expect(storeType.backwardName).toBe('workedBy');
    });

    it('should maintain consistent attribute naming', () => {
      store.defineRelationType('worksAt', 'workedBy');
      trieManager.registerRelationType('worksAt', 'workedBy');
      
      const storeForward = store.getAttributeByName('worksAt');
      const storeBackward = store.getAttributeByName('workedBy');
      
      const outTrie = trieManager.getOutTrie('worksAt');
      const inTrie = trieManager.getInTrie('worksAt');
      
      expect(storeForward.kernelRelationName).toBe(outTrie.relationName);
      expect(storeBackward.kernelRelationName).toBe('worksAt_inv'); // Kernel naming convention
      expect(inTrie.relationName).toBe('workedBy'); // Custom backward name
    });
  });

  describe('edge synchronization', () => {
    beforeEach(() => {
      store.defineRelationType('worksAt', 'workedBy');
      store.defineRelationType('livesIn', 'livedIn');
      
      trieManager.registerRelationType('worksAt', 'workedBy');
      trieManager.registerRelationType('livesIn', 'livedIn');
    });

    it('should maintain edge consistency between store and tries', () => {
      const edges = [
        new Edge('worksAt', 'alice', 'acme'),
        new Edge('worksAt', 'bob', 'acme'),
        new Edge('livesIn', 'alice', 'sf'),
        new Edge('livesIn', 'bob', 'nyc')
      ];

      // Add to store
      edges.forEach(edge => store.addEdge(edge));
      
      // Add to trie manager
      edges.forEach(edge => trieManager.insertEdge(edge.type, edge));

      // Verify consistency
      expect(store.getEdgeCount()).toBe(4);
      expect(trieManager.getEdgeCount('worksAt')).toBe(2);
      expect(trieManager.getEdgeCount('livesIn')).toBe(2);

      edges.forEach(edge => {
        expect(store.hasEdge(edge)).toBe(true);
        expect(trieManager.containsEdge(edge.type, edge)).toBe(true);
      });
    });

    it('should handle edge removal consistently', () => {
      const edge = new Edge('worksAt', 'alice', 'acme');
      
      // Add to both
      store.addEdge(edge);
      trieManager.insertEdge('worksAt', edge);
      
      expect(store.hasEdge(edge)).toBe(true);
      expect(trieManager.containsEdge('worksAt', edge)).toBe(true);
      
      // Remove from store
      store.removeEdge(edge);
      expect(store.hasEdge(edge)).toBe(false);
      expect(store.getEdgeCount()).toBe(0);
      
      // Remove from trie manager
      trieManager.removeEdge('worksAt', edge);
      expect(trieManager.containsEdge('worksAt', edge)).toBe(false);
      expect(trieManager.getEdgeCount('worksAt')).toBe(0);
    });

    it('should handle bulk operations consistently', () => {
      const edges = [];
      for (let i = 0; i < 100; i++) {
        edges.push(new Edge('worksAt', `src${i % 10}`, `dst${i}`));
      }

      // Bulk add to store
      store.addEdges(edges);
      
      // Bulk add to trie manager
      edges.forEach(edge => trieManager.insertEdge('worksAt', edge));

      expect(store.getEdgeCount()).toBe(100);
      expect(trieManager.getEdgeCount('worksAt')).toBe(100);

      // Verify random samples
      for (let i = 0; i < 10; i++) {
        const edge = edges[Math.floor(Math.random() * edges.length)];
        expect(store.hasEdge(edge)).toBe(true);
        expect(trieManager.containsEdge('worksAt', edge)).toBe(true);
      }
    });
  });

  describe('query result coordination', () => {
    beforeEach(() => {
      store.defineRelationType('worksAt', 'workedBy');
      trieManager.registerRelationType('worksAt', 'workedBy');
      
      const edges = [
        new Edge('worksAt', 'alice', 'acme'),
        new Edge('worksAt', 'alice', 'beta'),
        new Edge('worksAt', 'bob', 'acme'),
        new Edge('worksAt', 'carol', 'gamma')
      ];

      edges.forEach(edge => {
        store.addEdge(edge);
        trieManager.insertEdge('worksAt', edge);
      });
    });

    it('should provide consistent forward traversal results', () => {
      // Store queries
      const storeAliceEdges = store.getEdgesByTypeAndSource('worksAt', 'alice');
      const storeBobEdges = store.getEdgesByTypeAndSource('worksAt', 'bob');
      
      // Trie manager queries
      const trieAliceEdges = trieManager.getEdgesForSource('worksAt', 'alice');
      const trieBobEdges = trieManager.getEdgesForSource('worksAt', 'bob');
      
      expect(storeAliceEdges).toHaveLength(2);
      expect(trieAliceEdges).toHaveLength(2);
      expect(storeBobEdges).toHaveLength(1);
      expect(trieBobEdges).toHaveLength(1);
      
      // Results should be equivalent (same edges)
      expect(storeAliceEdges.every(e => trieAliceEdges.some(te => te.equals(e)))).toBe(true);
      expect(storeBobEdges.every(e => trieBobEdges.some(te => te.equals(e)))).toBe(true);
    });

    it('should provide consistent backward traversal results', () => {
      // Store queries (manual filtering)
      const storeAcmeEdges = store.getEdgesByTypeAndDestination('worksAt', 'acme');
      const storeBetaEdges = store.getEdgesByTypeAndDestination('worksAt', 'beta');
      
      // Trie manager queries
      const trieAcmeEdges = trieManager.getEdgesForDestination('worksAt', 'acme');
      const trieBetaEdges = trieManager.getEdgesForDestination('worksAt', 'beta');
      
      expect(storeAcmeEdges).toHaveLength(2);
      expect(trieAcmeEdges).toHaveLength(2);
      expect(storeBetaEdges).toHaveLength(1);
      expect(trieBetaEdges).toHaveLength(1);
      
      // Results should be equivalent
      expect(storeAcmeEdges.every(e => trieAcmeEdges.some(te => te.equals(e)))).toBe(true);
      expect(storeBetaEdges.every(e => trieBetaEdges.some(te => te.equals(e)))).toBe(true);
    });

    it('should provide consistent source/destination enumeration', () => {
      // Store enumeration
      const storeAllEdges = store.getEdgesByType('worksAt');
      const storeSources = new Set(storeAllEdges.map(e => e.src));
      const storeDestinations = new Set(storeAllEdges.map(e => e.dst));
      
      // Trie manager enumeration
      const trieSources = new Set(trieManager.getAllSources('worksAt'));
      const trieDestinations = new Set(trieManager.getAllDestinations('worksAt'));
      
      expect(Array.from(storeSources).sort()).toEqual(Array.from(trieSources).sort());
      expect(Array.from(storeDestinations).sort()).toEqual(Array.from(trieDestinations).sort());
    });
  });

  describe('performance coordination', () => {
    beforeEach(() => {
      store.defineRelationType('perfTest', 'perfTestInv');
      trieManager.registerRelationType('perfTest', 'perfTestInv');
    });

    it('should handle large datasets efficiently in both structures', () => {
      const edgeCount = 1000;
      const edges = [];
      
      // Generate test data
      for (let i = 0; i < edgeCount; i++) {
        edges.push(new Edge('perfTest', `src${i % 50}`, `dst${i}`));
      }

      // Measure store performance
      const storeStart = Date.now();
      edges.forEach(edge => store.addEdge(edge));
      const storeEnd = Date.now();
      const storeTime = storeEnd - storeStart;

      // Measure trie manager performance  
      const trieStart = Date.now();
      edges.forEach(edge => trieManager.insertEdge('perfTest', edge));
      const trieEnd = Date.now();
      const trieTime = trieEnd - trieStart;

      // Both should be reasonably fast
      expect(storeTime).toBeLessThan(500);
      expect(trieTime).toBeLessThan(500);
      
      // Verify consistency
      expect(store.getEdgeCount()).toBe(edgeCount);
      expect(trieManager.getEdgeCount('perfTest')).toBe(edgeCount);
    });

    it('should provide fast queries in both structures', () => {
      // Setup data
      const edges = [];
      for (let i = 0; i < 200; i++) {
        edges.push(new Edge('perfTest', `src${i % 20}`, `dst${i}`));
      }
      
      edges.forEach(edge => {
        store.addEdge(edge);
        trieManager.insertEdge('perfTest', edge);
      });

      // Test query performance
      const queryStart = Date.now();
      
      // Store queries
      for (let i = 0; i < 20; i++) {
        store.getEdgesByTypeAndSource('perfTest', `src${i}`);
        store.getEdgesByTypeAndDestination('perfTest', `dst${i}`);
      }
      
      // Trie queries
      for (let i = 0; i < 20; i++) {
        trieManager.getEdgesForSource('perfTest', `src${i}`);
        trieManager.getEdgesForDestination('perfTest', `dst${i}`);
      }
      
      const queryEnd = Date.now();
      const queryTime = queryEnd - queryStart;
      
      expect(queryTime).toBeLessThan(100); // Should be very fast
    });
  });

  describe('error handling coordination', () => {
    it('should handle inconsistent states gracefully', () => {
      store.defineRelationType('test', 'testInv');
      trieManager.registerRelationType('test', 'testInv');
      
      const edge = new Edge('test', 'alice', 'acme');
      
      // Add to store only
      store.addEdge(edge);
      
      // Verify store has it, trie doesn't
      expect(store.hasEdge(edge)).toBe(true);
      expect(trieManager.containsEdge('test', edge)).toBe(false);
      
      // This represents an inconsistent state that the integration should detect
      expect(store.getEdgeCount()).toBe(1);
      expect(trieManager.getEdgeCount('test')).toBe(0);
    });

    it('should handle edge type mismatches', () => {
      store.defineRelationType('typeA', 'typeAInv');
      store.defineRelationType('typeB', 'typeBInv');
      trieManager.registerRelationType('typeA', 'typeAInv');
      trieManager.registerRelationType('typeB', 'typeBInv');
      
      const edge = new Edge('typeA', 'alice', 'acme');
      
      // Add correctly
      store.addEdge(edge);
      trieManager.insertEdge('typeA', edge);
      
      // Try to query with wrong type
      expect(trieManager.getEdgesForSource('typeB', 'alice')).toEqual([]);
      expect(store.getEdgesByType('typeB')).toEqual([]);
    });
  });

  describe('memory coordination', () => {
    beforeEach(() => {
      store.defineRelationType('memTest', 'memTestInv');
      trieManager.registerRelationType('memTest', 'memTestInv');
    });

    it('should handle clearing operations consistently', () => {
      const edges = [
        new Edge('memTest', 'alice', 'acme'),
        new Edge('memTest', 'bob', 'beta')
      ];

      edges.forEach(edge => {
        store.addEdge(edge);
        trieManager.insertEdge('memTest', edge);
      });

      expect(store.getEdgeCount()).toBe(2);
      expect(trieManager.getEdgeCount('memTest')).toBe(2);

      // Clear store
      store.clearEdgesByType('memTest');
      expect(store.getEdgeCount()).toBe(0);
      
      // Clear trie manager
      trieManager.clearRelationType('memTest');
      expect(trieManager.getEdgeCount('memTest')).toBe(0);
      expect(trieManager.isEmpty('memTest')).toBe(true);
    });

    it('should handle complete reset consistently', () => {
      // Create fresh instances for this test to avoid interference
      const freshStore = new Store();
      const freshTrieManager = new TrieManager();
      
      freshStore.defineRelationType('temp1', 'temp1Inv');
      freshStore.defineRelationType('temp2', 'temp2Inv');
      freshTrieManager.registerRelationType('temp1', 'temp1Inv');
      freshTrieManager.registerRelationType('temp2', 'temp2Inv');

      const edge1 = new Edge('temp1', 'alice', 'acme');
      const edge2 = new Edge('temp2', 'bob', 'beta');

      freshStore.addEdge(edge1);
      freshStore.addEdge(edge2);
      freshTrieManager.insertEdge('temp1', edge1);
      freshTrieManager.insertEdge('temp2', edge2);

      expect(freshStore.getTypeCount()).toBe(2);
      expect(freshTrieManager.getRelationCount()).toBe(2);

      // Reset store
      freshStore.reset();
      expect(freshStore.getTypeCount()).toBe(0);
      expect(freshStore.getEdgeCount()).toBe(0);

      // Reset trie manager
      freshTrieManager.clear();
      expect(freshTrieManager.getRelationCount()).toBe(0);
      expect(freshTrieManager.getStatistics().totalEdgeCount).toBe(0);
    });
  });

  describe('statistics coordination', () => {
    beforeEach(() => {
      store.defineRelationType('statsTest', 'statsTestInv');
      trieManager.registerRelationType('statsTest', 'statsTestInv');
      
      const edges = [
        new Edge('statsTest', 'alice', 'acme'),
        new Edge('statsTest', 'alice', 'beta'),
        new Edge('statsTest', 'bob', 'acme'),
        new Edge('statsTest', 'carol', 'gamma')
      ];

      edges.forEach(edge => {
        store.addEdge(edge);
        trieManager.insertEdge('statsTest', edge);
      });
    });

    it('should provide consistent statistical information', () => {
      const storeStats = store.getStatistics();
      const trieStats = trieManager.getStatistics();

      expect(storeStats.edgeCount).toBe(trieStats.totalEdgeCount);
      expect(storeStats.typeCount).toBe(trieStats.relationCount);
      
      // Individual relation stats
      const storeTypeStats = store.getStatisticsByType();
      expect(storeTypeStats.statsTest.edgeCount).toBe(4);
      expect(trieStats.relationStats.statsTest.edgeCount).toBe(4);
    });

    it('should maintain consistent counts across operations', () => {
      expect(store.getEdgeCount()).toBe(4);
      expect(trieManager.getEdgeCount('statsTest')).toBe(4);

      // Remove one edge from both
      const edge = new Edge('statsTest', 'alice', 'acme');
      store.removeEdge(edge);
      trieManager.removeEdge('statsTest', edge);

      expect(store.getEdgeCount()).toBe(3);
      expect(trieManager.getEdgeCount('statsTest')).toBe(3);

      // Add a new edge to both
      const newEdge = new Edge('statsTest', 'dave', 'delta');
      store.addEdge(newEdge);
      trieManager.insertEdge('statsTest', newEdge);

      expect(store.getEdgeCount()).toBe(4);
      expect(trieManager.getEdgeCount('statsTest')).toBe(4);
    });
  });
});