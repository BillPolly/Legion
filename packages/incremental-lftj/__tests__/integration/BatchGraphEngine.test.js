import { BatchGraphEngine, BatchUpdater } from '../../src/BatchGraphEngine.js';
import { QueryBuilder } from '../../src/QueryBuilder.js';
import { Schema } from '../../src/Schema.js';
import { Delta } from '../../src/Delta.js';
import { Tuple } from '../../src/Tuple.js';
import { ID, StringAtom, Integer } from '../../src/Atom.js';

describe('BatchGraphEngine Integration', () => {
  let engine;
  const userSchema = new Schema([
    { name: 'user_id', type: 'ID' },
    { name: 'name', type: 'String' }
  ]);

  const orderSchema = new Schema([
    { name: 'order_id', type: 'ID' },
    { name: 'user_id', type: 'ID' },
    { name: 'amount', type: 'Integer' }
  ]);

  beforeEach(() => {
    engine = new BatchGraphEngine({
      batchSize: 3,
      autoFlush: false,
      batchMode: true
    });
  });

  afterEach(() => {
    engine.destroy();
  });

  describe('batch mode operations', () => {
    it('should accumulate updates in batch mode', () => {
      const query = new QueryBuilder('test-query')
        .from('users', userSchema)
        .build();

      engine.registerGraph(query);
      engine.coldStart('test-query');

      const tuple1 = new Tuple([new ID('u1'), new StringAtom('Alice')]);
      const tuple2 = new Tuple([new ID('u2'), new StringAtom('Bob')]);

      // Add updates without flushing
      engine.processUpdate('test-query', 'users', new Delta(new Set([tuple1]), new Set()));
      engine.processUpdate('test-query', 'users', new Delta(new Set([tuple2]), new Set()));

      // Check batch status
      const status = engine.getBatchStatus('test-query', 'users');
      expect(status.size).toBe(2);
      expect(status.isDirty).toBe(true);
    });

    it('should process batches on flush', () => {
      const query = new QueryBuilder('test-query')
        .from('users', userSchema)
        .build();

      engine.registerGraph(query);
      engine.coldStart('test-query');

      const tuple1 = new Tuple([new ID('u1'), new StringAtom('Alice')]);
      const tuple2 = new Tuple([new ID('u2'), new StringAtom('Bob')]);

      engine.processUpdate('test-query', 'users', new Delta(new Set([tuple1]), new Set()));
      engine.processUpdate('test-query', 'users', new Delta(new Set([tuple2]), new Set()));

      // Flush and check results
      const flushed = engine.flush('test-query');
      expect(flushed).toHaveLength(1);
      expect(flushed[0].delta.adds.size).toBe(2);

      // After flush, batch should be clear
      const status = engine.getBatchStatus('test-query', 'users');
      expect(status.isDirty).toBe(false);
    });

    it('should handle direct mode when batch mode disabled', () => {
      engine.setBatchMode(false);

      const query = new QueryBuilder('test-query')
        .from('users', userSchema)
        .build();

      engine.registerGraph(query);
      engine.coldStart('test-query');

      const tuple1 = new Tuple([new ID('u1'), new StringAtom('Alice')]);
      const results = engine.processUpdate('test-query', 'users', 
        new Delta(new Set([tuple1]), new Set())
      );

      // Should get immediate results
      expect(Object.keys(results).length).toBeGreaterThan(0);
    });
  });

  describe('transactions', () => {
    it('should batch updates within transaction', () => {
      const query = new QueryBuilder('test-query')
        .from('users', userSchema)
        .build();

      engine.registerGraph(query);
      engine.coldStart('test-query');

      engine.beginTransaction();

      const tuple1 = new Tuple([new ID('u1'), new StringAtom('Alice')]);
      const tuple2 = new Tuple([new ID('u2'), new StringAtom('Bob')]);
      const tuple3 = new Tuple([new ID('u3'), new StringAtom('Carol')]);

      // Add multiple updates in transaction
      engine.processUpdate('test-query', 'users', new Delta(new Set([tuple1]), new Set()));
      engine.processUpdate('test-query', 'users', new Delta(new Set([tuple2]), new Set()));
      engine.processUpdate('test-query', 'users', new Delta(new Set([tuple3]), new Set()));

      // Should all be batched
      const status = engine.getBatchStatus('test-query', 'users');
      expect(status.size).toBe(3);

      engine.endTransaction();
    });

    it('should execute function in transaction', async () => {
      const query = new QueryBuilder('test-query')
        .from('users', userSchema)
        .build();

      engine.registerGraph(query);
      engine.coldStart('test-query');

      const result = await engine.executeInTransaction(async () => {
        const tuple1 = new Tuple([new ID('u1'), new StringAtom('Alice')]);
        engine.processUpdate('test-query', 'users', new Delta(new Set([tuple1]), new Set()));
        return 'success';
      });

      expect(result).toBe('success');
    });
  });

  describe('complex queries with batching', () => {
    it('should handle join query with batched updates', () => {
      const query = new QueryBuilder('join-query')
        .from('users', userSchema)
        .joinRelation('orders', orderSchema, [{ left: 0, right: 1 }])
        .build();

      engine.registerGraph(query);
      engine.coldStart('join-query');

      engine.beginTransaction();

      // Add users
      const user1 = new Tuple([new ID('u1'), new StringAtom('Alice')]);
      const user2 = new Tuple([new ID('u2'), new StringAtom('Bob')]);
      
      // Add orders
      const order1 = new Tuple([new ID('o1'), new ID('u1'), new Integer(100)]);
      const order2 = new Tuple([new ID('o2'), new ID('u1'), new Integer(200)]);
      const order3 = new Tuple([new ID('o3'), new ID('u2'), new Integer(150)]);

      engine.processUpdate('join-query', 'users', new Delta(new Set([user1, user2]), new Set()));
      engine.processUpdate('join-query', 'orders', 
        new Delta(new Set([order1, order2, order3]), new Set())
      );

      engine.endTransaction();

      // After transaction, batches should be processed - flush manually to ensure
      engine.flush('join-query');
      
      // Check batch was processed
      const userStatus = engine.getBatchStatus('join-query', 'users');
      const orderStatus = engine.getBatchStatus('join-query', 'orders');
      
      expect(userStatus.isDirty).toBe(false);
      expect(orderStatus.isDirty).toBe(false);
    });

    it('should handle projection with batching', () => {
      const query = new QueryBuilder('project-query')
        .from('users', userSchema)
        .select([0]) // Project to just user_id
        .build();

      engine.registerGraph(query);
      engine.coldStart('project-query');

      const tuple1 = new Tuple([new ID('u1'), new StringAtom('Alice')]);
      const tuple2 = new Tuple([new ID('u2'), new StringAtom('Bob')]);
      const tuple3 = new Tuple([new ID('u1'), new StringAtom('Alice Updated')]); // Update

      engine.beginTransaction();
      engine.processUpdate('project-query', 'users', new Delta(new Set([tuple1, tuple2]), new Set()));
      engine.processUpdate('project-query', 'users', new Delta(
        new Set([tuple3]), 
        new Set([tuple1])
      ));
      engine.endTransaction();

      const state = engine.getOutputState('project-query');
      expect(state).toBeDefined();
    });
  });

  describe('BatchUpdater utility', () => {
    it('should batch multiple updates', async () => {
      const query = new QueryBuilder('test-query')
        .from('users', userSchema)
        .build();

      engine.registerGraph(query);
      engine.coldStart('test-query');

      const updater = new BatchUpdater(engine, 'test-query');
      
      const tuple1 = new Tuple([new ID('u1'), new StringAtom('Alice')]);
      const tuple2 = new Tuple([new ID('u2'), new StringAtom('Bob')]);
      
      updater
        .add('users', new Delta(new Set([tuple1]), new Set()))
        .add('users', new Delta(new Set([tuple2]), new Set()));

      const results = await updater.execute();
      
      expect(results).toBeDefined();
      
      // Batch should be flushed
      const status = engine.getBatchStatus('test-query', 'users');
      expect(status.isDirty).toBe(false);
    });

    it('should clear pending updates', () => {
      const updater = new BatchUpdater(engine, 'test-query');
      
      const tuple1 = new Tuple([new ID('u1'), new StringAtom('Alice')]);
      updater.add('users', new Delta(new Set([tuple1]), new Set()));
      
      updater.clear();
      
      // Should have no updates to execute
      expect(updater._updates).toHaveLength(0);
    });
  });

  describe('statistics', () => {
    it('should track batch statistics', () => {
      const query = new QueryBuilder('test-query')
        .from('users', userSchema)
        .build();

      engine.registerGraph(query);
      engine.coldStart('test-query');

      const tuple1 = new Tuple([new ID('u1'), new StringAtom('Alice')]);
      const tuple2 = new Tuple([new ID('u2'), new StringAtom('Bob')]);

      engine.processUpdate('test-query', 'users', new Delta(new Set([tuple1]), new Set()));
      engine.processUpdate('test-query', 'users', new Delta(new Set([tuple2]), new Set()));
      
      engine.flush('test-query');

      const stats = engine.getBatchStatistics();
      expect(stats.totalDeltas).toBe(2);
      expect(stats.totalBatches).toBe(1);
      expect(stats.totalFlushes).toBe(1);
    });

    it('should reset batch statistics', () => {
      const query = new QueryBuilder('test-query')
        .from('users', userSchema)
        .build();

      engine.registerGraph(query);
      
      const tuple1 = new Tuple([new ID('u1'), new StringAtom('Alice')]);
      engine.processUpdate('test-query', 'users', new Delta(new Set([tuple1]), new Set()));
      engine.flush('test-query');

      engine.resetBatchStatistics();

      const stats = engine.getBatchStatistics();
      expect(stats.totalDeltas).toBe(0);
      expect(stats.totalBatches).toBe(0);
    });
  });

  describe('cleanup', () => {
    it('should clear batches on reset', () => {
      const query = new QueryBuilder('test-query')
        .from('users', userSchema)
        .build();

      engine.registerGraph(query);
      
      const tuple1 = new Tuple([new ID('u1'), new StringAtom('Alice')]);
      engine.processUpdate('test-query', 'users', new Delta(new Set([tuple1]), new Set()));

      engine.reset('test-query');

      const status = engine.getBatchStatus('test-query', 'users');
      expect(status).toBeDefined();
      expect(status.isDirty).toBe(false);
    });

    it('should clear batches on unregister', () => {
      const query = new QueryBuilder('test-query')
        .from('users', userSchema)
        .build();

      engine.registerGraph(query);
      
      const tuple1 = new Tuple([new ID('u1'), new StringAtom('Alice')]);
      engine.processUpdate('test-query', 'users', new Delta(new Set([tuple1]), new Set()));

      engine.unregisterGraph('test-query');

      const status = engine.getBatchStatus('test-query', 'users');
      expect(status).toBeDefined();
      expect(status.isDirty).toBe(false);
    });
  });
});