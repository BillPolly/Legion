import { createConn, q } from '../../datascript/index.js';
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