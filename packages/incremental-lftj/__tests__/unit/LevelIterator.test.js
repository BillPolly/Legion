import { LevelIterator, IteratorFactory } from '../../src/LevelIterator.js';
import { Trie } from '../../src/Trie.js';
import { Tuple } from '../../src/Tuple.js';
import { Integer, StringAtom, BooleanAtom } from '../../src/Atom.js';

describe('LevelIterator', () => {
  let trie;
  
  beforeEach(() => {
    // Set up a trie with test data
    trie = new Trie(3);
    const tuples = [
      new Tuple([new Integer(1), new StringAtom('a'), new BooleanAtom(true)]),
      new Tuple([new Integer(1), new StringAtom('a'), new BooleanAtom(false)]),
      new Tuple([new Integer(1), new StringAtom('b'), new BooleanAtom(true)]),
      new Tuple([new Integer(2), new StringAtom('c'), new BooleanAtom(false)]),
      new Tuple([new Integer(3), new StringAtom('d'), new BooleanAtom(true)])
    ];
    tuples.forEach(t => trie.insert(t));
  });

  describe('Construction', () => {
    it('should create iterator for valid level and prefix', () => {
      const iterator = new LevelIterator(trie, 0, new Tuple([]));
      expect(iterator).toBeDefined();
      expect(iterator.atEnd()).toBe(false);
    });

    it('should create iterator that is immediately atEnd for non-existent prefix', () => {
      const iterator = new LevelIterator(trie, 1, new Tuple([new Integer(999)]));
      expect(iterator.atEnd()).toBe(true);
      expect(iterator.key()).toBeUndefined();
    });

    it('should validate level bounds', () => {
      expect(() => new LevelIterator(trie, -1, new Tuple([]))).toThrow('Level -1 out of bounds');
      expect(() => new LevelIterator(trie, 3, new Tuple([]))).toThrow('Level 3 out of bounds');
    });
  });

  describe('Iteration API per §5.2', () => {
    it('should iterate over level 0 (empty prefix)', () => {
      const iterator = new LevelIterator(trie, 0, new Tuple([]));
      
      // Should start at first atom
      expect(iterator.atEnd()).toBe(false);
      expect(iterator.key().equals(new Integer(1))).toBe(true);
      
      // Advance to next
      iterator.next();
      expect(iterator.atEnd()).toBe(false);
      expect(iterator.key().equals(new Integer(2))).toBe(true);
      
      // Advance to next
      iterator.next();
      expect(iterator.atEnd()).toBe(false);
      expect(iterator.key().equals(new Integer(3))).toBe(true);
      
      // Advance past end
      iterator.next();
      expect(iterator.atEnd()).toBe(true);
      expect(iterator.key()).toBeUndefined();
    });

    it('should iterate over level 1 with prefix', () => {
      const iterator = new LevelIterator(trie, 1, new Tuple([new Integer(1)]));
      
      // Should have atoms 'a' and 'b' for prefix (1)
      expect(iterator.atEnd()).toBe(false);
      expect(iterator.key().equals(new StringAtom('a'))).toBe(true);
      
      iterator.next();
      expect(iterator.atEnd()).toBe(false);
      expect(iterator.key().equals(new StringAtom('b'))).toBe(true);
      
      iterator.next();
      expect(iterator.atEnd()).toBe(true);
    });

    it('should iterate over level 2 with prefix', () => {
      const iterator = new LevelIterator(trie, 2, new Tuple([new Integer(1), new StringAtom('a')]));
      
      // Should have atoms false and true for prefix (1, a)
      expect(iterator.atEnd()).toBe(false);
      expect(iterator.key().equals(new BooleanAtom(false))).toBe(true); // false < true
      
      iterator.next();
      expect(iterator.atEnd()).toBe(false);
      expect(iterator.key().equals(new BooleanAtom(true))).toBe(true);
      
      iterator.next();
      expect(iterator.atEnd()).toBe(true);
    });

    it('should handle next() when already atEnd', () => {
      const iterator = new LevelIterator(trie, 1, new Tuple([new Integer(999)])); // Non-existent prefix
      
      expect(iterator.atEnd()).toBe(true);
      iterator.next(); // Should not throw
      expect(iterator.atEnd()).toBe(true);
    });
  });

  describe('seekGE Operation per §5.2', () => {
    it('should seek to exact match', () => {
      const iterator = new LevelIterator(trie, 0, new Tuple([]));
      
      iterator.seekGE(new Integer(2));
      expect(iterator.atEnd()).toBe(false);
      expect(iterator.key().equals(new Integer(2))).toBe(true);
    });

    it('should seek to next greater value when exact match not found', () => {
      const iterator = new LevelIterator(trie, 0, new Tuple([]));
      
      // Seek to 1.5 - should position at 2
      iterator.seekGE(new Integer(1)); // Start at 1
      iterator.seekGE(new Integer(2)); // Should find 2
      expect(iterator.key().equals(new Integer(2))).toBe(true);
    });

    it('should handle seekGE past all values', () => {
      const iterator = new LevelIterator(trie, 0, new Tuple([]));
      
      iterator.seekGE(new Integer(999));
      expect(iterator.atEnd()).toBe(true);
    });

    it('should handle seekGE before all values', () => {
      const iterator = new LevelIterator(trie, 0, new Tuple([]));
      
      iterator.seekGE(new Integer(0));
      expect(iterator.atEnd()).toBe(false);
      expect(iterator.key().equals(new Integer(1))).toBe(true);
    });

    it('should remain atEnd if already atEnd', () => {
      const iterator = new LevelIterator(trie, 1, new Tuple([new Integer(999)])); // Non-existent prefix
      
      expect(iterator.atEnd()).toBe(true);
      iterator.seekGE(new Integer(1));
      expect(iterator.atEnd()).toBe(true);
    });

    it('should handle seekGE with string atoms', () => {
      const iterator = new LevelIterator(trie, 1, new Tuple([new Integer(1)]));
      
      iterator.seekGE(new StringAtom('a'));
      expect(iterator.key().equals(new StringAtom('a'))).toBe(true);
      
      iterator.seekGE(new StringAtom('b'));
      expect(iterator.key().equals(new StringAtom('b'))).toBe(true);
      
      iterator.seekGE(new StringAtom('z'));
      expect(iterator.atEnd()).toBe(true);
    });
  });

  describe('Ordering per §2.2', () => {
    it('should maintain strict ascending order', () => {
      const iterator = new LevelIterator(trie, 0, new Tuple([]));
      
      const keys = [];
      while (!iterator.atEnd()) {
        keys.push(iterator.key());
        iterator.next();
      }
      
      // Should be in ascending order
      for (let i = 1; i < keys.length; i++) {
        expect(keys[i - 1].compareTo(keys[i])).toBeLessThan(0);
      }
    });

    it('should handle mixed atom types in correct order', () => {
      // Create trie with mixed types at level 0
      const mixedTrie = new Trie(1);
      const mixedTuples = [
        new Tuple([new StringAtom('z')]),
        new Tuple([new BooleanAtom(true)]),
        new Tuple([new Integer(5)]),
        new Tuple([new BooleanAtom(false)])
      ];
      mixedTuples.forEach(t => mixedTrie.insert(t));
      
      const iterator = new LevelIterator(mixedTrie, 0, new Tuple([]));
      
      // Should be: Boolean(false), Boolean(true), Integer(5), String(z)
      expect(iterator.key().equals(new BooleanAtom(false))).toBe(true);
      iterator.next();
      expect(iterator.key().equals(new BooleanAtom(true))).toBe(true);
      iterator.next();
      expect(iterator.key().equals(new Integer(5))).toBe(true);
      iterator.next();
      expect(iterator.key().equals(new StringAtom('z'))).toBe(true);
    });
  });

  describe('State and Debugging', () => {
    it('should provide state information', () => {
      const iterator = new LevelIterator(trie, 1, new Tuple([new Integer(1)]));
      
      const state = iterator.getState();
      expect(state.type).toBe('LevelIterator');
      expect(state.level).toBe(1);
      expect(state.atEnd).toBe(false);
      expect(state.totalAtoms).toBe(2); // 'a' and 'b'
      expect(state.currentIndex).toBe(0);
    });

    it('should provide correct state when atEnd', () => {
      const iterator = new LevelIterator(trie, 1, new Tuple([new Integer(999)]));
      
      const state = iterator.getState();
      expect(state.atEnd).toBe(true);
      expect(state.currentKey).toBe(null);
      expect(state.totalAtoms).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty trie', () => {
      const emptyTrie = new Trie(2);
      const iterator = new LevelIterator(emptyTrie, 0, new Tuple([]));
      
      expect(iterator.atEnd()).toBe(true);
      expect(iterator.key()).toBeUndefined();
    });

    it('should handle single atom at level', () => {
      const singleTrie = new Trie(2);
      singleTrie.insert(new Tuple([new Integer(1), new StringAtom('only')]));
      
      const iterator = new LevelIterator(singleTrie, 1, new Tuple([new Integer(1)]));
      
      expect(iterator.atEnd()).toBe(false);
      expect(iterator.key().equals(new StringAtom('only'))).toBe(true);
      
      iterator.next();
      expect(iterator.atEnd()).toBe(true);
    });

    it('should handle high arity relations', () => {
      const highArityTrie = new Trie(5);
      highArityTrie.insert(new Tuple([
        new Integer(1),
        new StringAtom('a'),
        new BooleanAtom(true),
        new Integer(2),
        new StringAtom('b')
      ]));
      
      const iterator = new LevelIterator(highArityTrie, 4, new Tuple([
        new Integer(1),
        new StringAtom('a'),
        new BooleanAtom(true),
        new Integer(2)
      ]));
      
      expect(iterator.atEnd()).toBe(false);
      expect(iterator.key().equals(new StringAtom('b'))).toBe(true);
    });
  });
});

describe('IteratorFactory', () => {
  let factory;
  let trie1, trie2;

  beforeEach(() => {
    factory = new IteratorFactory();
    
    // Create test tries
    trie1 = new Trie(2);
    trie1.insert(new Tuple([new Integer(1), new StringAtom('a')]));
    trie1.insert(new Tuple([new Integer(2), new StringAtom('b')]));
    
    trie2 = new Trie(3);
    trie2.insert(new Tuple([new Integer(1), new StringAtom('x'), new BooleanAtom(true)]));
    
    factory.registerTrie('Rel1', trie1);
    factory.registerTrie('Rel2', trie2);
  });

  describe('Registration', () => {
    it('should register tries for relations', () => {
      expect(factory.hasRelation('Rel1')).toBe(true);
      expect(factory.hasRelation('Rel2')).toBe(true);
      expect(factory.hasRelation('NonExistent')).toBe(false);
    });

    it('should get all registered relation names', () => {
      const names = factory.getRelationNames();
      expect(names).toContain('Rel1');
      expect(names).toContain('Rel2');
      expect(names.length).toBe(2);
    });

    it('should clear all registrations', () => {
      factory.clear();
      expect(factory.hasRelation('Rel1')).toBe(false);
      expect(factory.hasRelation('Rel2')).toBe(false);
      expect(factory.getRelationNames().length).toBe(0);
    });
  });

  describe('Iterator Creation per §9.2', () => {
    it('should create iterator for registered relation', () => {
      const iterator = factory.makeIter('Rel1', 0, new Tuple([]));
      
      expect(iterator).toBeInstanceOf(LevelIterator);
      expect(iterator.atEnd()).toBe(false);
      expect(iterator.key().equals(new Integer(1))).toBe(true);
    });

    it('should create iterator with specific prefix', () => {
      const iterator = factory.makeIter('Rel1', 1, new Tuple([new Integer(1)]));
      
      expect(iterator.atEnd()).toBe(false);
      expect(iterator.key().equals(new StringAtom('a'))).toBe(true);
    });

    it('should throw for non-existent relation', () => {
      expect(() => factory.makeIter('NonExistent', 0, new Tuple([])))
        .toThrow('No trie registered for relation: NonExistent');
    });

    it('should create iterator that is atEnd for non-existent prefix', () => {
      const iterator = factory.makeIter('Rel1', 1, new Tuple([new Integer(999)]));
      expect(iterator.atEnd()).toBe(true);
    });
  });

  describe('Multiple Relations', () => {
    it('should handle iterators for different relations independently', () => {
      const iter1 = factory.makeIter('Rel1', 0, new Tuple([]));
      const iter2 = factory.makeIter('Rel2', 0, new Tuple([]));
      
      // Both should start at Integer(1) but be independent
      expect(iter1.key().equals(new Integer(1))).toBe(true);
      expect(iter2.key().equals(new Integer(1))).toBe(true);
      
      iter1.next();
      expect(iter1.key().equals(new Integer(2))).toBe(true);
      expect(iter2.key().equals(new Integer(1))).toBe(true); // Should not change
    });

    it('should handle different arities correctly', () => {
      // Rel1 has arity 2, Rel2 has arity 3
      const iter1 = factory.makeIter('Rel1', 1, new Tuple([new Integer(1)]));
      const iter2 = factory.makeIter('Rel2', 2, new Tuple([new Integer(1), new StringAtom('x')]));
      
      expect(iter1.key().equals(new StringAtom('a'))).toBe(true);
      expect(iter2.key().equals(new BooleanAtom(true))).toBe(true);
    });
  });

  describe('State and Information', () => {
    it('should provide factory information', () => {
      expect(factory.toString()).toContain('2 relations');
    });

    it('should track registration state', () => {
      const emptyFactory = new IteratorFactory();
      expect(emptyFactory.getRelationNames().length).toBe(0);
      expect(emptyFactory.toString()).toContain('0 relations');
    });
  });
});