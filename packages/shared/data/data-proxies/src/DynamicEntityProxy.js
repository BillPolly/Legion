/**
 * DynamicEntityProxy - EntityProxy with dynamic schema awareness
 * 
 * Extends EntityProxy to handle dynamic schema changes:
 * - Listens to schema change events
 * - Updates available properties dynamically
 * - Invalidates cache on schema updates
 * - Uses JavaScript Proxy to dynamically provide properties
 */

import { EntityProxy } from './EntityProxy.js';

export class DynamicEntityProxy extends EntityProxy {
  constructor(resourceManager, entityId, options = {}) {
    super(resourceManager, entityId, options);
    
    // Subscribe to schema changes if available
    this._setupSchemaChangeListener();
    
    // Return a Proxy to enable dynamic property access
    return new Proxy(this, {
      get: this._proxyGetHandler.bind(this),
      set: this._proxySetHandler.bind(this),
      has: this._proxyHasHandler.bind(this),
      ownKeys: this._proxyOwnKeysHandler.bind(this),
      getOwnPropertyDescriptor: this._proxyGetOwnPropertyDescriptorHandler.bind(this)
    });
  }
  
  /**
   * Setup listener for schema changes
   * @private
   */
  _setupSchemaChangeListener() {
    // Check if resourceManager has a dataStore with schema change support
    if (this.resourceManager.dataStore && 
        typeof this.resourceManager.dataStore.subscribeToSchemaChanges === 'function') {
      
      this._schemaUnsubscribe = this.resourceManager.dataStore.subscribeToSchemaChanges((change) => {
        this._handleSchemaChange(change);
      });
    }
  }
  
  /**
   * Handle schema change event
   * @param {Object} change - Schema change event
   * @private
   */
  _handleSchemaChange(change) {
    // Invalidate cache when schema changes
    if (this.cacheManager) {
      const cacheKey = `entity:${this.entityId}`;
      this.cacheManager.invalidate(cacheKey);
    }
    
    // Check if this entity is affected by the schema change
    const entityData = this.value();
    const affectedAttributes = Object.keys(entityData).filter(attr => {
      // Check if attribute belongs to changed entity type
      if (change.entityType) {
        const prefix = `:${change.entityType}/`;
        return attr.startsWith(prefix);
      }
      // Check specific attribute changes
      if (change.fullAttribute) {
        return attr === change.fullAttribute;
      }
      return false;
    });
    
    if (affectedAttributes.length > 0) {
      // Entity is affected - emit event if possible
      if (this.options.onSchemaChange) {
        this.options.onSchemaChange({
          entityId: this.entityId,
          change,
          affectedAttributes
        });
      }
    }
  }
  
  /**
   * Get available attributes for this entity based on current schema
   * @returns {Set<string>} Set of attribute names
   * @private
   */
  _getAvailableAttributes() {
    try {
      const entityData = this.value();
      return new Set(Object.keys(entityData).filter(attr => 
        attr.startsWith(':') && attr !== ':db/id'
      ));
    } catch (error) {
      // Entity might not exist yet
      return new Set();
    }
  }
  
  /**
   * Get entity type from existing attributes
   * @returns {string|null} Entity type name or null
   * @private
   */
  _getEntityType() {
    const attributes = this._getAvailableAttributes();
    for (const attr of attributes) {
      // Skip system attributes like :db/id
      if (attr === ':db/id') continue;
      
      const match = attr.match(/^:([^/]+)\//);
      if (match) {
        return match[1];
      }
    }
    return null;
  }
  
  /**
   * Proxy handler for property access
   * @private
   */
  _proxyGetHandler(target, property, receiver) {
    // Handle symbol properties
    if (typeof property === 'symbol') {
      return Reflect.get(target, property, receiver);
    }
    
    // Handle standard EntityProxy methods
    if (property in target) {
      const value = target[property];
      if (typeof value === 'function') {
        return value.bind(target);
      }
      return value;
    }
    
    // Handle dynamic attribute access (convert property name to DataScript format)
    if (typeof property === 'string' && !property.startsWith('_')) {
      const entityType = this._getEntityType();
      if (entityType) {
        // Convert camelCase to attribute format
        const attributeName = `:${entityType}/${property}`;
        
        // Check if this attribute exists in the entity
        const attributes = this._getAvailableAttributes();
        if (attributes.has(attributeName)) {
          return this.get(attributeName);
        }
      }
    }
    
    return undefined;
  }
  
  /**
   * Proxy handler for property setting
   * @private
   */
  _proxySetHandler(target, property, value, receiver) {
    // Handle standard properties
    if (property in target) {
      return Reflect.set(target, property, value, receiver);
    }
    
    // Handle dynamic attribute setting
    if (typeof property === 'string' && !property.startsWith('_')) {
      const entityType = this._getEntityType();
      if (entityType) {
        const attributeName = `:${entityType}/${property}`;
        this.set(attributeName, value);
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Proxy handler for 'in' operator
   * @private
   */
  _proxyHasHandler(target, property) {
    // Check standard properties first
    if (property in target) {
      return true;
    }
    
    // Check dynamic attributes
    if (typeof property === 'string' && !property.startsWith('_')) {
      const entityType = this._getEntityType();
      if (entityType) {
        const attributeName = `:${entityType}/${property}`;
        const attributes = this._getAvailableAttributes();
        return attributes.has(attributeName);
      }
    }
    
    return false;
  }
  
  /**
   * Proxy handler for Object.keys()
   * @private
   */
  _proxyOwnKeysHandler(target) {
    const keys = [];
    
    // Add dynamic attribute names only (not internal properties)
    const entityType = this._getEntityType();
    if (entityType) {
      const attributes = this._getAvailableAttributes();
      const prefix = `:${entityType}/`;
      
      for (const attr of attributes) {
        if (attr.startsWith(prefix)) {
          // Convert DataScript attribute to property name
          const propName = attr.substring(prefix.length);
          keys.push(propName);
        }
      }
    }
    
    // Add essential public properties
    keys.push('entityId');
    
    return keys;
  }
  
  /**
   * Proxy handler for property descriptors
   * @private
   */
  _proxyGetOwnPropertyDescriptorHandler(target, property) {
    // Handle standard properties
    if (property in target) {
      return Reflect.getOwnPropertyDescriptor(target, property);
    }
    
    // Handle dynamic attributes
    if (typeof property === 'string' && !property.startsWith('_')) {
      const entityType = this._getEntityType();
      if (entityType) {
        const attributeName = `:${entityType}/${property}`;
        const attributes = this._getAvailableAttributes();
        
        if (attributes.has(attributeName)) {
          return {
            enumerable: true,
            configurable: true,
            get: () => this.get(attributeName),
            set: (value) => this.set(attributeName, value)
          };
        }
      }
    }
    
    return undefined;
  }
  
  /**
   * Get schema for this entity's type
   * @returns {Object} Schema for entity type or empty object
   */
  getSchema() {
    const entityType = this._getEntityType();
    if (!entityType || !this.resourceManager.dataStore) {
      return {};
    }
    
    const fullSchema = this.resourceManager.dataStore.schema || {};
    const entitySchema = {};
    const prefix = `:${entityType}/`;
    
    for (const [attr, spec] of Object.entries(fullSchema)) {
      if (attr.startsWith(prefix)) {
        entitySchema[attr] = spec;
      }
    }
    
    return entitySchema;
  }
  
  /**
   * Clean up resources when handle is disposed
   */
  destroy() {
    // Unsubscribe from schema changes
    if (this._schemaUnsubscribe && typeof this._schemaUnsubscribe === 'function') {
      try {
        this._schemaUnsubscribe();
      } catch (error) {
        console.warn('Failed to unsubscribe from schema changes:', error.message);
      }
      this._schemaUnsubscribe = null;
    }
    
    // Call parent cleanup
    super.destroy();
  }
}

/**
 * Factory function to create a DynamicEntityProxy
 * @param {Object} resourceManager - ResourceManager or DataStore instance
 * @param {number} entityId - Entity ID
 * @param {Object} options - Additional options
 * @returns {DynamicEntityProxy} Proxied entity handle
 */
export function createDynamicEntityProxy(resourceManager, entityId, options = {}) {
  return new DynamicEntityProxy(resourceManager, entityId, options);
}