/**
 * EntityProxy - Proxy wrapper for single entity access extending BaseHandle
 * 
 * Provides a convenient interface for working with individual entities:
 * - Dynamic property access (get/set methods)
 * - Entity-scoped queries and subscriptions
 * - Direct entity updates
 * - Actor system integration through BaseHandle
 * - Remote execution capability
 */

import { Handle } from '@legion/handle';

export class EntityProxy extends Handle {
  constructor(resourceManager, entityId, options = {}) {
    // Validate entity ID first (before calling super)
    if (entityId === null || entityId === undefined) {
      throw new Error('Entity ID is required');
    }
    
    if (typeof entityId !== 'number') {
      throw new Error('Entity ID must be a number');
    }
    
    // Call Handle constructor (which validates resourceManager)
    super(resourceManager);
    
    // Handle type is automatically set via getter (returns constructor.name)
    
    // Store entity-specific properties
    this.entityId = entityId;
    this.options = options || {};
    
    // Backward compatibility - expose store if resourceManager has it
    if (resourceManager.dataStore) {
      this.store = resourceManager.dataStore;
    }
    
    // Setup entity-specific cache invalidation
    this._setupEntityCacheInvalidation();
  }
  
  /**
   * Get current entity data
   * @returns {Promise<Object>} Complete entity data with all attributes
   */
  value() {
    if (this.isDestroyed()) {
      throw new Error('Handle has been destroyed');
    }
    
    // Check local cache if available from CacheManager
    if (this.cacheManager) {
      const cacheKey = `entity:${this.entityId}`;
      const cached = this.cacheManager.get(cacheKey);
      if (cached !== undefined) {
        return cached;
      }
    }
    
    // Get entity through ResourceManager (synchronous)
    const querySpec = {
      find: ['?attr', '?value'],
      where: [[this.entityId, '?attr', '?value']]
    };
    
    const results = this.resourceManager.query(querySpec);
    
    // Convert results to entity object
    const entity = { ':db/id': this.entityId };
    results.forEach(([attr, value]) => {
      entity[attr] = value;
    });
    
    if (results.length === 0) {
      throw new Error('Entity not found');
    }
    
    // Cache for future use if cacheManager available
    if (this.cacheManager) {
      const cacheKey = `entity:${this.entityId}`;
      this.cacheManager.set(cacheKey, entity, this.options?.cacheTTL || 5000);
    }
    
    return entity;
  }
  
  /**
   * Execute entity-scoped query
   * @param {Object} querySpec - Query specification with find and where clauses
   * @returns {Promise<Array>} Query results scoped to this entity
   */
  query(querySpec) {
    if (this.isDestroyed()) {
      throw new Error('Handle has been destroyed');
    }
    
    this._validateQuerySpec(querySpec);
    
    // Create entity-scoped query by substituting entity ID
    const entityScopedQuery = {
      find: querySpec.find,
      where: querySpec.where.map(clause => {
        if (Array.isArray(clause) && clause[0] === '?e') {
          // Replace ?e with actual entity ID
          return [this.entityId, clause[1], clause[2]];
        }
        return clause;
      })
    };
    
    return this.resourceManager.query(entityScopedQuery);
  }
  
  /**
   * Update entity attributes
   * @param {Object} updateData - Attributes to update
   * @returns {Promise<Object>} Update result with success status and metadata
   */
  update(updateData) {
    if (this.isDestroyed()) {
      throw new Error('Handle has been destroyed');
    }
    
    this._validateUpdateData(updateData);
    
    // Update through resourceManager (which wraps DataStore.updateEntity)
    const result = this.resourceManager.update(this.entityId, updateData);
    
    // Invalidate cache after successful update
    if (this.cacheManager) {
      const cacheKey = `entity:${this.entityId}`;
      this.cacheManager.invalidate(cacheKey);
    }
    
    return {
      success: true,
      entityId: this.entityId,
      ...result
    };
  }
  
  /**
   * Get attribute value by name
   * @param {string} attributeName - Attribute name (must start with ':')
   * @returns {Promise<*>} Attribute value or undefined if not found
   */
  get(attributeName) {
    if (this.isDestroyed()) {
      throw new Error('Handle has been destroyed');
    }
    
    this._validateAttributeName(attributeName);
    
    // Try to get from cached full entity data first
    if (this.cacheManager) {
      const cacheKey = `entity:${this.entityId}`;
      const cached = this.cacheManager.get(cacheKey);
      if (cached && cached[attributeName] !== undefined) {
        return cached[attributeName];
      }
    }
    
    // Query for specific attribute (synchronous)
    const results = this.resourceManager.query({
      find: ['?value'],
      where: [
        [this.entityId, attributeName, '?value']
      ]
    });
    
    return results.length > 0 ? results[0][0] : undefined;
  }
  
  /**
   * Set attribute value
   * @param {string} attributeName - Attribute name (must start with ':')
   * @param {*} value - Attribute value
   * @returns {Promise<Object>} Update result with success status
   */
  set(attributeName, value) {
    if (this.isDestroyed()) {
      throw new Error('Handle has been destroyed');
    }
    
    this._validateAttributeName(attributeName);
    
    if (value === undefined) {
      throw new Error('Attribute value is required');
    }
    
    return this.update({ [attributeName]: value });
  }
  
  /**
   * Check if entity exists in store
   * @returns {Promise<boolean>} True if entity exists
   */
  exists() {
    if (this.isDestroyed()) {
      throw new Error('Handle has been destroyed');
    }
    
    try {
      // Query for any attribute of this entity to check existence
      const results = this.resourceManager.query({
        find: ['?attr'],
        where: [
          [this.entityId, '?attr', '?value']
        ]
      });
      return results.length > 0;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Actor system message handler for EntityProxy-specific methods
   * @param {string} messageType - Type of message
   * @param {Object} data - Message data
   * @returns {Promise<any>} Method result
   */
  async receive(messageType, data) {
    switch (messageType) {
      case 'call-method':
        const { method, args } = data;
        switch (method) {
          case 'value':
            return this.value();
          case 'get':
            return this.get(...args);
          case 'set':
            return this.set(...args);
          case 'update':
            return this.update(...args);
          case 'exists':
            return this.exists();
          case 'query':
            return this.query(...args);
          default:
            throw new Error(`Unknown method: ${method}`);
        }
      
      default:
        // Delegate to parent BaseHandle
        return await super.receive(messageType, data);
    }
  }
  
  /**
   * Serialize EntityProxy for remote transmission
   * @returns {Object} Serialization data
   */
  serialize() {
    return {
      __type: 'RemoteHandle',
      handleId: this.handleId || `entity-${this.entityId}`,
      handleType: this.handleType,
      attributes: this.options || {},
      data: {
        entityId: this.entityId
      }
    };
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
    
    if (!querySpec.find || (Array.isArray(querySpec.find) && querySpec.find.length === 0)) {
      throw new Error('Query specification must have find clause');
    }
    
    if (!querySpec.where) {
      throw new Error('Query specification must have where clause');
    }
    
    if (!Array.isArray(querySpec.where)) {
      throw new Error('Where clause must be an array');
    }
  }
  
  /**
   * Validate update data
   * @param {Object} updateData - Update data to validate
   * @throws {Error} If update data is invalid
   * @private
   */
  _validateUpdateData(updateData) {
    if (!updateData) {
      throw new Error('Update data is required');
    }
    
    if (typeof updateData !== 'object') {
      throw new Error('Update data must be an object');
    }
    
    const attributes = Object.keys(updateData);
    if (attributes.length === 0) {
      throw new Error('Update data cannot be empty');
    }
    
    // Validate attribute names for DataScript (should start with ':')
    for (const attr of attributes) {
      if (!attr.startsWith(':')) {
        throw new Error(`Attributes must start with ':'. Found: ${attr}`);
      }
    }
  }
  
  /**
   * Validate attribute name
   * @param {string} attributeName - Attribute name to validate
   * @throws {Error} If attribute name is invalid
   * @private
   */
  _validateAttributeName(attributeName) {
    if (!attributeName) {
      throw new Error('Attribute name is required');
    }
    
    if (typeof attributeName !== 'string' || !attributeName.startsWith(':')) {
      throw new Error('Attribute name must start with \':\'');
    }
  }
  
  /**
   * Setup cache invalidation subscription for this specific entity
   * @private
   */
  _setupEntityCacheInvalidation() {
    // Subscribe to changes for this specific entity to auto-invalidate cache
    try {
      if (this.resourceManager.subscribe) {
        const entityChangeQuery = {
          find: ['?attr', '?value'],
          where: [[this.entityId, '?attr', '?value']]
        };
        
        const subscription = this.resourceManager.subscribe(entityChangeQuery, () => {
          // Invalidate cache when this entity changes
          if (this.cacheManager) {
            const cacheKey = `entity:${this.entityId}`;
            this.cacheManager.invalidate(cacheKey);
          }
        });
        
        // Store subscription for cleanup
        this._entitySubscription = subscription;
      }
    } catch (error) {
      // If subscription fails, continue without cache invalidation
      // Cache will still work with TTL expiration
      console.warn('Failed to setup entity cache invalidation:', error.message);
    }
  }
  
  /**
   * Check if this handle has been destroyed
   * @returns {boolean} True if destroyed
   */
  isDestroyed() {
    return this._destroyed === true;
  }
  
  /**
   * Clean up resources when handle is disposed
   */
  destroy() {
    if (this._destroyed) {
      return; // Already destroyed
    }
    
    // Clean up entity-specific subscription
    if (this._entitySubscription && typeof this._entitySubscription.unsubscribe === 'function') {
      try {
        this._entitySubscription.unsubscribe();
      } catch (error) {
        console.warn('Failed to cleanup entity subscription:', error.message);
      }
      this._entitySubscription = null;
    }
    
    // Call parent cleanup (which will set _destroyed and clean _subscriptions)
    super.destroy();
  }
}