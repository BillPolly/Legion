/**
 * Integration Tests for Core Data Structures
 * Per implementation plan Phase 1 Step 1.5
 * Tests StoreRoot ↔ TrieManager ↔ OutTrie/InTrie integration
 * 
 * NO MOCKS POLICY: Uses real components only
 * TDD approach - testing component interactions
 */

import { ImmutableStoreRoot } from '../../../src/immutable/ImmutableStoreRoot.js';
import { ImmutableTrieManager } from '../../../src/immutable/ImmutableTrieManager.js';
import { ImmutableOutTrie } from '../../../src/immutable/ImmutableOutTrie.js';
import { ImmutableInTrie } from '../../../src/immutable/ImmutableInTrie.js';
import { Edge } from '../../../src/Edge.js';
import { RelationshipType } from '../../../src/RelationshipType.js';

describe('Core Data Structures Integration', () => {
  let storeRoot;
  let sampleRelationType;
  let sampleEdges;

  beforeEach(() => {
    storeRoot = new ImmutableStoreRoot();
    sampleRelationType = new RelationshipType('worksAt', 'person', 'company');
    
    sampleEdges = [
      new Edge('worksAt', 'alice', 'techcorp'),
      new Edge('worksAt', 'bob', 'techcorp'),
      new Edge('worksAt', 'alice', 'startup'),
      new Edge('worksAt', 'charlie', 'bigco')
    ];
  });

  describe('StoreRoot ↔ TrieManager Integration', () => {
    test('should create StoreRoot with TrieManager coordination', () => {
      // StoreRoot should contain TrieManager instance
      expect(storeRoot.getTrieManager()).toBeInstanceOf(ImmutableTrieManager);
      expect(storeRoot.getTrieManager().getRelationCount()).toBe(0);
      expect(storeRoot.getEdgeCount()).toBe(0);
    });

    test('should add relation type through StoreRoot to TrieManager', () => {
      const newStoreRoot = storeRoot.withAddedRelationType(sampleRelationType);
      
      // Verify immutability
      expect(newStoreRoot).not.toBe(storeRoot);
      expect(newStoreRoot).toBeInstanceOf(ImmutableStoreRoot);
      expect(Object.isFrozen(newStoreRoot)).toBe(true);
      
      // Original unchanged
      expect(storeRoot.getRelationshipTypes().size).toBe(0);
      expect(storeRoot.getTrieManager().getRelationCount()).toBe(0);
      
      // New StoreRoot has relation type
      expect(newStoreRoot.getRelationshipTypes().size).toBe(1);
      expect(newStoreRoot.hasRelationType('worksAt')).toBe(true);
      
      // TrieManager should be updated too
      expect(newStoreRoot.getTrieManager().getRelationCount()).toBe(1);
      expect(newStoreRoot.getTrieManager().hasRelationType('worksAt')).toBe(true);
    });

    test('should add edge through StoreRoot affecting TrieManager and tries', () => {
      // First add relation type
      const storeWithType = storeRoot.withAddedRelationType(sampleRelationType);
      
      // Then add edge
      const storeWithEdge = storeWithType.withAddedEdge(sampleEdges[0]);
      
      // Verify immutability chain
      expect(storeWithEdge).not.toBe(storeWithType);
      expect(storeWithEdge).not.toBe(storeRoot);
      expect(Object.isFrozen(storeWithEdge)).toBe(true);
      
      // Original stores unchanged
      expect(storeRoot.getEdgeCount()).toBe(0);
      expect(storeWithType.getEdgeCount()).toBe(0);
      
      // New store has edge
      expect(storeWithEdge.getEdgeCount()).toBe(1);
      expect(storeWithEdge.hasEdge(sampleEdges[0])).toBe(true);
      
      // TrieManager should reflect changes
      expect(storeWithEdge.getTrieManager().getEdgeCount('worksAt')).toBe(1);
      expect(storeWithEdge.getTrieManager().containsEdge('worksAt', sampleEdges[0])).toBe(true);
    });

    test('should remove edge through StoreRoot affecting TrieManager', () => {
      // Setup: add relation type and edge
      let store = storeRoot.withAddedRelationType(sampleRelationType);
      store = store.withAddedEdge(sampleEdges[0]);
      
      // Remove edge
      const storeAfterRemoval = store.withRemovedEdge(sampleEdges[0]);
      
      // Verify immutability
      expect(storeAfterRemoval).not.toBe(store);
      expect(Object.isFrozen(storeAfterRemoval)).toBe(true);
      
      // Original store unchanged
      expect(store.getEdgeCount()).toBe(1);
      expect(store.hasEdge(sampleEdges[0])).toBe(true);
      
      // New store has edge removed
      expect(storeAfterRemoval.getEdgeCount()).toBe(0);
      expect(storeAfterRemoval.hasEdge(sampleEdges[0])).toBe(false);
      
      // TrieManager should reflect removal
      expect(storeAfterRemoval.getTrieManager().getEdgeCount('worksAt')).toBe(0);
      expect(storeAfterRemoval.getTrieManager().containsEdge('worksAt', sampleEdges[0])).toBe(false);
    });
  });

  describe('TrieManager ↔ OutTrie/InTrie Coordination', () => {
    let trieManager;

    beforeEach(() => {
      trieManager = new ImmutableTrieManager();
      trieManager = trieManager.withAddedRelationType(sampleRelationType);
    });

    test('should coordinate OutTrie and InTrie creation', () => {
      const trieWithEdge = trieManager.withAddedEdge(sampleEdges[0]);
      
      // Should have both OutTrie and InTrie for the relation
      expect(trieWithEdge.hasRelationType('worksAt')).toBe(true);
      
      // Get the tries (through internal access for testing)
      const outTrie = trieWithEdge.getOutTrie('worksAt');
      const inTrie = trieWithEdge.getInTrie('worksAt');
      
      expect(outTrie).toBeInstanceOf(ImmutableOutTrie);
      expect(inTrie).toBeInstanceOf(ImmutableInTrie);
      
      // Both should contain the edge
      expect(outTrie.contains(sampleEdges[0])).toBe(true);
      expect(inTrie.contains(sampleEdges[0])).toBe(true);
      
      // Sizes should match
      expect(outTrie.size).toBe(1);
      expect(inTrie.size).toBe(1);
    });

    test('should maintain OutTrie and InTrie consistency on multiple operations', () => {
      let currentTrie = trieManager;
      
      // Add multiple edges
      for (const edge of sampleEdges) {
        currentTrie = currentTrie.withAddedEdge(edge);
      }
      
      const outTrie = currentTrie.getOutTrie('worksAt');
      const inTrie = currentTrie.getInTrie('worksAt');
      
      // Both tries should have all edges
      expect(outTrie.size).toBe(sampleEdges.length);
      expect(inTrie.size).toBe(sampleEdges.length);
      
      for (const edge of sampleEdges) {
        expect(outTrie.contains(edge)).toBe(true);
        expect(inTrie.contains(edge)).toBe(true);
      }
      
      // Forward traversal check (src -> dst)
      expect(outTrie.getDestinationsForSource('alice')).toEqual(
        expect.arrayContaining(['techcorp', 'startup'])
      );
      
      // Backward traversal check (dst -> src)
      expect(inTrie.getSourcesForDestination('techcorp')).toEqual(
        expect.arrayContaining(['alice', 'bob'])
      );
    });

    test('should handle edge removal across both tries', () => {
      // Add all edges
      let currentTrie = trieManager;
      for (const edge of sampleEdges) {
        currentTrie = currentTrie.withAddedEdge(edge);
      }
      
      // Remove one edge
      const trieAfterRemoval = currentTrie.withRemovedEdge(sampleEdges[0]);
      
      const outTrie = trieAfterRemoval.getOutTrie('worksAt');
      const inTrie = trieAfterRemoval.getInTrie('worksAt');
      
      // Sizes should be decremented
      expect(outTrie.size).toBe(sampleEdges.length - 1);
      expect(inTrie.size).toBe(sampleEdges.length - 1);
      
      // Removed edge should not exist
      expect(outTrie.contains(sampleEdges[0])).toBe(false);
      expect(inTrie.contains(sampleEdges[0])).toBe(false);
      
      // Other edges should still exist
      for (let i = 1; i < sampleEdges.length; i++) {
        expect(outTrie.contains(sampleEdges[i])).toBe(true);
        expect(inTrie.contains(sampleEdges[i])).toBe(true);
      }
    });
  });

  describe('Edge Addition/Removal Through Full Stack', () => {
    test('should handle complete edge lifecycle through all layers', () => {
      // Start with empty store
      let store = storeRoot;
      
      // Add relation type
      store = store.withAddedRelationType(sampleRelationType);
      
      // Add first edge
      store = store.withAddedEdge(sampleEdges[0]);
      
      // Verify at StoreRoot level
      expect(store.getEdgeCount()).toBe(1);
      expect(store.hasEdge(sampleEdges[0])).toBe(true);
      
      // Verify at TrieManager level
      expect(store.getTrieManager().getEdgeCount('worksAt')).toBe(1);
      expect(store.getTrieManager().containsEdge('worksAt', sampleEdges[0])).toBe(true);
      
      // Verify at Trie level
      const outTrie = store.getTrieManager().getOutTrie('worksAt');
      const inTrie = store.getTrieManager().getInTrie('worksAt');
      
      expect(outTrie.contains(sampleEdges[0])).toBe(true);
      expect(inTrie.contains(sampleEdges[0])).toBe(true);
      
      // Add second edge
      store = store.withAddedEdge(sampleEdges[1]);
      
      // Verify counts updated at all levels
      expect(store.getEdgeCount()).toBe(2);
      expect(store.getTrieManager().getEdgeCount('worksAt')).toBe(2);
      expect(store.getTrieManager().getOutTrie('worksAt').size).toBe(2);
      expect(store.getTrieManager().getInTrie('worksAt').size).toBe(2);
      
      // Remove first edge
      store = store.withRemovedEdge(sampleEdges[0]);
      
      // Verify removal at all levels
      expect(store.getEdgeCount()).toBe(1);
      expect(store.hasEdge(sampleEdges[0])).toBe(false);
      expect(store.hasEdge(sampleEdges[1])).toBe(true);
      
      expect(store.getTrieManager().getEdgeCount('worksAt')).toBe(1);
      expect(store.getTrieManager().containsEdge('worksAt', sampleEdges[0])).toBe(false);
      expect(store.getTrieManager().containsEdge('worksAt', sampleEdges[1])).toBe(true);
      
      const finalOutTrie = store.getTrieManager().getOutTrie('worksAt');
      const finalInTrie = store.getTrieManager().getInTrie('worksAt');
      
      expect(finalOutTrie.size).toBe(1);
      expect(finalInTrie.size).toBe(1);
      expect(finalOutTrie.contains(sampleEdges[0])).toBe(false);
      expect(finalInTrie.contains(sampleEdges[0])).toBe(false);
      expect(finalOutTrie.contains(sampleEdges[1])).toBe(true);
      expect(finalInTrie.contains(sampleEdges[1])).toBe(true);
    });

    test('should maintain data consistency during complex operations', () => {
      let store = storeRoot.withAddedRelationType(sampleRelationType);
      
      // Add all edges
      for (const edge of sampleEdges) {
        store = store.withAddedEdge(edge);
      }
      
      // Verify total consistency
      expect(store.getEdgeCount()).toBe(sampleEdges.length);
      expect(store.getTrieManager().getEdgeCount('worksAt')).toBe(sampleEdges.length);
      
      const outTrie = store.getTrieManager().getOutTrie('worksAt');
      const inTrie = store.getTrieManager().getInTrie('worksAt');
      
      expect(outTrie.size).toBe(sampleEdges.length);
      expect(inTrie.size).toBe(sampleEdges.length);
      
      // Check all edges present at all levels
      for (const edge of sampleEdges) {
        expect(store.hasEdge(edge)).toBe(true);
        expect(store.getTrieManager().containsEdge('worksAt', edge)).toBe(true);
        expect(outTrie.contains(edge)).toBe(true);
        expect(inTrie.contains(edge)).toBe(true);
      }
      
      // Verify graph structure is correct
      // Alice works at techcorp and startup
      expect(outTrie.getDestinationsForSource('alice')).toEqual(
        expect.arrayContaining(['techcorp', 'startup'])
      );
      expect(inTrie.getSourcesForDestination('techcorp')).toEqual(
        expect.arrayContaining(['alice', 'bob'])
      );
      expect(inTrie.getSourcesForDestination('startup')).toEqual(['alice']);
      expect(inTrie.getSourcesForDestination('bigco')).toEqual(['charlie']);
    });
  });

  describe('Structural Sharing and Immutability', () => {
    test('should preserve immutability through full stack', () => {
      const store1 = storeRoot.withAddedRelationType(sampleRelationType);
      const store2 = store1.withAddedEdge(sampleEdges[0]);
      const store3 = store2.withAddedEdge(sampleEdges[1]);
      
      // All stores should be frozen
      expect(Object.isFrozen(store1)).toBe(true);
      expect(Object.isFrozen(store2)).toBe(true);
      expect(Object.isFrozen(store3)).toBe(true);
      
      // All stores should be different instances
      expect(store1).not.toBe(store2);
      expect(store2).not.toBe(store3);
      expect(store1).not.toBe(store3);
      
      // TrieManagers should be different instances
      expect(store1.getTrieManager()).not.toBe(store2.getTrieManager());
      expect(store2.getTrieManager()).not.toBe(store3.getTrieManager());
      
      // Original state should be preserved
      expect(storeRoot.getEdgeCount()).toBe(0);
      expect(store1.getEdgeCount()).toBe(0);
      expect(store2.getEdgeCount()).toBe(1);
      expect(store3.getEdgeCount()).toBe(2);
    });

    test('should demonstrate structural sharing optimization', () => {
      const store1 = storeRoot.withAddedRelationType(sampleRelationType);
      const store2 = store1.withAddedEdge(sampleEdges[0]);
      
      // Adding same edge should return same instance (optimization)
      const store2Duplicate = store2.withAddedEdge(sampleEdges[0]);
      expect(store2Duplicate).toBe(store2);
      
      // Removing non-existent edge should return same instance
      const store1Unchanged = store1.withRemovedEdge(sampleEdges[0]);
      expect(store1Unchanged).toBe(store1);
    });

    test('should verify no mutation occurs at any level', () => {
      const originalStore = storeRoot.withAddedRelationType(sampleRelationType);
      const originalTrieManager = originalStore.getTrieManager();
      const originalOutTrie = originalTrieManager.getOutTrie('worksAt');
      const originalInTrie = originalTrieManager.getInTrie('worksAt');
      
      // Record original states
      const originalStoreEdgeCount = originalStore.getEdgeCount();
      const originalTrieManagerSize = originalTrieManager.getEdgeCount('worksAt');
      const originalOutTrieSize = originalOutTrie.size;
      const originalInTrieSize = originalInTrie.size;
      
      // Perform operations on new instances
      let newStore = originalStore.withAddedEdge(sampleEdges[0]);
      newStore = newStore.withAddedEdge(sampleEdges[1]);
      newStore = newStore.withRemovedEdge(sampleEdges[0]);
      
      // Verify original instances unchanged
      expect(originalStore.getEdgeCount()).toBe(originalStoreEdgeCount);
      expect(originalTrieManager.getEdgeCount('worksAt')).toBe(originalTrieManagerSize);
      expect(originalOutTrie.size).toBe(originalOutTrieSize);
      expect(originalInTrie.size).toBe(originalInTrieSize);
      
      // Verify all objects are still frozen
      expect(Object.isFrozen(originalStore)).toBe(true);
      expect(Object.isFrozen(originalTrieManager)).toBe(true);
      expect(Object.isFrozen(originalOutTrie)).toBe(true);
      expect(Object.isFrozen(originalInTrie)).toBe(true);
    });
  });

  describe('Error Handling Integration', () => {
    test('should fail fast when adding edge without relation type', () => {
      // Try to add edge without first defining relation type
      expect(() => {
        storeRoot.withAddedEdge(sampleEdges[0]);
      }).toThrow('Relation type worksAt not found');
    });

    test('should propagate validation errors through stack', () => {
      const store = storeRoot.withAddedRelationType(sampleRelationType);
      
      // Try to add invalid edge
      expect(() => {
        store.withAddedEdge(null);
      }).toThrow('Edge is required');
      
      expect(() => {
        store.withAddedEdge(new Edge('invalidType', 'alice', 'company'));
      }).toThrow('Relation type invalidType not found');
    });

    test('should maintain consistency when operations fail', () => {
      const store = storeRoot.withAddedRelationType(sampleRelationType);
      
      // Add valid edge
      const storeWithEdge = store.withAddedEdge(sampleEdges[0]);
      
      // Try invalid operation
      try {
        storeWithEdge.withAddedEdge(null);
      } catch (error) {
        // Ignore expected error
      }
      
      // Original store should be unchanged
      expect(storeWithEdge.getEdgeCount()).toBe(1);
      expect(storeWithEdge.hasEdge(sampleEdges[0])).toBe(true);
      expect(storeWithEdge.getTrieManager().getEdgeCount('worksAt')).toBe(1);
    });
  });

  describe('Performance and Scale Integration', () => {
    test('should handle moderate scale operations efficiently', () => {
      let store = storeRoot.withAddedRelationType(sampleRelationType);
      
      // Generate more edges for testing
      const manyEdges = [];
      for (let i = 0; i < 50; i++) {
        manyEdges.push(new Edge('worksAt', `person${i}`, `company${i % 10}`));
      }
      
      // Add all edges
      const startTime = Date.now();
      for (const edge of manyEdges) {
        store = store.withAddedEdge(edge);
      }
      const endTime = Date.now();
      
      // Should complete in reasonable time (this is MVP - no strict performance requirements)
      expect(endTime - startTime).toBeLessThan(5000); // 5 seconds should be plenty
      
      // Verify final state
      expect(store.getEdgeCount()).toBe(manyEdges.length);
      expect(store.getTrieManager().getEdgeCount('worksAt')).toBe(manyEdges.length);
      
      const outTrie = store.getTrieManager().getOutTrie('worksAt');
      const inTrie = store.getTrieManager().getInTrie('worksAt');
      
      expect(outTrie.size).toBe(manyEdges.length);
      expect(inTrie.size).toBe(manyEdges.length);
      
      // Verify a few random edges
      expect(store.hasEdge(manyEdges[0])).toBe(true);
      expect(store.hasEdge(manyEdges[25])).toBe(true);
      expect(store.hasEdge(manyEdges[49])).toBe(true);
    });
  });
});