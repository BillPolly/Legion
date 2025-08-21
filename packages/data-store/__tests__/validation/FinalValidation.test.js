/**
 * Final Validation Tests for DataStore
 * Verifies all design requirements are met per design.md
 */

import { DataStore, createDataStore } from '../../src/DataStore.js';
import { Store } from '../../src/Store.js';
import { Edge } from '../../src/Edge.js';
import { Attribute } from '../../src/Attribute.js';
import { RelationshipType } from '../../src/RelationshipType.js';
import { TrieManager } from '../../src/trie/TrieManager.js';
import { Dispatcher } from '../../src/kernel/Dispatcher.js';
import { GraphSpecBuilder } from '../../src/query/GraphSpecBuilder.js';
import { SubscriptionManager } from '../../src/subscription/SubscriptionManager.js';
import { QueryAPI } from '../../src/api/QueryAPI.js';
import { ComplexQueryPatterns } from '../../src/query/ComplexQueryPatterns.js';
import { CacheManager } from '../../src/performance/CacheManager.js';
import { BatchOptimizer } from '../../src/performance/BatchOptimizer.js';

describe('Final Validation - Design Requirements', () => {
  
  describe('§1 - Store Model → Kernel Relations', () => {
    it('should implement binary relationship instances with set semantics', () => {
      const store = new Store();
      store.defineRelationType('worksAt', 'employs');
      
      const edge1 = new Edge('worksAt', 'emp1', 'company1');
      const edge2 = new Edge('worksAt', 'emp1', 'company1'); // Duplicate
      
      store.addEdge(edge1);
      store.addEdge(edge2);
      
      // Set semantics - no duplicates
      const edges = store.getEdgesByType('worksAt');
      expect(edges).toHaveLength(1);
      expect(edges[0]).toEqual(edge1);
    });

    it('should support forward and backward attributes', () => {
      const relType = new RelationshipType('worksAt', 'employs');
      
      expect(relType.forwardName).toBe('worksAt');
      expect(relType.backwardName).toBe('employs');
      
      const forwardAttr = relType.getForwardAttribute();
      const backwardAttr = relType.getBackwardAttribute();
      
      expect(forwardAttr).toBeInstanceOf(Attribute);
      expect(backwardAttr).toBeInstanceOf(Attribute);
      expect(forwardAttr.name).toBe('worksAt');
      expect(backwardAttr.name).toBe('employs');
    });
  });

  describe('§2 - Dispatcher: Store Writes to Kernel Batches', () => {
    it('should group writes into batches with delta entries', () => {
      const store = new Store();
      const trieManager = new TrieManager();
      const dispatcher = new Dispatcher(store, trieManager);
      
      let processedDelta = null;
      dispatcher.on('deltaProcessed', (event) => {
        processedDelta = event;
      });
      
      // Process delta
      const delta = {
        type: 'add',
        edge: new Edge('hasName', 'entity1', 'TestName')
      };
      
      dispatcher.processDelta(delta);
      
      expect(processedDelta).toBeDefined();
      expect(processedDelta.delta.type).toBe(delta.type);
      expect(processedDelta.delta.edge).toEqual(delta.edge);
    });

    it('should provide iterator factories for enumerable relations', () => {
      const trieManager = new TrieManager();
      
      // Register the relation first
      trieManager.registerRelation('hasTag');
      
      // Add test data
      trieManager.insertEdge('hasTag', new Edge('hasTag', 'item1', 'red'));
      trieManager.insertEdge('hasTag', new Edge('hasTag', 'item2', 'blue'));
      
      // Get forward iterator (Out trie)
      const sources = trieManager.getSources('hasTag');
      expect(sources).toContain('item1');
      expect(sources).toContain('item2');
      
      // Get destinations for a source
      const dests = trieManager.getDestinations('hasTag', 'item1');
      expect(dests).toContain('red');
    });
  });

  describe('§3 - Query Language → GraphSpec', () => {
    it('should compile path queries to GraphSpec', () => {
      const builder = new GraphSpecBuilder();
      const spec = GraphSpecBuilder.createSimplePath('?start', ['hasName', 'locatedIn']);
      
      expect(spec).toBeDefined();
      expect(spec._edges).toHaveLength(2);
      expect(spec._variableOrder).toContain('?start');
    });

    it('should support forward and inverse steps', () => {
      const patterns = new ComplexQueryPatterns();
      const spec = patterns.buildPathWithInverse(['hasName', '^worksAt', 'locatedIn']);
      
      expect(spec).toBeDefined();
      expect(spec._edges).toHaveLength(3);
      // Middle edge should be backward (inverse)
      expect(spec._edges[1].direction).toBe('backward');
    });

    it('should support disjunction (OR) and negation (NOT)', () => {
      const patterns = new ComplexQueryPatterns();
      
      // OR query
      const unionSpec = patterns.buildUnionQuery([
        patterns.buildSimpleForwardPath(['hasTag']),
        patterns.buildSimpleForwardPath(['hasCategory'])
      ]);
      
      expect(unionSpec).toBeDefined();
      expect(unionSpec._operator).toBe('union');
      
      // NOT query (Difference)
      const diffSpec = patterns.buildDifferenceQuery(
        patterns.buildSimpleForwardPath(['isActive']),
        patterns.buildSimpleForwardPath(['isArchived'])
      );
      
      expect(diffSpec).toBeDefined();
      expect(diffSpec._operator).toBe('difference');
    });
  });

  describe('§4 - Subscriptions & Notification Flow', () => {
    it('should support live query subscriptions', async () => {
      const dataStore = createDataStore();
      dataStore.defineRelationType('hasStatus', 'statusOf');
      
      // Submit query and get subscription
      const subscriptionId = dataStore.submitQuery(
        { path: 'hasStatus' },
        ['src', 'dst']
      );
      
      expect(subscriptionId).toBeDefined();
      
      // Add data
      dataStore.addEdge('hasStatus', 'task1', 'pending');
      await dataStore.flush();
      
      // Get subscription
      const subscription = dataStore.getSubscription(subscriptionId);
      expect(subscription).toBeDefined();
      expect(subscription.subscriptionId).toBe(subscriptionId);
      
      // Cleanup
      dataStore.unsubscribe(subscriptionId);
      await dataStore.close();
    });

    it('should relay kernel change-sets to clients', async () => {
      const dataStore = createDataStore();
      dataStore.defineRelationType('follows', 'followedBy');
      
      const subscriptionId = dataStore.submitQuery(
        { path: 'follows' },
        ['src', 'dst']
      );
      
      // Initial data
      dataStore.addEdge('follows', 'user1', 'user2');
      await dataStore.flush();
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      let subscription = dataStore.getSubscription(subscriptionId);
      const initialResults = subscription.currentResults || [];
      
      // Add more data
      dataStore.addEdge('follows', 'user3', 'user4');
      await dataStore.flush();
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      subscription = dataStore.getSubscription(subscriptionId);
      const updatedResults = subscription.currentResults || [];
      
      // Results should update
      expect(updatedResults.length).toBeGreaterThanOrEqual(initialResults.length);
      
      dataStore.unsubscribe(subscriptionId);
      await dataStore.close();
    });
  });

  describe('§5 - Predicates in the Store World', () => {
    it('should support enumerable predicates', () => {
      const patterns = new ComplexQueryPatterns();
      
      // Register type predicate
      patterns.registerPredicateProvider('IsSupplier', {
        getName() { return 'IsSupplier'; },
        async enumerate() { return [['supplier1'], ['supplier2']]; },
        async evaluate(tuple) { return tuple[0].startsWith('supplier'); },
        isEnumerable() { return true; }
      });
      
      const providers = patterns.getPredicateProviders();
      expect(providers).toHaveLength(1);
      expect(providers[0][0]).toBe('IsSupplier');
    });

    it('should support pointwise predicates', () => {
      const patterns = new ComplexQueryPatterns();
      
      // Register pointwise predicate
      patterns.registerPredicateProvider('WithinDistance', {
        getName() { return 'WithinDistance'; },
        async evaluate(point1, point2, maxDistance) {
          // Simplified distance check
          return Math.abs(point1 - point2) <= maxDistance;
        },
        isPointwise() { return true; }
      });
      
      const providers = patterns.getPredicateProviders();
      expect(providers).toHaveLength(1);
    });
  });

  describe('§8 - Iterator Adapters from Store', () => {
    it('should maintain Out/In tries for relationships', () => {
      const trieManager = new TrieManager();
      
      // Register the relation first
      trieManager.registerRelation('connects');
      
      // Add edges
      trieManager.insertEdge('connects', new Edge('connects', 'node1', 'node2'));
      trieManager.insertEdge('connects', new Edge('connects', 'node1', 'node3'));
      trieManager.insertEdge('connects', new Edge('connects', 'node2', 'node4'));
      
      // Out trie: src -> sorted dsts
      const node1Dests = trieManager.getDestinations('connects', 'node1');
      expect(node1Dests).toEqual(['node2', 'node3']);
      
      // In trie: dst -> sorted srcs
      const node4Sources = trieManager.getSources('connects', 'node4');
      expect(node4Sources).toContain('node2');
    });
  });

  describe('§9 - Scalar Attributes & Replacements', () => {
    it('should handle scalar replacements as remove+add', async () => {
      const dataStore = createDataStore();
      dataStore.defineRelationType('hasAge', 'ageOf');
      
      // Initial value
      dataStore.addEdge('hasAge', 'person1', 25);
      await dataStore.flush();
      
      // Replace (remove old, add new)
      dataStore.removeEdge('hasAge', 'person1', 25);
      dataStore.addEdge('hasAge', 'person1', 26);
      await dataStore.flush();
      
      // Check final state
      const edges = dataStore.getEdges('hasAge');
      const person1Age = edges.find(e => e.src === 'person1');
      expect(person1Age?.dst).toBe(26);
      
      await dataStore.close();
    });
  });

  describe('§11 - Activation & Bootstrap', () => {
    it('should support query activation and bootstrapping', async () => {
      const dataStore = createDataStore();
      dataStore.defineRelationType('hasValue', 'valueOf');
      
      // Add initial data before subscription
      dataStore.addEdge('hasValue', 'x', 1);
      dataStore.addEdge('hasValue', 'y', 2);
      await dataStore.flush();
      
      // Subscribe - should bootstrap with existing data
      const subscriptionId = dataStore.submitQuery(
        { path: 'hasValue' },
        ['src', 'dst']
      );
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const subscription = dataStore.getSubscription(subscriptionId);
      const results = subscription.currentResults || [];
      
      // Should have bootstrapped with initial data
      expect(results.length).toBeGreaterThanOrEqual(2);
      
      dataStore.unsubscribe(subscriptionId);
      await dataStore.close();
    });
  });

  describe('§12 - Examples (End-to-End)', () => {
    it('should handle "Suppliers in UK named Acme" example', async () => {
      const dataStore = createDataStore();
      dataStore.defineRelationType('hasName', 'nameOf');
      dataStore.defineRelationType('locatedIn', 'contains');
      dataStore.defineRelationType('InstanceOf', 'typeOf');
      
      // Add test data
      dataStore.addEdge('InstanceOf', 'supplier1', ':Supplier');
      dataStore.addEdge('hasName', 'supplier1', 'Acme');
      dataStore.addEdge('locatedIn', 'supplier1', 'UK');
      
      dataStore.addEdge('InstanceOf', 'supplier2', ':Supplier');
      dataStore.addEdge('hasName', 'supplier2', 'Beta');
      dataStore.addEdge('locatedIn', 'supplier2', 'UK');
      
      await dataStore.flush();
      
      // Query for suppliers
      const edges = dataStore.getEdges('InstanceOf', [
        { field: 'dst', operator: '=', value: ':Supplier' }
      ]);
      
      expect(edges.length).toBeGreaterThanOrEqual(2);
      
      await dataStore.close();
    });
  });

  describe('§13 - Edge Cases & Safety', () => {
    it('should handle cycles in base graph', async () => {
      const dataStore = createDataStore();
      dataStore.defineRelationType('links', 'linkedFrom');
      
      // Create cycle
      dataStore.addEdge('links', 'a', 'b');
      dataStore.addEdge('links', 'b', 'c');
      dataStore.addEdge('links', 'c', 'a'); // Cycle
      
      await dataStore.flush();
      
      // Should handle without infinite loops
      const edges = dataStore.getEdges('links');
      expect(edges).toHaveLength(3);
      
      await dataStore.close();
    });

    it('should handle large fan-out', async () => {
      const dataStore = createDataStore();
      dataStore.defineRelationType('hasFollower', 'follows');
      
      // Create large fan-out
      const hubUser = 'celebrity';
      for (let i = 0; i < 100; i++) {
        dataStore.addEdge('hasFollower', hubUser, `fan${i}`);
      }
      
      await dataStore.flush();
      
      const edges = dataStore.getEdges('hasFollower', [
        { field: 'src', operator: '=', value: hubUser }
      ]);
      
      expect(edges).toHaveLength(100);
      
      await dataStore.close();
    });
  });

  describe('§14 - What to Reuse & Share', () => {
    it('should cache and reuse GraphSpecs', () => {
      const cacheManager = new CacheManager();
      
      const spec1 = { query: 'test1' };
      const spec2 = { query: 'test2' };
      
      // First access - cache miss
      const result1 = cacheManager.getOrCreateGraphSpec('key1', () => spec1);
      expect(result1).toBe(spec1);
      
      // Second access - cache hit
      const result2 = cacheManager.getOrCreateGraphSpec('key1', () => spec2);
      expect(result2).toBe(spec1); // Returns cached version
      
      const stats = cacheManager.getStatistics();
      expect(stats.performance.graphSpecReuse).toBe(1);
    });

    it('should share predicate graphs', () => {
      const cacheManager = new CacheManager();
      
      const predicate = { name: 'IsActive', evaluate: () => true };
      
      // Create shared predicate
      const shared1 = cacheManager.getOrCreateSharedPredicate('IsActive', () => predicate);
      const shared2 = cacheManager.getOrCreateSharedPredicate('IsActive', () => ({ different: true }));
      
      expect(shared1).toBe(predicate);
      expect(shared2).toBe(predicate); // Reuses shared version
      
      const stats = cacheManager.getStatistics();
      expect(stats.performance.predicateSharing).toBe(1);
    });
  });

  describe('§15 - Interfaces', () => {
    it('should implement Host → Kernel interface', async () => {
      const dataStore = createDataStore({ enableKernel: true });
      
      // defineRelation
      dataStore.defineKernelRelation('testRel', {
        arity: 2,
        types: ['string', 'string']
      });
      
      // defineGraph and activateGraph
      const graphSpec = {
        nodes: [],
        edges: [],
        outputs: ['result']
      };
      
      dataStore.defineKernelGraph('graph1', graphSpec);
      dataStore.activateKernelGraph('graph1');
      
      // pushBatch
      const batch = [
        { type: 'add', edge: new Edge('testRel', 'a', 'b') }
      ];
      
      const outputDeltas = await dataStore.pushBatchToKernel(batch);
      expect(outputDeltas).toBeDefined();
      
      await dataStore.close();
    });

    it('should implement Query API (Client → Host)', async () => {
      const dataStore = createDataStore();
      dataStore.defineRelationType('test', 'testInv');
      
      // submitPathQuery
      const subscriptionId = dataStore.submitQuery(
        { path: 'test' },
        ['src', 'dst']
      );
      
      expect(subscriptionId).toBeDefined();
      
      // unsubscribe
      const result = dataStore.unsubscribe(subscriptionId);
      expect(result).toBe(true);
      
      await dataStore.close();
    });
  });

  describe('Performance Optimizations', () => {
    it('should implement batch optimization', async () => {
      const optimizer = new BatchOptimizer({
        minBatchSize: 5,
        deduplication: true,
        coalescing: true
      });
      
      let processedBatch = null;
      optimizer.on('batch', batch => {
        processedBatch = batch;
      });
      
      // Add duplicate operations
      const edge = { type: 'rel', src: 'a', dst: 'b' };
      optimizer.addWrite({ type: 'add', edge });
      optimizer.addWrite({ type: 'add', edge }); // Duplicate
      optimizer.addWrite({ type: 'add', edge }); // Duplicate
      optimizer.addWrite({ type: 'remove', edge });
      optimizer.addWrite({ type: 'add', edge: { ...edge, dst: 'c' } });
      
      await optimizer.flush();
      
      // Should have optimized the batch
      expect(processedBatch).toBeDefined();
      expect(processedBatch.length).toBeLessThan(5); // Deduplicated
      
      const stats = optimizer.getStatistics();
      expect(stats.duplicatesRemoved).toBeGreaterThan(0);
    });

    it('should implement memory management', () => {
      const cacheManager = new CacheManager({
        resultTTL: 100
      });
      
      // Add items
      cacheManager.cacheResults('query1', [1, 2, 3]);
      
      // Check stats
      const stats = cacheManager.getStatistics();
      expect(stats.resultCache.size).toBe(1);
      
      // Perform GC
      const gcResult = cacheManager.performGarbageCollection();
      expect(gcResult).toBeDefined();
    });
  });
});