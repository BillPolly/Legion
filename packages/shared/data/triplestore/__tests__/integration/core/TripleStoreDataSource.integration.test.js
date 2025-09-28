import { describe, it, expect, beforeEach } from '@jest/globals';
import { TripleStoreDataSource } from '../../../src/core/TripleStoreDataSource.js';
import { InMemoryProvider } from '../../../src/providers/InMemoryProvider.js';
import { FileSystemProvider } from '../../../src/providers/FileSystemProvider.js';
import { DataScriptProvider } from '../../../src/providers/DataScriptProvider.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Phase 5: Integration tests for TripleStoreDataSource
 * 
 * Verifies the wrapper works with all provider implementations.
 */
describe('TripleStoreDataSource - Integration Tests', () => {
  const testProviders = [
    { 
      name: 'memory',  // Match the actual provider type name
      create: () => new InMemoryProvider() 
    },
    { 
      name: 'datascript', 
      create: () => new DataScriptProvider() 
    }
    // FileSystemProvider requires a DataSource abstraction (not a triple store)
    // We'll skip it for now since it's a different pattern
  ];

  describe('Cross-provider compatibility', () => {
    for (const providerSpec of testProviders) {
      describe(`with ${providerSpec.name} provider`, () => {
        let provider;
        let dataSource;

        beforeEach(async () => {
          provider = await (providerSpec.create ? providerSpec.create() : providerSpec.create());
          dataSource = new TripleStoreDataSource(provider);
        });

        afterEach(async () => {
          if (providerSpec.cleanup) {
            await providerSpec.cleanup(provider);
          }
        });

        it('should handle basic CRUD operations', async () => {
          // Create
          const addResult = await dataSource.update({
            operation: 'add',
            subject: 'entity:1',
            predicate: 'name',
            object: 'Test Entity'
          });
          expect(addResult.success).toBe(true);

          // Read
          const queryResult = await dataSource.query({
            subject: 'entity:1',
            predicate: null,
            object: null
          });
          expect(queryResult).toHaveLength(1);
          expect(queryResult[0]).toEqual({
            subject: 'entity:1',
            predicate: 'name',
            object: 'Test Entity'
          });

          // Update (add more data)
          await dataSource.update({
            operation: 'add',
            subject: 'entity:1',
            predicate: 'type',
            object: 'TestType'
          });

          const updatedQuery = await dataSource.query({
            subject: 'entity:1',
            predicate: null,
            object: null
          });
          expect(updatedQuery).toHaveLength(2);

          // Delete
          const removeResult = await dataSource.update({
            operation: 'remove',
            subject: 'entity:1',
            predicate: 'name',
            object: 'Test Entity'
          });
          expect(removeResult.success).toBe(true);

          const finalQuery = await dataSource.query({
            subject: 'entity:1',
            predicate: null,
            object: null
          });
          expect(finalQuery).toHaveLength(1);
        });

        it('should handle batch operations', async () => {
          const batchResult = await dataSource.update({
            operation: 'batch',
            operations: [
              {
                operation: 'add',
                subject: 'person:1',
                predicate: 'name',
                object: 'Alice'
              },
              {
                operation: 'add',
                subject: 'person:1',
                predicate: 'age',
                object: 30
              },
              {
                operation: 'add',
                subject: 'person:2',
                predicate: 'name',
                object: 'Bob'
              }
            ]
          });

          expect(batchResult.success).toBe(true);
          expect(batchResult.result).toHaveLength(3);

          const sizeResult = await dataSource.query({ type: 'size' });
          expect(sizeResult.size).toBe(3);
        });

        it('should preserve data types', async () => {
          const testData = [
            { pred: 'string', val: 'Hello World' },
            { pred: 'number', val: 42 },
            { pred: 'float', val: 3.14159 },
            { pred: 'boolean', val: true },
            { pred: 'zero', val: 0 },
            { pred: 'false', val: false }
          ];

          for (const { pred, val } of testData) {
            await dataSource.update({
              operation: 'add',
              subject: 'test:1',
              predicate: pred,
              object: val
            });
          }

          const results = await dataSource.query({
            subject: 'test:1',
            predicate: null,
            object: null
          });

          for (const { pred, val } of testData) {
            const triple = results.find(r => r.predicate === pred);
            expect(triple).toBeDefined();
            expect(triple.object).toBe(val);
            expect(typeof triple.object).toBe(typeof val);
          }
        });

        it('should handle subscriptions', async () => {
          const events = [];
          
          const unsubscribe = dataSource.subscribe(
            { subject: 'entity:1', predicate: null, object: null },
            (event) => events.push(event)
          );

          await dataSource.update({
            operation: 'add',
            subject: 'entity:1',
            predicate: 'status',
            object: 'active'
          });

          expect(events).toHaveLength(1);
          expect(events[0].type).toBe('change');
          expect(events[0].operation).toBe('add');
          expect(events[0].data).toHaveLength(1);

          unsubscribe();

          await dataSource.update({
            operation: 'add',
            subject: 'entity:1',
            predicate: 'updated',
            object: true
          });

          expect(events).toHaveLength(1); // No new events after unsubscribe
        });

        it('should provide accurate statistics', async () => {
          // Add some data
          await dataSource.update({
            operation: 'batch',
            operations: [
              { operation: 'add', subject: 'a', predicate: 'p1', object: 'v1' },
              { operation: 'add', subject: 'a', predicate: 'p2', object: 'v2' },
              { operation: 'add', subject: 'b', predicate: 'p1', object: 'v3' }
            ]
          });

          const stats = await dataSource.getStats();
          expect(stats.type).toBe('triplestore');
          expect(stats.provider).toBe(providerSpec.name);  // Already lowercase
          expect(stats.tripleCount).toBe(3);
          expect(stats.listenerCount).toBe(0);

          // Add a listener
          const unsubscribe = dataSource.subscribe({}, () => {});
          const statsWithListener = await dataSource.getStats();
          expect(statsWithListener.listenerCount).toBe(1);
          
          unsubscribe();
        });

        it('should expose provider capabilities through schema', () => {
          const schema = dataSource.getSchema();
          
          expect(schema.type).toBe('triplestore');
          expect(schema.capabilities.query).toBe(true);
          expect(schema.capabilities.update).toBe(true);
          expect(schema.capabilities.subscribe).toBe(true);
          
          // Provider-specific capabilities
          if (providerSpec.name === 'datascript') {
            expect(schema.capabilities.datalog).toBe(true);
            expect(schema.capabilities.pull).toBe(true);
          }
        });
      });
    }
  });

  describe('DataSource interface compliance', () => {
    let dataSource;

    beforeEach(() => {
      dataSource = new TripleStoreDataSource(new InMemoryProvider());
    });

    it('should implement all DataSource methods', () => {
      expect(typeof dataSource.query).toBe('function');
      expect(typeof dataSource.update).toBe('function');
      expect(typeof dataSource.subscribe).toBe('function');
      expect(typeof dataSource.getSchema).toBe('function');
    });

    it('should return promises from async methods', async () => {
      const queryPromise = dataSource.query({});
      expect(queryPromise).toBeInstanceOf(Promise);
      await queryPromise;

      const updatePromise = dataSource.update({
        operation: 'add',
        subject: 's',
        predicate: 'p',
        object: 'o'
      });
      expect(updatePromise).toBeInstanceOf(Promise);
      await updatePromise;
    });

    it('should return synchronous unsubscribe function', () => {
      const unsubscribe = dataSource.subscribe({}, () => {});
      expect(typeof unsubscribe).toBe('function');
      
      // Should not throw
      unsubscribe();
    });

    it('should return synchronous schema', () => {
      const schema = dataSource.getSchema();
      expect(schema).toBeDefined();
      expect(typeof schema).toBe('object');
      expect(schema.type).toBe('triplestore');
    });
  });

  describe('Real-world usage patterns', () => {
    let dataSource;

    beforeEach(() => {
      dataSource = new TripleStoreDataSource(new InMemoryProvider());
    });

    it('should handle knowledge graph construction', async () => {
      // Build a graph
      const graph = [
        { s: 'alice', p: 'type', o: 'Person' },
        { s: 'alice', p: 'name', o: 'Alice Smith' },
        { s: 'alice', p: 'knows', o: 'bob' },
        { s: 'bob', p: 'type', o: 'Person' },
        { s: 'bob', p: 'name', o: 'Bob Jones' },
        { s: 'bob', p: 'knows', o: 'alice' },
        { s: 'techcorp', p: 'type', o: 'Company' },
        { s: 'techcorp', p: 'employs', o: 'alice' },
        { s: 'techcorp', p: 'employs', o: 'bob' }
      ];

      // Load graph
      await dataSource.update({
        operation: 'batch',
        operations: graph.map(({ s, p, o }) => ({
          operation: 'add',
          subject: s,
          predicate: p,
          object: o
        }))
      });

      // Query patterns
      const people = await dataSource.query({
        subject: null,
        predicate: 'type',
        object: 'Person'
      });
      expect(people).toHaveLength(2);

      const employees = await dataSource.query({
        subject: 'techcorp',
        predicate: 'employs',
        object: null
      });
      expect(employees).toHaveLength(2);

      const aliceKnows = await dataSource.query({
        subject: 'alice',
        predicate: 'knows',
        object: null
      });
      expect(aliceKnows[0].object).toBe('bob');
    });

    it('should support reactive updates', async () => {
      const changes = [];
      
      // Subscribe to person data
      dataSource.subscribe(
        { subject: null, predicate: 'type', object: 'Person' },
        (event) => changes.push(event)
      );

      // Add people
      await dataSource.update({
        operation: 'add',
        subject: 'person:1',
        predicate: 'type',
        object: 'Person'
      });

      await dataSource.update({
        operation: 'add',
        subject: 'person:1',
        predicate: 'name',
        object: 'John'
      });

      await dataSource.update({
        operation: 'add',
        subject: 'person:2',
        predicate: 'type',
        object: 'Person'
      });

      // Check notifications
      expect(changes).toHaveLength(2); // Two 'Person' type additions
      expect(changes[0].changes.added).toHaveLength(1);
      expect(changes[1].changes.added).toHaveLength(1);
    });
  });
});