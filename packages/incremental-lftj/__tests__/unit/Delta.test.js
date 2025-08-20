import { Delta } from '../../src/Delta.js';
import { Tuple } from '../../src/Tuple.js';
import { Integer, StringAtom, BooleanAtom } from '../../src/Atom.js';

describe('Delta', () => {
  describe('Creation', () => {
    it('should create empty delta', () => {
      const delta = new Delta();
      expect(delta.adds.size).toBe(0);
      expect(delta.removes.size).toBe(0);
      expect(delta.isEmpty()).toBe(true);
    });

    it('should create delta with adds and removes', () => {
      const tuple1 = new Tuple([new Integer(1), new StringAtom('a')]);
      const tuple2 = new Tuple([new Integer(2), new StringAtom('b')]);
      const tuple3 = new Tuple([new Integer(3), new StringAtom('c')]);
      
      const adds = new Set([tuple1, tuple2]);
      const removes = new Set([tuple3]);
      
      const delta = new Delta(adds, removes);
      expect(delta.adds.size).toBe(2);
      expect(delta.removes.size).toBe(1);
      expect(delta.isEmpty()).toBe(false);
    });

    it('should validate adds and removes are Sets', () => {
      expect(() => new Delta([1, 2, 3])).toThrow('Adds must be a Set');
      expect(() => new Delta(new Set(), [1, 2, 3])).toThrow('Removes must be a Set');
    });

    it('should validate all elements are Tuples', () => {
      const tuple = new Tuple([new Integer(1)]);
      expect(() => new Delta(new Set([tuple, 'not a tuple']))).toThrow('All delta elements must be Tuple instances');
      expect(() => new Delta(new Set(), new Set([1, 2]))).toThrow('All delta elements must be Tuple instances');
    });
  });

  describe('Normalization per §6.1', () => {
    it('should deduplicate within adds and removes', () => {
      const tuple1 = new Tuple([new Integer(1), new StringAtom('a')]);
      const tuple2 = new Tuple([new Integer(2), new StringAtom('b')]);
      const tuple3 = new Tuple([new Integer(3), new StringAtom('c')]);
      
      // Test that Sets handle deduplication automatically
      const addsArray = [tuple1, tuple2, tuple2, tuple3]; // tuple2 appears twice
      const adds = new Set(addsArray);
      expect(adds.size).toBe(3); // Set automatically deduplicates
      
      const removesArray = [tuple1, tuple1, tuple3]; // tuple1 appears twice
      const removes = new Set(removesArray);
      expect(removes.size).toBe(2); // Set automatically deduplicates
      
      const delta = new Delta(adds, removes);
      const normalized = delta.normalize();
      
      // tuple1 and tuple3 are in both adds and removes, so they cancel out
      // Only tuple2 remains in adds
      expect(normalized.adds.size).toBe(1);
      expect(normalized.removes.size).toBe(0);
      expect(normalized.adds.has(tuple2)).toBe(true);
    });

    it('should cancel opposites: adds := adds - removes, removes := removes - adds', () => {
      const tuple1 = new Tuple([new Integer(1), new StringAtom('a')]);
      const tuple2 = new Tuple([new Integer(2), new StringAtom('b')]);
      const tuple3 = new Tuple([new Integer(3), new StringAtom('c')]);
      
      const adds = new Set([tuple1, tuple2]);
      const removes = new Set([tuple2, tuple3]);
      
      const delta = new Delta(adds, removes);
      const normalized = delta.normalize();
      
      // tuple2 should be cancelled out
      expect(normalized.adds.has(tuple1)).toBe(true);
      expect(normalized.adds.has(tuple2)).toBe(false);
      expect(normalized.removes.has(tuple2)).toBe(false);
      expect(normalized.removes.has(tuple3)).toBe(true);
      
      expect(normalized.adds.size).toBe(1);
      expect(normalized.removes.size).toBe(1);
    });

    it('should handle complete cancellation', () => {
      const tuple1 = new Tuple([new Integer(1), new StringAtom('a')]);
      const tuple2 = new Tuple([new Integer(2), new StringAtom('b')]);
      
      const adds = new Set([tuple1, tuple2]);
      const removes = new Set([tuple1, tuple2]);
      
      const delta = new Delta(adds, removes);
      const normalized = delta.normalize();
      
      expect(normalized.isEmpty()).toBe(true);
    });

    it('should preserve original delta after normalization', () => {
      const tuple1 = new Tuple([new Integer(1), new StringAtom('a')]);
      const tuple2 = new Tuple([new Integer(2), new StringAtom('b')]);
      
      const adds = new Set([tuple1, tuple2]);
      const removes = new Set([tuple1]);
      
      const delta = new Delta(adds, removes);
      const originalAddsSize = delta.adds.size;
      const originalRemovesSize = delta.removes.size;
      
      const normalized = delta.normalize();
      
      // Original should be unchanged
      expect(delta.adds.size).toBe(originalAddsSize);
      expect(delta.removes.size).toBe(originalRemovesSize);
      expect(delta !== normalized).toBe(true);
    });
  });

  describe('Operations', () => {
    it('should merge deltas correctly', () => {
      const tuple1 = new Tuple([new Integer(1)]);
      const tuple2 = new Tuple([new Integer(2)]);
      const tuple3 = new Tuple([new Integer(3)]);
      const tuple4 = new Tuple([new Integer(4)]);
      
      const delta1 = new Delta(new Set([tuple1, tuple2]), new Set([tuple3]));
      const delta2 = new Delta(new Set([tuple3, tuple4]), new Set([tuple2]));
      
      const merged = delta1.merge(delta2);
      
      // Should combine adds and removes
      expect(merged.adds.has(tuple1)).toBe(true);
      expect(merged.adds.has(tuple2)).toBe(true);
      expect(merged.adds.has(tuple3)).toBe(true);
      expect(merged.adds.has(tuple4)).toBe(true);
      
      expect(merged.removes.has(tuple2)).toBe(true);
      expect(merged.removes.has(tuple3)).toBe(true);
    });

    it('should create delta from adds only', () => {
      const tuple1 = new Tuple([new Integer(1)]);
      const tuple2 = new Tuple([new Integer(2)]);
      
      const delta = Delta.fromAdds(new Set([tuple1, tuple2]));
      
      expect(delta.adds.size).toBe(2);
      expect(delta.removes.size).toBe(0);
      expect(delta.adds.has(tuple1)).toBe(true);
      expect(delta.adds.has(tuple2)).toBe(true);
    });

    it('should create delta from removes only', () => {
      const tuple1 = new Tuple([new Integer(1)]);
      const tuple2 = new Tuple([new Integer(2)]);
      
      const delta = Delta.fromRemoves(new Set([tuple1, tuple2]));
      
      expect(delta.adds.size).toBe(0);
      expect(delta.removes.size).toBe(2);
      expect(delta.removes.has(tuple1)).toBe(true);
      expect(delta.removes.has(tuple2)).toBe(true);
    });

    it('should check if delta is empty', () => {
      const empty1 = new Delta();
      const empty2 = new Delta(new Set(), new Set());
      const nonEmpty = new Delta(new Set([new Tuple([new Integer(1)])]));
      
      expect(empty1.isEmpty()).toBe(true);
      expect(empty2.isEmpty()).toBe(true);
      expect(nonEmpty.isEmpty()).toBe(false);
    });

    it('should get all tuples in delta', () => {
      const tuple1 = new Tuple([new Integer(1)]);
      const tuple2 = new Tuple([new Integer(2)]);
      const tuple3 = new Tuple([new Integer(3)]);
      
      const delta = new Delta(new Set([tuple1, tuple2]), new Set([tuple3]));
      const allTuples = delta.getAllTuples();
      
      expect(allTuples.size).toBe(3);
      expect(allTuples.has(tuple1)).toBe(true);
      expect(allTuples.has(tuple2)).toBe(true);
      expect(allTuples.has(tuple3)).toBe(true);
    });
  });

  describe('Iteration', () => {
    it('should iterate adds and removes separately', () => {
      const tuple1 = new Tuple([new Integer(1)]);
      const tuple2 = new Tuple([new Integer(2)]);
      const tuple3 = new Tuple([new Integer(3)]);
      
      const delta = new Delta(new Set([tuple1, tuple2]), new Set([tuple3]));
      
      const addsList = Array.from(delta.adds);
      const removesList = Array.from(delta.removes);
      
      expect(addsList.length).toBe(2);
      expect(removesList.length).toBe(1);
      expect(addsList.includes(tuple1)).toBe(true);
      expect(addsList.includes(tuple2)).toBe(true);
      expect(removesList.includes(tuple3)).toBe(true);
    });
  });
});