/**
 * CollectionProxy - Proxy wrapper for collections of entities with iteration and filtering
 * 
 * Refactored to extend Handle from @legion/km-data-handle for universal base functionality.
 * Provides a convenient interface for working with collections of entities:
 * - Entity collection access and manipulation
 * - Array-like iteration methods (map, filter, find, forEach)
 * - Bulk update operations
 * - Individual entity proxy access
 * - Collection-wide subscriptions
 */

import { Handle } from '@legion/data-handle';
import { EntityProxy } from './EntityProxy.js';

export class CollectionProxy extends Handle {
  constructor(resourceManager, collectionSpec, options = {}) {
    // Call Handle constructor first (which validates resourceManager)
    super(resourceManager);
    
    // Validate collection specification after super call
    if (!collectionSpec) {
      throw new Error('Collection specification is required');
    }
    
    // Validate collection specification structure
    this._validateCollectionSpec(collectionSpec);
    
    // Store collection specification and options
    this.collectionSpec = collectionSpec;
    this.options = options;
    
    // For backward compatibility with tests
    this.entityKey = collectionSpec.entityKey || this._detectEntityKey(collectionSpec);
    
    // Backward compatibility - expose store if resourceManager has it
    if (resourceManager.dataStore) {
      this.store = resourceManager.dataStore;
    }
    
    // Cache for entity proxies
    this._entityProxies = new Map();
  }
  
  /**
   * Get collection length
   * @returns {number} Number of entities in collection
   */
  getLength() {
    const entityIds = this._getEntityIds();
    return entityIds.length;
  }
  
  /**
   * Check if collection is empty
   * @returns {boolean} True if collection has no entities
   */
  getIsEmpty() {
    const length = this.getLength();
    return length === 0;
  }
  
  /**
   * Get first entity in collection
   * @returns {Object|null} First entity or null if empty
   */
  getFirst() {
    const entityIds = this._getEntityIds();
    if (entityIds.length === 0) {
      return null;
    }
    
    // Get entity through query
    const querySpec = {
      find: ['?attr', '?value'],
      where: [[entityIds[0], '?attr', '?value']]
    };
    const results = this.resourceManager.query(querySpec);
    
    // Convert to entity object
    const entity = { ':db/id': entityIds[0] };
    results.forEach(([attr, value]) => {
      entity[attr] = value;
    });
    return Object.keys(entity).length > 1 ? entity : null;
  }
  
  /**
   * Get last entity in collection
   * @returns {Object|null} Last entity or null if empty
   */
  getLast() {
    const entityIds = this._getEntityIds();
    if (entityIds.length === 0) {
      return null;
    }
    
    // Get entity through query
    const querySpec = {
      find: ['?attr', '?value'],
      where: [[entityIds[entityIds.length - 1], '?attr', '?value']]
    };
    const results = this.resourceManager.query(querySpec);
    
    // Convert to entity object
    const entity = { ':db/id': entityIds[entityIds.length - 1] };
    results.forEach(([attr, value]) => {
      entity[attr] = value;
    });
    return Object.keys(entity).length > 1 ? entity : null;
  }
  
  /**
   * Sync properties for direct access
   */
  get length() {
    return this.getLength();
  }
  
  get isEmpty() {
    return this.getIsEmpty();
  }
  
  get first() {
    return this.getFirst();
  }
  
  get last() {
    return this.getLast();
  }
  
  /**
   * Filter collection entities
   * @param {Function} predicate - Filter predicate function
   * @returns {Array} Filtered array of entities
   */
  filter(predicate) {
    if (typeof predicate !== 'function') {
      throw new Error('Filter predicate must be a function');
    }
    
    const entities = this.toArray();
    const results = [];
    
    for (const entity of entities) {
      if (predicate(entity)) {
        results.push(entity);
      }
    }
    
    return results;
  }
  
  /**
   * Map over collection entities
   * @param {Function} mapper - Mapping function
   * @returns {Array} Mapped results
   */
  map(mapper) {
    if (typeof mapper !== 'function') {
      throw new Error('Map function must be a function');
    }
    
    const entities = this.toArray();
    const results = [];
    
    for (let i = 0; i < entities.length; i++) {
      const result = mapper(entities[i], i, entities);
      results.push(result);
    }
    
    return results;
  }
  
  /**
   * Find entity in collection
   * @param {Function} predicate - Search predicate function
   * @returns {Object|undefined} First matching entity or undefined
   */
  find(predicate) {
    if (typeof predicate !== 'function') {
      throw new Error('Find predicate must be a function');
    }
    
    const entities = this.toArray();
    
    for (const entity of entities) {
      if (predicate(entity)) {
        return entity;
      }
    }
    
    return undefined;
  }
  
  /**
   * Iterate over collection entities
   * @param {Function} callback - Iteration callback function
   * @returns {void}
   */
  forEach(callback) {
    if (typeof callback !== 'function') {
      throw new Error('ForEach callback must be a function');
    }
    
    const entities = this.toArray();
    
    for (let i = 0; i < entities.length; i++) {
      callback(entities[i], i, entities);
    }
  }
  
  /**
   * Get value of collection (implements Handle interface)
   * @returns {Array} Array of entities
   */
  value() {
    if (this.isDestroyed()) {
      throw new Error('Handle has been destroyed');
    }
    return this.toArray();
  }
  
  /**
   * Execute query with collection as context (implements Handle interface)
   * @param {Object} querySpec - Query specification
   * @returns {Array} Query results
   */
  query(querySpec) {
    if (this.isDestroyed()) {
      throw new Error('Handle has been destroyed');
    }
    
    this._validateQuerySpec(querySpec);
    
    // Execute query in collection context - delegate to resourceManager
    return this.resourceManager.query(querySpec);
  }
  
  /**
   * Convert collection to array
   * @returns {Array} Array of entities
   */
  toArray() {
    if (this.isDestroyed()) {
      throw new Error('Handle has been destroyed');
    }
    
    const entityIds = this._getEntityIds();
    const entities = [];
    
    for (const entityId of entityIds) {
      // Query for entity data synchronously
      const querySpec = {
        find: ['?attr', '?value'],
        where: [[entityId, '?attr', '?value']]
      };
      const results = this.resourceManager.query(querySpec);
      
      // Convert results to entity object
      const entity = { ':db/id': entityId };
      results.forEach(([attr, value]) => {
        entity[attr] = value;
      });
      
      if (Object.keys(entity).length > 1) { // Has more than just :db/id
        entities.push(entity);
      }
    }
    
    return entities;
  }
  
  /**
   * Detect entity key from collection specification
   * @param {Object} collectionSpec - Collection specification
   * @returns {string|null} Entity key variable or null
   * @private
   */
  _detectEntityKey(collectionSpec) {
    if (!collectionSpec || !collectionSpec.find) {
      return null;
    }
    
    // Look for entity variables in find clause
    for (const variable of collectionSpec.find) {
      if (typeof variable === 'string' && variable.startsWith('?')) {
        // Check if this appears as entity in where clause
        if (collectionSpec.where && Array.isArray(collectionSpec.where)) {
          const isEntity = collectionSpec.where.some(pattern => {
            return Array.isArray(pattern) && pattern[0] === variable;
          });
          if (isEntity) {
            return variable;
          }
        }
      }
    }
    
    return null;
  }
  
  /**
   * Get entity IDs that match the collection specification
   * @returns {Array} Array of entity IDs
   * @private
   */
  _getEntityIds() {
    const results = this.resourceManager.query(this.collectionSpec);
    
    // Handle different query result formats
    if (Array.isArray(results)) {
      // DataScript returns arrays of bindings: [[entityId1], [entityId2], ...]
      // or complex results: [[entityId1, attr1, val1], [entityId2, attr2, val2], ...]
      // Extract the first element (entity ID) from each result array
      return results.map(result => {
        if (Array.isArray(result)) {
          // Extract entity ID (first element in binding array)
          const entityId = result[0];
          // Ensure it's a number
          return typeof entityId === 'number' ? entityId : parseInt(entityId);
        } else {
          // Single value result
          return typeof result === 'number' ? result : parseInt(result);
        }
      }).filter(id => !isNaN(id)); // Filter out invalid IDs
    }
    
    return [];
  }
  
  /**
   * Get entity proxy by entity ID
   * @param {number} entityId - Entity ID
   * @returns {EntityProxy} Entity proxy for the specified entity
   */
  getEntityProxy(entityId) {
    if (this.isDestroyed()) {
      throw new Error('Handle has been destroyed');
    }
    
    if (entityId === null || entityId === undefined) {
      throw new Error('Entity ID is required');
    }
    
    if (typeof entityId !== 'number') {
      throw new Error('Entity ID must be a number');
    }
    
    // Check cache first
    if (this._entityProxies.has(entityId)) {
      return this._entityProxies.get(entityId);
    }
    
    // Create new entity proxy
    const entityProxy = new EntityProxy(this.resourceManager, entityId);
    this._entityProxies.set(entityId, entityProxy);
    
    return entityProxy;
  }
  
  /**
   * Get entity proxy by entity ID (alias for getEntityProxy)
   * @param {number} entityId - Entity ID
   * @returns {EntityProxy} Entity proxy for the specified entity
   */
  get(entityId) {
    return this.getEntityProxy(entityId);
  }
  
  /**
   * Update all entities in collection
   * @param {Object} updateData - Attributes to update
   * @returns {Object} Update result with success status and count
   */
  updateAll(updateData) {
    if (this.isDestroyed()) {
      throw new Error('Handle has been destroyed');
    }
    
    if (!updateData || typeof updateData !== 'object') {
      throw new Error('Update data must be an object');
    }
    
    const entityIds = this._getEntityIds();
    let updateCount = 0;
    const errors = [];
    
    for (const entityId of entityIds) {
      try {
        // Use synchronous update method from resourceManager
        this.resourceManager.update(entityId, updateData);
        updateCount++;
      } catch (error) {
        errors.push({ entityId, error: error.message });
      }
    }
    
    return {
      success: errors.length === 0,
      updated: updateCount,
      errors: errors
    };
  }
  
  /**
   * Update entities matching predicate
   * @param {Function} predicate - Selection predicate function
   * @param {Object} updateData - Attributes to update
   * @returns {Object} Update result with success status and count
   */
  updateWhere(predicate, updateData) {
    if (this.isDestroyed()) {
      throw new Error('Handle has been destroyed');
    }
    
    if (typeof predicate !== 'function') {
      throw new Error('Update predicate must be a function');
    }
    
    if (!updateData || typeof updateData !== 'object') {
      throw new Error('Update data must be an object');
    }
    
    const entities = this.toArray();
    const matchingEntities = entities.filter(predicate);
    
    let updateCount = 0;
    const errors = [];
    
    for (const entity of matchingEntities) {
      try {
        const entityId = entity[':db/id'];
        if (!entityId) {
          throw new Error('Entity missing :db/id attribute');
        }
        
        // Use synchronous update method from resourceManager
        this.resourceManager.update(entityId, updateData);
        updateCount++;
      } catch (error) {
        const entityId = entity[':db/id'] || 'unknown';
        errors.push({ entityId, error: error.message });
      }
    }
    
    return {
      success: errors.length === 0,
      updated: updateCount,
      errors: errors
    };
  }
  
  /**
   * Override Handle's destroy method to clean up entity proxies
   */
  destroy() {
    if (this._destroyed) {
      return; // Already destroyed
    }
    
    // Clean up entity proxy cache
    for (const entityProxy of this._entityProxies.values()) {
      if (typeof entityProxy.destroy === 'function') {
        entityProxy.destroy();
      }
    }
    this._entityProxies.clear();
    
    // Call parent cleanup
    super.destroy();
  }
  
  /**
   * Validate collection specification structure
   * @param {Object} collectionSpec - Collection specification to validate
   * @throws {Error} If collection specification is invalid
   * @private
   */
  _validateCollectionSpec(collectionSpec) {
    if (!collectionSpec || typeof collectionSpec !== 'object') {
      throw new Error('Collection specification must be an object');
    }
    
    if (!collectionSpec.find || (Array.isArray(collectionSpec.find) && collectionSpec.find.length === 0)) {
      throw new Error('Collection specification must have find clause');
    }
    
    if (!collectionSpec.where) {
      throw new Error('Collection specification must have where clause');
    }
    
    if (!Array.isArray(collectionSpec.where)) {
      throw new Error('Where clause must be an array');
    }
  }
  
  /**
   * Validate query specification
   * @param {Object} querySpec - Query specification to validate
   * @throws {Error} If query specification is invalid
   * @private
   */
  _validateQuerySpec(querySpec) {
    if (!querySpec) {
      throw new Error('Query specification is required');
    }
    
    if (typeof querySpec !== 'object') {
      throw new Error('Query specification must be an object');
    }
    
    if (!querySpec.find && !querySpec.where) {
      throw new Error('Query specification must have find or where clause');
    }
  }
}