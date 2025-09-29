/**
 * MongoDataSource - DataSource implementation for MongoDB resources
 * 
 * Provides access to MongoDB collections, documents, and queries through the DataSource interface.
 * Supports querying documents by filters, subscribing to changes via change streams,
 * and validation against MongoDB schemas.
 * 
 * URI Examples:
 * - legion://local/mongodb/mydb/users
 * - legion://server/mongodb/tools/collection
 * - legion://prod/mongodb/analytics/events
 */

import { validateDataSourceInterface } from '@legion/handle/src/DataSource.js';

export class MongoDataSource {
  constructor(context) {
    if (!context || !context.resourceManager) {
      throw new Error('Context with ResourceManager is required');
    }

    this.context = context;
    this.resourceManager = context.resourceManager;
    this.parsed = context.parsed;
    
    // MongoDB-specific path parsing: /database/collection/document?
    const pathParts = this.parsed.path.split('/').filter(p => p.length > 0);
    this.database = pathParts[0] || 'legion';
    this.collection = pathParts[1] || null;
    this.documentId = pathParts[2] || null;
    
    // MongoDB connection and state
    this._mongoClient = null;
    this._database = null;
    this._subscriptions = new Map();
    this._changeStreams = new Map();
    
    // Cached data
    this._schema = null;
    this._metadata = null;
    this._connectionPromise = null;
    
    // Validate interface compliance
    validateDataSourceInterface(this, 'MongoDataSource');
  }

  /**
   * Execute query against MongoDB - SYNCHRONOUS
   * @param {Object} querySpec - Query specification
   * @returns {Array} Query results
   */
  query(querySpec) {
    if (!querySpec || typeof querySpec !== 'object') {
      throw new Error('Query specification must be an object');
    }

    // For synchronous interface, we need to handle async MongoDB operations
    // This is a limitation - MongoDB is inherently async
    // We'll throw an error directing users to use async methods
    throw new Error('MongoDB operations are async - use MongoHandle.queryAsync() instead of sync query()');
  }

  /**
   * Execute async query against MongoDB
   * @param {Object} querySpec - Query specification
   * @returns {Promise<Array>} Query results
   */
  async queryAsync(querySpec) {
    await this._ensureConnection();
    
    if (!this.collection) {
      throw new Error('Collection name is required for MongoDB queries');
    }

    const mongoCollection = this._database.collection(this.collection);
    const results = [];

    try {
      if (querySpec.find === 'all') {
        // Find all documents in collection
        const cursor = mongoCollection.find({});
        const documents = await cursor.toArray();
        return documents.map(doc => ({
          _id: doc._id,
          data: doc,
          collection: this.collection,
          database: this.database
        }));
        
      } else if (querySpec.find && typeof querySpec.find === 'object') {
        // Find documents matching filter
        const cursor = mongoCollection.find(querySpec.find);
        if (querySpec.limit) cursor.limit(querySpec.limit);
        if (querySpec.sort) cursor.sort(querySpec.sort);
        
        const documents = await cursor.toArray();
        return documents.map(doc => ({
          _id: doc._id,
          data: doc,
          collection: this.collection,
          database: this.database
        }));
        
      } else if (querySpec.findOne) {
        // Find single document
        const doc = await mongoCollection.findOne(querySpec.findOne);
        if (doc) {
          return [{
            _id: doc._id,
            data: doc,
            collection: this.collection,
            database: this.database
          }];
        }
        return [];
        
      } else if (querySpec.count) {
        // Count documents
        const count = await mongoCollection.countDocuments(querySpec.count);
        return [{ count, collection: this.collection, database: this.database }];
        
      } else if (querySpec.aggregate) {
        // Aggregation pipeline
        const cursor = mongoCollection.aggregate(querySpec.aggregate);
        const documents = await cursor.toArray();
        return documents.map(doc => ({
          data: doc,
          collection: this.collection,
          database: this.database
        }));
      }

      return [];

    } catch (error) {
      throw new Error(`MongoDB query failed: ${error.message}`);
    }
  }

  /**
   * Set up subscription for MongoDB changes - SYNCHRONOUS
   * @param {Object} querySpec - Query specification to monitor
   * @param {Function} callback - Change notification callback
   * @returns {Object} Subscription object
   */
  subscribe(querySpec, callback) {
    if (!querySpec || typeof querySpec !== 'object') {
      throw new Error('Query specification must be an object');
    }
    
    if (!callback || typeof callback !== 'function') {
      throw new Error('Callback function is required');
    }

    const subscriptionId = Date.now() + Math.random();
    
    // Create subscription object (async setup will happen in background)
    const subscription = {
      id: subscriptionId,
      querySpec,
      callback,
      unsubscribe: () => {
        this._subscriptions.delete(subscriptionId);
        this._stopChangeStream(subscriptionId);
      }
    };

    this._subscriptions.set(subscriptionId, subscription);
    
    // Start change stream asynchronously
    this._startChangeStream(subscriptionId, querySpec, callback);

    return subscription;
  }

  /**
   * Get MongoDB schema - SYNCHRONOUS
   * @returns {Object} Schema describing MongoDB collection structure
   */
  getSchema() {
    if (!this._schema) {
      this._schema = this._generateMongoSchema();
    }
    return this._schema;
  }

  /**
   * Update MongoDB documents - SYNCHRONOUS (throws error directing to async)
   * @param {Object} updateSpec - Update specification
   * @returns {Object} Update result
   */
  update(updateSpec) {
    throw new Error('MongoDB updates are async - use MongoHandle.updateAsync() instead of sync update()');
  }

  /**
   * Update MongoDB documents - ASYNC
   * @param {Object} updateSpec - Update specification
   * @returns {Promise<Object>} Update result
   */
  async updateAsync(updateSpec) {
    await this._ensureConnection();
    
    if (!this.collection) {
      throw new Error('Collection name is required for MongoDB updates');
    }

    const mongoCollection = this._database.collection(this.collection);
    const changes = [];

    try {
      if (updateSpec.insertOne) {
        const result = await mongoCollection.insertOne(updateSpec.insertOne);
        changes.push({
          type: 'insert',
          insertedId: result.insertedId,
          acknowledged: result.acknowledged
        });
      }

      if (updateSpec.insertMany) {
        const result = await mongoCollection.insertMany(updateSpec.insertMany);
        changes.push({
          type: 'insertMany',
          insertedIds: result.insertedIds,
          insertedCount: result.insertedCount
        });
      }

      if (updateSpec.updateOne) {
        const { filter, update, options = {} } = updateSpec.updateOne;
        const result = await mongoCollection.updateOne(filter, update, options);
        changes.push({
          type: 'updateOne',
          matchedCount: result.matchedCount,
          modifiedCount: result.modifiedCount,
          upsertedId: result.upsertedId
        });
      }

      if (updateSpec.updateMany) {
        const { filter, update, options = {} } = updateSpec.updateMany;
        const result = await mongoCollection.updateMany(filter, update, options);
        changes.push({
          type: 'updateMany',
          matchedCount: result.matchedCount,
          modifiedCount: result.modifiedCount
        });
      }

      if (updateSpec.deleteOne) {
        const result = await mongoCollection.deleteOne(updateSpec.deleteOne);
        changes.push({
          type: 'deleteOne',
          deletedCount: result.deletedCount
        });
      }

      if (updateSpec.deleteMany) {
        const result = await mongoCollection.deleteMany(updateSpec.deleteMany);
        changes.push({
          type: 'deleteMany',
          deletedCount: result.deletedCount
        });
      }

      // Notify subscribers of changes
      this._notifySubscribers(changes);

      return {
        success: true,
        changes,
        metadata: {
          collection: this.collection,
          database: this.database,
          timestamp: Date.now()
        }
      };

    } catch (error) {
      throw new Error(`MongoDB update failed: ${error.message}`);
    }
  }

  /**
   * Validate MongoDB data - SYNCHRONOUS
   * @param {*} data - Data to validate
   * @returns {boolean} True if valid
   */
  validate(data) {
    if (data === null || data === undefined) {
      return false;
    }

    // Basic MongoDB document validation
    if (typeof data === 'object') {
      // Valid MongoDB document should be an object
      // Additional schema validation could be added here
      return true;
    }

    return false;
  }

  /**
   * Get MongoDB metadata - SYNCHRONOUS
   * @returns {Object} Metadata about MongoDB resource
   */
  getMetadata() {
    if (!this._metadata) {
      this._metadata = {
        dataSourceType: 'MongoDataSource',
        database: this.database,
        collection: this.collection,
        documentId: this.documentId,
        subscriptionCount: this._subscriptions.size,
        schema: this.getSchema(),
        capabilities: {
          query: true,
          queryAsync: true,
          subscribe: true,
          update: false, // Sync update not supported
          updateAsync: true,
          validate: true,
          queryBuilder: true
        },
        connectionStatus: this._mongoClient ? 'connected' : 'disconnected',
        lastModified: Date.now()
      };
    }
    
    return this._metadata;
  }

  /**
   * Create query builder for MongoDB - SYNCHRONOUS
   * @param {Handle} sourceHandle - Source Handle
   * @returns {Object} MongoDB query builder
   */
  queryBuilder(sourceHandle) {
    if (!sourceHandle) {
      throw new Error('Source Handle is required for query builder');
    }

    return new MongoQueryBuilder(sourceHandle, this);
  }

  // Private helper methods

  /**
   * Ensure MongoDB connection is established
   * @private
   */
  async _ensureConnection() {
    if (this._mongoClient && this._database) {
      return;
    }

    if (this._connectionPromise) {
      return this._connectionPromise;
    }

    this._connectionPromise = this._connect();
    return this._connectionPromise;
  }

  /**
   * Connect to MongoDB
   * @private
   */
  async _connect() {
    try {
      // Get MongoDB connection from ResourceManager using factory caching
      const mongoUrl = this.resourceManager.get('env.MONGODB_URL') || 'mongodb://localhost:27017';
      const connectionKey = `mongo:${mongoUrl}:${this.database}`;
      
      // Use factory caching for connections
      const cachedConnection = await this.context.getCachedConnection(
        connectionKey,
        async () => {
          const { MongoClient } = await import('mongodb');
          const client = new MongoClient(mongoUrl);
          await client.connect();
          return client;
        }
      );

      this._mongoClient = cachedConnection;
      this._database = this._mongoClient.db(this.database);
      
      // Clear cached metadata since connection status changed
      this._metadata = null;

    } catch (error) {
      this._connectionPromise = null;
      throw new Error(`Failed to connect to MongoDB: ${error.message}`);
    }
  }

  /**
   * Start change stream for subscription
   * @param {string} subscriptionId - Subscription ID
   * @param {Object} querySpec - Query specification
   * @param {Function} callback - Change callback
   * @private
   */
  async _startChangeStream(subscriptionId, querySpec, callback) {
    try {
      await this._ensureConnection();
      
      if (!this.collection) {
        return; // Can't watch without collection
      }

      const mongoCollection = this._database.collection(this.collection);
      
      // Create change stream with appropriate pipeline
      const pipeline = this._createChangeStreamPipeline(querySpec);
      const changeStream = mongoCollection.watch(pipeline);
      
      this._changeStreams.set(subscriptionId, changeStream);
      
      changeStream.on('change', (change) => {
        try {
          callback([{
            type: 'change',
            operation: change.operationType,
            documentKey: change.documentKey,
            fullDocument: change.fullDocument,
            updateDescription: change.updateDescription,
            timestamp: change.clusterTime
          }]);
        } catch (error) {
          console.warn('MongoDB change notification failed:', error);
        }
      });

      changeStream.on('error', (error) => {
        console.warn(`Change stream error for subscription ${subscriptionId}:`, error);
        this._changeStreams.delete(subscriptionId);
      });

    } catch (error) {
      console.warn(`Failed to start change stream for subscription ${subscriptionId}:`, error);
    }
  }

  /**
   * Stop change stream for subscription
   * @param {string} subscriptionId - Subscription ID
   * @private
   */
  async _stopChangeStream(subscriptionId) {
    const changeStream = this._changeStreams.get(subscriptionId);
    if (changeStream) {
      try {
        await changeStream.close();
      } catch (error) {
        console.warn(`Error closing change stream ${subscriptionId}:`, error);
      }
      this._changeStreams.delete(subscriptionId);
    }
  }

  /**
   * Create change stream pipeline from query spec
   * @param {Object} querySpec - Query specification
   * @returns {Array} MongoDB change stream pipeline
   * @private
   */
  _createChangeStreamPipeline(querySpec) {
    const pipeline = [];

    if (querySpec.find && typeof querySpec.find === 'object') {
      // Filter changes based on document criteria
      pipeline.push({
        $match: {
          'fullDocument': querySpec.find
        }
      });
    }

    if (querySpec.operations) {
      // Filter by operation types
      pipeline.push({
        $match: {
          'operationType': { $in: querySpec.operations }
        }
      });
    }

    return pipeline;
  }

  /**
   * Generate MongoDB schema
   * @returns {Object} MongoDB schema
   * @private
   */
  _generateMongoSchema() {
    return {
      version: '1.0.0',
      type: 'mongodb',
      database: this.database,
      collection: this.collection,
      attributes: {
        _id: {
          type: 'ObjectId',
          required: true,
          description: 'MongoDB document identifier'
        }
      },
      relationships: {},
      constraints: {
        requiredFields: ['_id']
      },
      indexes: [], // Could be populated from collection stats
      capabilities: [
        'find', 'findOne', 'insertOne', 'insertMany',
        'updateOne', 'updateMany', 'deleteOne', 'deleteMany',
        'aggregate', 'count', 'watch'
      ]
    };
  }

  /**
   * Notify subscribers of changes
   * @param {Array} changes - Array of change objects
   * @private
   */
  _notifySubscribers(changes) {
    for (const subscription of this._subscriptions.values()) {
      try {
        subscription.callback(changes);
      } catch (error) {
        console.warn('MongoDB change notification failed:', error);
      }
    }
  }

  /**
   * Cleanup and close connections
   */
  async shutdown() {
    // Close all change streams
    for (const [subscriptionId] of this._changeStreams) {
      await this._stopChangeStream(subscriptionId);
    }

    // Clear subscriptions
    this._subscriptions.clear();
    this._changeStreams.clear();

    // Note: MongoDB client connection is managed by factory cache
    // Don't close it here as other DataSources might be using it
    this._mongoClient = null;
    this._database = null;
    this._connectionPromise = null;
  }
}

/**
 * MongoDB-specific query builder
 */
class MongoQueryBuilder {
  constructor(sourceHandle, dataSource) {
    this._sourceHandle = sourceHandle;
    this._dataSource = dataSource;
    this._pipeline = [];
    this._options = {};
  }

  /**
   * Add find filter
   * @param {Object} filter - MongoDB filter object
   * @returns {MongoQueryBuilder} Query builder for chaining
   */
  find(filter) {
    this._pipeline.push({ type: 'find', filter });
    return this;
  }

  /**
   * Add limit
   * @param {number} count - Maximum number of documents
   * @returns {MongoQueryBuilder} Query builder for chaining
   */
  limit(count) {
    this._options.limit = count;
    return this;
  }

  /**
   * Add sort
   * @param {Object} sort - MongoDB sort specification
   * @returns {MongoQueryBuilder} Query builder for chaining
   */
  sort(sort) {
    this._options.sort = sort;
    return this;
  }

  /**
   * Add aggregation stage
   * @param {Object} stage - MongoDB aggregation stage
   * @returns {MongoQueryBuilder} Query builder for chaining
   */
  aggregate(stage) {
    this._pipeline.push({ type: 'aggregate', stage });
    return this;
  }

  /**
   * Execute query and return first result
   * @returns {Promise<Handle>} Handle for first document
   */
  async first() {
    const querySpec = this._buildQuerySpec();
    querySpec.limit = 1;
    
    const results = await this._dataSource.queryAsync(querySpec);
    return results.length > 0 ? this._createDocumentHandle(results[0]) : null;
  }

  /**
   * Execute query and return all results
   * @returns {Promise<Array<Handle>>} Array of document Handles
   */
  async toArray() {
    const querySpec = this._buildQuerySpec();
    const results = await this._dataSource.queryAsync(querySpec);
    
    return results.map(result => this._createDocumentHandle(result));
  }

  /**
   * Count matching documents
   * @returns {Promise<number>} Count of matching documents
   */
  async count() {
    const countSpec = {
      count: this._buildFilter()
    };
    
    const results = await this._dataSource.queryAsync(countSpec);
    return results.length > 0 ? results[0].count : 0;
  }

  /**
   * Build query specification from operations
   * @returns {Object} Query specification
   * @private
   */
  _buildQuerySpec() {
    const findOperations = this._pipeline.filter(op => op.type === 'find');
    const aggregateOperations = this._pipeline.filter(op => op.type === 'aggregate');
    
    if (aggregateOperations.length > 0) {
      return {
        aggregate: aggregateOperations.map(op => op.stage),
        ...this._options
      };
    }
    
    if (findOperations.length > 0) {
      return {
        find: this._buildFilter(),
        ...this._options
      };
    }
    
    return { find: 'all', ...this._options };
  }

  /**
   * Build filter from find operations
   * @returns {Object} MongoDB filter
   * @private
   */
  _buildFilter() {
    const findOps = this._pipeline.filter(op => op.type === 'find');
    
    if (findOps.length === 0) return {};
    if (findOps.length === 1) return findOps[0].filter;
    
    // Combine multiple filters with $and
    return { $and: findOps.map(op => op.filter) };
  }

  /**
   * Create Handle for document
   * @param {Object} document - Document data
   * @returns {Handle} Document Handle
   * @private
   */
  _createDocumentHandle(document) {
    return {
      _id: document._id,
      data: document.data,
      collection: document.collection,
      database: document.database,
      uri: `legion://local/mongodb/${document.database}/${document.collection}/${document._id}`,
      
      // Handle-like methods
      get(field) {
        return field ? document.data[field] : document.data;
      },
      
      async set(field, value) {
        const updateSpec = { updateOne: { 
          filter: { _id: document._id },
          update: { $set: { [field]: value } }
        }};
        return this._dataSource.updateAsync(updateSpec);
      },
      
      toURI() {
        return `legion://local/mongodb/${document.database}/${document.collection}/${document._id}`;
      }
    };
  }
}