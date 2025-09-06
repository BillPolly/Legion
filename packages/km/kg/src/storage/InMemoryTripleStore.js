import { ITripleStore } from './ITripleStore.js';

/**
 * In-memory triple store implementation
 * Extracted from the original KGEngine with performance optimizations
 */
export class InMemoryTripleStore extends ITripleStore {
  constructor() {
    super();
    this.triples = new Set();
    this.tripleData = new Map(); // Store actual triple data with proper types
    this.spo = new Map(); // subject -> predicate -> objects
    this.pos = new Map(); // predicate -> object -> subjects  
    this.osp = new Map(); // object -> subject -> predicates
  }

  getMetadata() {
    return {
      type: 'memory',
      supportsTransactions: false,
      supportsPersistence: false,
      supportsAsync: true,
      maxTriples: Infinity
    };
  }

  /**
   * Add a triple to the knowledge graph
   */
  async addTriple(subject, predicate, object) {
    const triple = [subject, predicate, object];
    const key = this._tripleKey(triple);
    
    if (this.triples.has(key)) return false;
    
    this.triples.add(key);
    this.tripleData.set(key, triple); // Store original triple with proper types
    this._indexTriple(subject, predicate, object);
    return true;
  }

  /**
   * Remove a triple from the knowledge graph
   */
  async removeTriple(subject, predicate, object) {
    const key = this._tripleKey([subject, predicate, object]);
    if (!this.triples.has(key)) return false;
    
    this.triples.delete(key);
    this.tripleData.delete(key); // Remove stored triple data
    this._unindexTriple(subject, predicate, object);
    return true;
  }

  /**
   * Query triples with pattern matching
   * Use null for wildcards
   */
  async query(subject, predicate, object) {
    // Check for exact match - need to handle empty strings properly
    if (subject !== null && subject !== undefined && 
        predicate !== null && predicate !== undefined && 
        object !== null && object !== undefined) {
      // Exact match
      const key = this._tripleKey([subject, predicate, object]);
      return this.triples.has(key) ? [[subject, predicate, object]] : [];
    }

    if ((subject !== null && subject !== undefined) && 
        (predicate !== null && predicate !== undefined)) {
      // s p ?
      return this._getObjects(subject, predicate).map(o => [subject, predicate, o]);
    }

    if ((subject !== null && subject !== undefined) && 
        (object !== null && object !== undefined)) {
      // s ? o
      return this._getPredicates(subject, object).map(p => [subject, p, object]);
    }

    if ((predicate !== null && predicate !== undefined) && 
        (object !== null && object !== undefined)) {
      // ? p o
      return this._getSubjects(predicate, object).map(s => [s, predicate, object]);
    }

    if (subject !== null && subject !== undefined) {
      // s ? ?
      return this._getAllFromSubject(subject);
    }

    if (predicate !== null && predicate !== undefined) {
      // ? p ?
      return this._getAllFromPredicate(predicate);
    }

    if (object !== null && object !== undefined) {
      // ? ? o
      return this._getAllFromObject(object);
    }

    // ? ? ? - return all triples
    return Array.from(this.triples).map(key => {
      // Use stored triple data to preserve types
      const storedTriple = this.tripleData.get(key);
      if (storedTriple) {
        return storedTriple;
      }
      // Fallback to string parsing (shouldn't happen but be safe)
      if (typeof key === 'string') {
        return key.split('|');
      }
      return Array.isArray(key) ? key : [key, '', ''];
    });
  }

  /**
   * Get the total number of triples in the store
   */
  async size() {
    return this.triples.size;
  }

  /**
   * Clear all triples from the store
   */
  async clear() {
    this.triples.clear();
    this.tripleData.clear();
    this.spo.clear();
    this.pos.clear();
    this.osp.clear();
  }

  /**
   * Optimized batch add operation
   */
  async addTriples(triples) {
    let count = 0;
    for (const [s, p, o] of triples) {
      if (await this.addTriple(s, p, o)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Optimized batch remove operation
   */
  async removeTriples(triples) {
    let count = 0;
    for (const [s, p, o] of triples) {
      if (await this.removeTriple(s, p, o)) {
        count++;
      }
    }
    return count;
  }

  // Synchronous methods for backward compatibility
  
  /**
   * Synchronous add triple for backward compatibility
   */
  addTripleSync(subject, predicate, object) {
    const triple = [subject, predicate, object];
    const key = this._tripleKey(triple);
    
    if (this.triples.has(key)) return false;
    
    this.triples.add(key);
    this.tripleData.set(key, triple);
    this._indexTriple(subject, predicate, object);
    return true;
  }

  /**
   * Synchronous remove triple for backward compatibility
   */
  removeTripleSync(subject, predicate, object) {
    const key = this._tripleKey([subject, predicate, object]);
    if (!this.triples.has(key)) return false;
    
    this.triples.delete(key);
    this.tripleData.delete(key);
    this._unindexTriple(subject, predicate, object);
    return true;
  }

  /**
   * Synchronous query for backward compatibility
   */
  querySync(subject, predicate, object) {
    // Same logic as async query but without await
    if (subject !== null && subject !== undefined && 
        predicate !== null && predicate !== undefined && 
        object !== null && object !== undefined) {
      const key = this._tripleKey([subject, predicate, object]);
      return this.triples.has(key) ? [[subject, predicate, object]] : [];
    }

    if ((subject !== null && subject !== undefined) && 
        (predicate !== null && predicate !== undefined)) {
      return this._getObjects(subject, predicate).map(o => [subject, predicate, o]);
    }

    if ((subject !== null && subject !== undefined) && 
        (object !== null && object !== undefined)) {
      return this._getPredicates(subject, object).map(p => [subject, p, object]);
    }

    if ((predicate !== null && predicate !== undefined) && 
        (object !== null && object !== undefined)) {
      return this._getSubjects(predicate, object).map(s => [s, predicate, object]);
    }

    if (subject !== null && subject !== undefined) {
      return this._getAllFromSubject(subject);
    }

    if (predicate !== null && predicate !== undefined) {
      return this._getAllFromPredicate(predicate);
    }

    if (object !== null && object !== undefined) {
      return this._getAllFromObject(object);
    }

    return Array.from(this.triples).map(key => {
      const storedTriple = this.tripleData.get(key);
      if (storedTriple) {
        return storedTriple;
      }
      if (typeof key === 'string') {
        return key.split('|');
      }
      return Array.isArray(key) ? key : [key, '', ''];
    });
  }

  /**
   * Synchronous query pattern for backward compatibility
   */
  queryPatternSync(pattern) {
    const [s, p, o] = pattern;
    return this.querySync(
      s === '?' || s === null ? null : s,
      p === '?' || p === null ? null : p, 
      o === '?' || o === null ? null : o
    );
  }

  // Private indexing methods (same as original KGEngine)
  
  _tripleKey([s, p, o]) {
    return `${s}|${p}|${o}`;
  }

  _indexTriple(s, p, o) {
    // SPO index
    if (!this.spo.has(s)) this.spo.set(s, new Map());
    if (!this.spo.get(s).has(p)) this.spo.get(s).set(p, new Set());
    this.spo.get(s).get(p).add(o);

    // POS index  
    if (!this.pos.has(p)) this.pos.set(p, new Map());
    if (!this.pos.get(p).has(o)) this.pos.get(p).set(o, new Set());
    this.pos.get(p).get(o).add(s);

    // OSP index
    if (!this.osp.has(o)) this.osp.set(o, new Map());
    if (!this.osp.get(o).has(s)) this.osp.get(o).set(s, new Set());
    this.osp.get(o).get(s).add(p);
  }

  _unindexTriple(s, p, o) {
    this.spo.get(s)?.get(p)?.delete(o);
    this.pos.get(p)?.get(o)?.delete(s);
    this.osp.get(o)?.get(s)?.delete(p);
  }

  _getObjects(s, p) {
    return Array.from(this.spo.get(s)?.get(p) || []);
  }

  _getSubjects(p, o) {
    return Array.from(this.pos.get(p)?.get(o) || []);
  }

  _getPredicates(s, o) {
    return Array.from(this.osp.get(o)?.get(s) || []);
  }

  _getAllFromSubject(s) {
    const results = [];
    const predicates = this.spo.get(s);
    if (predicates) {
      for (const [p, objects] of predicates) {
        for (const o of objects) {
          results.push([s, p, o]);
        }
      }
    }
    return results;
  }

  _getAllFromPredicate(p) {
    const results = [];
    const objects = this.pos.get(p);
    if (objects) {
      for (const [o, subjects] of objects) {
        for (const s of subjects) {
          results.push([s, p, o]);
        }
      }
    }
    return results;
  }

  _getAllFromObject(o) {
    const results = [];
    const subjects = this.osp.get(o);
    if (subjects) {
      for (const [s, predicates] of subjects) {
        for (const p of predicates) {
          results.push([s, p, o]);
        }
      }
    }
    return results;
  }
}
