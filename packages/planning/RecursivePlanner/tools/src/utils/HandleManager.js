/**
 * Handle Management System
 * Utilities for creating, validating, and managing opaque resource handles
 */

/**
 * Generate a unique handle for a resource
 * @param {string} type - Handle type
 * @param {Object} additionalData - Additional data to include in handle
 * @returns {Object} Generated handle
 */
export function generateHandle(type, additionalData = {}) {
  const handle = {
    _id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    _type: type,
    ...additionalData
  };

  // Ensure _id and _type cannot be overridden
  handle._id = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  handle._type = type;

  return handle;
}

/**
 * Validate handle structure
 * @param {Object} handle - Handle to validate
 * @throws {Error} If handle structure is invalid
 */
export function validateHandleStructure(handle) {
  if (!handle || typeof handle !== 'object') {
    throw new Error('Invalid handle structure: handle must be an object');
  }

  if (!handle._id) {
    throw new Error('Invalid handle structure: missing _id');
  }

  if (!handle._type) {
    throw new Error('Invalid handle structure: missing _type');
  }

  if (typeof handle._id !== 'string') {
    throw new Error('Invalid handle structure: _id must be a string');
  }

  if (typeof handle._type !== 'string') {
    throw new Error('Invalid handle structure: _type must be a string');
  }
}

/**
 * Check if an object is a valid handle
 * @param {any} obj - Object to check
 * @returns {boolean} True if object is a valid handle
 */
export function isHandle(obj) {
  try {
    validateHandleStructure(obj);
    return true;
  } catch {
    return false;
  }
}

/**
 * HandleManager class for tracking and managing handles
 */
export class HandleManager {
  constructor() {
    this.handles = new Map();
  }

  /**
   * Register a handle
   * @param {Object} handle - Handle to register
   */
  register(handle) {
    validateHandleStructure(handle);
    this.handles.set(handle._id, handle);
  }

  /**
   * Get a handle by ID
   * @param {string} id - Handle ID
   * @returns {Object|null} Handle or null if not found
   */
  get(id) {
    return this.handles.get(id) || null;
  }

  /**
   * Check if a handle exists
   * @param {string} id - Handle ID
   * @returns {boolean} True if handle exists
   */
  exists(id) {
    return this.handles.has(id);
  }

  /**
   * List handles by type
   * @param {string} type - Handle type
   * @returns {Array} Array of handles of the specified type
   */
  listByType(type) {
    return Array.from(this.handles.values()).filter(handle => handle._type === type);
  }

  /**
   * Unregister a handle
   * @param {string} id - Handle ID
   * @returns {boolean} True if handle was removed
   */
  unregister(id) {
    return this.handles.delete(id);
  }

  /**
   * Clear all handles
   */
  clear() {
    this.handles.clear();
  }

  /**
   * Get the number of registered handles
   * @returns {number} Number of handles
   */
  size() {
    return this.handles.size;
  }

  /**
   * Get all handles
   * @returns {Array} Array of all handles
   */
  getAll() {
    return Array.from(this.handles.values());
  }
}