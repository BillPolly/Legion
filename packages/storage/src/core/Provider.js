/**
 * Provider - Base class for all storage providers
 * 
 * Defines the standard interface that all storage providers must implement.
 * Providers can extend this to add provider-specific functionality.
 */

export class Provider {
  constructor(config = {}) {
    this.config = config;
    this.connected = false;
    this.name = this.constructor.name;
  }

  /**
   * Connect to the storage backend
   * @returns {Promise<void>}
   */
  async connect() {
    throw new Error(`${this.name}: connect() method must be implemented`);
  }

  /**
   * Disconnect from the storage backend
   * @returns {Promise<void>}
   */
  async disconnect() {
    throw new Error(`${this.name}: disconnect() method must be implemented`);
  }

  /**
   * Check if the provider is connected
   * @returns {boolean}
   */
  isConnected() {
    return this.connected;
  }

  // ===================
  // Standard CRUD Operations (all providers must implement)
  // ===================

  /**
   * Find documents in a collection
   * @param {string} collection - Collection name
   * @param {Object} query - Query criteria
   * @param {Object} options - Query options (limit, skip, sort, etc.)
   * @returns {Promise<Array>}
   */
  async find(collection, query = {}, options = {}) {
    throw new Error(`${this.name}: find() method must be implemented`);
  }

  /**
   * Find a single document
   * @param {string} collection - Collection name
   * @param {Object} query - Query criteria
   * @param {Object} options - Query options
   * @returns {Promise<Object|null>}
   */
  async findOne(collection, query = {}, options = {}) {
    const results = await this.find(collection, query, { ...options, limit: 1 });
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Insert documents into a collection
   * @param {string} collection - Collection name
   * @param {Object|Array} documents - Document(s) to insert
   * @param {Object} options - Insert options
   * @returns {Promise<Object>} - Insert result
   */
  async insert(collection, documents, options = {}) {
    throw new Error(`${this.name}: insert() method must be implemented`);
  }

  /**
   * Update documents in a collection
   * @param {string} collection - Collection name
   * @param {Object} query - Query criteria
   * @param {Object} update - Update operations
   * @param {Object} options - Update options
   * @returns {Promise<Object>} - Update result
   */
  async update(collection, query, update, options = {}) {
    throw new Error(`${this.name}: update() method must be implemented`);
  }

  /**
   * Delete documents from a collection
   * @param {string} collection - Collection name
   * @param {Object} query - Query criteria
   * @param {Object} options - Delete options
   * @returns {Promise<Object>} - Delete result
   */
  async delete(collection, query, options = {}) {
    throw new Error(`${this.name}: delete() method must be implemented`);
  }

  /**
   * Count documents in a collection
   * @param {string} collection - Collection name
   * @param {Object} query - Query criteria
   * @param {Object} options - Count options
   * @returns {Promise<number>}
   */
  async count(collection, query = {}, options = {}) {
    const results = await this.find(collection, query, options);
    return results.length;
  }

  // ===================
  // Optional Advanced Operations (providers can override)
  // ===================

  /**
   * Perform aggregation operations
   * @param {string} collection - Collection name
   * @param {Array} pipeline - Aggregation pipeline
   * @param {Object} options - Aggregation options
   * @returns {Promise<Array>} - Aggregation results
   */
  async aggregate(collection, pipeline = [], options = {}) {
    // Default implementation - can be overridden by providers
    return [];
  }

  /**
   * Create an index on a collection
   * @param {string} collection - Collection name
   * @param {Object} spec - Index specification
   * @param {Object} options - Index options
   * @returns {Promise<Object>} - Index creation result
   */
  async createIndex(collection, spec, options = {}) {
    // Default implementation - can be overridden by providers
    return { acknowledged: false, message: 'Index creation not supported by this provider' };
  }

  /**
   * Watch for changes in a collection (change streams)
   * @param {string} collection - Collection name
   * @param {Array} pipeline - Watch pipeline
   * @param {Object} options - Watch options
   * @returns {Promise<Object>} - Change stream
   */
  async watch(collection, pipeline = [], options = {}) {
    // Default implementation - can be overridden by providers
    return null;
  }

  /**
   * List all collections in the database
   * @returns {Promise<Array<string>>}
   */
  async listCollections() {
    throw new Error(`${this.name}: listCollections() method must be implemented`);
  }

  /**
   * Drop a collection
   * @param {string} collection - Collection name
   * @returns {Promise<boolean>}
   */
  async dropCollection(collection) {
    throw new Error(`${this.name}: dropCollection() method must be implemented`);
  }

  /**
   * Get provider-specific metadata
   * @returns {Object}
   */
  getMetadata() {
    return {
      name: this.name,
      connected: this.connected,
      config: { ...this.config },
      capabilities: this.getCapabilities()
    };
  }

  /**
   * Get provider capabilities
   * @returns {Array<string>}
   */
  getCapabilities() {
    return [
      'find',
      'findOne', 
      'insert',
      'update',
      'delete',
      'count',
      'listCollections',
      'dropCollection'
    ];
  }
}