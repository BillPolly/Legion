/**
 * Unit tests for Dispatcher class
 * Tests dispatcher functionality per design §3
 */

import { Dispatcher } from '../../../src/kernel/Dispatcher.js';
import { Store } from '../../../src/Store.js';
import { TrieManager } from '../../../src/trie/TrieManager.js';
import { Edge } from '../../../src/Edge.js';

describe('Dispatcher', () => {
  let store;
  let trieManager;
  let dispatcher;

  beforeEach(() => {
    store = new Store();
    trieManager = new TrieManager();
    dispatcher = new Dispatcher(store, trieManager);
  });

  describe('construction', () => {
    it('should create dispatcher with store and trie manager', () => {
      expect(dispatcher.store).toBe(store);
      expect(dispatcher.trieManager).toBe(trieManager);
      expect(dispatcher.getQueryIds()).toEqual([]);
      expect(dispatcher.getPendingDeltaCount()).toBe(0);
    });

    it('should validate required parameters', () => {
      expect(() => new Dispatcher(null, trieManager)).toThrow('Store is required');
      expect(() => new Dispatcher(store, null)).toThrow('TrieManager is required');
    });

    it('should initialize as EventEmitter', () => {
      expect(dispatcher.on).toBeDefined();
      expect(dispatcher.emit).toBeDefined();
    });
  });

  describe('query registration', () => {
    it('should register simple select query', () => {
      const querySpec = {
        type: 'select',
        relation: 'worksAt'
      };

      const subscription = dispatcher.registerQuery('q1', querySpec);

      expect(subscription.queryId).toBe('q1');
      expect(subscription.querySpec).toBe(querySpec);
      expect(subscription.isActive).toBe(false);
      expect(dispatcher.hasQuery('q1')).toBe(true);
      expect(dispatcher.getQueryIds()).toEqual(['q1']);
    });

    it('should register join query', () => {
      const querySpec = {
        type: 'join',
        relations: ['worksAt', 'livesIn'],
        variables: ['?X', '?Y', '?Z']
      };

      const subscription = dispatcher.registerQuery('join1', querySpec);

      expect(subscription.querySpec.relations).toEqual(['worksAt', 'livesIn']);
      expect(subscription.operators).toHaveLength(1);
      expect(subscription.operators[0].type).toBe('leapfrog-join');
    });

    it('should prevent duplicate query registration', () => {
      const querySpec = { type: 'select', relation: 'worksAt' };
      
      dispatcher.registerQuery('q1', querySpec);
      
      expect(() => dispatcher.registerQuery('q1', querySpec))
        .toThrow('Query \'q1\' is already registered');
    });

    it('should validate query parameters', () => {
      expect(() => dispatcher.registerQuery(null, {}))
        .toThrow('Query ID is required');
      expect(() => dispatcher.registerQuery('q1', null))
        .toThrow('Query specification is required');
    });

    it('should emit queryRegistered event', () => {
      let eventData = null;
      const handler = (data) => { eventData = data; };
      dispatcher.on('queryRegistered', handler);

      const querySpec = { type: 'select', relation: 'worksAt' };
      dispatcher.registerQuery('q1', querySpec);

      expect(eventData).toEqual({ queryId: 'q1', querySpec });
    });
  });

  describe('query unregistration', () => {
    beforeEach(() => {
      const querySpec = { type: 'select', relation: 'worksAt' };
      dispatcher.registerQuery('q1', querySpec);
    });

    it('should unregister existing query', () => {
      expect(dispatcher.hasQuery('q1')).toBe(true);
      
      const result = dispatcher.unregisterQuery('q1');
      
      expect(result).toBe(true);
      expect(dispatcher.hasQuery('q1')).toBe(false);
      expect(dispatcher.getQueryIds()).toEqual([]);
    });

    it('should handle unregistering non-existent query', () => {
      const result = dispatcher.unregisterQuery('unknown');
      expect(result).toBe(false);
    });

    it('should emit queryUnregistered event', () => {
      let eventData = null;
      const handler = (data) => { eventData = data; };
      dispatcher.on('queryUnregistered', handler);

      dispatcher.unregisterQuery('q1');

      expect(eventData).toEqual({ queryId: 'q1' });
    });
  });

  describe('query activation', () => {
    beforeEach(() => {
      store.defineRelationType('worksAt', 'workedBy');
      trieManager.registerRelationType('worksAt', 'workedBy');
      
      const querySpec = { type: 'select', relation: 'worksAt' };
      dispatcher.registerQuery('q1', querySpec);
    });

    it('should activate registered query', () => {
      expect(dispatcher.isQueryActive('q1')).toBe(false);
      
      dispatcher.activateQuery('q1');
      
      expect(dispatcher.isQueryActive('q1')).toBe(true);
    });

    it('should execute query on activation', () => {
      let eventData = null;
      const handler = (data) => { eventData = data; };
      dispatcher.on('queryResultsChanged', handler);

      // Add some test data
      const edge = new Edge('worksAt', 'alice', 'acme');
      store.addEdge(edge);

      dispatcher.activateQuery('q1');

      // Should have executed and found the edge
      const results = dispatcher.getQueryResults('q1');
      expect(results).toHaveLength(1);
      expect(results[0].equals(edge)).toBe(true);
    });

    it('should throw for unknown query', () => {
      expect(() => dispatcher.activateQuery('unknown'))
        .toThrow('Query \'unknown\' not found');
    });

    it('should emit queryActivated event', () => {
      let eventData = null;
      const handler = (data) => { eventData = data; };
      dispatcher.on('queryActivated', handler);

      dispatcher.activateQuery('q1');

      expect(eventData).toEqual({ queryId: 'q1' });
    });
  });

  describe('query deactivation', () => {
    beforeEach(() => {
      store.defineRelationType('worksAt', 'workedBy');
      const querySpec = { type: 'select', relation: 'worksAt' };
      dispatcher.registerQuery('q1', querySpec);
      dispatcher.activateQuery('q1');
    });

    it('should deactivate active query', () => {
      expect(dispatcher.isQueryActive('q1')).toBe(true);
      
      dispatcher.deactivateQuery('q1');
      
      expect(dispatcher.isQueryActive('q1')).toBe(false);
    });

    it('should throw for unknown query', () => {
      expect(() => dispatcher.deactivateQuery('unknown'))
        .toThrow('Query \'unknown\' not found');
    });

    it('should emit queryDeactivated event', () => {
      let eventData = null;
      const handler = (data) => { eventData = data; };
      dispatcher.on('queryDeactivated', handler);

      dispatcher.deactivateQuery('q1');

      expect(eventData).toEqual({ queryId: 'q1' });
    });
  });

  describe('delta processing', () => {
    beforeEach(() => {
      store.defineRelationType('worksAt', 'workedBy');
      trieManager.registerRelationType('worksAt', 'workedBy');
    });

    it('should process single delta', () => {
      const delta = {
        type: 'add',
        edge: new Edge('worksAt', 'alice', 'acme')
      };

      dispatcher.processDelta(delta);

      expect(dispatcher.getPendingDeltaCount()).toBe(1);
    });

    it('should process multiple deltas', () => {
      const deltas = [
        { type: 'add', edge: new Edge('worksAt', 'alice', 'acme') },
        { type: 'add', edge: new Edge('worksAt', 'bob', 'beta') }
      ];

      dispatcher.processDeltas(deltas);

      expect(dispatcher.getPendingDeltaCount()).toBe(2);
    });

    it('should validate delta structure', () => {
      expect(() => dispatcher.processDelta(null))
        .toThrow('Delta is required');
      
      expect(() => dispatcher.processDelta({}))
        .toThrow('Delta must have type');
      
      expect(() => dispatcher.processDelta({ type: 'invalid' }))
        .toThrow('Delta type must be "add" or "remove"');
      
      expect(() => dispatcher.processDelta({ type: 'add' }))
        .toThrow('Delta must have edge');
      
      expect(() => dispatcher.processDelta({ 
        type: 'add', 
        edge: { src: 'alice' } 
      })).toThrow('Delta edge must have type, src, and dst');
    });

    it('should validate deltas array', () => {
      expect(() => dispatcher.processDeltas('not-array'))
        .toThrow('Deltas must be an array');
    });

    it('should assign timestamps to deltas', () => {
      const delta = {
        type: 'add',
        edge: new Edge('worksAt', 'alice', 'acme')
      };

      const before = Date.now();
      dispatcher.processDelta(delta);
      const after = Date.now();

      // Check internal delta queue
      const queuedDeltas = dispatcher._deltaQueue;
      expect(queuedDeltas).toHaveLength(1);
      expect(queuedDeltas[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(queuedDeltas[0].timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('delta processing with queries', () => {
    beforeEach(() => {
      store.defineRelationType('worksAt', 'workedBy');
      trieManager.registerRelationType('worksAt', 'workedBy');
      
      const querySpec = { type: 'select', relation: 'worksAt' };
      dispatcher.registerQuery('q1', querySpec);
      dispatcher.activateQuery('q1');
    });

    it('should trigger query re-execution on relevant delta', async () => {
      let eventData = null;
      const handler = (data) => { eventData = data; };
      dispatcher.on('queryResultsChanged', handler);

      // Process delta for same relation as query
      const delta = {
        type: 'add',
        edge: new Edge('worksAt', 'alice', 'acme')
      };

      dispatcher.processDelta(delta);
      
      // Wait for processing to complete
      await dispatcher.waitForProcessing();

      // Query should have been re-executed with new results
      expect(eventData).not.toBeNull();
      const results = dispatcher.getQueryResults('q1');
      expect(results).toHaveLength(1);
    });

    it('should not trigger on irrelevant delta', async () => {
      let eventData = null;
      const handler = (data) => { eventData = data; };
      dispatcher.on('queryResultsChanged', handler);

      // Add different relation type to store first
      store.defineRelationType('livesIn', 'livedIn');
      
      // Process delta for different relation
      const delta = {
        type: 'add',
        edge: new Edge('livesIn', 'alice', 'sf')
      };

      dispatcher.processDelta(delta);
      await dispatcher.waitForProcessing();

      // Query should not have been affected
      expect(eventData).toBeNull();
    });

    it('should emit processing events', async () => {
      let startCalled = false;
      let completedCalled = false;
      let deltaEventData = null;

      dispatcher.on('processingStarted', () => { startCalled = true; });
      dispatcher.on('processingCompleted', () => { completedCalled = true; });
      dispatcher.on('deltaProcessed', (data) => { deltaEventData = data; });

      const delta = {
        type: 'add',
        edge: new Edge('worksAt', 'alice', 'acme')
      };

      dispatcher.processDelta(delta);
      await dispatcher.waitForProcessing();

      expect(startCalled).toBe(true);
      expect(completedCalled).toBe(true);
      expect(deltaEventData).not.toBeNull();
      expect(deltaEventData.delta).toMatchObject(delta);
    });
  });

  describe('query constraints', () => {
    beforeEach(() => {
      store.defineRelationType('worksAt', 'workedBy');
      trieManager.registerRelationType('worksAt', 'workedBy');
      
      // Add test data
      store.addEdge(new Edge('worksAt', 'alice', 'acme'));
      store.addEdge(new Edge('worksAt', 'bob', 'acme'));
      store.addEdge(new Edge('worksAt', 'alice', 'beta'));
    });

    it('should handle queries with equality constraints', () => {
      const querySpec = {
        type: 'select',
        relation: 'worksAt',
        constraints: [
          { field: 'src', operator: 'eq', value: 'alice' }
        ]
      };

      dispatcher.registerQuery('constrained', querySpec);
      dispatcher.activateQuery('constrained');

      const results = dispatcher.getQueryResults('constrained');
      expect(results).toHaveLength(2); // alice -> acme, alice -> beta
      expect(results.every(edge => edge.src === 'alice')).toBe(true);
    });

    it('should handle queries with inequality constraints', () => {
      const querySpec = {
        type: 'select',
        relation: 'worksAt',
        constraints: [
          { field: 'dst', operator: 'ne', value: 'acme' }
        ]
      };

      dispatcher.registerQuery('notAcme', querySpec);
      dispatcher.activateQuery('notAcme');

      const results = dispatcher.getQueryResults('notAcme');
      expect(results).toHaveLength(1); // alice -> beta
      expect(results[0].dst).toBe('beta');
    });
  });

  describe('statistics and management', () => {
    beforeEach(() => {
      store.defineRelationType('worksAt', 'workedBy');
      store.defineRelationType('livesIn', 'livedIn');
      
      dispatcher.registerQuery('q1', { type: 'select', relation: 'worksAt' });
      dispatcher.registerQuery('q2', { type: 'select', relation: 'livesIn' });
      dispatcher.activateQuery('q1');
    });

    it('should provide accurate statistics', async () => {
      // Add some deltas - only use worksAt since livesIn might not be properly registered
      dispatcher.processDelta({ type: 'add', edge: new Edge('worksAt', 'alice', 'acme') });
      dispatcher.processDelta({ type: 'add', edge: new Edge('worksAt', 'bob', 'beta') });

      // Wait a moment for processing to potentially start, then get stats
      await new Promise(resolve => setTimeout(resolve, 10));
      await dispatcher.waitForProcessing();

      const stats = dispatcher.getStatistics();

      expect(stats.totalQueries).toBe(2);
      expect(stats.activeQueries).toBe(1); // Only q1 is active
      expect(stats.processedDeltas).toBe(2);
      expect(stats.totalDeltas).toBe(2);
      expect(stats.isProcessing).toBe(false);
    });

    it('should clear pending deltas', () => {
      dispatcher.processDelta({ type: 'add', edge: new Edge('worksAt', 'alice', 'acme') });
      expect(dispatcher.getPendingDeltaCount()).toBe(1);

      dispatcher.clearDeltas();
      expect(dispatcher.getPendingDeltaCount()).toBe(0);
    });

    it('should reset dispatcher state', () => {
      dispatcher.processDelta({ type: 'add', edge: new Edge('worksAt', 'alice', 'acme') });
      
      let resetCalled = false;
      dispatcher.on('reset', () => { resetCalled = true; });

      dispatcher.reset();

      expect(dispatcher.getQueryIds()).toEqual([]);
      expect(dispatcher.getPendingDeltaCount()).toBe(0);
      expect(dispatcher.isProcessing()).toBe(false);
      expect(resetCalled).toBe(true);
    });

    it('should provide string representation', () => {
      const str = dispatcher.toString();
      expect(str).toContain('Dispatcher');
      expect(str).toContain('queries=2');
      expect(str).toContain('active=1');
    });
  });

  describe('error handling', () => {
    it('should handle getting results for unknown query', () => {
      expect(() => dispatcher.getQueryResults('unknown'))
        .toThrow('Query \'unknown\' not found');
    });

    it('should handle checking if unknown query is active', () => {
      expect(dispatcher.isQueryActive('unknown')).toBe(false);
    });

    it('should handle empty processing', async () => {
      // No deltas to process
      await dispatcher.waitForProcessing();
      
      expect(dispatcher.isProcessing()).toBe(false);
      expect(dispatcher.getPendingDeltaCount()).toBe(0);
    });
  });

  describe('concurrency handling', () => {
    beforeEach(() => {
      store.defineRelationType('worksAt', 'workedBy');
      trieManager.registerRelationType('worksAt', 'workedBy');
      
      const querySpec = { type: 'select', relation: 'worksAt' };
      dispatcher.registerQuery('q1', querySpec);
      dispatcher.activateQuery('q1');
    });

    it('should handle concurrent delta processing', async () => {
      const deltas = Array.from({ length: 10 }, (_, i) => ({
        type: 'add',
        edge: new Edge('worksAt', `user${i}`, 'company')
      }));

      // Process all deltas concurrently
      deltas.forEach(delta => dispatcher.processDelta(delta));

      expect(dispatcher.getPendingDeltaCount()).toBe(10);

      // Wait for all processing to complete
      await dispatcher.waitForProcessing();

      // Check that deltas were processed (they stay in queue but marked as processed)
      const stats = dispatcher.getStatistics();
      expect(stats.processedDeltas).toBe(10);
    });

    it('should not start multiple processing cycles', async () => {
      let processingStartedCount = 0;
      dispatcher.on('processingStarted', () => { processingStartedCount++; });

      // Add multiple deltas rapidly
      for (let i = 0; i < 5; i++) {
        dispatcher.processDelta({
          type: 'add',
          edge: new Edge('worksAt', `user${i}`, 'company')
        });
      }

      await dispatcher.waitForProcessing();

      // Should only have started processing once
      expect(processingStartedCount).toBe(1);
    });
  });
});