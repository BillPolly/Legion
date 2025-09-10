/**
 * KGEngine - Unified facade for the KG-DataScript system
 * 
 * This class provides a single entry point for all KG operations,
 * combining object-based APIs, DataScript querying, serialization,
 * classic KG operations, and reactive features.
 */

import { KGDataScriptCore } from './KGDataScriptCore.js';
import { ObjectIdentityManager } from './ObjectIdentityManager.js';
import { LiveStore } from './LiveStore.js';
import { SerializationEngine } from './SerializationEngine.js';
import { DeserializationEngine } from './DeserializationEngine.js';
import { StableIdGenerator } from './StableIdGenerator.js';
import { KGClassicOperations } from './KGClassicOperations.js';
import { ObjectExtensions } from './ObjectExtensions.js';
import { QueryEngine } from './QueryEngine.js';
import { PatternTranslator } from './PatternTranslator.js';
import { KGEntityProxy } from './KGEntityProxy.js';
import { resetEntityIdCounter } from '../../datascript/src/core/db.js';

export class KGEngine {
  constructor(schema = {}) {
    // Save schema for clear() method
    this.schema = schema;
    
    // Initialize core components
    this.core = new KGDataScriptCore(schema);
    this.identityManager = new ObjectIdentityManager();
    this.idGenerator = new StableIdGenerator();
    
    // Initialize live store
    this.store = new LiveStore(this.core, this.identityManager);
    
    // Initialize serialization
    this.serializer = new SerializationEngine(this.identityManager);
    this.deserializer = new DeserializationEngine(this.identityManager);
    
    // Initialize classic KG operations
    this.kgOps = new KGClassicOperations(this.identityManager, this.serializer);
    
    // Initialize query components
    this.queryEngine = new QueryEngine(this.core, this.store, this.identityManager);
    this.patternTranslator = new PatternTranslator();
    
    // Initialize object extensions
    ObjectExtensions.initialize(this.identityManager, this.serializer, this.idGenerator);
    
    // Track subscriptions
    this._subscriptions = new Map();
    this._proxyCache = new WeakMap();
  }

  // ============================================
  // Object API - Primary interface for objects
  // ============================================

  /**
   * Add an object to the store
   * @param {Object} obj - The object to add
   * @returns {Object} Result with success status and ID
   */
  add(obj) {
    if (!obj || typeof obj !== 'object') {
      throw new Error('Can only add objects to store');
    }

    const result = this.store.add(obj);
    const id = this.identityManager.getId(obj);
    
    return {
      success: true,
      object: obj,
      id: id
    };
  }

  /**
   * Remove an object from the store
   * @param {Object} obj - The object to remove
   * @returns {Object} Result with success status
   */
  remove(obj) {
    if (!obj || typeof obj !== 'object') {
      throw new Error('Can only remove objects from store');
    }

    const id = this.identityManager.getId(obj);
    if (!id) {
      throw new Error('Object is not registered in store');
    }

    const result = this.store.remove(obj);
    
    return {
      success: true,
      object: obj
    };
  }

  /**
   * Update an object in the store
   * @param {Object} obj - The object to update
   * @param {Object} updates - Property updates to apply
   * @returns {Object} Result with success status
   */
  update(obj, updates) {
    if (!obj || typeof obj !== 'object') {
      throw new Error('Can only update objects in store');
    }

    const id = this.identityManager.getId(obj);
    if (!id) {
      throw new Error('Object is not registered in store');
    }

    // Apply updates
    Object.assign(obj, updates);
    
    // Update in store
    const result = this.store.update(obj, updates);
    
    // Notify subscribers
    this._notifySubscribers(obj, updates);
    
    return {
      success: true,
      object: obj
    };
  }

  /**
   * Get an object by ID
   * @param {string} id - The object ID
   * @returns {Object|null} The object or null if not found
   */
  get(id) {
    return this.identityManager.getObject(id) || null;
  }

  /**
   * Add multiple objects in batch
   * @param {Array<Object>} objects - Array of objects to add
   * @returns {Array<Object>} Results for each object
   */
  addBatch(objects) {
    if (!Array.isArray(objects)) {
      throw new Error('addBatch requires an array of objects');
    }

    return objects.map(obj => this.add(obj));
  }

  // ============================================
  // Query API - DataScript and pattern queries
  // ============================================

  /**
   * Execute a Datalog query
   * @param {string|Object} querySpec - Datalog query string (EDN) or object
   * @param {Array} inputs - Query inputs
   * @returns {Array} Query results as objects
   */
  query(querySpec, ...inputs) {
    // If string, parse EDN to object format (DataScript EDN parsing is broken)
    if (typeof querySpec === 'string') {
      // Parse EDN string to object query
      // Basic pattern: [:find ?e :where [?e :entity/type "person"]]
      const ednMatch = querySpec.match(/\[:find\s+(.*?)\s+:where\s+(.*)\]/s);
      if (ednMatch) {
        const findPart = ednMatch[1].trim();
        const wherePart = ednMatch[2].trim();
        
        // Parse find variables
        const findVars = findPart.split(/\s+/).filter(v => v.startsWith('?'));
        
        // Parse where clauses - handle multiple clauses
        const whereClauses = [];
        const clauseMatches = wherePart.matchAll(/\[([^\]]+)\]/g);
        for (const match of clauseMatches) {
          const clause = match[1].trim().split(/\s+/).map(term => {
            // Handle string literals
            if (term.startsWith('"') && term.endsWith('"')) {
              return term.slice(1, -1);
            }
            // Handle numbers
            if (!isNaN(term)) {
              return Number(term);
            }
            // Keywords remain as-is (with colon)
            // Variables remain as-is (with ?)
            return term;
          });
          whereClauses.push(clause);
        }
        
        const queryObj = {
          find: findVars,
          where: whereClauses
        };
        
        // Use object query (which works correctly)
        const results = this.queryEngine.query(queryObj, ...inputs);
        
        // Hydrate results with objects
        return this.queryEngine.hydrateResults(results);
      }
      
      // If not a valid EDN query, convert to object format anyway
      // DataScript EDN string parsing is fundamentally broken
      throw new Error(`Unsupported query format: ${querySpec}. Use object format instead.`);
    }
    
    // Otherwise use object query and hydrate
    const results = this.queryEngine.query(querySpec, ...inputs);
    return this.queryEngine.hydrateResults(results);
  }

  /**
   * Execute a pattern query
   * @param {Object} pattern - Pattern to match
   * @returns {Array} Matching objects
   */
  queryPattern(pattern) {
    if (!pattern || typeof pattern !== 'object') {
      throw new Error('Pattern must be an object');
    }

    const datalog = this.patternTranslator.translate(pattern);
    return this.query(datalog);
  }

  /**
   * Find a single object matching criteria
   * @param {Object} criteria - Search criteria
   * @returns {Object|null} First matching object or null
   */
  find(criteria) {
    const results = this.queryPattern(criteria);
    return results[0] || null;
  }

  /**
   * Find all objects matching criteria
   * @param {Object} criteria - Search criteria
   * @returns {Array} All matching objects
   */
  findAll(criteria) {
    return this.queryPattern(criteria);
  }

  // ============================================
  // Serialization API - Save/load functionality
  // ============================================

  /**
   * Serialize an object to triples
   * @param {Object} obj - Object to serialize
   * @returns {Array} Array of triples
   */
  serialize(obj) {
    // Auto-register if needed
    if (!this.identityManager.getId(obj)) {
      this.identityManager.register(obj);
    }
    
    return this.serializer.serialize(obj);
  }

  /**
   * Serialize all objects in store
   * @returns {Object} Storage format with all objects and triples
   */
  serializeAll() {
    const allObjects = this.identityManager.getAllObjects();
    const allTriples = this.serializer.serializeBatch(allObjects);
    const storageFormat = this.serializer.toStorageFormat(allTriples);
    
    // Add objects mapping for deserialization
    const objectsById = {};
    allObjects.forEach(obj => {
      const id = this.identityManager.getId(obj);
      objectsById[id] = obj;
    });
    
    return {
      ...storageFormat,
      objects: objectsById
    };
  }

  /**
   * Convert triples to storage format
   * @param {Array} triples - Array of triples
   * @returns {Object} Storage format
   */
  toStorageFormat(triples) {
    return this.serializer.toStorageFormat(triples);
  }

  /**
   * Deserialize from storage format
   * @param {Object} data - Storage format data
   * @returns {Object} Result with objects and statistics
   */
  deserialize(data) {
    const result = this.deserializer.loadFromStorage(data);
    
    return {
      success: true,
      objects: result.objects,
      objectCount: Object.keys(result.objects).length,
      tripleCount: result.tripleCount
    };
  }

  /**
   * Save entire store to JSON string
   * @returns {string} JSON representation
   */
  save() {
    const data = this.serializeAll();
    return JSON.stringify(data, null, 2);
  }

  /**
   * Load store from JSON string
   * @param {string} json - JSON data
   * @returns {Object} Load result
   */
  load(json) {
    const data = JSON.parse(json);
    const result = this.deserialize(data);
    
    // Add all loaded objects to store
    Object.values(result.objects).forEach(obj => {
      this.store.add(obj);
    });
    
    return result;
  }

  // ============================================
  // Classic KG API - Triple-based operations
  // ============================================

  /**
   * Add a triple for an object
   * @param {Object} subject - Subject object
   * @param {string} predicate - Predicate name
   * @param {*} value - Object value
   * @returns {Object} Result with triple
   */
  addTriple(subject, predicate, value) {
    return this.kgOps.addTriple(subject, predicate, value);
  }

  /**
   * Remove a triple
   * @param {Object} subject - Subject object
   * @param {string} predicate - Predicate name
   * @param {*} value - Object value
   * @returns {Object} Result with removed count
   */
  removeTriple(subject, predicate, value) {
    return this.kgOps.removeTriple(subject, predicate, value);
  }

  /**
   * Get all triples
   * @returns {Array} All triples in the store
   */
  getTriples() {
    return this.kgOps.getTriples();
  }

  /**
   * Query triples by pattern
   * @param {Object} pattern - Pattern to match
   * @returns {Array} Matching triples
   */
  queryTriples(pattern) {
    return this.kgOps.queryPattern(pattern);
  }

  // ============================================
  // Proxy API - Reactive entity proxies
  // ============================================

  /**
   * Create a proxy for an object
   * @param {Object} obj - Object to proxy
   * @returns {KGEntityProxy} Entity proxy
   */
  proxy(obj) {
    // Check cache first
    if (this._proxyCache.has(obj)) {
      return this._proxyCache.get(obj);
    }

    const id = this.identityManager.getId(obj);
    if (!id) {
      throw new Error('Object must be registered before creating proxy');
    }

    const proxy = new KGEntityProxy(obj, this.store, this.identityManager);
    this._proxyCache.set(obj, proxy);
    
    return proxy;
  }

  /**
   * Watch an object for changes
   * @param {Object} obj - Object to watch
   * @param {Function} callback - Callback for changes
   * @returns {Function} Unsubscribe function
   */
  watch(obj, callback) {
    if (!obj || typeof obj !== 'object') {
      throw new Error('Can only watch objects');
    }

    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }

    // Get or create subscription set for object
    if (!this._subscriptions.has(obj)) {
      this._subscriptions.set(obj, new Set());
    }

    const subscribers = this._subscriptions.get(obj);
    subscribers.add(callback);

    // Return unsubscribe function
    return () => {
      subscribers.delete(callback);
      if (subscribers.size === 0) {
        this._subscriptions.delete(obj);
      }
    };
  }

  /**
   * Stop watching an object
   * @param {Object} obj - Object to unwatch
   */
  unwatch(obj) {
    this._subscriptions.delete(obj);
  }

  /**
   * Notify subscribers of changes
   * @private
   */
  _notifySubscribers(obj, changes) {
    const subscribers = this._subscriptions.get(obj);
    if (subscribers) {
      subscribers.forEach(callback => {
        try {
          callback(changes, obj);
        } catch (error) {
          console.error('Subscriber callback error:', error);
        }
      });
    }
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Generate a stable ID for an object
   * @param {Object} obj - Object to generate ID for
   * @returns {string} Stable ID
   */
  generateStableId(obj) {
    return this.idGenerator.generateId(obj);
  }

  /**
   * Get statistics about the store
   * @returns {Object} Statistics
   */
  getStats() {
    const db = this.core.db();
    const objectCount = this.identityManager.size();
    // Count entities by finding all unique entity IDs
    const entities = this.core.q({
      find: ['?e'],
      where: [['?e', ':entity/id', '?id']]
    });
    const entityCount = entities.length;
    
    // Count total facts as combination of DataScript datoms and KG triples
    const datoms = db.datoms('eavt').length;
    const kgTriples = this.kgOps.getTriples().length;
    const tripleCount = datoms + kgTriples;

    return {
      objectCount,
      entityCount,
      tripleCount,
      subscriptionCount: this._subscriptions.size
    };
  }

  /**
   * Clear all data from the store
   */
  clear() {
    // Reset DataScript global entity counter for test isolation
    resetEntityIdCounter();
    
    // Clear the DataScript core
    this.core = new KGDataScriptCore(this.schema);
    
    // Clear identity manager
    this.identityManager = new ObjectIdentityManager();
    
    // Clear serialization components
    this.serializer = new SerializationEngine(this.identityManager);
    this.deserializer = new DeserializationEngine(this.identityManager);
    this.idGenerator = new StableIdGenerator();
    
    // Clear store with new core and identity manager
    this.store = new LiveStore(this.core, this.identityManager);
    
    // Clear query engine
    this.queryEngine = new QueryEngine(this.core, this.store, this.identityManager);
    
    // Clear KG operations with new serializer
    this.kgOps = new KGClassicOperations(this.identityManager, this.serializer);
    
    // Clear subscriptions
    this._subscriptions.clear();
    this._proxyCache = new WeakMap();
    
    // Re-initialize extensions with new components
    ObjectExtensions.cleanup();
    ObjectExtensions.initialize(this.identityManager, this.serializer, this.idGenerator);
  }

  /**
   * Cleanup and remove all extensions
   */
  cleanup() {
    ObjectExtensions.cleanup();
    this._subscriptions.clear();
    this._proxyCache = new WeakMap();
  }
}