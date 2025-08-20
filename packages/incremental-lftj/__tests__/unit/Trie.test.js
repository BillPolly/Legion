import { Trie } from '../../src/Trie.js';
import { Tuple } from '../../src/Tuple.js';
import { Integer, StringAtom, BooleanAtom } from '../../src/Atom.js';

describe('Trie', () => {
  describe('Construction', () => {
    it('should create trie with specified arity', () => {
      const trie = new Trie(3);
      expect(trie.arity).toBe(3);
    });

    it('should validate arity is positive integer', () => {
      expect(() => new Trie(0)).toThrow('Trie arity must be a positive integer');
      expect(() => new Trie(-1)).toThrow('Trie arity must be a positive integer');
      expect(() => new Trie(1.5)).toThrow('Trie arity must be a positive integer');
    });

    it('should initialize empty levels', () => {
      const trie = new Trie(2);
      const state = trie.getState();
      
      expect(state.levels.length).toBe(2);
      expect(state.levels[0].size).toBe(0);
      expect(state.levels[1].size).toBe(0);
    });
  });

  describe('Tuple Insertion', () => {
    it('should insert single tuple into arity-2 trie', () => {
      const trie = new Trie(2);
      const tuple = new Tuple([new Integer(1), new StringAtom('a')]);
      
      trie.insert(tuple);
      
      // Level 0: empty prefix -> {1}
      const level0Atoms = trie.getSortedAtoms(0, new Tuple([]));
      expect(level0Atoms.length).toBe(1);
      expect(level0Atoms[0].equals(new Integer(1))).toBe(true);
      
      // Level 1: prefix (1) -> {a}
      const level1Atoms = trie.getSortedAtoms(1, new Tuple([new Integer(1)]));
      expect(level1Atoms.length).toBe(1);
      expect(level1Atoms[0].equals(new StringAtom('a'))).toBe(true);
    });

    it('should insert multiple tuples with different prefixes', () => {
      const trie = new Trie(3);
      const tuples = [
        new Tuple([new Integer(1), new StringAtom('a'), new BooleanAtom(true)]),
        new Tuple([new Integer(1), new StringAtom('b'), new BooleanAtom(false)]),
        new Tuple([new Integer(2), new StringAtom('c'), new BooleanAtom(true)])
      ];
      
      tuples.forEach(t => trie.insert(t));
      
      // Level 0: empty prefix -> {1, 2}
      const level0Atoms = trie.getSortedAtoms(0, new Tuple([]));
      expect(level0Atoms.length).toBe(2);
      expect(level0Atoms[0].equals(new Integer(1))).toBe(true);
      expect(level0Atoms[1].equals(new Integer(2))).toBe(true);
      
      // Level 1: prefix (1) -> {a, b}
      const level1Atoms = trie.getSortedAtoms(1, new Tuple([new Integer(1)]));
      expect(level1Atoms.length).toBe(2);
      expect(level1Atoms[0].equals(new StringAtom('a'))).toBe(true);
      expect(level1Atoms[1].equals(new StringAtom('b'))).toBe(true);
      
      // Level 1: prefix (2) -> {c}
      const level1AtomsPrefix2 = trie.getSortedAtoms(1, new Tuple([new Integer(2)]));
      expect(level1AtomsPrefix2.length).toBe(1);
      expect(level1AtomsPrefix2[0].equals(new StringAtom('c'))).toBe(true);
    });

    it('should maintain sorted order when inserting', () => {
      const trie = new Trie(2);
      const tuples = [
        new Tuple([new Integer(3), new StringAtom('c')]),
        new Tuple([new Integer(1), new StringAtom('a')]),
        new Tuple([new Integer(2), new StringAtom('b')])
      ];
      
      // Insert in unsorted order
      tuples.forEach(t => trie.insert(t));
      
      // Should be sorted at level 0
      const level0Atoms = trie.getSortedAtoms(0, new Tuple([]));
      expect(level0Atoms.length).toBe(3);
      expect(level0Atoms[0].equals(new Integer(1))).toBe(true);
      expect(level0Atoms[1].equals(new Integer(2))).toBe(true);
      expect(level0Atoms[2].equals(new Integer(3))).toBe(true);
    });

    it('should handle duplicate tuple insertion', () => {
      const trie = new Trie(2);
      const tuple = new Tuple([new Integer(1), new StringAtom('a')]);
      
      trie.insert(tuple);
      trie.insert(tuple); // Duplicate
      
      // Should only have one copy
      const level0Atoms = trie.getSortedAtoms(0, new Tuple([]));
      expect(level0Atoms.length).toBe(1);
      
      const level1Atoms = trie.getSortedAtoms(1, new Tuple([new Integer(1)]));
      expect(level1Atoms.length).toBe(1);
    });

    it('should validate tuple arity matches trie arity', () => {
      const trie = new Trie(2);
      const wrongArityTuple = new Tuple([new Integer(1)]);
      
      expect(() => trie.insert(wrongArityTuple)).toThrow('Tuple arity 1 does not match trie arity 2');
    });
  });

  describe('Tuple Removal', () => {
    it('should remove tuple from trie', () => {
      const trie = new Trie(2);
      const tuple = new Tuple([new Integer(1), new StringAtom('a')]);
      
      trie.insert(tuple);
      trie.remove(tuple);
      
      // Should be empty
      const level0Atoms = trie.getSortedAtoms(0, new Tuple([]));
      expect(level0Atoms.length).toBe(0);
      
      const level1Atoms = trie.getSortedAtoms(1, new Tuple([new Integer(1)]));
      expect(level1Atoms.length).toBe(0);
    });

    it('should remove only specified tuple', () => {
      const trie = new Trie(2);
      const tuple1 = new Tuple([new Integer(1), new StringAtom('a')]);
      const tuple2 = new Tuple([new Integer(1), new StringAtom('b')]);
      
      trie.insert(tuple1);
      trie.insert(tuple2);
      trie.remove(tuple1);
      
      // Level 0 should still have Integer(1)
      const level0Atoms = trie.getSortedAtoms(0, new Tuple([]));
      expect(level0Atoms.length).toBe(1);
      expect(level0Atoms[0].equals(new Integer(1))).toBe(true);
      
      // Level 1 should only have 'b'
      const level1Atoms = trie.getSortedAtoms(1, new Tuple([new Integer(1)]));
      expect(level1Atoms.length).toBe(1);
      expect(level1Atoms[0].equals(new StringAtom('b'))).toBe(true);
    });

    it('should clean up empty prefix entries', () => {
      const trie = new Trie(2);
      const tuple = new Tuple([new Integer(1), new StringAtom('a')]);
      
      trie.insert(tuple);
      trie.remove(tuple);
      
      // Should not have any prefixes
      expect(trie.getPrefixes(0).length).toBe(0);
      expect(trie.getPrefixes(1).length).toBe(0);
    });

    it('should handle removal of non-existent tuple gracefully', () => {
      const trie = new Trie(2);
      const tuple = new Tuple([new Integer(1), new StringAtom('a')]);
      
      expect(() => trie.remove(tuple)).not.toThrow();
      
      // Should still be empty
      const level0Atoms = trie.getSortedAtoms(0, new Tuple([]));
      expect(level0Atoms.length).toBe(0);
    });

    it('should validate tuple arity for removal', () => {
      const trie = new Trie(2);
      const wrongArityTuple = new Tuple([new Integer(1)]);
      
      expect(() => trie.remove(wrongArityTuple)).toThrow('Tuple arity 1 does not match trie arity 2');
    });
  });

  describe('Prefix Operations', () => {
    let trie;
    
    beforeEach(() => {
      // Set up a trie with known data
      trie = new Trie(3);
      const tuples = [
        new Tuple([new Integer(1), new StringAtom('a'), new BooleanAtom(true)]),
        new Tuple([new Integer(1), new StringAtom('a'), new BooleanAtom(false)]),
        new Tuple([new Integer(1), new StringAtom('b'), new BooleanAtom(true)]),
        new Tuple([new Integer(2), new StringAtom('c'), new BooleanAtom(false)])
      ];
      tuples.forEach(t => trie.insert(t));
    });

    it('should check prefix existence', () => {
      expect(trie.hasPrefix(0, new Tuple([]))).toBe(true);
      expect(trie.hasPrefix(1, new Tuple([new Integer(1)]))).toBe(true);
      expect(trie.hasPrefix(1, new Tuple([new Integer(2)]))).toBe(true);
      expect(trie.hasPrefix(1, new Tuple([new Integer(3)]))).toBe(false);
      
      expect(trie.hasPrefix(2, new Tuple([new Integer(1), new StringAtom('a')]))).toBe(true);
      expect(trie.hasPrefix(2, new Tuple([new Integer(1), new StringAtom('z')]))).toBe(false);
    });

    it('should handle out of bounds level checks', () => {
      expect(trie.hasPrefix(-1, new Tuple([]))).toBe(false);
      expect(trie.hasPrefix(3, new Tuple([]))).toBe(false);
    });

    it('should get atoms for specific prefix', () => {
      // Get atoms at level 2 with prefix (1, a)
      const atoms = trie.getSortedAtoms(2, new Tuple([new Integer(1), new StringAtom('a')]));
      expect(atoms.length).toBe(2);
      expect(atoms[0].equals(new BooleanAtom(false))).toBe(true); // false comes before true
      expect(atoms[1].equals(new BooleanAtom(true))).toBe(true);
    });

    it('should return empty array for non-existent prefix', () => {
      const atoms = trie.getSortedAtoms(1, new Tuple([new Integer(999)]));
      expect(atoms).toEqual([]);
    });

    it('should validate level bounds for getSortedAtoms', () => {
      expect(() => trie.getSortedAtoms(-1, new Tuple([]))).toThrow('Level -1 out of bounds');
      expect(() => trie.getSortedAtoms(3, new Tuple([]))).toThrow('Level 3 out of bounds');
    });

    it('should get all prefixes at level', () => {
      const level1Prefixes = trie.getPrefixes(1);
      expect(level1Prefixes.length).toBe(2); // Should have prefixes for (1) and (2)
      
      // Note: prefixes are stored as byte strings, so we check existence rather than exact values
      expect(level1Prefixes.some(p => p.includes('1'))).toBe(true);
      expect(level1Prefixes.some(p => p.includes('2'))).toBe(true);
    });

    it('should validate level bounds for getPrefixes', () => {
      expect(() => trie.getPrefixes(-1)).toThrow('Level -1 out of bounds');
      expect(() => trie.getPrefixes(3)).toThrow('Level 3 out of bounds');
    });
  });

  describe('State Management', () => {
    it('should provide state information', () => {
      const trie = new Trie(2);
      const tuple = new Tuple([new Integer(1), new StringAtom('a')]);
      trie.insert(tuple);
      
      const state = trie.getState();
      expect(state.type).toBe('Trie');
      expect(state.arity).toBe(2);
      expect(state.levels.length).toBe(2);
      expect(state.levels[0].size).toBe(1); // One prefix at level 0
      expect(state.levels[1].size).toBe(1); // One prefix at level 1
    });

    it('should clear all data', () => {
      const trie = new Trie(2);
      const tuple = new Tuple([new Integer(1), new StringAtom('a')]);
      trie.insert(tuple);
      
      trie.clear();
      
      const state = trie.getState();
      expect(state.levels[0].size).toBe(0);
      expect(state.levels[1].size).toBe(0);
      
      const level0Atoms = trie.getSortedAtoms(0, new Tuple([]));
      expect(level0Atoms.length).toBe(0);
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle high arity relations', () => {
      const trie = new Trie(5);
      const tuple = new Tuple([
        new Integer(1),
        new StringAtom('a'),
        new BooleanAtom(true),
        new Integer(2),
        new StringAtom('b')
      ]);
      
      trie.insert(tuple);
      
      // Should be able to query at any level
      expect(trie.getSortedAtoms(0, new Tuple([])).length).toBe(1);
      expect(trie.getSortedAtoms(4, new Tuple([
        new Integer(1),
        new StringAtom('a'),
        new BooleanAtom(true),
        new Integer(2)
      ])).length).toBe(1);
    });

    it('should handle mixed atom types correctly', () => {
      const trie = new Trie(3);
      const tuples = [
        new Tuple([new BooleanAtom(false), new Integer(1), new StringAtom('a')]),
        new Tuple([new BooleanAtom(true), new Integer(2), new StringAtom('b')]),
        new Tuple([new Integer(1), new BooleanAtom(false), new StringAtom('c')])
      ];
      
      tuples.forEach(t => trie.insert(t));
      
      // Should maintain proper ordering (Boolean < Integer < String per §2.2)
      const level0Atoms = trie.getSortedAtoms(0, new Tuple([]));
      expect(level0Atoms.length).toBe(3);
      expect(level0Atoms[0].type).toBe('Boolean'); // false
      expect(level0Atoms[1].type).toBe('Boolean'); // true  
      expect(level0Atoms[2].type).toBe('Integer'); // 1
    });
  });
});

describe('SortedAtomSet', () => {
  // Note: SortedAtomSet is internal to Trie, but we can test it indirectly
  // through Trie operations. These tests ensure the sorted behavior works correctly.
  
  it('should maintain sort order with various atom types', () => {
    const trie = new Trie(1);
    
    // Insert in non-sorted order
    const atoms = [
      new StringAtom('z'),
      new BooleanAtom(true),
      new Integer(5),
      new BooleanAtom(false),
      new Integer(1),
      new StringAtom('a')
    ];
    
    atoms.forEach(atom => {
      trie.insert(new Tuple([atom]));
    });
    
    const sortedAtoms = trie.getSortedAtoms(0, new Tuple([]));
    
    // Should be in order: Boolean(false), Boolean(true), Integer(1), Integer(5), String(a), String(z)
    expect(sortedAtoms.length).toBe(6);
    expect(sortedAtoms[0].equals(new BooleanAtom(false))).toBe(true);
    expect(sortedAtoms[1].equals(new BooleanAtom(true))).toBe(true);
    expect(sortedAtoms[2].equals(new Integer(1))).toBe(true);
    expect(sortedAtoms[3].equals(new Integer(5))).toBe(true);
    expect(sortedAtoms[4].equals(new StringAtom('a'))).toBe(true);
    expect(sortedAtoms[5].equals(new StringAtom('z'))).toBe(true);
  });
});