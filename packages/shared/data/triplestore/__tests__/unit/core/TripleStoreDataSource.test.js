import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TripleStoreDataSource } from '../../../src/core/TripleStoreDataSource.js';
import { InMemoryProvider } from '../../../src/providers/InMemoryProvider.js';

/**
 * Phase 5: Unit tests for TripleStoreDataSource wrapper
 * 
 * Tests the DataSource interface wrapper for triple stores.
 */
describe('TripleStoreDataSource', () => {
  let tripleStore;
  let dataSource;

  beforeEach(() => {
    tripleStore = new InMemoryProvider();
    dataSource = new TripleStoreDataSource(tripleStore);
  });

  describe('Constructor', () => {
    it('should create instance with valid triple store', () => {
      expect(dataSource).toBeDefined();
      expect(dataSource.store).toBe(tripleStore);
    });

    it('should throw error with invalid triple store', () => {
      expect(() => new TripleStoreDataSource(null)).toThrow();
      expect(() => new TripleStoreDataSource({})).toThrow();
      expect(() => new TripleStoreDataSource('not a store')).toThrow();
    });
  });

  describe('query()', () => {
    beforeEach(async () => {
      await tripleStore.addTriple('entity:1', 'name', 'Alice');
      await tripleStore.addTriple('entity:1', 'age', 30);
      await tripleStore.addTriple('entity:2', 'name', 'Bob');
    });

    it('should query with object format', async () => {
      const results = await dataSource.query({
        subject: 'entity:1',
        predicate: null,
        object: null
      });

      expect(results).toHaveLength(2);
      expect(results).toContainEqual({
        subject: 'entity:1',
        predicate: 'name',
        object: 'Alice'
      });
      expect(results).toContainEqual({
        subject: 'entity:1',
        predicate: 'age',
        object: 30
      });
    });

    it('should query with array format', async () => {
      const results = await dataSource.query(['entity:1', 'name', null]);
      
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(['entity:1', 'name', 'Alice']);
    });

    it('should handle wildcard queries', async () => {
      const results = await dataSource.query({
        subject: null,
        predicate: 'name',
        object: null
      });

      expect(results).toHaveLength(2);
      expect(results.map(r => r.object)).toContain('Alice');
      expect(results.map(r => r.object)).toContain('Bob');
    });

    it('should handle empty query for all triples', async () => {
      const results = await dataSource.query({});
      expect(results).toHaveLength(3);
    });

    it('should handle size query', async () => {
      const result = await dataSource.query({ type: 'size' });
      expect(result).toEqual({ size: 3 });
    });

    it('should handle metadata query', async () => {
      const result = await dataSource.query({ type: 'metadata' });
      expect(result).toBeDefined();
      expect(result.type).toBe('memory');
    });
  });

  describe('update()', () => {
    describe('add operation', () => {
      it('should add a triple', async () => {
        const result = await dataSource.update({
          operation: 'add',
          subject: 'entity:1',
          predicate: 'name',
          object: 'Alice'
        });

        expect(result.success).toBe(true);
        expect(result.operation).toBe('add');
        
        const triples = await tripleStore.query(null, null, null);
        expect(triples).toHaveLength(1);
      });

      it('should fail to add duplicate triple', async () => {
        await dataSource.update({
          operation: 'add',
          subject: 'entity:1',
          predicate: 'name',
          object: 'Alice'
        });

        const result = await dataSource.update({
          operation: 'add',
          subject: 'entity:1',
          predicate: 'name',
          object: 'Alice'
        });

        expect(result.success).toBe(false);
      });

      it('should validate required fields', async () => {
        await expect(dataSource.update({
          operation: 'add',
          predicate: 'name',
          object: 'Alice'
        })).rejects.toThrow();

        await expect(dataSource.update({
          operation: 'add',
          subject: 'entity:1',
          object: 'Alice'
        })).rejects.toThrow();
      });
    });

    describe('remove operation', () => {
      beforeEach(async () => {
        await tripleStore.addTriple('entity:1', 'name', 'Alice');
        await tripleStore.addTriple('entity:1', 'age', 30);
      });

      it('should remove a triple', async () => {
        const result = await dataSource.update({
          operation: 'remove',
          subject: 'entity:1',
          predicate: 'name',
          object: 'Alice'
        });

        expect(result.success).toBe(true);
        
        const triples = await tripleStore.query(null, null, null);
        expect(triples).toHaveLength(1);
      });

      it('should fail to remove non-existent triple', async () => {
        const result = await dataSource.update({
          operation: 'remove',
          subject: 'entity:999',
          predicate: 'name',
          object: 'Nobody'
        });

        expect(result.success).toBe(false);
      });
    });

    describe('clear operation', () => {
      beforeEach(async () => {
        await tripleStore.addTriple('entity:1', 'name', 'Alice');
        await tripleStore.addTriple('entity:2', 'name', 'Bob');
      });

      it('should clear all triples', async () => {
        const result = await dataSource.update({
          operation: 'clear'
        });

        expect(result.success).toBe(true);
        
        const size = await tripleStore.size();
        expect(size).toBe(0);
      });
    });

    describe('batch operation', () => {
      it('should execute batch operations', async () => {
        const result = await dataSource.update({
          operation: 'batch',
          operations: [
            {
              operation: 'add',
              subject: 'entity:1',
              predicate: 'name',
              object: 'Alice'
            },
            {
              operation: 'add',
              subject: 'entity:2',
              predicate: 'name',
              object: 'Bob'
            }
          ]
        });

        expect(result.success).toBe(true);
        expect(result.result).toHaveLength(2);
        
        const size = await tripleStore.size();
        expect(size).toBe(2);
      });
    });

    it('should reject unknown operations', async () => {
      await expect(dataSource.update({
        operation: 'unknown'
      })).rejects.toThrow();
    });
  });

  describe('subscribe()', () => {
    it('should subscribe to changes', async () => {
      const callback = jest.fn();
      
      const unsubscribe = dataSource.subscribe(
        { subject: 'entity:1', predicate: null, object: null },
        callback
      );

      // Add a matching triple
      await dataSource.update({
        operation: 'add',
        subject: 'entity:1',
        predicate: 'name',
        object: 'Alice'
      });

      expect(callback).toHaveBeenCalled();
      const call = callback.mock.calls[0][0];
      expect(call.type).toBe('change');
      expect(call.operation).toBe('add');
      expect(call.data).toHaveLength(1);

      unsubscribe();
    });

    it('should not notify after unsubscribe', async () => {
      const callback = jest.fn();
      
      const unsubscribe = dataSource.subscribe({}, callback);
      unsubscribe();

      await dataSource.update({
        operation: 'add',
        subject: 'entity:1',
        predicate: 'name',
        object: 'Alice'
      });

      expect(callback).not.toHaveBeenCalled();
    });

    it('should only notify affected queries', async () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      
      dataSource.subscribe(
        { subject: 'entity:1', predicate: null, object: null },
        callback1
      );
      
      dataSource.subscribe(
        { subject: 'entity:2', predicate: null, object: null },
        callback2
      );

      await dataSource.update({
        operation: 'add',
        subject: 'entity:1',
        predicate: 'name',
        object: 'Alice'
      });

      expect(callback1).toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
    });

    it('should notify on clear operation', async () => {
      await tripleStore.addTriple('entity:1', 'name', 'Alice');
      
      const callback = jest.fn();
      dataSource.subscribe(
        { subject: 'entity:1', predicate: null, object: null },
        callback
      );

      await dataSource.update({ operation: 'clear' });

      expect(callback).toHaveBeenCalled();
      const call = callback.mock.calls[0][0];
      expect(call.operation).toBe('clear');
    });

    it('should detect added and removed changes', async () => {
      await tripleStore.addTriple('entity:1', 'name', 'Alice');
      
      const callback = jest.fn();
      dataSource.subscribe({}, callback);

      // Add a triple
      await dataSource.update({
        operation: 'add',
        subject: 'entity:1',
        predicate: 'age',
        object: 30
      });

      let call = callback.mock.calls[0][0];
      expect(call.changes.added).toHaveLength(1);
      expect(call.changes.removed).toHaveLength(0);

      // Remove a triple
      await dataSource.update({
        operation: 'remove',
        subject: 'entity:1',
        predicate: 'name',
        object: 'Alice'
      });

      call = callback.mock.calls[1][0];
      expect(call.changes.added).toHaveLength(0);
      expect(call.changes.removed).toHaveLength(1);
    });
  });

  describe('getSchema()', () => {
    it('should return schema information', () => {
      const schema = dataSource.getSchema();
      
      expect(schema.type).toBe('triplestore');
      expect(schema.provider).toBe('memory');
      expect(schema.capabilities.query).toBe(true);
      expect(schema.capabilities.update).toBe(true);
      expect(schema.capabilities.subscribe).toBe(true);
    });

    it('should include query format schema', () => {
      const schema = dataSource.getSchema();
      
      expect(schema.queryFormat).toBeDefined();
      expect(schema.queryFormat.properties.subject).toBeDefined();
      expect(schema.queryFormat.properties.predicate).toBeDefined();
      expect(schema.queryFormat.properties.object).toBeDefined();
    });

    it('should include update format schema', () => {
      const schema = dataSource.getSchema();
      
      expect(schema.updateFormat).toBeDefined();
      expect(schema.updateFormat.properties.operation).toBeDefined();
      expect(schema.updateFormat.properties.operation.enum).toContain('add');
      expect(schema.updateFormat.properties.operation.enum).toContain('remove');
      expect(schema.updateFormat.properties.operation.enum).toContain('clear');
      expect(schema.updateFormat.properties.operation.enum).toContain('batch');
    });

    it('should inherit capabilities from provider', async () => {
      // Use DataScriptProvider for different capabilities
      const { DataScriptProvider } = await import('../../../src/providers/DataScriptProvider.js');
      const dsStore = new DataScriptProvider();
      const dsDataSource = new TripleStoreDataSource(dsStore);
      
      const schema = dsDataSource.getSchema();
      expect(schema.capabilities.datalog).toBe(true);
      expect(schema.capabilities.pull).toBe(true);
    });
  });

  describe('getStats()', () => {
    it('should return statistics', async () => {
      await tripleStore.addTriple('entity:1', 'name', 'Alice');
      await tripleStore.addTriple('entity:2', 'name', 'Bob');
      
      const stats = await dataSource.getStats();
      
      expect(stats.type).toBe('triplestore');
      expect(stats.provider).toBe('memory');
      expect(stats.tripleCount).toBe(2);
      expect(stats.listenerCount).toBe(0);
    });

    it('should track listener count', async () => {
      const unsubscribe1 = dataSource.subscribe({}, () => {});
      const unsubscribe2 = dataSource.subscribe({}, () => {});
      
      let stats = await dataSource.getStats();
      expect(stats.listenerCount).toBe(2);
      
      unsubscribe1();
      stats = await dataSource.getStats();
      expect(stats.listenerCount).toBe(1);
      
      unsubscribe2();
      stats = await dataSource.getStats();
      expect(stats.listenerCount).toBe(0);
    });
  });

  describe('Type preservation', () => {
    it('should preserve data types through operations', async () => {
      await dataSource.update({
        operation: 'add',
        subject: 'entity:1',
        predicate: 'count',
        object: 42
      });

      await dataSource.update({
        operation: 'add',
        subject: 'entity:1',
        predicate: 'active',
        object: true
      });

      await dataSource.update({
        operation: 'add',
        subject: 'entity:1',
        predicate: 'score',
        object: 3.14
      });

      const results = await dataSource.query({
        subject: 'entity:1',
        predicate: null,
        object: null
      });

      const countTriple = results.find(r => r.predicate === 'count');
      expect(countTriple.object).toBe(42);
      expect(typeof countTriple.object).toBe('number');

      const activeTriple = results.find(r => r.predicate === 'active');
      expect(activeTriple.object).toBe(true);
      expect(typeof activeTriple.object).toBe('boolean');

      const scoreTriple = results.find(r => r.predicate === 'score');
      expect(scoreTriple.object).toBe(3.14);
      expect(typeof scoreTriple.object).toBe('number');
    });
  });
});