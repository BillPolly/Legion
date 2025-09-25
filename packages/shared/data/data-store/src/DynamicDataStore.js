/**
 * DynamicDataStore - DataStore with dynamic schema evolution support
 * 
 * Extends DataStore functionality to allow runtime schema changes
 * while maintaining backward compatibility.
 */

import { createConn, q } from '@legion/datascript';
import { ReactiveEngine } from './reactor.js';
import { SchemaManager } from './SchemaManager.js';
import { SchemaEvolution } from './SchemaEvolution.js';
import { SchemaNotificationSystem } from './SchemaNotificationSystem.js';

export class DynamicDataStore {
  constructor(schema = {}, options = {}) {
    // Store options with defaults
    this.options = {
      debounceMs: 10,
      enableDynamicSchema: true,
      ...options
    };
    
    // Initialize SchemaManager for dynamic schema
    this.schemaManager = new SchemaManager(schema);
    
    // Create initial DataScript connection
    this.conn = createConn(this.schemaManager.getSchema());
    
    // Initialize schema evolution handler
    this.schemaEvolution = new SchemaEvolution(this, this.schemaManager);
    
    // Initialize notification system for reactive schema changes
    this.notificationSystem = new SchemaNotificationSystem();
    
    // Initialize proxy registry 
    this._proxyRegistry = new Map();
    
    // Initialize reactive engine for subscriptions
    this._reactiveEngine = new ReactiveEngine(this);
    this._reactiveEngine.startListening();
    
    // Schema change listeners (for proxy updates) - legacy support
    this._schemaListeners = new Set();
    
    // Subscribe to schema changes from SchemaManager
    this.schemaManager.subscribe(this._handleSchemaChange.bind(this));
  }
  
  /**
   * Get current schema (dynamic)
   */
  get schema() {
    return this.schemaManager.getSchema();
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
  
  // ============================================================================
  // DYNAMIC SCHEMA OPERATIONS
  // ============================================================================
  
  /**
   * Add a new entity type with attributes
   * @param {string} entityType - Entity type name
   * @param {Object} attributes - Attributes specification
   */
  async addEntityType(entityType, attributes = {}) {
    // Update schema through SchemaManager
    this.schemaManager.addEntityType(entityType, attributes);
    
    // Apply migration
    const change = {
      type: 'addEntityType',
      entityType,
      attributes
    };
    
    const result = await this.schemaEvolution.applyChange(change);
    
    if (!result.success) {
      throw new Error(`Failed to add entity type: ${result.error}`);
    }
    
    // Notify schema change listeners
    this._notifySchemaChange({
      type: 'addEntityType',
      entityType,
      attributes,
      version: this.schemaManager.getVersion()
    });
    
    return result;
  }
  
  /**
   * Remove an entity type
   * @param {string} entityType - Entity type to remove
   * @param {boolean} force - Force removal even if data exists
   */
  async removeEntityType(entityType, force = false) {
    // Get migration plan first
    const plan = this.schemaEvolution.planMigration({
      type: 'removeEntityType',
      entityType
    });
    
    if (plan.entitiesAffected > 0 && !force) {
      throw new Error(
        `Cannot remove entity type ${entityType}: ${plan.entitiesAffected} entities would be deleted. ` +
        `Use force=true to proceed.`
      );
    }
    
    // Update schema
    this.schemaManager.removeEntityType(entityType, force);
    
    // Apply migration
    const change = {
      type: 'removeEntityType',
      entityType
    };
    
    const result = await this.schemaEvolution.applyChange(change);
    
    if (!result.success) {
      throw new Error(`Failed to remove entity type: ${result.error}`);
    }
    
    // Cleanup proxies for removed entities
    this._cleanupProxiesForType(entityType);
    
    // Notify schema change listeners
    this._notifySchemaChange({
      type: 'removeEntityType',
      entityType,
      entitiesRemoved: result.entitiesRemoved,
      version: this.schemaManager.getVersion()
    });
    
    return result;
  }
  
  /**
   * Add an attribute to an entity type
   * @param {string} entityType - Entity type
   * @param {string} attributeName - Attribute name
   * @param {Object} spec - Attribute specification
   */
  async addAttribute(entityType, attributeName, spec = {}) {
    // Update schema
    this.schemaManager.addAttribute(entityType, attributeName, spec);
    
    // Apply migration
    const change = {
      type: 'addAttribute',
      entityType,
      attributeName,
      fullAttribute: `:${entityType}/${attributeName}`,
      spec
    };
    
    const result = await this.schemaEvolution.applyChange(change);
    
    if (!result.success) {
      throw new Error(`Failed to add attribute: ${result.error}`);
    }
    
    // Notify schema change listeners
    this._notifySchemaChange({
      type: 'addAttribute',
      entityType,
      attributeName,
      spec,
      version: this.schemaManager.getVersion()
    });
    
    return result;
  }
  
  /**
   * Remove an attribute from an entity type
   * @param {string} entityType - Entity type
   * @param {string} attributeName - Attribute to remove
   * @param {boolean} force - Force removal even if data exists
   */
  async removeAttribute(entityType, attributeName, force = false) {
    const fullAttribute = `:${entityType}/${attributeName}`;
    
    // Get migration plan
    const plan = this.schemaEvolution.planMigration({
      type: 'removeAttribute',
      fullAttribute
    });
    
    if (plan.entitiesAffected > 0 && !force) {
      throw new Error(
        `Cannot remove attribute ${fullAttribute}: ${plan.entitiesAffected} entities would be affected. ` +
        `Use force=true to proceed.`
      );
    }
    
    // Update schema
    this.schemaManager.removeAttribute(entityType, attributeName, force);
    
    // Apply migration
    const change = {
      type: 'removeAttribute',
      entityType,
      attributeName,
      fullAttribute
    };
    
    const result = await this.schemaEvolution.applyChange(change);
    
    if (!result.success) {
      throw new Error(`Failed to remove attribute: ${result.error}`);
    }
    
    // Notify schema change listeners
    this._notifySchemaChange({
      type: 'removeAttribute',
      entityType,
      attributeName,
      entitiesAffected: result.entitiesAffected,
      version: this.schemaManager.getVersion()
    });
    
    return result;
  }
  
  /**
   * Add a relationship between entity types
   * @param {string} fromEntity - Source entity type
   * @param {string} relationName - Relationship name
   * @param {string} toEntity - Target entity type
   * @param {Object} spec - Relationship specification
   */
  async addRelationship(fromEntity, relationName, toEntity, spec = {}) {
    // Update schema
    this.schemaManager.addRelationship(fromEntity, relationName, toEntity, spec);
    
    // Apply migration
    const change = {
      type: 'addRelationship',
      fromEntity,
      relationName,
      toEntity,
      spec
    };
    
    const result = await this.schemaEvolution.applyChange(change);
    
    if (!result.success) {
      throw new Error(`Failed to add relationship: ${result.error}`);
    }
    
    // Notify schema change listeners
    this._notifySchemaChange({
      type: 'addRelationship',
      fromEntity,
      relationName,
      toEntity,
      spec,
      version: this.schemaManager.getVersion()
    });
    
    return result;
  }
  
  /**
   * Get schema evolution history
   */
  getSchemaHistory(limit = 10) {
    return this.schemaManager.getHistory(limit);
  }
  
  /**
   * Subscribe to schema changes
   * @param {Function} listener - Schema change listener
   * @returns {Function} Unsubscribe function
   */
  subscribeToSchemaChanges(listener) {
    if (typeof listener !== 'function') {
      throw new Error('Schema listener must be a function');
    }
    
    this._schemaListeners.add(listener);
    
    return () => {
      this._schemaListeners.delete(listener);
    };
  }
  
  /**
   * Subscribe to reactive schema change notifications (new method)
   * @param {Object|Function} options - Options object or callback function
   * @returns {Object} Subscription object with unsubscribe method
   */
  subscribeToSchema(options) {
    // Support simple callback as argument
    if (typeof options === 'function') {
      options = { callback: options };
    }
    
    return this.notificationSystem.subscribe(options);
  }
  
  /**
   * Get notification system statistics
   * @returns {Object} Statistics about active subscriptions
   */
  getNotificationStats() {
    return this.notificationSystem.getStats();
  }
  
  /**
   * Create a filtered notification view for a specific entity type
   * @param {string} entityType - Entity type to filter by
   * @returns {Object} Filtered notification interface
   */
  createSchemaView(entityType) {
    return this.notificationSystem.createFilteredView(entityType);
  }
  
  // ============================================================================
  // ORIGINAL DATASTORE METHODS (maintained for compatibility)
  // ============================================================================
  
  /**
   * Register a proxy for an entity ID (singleton pattern)
   */
  _registerProxy(entityId, proxy) {
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
   */
  _cleanupProxies() {
    let cleanedCount = 0;
    for (const [entityId, proxy] of this._proxyRegistry.entries()) {
      if (!proxy.isValid || !proxy.isValid()) {
        this._proxyRegistry.delete(entityId);
        cleanedCount++;
      }
    }
    return cleanedCount;
  }
  
  /**
   * Clean up proxies for a specific entity type
   */
  _cleanupProxiesForType(entityType) {
    const prefix = `:${entityType}/`;
    for (const [entityId, proxy] of this._proxyRegistry.entries()) {
      // Check if proxy has attributes from removed type
      try {
        const value = proxy.value();
        const hasTypeAttrs = Object.keys(value).some(attr => 
          attr.startsWith(prefix)
        );
        if (hasTypeAttrs) {
          this._invalidateProxy(entityId);
          this._proxyRegistry.delete(entityId);
        }
      } catch (error) {
        // Proxy might be invalid already
        this._proxyRegistry.delete(entityId);
      }
    }
  }
  
  /**
   * Create a single entity with the provided data
   */
  createEntity(entityData) {
    this._validateEntityData(entityData);
    
    let txData = { ...entityData };
    if (!txData[':db/id']) {
      txData[':db/id'] = -Math.floor(Math.random() * 1000000);
    }
    
    const { dbAfter, tempids } = this.conn.transact([txData]);
    
    let entityId;
    if (typeof txData[':db/id'] === 'number' && txData[':db/id'] < 0) {
      entityId = tempids.get(txData[':db/id']);
    } else if (typeof txData[':db/id'] === 'number') {
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
    if (!entityId || typeof entityId !== 'number') {
      throw new Error('Entity ID is required and must be a number');
    }
    
    this._validateEntityData(entityData);
    
    const txData = {
      ':db/id': entityId,
      ...entityData
    };
    
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
    if (!Array.isArray(entitiesData) || entitiesData.length === 0) {
      throw new Error('Entities data must be a non-empty array');
    }
    
    entitiesData.forEach(entityData => this._validateEntityData(entityData));
    
    const txData = entitiesData.map((entityData, index) => {
      const data = { ...entityData };
      if (!data[':db/id']) {
        data[':db/id'] = -(index + 1);
      }
      return data;
    });
    
    const { dbAfter, tempids } = this.conn.transact(txData);
    
    const entityIds = [];
    txData.forEach((entityData) => {
      if (typeof entityData[':db/id'] === 'number' && entityData[':db/id'] < 0) {
        entityIds.push(tempids.get(entityData[':db/id']));
      } else if (typeof entityData[':db/id'] === 'number') {
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
   */
  queryWithUpdate(spec) {
    if (!spec || typeof spec !== 'object') {
      throw new Error('Query-with-update specification is required');
    }
    
    if (!spec.find || (Array.isArray(spec.find) && spec.find.length === 0)) {
      throw new Error('Query must have find clause');
    }
    
    if (!spec.where) {
      throw new Error('Query must have where clause');
    }
    
    if (!Array.isArray(spec.where)) {
      throw new Error('Where clause must be an array');
    }
    
    if (spec.update) {
      if (!Array.isArray(spec.update)) {
        throw new Error('Update must be an array');
      }
      
      for (const updateData of spec.update) {
        if (!updateData[':db/id']) {
          throw new Error('Update must have :db/id');
        }
      }
    }
    
    const tempIds = {};
    let dbAfter = this.db();
    
    if (spec.update && spec.update.length > 0) {
      const txData = [];
      
      for (const updateData of spec.update) {
        const entityId = updateData[':db/id'];
        
        if (typeof entityId === 'string' && entityId.startsWith('?')) {
          const tempId = entityId;
          const newEntity = { ...updateData };
          
          const numericTempId = -(Object.keys(tempIds).length + 1);
          newEntity[':db/id'] = numericTempId;
          
          tempIds[tempId] = numericTempId;
          
          for (const [attr, value] of Object.entries(newEntity)) {
            if (typeof value === 'string' && value.startsWith('?')) {
              if (tempIds[value] !== undefined) {
                newEntity[attr] = tempIds[value];
              } else {
                const refNumericTempId = -(Object.keys(tempIds).length + 1);
                tempIds[value] = refNumericTempId;
                newEntity[attr] = refNumericTempId;
              }
            }
          }
          
          txData.push(newEntity);
          
        } else if (typeof entityId === 'number') {
          const updatedEntity = { ...updateData };
          
          for (const [attr, value] of Object.entries(updatedEntity)) {
            if (typeof value === 'string' && value.startsWith('?')) {
              if (tempIds[value] !== undefined) {
                updatedEntity[attr] = tempIds[value];
              } else {
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
      
      if (txData.length > 0) {
        const txResult = this.conn.transact(txData);
        dbAfter = txResult.dbAfter;
        
        for (const [tempId, numericTempId] of Object.entries(tempIds)) {
          if (txResult.tempids && txResult.tempids.has(numericTempId)) {
            tempIds[tempId] = txResult.tempids.get(numericTempId);
          }
        }
      }
    }
    
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
    
    const queryResults = q({
      find: spec.find,
      where: transformedWhere
    }, dbAfter);
    
    return {
      results: queryResults,
      tempIds: tempIds
    };
  }
  
  /**
   * Handle schema change from SchemaManager
   */
  _handleSchemaChange(change) {
    // This is called by SchemaManager after schema is updated
    // The actual migration is handled by explicit calls to add/remove methods
    // This is just for tracking/debugging
    console.log('Schema changed:', change);
  }
  
  /**
   * Notify all schema change listeners
   */
  _notifySchemaChange(change) {
    // Enhance change with full attribute name if applicable
    if (change.entityType && change.attributeName) {
      change.fullAttribute = `:${change.entityType}/${change.attributeName}`;
    }
    
    // Use new notification system for reactive notifications
    this.notificationSystem.notify(change);
    
    // Also notify legacy listeners for backward compatibility
    for (const listener of this._schemaListeners) {
      try {
        listener(change);
      } catch (error) {
        console.error('Schema change listener error:', error);
      }
    }
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
    
    for (const attr of attributes) {
      if (attr !== ':db/id' && !attr.startsWith(':')) {
        throw new Error(`Attributes must start with ':'. Found: ${attr}`);
      }
    }
  }
}

/**
 * Convenience function to create a DynamicDataStore
 */
export function createDynamicDataStore({ schema = {}, options = {} } = {}) {
  return new DynamicDataStore(schema, options);
}