/**
 * Interface for triple store implementations
 * All storage providers must implement this interface
 */
export class ITripleStore {
  /**
   * Add a triple to the store
   * @param {string} subject - The subject of the triple
   * @param {string} predicate - The predicate of the triple
   * @param {any} object - The object of the triple (preserves type)
   * @returns {Promise<boolean>} - True if added, false if already exists
   */
  async addTriple(subject, predicate, object) {
    throw new Error('addTriple must be implemented by storage provider');
  }

  /**
   * Remove a triple from the store
   * @param {string} subject - The subject of the triple
   * @param {string} predicate - The predicate of the triple
   * @param {any} object - The object of the triple
   * @returns {Promise<boolean>} - True if removed, false if not found
   */
  async removeTriple(subject, predicate, object) {
    throw new Error('removeTriple must be implemented by storage provider');
  }

  /**
   * Query triples with pattern matching
   * @param {string|null} subject - Subject pattern (null for wildcard)
   * @param {string|null} predicate - Predicate pattern (null for wildcard)
   * @param {any|null} object - Object pattern (null for wildcard)
   * @returns {Promise<Array<[string, string, any]>>} - Array of matching triples
   */
  async query(subject, predicate, object) {
    throw new Error('query must be implemented by storage provider');
  }

  /**
   * Query with array pattern
   * @param {Array<string|null>} pattern - [subject, predicate, object] pattern
   * @returns {Promise<Array<[string, string, any]>>} - Array of matching triples
   */
  async queryPattern(pattern) {
    const [s, p, o] = pattern;
    return this.query(
      s === '?' || s === null ? null : s,
      p === '?' || p === null ? null : p,
      o === '?' || o === null ? null : o
    );
  }

  /**
   * Check if a specific triple exists
   * @param {string} subject - The subject of the triple
   * @param {string} predicate - The predicate of the triple
   * @param {any} object - The object of the triple
   * @returns {Promise<boolean>} - True if exists, false otherwise
   */
  async exists(subject, predicate, object) {
    const results = await this.query(subject, predicate, object);
    return results.length > 0;
  }

  /**
   * Get the total number of triples in the store
   * @returns {Promise<number>} - Number of triples
   */
  async size() {
    throw new Error('size must be implemented by storage provider');
  }

  /**
   * Clear all triples from the store
   * @returns {Promise<void>}
   */
  async clear() {
    throw new Error('clear must be implemented by storage provider');
  }

  // Batch Operations

  /**
   * Add multiple triples in a batch operation
   * @param {Array<[string, string, any]>} triples - Array of triples to add
   * @returns {Promise<number>} - Number of triples actually added
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
   * Remove multiple triples in a batch operation
   * @param {Array<[string, string, any]>} triples - Array of triples to remove
   * @returns {Promise<number>} - Number of triples actually removed
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

  // Optional Advanced Features

  /**
   * Begin a transaction (optional)
   * @returns {Promise<ITransaction>} - Transaction object
   */
  async beginTransaction() {
    throw new Error('Transactions not supported by this storage provider');
  }

  /**
   * Save data to persistent storage (optional)
   * @returns {Promise<void>}
   */
  async save() {
    // Default implementation does nothing (for in-memory stores)
  }

  /**
   * Load data from persistent storage (optional)
   * @returns {Promise<void>}
   */
  async load() {
    // Default implementation does nothing (for in-memory stores)
  }

  /**
   * Get storage provider metadata
   * @returns {Object} - Metadata about the storage provider
   */
  getMetadata() {
    return {
      type: 'unknown',
      supportsTransactions: false,
      supportsPersistence: false,
      supportsAsync: true,
      maxTriples: Infinity
    };
  }
}

/**
 * Interface for transaction support
 */
export class ITransaction {
  /**
   * Add a triple within the transaction
   * @param {string} subject - The subject of the triple
   * @param {string} predicate - The predicate of the triple
   * @param {any} object - The object of the triple
   * @returns {Promise<boolean>} - True if added, false if already exists
   */
  async addTriple(subject, predicate, object) {
    throw new Error('addTriple must be implemented by transaction provider');
  }

  /**
   * Remove a triple within the transaction
   * @param {string} subject - The subject of the triple
   * @param {string} predicate - The predicate of the triple
   * @param {any} object - The object of the triple
   * @returns {Promise<boolean>} - True if removed, false if not found
   */
  async removeTriple(subject, predicate, object) {
    throw new Error('removeTriple must be implemented by transaction provider');
  }

  /**
   * Commit the transaction
   * @returns {Promise<void>}
   */
  async commit() {
    throw new Error('commit must be implemented by transaction provider');
  }

  /**
   * Rollback the transaction
   * @returns {Promise<void>}
   */
  async rollback() {
    throw new Error('rollback must be implemented by transaction provider');
  }
}
