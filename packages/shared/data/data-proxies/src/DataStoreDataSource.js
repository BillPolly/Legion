/**
 * DataStoreDataSource
 * 
 * Adapter that bridges DataStore to the Handle DataSource interface.
 * Implements the DataSource interface contract required by Handle.
 * 
 * CRITICAL: Implements both sync and async methods to meet Handle requirements.
 * Handle validation expects specific method signatures.
 */

import { DefaultQueryBuilder } from './DefaultQueryBuilder.js';

export class DataStoreDataSource {
  constructor(dataStore) {
    
    if (!dataStore) {
      throw new Error('DataStore is required');
    }
    
    if (typeof dataStore.query !== 'function') {
      throw new Error('DataStore must have query method');
    }
    
    this.dataStore = dataStore;
  }
  
  /**
   * Execute a query through DataStore
   * @param {Object} spec - Query specification with find and where clauses
   * @returns {Array} Query results - ALWAYS returns an array (SYNCHRONOUS)
   */
  query(spec) {
    // Validate query specification
    if (!spec) {
      throw new Error('Query specification is required');
    }
    
    if (!spec.find || !Array.isArray(spec.find)) {
      throw new Error('Query must have find clause');
    }
    
    if (!spec.where || !Array.isArray(spec.where)) {
      throw new Error('Query must have where clause');
    }
    
    // Execute synchronous query directly
    try {
      // Transform aggregate query format for DataScript
      let querySpec = { ...spec };
      let isAggregateQuery = false;
      
      // Check if this is an aggregate query (single find clause with parentheses)
      if (spec.find.length === 1 && 
          typeof spec.find[0] === 'string' && 
          spec.find[0].startsWith('(') && 
          spec.find[0].endsWith(')')) {
        
        // Parse aggregate function from string format like "(count ?e)"
        const aggStr = spec.find[0].slice(1, -1); // Remove parentheses
        const parts = aggStr.split(' ');
        if (parts.length >= 2) {
          // Convert to DataScript aggregate format: ['count', '?e']
          querySpec.find = [parts]; // Array containing the aggregate array
          querySpec.findType = 'scalar'; // Return scalar value
          isAggregateQuery = true;
        }
      }
      
      const results = this.dataStore.query(querySpec);
      
      // CRITICAL: Always return array for consistent interface
      // DataScript query can return scalar, coll, tuple, or rel formats
      // StreamProxy and other components expect arrays
      if (isAggregateQuery) {
        // Scalar result from aggregate - wrap in array
        return [results];
      }
      
      if (!Array.isArray(results)) {
        // Non-array result (shouldn't happen with standard queries but safety check)
        return results === null || results === undefined ? [] : [results];
      }
      
      return results;
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * Create query builder for Handle-based queries
   * @param {Object} sourceHandle - Handle that initiated the query
   * @returns {Object} Query builder instance
   */
  queryBuilder(sourceHandle) {
    return new DefaultQueryBuilder(this, sourceHandle);
  }
  
  /**
   * Update an entity through DataStore (SYNCHRONOUS for Handle interface)
   * @param {number} entityId - Entity ID to update (null for new entities)
   * @param {Object} data - Update data
   * @returns {Object} Update result
   */
  update(entityId, data) {
    // For new entities, entityId can be null
    if (entityId !== null && entityId !== undefined && typeof entityId !== 'number') {
      throw new Error('Entity ID must be a number');
    }
    
    if (!data) {
      throw new Error('Update data is required');
    }
    
    if (typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('Update data must be an object');
    }
    
    if (Object.keys(data).length === 0) {
      throw new Error('Update data cannot be empty');
    }
    
    // Execute update through DataStore
    try {
      if (entityId) {
        // Update existing entity
        const result = this.dataStore.updateEntity(entityId, data);
        return {
          success: true,
          entityId: entityId,
          result: result
        };
      } else {
        // Create new entity
        const result = this.dataStore.createEntity(data);
        return {
          success: true,
          entityId: result.entityId,
          result: result
        };
      }
    } catch (error) {
      throw error;
    }
  }
  
  
  /**
   * Get complete entity by ID
   * @param {number} entityId - Entity ID
   * @returns {Promise<Object>} Entity object
   */
  async getEntity(entityId) {
    // Validate entity ID
    if (entityId === null || entityId === undefined) {
      throw new Error('Entity ID is required');
    }
    
    if (typeof entityId !== 'number') {
      throw new Error('Entity ID must be a number');
    }
    
    try {
      // Query all attributes for the entity
      const results = this.query({
        find: ['?attr', '?value'],
        where: [[entityId, '?attr', '?value']]
      });
      
      // If no results, entity doesn't exist
      if (results.length === 0) {
        throw new Error('Entity not found');
      }
      
      // Convert to entity object
      const entity = { ':db/id': entityId };
      results.forEach(([attr, value]) => {
        entity[attr] = value;
      });
      
      return entity;
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * Detect entity type from attributes
   * @param {Object} entity - Entity object
   * @returns {Promise<string|null>} Detected type or null
   */
  async detectEntityType(entity) {
    // Check for explicit :type attribute
    if (entity[':type']) {
      return entity[':type'];
    }
    
    // Detect from schema attributes
    const attributes = Object.keys(entity);
    
    // Look for namespace patterns like :user/*, :post/*, etc.
    // Skip :db/id as it's not a type indicator
    for (const attr of attributes) {
      if (attr.startsWith(':') && attr.includes('/') && attr !== ':db/id') {
        const namespace = attr.split('/')[0].substring(1);
        // Skip 'db' namespace as it's system-level
        if (namespace !== 'db') {
          return namespace;
        }
      }
    }
    
    return null;
  }
  
  /**
   * Execute query with update pattern (DataStore-specific)
   * @param {Object} spec - Query spec with optional update clause
   * @returns {Promise<Array>} Query results after update
   */
  async executeQueryWithUpdate(spec) {
    if (spec.update && Array.isArray(spec.update)) {
      // DataStore has queryWithUpdate method for this pattern
      const result = this.dataStore.queryWithUpdate(spec);
      return result.results;
    }
    
    // No update, just execute query
    return this.query(spec);
  }
  
  /**
   * Update multiple entities in a single transaction
   * @param {Array} entities - Array of entity update objects
   * @returns {Promise<Object>} Transaction result
   */
  async updateMultiple(entities) {
    if (!Array.isArray(entities)) {
      throw new Error('Entities must be an array');
    }
    
    if (entities.length === 0) {
      throw new Error('At least one entity is required');
    }
    
    try {
      // Use createEntities for batch operations
      const result = this.dataStore.createEntities(entities);
      
      return {
        success: true,
        tempids: result.tempids,
        result: result
      };
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * Retract all attributes of an entity (delete)
   * @param {number} entityId - Entity ID to retract
   * @returns {Promise<Object>} Retraction result
   */
  async retractEntity(entityId) {
    if (entityId === null || entityId === undefined) {
      throw new Error('Entity ID is required');
    }
    
    if (typeof entityId !== 'number') {
      throw new Error('Entity ID must be a number');
    }
    
    try {
      // Get all attributes
      const entity = await this.getEntity(entityId);
      
      // Build retraction statements - DataScript expects ['-', entityId, attr, value]
      const retractions = [];
      for (const [attr, value] of Object.entries(entity)) {
        if (attr !== ':db/id') {
          retractions.push(['-', entityId, attr, value]);
        }
      }
      
      if (retractions.length > 0) {
        // Access conn directly to use transact for retractions
        const result = this.dataStore.conn.transact(retractions);
        return {
          success: true,
          entityId: entityId,
          retractedCount: retractions.length,
          result: result
        };
      }
      
      return {
        success: true,
        entityId: entityId,
        retractedCount: 0
      };
    } catch (error) {
      throw error;
    }
  }
  
  // ===== HANDLE DATASOURCE INTERFACE METHODS =====
  
  /**
   * REQUIRED: Execute transaction operations (required by CollectionProxy integration tests)
   * @param {Array} transactions - Array of transaction operations [op, entityId, attr, value]
   * @returns {Promise<Object>} Transaction result with success status and tempids
   */
  async transact(transactions) {
    if (!Array.isArray(transactions)) {
      throw new Error('Transactions must be an array');
    }
    
    if (transactions.length === 0) {
      throw new Error('At least one transaction is required');
    }
    
    try {
      // Execute transaction directly via DataStore connection
      const result = this.dataStore.conn.transact(transactions);
      
      return {
        success: true,
        tempids: result.tempids || {},
        dbAfter: result.dbAfter,
        txData: result.txData
      };
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * REQUIRED: Get entity by ID (Handle interface expects this method name)
   * @param {number} entityId - Entity ID
   * @returns {Promise<Object>} Entity object
   */
  async get(entityId) {
    return await this.getEntity(entityId);
  }
  
  /**
   * REQUIRED: Get resource schema (required by Handle validation)
   * @returns {Object} Schema object or null if not available
   */
  getSchema() {
    // Return a basic schema for DataStore
    return {
      version: '1.0.0',
      type: 'datascript',
      attributes: {
        // Common DataScript attributes
        ':db/id': { type: 'number', cardinality: 'one' },
        'type': { type: 'string', cardinality: 'one' },
        'name': { type: 'string', cardinality: 'one' }
      },
      constraints: {}
    };
  }
  
  /**
   * REQUIRED: Create subscription for change notifications (synchronous API)
   * NOTE: Handle expects this to be synchronous, returning subscription object immediately
   * @param {Object} querySpec - Query specification to monitor
   * @param {Function} callback - Function called when matching changes occur
   * @returns {Object} Subscription object with unsubscribe method
   */
  subscribe(querySpec, callback) {
    // Validate inputs
    if (!querySpec || typeof querySpec !== 'object') {
      throw new Error('Query specification must be an object');
    }
    
    if (!callback || typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }
    
    // Create subscription synchronously (Handle interface requirement)
    const subscriptionId = Date.now() + Math.random();
    
    // Since DataStore doesn't have built-in subscriptions, we create a mock subscription
    // In a real implementation, this would hook into DataStore's change notification system
    const subscription = {
      id: subscriptionId,
      querySpec,
      callback,
      unsubscribe: () => {
        // Synchronous cleanup
        console.log(`Unsubscribing from ${subscriptionId}`);
      }
    };
    
    // Trigger initial callback with current data (async but non-blocking)
    setTimeout(async () => {
      try {
        const results = this.query(querySpec);
        callback(results);
      } catch (error) {
        console.warn('Initial subscription callback failed:', error.message);
      }
    }, 0);
    
    return subscription;
  }
}