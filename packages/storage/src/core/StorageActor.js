/**
 * StorageActor - Base class for storage-related actors
 * 
 * Provides storage-specific messaging patterns and error handling for database operations.
 * Can optionally extend Legion's Actor system when available.
 */

// Base Actor class - can be replaced with Legion's Actor when available
class BaseActor {
  constructor(receiveFn) {
    this.isActor = true;
    this.isRemote = false;
    this._receiveFn = receiveFn || (() => {});
  }

  async receive(payload) {
    return await this._receiveFn(payload);
  }
}

export class StorageActor extends BaseActor {
  constructor(provider, collection = null) {
    // Create the receive function for storage operations
    super(async (message) => {
      return await this._handleStorageMessage(message);
    });

    this.provider = provider;
    this.collection = collection;
    this.isStorageActor = true;
  }

  /**
   * Handle incoming storage messages
   * @private
   */
  async _handleStorageMessage(message) {
    const { operation, data, options = {}, requestId } = message;

    try {
      // Validate provider connection
      if (!this.provider.isConnected()) {
        throw new Error(`Provider ${this.provider.name} is not connected`);
      }

      // Route to appropriate handler
      const result = await this._routeOperation(operation, data, options);

      return {
        success: true,
        result,
        requestId,
        timestamp: new Date().toISOString(),
        actor: this.constructor.name
      };

    } catch (error) {
      return {
        success: false,
        error: {
          message: error.message,
          type: error.constructor.name,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        },
        requestId,
        timestamp: new Date().toISOString(),
        actor: this.constructor.name
      };
    }
  }

  /**
   * Route operation to appropriate provider method
   * @private
   */
  async _routeOperation(operation, data, options) {
    switch (operation) {
      case 'find':
        return await this.provider.find(this.collection, data.query || {}, options);
        
      case 'findOne':
        return await this.provider.findOne(this.collection, data.query || {}, options);
        
      case 'insert':
        return await this.provider.insert(this.collection, data.documents, options);
        
      case 'update':
        return await this.provider.update(
          this.collection, 
          data.query || {}, 
          data.update, 
          options
        );
        
      case 'delete':
        return await this.provider.delete(this.collection, data.query || {}, options);
        
      case 'count':
        return await this.provider.count(this.collection, data.query || {}, options);
        
      case 'aggregate':
        return await this.provider.aggregate(this.collection, data.pipeline || [], options);
        
      case 'createIndex':
        return await this.provider.createIndex(this.collection, data.spec, options);
        
      default:
        throw new Error(`Unknown storage operation: ${operation}`);
    }
  }

  /**
   * Send a storage operation message to this actor
   * @param {string} operation - Operation type
   * @param {Object} data - Operation data
   * @param {Object} options - Operation options
   * @returns {Promise<Object>}
   */
  async executeOperation(operation, data = {}, options = {}) {
    const message = {
      operation,
      data,
      options,
      requestId: this._generateRequestId()
    };

    return await this.receive(message);
  }

  /**
   * Generate a unique request ID
   * @private
   */
  _generateRequestId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get actor metadata
   * @returns {Object}
   */
  getMetadata() {
    return {
      type: 'StorageActor',
      provider: this.provider.name,
      collection: this.collection,
      connected: this.provider.isConnected(),
      capabilities: this.provider.getCapabilities()
    };
  }
}