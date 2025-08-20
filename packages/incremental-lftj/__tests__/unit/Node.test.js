import { Node } from '../../src/Node.js';
import { Delta } from '../../src/Delta.js';
import { Tuple } from '../../src/Tuple.js';
import { Integer, StringAtom } from '../../src/Atom.js';

describe('Node Base Class', () => {
  class TestNode extends Node {
    constructor(id) {
      super(id);
    }

    processDelta(delta) {
      // Echo delta for testing
      return delta;
    }
  }

  describe('Construction', () => {
    it('should create node with ID', () => {
      const node = new TestNode('test1');
      expect(node.id).toBe('test1');
      expect(node.inputs).toEqual([]);
      expect(node.outputs).toEqual([]);
    });

    it('should validate node ID is string', () => {
      expect(() => new TestNode(123)).toThrow('Node ID must be a string');
      expect(() => new TestNode(null)).toThrow('Node ID must be a string');
    });
  });

  describe('Graph Connections', () => {
    it('should add input connections', () => {
      const node1 = new TestNode('node1');
      const node2 = new TestNode('node2');
      const node3 = new TestNode('node3');

      node2.addInput(node1);
      node2.addInput(node3);

      expect(node2.inputs).toEqual([node1, node3]);
      expect(node1.outputs).toEqual([node2]);
      expect(node3.outputs).toEqual([node2]);
    });

    it('should prevent duplicate input connections', () => {
      const node1 = new TestNode('node1');
      const node2 = new TestNode('node2');

      node2.addInput(node1);
      node2.addInput(node1); // Duplicate

      expect(node2.inputs).toEqual([node1]);
      expect(node1.outputs).toEqual([node2]);
    });

    it('should add output connections', () => {
      const node1 = new TestNode('node1');
      const node2 = new TestNode('node2');
      const node3 = new TestNode('node3');

      node1.addOutput(node2);
      node1.addOutput(node3);

      expect(node1.outputs).toEqual([node2, node3]);
      expect(node2.inputs).toEqual([node1]);
      expect(node3.inputs).toEqual([node1]);
    });

    it('should prevent duplicate output connections', () => {
      const node1 = new TestNode('node1');
      const node2 = new TestNode('node2');

      node1.addOutput(node2);
      node1.addOutput(node2); // Duplicate

      expect(node1.outputs).toEqual([node2]);
      expect(node2.inputs).toEqual([node1]);
    });
  });

  describe('Delta Processing', () => {
    it('should process deltas and emit to outputs', () => {
      const node1 = new TestNode('node1');
      const node2 = new TestNode('node2');
      const node3 = new TestNode('node3');

      node1.addOutput(node2);
      node1.addOutput(node3);

      const tuple = new Tuple([new Integer(1), new StringAtom('test')]);
      const delta = new Delta(new Set([tuple]));

      // Capture emissions
      const emissions = [];
      node2.onDeltaReceived = (source, receivedDelta) => {
        emissions.push({ target: 'node2', source: source.id, delta: receivedDelta });
      };
      node3.onDeltaReceived = (source, receivedDelta) => {
        emissions.push({ target: 'node3', source: source.id, delta: receivedDelta });
      };

      node1.pushDelta(delta);

      expect(emissions.length).toBe(2);
      expect(emissions[0].target).toBe('node2');
      expect(emissions[0].source).toBe('node1');
      expect(emissions[1].target).toBe('node3');
      expect(emissions[1].source).toBe('node1');
    });

    it('should handle empty deltas', () => {
      const node = new TestNode('test');
      const emptyDelta = new Delta();
      
      // Should not throw
      expect(() => node.pushDelta(emptyDelta)).not.toThrow();
    });
  });

  describe('State Management', () => {
    it('should support state reset', () => {
      const node = new TestNode('test');
      
      // Should not throw (base implementation is no-op)
      expect(() => node.reset()).not.toThrow();
    });

    it('should support state queries', () => {
      const node = new TestNode('test');
      
      // Base implementation returns empty state
      expect(node.getState()).toEqual({});
    });
  });
});