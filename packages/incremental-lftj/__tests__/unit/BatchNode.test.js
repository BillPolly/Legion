import { BatchNode, wrapWithBatch, BatchController } from '../../src/BatchNode.js';
import { ScanNode } from '../../src/ScanNode.js';
import { ProjectNode } from '../../src/ProjectNode.js';
import { Schema } from '../../src/Schema.js';
import { Delta } from '../../src/Delta.js';
import { Tuple } from '../../src/Tuple.js';
import { ID, StringAtom, Integer } from '../../src/Atom.js';

describe('BatchNode', () => {
  let innerNode, batchNode, schema;

  beforeEach(() => {
    schema = new Schema([
      { name: 'id', type: 'ID' },
      { name: 'name', type: 'String' }
    ]);
    
    innerNode = new ScanNode('test-scan', 'users', schema);
    batchNode = new BatchNode(innerNode, {
      batchSize: 3,
      autoFlush: false
    });
  });

  describe('constructor', () => {
    it('should wrap inner node', () => {
      expect(batchNode.innerNode).toBe(innerNode);
      expect(batchNode.id).toBe('test-scan');
    });

    it('should accept custom options', () => {
      const customBatch = new BatchNode(innerNode, {
        batchSize: 100,
        autoFlush: true
      });
      
      const status = customBatch.getBatchStatus();
      expect(status.batchSize).toBe(100);
    });
  });

  describe('batching mode', () => {
    it('should pass through deltas when not batching', () => {
      const tuple1 = new Tuple([new ID('1'), new StringAtom('Alice')]);
      const delta = new Delta(new Set([tuple1]), new Set());

      let receivedDelta = null;
      const mockOutput = new ScanNode('mock-output', 'output', schema);
      mockOutput.onDeltaReceived = (source, d) => {
        receivedDelta = d;
      };
      innerNode.addOutput(mockOutput);

      batchNode.pushDelta(delta);

      expect(receivedDelta).toBeDefined();
      expect(receivedDelta.adds.size).toBe(1);
    });

    it('should accumulate deltas when batching', () => {
      batchNode.startBatching();

      const tuple1 = new Tuple([new ID('1'), new StringAtom('Alice')]);
      const tuple2 = new Tuple([new ID('2'), new StringAtom('Bob')]);
      const delta1 = new Delta(new Set([tuple1]), new Set());
      const delta2 = new Delta(new Set([tuple2]), new Set());

      let receivedDelta = null;
      const mockOutput = new ScanNode('mock-output', 'output', schema);
      mockOutput.onDeltaReceived = (source, d) => {
        receivedDelta = d;
      };
      innerNode.addOutput(mockOutput);

      batchNode.pushDelta(delta1);
      batchNode.pushDelta(delta2);

      // Should not have received delta yet
      expect(receivedDelta).toBeNull();

      const status = batchNode.getBatchStatus();
      expect(status.isBatching).toBe(true);
      expect(status.size).toBe(2);
    });

    it('should flush accumulated deltas', () => {
      batchNode.startBatching();

      const tuple1 = new Tuple([new ID('1'), new StringAtom('Alice')]);
      const tuple2 = new Tuple([new ID('2'), new StringAtom('Bob')]);
      const delta1 = new Delta(new Set([tuple1]), new Set());
      const delta2 = new Delta(new Set([tuple2]), new Set());

      let receivedDelta = null;
      const mockOutput = new ScanNode('mock-output', 'output', schema);
      mockOutput.onDeltaReceived = (source, d) => {
        receivedDelta = d;
      };
      innerNode.addOutput(mockOutput);

      batchNode.pushDelta(delta1);
      batchNode.pushDelta(delta2);
      batchNode.flush();

      expect(receivedDelta).toBeDefined();
      expect(receivedDelta.adds.size).toBe(2);
    });

    it('should auto-flush when batch size exceeded', () => {
      const autoFlushNode = new BatchNode(innerNode, {
        batchSize: 2,
        autoFlush: true
      });

      autoFlushNode.startBatching();

      let flushCount = 0;
      const mockOutput2 = new ScanNode('mock-output2', 'output', schema);
      mockOutput2.onDeltaReceived = () => {
        flushCount++;
      };
      innerNode.addOutput(mockOutput2);

      const tuple1 = new Tuple([new ID('1'), new StringAtom('Alice')]);
      const tuple2 = new Tuple([new ID('2'), new StringAtom('Bob')]);
      const tuple3 = new Tuple([new ID('3'), new StringAtom('Carol')]);

      autoFlushNode.pushDelta(new Delta(new Set([tuple1]), new Set()));
      autoFlushNode.pushDelta(new Delta(new Set([tuple2]), new Set()));
      
      expect(flushCount).toBe(1); // Auto-flushed

      autoFlushNode.pushDelta(new Delta(new Set([tuple3]), new Set()));
      
      expect(flushCount).toBe(1); // Not flushed yet (only 1 in batch)
    });
  });

  describe('delta cancellation', () => {
    it('should cancel adds with removes in batch', () => {
      batchNode.startBatching();

      const tuple1 = new Tuple([new ID('1'), new StringAtom('Alice')]);
      const addDelta = new Delta(new Set([tuple1]), new Set());
      const removeDelta = new Delta(new Set(), new Set([tuple1]));

      batchNode.pushDelta(addDelta);
      batchNode.pushDelta(removeDelta);

      const status = batchNode.getBatchStatus();
      expect(status.size).toBe(0); // Cancelled out
    });
  });

  describe('onDeltaReceived wrapping', () => {
    it('should wrap onDeltaReceived when present', () => {
      const projectNode = new ProjectNode('test-project', [0]);
      const batchProject = new BatchNode(projectNode, {
        batchSize: 2,
        autoFlush: false
      });

      batchProject.startBatching();

      const tuple1 = new Tuple([new ID('1'), new StringAtom('Alice')]);
      const delta = new Delta(new Set([tuple1]), new Set());

      // Simulate delta coming from upstream
      batchProject.onDeltaReceived(innerNode, delta);

      const status = batchProject.getBatchStatus();
      expect(status.size).toBe(1);
    });
  });

  describe('statistics', () => {
    it('should track statistics', () => {
      batchNode.startBatching();

      const tuple1 = new Tuple([new ID('1'), new StringAtom('Alice')]);
      const tuple2 = new Tuple([new ID('2'), new StringAtom('Bob')]);

      batchNode.pushDelta(new Delta(new Set([tuple1]), new Set()));
      batchNode.pushDelta(new Delta(new Set([tuple2]), new Set()));
      batchNode.flush();

      const stats = batchNode.getStatistics();
      expect(stats.deltasReceived).toBe(2);
      expect(stats.batchesProcessed).toBe(1);
      expect(stats.tuplesProcessed).toBe(2);
    });

    it('should reset statistics', () => {
      batchNode.startBatching();
      
      const tuple1 = new Tuple([new ID('1'), new StringAtom('Alice')]);
      batchNode.pushDelta(new Delta(new Set([tuple1]), new Set()));
      batchNode.flush();

      batchNode.resetStatistics();

      const stats = batchNode.getStatistics();
      expect(stats.deltasReceived).toBe(0);
      expect(stats.batchesProcessed).toBe(0);
      expect(stats.tuplesProcessed).toBe(0);
    });
  });

  describe('proxy methods', () => {
    it('should proxy methods to inner node', () => {
      expect(batchNode.id).toBe(innerNode.id);
      expect(batchNode.inputs).toEqual(innerNode.inputs);
      expect(batchNode.outputs).toEqual(innerNode.outputs);
    });

    it('should proxy getCurrentSet', () => {
      const tuple1 = new Tuple([new ID('1'), new StringAtom('Alice')]);
      innerNode.pushDelta(new Delta(new Set([tuple1]), new Set()));

      const currentSet = batchNode.getCurrentSet();
      expect(currentSet).toBeDefined();
    });

    it('should include batch status in getState', () => {
      batchNode.startBatching();
      
      const state = batchNode.getState();
      expect(state.batch).toBeDefined();
      expect(state.batch.isBatching).toBe(true);
    });
  });
});

describe('wrapWithBatch', () => {
  it('should create BatchNode wrapper', () => {
    const schema = new Schema([
      { name: 'id', type: 'ID' }
    ]);
    const node = new ScanNode('test', 'users', schema);
    
    const wrapped = wrapWithBatch(node, { batchSize: 10 });
    
    expect(wrapped).toBeInstanceOf(BatchNode);
    expect(wrapped.innerNode).toBe(node);
  });
});

describe('BatchController', () => {
  let controller, node1, node2, batchNode1, batchNode2;

  beforeEach(() => {
    const schema = new Schema([
      { name: 'id', type: 'ID' }
    ]);
    
    controller = new BatchController();
    node1 = new ScanNode('scan1', 'users', schema);
    node2 = new ScanNode('scan2', 'orders', schema);
    batchNode1 = new BatchNode(node1, { batchSize: 2 });
    batchNode2 = new BatchNode(node2, { batchSize: 2 });
    
    controller.register(batchNode1);
    controller.register(batchNode2);
  });

  it('should register and manage batch nodes', () => {
    const stats = controller.getStatistics();
    expect(stats.nodeCount).toBe(2);
  });

  it('should start and stop batching on all nodes', () => {
    controller.startBatching();
    
    expect(batchNode1.getBatchStatus().isBatching).toBe(true);
    expect(batchNode2.getBatchStatus().isBatching).toBe(true);
    
    controller.stopBatching();
    
    expect(batchNode1.getBatchStatus().isBatching).toBe(false);
    expect(batchNode2.getBatchStatus().isBatching).toBe(false);
  });

  it('should flush all nodes', () => {
    controller.startBatching();

    const tuple1 = new Tuple([new ID('1'), new StringAtom('Alice')]);
    batchNode1.pushDelta(new Delta(new Set([tuple1]), new Set()));
    batchNode2.pushDelta(new Delta(new Set([tuple1]), new Set()));

    controller.flush();

    const stats = controller.getStatistics();
    expect(stats.totalBatchesProcessed).toBe(2);
  });

  it('should execute function with batching', async () => {
    let executed = false;

    const result = await controller.executeBatched(async () => {
      // Should be batching
      expect(batchNode1.getBatchStatus().isBatching).toBe(true);
      
      const tuple1 = new Tuple([new ID('1'), new StringAtom('Alice')]);
      batchNode1.pushDelta(new Delta(new Set([tuple1]), new Set()));
      
      executed = true;
      return 'success';
    });

    expect(executed).toBe(true);
    expect(result).toBe('success');
    expect(batchNode1.getBatchStatus().isBatching).toBe(false);
  });

  it('should handle errors in executeBatched', async () => {
    try {
      await controller.executeBatched(async () => {
        const tuple1 = new Tuple([new ID('1'), new StringAtom('Alice')]);
        batchNode1.pushDelta(new Delta(new Set([tuple1]), new Set()));
        throw new Error('Test error');
      });
    } catch (error) {
      expect(error.message).toBe('Test error');
    }

    // Should have cleared batches
    expect(batchNode1.getBatchStatus().size).toBe(0);
  });

  it('should aggregate statistics', () => {
    controller.startBatching();

    const tuple1 = new Tuple([new ID('1'), new StringAtom('Alice')]);
    const tuple2 = new Tuple([new ID('2'), new StringAtom('Bob')]);

    batchNode1.pushDelta(new Delta(new Set([tuple1]), new Set()));
    batchNode2.pushDelta(new Delta(new Set([tuple2]), new Set()));

    controller.flush();

    const stats = controller.getStatistics();
    expect(stats.totalDeltasReceived).toBe(2);
    expect(stats.totalBatchesProcessed).toBe(2);
    expect(stats.totalTuplesProcessed).toBe(2);
  });
});