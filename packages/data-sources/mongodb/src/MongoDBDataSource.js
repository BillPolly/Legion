/**
 * MongoDBDataSource - MongoDB implementation of the DataSource interface
 */

import { MongoClient } from 'mongodb';
import { validateDataSourceInterface } from './utils/validation.js';
import { QueryResultHandle } from './handles/QueryResultHandle.js';
import { UpdateResultHandle } from './handles/UpdateResultHandle.js';
import { SubscriptionHandle } from './handles/SubscriptionHandle.js';
import { MongoServerHandle } from './handles/MongoServerHandle.js';
import { MongoDatabaseHandle } from './handles/MongoDatabaseHandle.js';
import { MongoCollectionHandle } from './handles/MongoCollectionHandle.js';
import { MongoDocumentHandle } from './handles/MongoDocumentHandle.js';
import { 
  discoverCollectionSchema, 
  discoverDatabaseSchemas, 
  discoverServerSchemas 
} from './utils/schemaDiscovery.js';
import { validateAgainstSchema, validateMongoDocument } from './utils/schemaValidation.js';

export class MongoDBDataSource {
  constructor(config = {}) {
    // Handle both string (connection string) and object (config) parameters
    if (typeof config === 'string') {
      this.connectionString = config;
      this.options = {};
    } else {
      // Configuration object
      this.connectionString = config.connectionString || 'mongodb://localhost:27017';
      this.options = config.options || {};
    }
    
    // MongoDB client and connection state
    this.client = null;
    this.connected = false;
    
    // Subscription and change stream management
    this._subscriptions = new Map();
    this._changeStreams = new Map();
    this._subscriptionId = 0;
    
    // Schema cache for introspection
    this._schemaCache = null;
    this._schemaCacheTime = 0;
    this._schemaCacheTTL = (typeof config === 'object' ? config.schemaCacheTTL : undefined) || 60000; // 1 minute
    
    // Validate DataSource interface compliance
    validateDataSourceInterface(this, 'MongoDBDataSource');
  }
  
  /**
   * Initialize MongoDB client (lazy initialization)
   * @private
   */
  _ensureClient() {
    if (!this.client) {
      const clientOptions = {
        ...this.options,
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000
      };
      this.client = new MongoClient(this.connectionString, clientOptions);
    }
  }
  
  /**
   * REQUIRED: Execute query against MongoDB
   * Returns a Handle immediately with correct prototype.
   * Data is populated asynchronously via callbacks.
   * CRITICAL: Synchronous return - no await!
   */
  query(querySpec) {
    this._validateQuerySpec(querySpec);
    this._ensureClient();
    
    // Return Handle immediately with correct prototype
    // The Handle will populate itself asynchronously
    return new QueryResultHandle(this, querySpec);
  }
  
  /**
   * REQUIRED: Set up subscription for change notifications via MongoDB Change Streams
   * Returns a SubscriptionHandle immediately.
   * Change events are delivered asynchronously via callbacks.
   * CRITICAL: Synchronous return - no await!
   */
  subscribe(subscriptionSpec) {
    this._validateSubscriptionSpec(subscriptionSpec);
    this._ensureClient();
    
    // Return SubscriptionHandle immediately
    // The Handle will start listening to changes asynchronously
    return new SubscriptionHandle(this, subscriptionSpec);
  }
  
  /**
   * REQUIRED: Get resource schema for introspection
   * Returns cached schema if available and fresh, otherwise returns basic schema
   * Actual schema discovery happens asynchronously via discoverSchema()
   * CRITICAL: Must be synchronous - no await!
   */
  getSchema() {
    // Return cached schema if available and fresh
    if (this._schemaCache && (Date.now() - this._schemaCacheTime) < this._schemaCacheTTL) {
      return this._schemaCache;
    }
    
    // Return basic schema structure
    // Use discoverSchema() method for full schema discovery
    return {
      type: 'mongodb',
      version: '6.0.0',
      databases: {},
      capabilities: {
        transactions: true,
        changeStreams: true,
        aggregation: true
      },
      cached: false,
      message: 'Use discoverSchema() for full schema discovery'
    };
  }
  
  /**
   * Discover and cache schema for specified level
   * This is an async helper method for schema discovery
   * @param {Object} options - Discovery options
   * @returns {Promise<Object>} Discovered schema
   */
  async discoverSchema(options = {}) {
    const {
      level = 'server',
      database = null,
      collection = null,
      refresh = false
    } = options;
    
    // Return cache if fresh and not forcing refresh
    if (!refresh && this._schemaCache && (Date.now() - this._schemaCacheTime) < this._schemaCacheTTL) {
      return this._schemaCache;
    }
    
    this._ensureClient();
    
    let schema;
    
    switch (level) {
      case 'server':
        const serverSchemas = await discoverServerSchemas(this.client, options);
        schema = {
          type: 'mongodb',
          version: '6.0.0',
          databases: serverSchemas,
          capabilities: {
            transactions: true,
            changeStreams: true,
            aggregation: true
          }
        };
        break;
      
      case 'database':
        if (!database) {
          throw new Error('Database name is required for database-level schema discovery');
        }
        const db = this.client.db(database);
        const dbSchemas = await discoverDatabaseSchemas(db, options);
        schema = {
          type: 'mongodb',
          version: '6.0.0',
          database: database,
          collections: dbSchemas,
          capabilities: {
            transactions: true,
            changeStreams: true,
            aggregation: true
          }
        };
        break;
      
      case 'collection':
        if (!database || !collection) {
          throw new Error('Database and collection names are required for collection-level schema discovery');
        }
        const coll = this.client.db(database).collection(collection);
        const collSchema = await discoverCollectionSchema(coll, options);
        schema = {
          type: 'mongodb',
          version: '6.0.0',
          database: database,
          collection: collection,
          ...collSchema
        };
        break;
      
      default:
        throw new Error(`Invalid schema discovery level: ${level}`);
    }
    
    // Cache the result
    this._schemaCache = schema;
    this._schemaCacheTime = Date.now();
    
    return schema;
  }
  
  /**
   * Clear schema cache
   * Forces next getSchema() or discoverSchema() to fetch fresh data
   */
  clearSchemaCache() {
    this._schemaCache = null;
    this._schemaCacheTime = 0;
  }
  
  /**
   * OPTIONAL: Update resource data
   * Returns an UpdateResultHandle immediately with correct prototype.
   * Data is populated asynchronously via callbacks.
   * CRITICAL: Synchronous return - no await!
   */
  update(updateSpec) {
    this._validateUpdateSpec(updateSpec);
    this._ensureClient();
    
    // Return UpdateResultHandle immediately
    // The Handle will populate itself asynchronously
    return new UpdateResultHandle(this, updateSpec);
  }
  
  /**
   * OPTIONAL: Validate data against schema
   * Validates data against cached schema if available
   * Can also validate against MongoDB document rules
   * CRITICAL: Must be synchronous - no await!
   */
  validate(data, options = {}) {
    const {
      useSchema = true,
      validateDocument = true
    } = options;
    
    const allErrors = [];
    
    // Validate MongoDB document structure
    if (validateDocument) {
      const docResult = validateMongoDocument(data);
      allErrors.push(...docResult.errors);
    }
    
    // Validate against cached schema if available and requested
    if (useSchema && this._schemaCache && this._schemaCache.schema) {
      const schemaResult = validateAgainstSchema(data, this._schemaCache.schema);
      allErrors.push(...schemaResult.errors);
    }
    
    return {
      valid: allErrors.length === 0,
      errors: allErrors
    };
  }
  
  /**
   * Validate data against a specific schema
   * Helper method for validating against custom schemas
   * @param {*} data - Data to validate
   * @param {Object} schema - JSON Schema to validate against
   * @returns {Object} Validation result
   */
  validateAgainstCustomSchema(data, schema) {
    return validateAgainstSchema(data, schema);
  }
  
  /**
   * REQUIRED: Create query builder for Handle
   * CRITICAL: Must be synchronous - no await!
   */
  queryBuilder(sourceHandle) {
    // Will be implemented in Phase 10
    if (!sourceHandle) {
      throw new Error('Source Handle is required for query builder');
    }
    
    return {
      where: () => this,
      select: () => this,
      toArray: () => []
    };
  }
  
  /**
   * Create a server handle
   * @returns {MongoServerHandle} Server handle
   */
  server() {
    this._ensureClient();
    return new MongoServerHandle(this);
  }
  
  /**
   * Create a database handle
   * @param {string} dbName - Database name
   * @returns {MongoDatabaseHandle} Database handle
   */
  database(dbName) {
    this._ensureClient();
    return new MongoDatabaseHandle(this, dbName);
  }
  
  /**
   * Create a collection handle
   * @param {string} dbName - Database name
   * @param {string} collectionName - Collection name
   * @returns {MongoCollectionHandle} Collection handle
   */
  collection(dbName, collectionName) {
    this._ensureClient();
    return new MongoCollectionHandle(this, dbName, collectionName);
  }
  
  /**
   * Create a document handle
   * @param {string} dbName - Database name
   * @param {string} collectionName - Collection name
   * @param {*} documentId - Document ID
   * @returns {MongoDocumentHandle} Document handle
   */
  document(dbName, collectionName, documentId) {
    this._ensureClient();
    return new MongoDocumentHandle(this, dbName, collectionName, documentId);
  }
  
  /**
   * Validate query specification
   * @private
   */
  _validateQuerySpec(querySpec) {
    if (!querySpec || typeof querySpec !== 'object') {
      throw new Error('Query specification must be an object');
    }
    
    if (!querySpec.level) {
      throw new Error('Query level is required');
    }
    
    const validLevels = ['server', 'database', 'collection', 'document'];
    if (!validLevels.includes(querySpec.level)) {
      throw new Error(`Invalid query level: ${querySpec.level}. Must be one of: ${validLevels.join(', ')}`);
    }
    
    // Level-specific validation
    switch (querySpec.level) {
      case 'database':
        if (!querySpec.database && querySpec.operation !== 'listDatabases') {
          throw new Error('Database name is required for database operations');
        }
        break;
      
      case 'collection':
        if (!querySpec.database) {
          throw new Error('Database name is required for collection operations');
        }
        if (!querySpec.collection && querySpec.operation !== 'listCollections') {
          throw new Error('Collection name is required for collection operations');
        }
        // Validate collection operations
        this._validateCollectionOperation(querySpec);
        break;
      
      case 'document':
        if (!querySpec.database || !querySpec.collection) {
          throw new Error('Database and collection are required for document operations');
        }
        break;
    }
    
    if (!querySpec.operation) {
      throw new Error('Operation is required');
    }
  }
  
  /**
   * Validate collection-level operation specifics
   * @private
   */
  _validateCollectionOperation(querySpec) {
    const { operation } = querySpec;
    
    // Validate operation is supported
    const validOperations = ['find', 'findOne', 'aggregate', 'count', 'distinct', 'stats', 'indexes', 'exists'];
    if (!validOperations.includes(operation)) {
      throw new Error(`Unsupported collection operation: ${operation}`);
    }
    
    // Operation-specific validation
    if (operation === 'distinct') {
      if (!querySpec.field) {
        throw new Error('Field is required for distinct operation');
      }
    }
  }
  
  /**
   * Validate update specification
   * @private
   */
  _validateUpdateSpec(updateSpec) {
    if (!updateSpec || typeof updateSpec !== 'object') {
      throw new Error('Update specification must be an object');
    }
    
    if (!updateSpec.level) {
      throw new Error('Update level is required');
    }
    
    const validLevels = ['server', 'database', 'collection', 'document'];
    if (!validLevels.includes(updateSpec.level)) {
      throw new Error(`Invalid update level: ${updateSpec.level}. Must be one of: ${validLevels.join(', ')}`);
    }
    
    if (!updateSpec.operation) {
      throw new Error('Operation is required for update');
    }
    
    // Level-specific validation
    switch (updateSpec.level) {
      case 'database':
        if (!updateSpec.database) {
          throw new Error('Database name is required for database update operations');
        }
        break;
      
      case 'collection':
        if (!updateSpec.database || !updateSpec.collection) {
          throw new Error('Database and collection are required for collection update operations');
        }
        break;
      
      case 'document':
        if (!updateSpec.database || !updateSpec.collection) {
          throw new Error('Database and collection are required for document update operations');
        }
        break;
    }
  }
  
  /**
   * Validate subscription specification
   * @private
   */
  _validateSubscriptionSpec(subscriptionSpec) {
    if (!subscriptionSpec || typeof subscriptionSpec !== 'object') {
      throw new Error('Subscription specification must be an object');
    }
    
    if (!subscriptionSpec.level) {
      throw new Error('Subscription level is required');
    }
    
    const validLevels = ['server', 'database', 'collection'];
    if (!validLevels.includes(subscriptionSpec.level)) {
      throw new Error(`Invalid subscription level: ${subscriptionSpec.level}. Must be one of: ${validLevels.join(', ')}`);
    }
    
    // Level-specific validation
    switch (subscriptionSpec.level) {
      case 'database':
        if (!subscriptionSpec.database) {
          throw new Error('Database name is required for database-level subscriptions');
        }
        break;
      
      case 'collection':
        if (!subscriptionSpec.database || !subscriptionSpec.collection) {
          throw new Error('Database and collection are required for collection-level subscriptions');
        }
        break;
    }
    
    // Validate pipeline if provided
    if (subscriptionSpec.pipeline && !Array.isArray(subscriptionSpec.pipeline)) {
      throw new Error('Pipeline must be an array');
    }
  }
  
  /**
   * Connect to MongoDB
   * Async method for establishing connection
   */
  async connect() {
    this._ensureClient();
    if (!this.connected) {
      await this.client.connect();
      this.connected = true;
    }
  }
  
  /**
   * Disconnect from MongoDB
   * Async method for cleanup
   */
  async disconnect() {
    if (this.client) {
      try {
        await this.client.close();
      } catch (error) {
        console.error('Error closing MongoDB connection:', error);
      }
      this.client = null;
      this.connected = false;
    }
  }
}