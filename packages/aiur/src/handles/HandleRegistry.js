/**
 * HandleRegistry - Core handle storage and management
 * 
 * Provides persistent storage for handles with metadata tracking
 */

export class HandleRegistry {
  constructor() {
    // Map of handle ID -> handle object
    this.handles = new Map();
    // Map of handle name -> handle ID for quick name lookups
    this.nameIndex = new Map();
  }

  /**
   * Create a new handle
   * @param {string} name - The name for the handle
   * @param {any} data - The data to store in the handle
   * @returns {string} The handle ID
   */
  create(name, data, customMetadata = {}) {
    const handleId = this._generateId();
    const now = new Date();
    
    const handle = {
      id: handleId,
      name: name,
      data: data,
      metadata: {
        created: now,
        lastAccessed: now,
        accessCount: 0,
        ...customMetadata
      }
    };

    // If name already exists, remove old handle
    if (this.nameIndex.has(name)) {
      const oldHandleId = this.nameIndex.get(name);
      this.handles.delete(oldHandleId);
    }

    this.handles.set(handleId, handle);
    this.nameIndex.set(name, handleId);

    return handleId;
  }

  /**
   * Retrieve handle by ID
   * @param {string} handleId - The handle ID
   * @returns {Object|null} The handle object or null if not found
   */
  getHandle(handleId) {
    const handle = this.handles.get(handleId);
    if (!handle) {
      return null;
    }

    // Update access metadata
    handle.metadata.lastAccessed = new Date();
    handle.metadata.accessCount++;

    return handle;
  }

  /**
   * Retrieve handle by name
   * @param {string} name - The handle name
   * @returns {Object|null} The handle object or null if not found
   */
  getByName(name) {
    const handleId = this.nameIndex.get(name);
    if (!handleId) {
      return null;
    }
    return this.getHandle(handleId);
  }

  /**
   * Check if handle exists by ID
   * @param {string} handleId - The handle ID
   * @returns {boolean} True if handle exists
   */
  exists(handleId) {
    return this.handles.has(handleId);
  }

  /**
   * Check if handle exists by name
   * @param {string} name - The handle name
   * @returns {boolean} True if handle exists
   */
  existsByName(name) {
    return this.nameIndex.has(name);
  }

  /**
   * Update handle data
   * @param {string} name - The handle name
   * @param {*} newData - The new data
   * @returns {boolean} True if updated, false if not found
   */
  update(name, newData) {
    const handleId = this.nameIndex.get(name);
    if (!handleId) return false;

    const handle = this.handles.get(handleId);
    if (!handle) return false;

    handle.data = newData;
    handle.metadata.lastAccessed = new Date();
    return true;
  }

  /**
   * Delete handle by ID
   * @param {string} handleId - The handle ID
   * @returns {boolean} True if handle was deleted
   */
  delete(handleId) {
    const handle = this.handles.get(handleId);
    if (!handle) {
      return false;
    }

    this.handles.delete(handleId);
    this.nameIndex.delete(handle.name);
    return true;
  }

  /**
   * Delete handle by name
   * @param {string} name - The handle name
   * @returns {boolean} True if handle was deleted
   */
  deleteByName(name) {
    const handleId = this.nameIndex.get(name);
    if (!handleId) {
      return false;
    }
    return this.delete(handleId);
  }

  /**
   * List all handle names
   * @returns {string[]} Array of handle names
   */
  listNames() {
    return Array.from(this.nameIndex.keys());
  }

  /**
   * List all handles with their data
   * @returns {Object[]} Array of handle objects
   */
  listHandles() {
    const handles = [];
    for (const [handleId, handle] of this.handles) {
      handles.push(handle);
    }
    return handles;
  }


  /**
   * Get the number of handles
   * @returns {number} The number of handles
   */
  size() {
    return this.handles.size;
  }

  /**
   * Clear all handles
   */
  clear() {
    this.handles.clear();
    this.nameIndex.clear();
  }

  /**
   * Generate a unique handle ID
   * @private
   * @returns {string} Unique handle ID
   */
  _generateId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2);
    return `handle_${timestamp}_${random}`;
  }
}