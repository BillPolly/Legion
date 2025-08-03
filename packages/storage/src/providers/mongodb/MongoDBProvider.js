/**
 * MongoDBProvider - MongoDB implementation of the Provider interface
 * 
 * Provides comprehensive MongoDB operations including aggregation,
 * change streams, and MongoDB-specific features.
 */

import { MongoClient } from 'mongodb';
import { Provider } from '../../core/Provider.js';

export class MongoDBProvider extends Provider {
  constructor(config) {
    super(config);
    this.client = null;
    this.db = null;
    this.connectionString = config.connectionString;
    this.databaseName = config.database || this._extractDatabaseFromConnectionString();
  }

  /**
   * Extract database name from connection string
   * @private
   */
  _extractDatabaseFromConnectionString() {
    try {
      const url = new URL(this.connectionString);
      return url.pathname.substring(1) || 'test';
    } catch {
      return 'test';
    }
  }

  /**
   * Connect to MongoDB
   * @returns {Promise<void>}
   */
  async connect() {
    if (this.connected) return;

    this.client = new MongoClient(this.connectionString, {
      maxPoolSize: this.config.maxPoolSize || 10,
      serverSelectionTimeoutMS: this.config.serverSelectionTimeout || 5000,
      ...this.config.clientOptions
    });

    await this.client.connect();
    this.db = this.client.db(this.databaseName);
    this.connected = true;
  }

  /**
   * Disconnect from MongoDB
   * @returns {Promise<void>}
   */
  async disconnect() {
    if (!this.connected) return;

    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
    }
    this.connected = false;
  }

  // CRUD Operations Implementation
  async find(collection, query = {}, options = {}) {
    if (!this.connected) {
      throw new Error('MongoDBProvider: Not connected to database');
    }

    console.log(`[MongoDBProvider] find - db: ${this.db.databaseName}, collection: ${collection}, query:`, query);
    
    const cursor = this.db.collection(collection).find(query);
    
    if (options.sort) cursor.sort(options.sort);
    if (options.skip) cursor.skip(options.skip);
    if (options.limit) cursor.limit(options.limit);
    if (options.projection) cursor.project(options.projection);
    
    const results = await cursor.toArray();
    console.log(`[MongoDBProvider] found ${results.length} documents in ${this.db.databaseName}.${collection}`);
    
    return results;
  }

  async findOne(collection, query = {}, options = {}) {
    const results = await this.find(collection, query, { ...options, limit: 1 });
    return results.length > 0 ? results[0] : null;
  }

  async insert(collection, documents, options = {}) {
    if (!this.connected) {
      throw new Error('MongoDBProvider: Not connected to database');
    }

    const isArray = Array.isArray(documents);
    const docs = isArray ? documents : [documents];
    
    const result = await this.db.collection(collection).insertMany(docs, options);
    
    return {
      acknowledged: result.acknowledged,
      insertedCount: result.insertedCount,
      insertedIds: result.insertedIds
    };
  }

  async update(collection, query, update, options = {}) {
    if (!this.connected) {
      throw new Error('MongoDBProvider: Not connected to database');
    }

    const updateMethod = options.multi ? 'updateMany' : 'updateOne';
    const result = await this.db.collection(collection)[updateMethod](query, update, options);
    
    return {
      acknowledged: result.acknowledged,
      modifiedCount: result.modifiedCount,
      matchedCount: result.matchedCount
    };
  }

  async delete(collection, query, options = {}) {
    if (!this.connected) {
      throw new Error('MongoDBProvider: Not connected to database');
    }

    const result = await this.db.collection(collection).deleteMany(query, options);
    
    return {
      acknowledged: result.acknowledged,
      deletedCount: result.deletedCount
    };
  }

  async count(collection, query = {}, options = {}) {
    if (!this.connected) {
      throw new Error('MongoDBProvider: Not connected to database');
    }

    return await this.db.collection(collection).countDocuments(query, options);
  }

  async listCollections() {
    if (!this.connected) {
      throw new Error('MongoDBProvider: Not connected to database');
    }

    const collections = await this.db.listCollections().toArray();
    return collections.map(col => col.name);
  }

  async dropCollection(collection) {
    if (!this.connected) {
      throw new Error('MongoDBProvider: Not connected to database');
    }

    try {
      await this.db.collection(collection).drop();
      return true;
    } catch (error) {
      // Collection doesn't exist
      if (error.code === 26) {
        return false;
      }
      throw error;
    }
  }

  // MongoDB-specific methods
  async aggregate(collection, pipeline = [], options = {}) {
    if (!this.connected) {
      throw new Error('MongoDBProvider: Not connected to database');
    }

    const cursor = this.db.collection(collection).aggregate(pipeline, options);
    return await cursor.toArray();
  }

  async createIndex(collection, spec, options = {}) {
    if (!this.connected) {
      throw new Error('MongoDBProvider: Not connected to database');
    }

    return await this.db.collection(collection).createIndex(spec, options);
  }

  async watch(collection, pipeline = [], options = {}) {
    if (!this.connected) {
      throw new Error('MongoDBProvider: Not connected to database');
    }

    return this.db.collection(collection).watch(pipeline, options);
  }

  getCapabilities() {
    return [
      ...super.getCapabilities(),
      'aggregate',
      'createIndex',
      'watch',
      'transactions',
      'changeStreams',
      'gridfs'
    ];
  }
}