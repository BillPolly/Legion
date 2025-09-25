/**
 * SchemaEvolution - Handles data migration during schema changes
 * 
 * Manages the complex process of evolving a DataScript database schema
 * while preserving existing data.
 */

import { createConn } from '@legion/datascript';

export class SchemaEvolution {
  constructor(dataStore, schemaManager) {
    this.dataStore = dataStore;
    this.schemaManager = schemaManager;
    
    // Migration queue for handling concurrent operations
    this.migrationQueue = [];
    this.isProcessing = false;
    
    // Migration strategies for different schema changes
    this.strategies = {
      addEntityType: this._addEntityTypeStrategy.bind(this),
      removeEntityType: this._removeEntityTypeStrategy.bind(this),
      addAttribute: this._addAttributeStrategy.bind(this),
      removeAttribute: this._removeAttributeStrategy.bind(this),
      addRelationship: this._addRelationshipStrategy.bind(this)
    };
  }
  
  /**
   * Apply schema changes with data migration
   * @param {Object} change - Schema change description
   * @returns {Object} Migration result
   */
  async applyChange(change) {
    // Queue the change for processing
    return new Promise((resolve, reject) => {
      this.migrationQueue.push({ change, resolve, reject });
      this._processMigrationQueue();
    });
  }
  
  /**
   * Process queued migrations sequentially
   */
  async _processMigrationQueue() {
    if (this.isProcessing || this.migrationQueue.length === 0) {
      return;
    }
    
    this.isProcessing = true;
    
    while (this.migrationQueue.length > 0) {
      const { change, resolve, reject } = this.migrationQueue.shift();
      
      try {
        const strategy = this.strategies[change.type];
        if (!strategy) {
          throw new Error(`Unknown schema change type: ${change.type}`);
        }
        
        const result = await strategy(change);
        
        resolve({
          success: true,
          ...result
        });
      } catch (error) {
        resolve({
          success: false,
          error: error.message,
          change
        });
      }
    }
    
    this.isProcessing = false;
  }
  
  /**
   * Migrate entire database to new schema
   * @param {Object} newSchema - Target schema
   * @returns {Object} New connection with migrated data
   */
  migrateToSchema(newSchema) {
    // Get current database state
    const currentDb = this.dataStore.db();
    
    // Create new connection with new schema
    const newConn = createConn(newSchema);
    
    // Extract all entities from current database
    const entities = this._extractAllEntities(currentDb);
    
    // Filter and transform entities for new schema
    const transformedEntities = this._transformEntities(entities, newSchema);
    
    // Batch insert into new database
    if (transformedEntities.length > 0) {
      newConn.transact(transformedEntities);
    }
    
    return newConn;
  }
  
  /**
   * Strategy for adding entity type - no migration needed
   */
  _addEntityTypeStrategy(change) {
    // Adding new entity type doesn't require data migration
    // Just update the schema
    const newSchema = this.schemaManager.getSchema();
    
    // Create new connection with updated schema
    const newConn = this.migrateToSchema(newSchema);
    
    // Swap connections in DataStore
    this._swapConnection(newConn);
    
    return {
      type: 'addEntityType',
      entityType: change.entityType,
      attributesAdded: Object.keys(change.attributes || {})
    };
  }
  
  /**
   * Strategy for removing entity type - filters out entities
   */
  _removeEntityTypeStrategy(change) {
    const currentDb = this.dataStore.db();
    const newSchema = this.schemaManager.getSchema();
    
    // Get all entities that don't belong to removed type
    const entities = this._extractAllEntities(currentDb);
    const filteredEntities = entities.filter(entity => {
      // Check if entity has any attributes from removed type
      const hasRemovedAttrs = Object.keys(entity).some(attr => 
        attr.startsWith(`:${change.entityType}/`)
      );
      return !hasRemovedAttrs;
    });
    
    // Create new database with filtered entities
    const newConn = createConn(newSchema);
    if (filteredEntities.length > 0) {
      newConn.transact(filteredEntities);
    }
    
    this._swapConnection(newConn);
    
    return {
      type: 'removeEntityType',
      entityType: change.entityType,
      entitiesRemoved: entities.length - filteredEntities.length
    };
  }
  
  /**
   * Strategy for adding attribute - simple schema update
   */
  _addAttributeStrategy(change) {
    const newSchema = this.schemaManager.getSchema();
    const newConn = this.migrateToSchema(newSchema);
    
    this._swapConnection(newConn);
    
    return {
      type: 'addAttribute',
      attribute: change.fullAttribute
    };
  }
  
  /**
   * Strategy for removing attribute - removes from entities
   */
  _removeAttributeStrategy(change) {
    const currentDb = this.dataStore.db();
    const newSchema = this.schemaManager.getSchema();
    
    // Get all entities and remove the attribute
    const entities = this._extractAllEntities(currentDb);
    const cleanedEntities = entities.map(entity => {
      const cleaned = { ...entity };
      delete cleaned[change.fullAttribute];
      return cleaned;
    });
    
    // Create new database with cleaned entities
    const newConn = createConn(newSchema);
    if (cleanedEntities.length > 0) {
      // Filter out entities that become empty after attribute removal
      const validEntities = cleanedEntities.filter(e => 
        Object.keys(e).some(k => k !== ':db/id')
      );
      if (validEntities.length > 0) {
        newConn.transact(validEntities);
      }
    }
    
    this._swapConnection(newConn);
    
    return {
      type: 'removeAttribute',
      attribute: change.fullAttribute,
      entitiesAffected: entities.length
    };
  }
  
  /**
   * Strategy for adding relationship - updates schema
   */
  _addRelationshipStrategy(change) {
    const newSchema = this.schemaManager.getSchema();
    const newConn = this.migrateToSchema(newSchema);
    
    this._swapConnection(newConn);
    
    return {
      type: 'addRelationship',
      from: change.fromEntity,
      relation: change.relationName,
      to: change.toEntity
    };
  }
  
  /**
   * Extract all entities from database
   */
  _extractAllEntities(db) {
    const entities = [];
    const seenIds = new Set();
    
    // Get all unique entity IDs
    const datoms = db.datoms('eavt');
    for (const datom of datoms) {
      if (!seenIds.has(datom.e)) {
        seenIds.add(datom.e);
        const entity = db.entity(datom.e);
        if (entity) {
          // Convert entity to transaction format
          const txEntity = { ':db/id': entity.id };
          for (const [attr, value] of Object.entries(entity)) {
            if (attr !== 'id' && attr.startsWith(':')) {
              txEntity[attr] = value;
            }
          }
          entities.push(txEntity);
        }
      }
    }
    
    return entities;
  }
  
  /**
   * Transform entities to match new schema
   */
  _transformEntities(entities, newSchema) {
    return entities.map(entity => {
      const transformed = { ':db/id': entity[':db/id'] };
      
      for (const [attr, value] of Object.entries(entity)) {
        if (attr === ':db/id') continue;
        
        // Only include attributes that exist in new schema
        if (newSchema[attr]) {
          transformed[attr] = value;
        }
      }
      
      return transformed;
    }).filter(e => Object.keys(e).length > 1); // Filter out empty entities
  }
  
  /**
   * Swap DataStore connection atomically
   */
  _swapConnection(newConn) {
    // This is a simplified version - in reality, we'd need to:
    // 1. Pause all ongoing transactions
    // 2. Update all proxy references
    // 3. Transfer subscriptions
    // 4. Update reactive engine
    
    // Store old connection for cleanup
    const oldConn = this.dataStore.conn;
    
    // Update DataStore's connection
    // Note: This requires making conn mutable in DataStore
    // In practice, we might need to create a new DataStore instance
    this.dataStore.conn = newConn;
    
    // Invalidate all proxies in registry
    if (this.dataStore._cleanupProxies) {
      this.dataStore._cleanupProxies();
    }
    
    // Re-attach listeners
    if (oldConn._listeners) {
      for (const [key, listener] of oldConn._listeners) {
        newConn._listeners.set(key, listener);
      }
    }
  }
  
  /**
   * Create a migration plan without executing
   * @param {Object} change - Schema change to plan
   * @returns {Object} Migration plan
   */
  planMigration(change) {
    const currentDb = this.dataStore.db();
    const entities = this._extractAllEntities(currentDb);
    
    const plan = {
      change,
      currentVersion: this.schemaManager.getVersion(),
      targetVersion: this.schemaManager.getVersion() + 1,
      entityCount: entities.length,
      estimatedTime: entities.length * 0.1, // Rough estimate in ms
      steps: []
    };
    
    switch (change.type) {
      case 'removeEntityType':
        const affected = entities.filter(e => 
          Object.keys(e).some(k => k.startsWith(`:${change.entityType}/`))
        );
        plan.entitiesAffected = affected.length;
        plan.steps = [
          'Backup current database',
          'Filter out entities of removed type',
          'Create new database with new schema',
          'Migrate remaining entities',
          'Swap connections',
          'Cleanup old connection'
        ];
        break;
        
      case 'removeAttribute':
        const withAttr = entities.filter(e => e[change.fullAttribute]);
        plan.entitiesAffected = withAttr.length;
        plan.steps = [
          'Backup current database',
          'Remove attribute from all entities',
          'Create new database with new schema',
          'Migrate cleaned entities',
          'Swap connections',
          'Cleanup old connection'
        ];
        break;
        
      default:
        plan.entitiesAffected = 0;
        plan.steps = [
          'Update schema',
          'Create new database',
          'Migrate all entities',
          'Swap connections'
        ];
    }
    
    return plan;
  }
}

/**
 * Factory function to create SchemaEvolution
 */
export function createSchemaEvolution(dataStore, schemaManager) {
  return new SchemaEvolution(dataStore, schemaManager);
}