/**
 * Transaction - Abstract transaction handling for storage operations
 * 
 * Provides a provider-agnostic interface for transaction management.
 * Providers can extend this to implement provider-specific transaction logic.
 */

export class Transaction {
  constructor(provider, session = null) {
    this.provider = provider;
    this.session = session;
    this.operations = [];
    this.state = 'idle'; // idle, active, committed, aborted
    this.startTime = null;
    this.endTime = null;
  }

  /**
   * Start the transaction
   * @param {Object} options - Transaction options
   * @returns {Promise<void>}
   */
  async start(options = {}) {
    if (this.state !== 'idle') {
      throw new Error(`Transaction already ${this.state}`);
    }

    this.state = 'active';
    this.startTime = new Date();
    this.options = options;

    // Provider-specific transaction start logic
    if (this.provider.startTransaction) {
      this.session = await this.provider.startTransaction(options);
    }
  }

  /**
   * Add an operation to the transaction
   * @param {string} type - Operation type (insert, update, delete)
   * @param {string} collection - Collection name
   * @param {Object} data - Operation data
   * @param {Object} options - Operation options
   * @returns {Transaction}
   */
  addOperation(type, collection, data, options = {}) {
    if (this.state !== 'active') {
      throw new Error('Transaction is not active');
    }

    this.operations.push({
      type,
      collection,
      data,
      options,
      timestamp: new Date()
    });

    return this;
  }

  /**
   * Insert operation
   * @param {string} collection - Collection name
   * @param {Object|Array} documents - Documents to insert
   * @param {Object} options - Insert options
   * @returns {Transaction}
   */
  insert(collection, documents, options = {}) {
    return this.addOperation('insert', collection, { documents }, options);
  }

  /**
   * Update operation
   * @param {string} collection - Collection name
   * @param {Object} query - Query criteria
   * @param {Object} update - Update operations
   * @param {Object} options - Update options
   * @returns {Transaction}
   */
  update(collection, query, update, options = {}) {
    return this.addOperation('update', collection, { query, update }, options);
  }

  /**
   * Delete operation
   * @param {string} collection - Collection name
   * @param {Object} query - Query criteria
   * @param {Object} options - Delete options
   * @returns {Transaction}
   */
  delete(collection, query, options = {}) {
    return this.addOperation('delete', collection, { query }, options);
  }

  /**
   * Execute all operations in the transaction
   * @returns {Promise<Array>} - Results of all operations
   */
  async execute() {
    if (this.state !== 'active') {
      throw new Error('Transaction is not active');
    }

    const results = [];

    try {
      // Execute all operations
      for (const operation of this.operations) {
        const result = await this._executeOperation(operation);
        results.push(result);
      }

      return results;
    } catch (error) {
      // If any operation fails, the transaction should be aborted
      await this.abort();
      throw error;
    }
  }

  /**
   * Execute a single operation
   * @private
   */
  async _executeOperation(operation) {
    const { type, collection, data, options } = operation;

    // Add session to options if available
    const opOptions = this.session ? { ...options, session: this.session } : options;

    switch (type) {
      case 'insert':
        return await this.provider.insert(collection, data.documents, opOptions);
      
      case 'update':
        return await this.provider.update(collection, data.query, data.update, opOptions);
      
      case 'delete':
        return await this.provider.delete(collection, data.query, opOptions);
      
      default:
        throw new Error(`Unknown transaction operation: ${type}`);
    }
  }

  /**
   * Commit the transaction
   * @returns {Promise<Array>} - Results of all operations
   */
  async commit() {
    if (this.state !== 'active') {
      throw new Error('Transaction is not active');
    }

    try {
      // Execute all operations if not already executed
      const results = await this.execute();

      // Provider-specific commit logic
      if (this.provider.commitTransaction && this.session) {
        await this.provider.commitTransaction(this.session);
      }

      this.state = 'committed';
      this.endTime = new Date();

      return results;
    } catch (error) {
      await this.abort();
      throw error;
    }
  }

  /**
   * Abort the transaction
   * @returns {Promise<void>}
   */
  async abort() {
    if (this.state !== 'active') {
      return; // Already finished
    }

    try {
      // Provider-specific abort logic
      if (this.provider.abortTransaction && this.session) {
        await this.provider.abortTransaction(this.session);
      }
    } finally {
      this.state = 'aborted';
      this.endTime = new Date();
    }
  }

  /**
   * Get transaction metadata
   * @returns {Object}
   */
  getMetadata() {
    return {
      state: this.state,
      operationCount: this.operations.length,
      startTime: this.startTime,
      endTime: this.endTime,
      duration: this.endTime && this.startTime ? 
        this.endTime - this.startTime : null,
      hasSession: !!this.session
    };
  }

  /**
   * Get transaction operations
   * @returns {Array}
   */
  getOperations() {
    return [...this.operations];
  }
}