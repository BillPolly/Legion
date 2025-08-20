/**
 * LevelIterator interface per design §5.2
 * Iterates over keys of a specific level under a fixed bound prefix
 */
export class LevelIterator {
  /**
   * Create iterator for a specific level and prefix
   * @param {Trie} trie - The trie to iterate over
   * @param {number} level - The level to iterate 
   * @param {Tuple} boundPrefix - The bound prefix for earlier VO vars
   */
  constructor(trie, level, boundPrefix) {
    if (level < 0 || level >= trie.arity) {
      throw new Error(`Level ${level} out of bounds for trie arity ${trie.arity}`);
    }

    this._trie = trie;
    this._level = level;
    this._boundPrefix = boundPrefix;
    this._atoms = trie.getSortedAtoms(level, boundPrefix);
    this._currentIndex = 0;
    this._atEndFlag = this._atoms.length === 0;
  }

  /**
   * Position to smallest key ≥ key under current prefix
   * If atEnd before call, remains atEnd
   */
  seekGE(key) {
    if (this._atEndFlag) {
      return; // Remain atEnd
    }

    // Handle null key as "seek to beginning"
    if (key === null) {
      this._currentIndex = 0;
      this._atEndFlag = this._atoms.length === 0;
      return;
    }

    // Binary search for first atom >= key
    let left = 0;
    let right = this._atoms.length;
    
    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      const cmp = this._atoms[mid].compareTo(key);
      
      if (cmp >= 0) {
        right = mid;
      } else {
        left = mid + 1;
      }
    }
    
    this._currentIndex = left;
    this._atEndFlag = this._currentIndex >= this._atoms.length;
  }

  /**
   * Returns current key (Atom) for this level
   * Undefined if atEnd()
   */
  key() {
    if (this._atEndFlag) {
      return undefined;
    }
    return this._atoms[this._currentIndex];
  }

  /**
   * Advance to next key; if past last, atEnd() becomes true
   */
  next() {
    if (this._atEndFlag) {
      return;
    }
    
    this._currentIndex++;
    if (this._currentIndex >= this._atoms.length) {
      this._atEndFlag = true;
    }
  }

  /**
   * True iff no more keys under current prefix
   */
  atEnd() {
    return this._atEndFlag;
  }

  /**
   * Get debug information
   */
  getState() {
    return {
      type: 'LevelIterator',
      level: this._level,
      boundPrefix: this._boundPrefix.toString(),
      currentIndex: this._currentIndex,
      totalAtoms: this._atoms.length,
      atEnd: this._atEndFlag,
      currentKey: this.atEnd() ? null : this.key().toString()
    };
  }

  toString() {
    return `LevelIterator(level=${this._level}, prefix=${this._boundPrefix.toString()}, atEnd=${this._atEndFlag})`;
  }
}

/**
 * Iterator factory per design §9.2
 */
export class IteratorFactory {
  constructor() {
    this._tries = new Map(); // relation name -> trie
  }

  /**
   * Register a trie for a relation
   */
  registerTrie(relationName, trie) {
    this._tries.set(relationName, trie);
  }

  /**
   * Create iterator per design: makeIter(A, level i, boundPrefix)
   * @param {string} relationName - Name of the relation (atom A)
   * @param {number} level - Level i in variable order
   * @param {Tuple} boundPrefix - Bound prefix for earlier VO vars
   * @returns {LevelIterator} Iterator over x_i values with that prefix
   */
  makeIter(relationName, level, boundPrefix) {
    const trie = this._tries.get(relationName);
    if (!trie) {
      throw new Error(`No trie registered for relation: ${relationName}`);
    }

    return new LevelIterator(trie, level, boundPrefix);
  }

  /**
   * Get all registered relation names
   */
  getRelationNames() {
    return Array.from(this._tries.keys());
  }

  /**
   * Check if relation is registered
   */
  hasRelation(relationName) {
    return this._tries.has(relationName);
  }

  /**
   * Clear all registered tries
   */
  clear() {
    this._tries.clear();
  }

  toString() {
    return `IteratorFactory(${this._tries.size} relations)`;
  }
}