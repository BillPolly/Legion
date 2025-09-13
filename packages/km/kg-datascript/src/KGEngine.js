/**
 * KGEngine - Direct DataScript usage with object mapping
 * Clean, focused implementation without unnecessary duplication
 */

import { KGDataScriptCore } from './KGDataScriptCore.js';
import { ObjectMapper } from './ObjectMapper.js';

export class KGEngine {
  constructor(schema = {}) {
    this.core = new KGDataScriptCore(schema);
    this.objects = new ObjectMapper(this.core);
    this.changeListeners = new Set();
    
    // Set up change propagation
    this.unsubscribe = this.core.onChange((changes) => {
      this._notifyListeners(changes);
    });
  }

  /**
   * Add object to knowledge graph
   * @param {Object} obj - Object to add
   * @param {string} id - Optional ID
   * @returns {string} Object ID
   */
  add(obj, id = null) {
    return this.objects.add(obj, id);
  }

  /**
   * Get object by ID
   * @param {string} id - Object ID
   * @returns {Object|null} Object or null
   */
  get(id) {
    return this.objects.get(id);
  }

  /**
   * Update object
   * @param {Object} obj - Object to update
   * @param {Object} updates - Properties to update
   * @returns {Object} Updated object
   */
  update(obj, updates) {
    return this.objects.update(obj, updates);
  }

  /**
   * Remove object
   * @param {Object|string} objOrId - Object or ID to remove
   */
  remove(objOrId) {
    return this.objects.remove(objOrId);
  }

  /**
   * Query using Datalog directly
   * @param {string} query - Datalog query string
   * @param {...any} inputs - Query inputs
   * @returns {Array} Query results
   */
  query(query, ...inputs) {
    return this.core.query(query, ...inputs);
  }

  /**
   * Find objects matching pattern
   * @param {Object} pattern - Pattern to match
   * @returns {Array<Object>} Matching objects
   */
  find(pattern) {
    return this.objects.find(pattern);
  }

  /**
   * Pull entity data using DataScript pull API
   * @param {string} pattern - Pull pattern
   * @param {number|string} id - Entity ID or ident
   * @returns {Object} Pulled data
   */
  pull(pattern, id) {
    return this.core.datascript.pull(pattern, id);
  }

  /**
   * Execute transaction directly
   * @param {Array} txData - Transaction data
   * @returns {Object} Transaction report
   */
  transact(txData) {
    return this.core.datascript.transact(txData);
  }

  /**
   * Get all objects
   * @returns {Array<Object>} All objects
   */
  getAll() {
    return this.objects.getAll();
  }

  /**
   * Get object ID
   * @param {Object} obj - Object
   * @returns {string|null} Object ID or null
   */
  getObjectId(obj) {
    return this.objects.getObjectId(obj);
  }

  /**
   * Add change listener
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  onChange(callback) {
    this.changeListeners.add(callback);
    return () => this.changeListeners.delete(callback);
  }

  /**
   * Clear all data
   */
  clear() {
    return this.objects.clear();
  }

  /**
   * Get database snapshot
   * @returns {Object} Current database
   */
  db() {
    return this.core.datascript.db();
  }

  /**
   * Direct DataScript access for advanced usage
   */
  get datascript() {
    return this.core.datascript;
  }

  /**
   * Notify listeners of changes
   */
  _notifyListeners(changes) {
    for (const listener of this.changeListeners) {
      try {
        listener(changes);
      } catch (error) {
        console.error('Error in change listener:', error);
      }
    }
  }

  /**
   * Destroy and clean up
   */
  destroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    this.changeListeners.clear();
    this.core.destroy();
  }
}