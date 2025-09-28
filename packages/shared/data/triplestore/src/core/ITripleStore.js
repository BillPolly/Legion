/**
 * ITripleStore - Base interface for all triple store implementations
 * 
 * All providers must extend this class and implement these methods.
 * This ensures a consistent interface across memory, file, and database backends.
 */
export class ITripleStore {
  /**
   * Add a triple to the store
   * @param {string|number} subject - The subject of the triple
   * @param {string} predicate - The predicate/relationship
   * @param {string|number|boolean} object - The object/value
   * @returns {Promise<boolean>} - True if added, false if already exists
   */
  async addTriple(subject, predicate, object) {
    throw new Error('Not implemented: addTriple must be implemented by subclass');
  }

  /**
   * Remove a triple from the store
   * @param {string|number} subject - The subject of the triple
   * @param {string} predicate - The predicate/relationship
   * @param {string|number|boolean} object - The object/value
   * @returns {Promise<boolean>} - True if removed, false if not found
   */
  async removeTriple(subject, predicate, object) {
    throw new Error('Not implemented: removeTriple must be implemented by subclass');
  }

  /**
   * Query triples with pattern matching
   * Use null for wildcards
   * 
   * Examples:
   *   query('user:123', null, null) - All facts about user:123
   *   query(null, 'hasName', null) - All entities with names
   *   query(null, null, null) - All triples
   * 
   * @param {string|number|null} subject - Subject or null for wildcard
   * @param {string|null} predicate - Predicate or null for wildcard
   * @param {string|number|boolean|null} object - Object or null for wildcard
   * @returns {Promise<Array<[subject, predicate, object]>>} - Array of matching triples
   */
  async query(subject, predicate, object) {
    throw new Error('Not implemented: query must be implemented by subclass');
  }

  /**
   * Get the total number of triples in the store
   * @returns {Promise<number>} - Count of triples
   */
  async size() {
    throw new Error('Not implemented: size must be implemented by subclass');
  }

  /**
   * Clear all triples from the store
   * @returns {Promise<void>}
   */
  async clear() {
    throw new Error('Not implemented: clear must be implemented by subclass');
  }

  /**
   * Get metadata about the store implementation
   * This is synchronous as it returns static information
   * 
   * @returns {Object} - Metadata object
   * @returns {string} returns.type - Type of store (memory, file, datascript, etc.)
   * @returns {boolean} returns.supportsTransactions - Whether transactions are supported
   * @returns {boolean} returns.supportsPersistence - Whether data persists between sessions
   * @returns {boolean} returns.supportsAsync - Whether async operations are supported
   */
  getMetadata() {
    throw new Error('Not implemented: getMetadata must be implemented by subclass');
  }
}

/**
 * ITransaction - Interface for transaction support (optional)
 * Providers can optionally implement this for transactional operations
 */
export class ITransaction {
  /**
   * Commit the transaction
   * @returns {Promise<void>}
   */
  async commit() {
    throw new Error('Not implemented: commit must be implemented by subclass');
  }

  /**
   * Rollback the transaction
   * @returns {Promise<void>}
   */
  async rollback() {
    throw new Error('Not implemented: rollback must be implemented by subclass');
  }
}