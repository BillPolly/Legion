import { DiffNode } from '../../src/DiffNode.js';
import { Delta } from '../../src/Delta.js';
import { Tuple } from '../../src/Tuple.js';
import { Integer, StringAtom, ID } from '../../src/Atom.js';

describe('DiffNode', () => {
  describe('constructor', () => {
    it('should create DiffNode with valid key attributes', () => {
      const diff = new DiffNode('diff1', [0, 1]);

      expect(diff.id).toBe('diff1');
      expect(diff.keyAttributes).toEqual([0, 1]);
    });

    it('should throw error for empty key attributes', () => {
      expect(() => {
        new DiffNode('diff1', []);
      }).toThrow('Key attributes must be a non-empty array');
    });

    it('should throw error for missing key attributes', () => {
      expect(() => {
        new DiffNode('diff1');
      }).toThrow('Key attributes must be a non-empty array');
    });
  });

  describe('input configuration', () => {
    it('should set left and right inputs', () => {
      const diff = new DiffNode('diff1', [0]);
      const leftNode = { id: 'left' };
      const rightNode = { id: 'right' };

      diff.setLeftInput(leftNode);
      diff.setRightInput(rightNode);

      const state = diff.getState();
      expect(state.hasLeftInput).toBe(true);
      expect(state.hasRightInput).toBe(true);
    });

    it('should throw error for missing left input', () => {
      const diff = new DiffNode('diff1', [0]);

      expect(() => {
        diff.setLeftInput(null);
      }).toThrow('Left input node must be provided');
    });

    it('should throw error for missing right input', () => {
      const diff = new DiffNode('diff1', [0]);

      expect(() => {
        diff.setRightInput(null);
      }).toThrow('Right input node must be provided');
    });
  });

  describe('key extraction', () => {
    it('should extract single key attribute', () => {
      const diff = new DiffNode('diff1', [1]);
      const tuple = new Tuple([new ID('a'), new StringAtom('key'), new Integer(42)]);

      const key = diff._extractKey(tuple);

      expect(key.arity).toBe(1);
      expect(key.atoms[0]).toEqual(new StringAtom('key'));
    });

    it('should extract multiple key attributes', () => {
      const diff = new DiffNode('diff1', [0, 2]);
      const tuple = new Tuple([new ID('a'), new StringAtom('middle'), new Integer(42)]);

      const key = diff._extractKey(tuple);

      expect(key.arity).toBe(2);
      expect(key.atoms[0]).toEqual(new ID('a'));
      expect(key.atoms[1]).toEqual(new Integer(42));
    });

    it('should throw error for out of bounds key index', () => {
      const diff = new DiffNode('diff1', [5]);
      const tuple = new Tuple([new ID('a'), new StringAtom('b')]);

      expect(() => {
        diff._extractKey(tuple);
      }).toThrow('Key index 5 out of bounds for tuple with arity 2');
    });
  });

  describe('left delta processing', () => {
    let diff, leftNode, rightNode;

    beforeEach(() => {
      diff = new DiffNode('diff1', [0]); // Key on first attribute
      leftNode = { id: 'left' };
      rightNode = { id: 'right' };
      diff.setLeftInput(leftNode);
      diff.setRightInput(rightNode);
    });

    it('should emit left tuple when no right support exists', () => {
      const leftTuple = new Tuple([new ID('key1'), new StringAtom('data')]);
      const delta = new Delta(new Set([leftTuple]));

      diff._currentSourceNode = leftNode;
      const result = diff.processDelta(delta);

      expect(result.adds.size).toBe(1);
      expect(result.removes.size).toBe(0);
      expect(Array.from(result.adds)[0]).toEqual(leftTuple);
    });

    it('should not emit left tuple when right support exists', () => {
      // First add right tuple to create support
      const rightTuple = new Tuple([new ID('key1'), new StringAtom('blocking')]);
      const rightDelta = new Delta(new Set([rightTuple]));

      diff._currentSourceNode = rightNode;
      diff.processDelta(rightDelta);

      // Then add left tuple - should not be emitted
      const leftTuple = new Tuple([new ID('key1'), new StringAtom('data')]);
      const leftDelta = new Delta(new Set([leftTuple]));

      diff._currentSourceNode = leftNode;
      const result = diff.processDelta(leftDelta);

      expect(result.adds.size).toBe(0);
      expect(result.removes.size).toBe(0);
    });

    it('should emit left remove when no right support exists', () => {
      // First add left tuple
      const leftTuple = new Tuple([new ID('key1'), new StringAtom('data')]);
      const addDelta = new Delta(new Set([leftTuple]));

      diff._currentSourceNode = leftNode;
      diff.processDelta(addDelta);

      // Then remove it
      const removeDelta = new Delta(new Set(), new Set([leftTuple]));
      const result = diff.processDelta(removeDelta);

      expect(result.adds.size).toBe(0);
      expect(result.removes.size).toBe(1);
      expect(Array.from(result.removes)[0]).toEqual(leftTuple);
    });

    it('should not emit left remove when right support exists', () => {
      // Add right support first
      const rightTuple = new Tuple([new ID('key1'), new StringAtom('blocking')]);
      const rightDelta = new Delta(new Set([rightTuple]));

      diff._currentSourceNode = rightNode;
      diff.processDelta(rightDelta);

      // Add then remove left tuple
      const leftTuple = new Tuple([new ID('key1'), new StringAtom('data')]);
      
      diff._currentSourceNode = leftNode;
      diff.processDelta(new Delta(new Set([leftTuple])));
      
      const result = diff.processDelta(new Delta(new Set(), new Set([leftTuple])));

      expect(result.adds.size).toBe(0);
      expect(result.removes.size).toBe(0);
    });
  });

  describe('right delta processing', () => {
    let diff, leftNode, rightNode;

    beforeEach(() => {
      diff = new DiffNode('diff1', [0]);
      leftNode = { id: 'left' };
      rightNode = { id: 'right' };
      diff.setLeftInput(leftNode);
      diff.setRightInput(rightNode);
    });

    it('should emit removes when right support goes 0→1', () => {
      // First add left tuple (will be emitted)
      const leftTuple = new Tuple([new ID('key1'), new StringAtom('data')]);
      const leftDelta = new Delta(new Set([leftTuple]));

      diff._currentSourceNode = leftNode;
      diff.processDelta(leftDelta);

      // Then add right tuple with same key - should remove left tuple
      const rightTuple = new Tuple([new ID('key1'), new StringAtom('blocking')]);
      const rightDelta = new Delta(new Set([rightTuple]));

      diff._currentSourceNode = rightNode;
      const result = diff.processDelta(rightDelta);

      expect(result.adds.size).toBe(0);
      expect(result.removes.size).toBe(1);
      expect(Array.from(result.removes)[0]).toEqual(leftTuple);
    });

    it('should emit adds when right support goes 1→0', () => {
      // Add left tuple and right tuple
      const leftTuple = new Tuple([new ID('key1'), new StringAtom('data')]);
      const rightTuple = new Tuple([new ID('key1'), new StringAtom('blocking')]);

      diff._currentSourceNode = leftNode;
      diff.processDelta(new Delta(new Set([leftTuple])));

      diff._currentSourceNode = rightNode;
      diff.processDelta(new Delta(new Set([rightTuple])));

      // Remove right tuple - should re-emit left tuple
      const result = diff.processDelta(new Delta(new Set(), new Set([rightTuple])));

      expect(result.adds.size).toBe(1);
      expect(result.removes.size).toBe(0);
      expect(Array.from(result.adds)[0]).toEqual(leftTuple);
    });

    it('should not emit when right support goes 2→1', () => {
      // Add two right tuples with same key
      const rightTuple1 = new Tuple([new ID('key1'), new StringAtom('block1')]);
      const rightTuple2 = new Tuple([new ID('key1'), new StringAtom('block2')]);

      diff._currentSourceNode = rightNode;
      diff.processDelta(new Delta(new Set([rightTuple1, rightTuple2])));

      // Remove one right tuple - support goes 2→1, should not emit
      const result = diff.processDelta(new Delta(new Set(), new Set([rightTuple1])));

      expect(result.adds.size).toBe(0);
      expect(result.removes.size).toBe(0);
    });
  });

  describe('complex scenarios', () => {
    let diff, leftNode, rightNode;

    beforeEach(() => {
      diff = new DiffNode('diff1', [0]); // Key on first attribute
      leftNode = { id: 'left' };
      rightNode = { id: 'right' };
      diff.setLeftInput(leftNode);
      diff.setRightInput(rightNode);
    });

    it('should handle multiple left tuples with same key', () => {
      const leftTuple1 = new Tuple([new ID('key1'), new StringAtom('data1')]);
      const leftTuple2 = new Tuple([new ID('key1'), new StringAtom('data2')]);
      const leftDelta = new Delta(new Set([leftTuple1, leftTuple2]));

      diff._currentSourceNode = leftNode;
      const result = diff.processDelta(leftDelta);

      // Both should be emitted (no right support)
      expect(result.adds.size).toBe(2);
      expect(result.removes.size).toBe(0);
    });

    it('should handle mixed operations in single delta', () => {
      // Setup initial state
      const leftTuple1 = new Tuple([new ID('key1'), new StringAtom('data1')]);
      const leftTuple2 = new Tuple([new ID('key2'), new StringAtom('data2')]);
      const leftTuple3 = new Tuple([new ID('key3'), new StringAtom('data3')]);

      diff._currentSourceNode = leftNode;
      diff.processDelta(new Delta(new Set([leftTuple1, leftTuple2, leftTuple3])));

      // Mixed operation: add key4, remove key1, add right support for key2
      const newLeftTuple = new Tuple([new ID('key4'), new StringAtom('data4')]);
      const rightTuple = new Tuple([new ID('key2'), new StringAtom('block')]);

      // Process left changes
      const leftResult = diff.processDelta(new Delta(
        new Set([newLeftTuple]), 
        new Set([leftTuple1])
      ));

      // Process right changes
      diff._currentSourceNode = rightNode;
      const rightResult = diff.processDelta(new Delta(new Set([rightTuple])));

      // Verify results
      expect(leftResult.adds.size).toBe(1); // newLeftTuple added
      expect(leftResult.removes.size).toBe(1); // leftTuple1 removed
      expect(rightResult.removes.size).toBe(1); // leftTuple2 blocked by right
    });

    it('should maintain correct state after complex operations', () => {
      const leftTuple = new Tuple([new ID('key1'), new StringAtom('data')]);
      const rightTuple1 = new Tuple([new ID('key1'), new StringAtom('block1')]);
      const rightTuple2 = new Tuple([new ID('key1'), new StringAtom('block2')]);

      // Add left tuple
      diff._currentSourceNode = leftNode;
      diff.processDelta(new Delta(new Set([leftTuple])));

      // Add two right tuples
      diff._currentSourceNode = rightNode;
      diff.processDelta(new Delta(new Set([rightTuple1, rightTuple2])));

      // Remove one right tuple
      diff.processDelta(new Delta(new Set(), new Set([rightTuple1])));

      // Remove other right tuple - should re-emit left
      const result = diff.processDelta(new Delta(new Set(), new Set([rightTuple2])));

      expect(result.adds.size).toBe(1);
      expect(Array.from(result.adds)[0]).toEqual(leftTuple);

      // Verify state
      const state = diff.getState();
      expect(state.leftTuplesCount).toBe(1);
      expect(state.rightSupportCount).toBe(0);
    });
  });

  describe('multi-attribute keys', () => {
    it('should work with composite keys', () => {
      const diff = new DiffNode('diff1', [0, 1]); // Composite key
      const leftNode = { id: 'left' };
      const rightNode = { id: 'right' };
      diff.setLeftInput(leftNode);
      diff.setRightInput(rightNode);

      const leftTuple = new Tuple([new ID('a'), new StringAtom('b'), new Integer(1)]);
      const rightTuple1 = new Tuple([new ID('a'), new StringAtom('different'), new Integer(2)]);
      const rightTuple2 = new Tuple([new ID('a'), new StringAtom('b'), new Integer(3)]);

      // Add left tuple
      diff._currentSourceNode = leftNode;
      const leftResult = diff.processDelta(new Delta(new Set([leftTuple])));
      expect(leftResult.adds.size).toBe(1); // Should be emitted

      // Add right tuple with different key
      diff._currentSourceNode = rightNode;
      const rightResult1 = diff.processDelta(new Delta(new Set([rightTuple1])));
      expect(rightResult1.removes.size).toBe(0); // Different key, no effect

      // Add right tuple with same key
      const rightResult2 = diff.processDelta(new Delta(new Set([rightTuple2])));
      expect(rightResult2.removes.size).toBe(1); // Same key, should remove left
    });
  });

  describe('error handling', () => {
    it('should throw error for unknown source node', () => {
      const diff = new DiffNode('diff1', [0]);
      const unknownNode = { id: 'unknown' };
      const delta = new Delta(new Set([new Tuple([new ID('test')])]));

      diff._currentSourceNode = unknownNode;

      expect(() => {
        diff.processDelta(delta);
      }).toThrow('Delta must come from either left or right input');
    });
  });

  describe('state management', () => {
    it('should reset state correctly', () => {
      const diff = new DiffNode('diff1', [0]);
      const leftNode = { id: 'left' };
      const rightNode = { id: 'right' };
      diff.setLeftInput(leftNode);
      diff.setRightInput(rightNode);

      // Add some state
      diff._currentSourceNode = leftNode;
      diff.processDelta(new Delta(new Set([new Tuple([new ID('test'), new StringAtom('data')])])));

      diff._currentSourceNode = rightNode;
      diff.processDelta(new Delta(new Set([new Tuple([new ID('test'), new StringAtom('block')])])));

      // Verify state exists
      let state = diff.getState();
      expect(state.leftTuplesCount).toBeGreaterThan(0);

      // Reset and verify clean state
      diff.reset();
      state = diff.getState();
      expect(state.leftTuplesCount).toBe(0);
      expect(state.rightSupportCount).toBe(0);
      expect(state.indexedKeysCount).toBe(0);
    });

    it('should provide correct state information', () => {
      const diff = new DiffNode('diff1', [0, 1]);
      const state = diff.getState();

      expect(state.type).toBe('Diff');
      expect(state.keyAttributes).toEqual([0, 1]);
      expect(state.hasLeftInput).toBe(false);
      expect(state.hasRightInput).toBe(false);
    });
  });

  describe('toString', () => {
    it('should produce readable string representation', () => {
      const diff = new DiffNode('userDiff', [0, 2]);
      
      const str = diff.toString();
      expect(str).toBe('Diff(userDiff, key:[0,2])');
    });
  });

  describe('onDeltaReceived', () => {
    it('should have onDeltaReceived method for chain participation', () => {
      const diff = new DiffNode('diff1', [0]);
      
      expect(typeof diff.onDeltaReceived).toBe('function');
    });
  });
});