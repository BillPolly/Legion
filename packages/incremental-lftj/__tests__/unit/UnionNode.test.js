import { UnionNode } from '../../src/UnionNode.js';
import { ScanNode } from '../../src/ScanNode.js';
import { Delta } from '../../src/Delta.js';
import { Tuple } from '../../src/Tuple.js';
import { Schema } from '../../src/Schema.js';
import { Integer, StringAtom } from '../../src/Atom.js';
import { Node } from '../../src/Node.js';

// Mock node for capturing emissions in tests
class MockOutputNode extends Node {
  constructor(id) {
    super(id);
    this.receivedDeltas = [];
  }

  onDeltaReceived(source, delta) {
    this.receivedDeltas.push({ source, delta });
  }

  processDelta(delta) {
    return delta; // Pass through
  }
}

describe('UnionNode', () => {
  describe('Construction', () => {
    it('should create union node', () => {
      const union = new UnionNode('union1');
      expect(union.id).toBe('union1');
    });
  });

  describe('Delta Processing per §7.2', () => {
    it('should track contribution counts from multiple inputs', () => {
      const schema = new Schema([{ name: 'x', type: 'Integer' }, { name: 'y', type: 'String' }]);
      const union = new UnionNode('union1');
      
      // Create mock input nodes
      const input1 = new ScanNode('input1', 'Rel1', schema);
      const input2 = new ScanNode('input2', 'Rel2', schema);
      
      // Connect inputs to union
      union.addInput(input1);
      union.addInput(input2);

      const tuple1 = new Tuple([new Integer(1), new StringAtom('a')]);
      const tuple2 = new Tuple([new Integer(2), new StringAtom('b')]);
      const tuple3 = new Tuple([new Integer(3), new StringAtom('c')]);

      // Create a mock output node to capture emissions
      const mockOutput = new MockOutputNode('output1');
      union.addOutput(mockOutput);

      // Input1 sends delta
      input1.pushDelta(new Delta(new Set([tuple1, tuple2])));
      
      expect(mockOutput.receivedDeltas.length).toBe(1);
      const delta1 = mockOutput.receivedDeltas[0].delta;
      expect(delta1.adds.size).toBe(2);
      const addedTuples1 = Array.from(delta1.adds);
      expect(addedTuples1.some(t => t.equals(tuple1))).toBe(true);
      expect(addedTuples1.some(t => t.equals(tuple2))).toBe(true);

      // Input2 sends delta with overlapping tuple
      // Note: tuple2 from input2 is same content as tuple2 from input1
      const tuple2_input2 = new Tuple([new Integer(2), new StringAtom('b')]); // Same content
      input2.pushDelta(new Delta(new Set([tuple2_input2, tuple3])));

      expect(mockOutput.receivedDeltas.length).toBe(2);
      const delta2 = mockOutput.receivedDeltas[1].delta;
      
      // Since union counts by content, not instances, tuple2_input2 shouldn't be emitted again
      // Only tuple3 should be emitted as a new addition
      expect(delta2.adds.size).toBe(1);
      const addedTuples2 = Array.from(delta2.adds);
      expect(addedTuples2.some(t => t.equals(tuple3))).toBe(true); // Only tuple3 is new (0→1)
      expect(addedTuples2.some(t => t.equals(tuple2))).toBe(false); // tuple2 already existed (1→2)
    });

    it('should handle removes with contribution counting', () => {
      const schema = new Schema([{ name: 'x', type: 'Integer' }, { name: 'y', type: 'String' }]);
      const union = new UnionNode('union1');
      
      const input1 = new ScanNode('input1', 'Rel1', schema);
      const input2 = new ScanNode('input2', 'Rel2', schema);
      
      union.addInput(input1);
      union.addInput(input2);

      const tuple1 = new Tuple([new Integer(1), new StringAtom('a')]);
      const tuple2 = new Tuple([new Integer(2), new StringAtom('b')]);

      // Create a mock output node to capture emissions
      const mockOutput = new MockOutputNode('output1');
      union.addOutput(mockOutput);

      // Add tuples from two inputs
      input1.pushDelta(new Delta(new Set([tuple1, tuple2])));
      
      const tuple1_input2 = new Tuple([new Integer(1), new StringAtom('a')]); // Same content as tuple1
      input2.pushDelta(new Delta(new Set([tuple1_input2]))); // tuple1 content now has count 2

      // tuple1_input2 should not cause a new emission because count goes 1→2
      expect(mockOutput.receivedDeltas.length).toBe(1);

      // Remove tuple1 from input1
      input1.pushDelta(new Delta(new Set(), new Set([tuple1])));

      // Should not emit remove because tuple1 count goes 2→1, not 1→0  
      // No new emission should occur
      expect(mockOutput.receivedDeltas.length).toBe(1);

      // Remove tuple1 from input2 
      input2.pushDelta(new Delta(new Set(), new Set([tuple1_input2])));

      // Now should emit remove because count goes 1→0
      expect(mockOutput.receivedDeltas.length).toBe(2);
      const delta2 = mockOutput.receivedDeltas[1].delta;
      expect(delta2.removes.size).toBe(1);
      const removedTuples = Array.from(delta2.removes);
      expect(removedTuples.some(t => t.equals(tuple1))).toBe(true);
    });

    it('should handle multiple inputs contributing different tuples', () => {
      const schema = new Schema([{ name: 'x', type: 'Integer' }]);
      const union = new UnionNode('union1');
      
      const input1 = new ScanNode('input1', 'Rel1', schema);
      const input2 = new ScanNode('input2', 'Rel2', schema);
      const input3 = new ScanNode('input3', 'Rel3', schema);
      
      union.addInput(input1);
      union.addInput(input2);
      union.addInput(input3);

      const tuple1 = new Tuple([new Integer(1)]);
      const tuple2 = new Tuple([new Integer(2)]);
      const tuple3 = new Tuple([new Integer(3)]);

      // Create a mock output node to capture emissions
      const mockOutput = new MockOutputNode('output1');
      union.addOutput(mockOutput);

      // Input1 contributes tuple1, tuple2
      input1.pushDelta(new Delta(new Set([tuple1, tuple2])));

      // Input2 contributes tuple2, tuple3 (tuple2 overlaps)
      input2.pushDelta(new Delta(new Set([tuple2, tuple3])));

      // Input3 contributes tuple1 (overlaps with input1)
      input3.pushDelta(new Delta(new Set([tuple1])));

      // Collect all unique adds using equals comparison
      const allAdds = new Set();
      for (const received of mockOutput.receivedDeltas) {
        for (const tuple of received.delta.adds) {
          allAdds.add(tuple);
        }
      }

      // Should have emitted tuple1, tuple2, tuple3 exactly once each
      // Need to check by converting to array and using equals
      const addedTuples = Array.from(allAdds);
      expect(addedTuples.some(t => t.equals(tuple1))).toBe(true);
      expect(addedTuples.some(t => t.equals(tuple2))).toBe(true);
      expect(addedTuples.some(t => t.equals(tuple3))).toBe(true);
    });
  });

  describe('Integration with Graph', () => {
    it('should work with multiple scan inputs', () => {
      const schema = new Schema([{ name: 'x', type: 'Integer' }]);
      
      const scan1 = new ScanNode('scan1', 'Rel1', schema);
      const scan2 = new ScanNode('scan2', 'Rel2', schema);
      const union = new UnionNode('union1');

      // Connect scans to union
      union.addInput(scan1);
      union.addInput(scan2);

      // Create a mock output node to capture emissions
      const mockOutput = new MockOutputNode('output1');
      union.addOutput(mockOutput);

      const tuple1 = new Tuple([new Integer(1)]);
      const tuple2 = new Tuple([new Integer(2)]);
      const tuple3 = new Tuple([new Integer(1)]); // Same content as tuple1

      // scan1 emits tuple1, tuple2
      scan1.pushDelta(new Delta(new Set([tuple1, tuple2])));
      
      expect(mockOutput.receivedDeltas.length).toBe(1);
      const unionOutput1 = mockOutput.receivedDeltas[0].delta;
      expect(unionOutput1.adds.size).toBe(2);
      const outputTuples1 = Array.from(unionOutput1.adds);
      expect(outputTuples1.some(t => t.equals(tuple1))).toBe(true);
      expect(outputTuples1.some(t => t.equals(tuple2))).toBe(true);

      // scan2 emits tuple3 (same value as tuple1)
      scan2.pushDelta(new Delta(new Set([tuple3])));
      
      // Should not emit add for tuple3 because tuple1 already covers it
      // (they have the same value but are different instances)
      expect(mockOutput.receivedDeltas.length).toBe(1); // No new emission
    });

    it('should handle input identification correctly', () => {
      const schema = new Schema([{ name: 'x', type: 'Integer' }]);
      const union = new UnionNode('union1');
      
      const input1 = new ScanNode('input1', 'Rel1', schema);
      const input2 = new ScanNode('input2', 'Rel2', schema);
      
      union.addInput(input1);
      union.addInput(input2);

      expect(union._getInputIndex(input1)).toBe(0);
      expect(union._getInputIndex(input2)).toBe(1);
      
      const unknownInput = new ScanNode('unknown', 'Unknown', schema);
      expect(union._getInputIndex(unknownInput)).toBe(-1);
    });
  });

  describe('State Management', () => {
    it('should track union counts', () => {
      const union = new UnionNode('union1');

      const tuple1 = new Tuple([new Integer(1)]);
      const tuple2 = new Tuple([new Integer(2)]);

      union._processInputDelta(0, new Delta(new Set([tuple1, tuple2])));
      union._processInputDelta(1, new Delta(new Set([tuple1]))); // tuple1 count = 2

      const state = union.getState();
      expect(state.type).toBe('Union');
      expect(state.unionCounts).toBeDefined();
      
      // Check counts
      expect(state.unionCounts.get(tuple1.toBytes().toString())).toBe(2);
      expect(state.unionCounts.get(tuple2.toBytes().toString())).toBe(1);
    });

    it('should reset union counts', () => {
      const union = new UnionNode('union1');

      const tuple = new Tuple([new Integer(1)]);
      union._processInputDelta(0, new Delta(new Set([tuple])));

      expect(union.getState().unionCounts.size).toBe(1);

      union.reset();
      expect(union.getState().unionCounts.size).toBe(0);
    });
  });
});