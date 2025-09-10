/**
 * ObjectIdentityManager - Manages object identity mapping using WeakMap
 * Provides stable IDs for objects while allowing garbage collection
 */
export class ObjectIdentityManager {
  constructor() {
    // WeakMap allows objects to be garbage collected
    this._objectToId = new WeakMap();
    // Regular Map for ID to object lookup
    this._idToObject = new Map();
    // Counter for generating unique IDs
    this._nextId = 1;
  }

  /**
   * Register an object and get its stable ID
   * @param {Object} obj - The object to register
   * @returns {number} The stable ID for the object
   */
  register(obj) {
    // Validate input
    if (obj === null || obj === undefined) {
      throw new Error('Cannot register null or undefined');
    }
    
    if (typeof obj !== 'object' && typeof obj !== 'function') {
      throw new Error('Can only register objects');
    }

    // Check if already registered
    if (this._objectToId.has(obj)) {
      return this._objectToId.get(obj);
    }

    // Generate new ID
    const id = this._nextId++;
    
    // Store bidirectional mapping
    this._objectToId.set(obj, id);
    this._idToObject.set(id, obj);
    
    return id;
  }

  /**
   * Get object by its ID
   * @param {number} id - The object ID
   * @returns {Object|undefined} The object or undefined if not found
   */
  getObject(id) {
    return this._idToObject.get(id);
  }

  /**
   * Get ID for an object
   * @param {Object} obj - The object
   * @returns {number|undefined} The ID or undefined if not registered
   */
  getId(obj) {
    if (obj === null || obj === undefined) {
      return undefined;
    }
    return this._objectToId.get(obj);
  }

  /**
   * Unregister an object and free its ID
   * @param {Object} obj - The object to unregister
   * @returns {boolean} True if unregistered, false if not found
   */
  unregister(obj) {
    const id = this.getId(obj);
    if (id === undefined) {
      return false;
    }

    this._objectToId.delete(obj);
    this._idToObject.delete(id);
    return true;
  }

  /**
   * Unregister by ID
   * @param {number} id - The ID to unregister
   * @returns {boolean} True if unregistered, false if not found
   */
  unregisterById(id) {
    const obj = this.getObject(id);
    if (obj === undefined) {
      return false;
    }

    this._objectToId.delete(obj);
    this._idToObject.delete(id);
    return true;
  }

  /**
   * Get the number of registered objects
   * @returns {number} The count of registered objects
   */
  size() {
    return this._idToObject.size;
  }

  /**
   * Clear all registrations
   */
  clear() {
    // Create new WeakMap (old one will be GC'd)
    this._objectToId = new WeakMap();
    this._idToObject.clear();
    // Reset ID counter
    this._nextId = 1;
  }

  /**
   * Check if an object is registered
   * @param {Object} obj - The object to check
   * @returns {boolean} True if registered
   */
  has(obj) {
    return this._objectToId.has(obj);
  }

  /**
   * Check if an ID exists
   * @param {number} id - The ID to check
   * @returns {boolean} True if ID exists
   */
  hasId(id) {
    return this._idToObject.has(id);
  }

  /**
   * Get all registered IDs
   * @returns {Array<number>} Array of all IDs
   */
  getAllIds() {
    return Array.from(this._idToObject.keys());
  }

  /**
   * Get all registered objects
   * @returns {Array<Object>} Array of all objects
   */
  getAllObjects() {
    return Array.from(this._idToObject.values());
  }

  /**
   * Register an object with a specific ID (used for deserialization)
   * @param {Object} obj - The object to register
   * @param {number} id - The specific ID to use
   * @returns {number} The ID
   */
  registerWithId(obj, id) {
    // Validate input
    if (obj === null || obj === undefined) {
      throw new Error('Cannot register null or undefined');
    }
    
    if (typeof obj !== 'object' && typeof obj !== 'function') {
      throw new Error('Can only register objects');
    }

    // Check if already registered
    if (this._objectToId.has(obj)) {
      return this._objectToId.get(obj);
    }
    
    // Store bidirectional mapping
    this._objectToId.set(obj, id);
    this._idToObject.set(id, obj);
    
    // Update next ID if necessary to avoid conflicts
    if (id >= this._nextId) {
      this._nextId = id + 1;
    }
    
    return id;
  }
}