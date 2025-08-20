import { BatchManager, BatchTransaction } from '../../src/BatchManager.js';
import { Delta } from '../../src/Delta.js';
import { Tuple } from '../../src/Tuple.js';
import { ID, StringAtom, Integer } from '../../src/Atom.js';

describe('BatchManager', () => {
  let manager;

  beforeEach(() => {
    manager = new BatchManager({
      batchSize: 3,
      autoFlush: false // Disable auto-flush for predictable testing
    });
  });

  afterEach(() => {
    manager.destroy();
  });

  describe('constructor', () => {
    it('should create batch manager with default options', () => {
      const defaultManager = new BatchManager();
      expect(defaultManager).toBeDefined();
      expect(defaultManager.getStatistics().totalDeltas).toBe(0);
      defaultManager.destroy();
    });

    it('should create batch manager with custom options', () => {
      const customManager = new BatchManager({
        batchSize: 500,
        autoFlush: false,
        flushInterval: 200
      });
      expect(customManager).toBeDefined();
      customManager.destroy();
    });
  });

  describe('delta accumulation', () => {
    it('should accumulate deltas for a relation', () => {
      const tuple1 = new Tuple([new ID('1'), new StringAtom('Alice')]);
      const tuple2 = new Tuple([new ID('2'), new StringAtom('Bob')]);
      const delta1 = new Delta(new Set([tuple1]), new Set());
      const delta2 = new Delta(new Set([tuple2]), new Set());

      manager.addDelta('graph1', 'users', delta1);
      manager.addDelta('graph1', 'users', delta2);

      const status = manager.getBatchStatus('graph1', 'users');
      expect(status.size).toBe(2);
      expect(status.isDirty).toBe(true);
    });

    it('should cancel adds with removes', () => {
      const tuple1 = new Tuple([new ID('1'), new StringAtom('Alice')]);
      const addDelta = new Delta(new Set([tuple1]), new Set());
      const removeDelta = new Delta(new Set(), new Set([tuple1]));

      manager.addDelta('graph1', 'users', addDelta);
      manager.addDelta('graph1', 'users', removeDelta);

      const status = manager.getBatchStatus('graph1', 'users');
      expect(status.size).toBe(0);
      expect(status.isDirty).toBe(false);
    });

    it('should cancel removes with adds', () => {
      const tuple1 = new Tuple([new ID('1'), new StringAtom('Alice')]);
      const removeDelta = new Delta(new Set(), new Set([tuple1]));
      const addDelta = new Delta(new Set([tuple1]), new Set());

      manager.addDelta('graph1', 'users', removeDelta);
      manager.addDelta('graph1', 'users', addDelta);

      const status = manager.getBatchStatus('graph1', 'users');
      expect(status.size).toBe(0);
      expect(status.isDirty).toBe(false);
    });

    it('should handle multiple relations independently', () => {
      const userTuple = new Tuple([new ID('u1'), new StringAtom('Alice')]);
      const orderTuple = new Tuple([new ID('o1'), new ID('u1'), new Integer(100)]);
      
      const userDelta = new Delta(new Set([userTuple]), new Set());
      const orderDelta = new Delta(new Set([orderTuple]), new Set());

      manager.addDelta('graph1', 'users', userDelta);
      manager.addDelta('graph1', 'orders', orderDelta);

      const userStatus = manager.getBatchStatus('graph1', 'users');
      const orderStatus = manager.getBatchStatus('graph1', 'orders');

      expect(userStatus.size).toBe(1);
      expect(orderStatus.size).toBe(1);
    });
  });

  describe('flushing', () => {
    it('should flush batches and return deltas', () => {
      const tuple1 = new Tuple([new ID('1'), new StringAtom('Alice')]);
      const tuple2 = new Tuple([new ID('2'), new StringAtom('Bob')]);
      const delta1 = new Delta(new Set([tuple1]), new Set());
      const delta2 = new Delta(new Set([tuple2]), new Set());

      manager.addDelta('graph1', 'users', delta1);
      manager.addDelta('graph1', 'users', delta2);

      const flushed = manager.flush('graph1');
      
      expect(flushed).toHaveLength(1);
      expect(flushed[0].graphId).toBe('graph1');
      expect(flushed[0].relationName).toBe('users');
      expect(flushed[0].delta.adds.size).toBe(2);

      // After flush, batch should be empty
      const status = manager.getBatchStatus('graph1', 'users');
      expect(status.size).toBe(0);
      expect(status.isDirty).toBe(false);
    });

    it('should not flush clean batches', () => {
      const tuple1 = new Tuple([new ID('1'), new StringAtom('Alice')]);
      const addDelta = new Delta(new Set([tuple1]), new Set());
      const removeDelta = new Delta(new Set(), new Set([tuple1]));

      manager.addDelta('graph1', 'users', addDelta);
      manager.addDelta('graph1', 'users', removeDelta);

      const flushed = manager.flush('graph1');
      expect(flushed).toHaveLength(0);
    });

    it('should flush all graphs with flushAll', () => {
      const tuple1 = new Tuple([new ID('1'), new StringAtom('Alice')]);
      const tuple2 = new Tuple([new ID('2'), new StringAtom('Bob')]);
      
      manager.addDelta('graph1', 'users', new Delta(new Set([tuple1]), new Set()));
      manager.addDelta('graph2', 'users', new Delta(new Set([tuple2]), new Set()));

      const flushed = manager.flushAll();
      
      expect(flushed).toHaveLength(2);
      expect(flushed.map(f => f.graphId).sort()).toEqual(['graph1', 'graph2']);
    });

    it('should notify flush callback', () => {
      let callbackCalled = false;
      let callbackBatches = null;

      manager.onFlush((batches) => {
        callbackCalled = true;
        callbackBatches = batches;
      });

      const tuple1 = new Tuple([new ID('1'), new StringAtom('Alice')]);
      manager.addDelta('graph1', 'users', new Delta(new Set([tuple1]), new Set()));
      
      manager.flush('graph1');

      expect(callbackCalled).toBe(true);
      expect(callbackBatches).toHaveLength(1);
      expect(callbackBatches[0].graphId).toBe('graph1');
    });
  });

  describe('transactions', () => {
    it('should delay flushing during transaction', () => {
      const autoFlushManager = new BatchManager({
        batchSize: 2,
        autoFlush: true,
        flushInterval: 10
      });

      let flushCount = 0;
      autoFlushManager.onFlush(() => {
        flushCount++;
      });

      autoFlushManager.beginTransaction();

      const tuple1 = new Tuple([new ID('1'), new StringAtom('Alice')]);
      const tuple2 = new Tuple([new ID('2'), new StringAtom('Bob')]);
      const tuple3 = new Tuple([new ID('3'), new StringAtom('Carol')]);

      // Add 3 tuples (exceeds batch size of 2)
      autoFlushManager.addDelta('graph1', 'users', new Delta(new Set([tuple1]), new Set()));
      autoFlushManager.addDelta('graph1', 'users', new Delta(new Set([tuple2]), new Set()));
      autoFlushManager.addDelta('graph1', 'users', new Delta(new Set([tuple3]), new Set()));

      // Should not flush yet
      expect(flushCount).toBe(0);

      autoFlushManager.endTransaction();

      // Should flush after transaction ends
      expect(flushCount).toBe(1);

      autoFlushManager.destroy();
    });

    it('should support nested transactions', () => {
      manager.beginTransaction();
      manager.beginTransaction(); // Nested

      const tuple1 = new Tuple([new ID('1'), new StringAtom('Alice')]);
      manager.addDelta('graph1', 'users', new Delta(new Set([tuple1]), new Set()));

      manager.endTransaction(); // End nested
      
      // Should still be in transaction
      const status = manager.getBatchStatus('graph1', 'users');
      expect(status.isDirty).toBe(true);

      manager.endTransaction(); // End outer
    });
  });

  describe('clearing', () => {
    it('should clear batches for specific graph', () => {
      const tuple1 = new Tuple([new ID('1'), new StringAtom('Alice')]);
      const tuple2 = new Tuple([new ID('2'), new StringAtom('Bob')]);

      manager.addDelta('graph1', 'users', new Delta(new Set([tuple1]), new Set()));
      manager.addDelta('graph2', 'users', new Delta(new Set([tuple2]), new Set()));

      manager.clear('graph1');

      const status1 = manager.getBatchStatus('graph1', 'users');
      const status2 = manager.getBatchStatus('graph2', 'users');

      expect(status1.isDirty).toBe(false);
      expect(status2.isDirty).toBe(true);
    });

    it('should clear all batches', () => {
      const tuple1 = new Tuple([new ID('1'), new StringAtom('Alice')]);
      const tuple2 = new Tuple([new ID('2'), new StringAtom('Bob')]);

      manager.addDelta('graph1', 'users', new Delta(new Set([tuple1]), new Set()));
      manager.addDelta('graph2', 'users', new Delta(new Set([tuple2]), new Set()));

      manager.clear();

      const status1 = manager.getBatchStatus('graph1', 'users');
      const status2 = manager.getBatchStatus('graph2', 'users');

      expect(status1.isDirty).toBe(false);
      expect(status2.isDirty).toBe(false);
    });
  });

  describe('statistics', () => {
    it('should track statistics correctly', () => {
      const tuple1 = new Tuple([new ID('1'), new StringAtom('Alice')]);
      const tuple2 = new Tuple([new ID('2'), new StringAtom('Bob')]);

      manager.addDelta('graph1', 'users', new Delta(new Set([tuple1]), new Set()));
      manager.addDelta('graph1', 'users', new Delta(new Set([tuple2]), new Set()));
      
      manager.flush('graph1');

      const stats = manager.getStatistics();
      expect(stats.totalDeltas).toBe(2);
      expect(stats.totalBatches).toBe(1);
      expect(stats.totalFlushes).toBe(1);
      expect(stats.averageBatchSize).toBe(2);
    });

    it('should reset statistics', () => {
      const tuple1 = new Tuple([new ID('1'), new StringAtom('Alice')]);
      manager.addDelta('graph1', 'users', new Delta(new Set([tuple1]), new Set()));
      manager.flush('graph1');

      manager.resetStatistics();

      const stats = manager.getStatistics();
      expect(stats.totalDeltas).toBe(0);
      expect(stats.totalBatches).toBe(0);
      expect(stats.totalFlushes).toBe(0);
    });
  });
});

describe('BatchTransaction', () => {
  let manager, transaction;

  beforeEach(() => {
    manager = new BatchManager({ autoFlush: false });
    transaction = new BatchTransaction(manager);
  });

  afterEach(() => {
    manager.destroy();
  });

  it('should begin and commit transaction', () => {
    transaction.begin();
    expect(() => transaction.begin()).toThrow('Transaction already active');
    
    transaction.commit();
    expect(() => transaction.commit()).toThrow('No active transaction');
  });

  it('should rollback transaction', () => {
    const tuple1 = new Tuple([new ID('1'), new StringAtom('Alice')]);
    
    transaction.begin();
    manager.addDelta('graph1', 'users', new Delta(new Set([tuple1]), new Set()));
    
    transaction.rollback('graph1');

    const status = manager.getBatchStatus('graph1', 'users');
    expect(status.isDirty).toBe(false); // Batch was cleared
  });

  it('should execute function within transaction', async () => {
    const tuple1 = new Tuple([new ID('1'), new StringAtom('Alice')]);
    let executed = false;

    const result = await transaction.execute(async () => {
      manager.addDelta('graph1', 'users', new Delta(new Set([tuple1]), new Set()));
      executed = true;
      return 'success';
    });

    expect(executed).toBe(true);
    expect(result).toBe('success');
  });

  it('should rollback on error', async () => {
    const tuple1 = new Tuple([new ID('1'), new StringAtom('Alice')]);

    try {
      await transaction.execute(async () => {
        manager.addDelta('graph1', 'users', new Delta(new Set([tuple1]), new Set()));
        throw new Error('Test error');
      });
    } catch (error) {
      expect(error.message).toBe('Test error');
    }

    const status = manager.getBatchStatus('graph1', 'users');
    expect(status.isDirty).toBe(false); // Should be rolled back
  });
});