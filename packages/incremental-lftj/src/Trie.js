import { Tuple } from './Tuple.js';

/**
 * Trie/PFX index implementation per design §9.1
 * Multi-level trie structure for relation indexing
 */
export class Trie {
  constructor(arity) {
    if (!Number.isInteger(arity) || arity < 1) {
      throw new Error('Trie arity must be a positive integer');
    }

    this._arity = arity;
    
    // Maps for each level: Map<Prefix(0..i-1), SortedSet<x_i>>
    // Level 0: Map<"", SortedSet<x_0>>
    // Level 1: Map<Prefix(x_0), SortedSet<x_1>>
    // etc.
    this._levels = [];
    
    for (let i = 0; i < arity; i++) {
      this._levels.push(new Map());
    }
  }

  get arity() {
    return this._arity;
  }

  /**
   * Insert a tuple into the trie
   */
  insert(tuple) {
    if (tuple.arity !== this._arity) {
      throw new Error(`Tuple arity ${tuple.arity} does not match trie arity ${this._arity}`);
    }

    // For each level, update the prefix -> sorted set mapping
    for (let level = 0; level < this._arity; level++) {
      const prefix = this._getTuplePrefix(tuple, level);
      const prefixKey = prefix.toBytes().toString();
      const atom = tuple.get(level);
      
      let sortedSet = this._levels[level].get(prefixKey);
      if (!sortedSet) {
        sortedSet = new SortedAtomSet();
        this._levels[level].set(prefixKey, sortedSet);
      }
      
      sortedSet.add(atom);
    }
  }

  /**
   * Remove a tuple from the trie
   */
  remove(tuple) {
    if (tuple.arity !== this._arity) {
      throw new Error(`Tuple arity ${tuple.arity} does not match trie arity ${this._arity}`);
    }

    // For each level, remove from the prefix -> sorted set mapping
    for (let level = 0; level < this._arity; level++) {
      const prefix = this._getTuplePrefix(tuple, level);
      const prefixKey = prefix.toBytes().toString();
      const atom = tuple.get(level);
      
      const sortedSet = this._levels[level].get(prefixKey);
      if (sortedSet) {
        sortedSet.delete(atom);
        
        // Clean up empty sets
        if (sortedSet.size === 0) {
          this._levels[level].delete(prefixKey);
        }
      }
    }
  }

  /**
   * Get sorted atoms at a specific level with given prefix
   */
  getSortedAtoms(level, prefix) {
    if (level < 0 || level >= this._arity) {
      throw new Error(`Level ${level} out of bounds for trie arity ${this._arity}`);
    }

    const prefixKey = prefix.toBytes().toString();
    const sortedSet = this._levels[level].get(prefixKey);
    return sortedSet ? sortedSet.getAtoms() : [];
  }

  /**
   * Check if a prefix exists at a given level
   */
  hasPrefix(level, prefix) {
    if (level < 0 || level >= this._arity) {
      return false;
    }

    const prefixKey = prefix.toBytes().toString();
    return this._levels[level].has(prefixKey);
  }

  /**
   * Get all prefixes at a given level
   */
  getPrefixes(level) {
    if (level < 0 || level >= this._arity) {
      throw new Error(`Level ${level} out of bounds for trie arity ${this._arity}`);
    }

    return Array.from(this._levels[level].keys());
  }

  /**
   * Get prefix of tuple up to (but not including) given level
   */
  _getTuplePrefix(tuple, level) {
    if (level === 0) {
      // Empty prefix for level 0
      return new Tuple([]);
    }
    
    return tuple.project(Array.from({length: level}, (_, i) => i));
  }

  /**
   * Get state for debugging
   */
  getState() {
    const levelStates = [];
    for (let level = 0; level < this._arity; level++) {
      const levelMap = new Map();
      for (const [prefixKey, sortedSet] of this._levels[level]) {
        levelMap.set(prefixKey, sortedSet.size);
      }
      levelStates.push(levelMap);
    }
    
    return {
      type: 'Trie',
      arity: this._arity,
      levels: levelStates
    };
  }

  /**
   * Clear all data
   */
  clear() {
    for (const level of this._levels) {
      level.clear();
    }
  }

  toString() {
    return `Trie(arity=${this._arity})`;
  }
}

/**
 * Sorted set of atoms with reference counting, maintaining order per §2.2
 */
class SortedAtomSet {
  constructor() {
    this._atoms = [];
    this._counts = new Map(); // atom key -> count
  }

  /**
   * Add an atom maintaining sorted order
   */
  add(atom) {
    const key = atom.toBytes().toString();
    const currentCount = this._counts.get(key) || 0;
    
    if (currentCount === 0) {
      // First time adding this atom - insert in sorted order
      let left = 0;
      let right = this._atoms.length;
      
      while (left < right) {
        const mid = Math.floor((left + right) / 2);
        const cmp = atom.compareTo(this._atoms[mid]);
        
        if (cmp < 0) {
          right = mid;
        } else {
          left = mid + 1;
        }
      }
      
      this._atoms.splice(left, 0, atom);
    }
    
    this._counts.set(key, currentCount + 1);
  }

  /**
   * Remove an atom
   */
  delete(atom) {
    const key = atom.toBytes().toString();
    const currentCount = this._counts.get(key) || 0;
    
    if (currentCount > 0) {
      const newCount = currentCount - 1;
      
      if (newCount === 0) {
        // Remove from sorted list
        const index = this._findIndex(atom);
        if (index !== -1) {
          this._atoms.splice(index, 1);
        }
        this._counts.delete(key);
      } else {
        this._counts.set(key, newCount);
      }
    }
  }

  /**
   * Check if atom exists
   */
  has(atom) {
    const key = atom.toBytes().toString();
    return (this._counts.get(key) || 0) > 0;
  }

  /**
   * Get number of unique atoms
   */
  get size() {
    return this._atoms.length;
  }

  /**
   * Get all atoms in sorted order
   */
  getAtoms() {
    return [...this._atoms];
  }

  /**
   * Find index of atom using binary search
   */
  _findIndex(atom) {
    let left = 0;
    let right = this._atoms.length - 1;
    
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const cmp = atom.compareTo(this._atoms[mid]);
      
      if (cmp === 0) {
        return mid;
      } else if (cmp < 0) {
        right = mid - 1;
      } else {
        left = mid + 1;
      }
    }
    
    return -1;
  }
}