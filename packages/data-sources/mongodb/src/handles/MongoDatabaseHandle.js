/**
 * MongoDatabaseHandle - Represents a MongoDB database
 * 
 * This handle provides database-level operations including:
 * - Database statistics
 * - Collection listing and management
 * - Database-wide change streams
 * - Collection projection (creating collection handles)
 */

import { Handle } from '@legion/handle';
import { MongoCollectionHandle } from './MongoCollectionHandle.js';
import { QueryResultHandle } from './QueryResultHandle.js';
import { UpdateResultHandle } from './UpdateResultHandle.js';
import { SubscriptionHandle } from './SubscriptionHandle.js';

export class MongoDatabaseHandle extends Handle {
  constructor(dataSource, dbName) {
    super(dataSource);
    
    if (!dbName) {
      throw new Error('Database name is required');
    }
    
    this.database = dbName;
    this._collectionsHandle = null; // Cache for collections handle
  }
  
  /**
   * Get database statistics
   * @returns {QueryResultHandle} Database statistics
   */
  value() {
    return this.dataSource.query({
      level: 'database',
      database: this.database,
      operation: 'stats'
    });
  }
  
  /**
   * List all collections in database
   * @param {boolean} refresh - Force refresh the collection list
   * @returns {QueryResultHandle} List of collections
   */
  collections(refresh = false) {
    // Cache the handle so subsequent calls return the same handle
    // This allows the async population to be shared
    // But allow refresh when needed (e.g. after creating/dropping collections)
    if (!this._collectionsHandle || refresh) {
      this._collectionsHandle = this.dataSource.query({
        level: 'database',
        database: this.database,
        operation: 'listCollections'
      });
    }
    return this._collectionsHandle;
  }
  
  /**
   * Get handle for specific collection (projection)
   * @param {string} collectionName - Collection name
   * @returns {MongoCollectionHandle} Collection handle
   */
  collection(collectionName) {
    if (!collectionName) {
      throw new Error('Collection name is required');
    }
    return new MongoCollectionHandle(this.dataSource, this.database, collectionName);
  }
  
  /**
   * Create new collection
   * @param {string} collectionName - Name of collection to create
   * @param {Object} options - Collection creation options
   * @returns {UpdateResultHandle} Creation result
   */
  createCollection(collectionName, options = {}) {
    if (!collectionName) {
      throw new Error('Collection name is required');
    }
    
    // Clear collections cache since we're modifying the collection list
    this._collectionsHandle = null;
    
    return this.dataSource.update({
      level: 'database',
      database: this.database,
      operation: 'createCollection',
      collectionName: collectionName,
      options: options
    });
  }
  
  /**
   * Drop entire database
   * @returns {UpdateResultHandle} Drop result
   */
  drop() {
    return this.dataSource.update({
      level: 'database',
      database: this.database,
      operation: 'dropDatabase'
    });
  }
  
  /**
   * Drop database (alias for drop())
   * @returns {UpdateResultHandle} Drop result
   */
  dropDatabase() {
    return this.drop();
  }
  
  /**
   * Execute database command
   * @param {Object} command - MongoDB command document
   * @returns {QueryResultHandle} Command result
   */
  command(command) {
    if (!command) {
      throw new Error('Command is required');
    }
    
    return this.dataSource.query({
      level: 'database',
      database: this.database,
      operation: 'command',
      command
    });
  }
  
  /**
   * Get collection names from collections query
   * @returns {Array} Array of collection names
   */
  collectionNames() {
    const collectionsHandle = this.collections();
    
    // Get the value from the handle
    const collections = collectionsHandle.value();
    
    // Handle pending or null data
    if (!collections || collectionsHandle.isPending()) {
      return [];
    }
    
    // Extract names from collection info objects
    if (Array.isArray(collections)) {
      return collections.map(col => col.name);
    }
    
    return [];
  }
  
  /**
   * Check if collection exists
   * @param {string} collectionName - Name of collection to check
   * @returns {boolean} True if collection exists
   */
  hasCollection(collectionName) {
    if (!collectionName) {
      throw new Error('Collection name is required');
    }
    
    const names = this.collectionNames();
    return names.includes(collectionName);
  }
  
  /**
   * Watch database for changes
   * @param {Array} pipeline - Aggregation pipeline for filtering changes (optional)
   * @param {Function} callback - Callback for change events (optional)
   * @returns {SubscriptionHandle} Subscription handle
   */
  watch(pipeline, callback) {
    // Handle overloaded parameters
    if (typeof pipeline === 'function') {
      callback = pipeline;
      pipeline = [];
    }
    
    if (!pipeline) {
      pipeline = [];
    }
    
    return this.dataSource.subscribe({
      level: 'database',
      database: this.database,
      pipeline,
      changeStream: true,
      callback
    });
  }
}