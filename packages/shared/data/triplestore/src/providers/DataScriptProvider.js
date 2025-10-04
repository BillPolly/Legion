import { ITripleStore } from '../core/ITripleStore.js';
import { StorageError, ValidationError } from '../core/StorageError.js';
// Import from Legion datascript package
import { createConn as create_conn, transact, q, pull, entity, listen, unlisten, db } from '@legion/datascript';

/**
 * DataScriptProvider - DataScript-backed triple store implementation
 * 
 * Features:
 * - DataScript's Datalog queries
 * - Schema validation and evolution
 * - Change notifications
 * - Object mapping layer
 * - Transaction support
 * 
 * Runtime: ✅ Client & Server - DataScript works in browser and Node.js
 * 
 * Migrated from: /packages/km/kg-datascript/
 */
export class DataScriptProvider extends ITripleStore {
  constructor(options = {}) {
    super();
    
    // Store original user schema for introspection
    this.userSchema = options.schema || {};
    
    // Validate schema if requested (validate original format)
    if (options.validateSchema) {
      this._validateSchema(this.userSchema);
    }
    
    // Build complete schema with defaults and conversion for DataScript
    const { userFacingSchema, datascriptSchema } = this._buildSchema(this.userSchema);
    this.schema = userFacingSchema; // Keep original format for user
    
    // Clean schema to avoid prototype pollution issues with DataScript
    const cleanSchema = this._cleanSchema(datascriptSchema);
    
    // Initialize DataScript connection with converted schema
    try {
      this.conn = create_conn(cleanSchema);
    } catch (error) {
      // Handle prototype pollution by temporarily removing it
      const originalReceive = Object.prototype.receive;
      const originalCreate = Object.prototype.CREATE;
      delete Object.prototype.receive;
      delete Object.prototype.CREATE;
      
      try {
        this.conn = create_conn(cleanSchema);
      } finally {
        // Restore prototype methods if they existed
        if (originalReceive) Object.prototype.receive = originalReceive;
        if (originalCreate) Object.prototype.CREATE = originalCreate;
      }
    }
    
    // Store options
    this.options = {
      validateSchema: options.validateSchema || false,
      ...options
    };
    
    // Listener management
    this.listeners = new Map();
    this.nextListenerId = 1;
    
    // Triple to entity ID mapping
    this.tripleToEntity = new Map();
    this.nextEntityId = 1;
  }

  /**
   * Get metadata about this provider
   * @returns {Object} - Provider metadata
   */
  getMetadata() {
    return {
      type: 'datascript',
      supportsTransactions: true,
      supportsPersistence: false, // In-memory by default
      supportsAsync: true,
      schema: this.schema,
      capabilities: {
        transactions: true,
        datalog: true,
        pull: true,
        history: false,
        rules: true
      }
    };
  }

  /**
   * Add a triple to the store
   * @param {string|number} subject - The subject
   * @param {string} predicate - The predicate
   * @param {string|number|boolean} object - The object
   * @returns {Promise<boolean>} - True if added, false if already exists
   */
  async addTriple(subject, predicate, object) {
    // Check if triple already exists
    const exists = await this._tripleExists(subject, predicate, object);
    if (exists) return false;
    
    // Create entity for this triple
    const entityId = this._getOrCreateEntityId(subject, predicate, object);
    
    // Build transaction data (use plain attributes without colons)
    const txData = [{
      ':db/id': entityId,
      'triple/id': this._tripleKey(subject, predicate, object),
      'triple/subject': String(subject),
      'triple/predicate': String(predicate),
      'triple/object': this._serializeObject(object)
    }];
    
    try {
      // Transact the data
      transact(this.conn, txData);
      return true;
    } catch (error) {
      throw new StorageError(`Failed to add triple: ${error.message}`, 'TRANSACTION_ERROR', error);
    }
  }

  /**
   * Remove a triple from the store
   * @param {string|number} subject - The subject
   * @param {string} predicate - The predicate
   * @param {string|number|boolean} object - The object
   * @returns {Promise<boolean>} - True if removed, false if not found
   */
  async removeTriple(subject, predicate, object) {
    const tripleKey = this._tripleKey(subject, predicate, object);
    
    // Find the entity with this triple
    const currentDb = db(this.conn);
    const results = q(
      `[:find ?e :where [?e "triple/id" "${tripleKey}"]]`,
      currentDb
    );
    
    if (results.length === 0) return false;
    
    // Retract the entity
    const entityId = results[0][0];
    const txData = [[':db.fn/retractEntity', entityId]];
    
    try {
      transact(this.conn, txData);
      this.tripleToEntity.delete(tripleKey);
      return true;
    } catch (error) {
      throw new StorageError(`Failed to remove triple: ${error.message}`, 'TRANSACTION_ERROR', error);
    }
  }

  /**
   * Query triples with pattern matching
   * @param {string|number|null} subject - Subject or null for wildcard
   * @param {string|null} predicate - Predicate or null for wildcard
   * @param {string|number|boolean|null} object - Object or null for wildcard
   * @returns {Promise<Array<[subject, predicate, object]>>} - Array of matching triples
   */
  async query(subject, predicate, object) {
    const currentDb = db(this.conn);
    
    // Build Datalog query using EDN string format (plain attributes without colons)
    // Basic pattern with variables
    let whereClause = '[?e "triple/subject" ?s] [?e "triple/predicate" ?p] [?e "triple/object" ?o]';
    
    // Add filter conditions using = predicates
    const filters = [];
    if (subject !== null && subject !== undefined) {
      filters.push(`[(= ?s "${String(subject)}")]`);
    }
    if (predicate !== null && predicate !== undefined) {
      filters.push(`[(= ?p "${String(predicate)}")]`);
    }
    if (object !== null && object !== undefined) {
      filters.push(`[(= ?o "${this._serializeObject(object)}")]`);
    }
    
    if (filters.length > 0) {
      whereClause += ' ' + filters.join(' ');
    }
    
    try {
      const queryStr = `[:find ?s ?p ?o :where ${whereClause}]`;
      const results = q(queryStr, currentDb);
      
      // Convert results back to proper format
      return results.map(([s, p, o]) => [
        s,
        p,
        this._deserializeObject(o)
      ]);
    } catch (error) {
      throw new StorageError(`Query failed: ${error.message}`, 'QUERY_ERROR', error);
    }
  }

  /**
   * Get the total number of triples
   * @returns {Promise<number>} - Count of triples
   */
  async size() {
    const currentDb = db(this.conn);
    const results = q(
      '[:find (count ?e) :where [?e "triple/id"]]',
      currentDb
    );
    return results[0] ? results[0][0] : 0;
  }

  /**
   * Clear all triples
   * @returns {Promise<void>}
   */
  async clear() {
    // Get all entity IDs
    const currentDb = db(this.conn);
    const results = q(
      '[:find ?e :where [?e "triple/id"]]',
      currentDb
    );
    
    if (results.length > 0) {
      // Build retraction transaction
      const txData = results.map(([eid]) => [':db.fn/retractEntity', eid]);
      
      try {
        transact(this.conn, txData);
        this.tripleToEntity.clear();
        this.nextEntityId = 1;
      } catch (error) {
        throw new StorageError(`Failed to clear store: ${error.message}`, 'TRANSACTION_ERROR', error);
      }
    }
  }

  /**
   * Extend the schema with new attributes
   * @param {Object} newSchema - New schema attributes to add
   */
  extendSchema(newSchema) {
    // Merge new schema with existing user schema
    Object.assign(this.userSchema, newSchema);
    Object.assign(this.schema, newSchema);
    
    // Note: DataScript doesn't support schema evolution on existing connections
    // In a real implementation, we'd need to migrate data to a new connection
    // For MVP, we'll just update our internal schema reference
  }

  // Private helper methods

  /**
   * Build complete schema with defaults
   * Returns both user-facing schema (preserving original format) and DataScript-converted schema
   * @private
   */
  _buildSchema(userSchema) {
    // Default triple schema - user-facing uses Datomic format
    const defaultSchemaUser = {
      ':triple/id': { ':db/unique': ':db.unique/identity' },
      ':triple/subject': { ':db/cardinality': ':db.cardinality/one' },
      ':triple/predicate': { ':db/cardinality': ':db.cardinality/one' },
      ':triple/object': { ':db/cardinality': ':db.cardinality/one' }
    };
    
    // DataScript schema - use plain strings without colons to avoid comparison bug
    const defaultSchemaDS = {
      'triple/id': { ':db/unique': ':db.unique/identity' },
      'triple/subject': { ':db/cardinality': ':db.cardinality/one' },
      'triple/predicate': { ':db/cardinality': ':db.cardinality/one' },
      'triple/object': { ':db/cardinality': ':db.cardinality/one' }
    };
    
    // Convert user schema for DataScript (remove colons and unnecessary valueTypes)
    const cleanedUserSchema = {};
    const validCardinalities = [':db.cardinality/one', ':db.cardinality/many'];
    const validUniques = [':db.unique/identity', ':db.unique/value'];
    
    for (const [attr, spec] of Object.entries(userSchema)) {
      const cleanSpec = { ...spec };
      
      // Remove leading colon from attribute name
      const cleanAttr = attr.startsWith(':') ? attr.substring(1) : attr;
      
      // Sanitize cardinality to valid values (DataScript will reject invalid ones)
      if (spec[':db/cardinality'] && !validCardinalities.includes(spec[':db/cardinality'])) {
        delete cleanSpec[':db/cardinality']; // Remove invalid cardinality
      }
      
      // Sanitize unique constraints to valid values
      if (spec[':db/unique'] && !validUniques.includes(spec[':db/unique'])) {
        delete cleanSpec[':db/unique']; // Remove invalid unique constraint
      }
      
      // Handle component attributes - they require :db.type/ref
      if (spec[':db/isComponent'] && !spec[':db/valueType']) {
        cleanSpec[':db/valueType'] = ':db.type/ref';
      }
      
      // Only keep valueType if it's ref or tuple
      if (spec[':db/valueType'] && 
          spec[':db/valueType'] !== ':db.type/ref' && 
          spec[':db/valueType'] !== ':db.type/tuple') {
        delete cleanSpec[':db/valueType'];
      }
      
      cleanedUserSchema[cleanAttr] = cleanSpec;
    }
    
    return {
      userFacingSchema: { ...defaultSchemaUser, ...userSchema }, // Keep original for user
      datascriptSchema: { ...defaultSchemaDS, ...cleanedUserSchema } // Clean for DataScript
    };
  }

  /**
   * Clean schema to avoid prototype pollution
   * @private
   */
  _cleanSchema(schema) {
    // Deep clone schema to avoid prototype pollution
    const cleanSchema = {};
    
    for (const [key, value] of Object.entries(schema)) {
      // Only copy own properties that are not functions
      if (typeof value !== 'function') {
        cleanSchema[key] = JSON.parse(JSON.stringify(value));
      }
    }
    
    return cleanSchema;
  }

  /**
   * Validate schema structure
   * @private
   */
  _validateSchema(schema) {
    const validCardinalities = [':db.cardinality/one', ':db.cardinality/many'];
    const validUniques = [':db.unique/identity', ':db.unique/value'];
    const validTypes = [
      ':db.type/string', ':db.type/boolean', ':db.type/long',
      ':db.type/bigint', ':db.type/float', ':db.type/double',
      ':db.type/instant', ':db.type/uuid', ':db.type/uri',
      ':db.type/keyword', ':db.type/ref'
    ];
    
    for (const [attr, spec] of Object.entries(schema)) {
      // Validate attribute name format (should have namespace)
      if (!attr.includes(':') || attr.indexOf(':') === 0 && !attr.includes('/', 1)) {
        throw new ValidationError(`Invalid attribute name: ${attr}. Must be in format :namespace/name`);
      }
      
      // Validate cardinality if specified
      if (spec[':db/cardinality'] && !validCardinalities.includes(spec[':db/cardinality'])) {
        throw new ValidationError(`Invalid cardinality for ${attr}: ${spec[':db/cardinality']}`);
      }
      
      // Validate unique constraint if specified
      if (spec[':db/unique'] && !validUniques.includes(spec[':db/unique'])) {
        throw new ValidationError(`Invalid unique constraint for ${attr}: ${spec[':db/unique']}`);
      }
      
      // Validate value type if specified
      if (spec[':db/valueType'] && !validTypes.includes(spec[':db/valueType'])) {
        throw new ValidationError(`Invalid value type for ${attr}: ${spec[':db/valueType']}`);
      }
    }
  }

  /**
   * Check if a triple exists
   * @private
   */
  async _tripleExists(subject, predicate, object) {
    const tripleKey = this._tripleKey(subject, predicate, object);
    const currentDb = db(this.conn);
    
    try {
      // Use EDN string format for DataScript query (plain attributes without colons)
      const results = q(
        `[:find ?e :where [?e "triple/id" "${tripleKey}"]]`,
        currentDb
      );
      
      return results.length > 0;
    } catch (error) {
      // If the query fails (e.g., no data yet), return false
      return false;
    }
  }

  /**
   * Get or create entity ID for a triple
   * @private
   */
  _getOrCreateEntityId(subject, predicate, object) {
    const tripleKey = this._tripleKey(subject, predicate, object);
    
    if (this.tripleToEntity.has(tripleKey)) {
      return this.tripleToEntity.get(tripleKey);
    }
    
    const entityId = -this.nextEntityId++;
    this.tripleToEntity.set(tripleKey, entityId);
    return entityId;
  }

  /**
   * Generate unique key for a triple
   * @private
   */
  _tripleKey(subject, predicate, object) {
    return `${subject}|${predicate}|${object}`;
  }

  /**
   * Serialize object value for storage
   * @private
   */
  _serializeObject(object) {
    if (object === null) return '__null__';
    if (object === undefined) return '__undefined__';
    if (typeof object === 'boolean') {
      return `__bool__${object}`;
    }
    if (typeof object === 'number') {
      return `__num__${object}`;
    }
    // String stays as is
    return object;
  }

  /**
   * Deserialize object value from storage
   * @private
   */
  _deserializeObject(value) {
    // Ensure we have a string
    if (typeof value !== 'string') return value;
    
    // Check for type-prefixed values
    if (value === '__null__') return null;
    if (value === '__undefined__') return undefined;
    
    if (value.startsWith('__bool__')) {
      return value === '__bool__true';
    }
    
    if (value.startsWith('__num__')) {
      const numStr = value.substring(7); // Remove '__num__' prefix
      return Number(numStr);
    }
    
    // Plain string
    return value;
  }
}