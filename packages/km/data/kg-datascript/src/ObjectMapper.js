/**
 * Thin object mapping layer for DataScript
 * Replaces the 546-line LiveStore with focused functionality
 */

export class ObjectMapper {
  constructor(core) {
    this.core = core;
    this.identityMap = new Map(); // ID -> Object
    this.reverseMap = new WeakMap(); // Object -> ID
  }

  /**
   * Add object to database
   * @param {Object} obj - Object to add
   * @param {string} id - Optional ID
   * @returns {string} Object ID
   */
  add(obj, id = null) {
    // Check if object already exists
    if (this.reverseMap.has(obj)) {
      return this.reverseMap.get(obj);
    }

    const objectId = id || this._generateId();
    
    // Store in DataScript
    const eid = this.core.storeObject(obj, objectId);
    
    // Update identity maps
    this.identityMap.set(objectId, obj);
    this.reverseMap.set(obj, objectId);
    
    return objectId;
  }

  /**
   * Get object by ID
   * @param {string} id - Object ID
   * @returns {Object|null} Object or null
   */
  get(id) {
    // Check cache first
    if (this.identityMap.has(id)) {
      return this.identityMap.get(id);
    }

    // Load from DataScript
    const obj = this.core.getObject(id);
    if (obj) {
      this.identityMap.set(id, obj);
      this.reverseMap.set(obj, id);
    }
    
    return obj;
  }

  /**
   * Update object
   * @param {Object} obj - Object to update
   * @param {Object} updates - Properties to update
   * @returns {Object} Updated object
   */
  update(obj, updates) {
    const id = this.reverseMap.get(obj);
    if (!id) {
      throw new Error('Object not tracked');
    }

    return this.core.updateObject(obj, updates);
  }

  /**
   * Remove object
   * @param {Object|string} objOrId - Object or ID to remove
   */
  remove(objOrId) {
    const id = typeof objOrId === 'string' ? objOrId : this.reverseMap.get(objOrId);
    const obj = typeof objOrId === 'object' ? objOrId : this.identityMap.get(objOrId);
    
    if (!id) {
      // Silently return if object not found - don't throw
      return;
    }

    // Remove from DataScript
    this.core.removeObject(id);

    // Clean up maps
    if (obj) {
      this.reverseMap.delete(obj);
    }
    this.identityMap.delete(id);
  }

  /**
   * Find objects matching pattern
   * @param {Object} pattern - Query pattern
   * @returns {Array<Object>} Matching objects
   */
  find(pattern) {
    const objects = this.core.findObjects(pattern);
    
    // Update identity maps
    for (const obj of objects) {
      const id = this.getObjectId(obj);
      if (id) {
        this.identityMap.set(id, obj);
        this.reverseMap.set(obj, id);
      }
    }
    
    return objects;
  }

  /**
   * Get object ID
   * @param {Object} obj - Object
   * @returns {string|null} Object ID or null
   */
  getObjectId(obj) {
    if (this.reverseMap.has(obj)) {
      return this.reverseMap.get(obj);
    }

    // Try to find by checking all stored objects
    // Avoid complex queries that cause DataScript comparison errors
    const jsonStr = JSON.stringify(obj);
    for (const [id, storedObj] of this.identityMap.entries()) {
      if (JSON.stringify(storedObj) === jsonStr) {
        this.reverseMap.set(obj, id);
        return id;
      }
    }
    
    // Check in DataScript cache
    for (const [objId, eid] of this.core.idToEid.entries()) {
      const storedObj = this.core.getObject(objId);
      if (storedObj && JSON.stringify(storedObj) === jsonStr) {
        this.reverseMap.set(obj, objId);
        this.identityMap.set(objId, obj);
        return objId;
      }
    }
    
    return null;
  }

  /**
   * Get all objects
   * @returns {Array<Object>} All objects
   */
  getAll() {
    return this.core.findObjects({});
  }

  /**
   * Clear all data
   */
  clear() {
    // Clear using cached entity IDs to avoid query issues
    if (this.core.idToEid.size > 0) {
      const retractions = [];
      for (const [objId, eid] of this.core.idToEid.entries()) {
        retractions.push([':db/retractEntity', eid]);
      }
      if (retractions.length > 0) {
        this.core.datascript.transact(retractions);
      }
    }
    
    this.identityMap.clear();
    this.reverseMap = new WeakMap();
    this.core.idToEid.clear();
  }

  /**
   * Generate unique ID
   */
  _generateId() {
    return `obj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}