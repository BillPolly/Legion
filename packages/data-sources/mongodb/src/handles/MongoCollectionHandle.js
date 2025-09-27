/**
 * MongoCollectionHandle - Represents a MongoDB collection
 * 
 * This handle provides collection-level operations including:
 * - CRUD operations (find, insert, update, delete)
 * - Aggregation pipelines
 * - Index management
 * - Collection-wide change streams
 * - Document projection (creating document handles)
 */

import { Handle } from '@legion/handle';
import { MongoDocumentHandle } from './MongoDocumentHandle.js';
import { QueryBuilder } from '../query/QueryBuilder.js';

export class MongoCollectionHandle extends Handle {
  constructor(dataSource, dbName, collectionName) {
    super(dataSource);
    
    if (!dbName) {
      throw new Error('Database name is required');
    }
    if (!collectionName) {
      throw new Error('Collection name is required');
    }
    
    this.database = dbName;
    this.collection = collectionName;
  }
  
  /**
   * Get collection statistics
   * @returns {QueryResultHandle} Collection statistics
   */
  value() {
    return this.dataSource.query({
      level: 'collection',
      database: this.database,
      collection: this.collection,
      operation: 'stats'
    });
  }
  
  /**
   * Find documents in collection
   * @param {Object} filter - MongoDB filter query
   * @param {Object} options - Query options
   * @returns {QueryResultHandle} Query results
   */
  find(filter = {}, options = {}) {
    return this.dataSource.query({
      level: 'collection',
      database: this.database,
      collection: this.collection,
      operation: 'find',
      filter,
      projection: options.projection,
      sort: options.sort,
      limit: options.limit,
      skip: options.skip,
      options: options
    });
  }
  
  /**
   * Find single document in collection
   * @param {Object} filter - MongoDB filter query
   * @param {Object} options - Query options
   * @returns {QueryResultHandle} Single document result
   */
  findOne(filter = {}, options = {}) {
    return this.dataSource.query({
      level: 'collection',
      database: this.database,
      collection: this.collection,
      operation: 'findOne',
      filter,
      projection: options.projection,
      options: options
    });
  }
  
  /**
   * Run aggregation pipeline on collection
   * @param {Array} pipeline - MongoDB aggregation pipeline
   * @param {Object} options - Aggregation options
   * @returns {QueryResultHandle} Aggregation results
   */
  aggregate(pipeline, options = {}) {
    if (!Array.isArray(pipeline)) {
      throw new Error('Pipeline must be an array');
    }
    
    return this.dataSource.query({
      level: 'collection',
      database: this.database,
      collection: this.collection,
      operation: 'aggregate',
      pipeline,
      options
    });
  }
  
  /**
   * Count documents matching filter
   * @param {Object} filter - MongoDB filter query
   * @param {Object} options - Count options
   * @returns {QueryResultHandle} Document count
   */
  countDocuments(filter = {}, options = {}) {
    return this.dataSource.query({
      level: 'collection',
      database: this.database,
      collection: this.collection,
      operation: 'count',
      filter,
      options
    });
  }
  
  /**
   * Get distinct values for field
   * @param {string} field - Field name
   * @param {Object} filter - MongoDB filter query
   * @param {Object} options - Distinct options
   * @returns {QueryResultHandle} Distinct values
   */
  distinct(field, filter = {}, options = {}) {
    if (!field) {
      throw new Error('Field name is required for distinct operation');
    }
    
    return this.dataSource.query({
      level: 'collection',
      database: this.database,
      collection: this.collection,
      operation: 'distinct',
      field,
      filter,
      options
    });
  }
  
  /**
   * Insert single document
   * @param {Object} document - Document to insert
   * @param {Object} options - Insert options
   * @returns {UpdateResultHandle} Insert result
   */
  insertOne(document, options = {}) {
    if (!document) {
      throw new Error('Document is required for insert');
    }
    
    return this.dataSource.update({
      level: 'collection',
      database: this.database,
      collection: this.collection,
      operation: 'insert',
      documents: [document],
      options
    });
  }
  
  /**
   * Insert multiple documents
   * @param {Array} documents - Documents to insert
   * @param {Object} options - Insert options
   * @returns {UpdateResultHandle} Insert result
   */
  insertMany(documents, options = {}) {
    if (!Array.isArray(documents) || documents.length === 0) {
      throw new Error('Documents array is required for insertMany');
    }
    
    return this.dataSource.update({
      level: 'collection',
      database: this.database,
      collection: this.collection,
      operation: 'insertMany',
      documents,
      options
    });
  }
  
  /**
   * Update single document
   * @param {Object} filter - MongoDB filter query
   * @param {Object} update - Update operations
   * @param {Object} options - Update options
   * @returns {UpdateResultHandle} Update result
   */
  updateOne(filter, update, options = {}) {
    if (!filter) {
      throw new Error('Filter is required for update');
    }
    if (!update) {
      throw new Error('Update operations are required');
    }
    
    return this.dataSource.update({
      level: 'collection',
      database: this.database,
      collection: this.collection,
      operation: 'updateOne',
      filter,
      update,
      options
    });
  }
  
  /**
   * Update multiple documents
   * @param {Object} filter - MongoDB filter query
   * @param {Object} update - Update operations
   * @param {Object} options - Update options
   * @returns {UpdateResultHandle} Update result
   */
  updateMany(filter, update, options = {}) {
    if (!filter) {
      throw new Error('Filter is required for update');
    }
    if (!update) {
      throw new Error('Update operations are required');
    }
    
    return this.dataSource.update({
      level: 'collection',
      database: this.database,
      collection: this.collection,
      operation: 'updateMany',
      filter,
      update,
      options
    });
  }
  
  /**
   * Replace document completely
   * @param {Object} filter - MongoDB filter query
   * @param {Object} replacement - Replacement document
   * @param {Object} options - Replace options
   * @returns {UpdateResultHandle} Replace result
   */
  replaceOne(filter, replacement, options = {}) {
    if (!filter) {
      throw new Error('Filter is required for replace');
    }
    if (!replacement) {
      throw new Error('Replacement document is required');
    }
    
    return this.dataSource.update({
      level: 'collection',
      database: this.database,
      collection: this.collection,
      operation: 'replaceOne',
      filter,
      replacement,
      options
    });
  }
  
  /**
   * Delete single document
   * @param {Object} filter - MongoDB filter query
   * @param {Object} options - Delete options
   * @returns {UpdateResultHandle} Delete result
   */
  deleteOne(filter, options = {}) {
    if (!filter) {
      throw new Error('Filter is required for delete');
    }
    
    return this.dataSource.update({
      level: 'collection',
      database: this.database,
      collection: this.collection,
      operation: 'deleteOne',
      filter,
      options
    });
  }
  
  /**
   * Delete multiple documents
   * @param {Object} filter - MongoDB filter query
   * @param {Object} options - Delete options
   * @returns {UpdateResultHandle} Delete result
   */
  deleteMany(filter, options = {}) {
    if (!filter) {
      throw new Error('Filter is required for delete');
    }
    
    return this.dataSource.update({
      level: 'collection',
      database: this.database,
      collection: this.collection,
      operation: 'deleteMany',
      filter,
      options
    });
  }
  
  /**
   * Find and modify operations
   */
  
  /**
   * Find and update document atomically
   * @param {Object} filter - MongoDB filter query
   * @param {Object} update - Update operations
   * @param {Object} options - FindAndModify options
   * @returns {UpdateResultHandle} Updated document
   */
  findOneAndUpdate(filter, update, options = {}) {
    if (!filter) {
      throw new Error('Filter is required for findOneAndUpdate');
    }
    if (!update) {
      throw new Error('Update operations are required');
    }
    
    return this.dataSource.update({
      level: 'collection',
      database: this.database,
      collection: this.collection,
      operation: 'findOneAndUpdate',
      filter,
      update,
      options
    });
  }
  
  /**
   * Find and replace document atomically
   * @param {Object} filter - MongoDB filter query
   * @param {Object} replacement - Replacement document
   * @param {Object} options - FindAndReplace options
   * @returns {UpdateResultHandle} Replaced document
   */
  findOneAndReplace(filter, replacement, options = {}) {
    if (!filter) {
      throw new Error('Filter is required for findOneAndReplace');
    }
    if (!replacement) {
      throw new Error('Replacement document is required');
    }
    
    return this.dataSource.update({
      level: 'collection',
      database: this.database,
      collection: this.collection,
      operation: 'findOneAndReplace',
      filter,
      replacement,
      options
    });
  }
  
  /**
   * Find and delete document atomically
   * @param {Object} filter - MongoDB filter query
   * @param {Object} options - FindAndDelete options
   * @returns {UpdateResultHandle} Deleted document
   */
  findOneAndDelete(filter, options = {}) {
    if (!filter) {
      throw new Error('Filter is required for findOneAndDelete');
    }
    
    return this.dataSource.update({
      level: 'collection',
      database: this.database,
      collection: this.collection,
      operation: 'findOneAndDelete',
      filter,
      options
    });
  }
  
  /**
   * Bulk write operations
   * @param {Array} operations - Array of write operations
   * @param {Object} options - Bulk write options
   * @returns {UpdateResultHandle} Bulk write result
   */
  bulkWrite(operations, options = {}) {
    if (!Array.isArray(operations) || operations.length === 0) {
      throw new Error('Operations array is required for bulkWrite');
    }
    
    return this.dataSource.update({
      level: 'collection',
      database: this.database,
      collection: this.collection,
      operation: 'bulkWrite',
      operations,
      options
    });
  }
  
  /**
   * Index management
   */
  
  /**
   * Create index on collection
   * @param {Object} keys - Index key specification
   * @param {Object} options - Index options
   * @returns {UpdateResultHandle} Index creation result
   */
  createIndex(keys, options = {}) {
    if (!keys || Object.keys(keys).length === 0) {
      throw new Error('Index keys are required');
    }
    
    return this.dataSource.update({
      level: 'collection',
      database: this.database,
      collection: this.collection,
      operation: 'createIndex',
      keys,
      indexOptions: options
    });
  }
  
  /**
   * Drop index from collection
   * @param {string|Object} indexName - Index name or specification
   * @returns {UpdateResultHandle} Index drop result
   */
  dropIndex(indexName) {
    if (!indexName) {
      throw new Error('Index name is required');
    }
    
    return this.dataSource.update({
      level: 'collection',
      database: this.database,
      collection: this.collection,
      operation: 'dropIndex',
      indexName
    });
  }
  
  /**
   * Drop all indexes from collection
   * @returns {UpdateResultHandle} Drop result
   */
  dropIndexes() {
    return this.dataSource.update({
      level: 'collection',
      database: this.database,
      collection: this.collection,
      operation: 'dropIndexes'
    });
  }
  
  /**
   * List all indexes on collection
   * @returns {QueryResultHandle} Index list
   */
  indexes() {
    return this.dataSource.query({
      level: 'collection',
      database: this.database,
      collection: this.collection,
      operation: 'indexes'
    });
  }
  
  /**
   * Collection management
   */
  
  /**
   * Drop collection
   * @returns {UpdateResultHandle} Drop result
   */
  drop() {
    return this.dataSource.update({
      level: 'collection',
      database: this.database,
      collection: this.collection,
      operation: 'dropCollection'
    });
  }
  
  /**
   * Get estimated document count (fast, uses metadata)
   * @param {Object} options - Count options
   * @returns {QueryResultHandle} Estimated count
   */
  estimatedDocumentCount(options = {}) {
    return this.dataSource.query({
      level: 'collection',
      database: this.database,
      collection: this.collection,
      operation: 'estimatedDocumentCount',
      options
    });
  }
  
  /**
   * Query Builder
   */
  
  /**
   * Create a query builder for this collection
   * @returns {QueryBuilder} Query builder instance
   */
  query() {
    return new QueryBuilder(this.dataSource, this.database, this.collection);
  }
  
  /**
   * Document handle projection
   */
  
  /**
   * Get document handle by ID
   * @param {*} id - Document ID (string or ObjectId)
   * @returns {MongoDocumentHandle} Document handle
   */
  document(id) {
    if (!id) {
      throw new Error('Document ID is required');
    }
    
    return new MongoDocumentHandle(this.dataSource, this.database, this.collection, id);
  }
  
  /**
   * Change streams
   */
  
  /**
   * Watch collection for changes
   * @param {Array} pipeline - Aggregation pipeline for filtering changes
   * @param {Function} callback - Callback for change events
   * @param {Object} options - Change stream options
   * @returns {SubscriptionHandle} Subscription handle
   */
  watch(pipeline, callback, options) {
    // Handle overloaded parameters
    if (typeof pipeline === 'function') {
      options = callback;
      callback = pipeline;
      pipeline = [];
    }
    
    if (!pipeline) {
      pipeline = [];
    }
    
    if (!options) {
      options = {};
    }
    
    return this.dataSource.subscribe({
      level: 'collection',
      database: this.database,
      collection: this.collection,
      pipeline,
      changeStream: true,
      options,
      callback
    });
  }
}