import { ScanNode } from '../../src/ScanNode.js';
import { Delta } from '../../src/Delta.js';
import { Tuple } from '../../src/Tuple.js';
import { Schema } from '../../src/Schema.js';
import { Integer, StringAtom, BooleanAtom } from '../../src/Atom.js';

describe('ScanNode', () => {
  describe('Construction', () => {
    it('should create scan node for relation', () => {
      const schema = new Schema([
        { name: 'id', type: 'Integer' },
        { name: 'name', type: 'String' }
      ]);
      
      const scan = new ScanNode('scanUsers', 'Users', schema);
      expect(scan.id).toBe('scanUsers');
      expect(scan.relationName).toBe('Users');
      expect(scan.schema).toBe(schema);
    });

    it('should validate schema is Schema instance', () => {
      expect(() => new ScanNode('scan1', 'Rel', {})).toThrow('Schema must be a Schema instance');
    });

    it('should validate relation name is string', () => {
      const schema = new Schema([]);
      expect(() => new ScanNode('scan1', 123, schema)).toThrow('Relation name must be a string');
    });

    it('should optionally maintain current set state', () => {
      const schema = new Schema([{ name: 'x', type: 'Integer' }]);
      const scanWithState = new ScanNode('scan1', 'Rel', schema, true);
      const scanWithoutState = new ScanNode('scan2', 'Rel', schema, false);

      expect(scanWithState.maintainsState).toBe(true);
      expect(scanWithoutState.maintainsState).toBe(false);
    });
  });

  describe('Delta Processing per §7.1', () => {
    it('should emit delta as received after normalization', () => {
      const schema = new Schema([
        { name: 'id', type: 'Integer' },
        { name: 'value', type: 'String' }
      ]);
      const scan = new ScanNode('scan1', 'TestRel', schema);

      const tuple1 = new Tuple([new Integer(1), new StringAtom('a')]);
      const tuple2 = new Tuple([new Integer(2), new StringAtom('b')]);
      const inputDelta = new Delta(new Set([tuple1, tuple2]));

      const outputDelta = scan.processDelta(inputDelta);

      expect(outputDelta.adds.size).toBe(2);
      expect(outputDelta.removes.size).toBe(0);
      expect(outputDelta.adds.has(tuple1)).toBe(true);
      expect(outputDelta.adds.has(tuple2)).toBe(true);
    });

    it('should normalize delta before emission', () => {
      const schema = new Schema([{ name: 'x', type: 'Integer' }]);
      const scan = new ScanNode('scan1', 'TestRel', schema);

      const tuple1 = new Tuple([new Integer(1)]);
      const tuple2 = new Tuple([new Integer(2)]);
      
      // Create delta with conflicts
      const inputDelta = new Delta(
        new Set([tuple1, tuple2]),
        new Set([tuple1]) // tuple1 in both adds and removes
      );

      const outputDelta = scan.processDelta(inputDelta);

      // Should normalize: only tuple2 remains
      expect(outputDelta.adds.size).toBe(1);
      expect(outputDelta.removes.size).toBe(0);
      expect(outputDelta.adds.has(tuple2)).toBe(true);
      expect(outputDelta.adds.has(tuple1)).toBe(false);
    });

    it('should handle empty deltas', () => {
      const schema = new Schema([]);
      const scan = new ScanNode('scan1', 'TestRel', schema);

      const emptyDelta = new Delta();
      const outputDelta = scan.processDelta(emptyDelta);

      expect(outputDelta.isEmpty()).toBe(true);
    });
  });

  describe('State Management', () => {
    it('should maintain current set when enabled', () => {
      const schema = new Schema([{ name: 'x', type: 'Integer' }]);
      const scan = new ScanNode('scan1', 'TestRel', schema, true);

      const tuple1 = new Tuple([new Integer(1)]);
      const tuple2 = new Tuple([new Integer(2)]);
      const tuple3 = new Tuple([new Integer(3)]);

      // First delta: add tuples
      const delta1 = new Delta(new Set([tuple1, tuple2]));
      scan.processDelta(delta1);

      let state = scan.getCurrentSet();
      expect(state.size).toBe(2);
      expect(state.has(tuple1)).toBe(true);
      expect(state.has(tuple2)).toBe(true);

      // Second delta: remove tuple1, add tuple3
      const delta2 = new Delta(new Set([tuple3]), new Set([tuple1]));
      scan.processDelta(delta2);

      state = scan.getCurrentSet();
      expect(state.size).toBe(2);
      expect(state.has(tuple1)).toBe(false);
      expect(state.has(tuple2)).toBe(true);
      expect(state.has(tuple3)).toBe(true);
    });

    it('should not maintain state when disabled', () => {
      const schema = new Schema([{ name: 'x', type: 'Integer' }]);
      const scan = new ScanNode('scan1', 'TestRel', schema, false);

      const tuple1 = new Tuple([new Integer(1)]);
      const delta = new Delta(new Set([tuple1]));
      scan.processDelta(delta);

      expect(scan.getCurrentSet()).toBe(null);
    });

    it('should reset state', () => {
      const schema = new Schema([{ name: 'x', type: 'Integer' }]);
      const scan = new ScanNode('scan1', 'TestRel', schema, true);

      const tuple1 = new Tuple([new Integer(1)]);
      const delta = new Delta(new Set([tuple1]));
      scan.processDelta(delta);

      expect(scan.getCurrentSet().size).toBe(1);

      scan.reset();
      expect(scan.getCurrentSet().size).toBe(0);
    });

    it('should provide state information', () => {
      const schema = new Schema([{ name: 'x', type: 'Integer' }]);
      const scan = new ScanNode('scan1', 'TestRel', schema, true);

      const tuple1 = new Tuple([new Integer(1)]);
      const delta = new Delta(new Set([tuple1]));
      scan.processDelta(delta);

      const state = scan.getState();
      expect(state.relationName).toBe('TestRel');
      expect(state.maintainsState).toBe(true);
      expect(state.currentSetSize).toBe(1);
    });
  });

  describe('Integration with Graph', () => {
    it('should work as source node in graph', () => {
      const schema = new Schema([{ name: 'x', type: 'Integer' }]);
      const scan = new ScanNode('scan1', 'TestRel', schema);

      // Create another ScanNode as mock output
      const outputSchema = new Schema([{ name: 'x', type: 'Integer' }]);
      const mockOutput = new ScanNode('output', 'Output', outputSchema);
      
      const emissions = [];
      mockOutput.onDeltaReceived = (source, delta) => {
        emissions.push({ source: source.id, delta });
      };

      scan.addOutput(mockOutput);

      const tuple = new Tuple([new Integer(42)]);
      const delta = new Delta(new Set([tuple]));
      scan.pushDelta(delta);

      expect(emissions.length).toBe(1);
      expect(emissions[0].source).toBe('scan1');
      expect(emissions[0].delta.adds.has(tuple)).toBe(true);
    });
  });
});