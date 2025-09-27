/**
 * MongoDocumentHandle - Represents a specific MongoDB document
 * 
 * This handle provides document-level operations including:
 * - Document retrieval and existence checking
 * - Field-level access and manipulation
 * - Document updates (set, unset, increment, rename)
 * - Array operations (push, pull, addToSet, pop)
 * - Atomic operations (findAndUpdate, findAndReplace, findAndDelete)
 * - Document replacement and deletion
 * 
 * All operations follow the synchronous Handle pattern, returning
 * handles immediately that populate with data asynchronously.
 */

import { Handle } from '@legion/handle';
import { ObjectId } from 'mongodb';

export class MongoDocumentHandle extends Handle {
  constructor(dataSource, dbName, collectionName, documentId) {
    super(dataSource);
    
    // Validate inputs
    if (!dbName) {
      throw new Error('Database name is required');
    }
    if (!collectionName) {
      throw new Error('Collection name is required');
    }
    if (documentId === null || documentId === undefined) {
      throw new Error('Document ID is required');
    }
    
    this.database = dbName;
    this.collection = collectionName;
    this.documentId = this._normalizeId(documentId);
  }
  
  /**
   * Normalize ID to proper MongoDB format
   * @param {*} id - Document ID
   * @returns {*} Normalized ID as ObjectId instance
   */
  _normalizeId(id) {
    // Convert string IDs to ObjectId instances
    if (typeof id === 'string' && id.match(/^[0-9a-fA-F]{24}$/)) {
      return new ObjectId(id);
    }
    
    // Convert extended JSON format to ObjectId instances
    if (id && typeof id === 'object' && id.$oid) {
      return new ObjectId(id.$oid);
    }
    
    // If already an ObjectId or other type, return as-is
    return id;
  }
  
  /**
   * Get the complete document
   * @returns {QueryResultHandle} Document data
   */
  value() {
    return this.dataSource.query({
      level: 'collection',
      database: this.database,
      collection: this.collection,
      operation: 'findOne',
      filter: { _id: this.documentId }
    });
  }
  
  /**
   * Check if document exists
   * @returns {QueryResultHandle} Boolean indicating existence
   */
  exists() {
    return this.dataSource.query({
      level: 'collection',
      database: this.database,
      collection: this.collection,
      operation: 'exists',
      filter: { _id: this.documentId }
    });
  }
  
  /**
   * Get specific field value
   * @param {string} fieldPath - Dot-notation path to field
   * @returns {QueryResultHandle} Field value
   */
  field(fieldPath) {
    // Create a query handle that will extract the field value
    const handle = this.dataSource.query({
      level: 'collection',
      database: this.database,
      collection: this.collection,
      operation: 'findOne',
      filter: { _id: this.documentId },
      projection: { [fieldPath]: 1, _id: 0 }
    });
    
    // Wrap the original handle to extract the field value
    const originalOnData = handle.onData.bind(handle);
    handle.onData = (callback) => {
      originalOnData((doc) => {
        if (!doc) {
          callback(undefined);
          return;
        }
        
        // Extract nested field value
        const parts = fieldPath.split('.');
        let value = doc;
        for (const part of parts) {
          value = value?.[part];
        }
        callback(value);
      });
    };
    
    return handle;
  }
  
  /**
   * Get multiple field values
   * @param {Array<string>} fieldPaths - Array of field paths
   * @returns {QueryResultHandle} Object with field values
   */
  fields(fieldPaths) {
    const projection = {};
    for (const field of fieldPaths) {
      projection[field] = 1;
    }
    projection._id = 0; // Exclude _id
    
    return this.dataSource.query({
      level: 'collection',
      database: this.database,
      collection: this.collection,
      operation: 'findOne',
      filter: { _id: this.documentId },
      projection
    });
  }
  
  /**
   * Get document with projection
   * @param {Object} projection - MongoDB projection
   * @returns {QueryResultHandle} Projected document
   */
  project(projection) {
    return this.dataSource.query({
      level: 'collection',
      database: this.database,
      collection: this.collection,
      operation: 'findOne',
      filter: { _id: this.documentId },
      projection
    });
  }
  
  /**
   * Update entire document (replaces all fields)
   * @param {Object} document - New document data
   * @returns {UpdateResultHandle} Update result
   */
  update(document) {
    return this.dataSource.update({
      level: 'collection',
      database: this.database,
      collection: this.collection,
      operation: 'updateOne',
      filter: { _id: this.documentId },
      update: { $set: document }
    });
  }
  
  /**
   * Set specific fields
   * @param {Object} fields - Fields to set
   * @returns {UpdateResultHandle} Update result
   */
  set(fields) {
    return this.dataSource.update({
      level: 'collection',
      database: this.database,
      collection: this.collection,
      operation: 'updateOne',
      filter: { _id: this.documentId },
      update: { $set: fields }
    });
  }
  
  /**
   * Unset (remove) fields
   * @param {Array<string>} fieldPaths - Field paths to remove
   * @returns {UpdateResultHandle} Update result
   */
  unset(fieldPaths) {
    const unsetObj = {};
    for (const field of fieldPaths) {
      unsetObj[field] = '';
    }
    
    return this.dataSource.update({
      level: 'collection',
      database: this.database,
      collection: this.collection,
      operation: 'updateOne',
      filter: { _id: this.documentId },
      update: { $unset: unsetObj }
    });
  }
  
  /**
   * Increment numeric fields
   * @param {Object} increments - Fields and increment values
   * @returns {UpdateResultHandle} Update result
   */
  increment(increments) {
    return this.dataSource.update({
      level: 'collection',
      database: this.database,
      collection: this.collection,
      operation: 'updateOne',
      filter: { _id: this.documentId },
      update: { $inc: increments }
    });
  }
  
  /**
   * Rename fields
   * @param {Object} renames - Old field names to new names
   * @returns {UpdateResultHandle} Update result
   */
  rename(renames) {
    return this.dataSource.update({
      level: 'collection',
      database: this.database,
      collection: this.collection,
      operation: 'updateOne',
      filter: { _id: this.documentId },
      update: { $rename: renames }
    });
  }
  
  /**
   * Push single items to arrays
   * @param {Object} pushes - Field to value mappings
   * @returns {UpdateResultHandle} Update result
   */
  push(pushes) {
    return this.dataSource.update({
      level: 'collection',
      database: this.database,
      collection: this.collection,
      operation: 'updateOne',
      filter: { _id: this.documentId },
      update: { $push: pushes }
    });
  }
  
  /**
   * Push multiple items to arrays
   * @param {Object} pushes - Field to array of values mappings
   * @returns {UpdateResultHandle} Update result
   */
  pushMany(pushes) {
    const pushObj = {};
    for (const [field, values] of Object.entries(pushes)) {
      pushObj[field] = { $each: values };
    }
    
    return this.dataSource.update({
      level: 'collection',
      database: this.database,
      collection: this.collection,
      operation: 'updateOne',
      filter: { _id: this.documentId },
      update: { $push: pushObj }
    });
  }
  
  /**
   * Pull (remove) items from arrays
   * @param {Object} pulls - Field to value mappings
   * @returns {UpdateResultHandle} Update result
   */
  pull(pulls) {
    return this.dataSource.update({
      level: 'collection',
      database: this.database,
      collection: this.collection,
      operation: 'updateOne',
      filter: { _id: this.documentId },
      update: { $pull: pulls }
    });
  }
  
  /**
   * Add unique items to arrays
   * @param {Object} additions - Field to value mappings
   * @returns {UpdateResultHandle} Update result
   */
  addToSet(additions) {
    return this.dataSource.update({
      level: 'collection',
      database: this.database,
      collection: this.collection,
      operation: 'updateOne',
      filter: { _id: this.documentId },
      update: { $addToSet: additions }
    });
  }
  
  /**
   * Pop first/last element from arrays
   * @param {Object} pops - Field to -1 (first) or 1 (last) mappings
   * @returns {UpdateResultHandle} Update result
   */
  pop(pops) {
    return this.dataSource.update({
      level: 'collection',
      database: this.database,
      collection: this.collection,
      operation: 'updateOne',
      filter: { _id: this.documentId },
      update: { $pop: pops }
    });
  }
  
  /**
   * Find and update document atomically
   * @param {Object} update - MongoDB update operations
   * @param {Object} options - MongoDB options
   * @returns {QueryResultHandle} Updated document
   */
  findAndUpdate(update, options = {}) {
    return this.dataSource.update({
      level: 'collection',
      database: this.database,
      collection: this.collection,
      operation: 'findOneAndUpdate',
      filter: { _id: this.documentId },
      update,
      options
    });
  }
  
  /**
   * Find and replace document atomically
   * @param {Object} replacement - New document
   * @param {Object} options - MongoDB options
   * @returns {QueryResultHandle} Replaced document
   */
  findAndReplace(replacement, options = {}) {
    return this.dataSource.update({
      level: 'collection',
      database: this.database,
      collection: this.collection,
      operation: 'findOneAndReplace',
      filter: { _id: this.documentId },
      replacement,
      options
    });
  }
  
  /**
   * Find and delete document atomically
   * @param {Object} options - MongoDB options
   * @returns {QueryResultHandle} Deleted document
   */
  findAndDelete(options = {}) {
    return this.dataSource.update({
      level: 'collection',
      database: this.database,
      collection: this.collection,
      operation: 'findOneAndDelete',
      filter: { _id: this.documentId },
      options
    });
  }
  
  /**
   * Replace entire document
   * @param {Object} replacement - New document
   * @returns {UpdateResultHandle} Replace result
   */
  replace(replacement) {
    return this.dataSource.update({
      level: 'collection',
      database: this.database,
      collection: this.collection,
      operation: 'replaceOne',
      filter: { _id: this.documentId },
      replacement
    });
  }
  
  /**
   * Delete document
   * @returns {UpdateResultHandle} Delete result
   */
  delete() {
    return this.dataSource.update({
      level: 'collection',
      database: this.database,
      collection: this.collection,
      operation: 'deleteOne',
      filter: { _id: this.documentId }
    });
  }
}