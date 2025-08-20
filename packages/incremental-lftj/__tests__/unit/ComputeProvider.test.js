import { ComputeProvider, EnumerableProvider, PointwiseProvider } from '../../src/ComputeProvider.js';
import { Tuple } from '../../src/Tuple.js';
import { ID, StringAtom, Integer } from '../../src/Atom.js';

describe('ComputeProvider', () => {
  describe('abstract base class', () => {
    it('should not be instantiable', () => {
      expect(() => {
        new ComputeProvider('test');
      }).toThrow('ComputeProvider is abstract and cannot be instantiated');
    });

    it('should require string ID', () => {
      class TestProvider extends ComputeProvider {
        getMode() { return 'test'; }
      }

      expect(() => {
        new TestProvider(123);
      }).toThrow('Provider ID must be a string');
    });

    it('should require subclass to implement getMode', () => {
      class TestProvider extends ComputeProvider {}
      const provider = new TestProvider('test');

      expect(() => {
        provider.getMode();
      }).toThrow('Subclass must implement getMode()');
    });
  });
});

describe('EnumerableProvider', () => {
  class TestEnumerableProvider extends EnumerableProvider {
    constructor(id, data = []) {
      super(id);
      this._data = new Set(data);
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

    // Test helper methods
    addTuple(tuple) {
      this._data.add(tuple);
      this._changes.push({ type: 'add', tuple });
    }

    removeTuple(tuple) {
      this._data.delete(tuple);
      this._changes.push({ type: 'remove', tuple });
    }
  }

  describe('basic functionality', () => {
    it('should create enumerable provider with ID', () => {
      const provider = new TestEnumerableProvider('test');

      expect(provider.id).toBe('test');
      expect(provider.getMode()).toBe('enumerable');
    });

    it('should start with state handle 0', () => {
      const provider = new TestEnumerableProvider('test');

      expect(provider.getCurrentStateHandle()).toBe(0);
    });

    it('should advance state handle', () => {
      const provider = new TestEnumerableProvider('test');

      provider._advanceState();
      expect(provider.getCurrentStateHandle()).toBe(1);

      provider._advanceState();
      expect(provider.getCurrentStateHandle()).toBe(2);
    });
  });

  describe('enumeration', () => {
    it('should enumerate all current tuples', () => {
      const tuple1 = new Tuple([new ID('a'), new StringAtom('foo')]);
      const tuple2 = new Tuple([new ID('b'), new StringAtom('bar')]);
      
      const provider = new TestEnumerableProvider('test', [tuple1, tuple2]);
      const result = provider.enumerate();

      expect(result.size).toBe(2);
      expect(result.has(tuple1)).toBe(true);
      expect(result.has(tuple2)).toBe(true);
    });

    it('should return empty set for empty provider', () => {
      const provider = new TestEnumerableProvider('test');
      const result = provider.enumerate();

      expect(result.size).toBe(0);
    });
  });

  describe('delta tracking', () => {
    it('should return empty delta when no changes', () => {
      const provider = new TestEnumerableProvider('test');
      const delta = provider.deltaSince(0);

      expect(delta.adds.size).toBe(0);
      expect(delta.removes.size).toBe(0);
    });

    it('should track additions', () => {
      const provider = new TestEnumerableProvider('test');
      const tuple1 = new Tuple([new ID('a'), new StringAtom('foo')]);
      const tuple2 = new Tuple([new ID('b'), new StringAtom('bar')]);

      provider.addTuple(tuple1);
      provider.addTuple(tuple2);

      const delta = provider.deltaSince(0);
      expect(delta.adds.size).toBe(2);
      expect(delta.adds.has(tuple1)).toBe(true);
      expect(delta.adds.has(tuple2)).toBe(true);
      expect(delta.removes.size).toBe(0);
    });

    it('should track removals', () => {
      const tuple1 = new Tuple([new ID('a'), new StringAtom('foo')]);
      const tuple2 = new Tuple([new ID('b'), new StringAtom('bar')]);
      
      const provider = new TestEnumerableProvider('test', [tuple1, tuple2]);

      provider.removeTuple(tuple1);
      const delta = provider.deltaSince(0);

      expect(delta.removes.size).toBe(1);
      expect(delta.removes.has(tuple1)).toBe(true);
      expect(delta.adds.size).toBe(0);
    });

    it('should track mixed operations', () => {
      const tuple1 = new Tuple([new ID('a'), new StringAtom('foo')]);
      const tuple2 = new Tuple([new ID('b'), new StringAtom('bar')]);
      const tuple3 = new Tuple([new ID('c'), new StringAtom('baz')]);
      
      const provider = new TestEnumerableProvider('test', [tuple1]);

      provider.removeTuple(tuple1);
      provider.addTuple(tuple2);
      provider.addTuple(tuple3);

      const delta = provider.deltaSince(0);

      expect(delta.removes.size).toBe(1);
      expect(delta.removes.has(tuple1)).toBe(true);
      expect(delta.adds.size).toBe(2);
      expect(delta.adds.has(tuple2)).toBe(true);
      expect(delta.adds.has(tuple3)).toBe(true);
    });

    it('should support incremental delta queries', () => {
      const provider = new TestEnumerableProvider('test');
      const tuple1 = new Tuple([new ID('a'), new StringAtom('foo')]);
      const tuple2 = new Tuple([new ID('b'), new StringAtom('bar')]);

      // First change
      provider.addTuple(tuple1);
      const delta1 = provider.deltaSince(0);
      expect(delta1.adds.size).toBe(1);
      expect(delta1.adds.has(tuple1)).toBe(true);

      // Second change
      provider.addTuple(tuple2);
      const delta2 = provider.deltaSince(1);
      expect(delta2.adds.size).toBe(1);
      expect(delta2.adds.has(tuple2)).toBe(true);
      expect(delta2.adds.has(tuple1)).toBe(false);
    });
  });

  describe('abstract method enforcement', () => {
    class IncompleteProvider extends EnumerableProvider {}

    it('should require enumerate implementation', () => {
      const provider = new IncompleteProvider('test');
      
      expect(() => {
        provider.enumerate();
      }).toThrow('Subclass must implement enumerate()');
    });

    it('should require deltaSince implementation', () => {
      const provider = new IncompleteProvider('test');
      
      expect(() => {
        provider.deltaSince(0);
      }).toThrow('Subclass must implement deltaSince()');
    });
  });
});

describe('PointwiseProvider', () => {
  class TestPointwiseProvider extends PointwiseProvider {
    constructor(id, predicate = () => true) {
      super(id);
      this._predicate = predicate;
      this._flipHistory = [];
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

    // Optional flip support for testing
    flipsSince(stateHandle, watched) {
      if (stateHandle >= this._flipHistory.length) {
        return { true: new Set(), false: new Set() };
      }

      const trueFlips = new Set();
      const falseFlips = new Set();

      for (let i = stateHandle; i < this._flipHistory.length; i++) {
        const flip = this._flipHistory[i];
        if (flip.newValue) {
          trueFlips.add(flip.tuple);
        } else {
          falseFlips.add(flip.tuple);
        }
      }

      return { true: trueFlips, false: falseFlips };
    }

    // Test helper
    addFlip(tuple, newValue) {
      this._flipHistory.push({ tuple, newValue });
    }
  }

  describe('basic functionality', () => {
    it('should create pointwise provider with ID', () => {
      const provider = new TestPointwiseProvider('test');

      expect(provider.id).toBe('test');
      expect(provider.getMode()).toBe('pointwise');
    });

    it('should start with state handle 0', () => {
      const provider = new TestPointwiseProvider('test');

      expect(provider.getCurrentStateHandle()).toBe(0);
    });

    it('should advance state handle', () => {
      const provider = new TestPointwiseProvider('test');

      provider._advanceState();
      expect(provider.getCurrentStateHandle()).toBe(1);
    });
  });

  describe('evaluation', () => {
    it('should evaluate candidates with predicate', () => {
      // Predicate: first atom value starts with 'a'
      const predicate = (tuple) => tuple.atoms[0].value.startsWith('a');
      const provider = new TestPointwiseProvider('test', predicate);

      const tuple1 = new Tuple([new StringAtom('apple'), new Integer(1)]);
      const tuple2 = new Tuple([new StringAtom('banana'), new Integer(2)]);
      const tuple3 = new Tuple([new StringAtom('avocado'), new Integer(3)]);

      const candidates = new Set([tuple1, tuple2, tuple3]);
      const result = provider.evalMany(candidates);

      expect(result.size).toBe(2);
      expect(result.has(tuple1)).toBe(true);
      expect(result.has(tuple3)).toBe(true);
      expect(result.has(tuple2)).toBe(false);
    });

    it('should return empty set when no candidates match', () => {
      const predicate = () => false;
      const provider = new TestPointwiseProvider('test', predicate);

      const tuple1 = new Tuple([new StringAtom('test'), new Integer(1)]);
      const candidates = new Set([tuple1]);
      const result = provider.evalMany(candidates);

      expect(result.size).toBe(0);
    });

    it('should return all candidates when all match', () => {
      const predicate = () => true;
      const provider = new TestPointwiseProvider('test', predicate);

      const tuple1 = new Tuple([new StringAtom('test1'), new Integer(1)]);
      const tuple2 = new Tuple([new StringAtom('test2'), new Integer(2)]);
      
      const candidates = new Set([tuple1, tuple2]);
      const result = provider.evalMany(candidates);

      expect(result.size).toBe(2);
      expect(result.has(tuple1)).toBe(true);
      expect(result.has(tuple2)).toBe(true);
    });
  });

  describe('flip support', () => {
    it('should detect flip support correctly', () => {
      class NoFlipProvider extends PointwiseProvider {
        evalMany() { return new Set(); }
      }

      class WithFlipProvider extends PointwiseProvider {
        evalMany() { return new Set(); }
        flipsSince() { return { true: new Set(), false: new Set() }; }
      }

      const noFlipProvider = new NoFlipProvider('test1');
      const withFlipProvider = new WithFlipProvider('test2');

      expect(noFlipProvider.supportsFlips()).toBe(false);
      expect(withFlipProvider.supportsFlips()).toBe(true);
    });

    it('should return empty flips by default', () => {
      const provider = new TestPointwiseProvider('test');
      // Don't override flipsSince to test default behavior
      provider.flipsSince = PointwiseProvider.prototype.flipsSince;

      const flips = provider.flipsSince(0, new Set());

      expect(flips.true.size).toBe(0);
      expect(flips.false.size).toBe(0);
    });

    it('should track truth flips when supported', () => {
      const provider = new TestPointwiseProvider('test');
      
      const tuple1 = new Tuple([new StringAtom('test1'), new Integer(1)]);
      const tuple2 = new Tuple([new StringAtom('test2'), new Integer(2)]);

      provider.addFlip(tuple1, true);
      provider.addFlip(tuple2, false);

      const flips = provider.flipsSince(0, new Set([tuple1, tuple2]));

      expect(flips.true.size).toBe(1);
      expect(flips.true.has(tuple1)).toBe(true);
      expect(flips.false.size).toBe(1);
      expect(flips.false.has(tuple2)).toBe(true);
    });
  });

  describe('abstract method enforcement', () => {
    class IncompleteProvider extends PointwiseProvider {}

    it('should require evalMany implementation', () => {
      const provider = new IncompleteProvider('test');
      
      expect(() => {
        provider.evalMany(new Set());
      }).toThrow('Subclass must implement evalMany()');
    });
  });
});