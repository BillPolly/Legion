import { ITripleStore } from '../core/ITripleStore.js';
import { TripleIndex } from '../utils/TripleIndex.js';

/**
 * InMemoryProvider - Pure in-memory triple store implementation
 * 
 * Features:
 * - Fast SPO/POS/OSP indices
 * - No persistence
 * - Synchronous operations available
 * - Suitable for caching and temporary data
 * 
 * Runtime: ✅ Client & Server - Works in browser and Node.js
 * 
 * Migrated from: /packages/km/kg-storage-memory/
 */
export class InMemoryProvider extends ITripleStore {
  constructor() {
    super();
    this.triples = new Set(); // Set of triple keys for fast duplicate checking
    this.tripleData = new Map(); // Map from key to actual triple array (preserves types)
    this.index = new TripleIndex(); // Triple indices for fast queries
  }

  /**
   * Get metadata about this provider
   * @returns {Object} - Provider metadata
   */
  getMetadata() {
    return {
      type: 'memory',
      supportsTransactions: false,
      supportsPersistence: false,
      supportsAsync: true
    };
  }

  /**
   * Add a triple to the store
   * @param {string|number} subject - The subject
   * @param {string} predicate - The predicate
   * @param {string|number|boolean} object - The object
   * @returns {Promise<boolean>} - True if added, false if already exists
   */
  async addTriple(subject, predicate, object) {
    const triple = [subject, predicate, object];
    const key = this._tripleKey(triple);
    
    // Check if triple already exists
    if (this.triples.has(key)) {
      return false;
    }
    
    // Add to all data structures
    this.triples.add(key);
    this.tripleData.set(key, triple); // Store original triple to preserve types
    this.index.addTriple(subject, predicate, object);
    
    return true;
  }

  /**
   * Remove a triple from the store
   * @param {string|number} subject - The subject
   * @param {string} predicate - The predicate
   * @param {string|number|boolean} object - The object
   * @returns {Promise<boolean>} - True if removed, false if not found
   */
  async removeTriple(subject, predicate, object) {
    const key = this._tripleKey([subject, predicate, object]);
    
    // Check if triple exists
    if (!this.triples.has(key)) {
      return false;
    }
    
    // Remove from all data structures
    this.triples.delete(key);
    this.tripleData.delete(key);
    this.index.removeTriple(subject, predicate, object);
    
    return true;
  }

  /**
   * Query triples with pattern matching
   * Use null for wildcards
   * 
   * @param {string|number|null} subject - Subject or null for wildcard
   * @param {string|null} predicate - Predicate or null for wildcard
   * @param {string|number|boolean|null} object - Object or null for wildcard
   * @returns {Promise<Array<[subject, predicate, object]>>} - Array of matching triples
   */
  async query(subject, predicate, object) {
    // Exact match (s p o) - all values provided and not null/undefined
    if (subject !== null && subject !== undefined && 
        predicate !== null && predicate !== undefined && 
        object !== null && object !== undefined) {
      const key = this._tripleKey([subject, predicate, object]);
      return this.triples.has(key) ? [[subject, predicate, object]] : [];
    }

    // (s p ?) - subject and predicate specified
    if ((subject !== null && subject !== undefined) && 
        (predicate !== null && predicate !== undefined)) {
      return this.index.getObjects(subject, predicate)
        .map(o => [subject, predicate, o]);
    }

    // (s ? o) - subject and object specified
    if ((subject !== null && subject !== undefined) && 
        (object !== null && object !== undefined)) {
      return this.index.getPredicates(subject, object)
        .map(p => [subject, p, object]);
    }

    // (? p o) - predicate and object specified
    if ((predicate !== null && predicate !== undefined) && 
        (object !== null && object !== undefined)) {
      return this.index.getSubjects(predicate, object)
        .map(s => [s, predicate, object]);
    }

    // (s ? ?) - only subject specified
    if (subject !== null && subject !== undefined) {
      return this.index.getAllFromSubject(subject);
    }

    // (? p ?) - only predicate specified
    if (predicate !== null && predicate !== undefined) {
      return this.index.getAllFromPredicate(predicate);
    }

    // (? ? o) - only object specified
    if (object !== null && object !== undefined) {
      return this.index.getAllFromObject(object);
    }

    // (? ? ?) - return all triples
    return Array.from(this.triples).map(key => {
      // Use stored triple data to preserve types (numbers, booleans, etc.)
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
   * @returns {Promise<number>} - Count of triples
   */
  async size() {
    return this.triples.size;
  }

  /**
   * Clear all triples from the store
   * @returns {Promise<void>}
   */
  async clear() {
    this.triples.clear();
    this.tripleData.clear();
    this.index.clear();
  }

  /**
   * Generate a unique key for a triple
   * @private
   * @param {Array} triple - [subject, predicate, object]
   * @returns {string} - Unique key
   */
  _tripleKey([subject, predicate, object]) {
    return `${subject}|${predicate}|${object}`;
  }
}