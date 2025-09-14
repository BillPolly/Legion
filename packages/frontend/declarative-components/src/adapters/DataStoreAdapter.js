/**
 * DataStoreAdapter - Bridges declarative components with data stores
 * 
 * Provides a simplified interface for EquationSolver to interact with
 * reactive data systems, handling subscriptions and property access.
 */

// Simple Subscription class for standalone use
class Subscription {
  constructor(callback) {
    this.callback = callback;
    this.active = true;
  }
  
  unsubscribe() {
    this.active = false;
  }
}

export class DataStoreAdapter {
  constructor(dataStore, options = {}) {
    if (!dataStore) {
      throw new Error('DataStore is required');
    }
    
    this.dataStore = dataStore;
    this.subscriptions = new Map(); // property -> Set of callbacks
    this.activeSubscriptions = new Map(); // property -> Subscription instance
    this.entityCache = new Map(); // Cache for resolved entity data
    this.propertyCache = new Map(); // Cache for property access
    
    // Simple mode for testing - stores data in memory instead of DataScript
    this.simpleMode = options.simpleMode !== false; // Default to true
    this.simpleData = {}; // In-memory data store for simple mode
  }

  /**
   * Parse property path to handle array indexing properly
   * @param {string} path - Property path (e.g., "todos.items[0].title")
   * @returns {Array} Array of path segments
   * @private
   */
  parsePropertyPath(path) {
    // Split on dots but keep array indexing together
    // e.g., "todos.items[0].title" -> ["todos", "items[0]", "title"]
    const parts = [];
    let current = '';
    let inBracket = false;
    
    for (let i = 0; i < path.length; i++) {
      const char = path[i];
      
      if (char === '[') {
        inBracket = true;
        current += char;
      } else if (char === ']') {
        inBracket = false;
        current += char;
      } else if (char === '.' && !inBracket) {
        if (current) {
          parts.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }
    
    if (current) {
      parts.push(current);
    }
    
    return parts;
  }

  /**
   * Get property value from DataStore
   * @param {string} path - Property path (e.g., "user.name", "user.profile.bio")
   * @returns {*} Property value
   */
  getProperty(path) {
    if (this.simpleMode) {
      // Simple mode: navigate directly through in-memory data
      // Handle array indexing in path (e.g., todos.items[0].title)
      const parts = this.parsePropertyPath(path);
      let current = this.simpleData;
      
      for (const part of parts) {
        if (current && typeof current === 'object') {
          // Handle array indexing
          const arrayMatch = part.match(/^(.+)\[(\d+)\]$/);
          if (arrayMatch) {
            const [, propName, index] = arrayMatch;
            current = current[propName];
            if (Array.isArray(current)) {
              current = current[parseInt(index, 10)];
            } else {
              return undefined;
            }
          } else {
            current = current[part];
          }
        } else {
          return undefined;
        }
      }
      
      return current;
    }

    // Original DataScript mode
    if (this.propertyCache.has(path)) {
      return this.propertyCache.get(path);
    }

    const parts = path.split('.');
    const [entityName, ...propertyParts] = parts;

    // Query for entity data
    const entityData = this.getEntityData(entityName);
    if (!entityData) {
      return undefined;
    }

    // Navigate nested properties
    let value = entityData;
    for (const part of propertyParts) {
      if (value && typeof value === 'object') {
        value = value[part];
      } else {
        value = undefined;
        break;
      }
    }

    // Cache the result
    this.propertyCache.set(path, value);
    return value;
  }

  /**
   * Set property value in DataStore
   * @param {string} path - Property path
   * @param {*} value - New value
   */
  setProperty(path, value) {
    if (this.simpleMode) {
      // Simple mode: update in-memory data directly
      // Handle array indexing in path (e.g., todos.items[0].title)
      const parts = this.parsePropertyPath(path);
      let current = this.simpleData;
      
      // Navigate to the parent of the target property
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        
        // Handle array indexing
        const arrayMatch = part.match(/^(.+)\[(\d+)\]$/);
        if (arrayMatch) {
          const [, propName, index] = arrayMatch;
          if (!current[propName]) {
            current[propName] = [];
          }
          current = current[propName];
          const idx = parseInt(index, 10);
          if (!current[idx]) {
            current[idx] = {};
          }
          current = current[idx];
        } else {
          if (!current[part] || typeof current[part] !== 'object') {
            current[part] = {};
          }
          current = current[part];
        }
      }
      
      // Set the final property
      const finalPart = parts[parts.length - 1];
      
      // Handle array indexing in final part
      const arrayMatch = finalPart.match(/^(.+)\[(\d+)\]$/);
      if (arrayMatch) {
        const [, propName, index] = arrayMatch;
        if (!current[propName]) {
          current[propName] = [];
        }
        current[propName][parseInt(index, 10)] = value;
      } else {
        current[finalPart] = value;
      }
      
      // Notify subscribers (if any)
      this.notifySubscribers(path, value);
      return;
    }

    // Original DataScript mode
    const parts = path.split('.');
    const [entityName, ...propertyParts] = parts;

    // Get entity ID from cache or query
    const entityId = this.getEntityId(entityName);
    if (!entityId) {
      throw new Error(`Entity "${entityName}" not found`);
    }

    // Build update object
    const updateData = {
      ':db/id': entityId
    };

    // Convert nested property path to DataScript attribute
    const attributeName = ':' + propertyParts.join('/');
    updateData[attributeName] = value;

    // Update in DataStore
    try {
      this.dataStore.updateEntity(entityId, updateData);
      
      // Clear relevant caches
      this.clearPropertyCache(path);
      this.clearEntityCache(entityName);
      
    } catch (error) {
      throw new Error(`Failed to set property "${path}": ${error.message}`);
    }
  }

  /**
   * Subscribe to property changes
   * @param {string} path - Property path
   * @param {Function} callback - Change callback
   */
  on(path, callback) {
    if (!this.subscriptions.has(path)) {
      this.subscriptions.set(path, new Set());
    }
    
    this.subscriptions.get(path).add(callback);
    
    // Create DataStore subscription if this is the first callback for this path
    if (this.subscriptions.get(path).size === 1) {
      this.createDataStoreSubscription(path);
    }
  }

  /**
   * Unsubscribe from property changes
   * @param {string} path - Property path  
   * @param {Function} callback - Callback to remove
   */
  off(path, callback) {
    if (!this.subscriptions.has(path)) {
      return;
    }
    
    this.subscriptions.get(path).delete(callback);
    
    // Remove DataStore subscription if no more callbacks
    if (this.subscriptions.get(path).size === 0) {
      this.removeDataStoreSubscription(path);
      this.subscriptions.delete(path);
    }
  }

  /**
   * Get entity data by name
   * @param {string} entityName - Entity name
   * @returns {Object|null} Entity data or null
   */
  getEntityData(entityName) {
    if (this.simpleMode) {
      // Simple mode: return entity data directly from memory
      return this.simpleData[entityName] || null;
    }

    // Check cache first
    if (this.entityCache.has(entityName)) {
      return this.entityCache.get(entityName);
    }

    try {
      // Query for entity by name
      const results = this.dataStore.query({
        find: ['?e', '?attr', '?value'],
        where: [
          ['?e', ':entity/name', entityName],
          ['?e', '?attr', '?value']
        ]
      });

      if (results.length === 0) {
        return null;
      }

      // Convert results to entity object
      const entityData = {};
      let entityId = null;

      for (const [e, attr, value] of results) {
        entityId = e;
        // Convert DataScript attribute back to plain property
        const propName = attr.startsWith(':') ? attr.substring(1) : attr;
        if (propName !== 'entity/name') { // Skip the name attribute
          entityData[propName] = value;
        }
      }

      entityData._entityId = entityId;
      entityData._entityName = entityName;

      // Cache the result
      this.entityCache.set(entityName, entityData);
      return entityData;

    } catch (error) {
      console.warn(`Failed to query entity "${entityName}":`, error);
      return null;
    }
  }

  /**
   * Get entity ID by name
   * @param {string} entityName - Entity name
   * @returns {number|null} Entity ID or null
   */
  getEntityId(entityName) {
    const entityData = this.getEntityData(entityName);
    return entityData ? entityData._entityId : null;
  }

  /**
   * Create DataStore subscription for property path
   * @param {string} path - Property path
   * @private
   */
  createDataStoreSubscription(path) {
    const parts = path.split('.');
    const [entityName, ...propertyParts] = parts;

    // Create a more specific query that focuses on the specific attribute being changed
    const attributeName = ':' + propertyParts.join('/');
    const query = {
      find: ['?e'],
      where: [
        ['?e', ':entity/name', entityName],
        ['?e', attributeName, '?value']
      ]
    };

    // Create the callback function
    const callback = (results, changes) => {
      // Clear caches
      this.clearPropertyCache(path);
      this.clearEntityCache(entityName);

      // Get new property value
      const newValue = this.getProperty(path);

      // Notify all callbacks for this property
      const callbacks = this.subscriptions.get(path);
      if (callbacks) {
        callbacks.forEach(callback => {
          try {
            callback(newValue);
          } catch (error) {
            console.error(`Error in property callback for "${path}":`, error);
          }
        });
      }
    };

    // Create subscription with correct parameter order: (id, query, callback, rootEntity)
    const subscriptionId = `adapter-${path}-${Date.now()}`;
    const subscription = new Subscription(subscriptionId, query, callback, null);

    // Register with DataStore
    this.dataStore._reactiveEngine.addSubscription(subscription);
    this.activeSubscriptions.set(path, subscription);
  }

  /**
   * Remove DataStore subscription for property path
   * @param {string} path - Property path
   * @private
   */
  removeDataStoreSubscription(path) {
    const subscription = this.activeSubscriptions.get(path);
    if (subscription) {
      // Deactivate subscription
      subscription.deactivate();
      
      // Remove from reactive engine
      this.dataStore._reactiveEngine.removeSubscription(subscription.id);
      
      // Remove from our tracking
      this.activeSubscriptions.delete(path);
    }
  }

  /**
   * Clear property cache for path and related paths
   * @param {string} path - Property path
   * @private
   */
  clearPropertyCache(path) {
    // Clear exact match
    this.propertyCache.delete(path);
    
    // Clear any paths that start with this path (nested properties)
    for (const cachedPath of this.propertyCache.keys()) {
      if (cachedPath.startsWith(path + '.')) {
        this.propertyCache.delete(cachedPath);
      }
    }
  }

  /**
   * Clear entity cache
   * @param {string} entityName - Entity name
   * @private
   */
  clearEntityCache(entityName) {
    this.entityCache.delete(entityName);
  }

  /**
   * Notify subscribers of property changes
   * @param {string} path - Property path that changed
   * @param {*} newValue - New value
   * @private
   */
  notifySubscribers(path, newValue) {
    if (this.subscriptions.has(path)) {
      const callbacks = this.subscriptions.get(path);
      for (const callback of callbacks) {
        try {
          callback(newValue);
        } catch (error) {
          console.error('Error in subscription callback:', error);
        }
      }
    }
  }

  /**
   * Initialize entities in DataStore
   * @param {Object} entities - Entity definitions
   */
  async initializeEntities(entities) {
    if (this.simpleMode) {
      // Simple mode: store data directly in memory
      this.simpleData = { ...entities };
      return;
    }

    // Original DataScript mode
    const entityData = [];

    for (const [entityName, data] of Object.entries(entities)) {
      // Convert flat object to DataScript format
      const dsData = {
        ':entity/name': entityName
      };

      for (const [key, value] of Object.entries(data)) {
        dsData[`:${key}`] = value;
      }

      entityData.push(dsData);
    }

    // Create entities in DataStore
    if (entityData.length > 0) {
      await this.dataStore.createEntities(entityData);
    }

    // Clear all caches
    this.entityCache.clear();
    this.propertyCache.clear();
  }

  /**
   * Clean up all subscriptions and caches
   */
  cleanup() {
    // Remove all active subscriptions
    for (const [path, subscription] of this.activeSubscriptions) {
      subscription.deactivate();
      this.dataStore._reactiveEngine.removeSubscription(subscription.id);
    }

    // Clear all state
    this.subscriptions.clear();
    this.activeSubscriptions.clear();
    this.entityCache.clear();
    this.propertyCache.clear();
  }
}

/**
 * Create DataStore adapter with initial entities
 * @param {DataStore} dataStore - DataStore instance
 * @param {Object} initialEntities - Initial entity data
 * @returns {DataStoreAdapter} Configured adapter
 */
export async function createDataStoreAdapter(dataStore, initialEntities = {}) {
  const adapter = new DataStoreAdapter(dataStore);
  
  if (Object.keys(initialEntities).length > 0) {
    await adapter.initializeEntities(initialEntities);
  }
  
  return adapter;
}