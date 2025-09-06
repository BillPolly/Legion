import { ITripleStore, StorageError, ConnectionError, TransactionError, ValidationError } from '@legion/kg-storage-core';

/**
 * MongoDB-based triple store implementation
 * Uses MongoDB's document model with optimized indexing for triple queries
 */
export class MongoTripleStore extends ITripleStore {
  constructor(connectionString, options = {}) {
    super();
    
    this.connectionString = connectionString;
    this.databaseName = options.databaseName || this._extractDatabaseName(connectionString);
    this.collectionName = options.collectionName || 'triples';
    this.enableSharding = options.enableSharding || false;
    this.enableTransactions = options.enableTransactions !== false;
    this.indexStrategy = options.indexStrategy || 'balanced';
    this.batchSize = options.batchSize || 1000;
    
    // MongoDB client and database
    this.client = null;
    this.db = null;
    this.collection = null;
    this.connected = false;
    
    // Session for transactions
    this.currentSession = null;
    
    this._validateConfig();
  }

  getMetadata() {
    return {
      type: 'mongodb',
      supportsTransactions: this.enableTransactions,
      supportsPersistence: true,
      supportsAsync: true,
      maxTriples: Infinity,
      databaseName: this.databaseName,
      collectionName: this.collectionName,
      enableSharding: this.enableSharding,
      connected: this.connected,
      indexStrategy: this.indexStrategy,
      batchSize: this.batchSize
    };
  }

  /**
   * Connect to MongoDB and initialize
   */
  async connect() {
    if (this.connected) return;
    
    try {
      // This would use mongodb library in real implementation
      this.client = await this._createMongoClient();
      this.db = this.client.db(this.databaseName);
      this.collection = this.db.collection(this.collectionName);
      
      // Create indexes
      await this._createIndexes();
      
      // Setup sharding if enabled
      if (this.enableSharding) {
        await this._setupSharding();
      }
      
      this.connected = true;
    } catch (error) {
      throw new ConnectionError(`Failed to connect to MongoDB: ${error.message}`, error);
    }
  }

  /**
   * Disconnect from MongoDB
   */
  async disconnect() {
    if (!this.connected) return;
    
    try {
      if (this.currentSession) {
        await this.currentSession.abortTransaction();
        await this.currentSession.endSession();
        this.currentSession = null;
      }
      
      if (this.client) {
        await this.client.close();
        this.client = null;
      }
      
      this.db = null;
      this.collection = null;
      this.connected = false;
    } catch (error) {
      throw new ConnectionError(`Failed to disconnect from MongoDB: ${error.message}`, error);
    }
  }

  /**
   * Add a triple to the store
   */
  async addTriple(subject, predicate, object) {
    await this._ensureConnected();
    
    const document = this._createTripleDocument(subject, predicate, object);
    
    try {
      const options = this.currentSession ? { session: this.currentSession } : {};
      const result = await this.collection.insertOne(document, options);
      return result.acknowledged;
    } catch (error) {
      if (this._isDuplicateError(error)) {
        return false; // Triple already exists
      }
      throw new StorageError(`Failed to add triple: ${error.message}`, 'ADD_ERROR', error);
    }
  }

  /**
   * Remove a triple from the store
   */
  async removeTriple(subject, predicate, object) {
    await this._ensureConnected();
    
    const filter = this._createTripleFilter(subject, predicate, object);
    
    try {
      const options = this.currentSession ? { session: this.currentSession } : {};
      const result = await this.collection.deleteOne(filter, options);
      return result.deletedCount > 0;
    } catch (error) {
      throw new StorageError(`Failed to remove triple: ${error.message}`, 'REMOVE_ERROR', error);
    }
  }

  /**
   * Query triples with pattern matching
   */
  async query(subject, predicate, object) {
    await this._ensureConnected();
    
    const filter = this._buildQueryFilter(subject, predicate, object);
    
    try {
      const options = this.currentSession ? { session: this.currentSession } : {};
      const cursor = this.collection.find(filter, options);
      const documents = await cursor.toArray();
      
      return documents.map(doc => [doc.subject, doc.predicate, doc.object]);
    } catch (error) {
      throw new StorageError(`Failed to query triples: ${error.message}`, 'QUERY_ERROR', error);
    }
  }

  /**
   * Get the total number of triples
   */
  async size() {
    await this._ensureConnected();
    
    try {
      const options = this.currentSession ? { session: this.currentSession } : {};
      return await this.collection.countDocuments({}, options);
    } catch (error) {
      throw new StorageError(`Failed to get size: ${error.message}`, 'SIZE_ERROR', error);
    }
  }

  /**
   * Clear all triples
   */
  async clear() {
    await this._ensureConnected();
    
    try {
      const options = this.currentSession ? { session: this.currentSession } : {};
      await this.collection.deleteMany({}, options);
    } catch (error) {
      throw new StorageError(`Failed to clear triples: ${error.message}`, 'CLEAR_ERROR', error);
    }
  }

  /**
   * Check if a triple exists
   */
  async exists(subject, predicate, object) {
    await this._ensureConnected();
    
    const filter = this._createTripleFilter(subject, predicate, object);
    
    try {
      const options = this.currentSession ? { session: this.currentSession } : {};
      const count = await this.collection.countDocuments(filter, { ...options, limit: 1 });
      return count > 0;
    } catch (error) {
      throw new StorageError(`Failed to check existence: ${error.message}`, 'EXISTS_ERROR', error);
    }
  }

  /**
   * Add multiple triples in a batch
   */
  async addTriples(triples) {
    await this._ensureConnected();
    
    if (triples.length === 0) return 0;
    
    const documents = triples.map(([s, p, o]) => this._createTripleDocument(s, p, o));
    
    try {
      const options = {
        ordered: false, // Continue on duplicates
        ...(this.currentSession ? { session: this.currentSession } : {})
      };
      
      // Process in batches to avoid memory issues
      let insertedCount = 0;
      for (let i = 0; i < documents.length; i += this.batchSize) {
        const batch = documents.slice(i, i + this.batchSize);
        try {
          const result = await this.collection.insertMany(batch, options);
          insertedCount += result.insertedCount;
        } catch (error) {
          if (error.code === 11000) {
            // Bulk write error with duplicates
            insertedCount += error.result?.insertedCount || 0;
          } else {
            throw error;
          }
        }
      }
      
      return insertedCount;
    } catch (error) {
      throw new StorageError(`Failed to add triples batch: ${error.message}`, 'BATCH_ADD_ERROR', error);
    }
  }

  /**
   * Remove multiple triples in a batch
   */
  async removeTriples(triples) {
    await this._ensureConnected();
    
    if (triples.length === 0) return 0;
    
    try {
      let removedCount = 0;
      
      // Process in batches
      for (let i = 0; i < triples.length; i += this.batchSize) {
        const batch = triples.slice(i, i + this.batchSize);
        const filters = batch.map(([s, p, o]) => this._createTripleFilter(s, p, o));
        
        const options = this.currentSession ? { session: this.currentSession } : {};
        const result = await this.collection.deleteMany({ $or: filters }, options);
        removedCount += result.deletedCount;
      }
      
      return removedCount;
    } catch (error) {
      throw new StorageError(`Failed to remove triples batch: ${error.message}`, 'BATCH_REMOVE_ERROR', error);
    }
  }

  /**
   * Begin a MongoDB transaction
   */
  async beginTransaction() {
    if (!this.enableTransactions) {
      throw new TransactionError('Transactions are not enabled for this store');
    }
    
    await this._ensureConnected();
    
    if (this.currentSession) {
      throw new TransactionError('Transaction already in progress');
    }
    
    try {
      this.currentSession = this.client.startSession();
      this.currentSession.startTransaction();
      
      return {
        async commit() {
          await this.currentSession.commitTransaction();
          await this.currentSession.endSession();
          this.currentSession = null;
        },
        async rollback() {
          await this.currentSession.abortTransaction();
          await this.currentSession.endSession();
          this.currentSession = null;
        }
      };
    } catch (error) {
      throw new TransactionError(`Failed to begin transaction: ${error.message}`, error);
    }
  }

  /**
   * Execute aggregation pipeline
   */
  async aggregate(pipeline) {
    await this._ensureConnected();
    
    try {
      const options = this.currentSession ? { session: this.currentSession } : {};
      const cursor = this.collection.aggregate(pipeline, options);
      return await cursor.toArray();
    } catch (error) {
      throw new StorageError(`Failed to execute aggregation: ${error.message}`, 'AGGREGATION_ERROR', error);
    }
  }

  /**
   * Get database statistics
   */
  async getStats() {
    await this._ensureConnected();
    
    try {
      const [collStats, indexStats] = await Promise.all([
        this.db.command({ collStats: this.collectionName }),
        this.collection.indexStats().toArray()
      ]);
      
      const aggregationPipeline = [
        {
          $group: {
            _id: null,
            uniqueSubjects: { $addToSet: '$subject' },
            uniquePredicates: { $addToSet: '$predicate' },
            totalTriples: { $sum: 1 }
          }
        },
        {
          $project: {
            uniqueSubjects: { $size: '$uniqueSubjects' },
            uniquePredicates: { $size: '$uniquePredicates' },
            totalTriples: 1
          }
        }
      ];
      
      const aggregationResult = await this.aggregate(aggregationPipeline);
      const stats = aggregationResult[0] || {
        uniqueSubjects: 0,
        uniquePredicates: 0,
        totalTriples: 0
      };
      
      return {
        ...stats,
        storageSize: collStats.storageSize,
        indexSize: collStats.totalIndexSize,
        avgObjSize: collStats.avgObjSize,
        indexes: indexStats.length
      };
    } catch (error) {
      throw new StorageError(`Failed to get stats: ${error.message}`, 'STATS_ERROR', error);
    }
  }

  /**
   * Create text index for full-text search
   */
  async createTextIndex() {
    await this._ensureConnected();
    
    try {
      await this.collection.createIndex({
        subject: 'text',
        predicate: 'text',
        'object': 'text'
      }, {
        name: 'text_search_index',
        background: true
      });
    } catch (error) {
      throw new StorageError(`Failed to create text index: ${error.message}`, 'INDEX_ERROR', error);
    }
  }

  /**
   * Perform text search across triples
   */
  async textSearch(searchText, options = {}) {
    await this._ensureConnected();
    
    try {
      const filter = { $text: { $search: searchText } };
      const findOptions = {
        score: { $meta: 'textScore' },
        ...(this.currentSession ? { session: this.currentSession } : {}),
        ...options
      };
      
      const cursor = this.collection.find(filter, findOptions).sort({ score: { $meta: 'textScore' } });
      const documents = await cursor.toArray();
      
      return documents.map(doc => ({
        triple: [doc.subject, doc.predicate, doc.object],
        score: doc.score
      }));
    } catch (error) {
      throw new StorageError(`Failed to perform text search: ${error.message}`, 'SEARCH_ERROR', error);
    }
  }

  /**
   * Close the store and cleanup resources
   */
  async close() {
    await this.disconnect();
  }

  // Private methods

  /**
   * Ensure MongoDB connection is established
   */
  async _ensureConnected() {
    if (!this.connected) {
      await this.connect();
    }
  }

  /**
   * Validate configuration
   */
  _validateConfig() {
    if (!this.connectionString) {
      throw new ValidationError('Connection string is required');
    }
    
    if (!this.databaseName) {
      throw new ValidationError('Database name is required');
    }
    
    if (this.batchSize < 1 || this.batchSize > 10000) {
      throw new ValidationError('Batch size must be between 1 and 10000');
    }
    
    const validIndexStrategies = ['minimal', 'balanced', 'aggressive'];
    if (!validIndexStrategies.includes(this.indexStrategy)) {
      throw new ValidationError(`Index strategy must be one of: ${validIndexStrategies.join(', ')}`);
    }
  }

  /**
   * Extract database name from connection string
   */
  _extractDatabaseName(connectionString) {
    const match = connectionString.match(/\/([^/?]+)(\?|$)/);
    return match ? match[1] : 'knowledge_graph';
  }

  /**
   * Create MongoDB client
   */
  async _createMongoClient() {
    // This would use mongodb library in real implementation
    throw new Error('MongoDB support requires mongodb library');
  }

  /**
   * Create MongoDB indexes based on strategy
   */
  async _createIndexes() {
    const indexes = [];
    
    // Unique compound index for triple uniqueness
    indexes.push({
      key: { subject: 1, predicate: 1, object: 1 },
      options: { unique: true, background: true, name: 'unique_triple' }
    });
    
    // Basic indexes
    indexes.push(
      { key: { subject: 1 }, options: { background: true, name: 'subject_index' } },
      { key: { predicate: 1 }, options: { background: true, name: 'predicate_index' } }
    );
    
    if (this.indexStrategy === 'balanced' || this.indexStrategy === 'aggressive') {
      indexes.push(
        { key: { subject: 1, predicate: 1 }, options: { background: true, name: 'subject_predicate_index' } },
        { key: { predicate: 1, object: 1 }, options: { background: true, name: 'predicate_object_index' } }
      );
    }
    
    if (this.indexStrategy === 'aggressive') {
      indexes.push(
        { key: { subject: 1, object: 1 }, options: { background: true, name: 'subject_object_index' } },
        { key: { object: 1 }, options: { background: true, name: 'object_index' } }
      );
    }
    
    // Create indexes
    for (const { key, options } of indexes) {
      try {
        await this.collection.createIndex(key, options);
      } catch (error) {
        if (!this._isIndexExistsError(error)) {
          throw error;
        }
      }
    }
  }

  /**
   * Setup sharding for the collection
   */
  async _setupSharding() {
    try {
      // Enable sharding on database
      await this.db.admin().command({ enableSharding: this.databaseName });
      
      // Shard the collection on subject field
      await this.db.admin().command({
        shardCollection: `${this.databaseName}.${this.collectionName}`,
        key: { subject: 1 }
      });
    } catch (error) {
      // Ignore if already sharded
      if (!error.message.includes('already sharded')) {
        throw error;
      }
    }
  }

  /**
   * Create a MongoDB document for a triple
   */
  _createTripleDocument(subject, predicate, object) {
    return {
      subject,
      predicate,
      object,
      _tripleHash: this._generateTripleHash(subject, predicate, object),
      createdAt: new Date()
    };
  }

  /**
   * Create a filter for exact triple matching
   */
  _createTripleFilter(subject, predicate, object) {
    return {
      subject,
      predicate,
      object
    };
  }

  /**
   * Build query filter with pattern matching
   */
  _buildQueryFilter(subject, predicate, object) {
    const filter = {};
    
    if (subject !== null && subject !== undefined) {
      filter.subject = subject;
    }
    
    if (predicate !== null && predicate !== undefined) {
      filter.predicate = predicate;
    }
    
    if (object !== null && object !== undefined) {
      filter.object = object;
    }
    
    return filter;
  }

  /**
   * Generate a hash for triple uniqueness
   */
  _generateTripleHash(subject, predicate, object) {
    const content = `${subject}|${predicate}|${JSON.stringify(object)}`;
    // Simple hash function - would use crypto in real implementation
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Check if error is a duplicate key error
   */
  _isDuplicateError(error) {
    return error.code === 11000; // MongoDB duplicate key error
  }

  /**
   * Check if error is an index exists error
   */
  _isIndexExistsError(error) {
    return error.code === 85 || // IndexOptionsConflict
           error.code === 86 || // IndexKeySpecsConflict
           error.message.includes('already exists');
  }
}
