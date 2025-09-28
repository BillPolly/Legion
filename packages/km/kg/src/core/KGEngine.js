import { createInMemoryTripleStore } from '@legion/triplestore';

/**
 * Core Knowledge Graph Engine
 * Now uses pluggable storage providers with backward compatibility
 */
export class KGEngine {
  constructor(tripleStore = null) {
    // Use provided storage or default to InMemoryTripleStore
    this.store = tripleStore || createInMemoryTripleStore();
  }

  /**
   * Add a triple to the knowledge graph
   * Synchronous method for backward compatibility
   */
  addTriple(subject, predicate, object) {
    // Use sync method if available (InMemoryTripleStore), otherwise throw error
    if (typeof this.store.addTripleSync === 'function') {
      return this.store.addTripleSync(subject, predicate, object);
    }
    throw new Error('Synchronous operations not supported with this storage provider. Use addTripleAsync() instead.');
  }

  /**
   * Remove a triple from the knowledge graph
   * Synchronous method for backward compatibility
   */
  removeTriple(subject, predicate, object) {
    // Use sync method if available (InMemoryTripleStore), otherwise throw error
    if (typeof this.store.removeTripleSync === 'function') {
      return this.store.removeTripleSync(subject, predicate, object);
    }
    throw new Error('Synchronous operations not supported with this storage provider. Use removeTripleAsync() instead.');
  }

  /**
   * Query triples with pattern matching
   * Synchronous method for backward compatibility
   * Use null or '?' for wildcards
   */
  query(subject, predicate, object) {
    // Use sync method if available (InMemoryTripleStore), otherwise throw error
    if (typeof this.store.querySync === 'function') {
      return this.store.querySync(subject, predicate, object);
    }
    throw new Error('Synchronous operations not supported with this storage provider. Use queryAsync() instead.');
  }

  /**
   * Query with array pattern [s, p, o] where null/'?' are wildcards
   * Synchronous method for backward compatibility
   */
  queryPattern(pattern) {
    // Use sync method if available (InMemoryTripleStore), otherwise throw error
    if (typeof this.store.queryPatternSync === 'function') {
      return this.store.queryPatternSync(pattern);
    }
    throw new Error('Synchronous operations not supported with this storage provider. Use queryPatternAsync() instead.');
  }

  // New async methods

  /**
   * Add a triple to the knowledge graph (async)
   */
  async addTripleAsync(subject, predicate, object) {
    return await this.store.addTriple(subject, predicate, object);
  }

  /**
   * Remove a triple from the knowledge graph (async)
   */
  async removeTripleAsync(subject, predicate, object) {
    return await this.store.removeTriple(subject, predicate, object);
  }

  /**
   * Query triples with pattern matching (async)
   */
  async queryAsync(subject, predicate, object) {
    return await this.store.query(subject, predicate, object);
  }

  /**
   * Query with array pattern (async)
   */
  async queryPatternAsync(pattern) {
    return await this.store.queryPattern(pattern);
  }

  /**
   * Check if a triple exists (async)
   */
  async exists(subject, predicate, object) {
    return await this.store.exists(subject, predicate, object);
  }

  /**
   * Get the total number of triples
   */
  async size() {
    return await this.store.size();
  }

  /**
   * Clear all triples
   */
  async clear() {
    return await this.store.clear();
  }

  /**
   * Add multiple triples in batch
   */
  async addTriples(triples) {
    return await this.store.addTriples(triples);
  }

  /**
   * Remove multiple triples in batch
   */
  async removeTriples(triples) {
    return await this.store.removeTriples(triples);
  }

  /**
   * Get storage provider metadata
   */
  getStorageMetadata() {
    return this.store.getMetadata();
  }

  /**
   * Save data to persistent storage (if supported)
   */
  async save() {
    return await this.store.save();
  }

  /**
   * Load data from persistent storage (if supported)
   */
  async load() {
    return await this.store.load();
  }

  /**
   * Begin a transaction (if supported)
   */
  async beginTransaction() {
    return await this.store.beginTransaction();
  }

}
