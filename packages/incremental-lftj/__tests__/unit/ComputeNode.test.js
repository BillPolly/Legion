import { ComputeNode } from '../../src/ComputeNode.js';
import { EnumerableProvider, PointwiseProvider } from '../../src/ComputeProvider.js';
import { Delta } from '../../src/Delta.js';
import { Tuple } from '../../src/Tuple.js';
import { ID, StringAtom, Integer } from '../../src/Atom.js';

// Test providers
class TestEnumerableProvider extends EnumerableProvider {
  constructor(id, initialData = []) {
    super(id);
    this._data = new Set(initialData);
    this._changes = [];
  }

  enumerate() {
    return new Set(this._data);
  }

  deltaSince(stateHandle) {
    if (stateHandle >= this._changes.length) {
      return { adds: new Set(), removes: new Set() };
    }

    const adds = new Set();
    const removes = new Set();

    for (let i = stateHandle; i < this._changes.length; i++) {
      const change = this._changes[i];
      if (change.type === 'add') {
        adds.add(change.tuple);
      } else {
        removes.add(change.tuple);
      }
    }

    return { adds, removes };
  }

  // Test helpers
  addTuple(tuple) {
    this._data.add(tuple);
    this._changes.push({ type: 'add', tuple });
  }

  removeTuple(tuple) {
    this._data.delete(tuple);
    this._changes.push({ type: 'remove', tuple });
  }
}

class TestPointwiseProvider extends PointwiseProvider {
  constructor(id, predicate = () => true) {
    super(id);
    this._predicate = predicate;
  }

  evalMany(candidates) {
    const result = new Set();
    for (const tuple of candidates) {
      if (this._predicate(tuple)) {
        result.add(tuple);
      }
    }
    return result;
  }
}

describe('ComputeNode', () => {
  describe('constructor', () => {
    it('should create compute node with enumerable provider', () => {
      const provider = new TestEnumerableProvider('test');
      const node = new ComputeNode('compute1', provider);

      expect(node.id).toBe('compute1');
      expect(node.provider).toBe(provider);
      expect(node.mode).toBe('enumerable');
    });

    it('should create compute node with pointwise provider', () => {
      const provider = new TestPointwiseProvider('test');
      const node = new ComputeNode('compute1', provider);

      expect(node.id).toBe('compute1');
      expect(node.provider).toBe(provider);
      expect(node.mode).toBe('pointwise');
    });

    it('should throw error for invalid provider', () => {
      expect(() => {
        new ComputeNode('compute1', null);
      }).toThrow('Provider must be a valid ComputeProvider instance');

      expect(() => {
        new ComputeNode('compute1', {});
      }).toThrow('Provider must be a valid ComputeProvider instance');
    });

    it('should throw error for unknown provider mode', () => {
      const badProvider = {
        getMode: () => 'unknown',
        getCurrentStateHandle: () => 0
      };

      expect(() => {
        new ComputeNode('compute1', badProvider);
      }).toThrow('Unknown provider mode: unknown');
    });
  });

  describe('enumerable mode', () => {
    let provider, node;

    beforeEach(() => {
      provider = new TestEnumerableProvider('test');
      node = new ComputeNode('compute1', provider);
    });

    describe('cold start', () => {
      it('should perform cold start enumeration', () => {
        const tuple1 = new Tuple([new ID('a'), new StringAtom('foo')]);
        const tuple2 = new Tuple([new ID('b'), new StringAtom('bar')]);
        
        provider._data = new Set([tuple1, tuple2]);

        const delta = node.coldStart();

        expect(delta.adds.size).toBe(2);
        expect(delta.adds.has(tuple1)).toBe(true);
        expect(delta.adds.has(tuple2)).toBe(true);
        expect(delta.removes.size).toBe(0);

        expect(node.getCurrentSet().size).toBe(2);
        expect(node.getCurrentSet().has(tuple1)).toBe(true);
        expect(node.getCurrentSet().has(tuple2)).toBe(true);
      });

      it('should handle empty cold start', () => {
        const delta = node.coldStart();

        expect(delta.adds.size).toBe(0);
        expect(delta.removes.size).toBe(0);
        expect(node.getCurrentSet().size).toBe(0);
      });
    });

    describe('delta processing', () => {
      it('should process provider additions', () => {
        const tuple1 = new Tuple([new ID('a'), new StringAtom('foo')]);
        const tuple2 = new Tuple([new ID('b'), new StringAtom('bar')]);

        provider.addTuple(tuple1);
        provider.addTuple(tuple2);

        const delta = node.processDelta(new Delta(new Set(), new Set()));

        expect(delta.adds.size).toBe(2);
        expect(delta.adds.has(tuple1)).toBe(true);
        expect(delta.adds.has(tuple2)).toBe(true);
        expect(delta.removes.size).toBe(0);

        expect(node.getCurrentSet().size).toBe(2);
      });

      it('should process provider removals', () => {
        const tuple1 = new Tuple([new ID('a'), new StringAtom('foo')]);
        const tuple2 = new Tuple([new ID('b'), new StringAtom('bar')]);

        // Setup initial state
        provider._data = new Set([tuple1, tuple2]);
        node.coldStart();

        // Remove one tuple
        provider.removeTuple(tuple1);

        const delta = node.processDelta(new Delta(new Set(), new Set()));

        expect(delta.removes.size).toBe(1);
        expect(delta.removes.has(tuple1)).toBe(true);
        expect(delta.adds.size).toBe(0);

        expect(node.getCurrentSet().size).toBe(1);
        expect(node.getCurrentSet().has(tuple2)).toBe(true);
      });

      it('should process mixed provider changes', () => {
        const tuple1 = new Tuple([new ID('a'), new StringAtom('foo')]);
        const tuple2 = new Tuple([new ID('b'), new StringAtom('bar')]);
        const tuple3 = new Tuple([new ID('c'), new StringAtom('baz')]);

        // Setup initial state
        provider._data = new Set([tuple1]);
        node.coldStart();

        // Mixed changes
        provider.removeTuple(tuple1);
        provider.addTuple(tuple2);
        provider.addTuple(tuple3);

        const delta = node.processDelta(new Delta(new Set(), new Set()));

        expect(delta.removes.size).toBe(1);
        expect(delta.removes.has(tuple1)).toBe(true);
        expect(delta.adds.size).toBe(2);
        expect(delta.adds.has(tuple2)).toBe(true);
        expect(delta.adds.has(tuple3)).toBe(true);

        expect(node.getCurrentSet().size).toBe(2);
      });

      it('should return empty delta when no provider changes', () => {
        const delta = node.processDelta(new Delta(new Set(), new Set()));

        expect(delta.adds.size).toBe(0);
        expect(delta.removes.size).toBe(0);
      });
    });

    describe('state management', () => {
      it('should track state correctly', () => {
        const state = node.getState();

        expect(state.type).toBe('Compute');
        expect(state.mode).toBe('enumerable');
        expect(state.providerId).toBe('test');
        expect(state.currentSetSize).toBe(0);
        expect(typeof state.lastStateHandle).toBe('number');
      });

      it('should reset state correctly', () => {
        const tuple1 = new Tuple([new ID('a'), new StringAtom('foo')]);
        provider._data = new Set([tuple1]);
        node.coldStart();

        expect(node.getCurrentSet().size).toBe(1);

        node.reset();

        expect(node.getCurrentSet().size).toBe(0);
      });

      it('should throw error for pointwise-only methods', () => {
        expect(() => {
          node.getWatchSet();
        }).toThrow('getWatchSet only available for pointwise mode');

        expect(() => {
          node.getTruthMap();
        }).toThrow('getTruthMap only available for pointwise mode');
      });
    });
  });

  describe('pointwise mode', () => {
    let provider, node;

    beforeEach(() => {
      // Predicate: first atom value starts with 'a'
      const predicate = (tuple) => tuple.atoms[0].value.startsWith('a');
      provider = new TestPointwiseProvider('test', predicate);
      node = new ComputeNode('compute1', provider);
    });

    describe('delta processing', () => {
      it('should process upstream adds and evaluate new candidates', () => {
        const tuple1 = new Tuple([new StringAtom('apple'), new Integer(1)]);
        const tuple2 = new Tuple([new StringAtom('banana'), new Integer(2)]);
        const tuple3 = new Tuple([new StringAtom('avocado'), new Integer(3)]);

        const inputDelta = new Delta(new Set([tuple1, tuple2, tuple3]), new Set());
        const outputDelta = node.processDelta(inputDelta);

        // Should emit adds for tuples that match predicate
        expect(outputDelta.adds.size).toBe(2);
        expect(outputDelta.adds.has(tuple1)).toBe(true);
        expect(outputDelta.adds.has(tuple3)).toBe(true);
        expect(outputDelta.adds.has(tuple2)).toBe(false);
        expect(outputDelta.removes.size).toBe(0);

        // Check internal state
        expect(node.getWatchSet().size).toBe(3);
        expect(node.getTruthMap().size).toBe(3);
        expect(node.getTruthMap().get(tuple1.toBytes().toString())).toBe(true);
        expect(node.getTruthMap().get(tuple2.toBytes().toString())).toBe(false);
        expect(node.getTruthMap().get(tuple3.toBytes().toString())).toBe(true);
      });

      it('should process upstream removes', () => {
        const tuple1 = new Tuple([new StringAtom('apple'), new Integer(1)]);
        const tuple2 = new Tuple([new StringAtom('banana'), new Integer(2)]);

        // First add tuples
        const addDelta = new Delta(new Set([tuple1, tuple2]), new Set());
        node.processDelta(addDelta);

        // Then remove them
        const removeDelta = new Delta(new Set(), new Set([tuple1, tuple2]));
        const outputDelta = node.processDelta(removeDelta);

        // Should emit remove only for tuple that was true
        expect(outputDelta.removes.size).toBe(1);
        expect(outputDelta.removes.has(tuple1)).toBe(true);
        expect(outputDelta.removes.has(tuple2)).toBe(false);
        expect(outputDelta.adds.size).toBe(0);

        // Check internal state
        expect(node.getWatchSet().size).toBe(0);
        expect(node.getTruthMap().size).toBe(0);
      });

      it('should process mixed adds and removes', () => {
        const tuple1 = new Tuple([new StringAtom('apple'), new Integer(1)]);
        const tuple2 = new Tuple([new StringAtom('banana'), new Integer(2)]);
        const tuple3 = new Tuple([new StringAtom('avocado'), new Integer(3)]);

        // First add some tuples
        const addDelta = new Delta(new Set([tuple1, tuple2]), new Set());
        node.processDelta(addDelta);

        // Then mixed operation: remove tuple1, add tuple3
        const mixedDelta = new Delta(new Set([tuple3]), new Set([tuple1]));
        const outputDelta = node.processDelta(mixedDelta);

        // Should emit remove for tuple1 (was true) and add for tuple3 (is true)
        expect(outputDelta.removes.size).toBe(1);
        expect(outputDelta.removes.has(tuple1)).toBe(true);
        expect(outputDelta.adds.size).toBe(1);
        expect(outputDelta.adds.has(tuple3)).toBe(true);

        // Check internal state
        expect(node.getWatchSet().size).toBe(2); // tuple2, tuple3
        expect(node.getTruthMap().size).toBe(2);
      });

      it('should not re-evaluate already known tuples', () => {
        const tuple1 = new Tuple([new StringAtom('apple'), new Integer(1)]);

        // Add tuple first time
        const delta1 = new Delta(new Set([tuple1]), new Set());
        const output1 = node.processDelta(delta1);

        expect(output1.adds.size).toBe(1);
        expect(output1.adds.has(tuple1)).toBe(true);

        // Remove and re-add same tuple
        const delta2 = new Delta(new Set(), new Set([tuple1]));
        node.processDelta(delta2);

        const delta3 = new Delta(new Set([tuple1]), new Set());
        const output3 = node.processDelta(delta3);

        // Should evaluate again since tuple was removed from truth map
        expect(output3.adds.size).toBe(1);
        expect(output3.adds.has(tuple1)).toBe(true);
      });
    });

    describe('state management', () => {
      it('should track state correctly', () => {
        const state = node.getState();

        expect(state.type).toBe('Compute');
        expect(state.mode).toBe('pointwise');
        expect(state.providerId).toBe('test');
        expect(state.watchSetSize).toBe(0);
        expect(state.truthMapSize).toBe(0);
        expect(typeof state.lastStateHandle).toBe('number');
      });

      it('should reset state correctly', () => {
        const tuple1 = new Tuple([new StringAtom('apple'), new Integer(1)]);
        
        const delta = new Delta(new Set([tuple1]), new Set());
        node.processDelta(delta);

        expect(node.getWatchSet().size).toBe(1);
        expect(node.getTruthMap().size).toBe(1);

        node.reset();

        expect(node.getWatchSet().size).toBe(0);
        expect(node.getTruthMap().size).toBe(0);
      });

      it('should throw error for enumerable-only methods', () => {
        expect(() => {
          node.getCurrentSet();
        }).toThrow('getCurrentSet only available for enumerable mode');

        expect(() => {
          node.coldStart();
        }).toThrow('Cold start only supported for enumerable providers');
      });
    });

    describe('onDeltaReceived', () => {
      it('should have onDeltaReceived method for chain participation', () => {
        expect(typeof node.onDeltaReceived).toBe('function');
      });
    });
  });

  describe('toString', () => {
    it('should produce readable string representation', () => {
      const provider = new TestEnumerableProvider('testProv');
      const node = new ComputeNode('compute1', provider);
      
      const str = node.toString();
      expect(str).toBe('Compute(compute1, enumerable, testProv)');
    });
  });
});