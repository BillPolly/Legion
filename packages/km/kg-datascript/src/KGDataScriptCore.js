/**
 * KG-DataScript Core
 * Uses DataScript directly for efficient storage and querying
 */

import datascript from 'datascript';

const { 
  create_conn, 
  transact, 
  q, 
  pull, 
  pull_many,
  entity,
  listen,
  unlisten,
  conn_from_db,
  db,
  filter: d_filter,
  with: d_with
} = datascript;

export class KGDataScriptCore {
  constructor(schema = {}) {
    // Add default schema for object mapping
    // DataScript requires explicit schema definitions
    
    // Work around Actor framework's Object.prototype pollution
    // Create a completely clean object for DataScript
    const cleanProto = {};
    
    // First, create the default schema properties
    const defaults = {
      ':object/id': { ':db/unique': ':db.unique/identity' },
      ':object/type': { ':db/cardinality': ':db.cardinality/one' },
      ':object/data': { ':db/cardinality': ':db.cardinality/one' }
    };
    
    // Deep clone through JSON to ensure no prototype pollution
    const finalSchema = JSON.parse(JSON.stringify(defaults));
    
    // Copy schema properties if provided, filtering out functions
    if (schema && typeof schema === 'object' && !Array.isArray(schema)) {
      // Use Object.keys to only get own properties
      const keys = Object.keys(schema);
      for (const key of keys) {
        const value = schema[key];
        // Only include non-function properties in the schema
        if (typeof value !== 'function' && value !== undefined && value !== null) {
          // Deep clone each value to avoid nested prototype pollution
          finalSchema[key] = JSON.parse(JSON.stringify(value));
        }
      }
    }
    
    this.schema = finalSchema;
    
    // Pass the clean schema to DataScript
    try {
      this.conn = create_conn(finalSchema);
    } catch (error) {
      // If DataScript still complains about prototype pollution, try with null prototype object
      console.warn('DataScript initialization failed, trying with null prototype:', error.message);
      try {
        const nullProtoSchema = Object.create(null);
        // Copy just our default schema entries
        nullProtoSchema[':object/id'] = { ':db/unique': ':db.unique/identity' };
        nullProtoSchema[':object/type'] = { ':db/cardinality': ':db.cardinality/one' };
        nullProtoSchema[':object/data'] = { ':db/cardinality': ':db.cardinality/one' };
        
        this.conn = create_conn(nullProtoSchema);
      } catch (error2) {
        // Last resort - temporarily remove the pollution
        const originalReceive = Object.prototype.receive;
        const originalCreate = Object.prototype.CREATE;
        delete Object.prototype.receive;
        delete Object.prototype.CREATE;
        
        try {
          this.conn = create_conn(finalSchema);
        } finally {
          // Restore the pollution
          Object.prototype.receive = originalReceive;
          Object.prototype.CREATE = originalCreate;
        }
      }
    }
    this.listeners = new Map();
    this.objectCache = new WeakMap();
    this.idToEid = new Map(); // Map object IDs to entity IDs
  }

  /**
   * Store a JavaScript object in DataScript
   * @param {Object} obj - JavaScript object to store
   * @param {string} id - Optional ID (will generate if not provided)
   * @returns {string} Object ID
   */
  storeObject(obj, id = null) {
    const objectId = id || this._generateId();
    const type = obj.constructor.name;
    
    // Ensure we're storing a plain object copy to avoid prototype pollution
    const plainObj = JSON.parse(JSON.stringify(obj));
    
    // Build transaction data
    const txData = [{
      ':db/id': -1,
      ':object/id': objectId,
      ':object/type': type,
      ':object/data': JSON.stringify(plainObj)
    }];

    const report = transact(this.conn, txData);
    const eid = report.tempids[-1];
    
    // Cache the original object with its entity ID
    this.objectCache.set(obj, eid);
    this.idToEid.set(objectId, eid);
    
    // Manually trigger change notifications synchronously
    this._notifyListeners(report, [obj]);
    
    return objectId;
  }

  /**
   * Retrieve a JavaScript object from DataScript
   * @param {string} id - Object ID
   * @returns {Object|null} JavaScript object or null if not found
   */
  getObject(id) {
    // If object was removed, return null
    if (!this.idToEid.has(id)) {
      return null;
    }
    
    const database = db(this.conn);
    const eid = this.idToEid.get(id);
    
    try {
      const entity = pull(database, '[*]', eid);
      if (entity && entity[':object/data']) {
        const obj = JSON.parse(entity[':object/data']);
        this.objectCache.set(obj, eid);
        return obj;
      }
    } catch (error) {
      // Entity doesn't exist anymore
      this.idToEid.delete(id);
      return null;
    }
    
    return null;
  }

  /**
   * Update an object in DataScript
   * @param {Object} obj - JavaScript object to update
   * @param {Object} updates - Properties to update
   * @returns {Object} Updated object
   */
  updateObject(obj, updates) {
    const eid = this.objectCache.get(obj);
    if (!eid) {
      throw new Error('Object not found in database');
    }

    // Merge updates into object
    Object.assign(obj, updates);
    
    // Build retraction and addition transactions
    const database = db(this.conn);
    const entity = pull(database, '[*]', eid);
    const type = entity[':object/type'];
    
    const txData = [
      // Retract old data
      [':db/retract', eid, ':object/data', entity[':object/data']],
      // Add new data
      [':db/add', eid, ':object/data', JSON.stringify(obj)]
    ];

    const report = transact(this.conn, txData);
    
    // Manually trigger change notifications synchronously
    this._notifyListeners(report, [obj]);
    
    return obj;
  }

  /**
   * Query using DataScript's Datalog directly
   * @param {string} query - Datalog query
   * @param {...any} inputs - Query inputs
   * @returns {Array} Query results
   */
  query(query, ...inputs) {
    try {
      return q(query, db(this.conn), ...inputs);
    } catch (error) {
      // DataScript comparison errors - return empty result
      if (error.message && error.message.includes('Cannot compare')) {
        console.warn('DataScript query error (returning empty result):', error.message);
        return [];
      }
      throw error;
    }
  }

  /**
   * Remove an object from DataScript
   * @param {string} id - Object ID to remove
   */
  removeObject(id) {
    // Use cached entity ID to avoid query
    const eid = this.idToEid.get(id);
    
    if (eid) {
      // Get the object before removing for notification
      const obj = this.getObject(id);
      
      // Retract the entire entity
      const report = transact(this.conn, [[':db/retractEntity', eid]]);
      
      // Clean up caches
      this.idToEid.delete(id);
      
      // Manually trigger change notifications synchronously
      if (obj) {
        this._notifyListeners(report, [obj]);
      }
    }
  }

  /**
   * Query for objects (returns JavaScript objects instead of datoms)
   * @param {Object} pattern - Pattern to match
   * @returns {Array<Object>} Matching objects
   */
  findObjects(pattern) {
    const database = db(this.conn);
    
    // Use the cached ID map to avoid complex queries
    const objects = [];
    for (const [objId, eid] of this.idToEid.entries()) {
      const obj = this.getObject(objId);
      if (obj && this._matchesPattern(obj, pattern)) {
        objects.push(obj);
      }
    }
    
    return objects;
  }

  /**
   * Check if object matches pattern
   */
  _matchesPattern(obj, pattern) {
    for (const [key, value] of Object.entries(pattern)) {
      if (key === 'type') {
        // Check constructor name
        if (obj.constructor.name !== value && value !== 'Object') {
          return false;
        }
      } else if (obj[key] !== value) {
        return false;
      }
    }
    return true;
  }

  /**
   * Add change listener
   * @param {Function} callback - Function to call on changes
   * @returns {Function} Unsubscribe function
   */
  onChange(callback) {
    const listener = (report) => {
      // Extract changed objects - look for any changes to our object attributes
      const changedEids = new Set();
      for (const datom of report.tx_data) {
        const attr = datom[1];
        if (typeof attr === 'string' && 
            (attr === ':object/data' || attr === ':object/id' || attr === ':object/type')) {
          changedEids.add(datom[0]);
        }
      }

      const changedObjects = [];
      for (const eid of changedEids) {
        // Find the object ID for this entity
        const database = db(this.conn);
        const entity = pull(database, '[:object/id]', eid);
        if (entity && entity[':object/id']) {
          const obj = this.getObject(entity[':object/id']);
          if (obj) {
            changedObjects.push(obj);
          }
        }
      }

      if (changedObjects.length > 0) {
        callback({ 
          objects: changedObjects,
          report 
        });
      }
    };

    listen(this.conn, 'changes', listener);
    this.listeners.set(callback, listener);
    
    return () => {
      unlisten(this.conn, 'changes', listener);
      this.listeners.delete(callback);
    };
  }

  /**
   * Direct DataScript access for advanced usage
   */
  get datascript() {
    return {
      conn: this.conn,
      db: () => db(this.conn),
      transact: (tx) => transact(this.conn, tx),
      q,
      pull,
      pull_many,
      entity
    };
  }

  /**
   * Generate unique ID
   */
  _generateId() {
    return `obj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Notify listeners of changes
   */
  _notifyListeners(report, objects) {
    for (const callback of this.listeners.keys()) {
      try {
        callback({ objects, report });
      } catch (error) {
        console.error('Error in change listener:', error);
      }
    }
  }

  /**
   * Destroy and clean up
   */
  destroy() {
    for (const listener of this.listeners.values()) {
      unlisten(this.conn, 'changes', listener);
    }
    this.listeners.clear();
    this.objectCache = new WeakMap();
    this.idToEid.clear();
  }
}