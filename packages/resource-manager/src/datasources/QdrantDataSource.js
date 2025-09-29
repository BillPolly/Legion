/**
 * QdrantDataSource - DataSource implementation for Qdrant vector database
 * 
 * Provides interface to Qdrant for:
 * - Collection management
 * - Vector storage and retrieval
 * - Similarity search
 * - Batch operations
 */

export class QdrantDataSource {
  constructor(resourceManager, config = {}) {
    if (!resourceManager) {
      throw new Error('ResourceManager is required for QdrantDataSource');
    }
    
    this.resourceManager = resourceManager;
    this.initialized = false;
    this.qdrantClient = null;
    
    // Configuration
    this.config = {
      url: config.url || resourceManager.get('env.QDRANT_URL') || 'http://localhost:6333',
      apiKey: config.apiKey || resourceManager.get('env.QDRANT_API_KEY'),
      defaultDistance: config.defaultDistance || 'Cosine',
      batchSize: config.batchSize || 100
    };
    
    this.qdrantUrl = this.config.url;
    
    // Subscriptions management
    this._subscriptions = new Map();
    this._subscriptionId = 0;
  }

  /**
   * Initialize the DataSource
   */
  async initialize() {
    if (this.initialized) {
      return;
    }
    
    try {
      // Get or create Qdrant client from ResourceManager
      this.qdrantClient = this.resourceManager.get('qdrantClient');
      
      if (!this.qdrantClient) {
        // Trigger initialization of Qdrant client in ResourceManager
        await this.resourceManager._initializeQdrantClient();
        this.qdrantClient = this.resourceManager.get('qdrantClient');
      }
      
      if (!this.qdrantClient) {
        throw new Error('Failed to initialize Qdrant client');
      }
      
      // Verify connection by listing collections
      await this.qdrantClient.getCollections();
      
      this.initialized = true;
    } catch (error) {
      this.initialized = false;
      throw error;
    }
  }

  /**
   * Create a new collection
   */
  async createCollection(config) {
    this._checkInitialized();
    
    if (!config.collection_name) {
      throw new Error('Collection name is required');
    }
    
    const collectionConfig = {
      vectors: config.vectors || {
        size: 768,
        distance: this.config.defaultDistance
      }
    };
    
    const result = await this.qdrantClient.createCollection(
      config.collection_name,
      collectionConfig
    );
    
    this._notifySubscribers('collection.created', {
      collection: config.collection_name,
      config: collectionConfig
    });
    
    return result;
  }

  /**
   * Get collection information
   */
  async getCollectionInfo(collectionName) {
    this._checkInitialized();
    return await this.qdrantClient.getCollection(collectionName);
  }

  /**
   * List all collections
   */
  async listCollections() {
    this._checkInitialized();
    const result = await this.qdrantClient.getCollections();
    return result.collections || [];
  }

  /**
   * Delete a collection
   */
  async deleteCollection(collectionName) {
    this._checkInitialized();
    
    const result = await this.qdrantClient.deleteCollection(collectionName);
    
    this._notifySubscribers('collection.deleted', {
      collection: collectionName
    });
    
    return result;
  }

  /**
   * Check if collection exists
   */
  async collectionExists(collectionName) {
    this._checkInitialized();
    
    try {
      await this.qdrantClient.getCollection(collectionName);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Upsert points with vectors
   */
  async upsertPoints(collectionName, points) {
    this._checkInitialized();
    
    const result = await this.qdrantClient.upsert(collectionName, {
      points: points.map(point => ({
        id: point.id,
        vector: point.vector,
        payload: point.payload || {}
      }))
    });
    
    this._notifySubscribers('collection.change', {
      type: 'collection.change',
      operation: 'upsert',
      collection: collectionName,
      count: points.length
    });
    
    return result;
  }

  /**
   * Search for similar vectors
   */
  async search(collectionName, queryVector, limit = 10) {
    this._checkInitialized();
    
    if (queryVector.length !== 768) {
      throw new Error('Invalid vector dimension: expected 768, got ' + queryVector.length);
    }
    
    const response = await this.qdrantClient.search(collectionName, {
      vector: queryVector,
      limit: limit,
      with_payload: true,
      with_vector: false  // Don't need vectors back for search results to save bandwidth
    });
    
    return response.result || [];
  }

  /**
   * Search with filters
   */
  async searchWithFilter(collectionName, queryVector, filter, limit = 10) {
    this._checkInitialized();
    
    if (queryVector.length !== 768) {
      throw new Error('Invalid vector dimension: expected 768, got ' + queryVector.length);
    }
    
    const response = await this.qdrantClient.search(collectionName, {
      vector: queryVector,
      filter: filter,
      limit: limit,
      with_payload: true,
      with_vector: false
    });
    
    return response.result || [];
  }

  /**
   * Get points by IDs
   */
  async getPoints(collectionName, ids) {
    this._checkInitialized();
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      throw new Error('Point IDs are required');
    }
    
    const response = await this.qdrantClient.retrieve(collectionName, {
      ids: ids,
      with_payload: true,
      with_vector: true
    });
    
    return response.result || [];
  }

  /**
   * Delete points by IDs
   */
  async deletePoints(collectionName, ids) {
    this._checkInitialized();
    
    const result = await this.qdrantClient.delete(collectionName, {
      points: ids
    });
    
    this._notifySubscribers('collection.change', {
      type: 'collection.change',
      operation: 'delete',
      collection: collectionName,
      count: ids.length
    });
    
    return result;
  }

  /**
   * Update point payloads
   */
  async updatePayloads(collectionName, updates) {
    this._checkInitialized();
    
    // Convert updates object to array of operations
    const operations = Object.entries(updates).map(([id, payload]) => ({
      id: id,
      payload: payload
    }));
    
    const result = await this.qdrantClient.update(collectionName, {
      points: operations
    });
    
    this._notifySubscribers('collection.change', {
      type: 'collection.change',
      operation: 'update',
      collection: collectionName,
      count: operations.length
    });
    
    return result;
  }

  /**
   * Batch upsert with chunking
   */
  async batchUpsert(collectionName, points) {
    this._checkInitialized();
    
    const chunks = [];
    for (let i = 0; i < points.length; i += this.config.batchSize) {
      chunks.push(points.slice(i, i + this.config.batchSize));
    }
    
    const results = [];
    for (const chunk of chunks) {
      const result = await this.upsertPoints(collectionName, chunk);
      results.push(result);
    }
    
    return results;
  }

  /**
   * Batch search
   */
  async batchSearch(collectionName, queryVectors, limit = 10) {
    this._checkInitialized();
    
    const results = await Promise.all(
      queryVectors.map(vector => this.search(collectionName, vector, limit))
    );
    
    return results;
  }

  /**
   * Generic query interface (DataSource pattern)
   */
  async query(querySpec) {
    this._checkInitialized();
    
    switch (querySpec.type) {
      case 'collections':
        return await this.listCollections();
        
      case 'collection':
        return await this.getCollectionInfo(querySpec.collection);
        
      case 'search':
        return await this.search(
          querySpec.collection,
          querySpec.vector,
          querySpec.limit
        );
        
      case 'points':
        return await this.getPoints(
          querySpec.collection,
          querySpec.ids
        );
        
      default:
        throw new Error(`Unknown query type: ${querySpec.type}`);
    }
  }

  /**
   * Subscribe to DataSource events
   */
  subscribe(callback, options = {}) {
    if (!callback || typeof callback !== 'function') {
      throw new Error('Callback function is required');
    }

    const id = this._subscriptionId++;
    const subscription = {
      callback,
      options,
      id
    };
    
    this._subscriptions.set(id, subscription);
    
    return {
      unsubscribe: () => {
        this._subscriptions.delete(id);
      }
    };
  }

  /**
   * Notify subscribers of events
   * @private
   */
  _notifySubscribers(eventType, data) {
    for (const sub of this._subscriptions.values()) {
      if (!sub.options.type || sub.options.type === eventType) {
        if (!sub.options.collection || sub.options.collection === data.collection) {
          try {
            sub.callback(data);
          } catch (error) {
            console.error('Subscriber callback error:', error);
          }
        }
      }
    }
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this._subscriptions.clear();
    this.qdrantClient = null;
    this.initialized = false;
  }

  /**
   * Check if DataSource is initialized
   * @private
   */
  _checkInitialized() {
    if (!this.initialized) {
      throw new Error('QdrantDataSource not initialized. Call initialize() first.');
    }
  }
}

export default QdrantDataSource;