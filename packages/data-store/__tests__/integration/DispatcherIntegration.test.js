/**
 * Integration tests for Dispatcher with Store and TrieManager
 * Tests complete dispatcher workflow per design §3
 */

import { Dispatcher } from '../../src/kernel/Dispatcher.js';
import { Store } from '../../src/Store.js';
import { TrieManager } from '../../src/trie/TrieManager.js';
import { Edge } from '../../src/Edge.js';

describe('Dispatcher Integration', () => {
  let store;
  let trieManager;
  let dispatcher;

  beforeEach(() => {
    store = new Store();
    trieManager = new TrieManager();
    dispatcher = new Dispatcher(store, trieManager);
    
    // Set up relation types
    store.defineRelationType('worksAt', 'workedBy');
    store.defineRelationType('livesIn', 'livedIn');
    trieManager.registerRelationType('worksAt', 'workedBy');
    trieManager.registerRelationType('livesIn', 'livedIn');
  });

  describe('complete workflow scenarios', () => {
    it('should handle full query lifecycle with delta processing', async () => {
      // 1. Register queries
      const workQuery = {
        type: 'select',
        relation: 'worksAt'
      };
      
      const livingQuery = {
        type: 'select', 
        relation: 'livesIn'
      };

      dispatcher.registerQuery('work-q', workQuery);
      dispatcher.registerQuery('living-q', livingQuery);

      // 2. Activate queries
      dispatcher.activateQuery('work-q');
      dispatcher.activateQuery('living-q');

      // 3. Process some deltas
      const deltas = [
        { type: 'add', edge: new Edge('worksAt', 'alice', 'acme') },
        { type: 'add', edge: new Edge('worksAt', 'bob', 'acme') },
        { type: 'add', edge: new Edge('livesIn', 'alice', 'sf') },
        { type: 'add', edge: new Edge('livesIn', 'bob', 'nyc') }
      ];

      let resultEvents = [];
      dispatcher.on('queryResultsChanged', (event) => {
        resultEvents.push(event);
      });

      // Process deltas one by one
      for (const delta of deltas) {
        dispatcher.processDelta(delta);
        await dispatcher.waitForProcessing();
      }

      // 4. Verify final state
      const workResults = dispatcher.getQueryResults('work-q');
      const livingResults = dispatcher.getQueryResults('living-q');

      expect(workResults).toHaveLength(2);
      expect(livingResults).toHaveLength(2);

      // Verify store state matches
      expect(store.getEdgeCount()).toBe(4);
      expect(trieManager.getEdgeCount('worksAt')).toBe(2);
      expect(trieManager.getEdgeCount('livesIn')).toBe(2);

      // Verify events were emitted
      expect(resultEvents.length).toBeGreaterThan(0);
    });

    it('should handle edge removal deltas', async () => {
      // Set up initial data
      const initialEdges = [
        new Edge('worksAt', 'alice', 'acme'),
        new Edge('worksAt', 'bob', 'acme')
      ];

      initialEdges.forEach(edge => {
        store.addEdge(edge);
        trieManager.insertEdge(edge.type, edge);
      });

      // Register and activate query
      dispatcher.registerQuery('work-q', { type: 'select', relation: 'worksAt' });
      dispatcher.activateQuery('work-q');

      // Initial results
      expect(dispatcher.getQueryResults('work-q')).toHaveLength(2);

      // Process removal delta
      const removalDelta = {
        type: 'remove',
        edge: new Edge('worksAt', 'alice', 'acme')
      };

      dispatcher.processDelta(removalDelta);
      await dispatcher.waitForProcessing();

      // Verify removal
      const results = dispatcher.getQueryResults('work-q');
      expect(results).toHaveLength(1);
      expect(results[0].src).toBe('bob');

      // Verify consistency across stores
      expect(store.getEdgeCount()).toBe(1);
      expect(trieManager.getEdgeCount('worksAt')).toBe(1);
    });

    it('should handle queries with constraints during delta processing', async () => {
      // Register constrained query
      const constrainedQuery = {
        type: 'select',
        relation: 'worksAt',
        constraints: [
          { field: 'dst', operator: 'eq', value: 'acme' }
        ]
      };

      dispatcher.registerQuery('acme-workers', constrainedQuery);
      dispatcher.activateQuery('acme-workers');

      // Process mixed deltas
      const deltas = [
        { type: 'add', edge: new Edge('worksAt', 'alice', 'acme') },    // Should match
        { type: 'add', edge: new Edge('worksAt', 'bob', 'beta') },      // Should not match
        { type: 'add', edge: new Edge('worksAt', 'carol', 'acme') }     // Should match
      ];

      for (const delta of deltas) {
        dispatcher.processDelta(delta);
        await dispatcher.waitForProcessing();
      }

      const results = dispatcher.getQueryResults('acme-workers');
      expect(results).toHaveLength(2); // Only alice and carol work at acme
      expect(results.every(edge => edge.dst === 'acme')).toBe(true);
    });

    it('should handle concurrent query processing', async () => {
      // Register multiple queries for same relation
      const queries = [
        { id: 'all-work', spec: { type: 'select', relation: 'worksAt' } },
        { 
          id: 'alice-work', 
          spec: { 
            type: 'select', 
            relation: 'worksAt',
            constraints: [{ field: 'src', operator: 'eq', value: 'alice' }]
          } 
        },
        { 
          id: 'acme-work', 
          spec: { 
            type: 'select', 
            relation: 'worksAt',
            constraints: [{ field: 'dst', operator: 'eq', value: 'acme' }]
          } 
        }
      ];

      // Register and activate all queries
      queries.forEach(({ id, spec }) => {
        dispatcher.registerQuery(id, spec);
        dispatcher.activateQuery(id);
      });

      // Process deltas that affect all queries
      const deltas = [
        { type: 'add', edge: new Edge('worksAt', 'alice', 'acme') },
        { type: 'add', edge: new Edge('worksAt', 'alice', 'beta') },
        { type: 'add', edge: new Edge('worksAt', 'bob', 'acme') }
      ];

      for (const delta of deltas) {
        dispatcher.processDelta(delta);
        await dispatcher.waitForProcessing();
      }

      // Verify all queries have correct results
      expect(dispatcher.getQueryResults('all-work')).toHaveLength(3);
      expect(dispatcher.getQueryResults('alice-work')).toHaveLength(2);
      expect(dispatcher.getQueryResults('acme-work')).toHaveLength(2);
    });
  });

  describe('error recovery and edge cases', () => {
    it('should handle deltas for unknown relation types gracefully', async () => {
      // Register query for known relation
      dispatcher.registerQuery('work-q', { type: 'select', relation: 'worksAt' });
      dispatcher.activateQuery('work-q');

      // Process delta for unknown relation type
      const unknownDelta = {
        type: 'add',
        edge: new Edge('unknown', 'alice', 'somewhere')
      };

      expect(() => dispatcher.processDelta(unknownDelta)).not.toThrow();
      await dispatcher.waitForProcessing();

      // Should not affect existing query
      expect(dispatcher.getQueryResults('work-q')).toHaveLength(0);
    });

    it('should handle rapid delta bursts', async () => {
      dispatcher.registerQuery('work-q', { type: 'select', relation: 'worksAt' });
      dispatcher.activateQuery('work-q');

      // Generate many deltas rapidly
      const deltas = Array.from({ length: 50 }, (_, i) => ({
        type: 'add',
        edge: new Edge('worksAt', `user${i}`, 'company')
      }));

      // Process all deltas at once
      deltas.forEach(delta => dispatcher.processDelta(delta));

      await dispatcher.waitForProcessing();

      // Verify all were processed
      const results = dispatcher.getQueryResults('work-q');
      expect(results).toHaveLength(50);

      const stats = dispatcher.getStatistics();
      expect(stats.processedDeltas).toBe(50);
    });

    it('should maintain consistency during mixed add/remove operations', async () => {
      dispatcher.registerQuery('work-q', { type: 'select', relation: 'worksAt' });
      dispatcher.activateQuery('work-q');

      // Add some initial edges
      const addDeltas = [
        { type: 'add', edge: new Edge('worksAt', 'alice', 'acme') },
        { type: 'add', edge: new Edge('worksAt', 'bob', 'acme') },
        { type: 'add', edge: new Edge('worksAt', 'carol', 'beta') }
      ];

      for (const delta of addDeltas) {
        dispatcher.processDelta(delta);
      }
      await dispatcher.waitForProcessing();

      expect(dispatcher.getQueryResults('work-q')).toHaveLength(3);

      // Now remove some and add others
      const mixedDeltas = [
        { type: 'remove', edge: new Edge('worksAt', 'alice', 'acme') },
        { type: 'add', edge: new Edge('worksAt', 'dave', 'acme') },
        { type: 'remove', edge: new Edge('worksAt', 'bob', 'acme') }
      ];

      for (const delta of mixedDeltas) {
        dispatcher.processDelta(delta);
      }
      await dispatcher.waitForProcessing();

      const finalResults = dispatcher.getQueryResults('work-q');
      expect(finalResults).toHaveLength(2); // carol and dave remain

      // Verify consistency
      expect(store.getEdgeCount()).toBe(2);
      expect(trieManager.getEdgeCount('worksAt')).toBe(2);
    });
  });

  describe('performance and scalability', () => {
    it('should handle large numbers of queries efficiently', async () => {
      // Register many queries
      for (let i = 0; i < 20; i++) {
        dispatcher.registerQuery(`query-${i}`, { type: 'select', relation: 'worksAt' });
        dispatcher.activateQuery(`query-${i}`);
      }

      // Process deltas
      const deltas = Array.from({ length: 10 }, (_, i) => ({
        type: 'add',
        edge: new Edge('worksAt', `user${i}`, 'company')
      }));

      const start = Date.now();
      
      for (const delta of deltas) {
        dispatcher.processDelta(delta);
      }
      await dispatcher.waitForProcessing();

      const end = Date.now();
      const duration = end - start;

      // Should complete in reasonable time
      expect(duration).toBeLessThan(1000);

      // All queries should have same results
      for (let i = 0; i < 20; i++) {
        expect(dispatcher.getQueryResults(`query-${i}`)).toHaveLength(10);
      }
    });
  });
});