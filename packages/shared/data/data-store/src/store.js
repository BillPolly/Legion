import { createConn, q } from '@legion/datascript';
import { ReactiveEngine } from './reactor.js';

export class DataStore {
  constructor(schema = {}, options = {}) {
    // Validate schema
    this._validateSchema(schema);
    
    // Store schema (frozen for immutability)
    this.schema = Object.freeze({ ...schema });
    
    // Store options with defaults
    this.options = Object.freeze({
      debounceMs: 10,
      ...options
    });
    
    // Create DataScript connection
    this.conn = createConn(this.schema);
    
    // Initialize proxy registry 
    this._proxyRegistry = new Map(); // Use Map instead of WeakMap for easier testing and cleanup
    
    // Initialize reactive engine for subscriptions
    this._reactiveEngine = new ReactiveEngine(this);
    this._reactiveEngine.startListening();
    
    // Freeze the instance
    Object.freeze(this);
  }

  /**
   * Get current database state
   */
  db() {
    return this.conn.db();
  }

  /**
   * Execute a query against current database state
   */
  query(querySpec) {
    return q(querySpec, this.db());
  }

  /**
   * Register a proxy for an entity ID (singleton pattern)
   */
  _registerProxy(entityId, proxy) {
    // Only register if not already present (enforce singleton)
    if (!this._proxyRegistry.has(entityId)) {
      this._proxyRegistry.set(entityId, proxy);
    }
  }

  /**
   * Get registered proxy for entity ID
   */
  _getRegisteredProxy(entityId) {
    return this._proxyRegistry.get(entityId);
  }

  /**
   * Invalidate a proxy for an entity ID
   */
  _invalidateProxy(entityId) {
    const proxy = this._proxyRegistry.get(entityId);
    if (proxy && typeof proxy._invalidate === 'function') {
      proxy._invalidate();
    }
  }

  /**
   * Clean up invalid proxies from registry
   * @returns {number} Number of proxies cleaned up
   */
  _cleanupProxies() {
    let cleanedCount = 0;
    for (const [entityId, proxy] of this._proxyRegistry.entries()) {
      if (!proxy.isValid()) {
        this._proxyRegistry.delete(entityId);
        cleanedCount++;
      }
    }
    return cleanedCount;
  }

  /**
   * Create a single entity with the provided data
   */
  createEntity(entityData) {
    // Validate input
    this._validateEntityData(entityData);
    
    // If no :db/id provided, add a tempid
    let txData = { ...entityData };
    if (!txData[':db/id']) {
      txData[':db/id'] = -Math.floor(Math.random() * 1000000); // Generate unique negative tempid
    }
    
    // Perform transaction
    const { dbAfter, tempids } = this.conn.transact([txData]);
    
    // Determine the actual entity ID
    let entityId;
    if (typeof txData[':db/id'] === 'number' && txData[':db/id'] < 0) {
      // Tempid was used
      entityId = tempids.get(txData[':db/id']);
    } else if (typeof txData[':db/id'] === 'number') {
      // Explicit entity ID was used
      entityId = txData[':db/id'];
    } else {
      throw new Error('Failed to determine entity ID after creation');
    }
    
    return {
      entityId,
      tempids,
      dbAfter
    };
  }

  /**
   * Update an existing entity with new data
   */
  updateEntity(entityId, entityData) {
    // Validate inputs
    if (!entityId || typeof entityId !== 'number') {
      throw new Error('Entity ID is required and must be a number');
    }
    
    this._validateEntityData(entityData);
    
    // Create transaction data with the entity ID
    const txData = {
      ':db/id': entityId,
      ...entityData
    };
    
    // Perform transaction
    const { dbAfter, tempids } = this.conn.transact([txData]);
    
    return {
      entityId,
      tempids,
      dbAfter
    };
  }

  /**
   * Create multiple entities in a single transaction
   */
  createEntities(entitiesData) {
    // Validate input
    if (!Array.isArray(entitiesData) || entitiesData.length === 0) {
      throw new Error('Entities data must be a non-empty array');
    }
    
    entitiesData.forEach(entityData => this._validateEntityData(entityData));
    
    // Add tempids for entities that don't have :db/id
    const txData = entitiesData.map((entityData, index) => {
      const data = { ...entityData };
      if (!data[':db/id']) {
        data[':db/id'] = -(index + 1); // Sequential negative tempids
      }
      return data;
    });
    
    // Perform transaction
    const { dbAfter, tempids } = this.conn.transact(txData);
    
    // Determine entity IDs
    const entityIds = [];
    txData.forEach((entityData) => {
      if (typeof entityData[':db/id'] === 'number' && entityData[':db/id'] < 0) {
        // Tempid was used
        entityIds.push(tempids.get(entityData[':db/id']));
      } else if (typeof entityData[':db/id'] === 'number') {
        // Explicit entity ID
        entityIds.push(entityData[':db/id']);
      } else {
        throw new Error('Failed to determine entity ID for batch creation');
      }
    });
    
    return {
      entityIds,
      tempids,
      dbAfter
    };
  }

  /**
   * Execute update-then-query pattern atomically
   * Updates are executed FIRST, then query sees the updated state
   * 
   * @param {Object} spec - Query-with-update specification
   * @param {Array} spec.find - Find clause for the query
   * @param {Array} spec.where - Where clause for the query
   * @param {Array} spec.update - Array of update/creation operations
   * @returns {Object} Result containing query results and tempid mappings
   */
  queryWithUpdate(spec) {
    // Validate specification
    if (!spec || typeof spec !== 'object') {
      throw new Error('Query-with-update specification is required');
    }
    
    // Validate query parts
    if (!spec.find || (Array.isArray(spec.find) && spec.find.length === 0)) {
      throw new Error('Query must have find clause');
    }
    
    if (!spec.where) {
      throw new Error('Query must have where clause');
    }
    
    if (!Array.isArray(spec.where)) {
      throw new Error('Where clause must be an array');
    }
    
    // Validate update specification if provided
    if (spec.update) {
      if (!Array.isArray(spec.update)) {
        throw new Error('Update must be an array');
      }
      
      // Validate each update entry has :db/id
      for (const updateData of spec.update) {
        if (!updateData[':db/id']) {
          throw new Error('Update must have :db/id');
        }
      }
    }
    
    const tempIds = {};
    let dbAfter = this.db();
    
    // Execute updates first if provided
    if (spec.update && spec.update.length > 0) {
      const txData = [];
      
      for (const updateData of spec.update) {
        const entityId = updateData[':db/id'];
        
        if (typeof entityId === 'string' && entityId.startsWith('?')) {
          // New entity with temp ID
          const tempId = entityId;
          const newEntity = { ...updateData };
          
          // Generate a numeric tempid for DataScript
          const numericTempId = -(Object.keys(tempIds).length + 1);
          newEntity[':db/id'] = numericTempId;
          
          // Store mapping for later resolution
          tempIds[tempId] = numericTempId;
          
          // Transform ref attributes that reference tempids
          for (const [attr, value] of Object.entries(newEntity)) {
            if (typeof value === 'string' && value.startsWith('?')) {
              // This is a tempid reference, resolve it
              if (tempIds[value] !== undefined) {
                newEntity[attr] = tempIds[value];
              } else {
                // Create a mapping for this tempid if it doesn't exist
                const refNumericTempId = -(Object.keys(tempIds).length + 1);
                tempIds[value] = refNumericTempId;
                newEntity[attr] = refNumericTempId;
              }
            }
          }
          
          txData.push(newEntity);
          
        } else if (typeof entityId === 'number') {
          // Update existing entity - also check for tempid refs in attributes
          const updatedEntity = { ...updateData };
          
          for (const [attr, value] of Object.entries(updatedEntity)) {
            if (typeof value === 'string' && value.startsWith('?')) {
              // This is a tempid reference, resolve it
              if (tempIds[value] !== undefined) {
                updatedEntity[attr] = tempIds[value];
              } else {
                // Create a mapping for this tempid if it doesn't exist
                const refNumericTempId = -(Object.keys(tempIds).length + 1);
                tempIds[value] = refNumericTempId;
                updatedEntity[attr] = refNumericTempId;
              }
            }
          }
          
          txData.push(updatedEntity);
        } else {
          throw new Error(`Invalid entity ID type: ${typeof entityId}`);
        }
      }
      
      // Execute all updates in a single transaction
      if (txData.length > 0) {
        const txResult = this.conn.transact(txData);
        dbAfter = txResult.dbAfter;
        
        // Update tempid mappings with actual entity IDs
        for (const [tempId, numericTempId] of Object.entries(tempIds)) {
          if (txResult.tempids && txResult.tempids.has(numericTempId)) {
            tempIds[tempId] = txResult.tempids.get(numericTempId);
          }
        }
      }
    }
    
    // Transform where clauses to use real IDs instead of temp IDs
    const transformedWhere = spec.where.map(clause => {
      if (Array.isArray(clause)) {
        return clause.map(item => {
          if (typeof item === 'string' && tempIds[item] !== undefined) {
            return tempIds[item];
          }
          return item;
        });
      }
      return clause;
    });
    
    // Execute query on the updated database state
    const queryResults = q({
      find: spec.find,
      where: transformedWhere
    }, dbAfter);
    
    // Return results with tempId mapping
    return {
      results: queryResults,
      tempIds: tempIds
    };
  }

  /**
   * Validate entity data before creation
   */
  _validateEntityData(entityData) {
    if (!entityData || typeof entityData !== 'object') {
      throw new Error('Entity data is required and must be an object');
    }
    
    const attributes = Object.keys(entityData);
    if (attributes.length === 0) {
      throw new Error('Entity data cannot be empty');
    }
    
    // Check if all non-:db/id attributes start with ':'
    for (const attr of attributes) {
      if (attr !== ':db/id' && !attr.startsWith(':')) {
        throw new Error(`Attributes must start with ':'. Found: ${attr}`);
      }
    }
  }

  /**
   * Validate schema format and constraints
   */
  _validateSchema(schema) {
    for (const [attr, spec] of Object.entries(schema)) {
      // Validate attribute name format
      if (!attr.startsWith(':')) {
        throw new Error(`Schema attributes must start with ':'. Found: ${attr}`);
      }

      // Validate unique constraints
      if (spec.unique && !['identity', 'value'].includes(spec.unique)) {
        throw new Error(`Invalid unique constraint: ${spec.unique}. Must be 'identity' or 'value'`);
      }

      // Validate cardinality
      if (spec.card && !['one', 'many'].includes(spec.card)) {
        throw new Error(`Invalid cardinality: ${spec.card}. Must be 'one' or 'many'`);
      }

      // Validate value types
      if (spec.valueType && !['string', 'number', 'boolean', 'ref', 'instant'].includes(spec.valueType)) {
        throw new Error(`Invalid valueType: ${spec.valueType}`);
      }
    }
  }
}

/**
 * Convenience function to create a DataStore
 */
export function createDataStore({ schema = {}, options = {} } = {}) {
  return new DataStore(schema, options);
}