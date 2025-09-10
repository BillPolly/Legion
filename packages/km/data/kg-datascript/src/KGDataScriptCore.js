import { createConn } from '../../datascript/src/core/conn.js';
import { q } from '../../datascript/src/query/query.js';
import { qEdn } from '../../datascript/src/query/query_edn.js';
import { pull } from '../../datascript/src/query/pull.js';

/**
 * KGDataScriptCore - Base class that wraps DataScript functionality
 * Provides the foundation for the unified KG-DataScript system
 */
export class KGDataScriptCore {
  constructor(schema = {}) {
    this.schema = schema;
    
    // Create DataScript connection
    this.conn = createConn(schema);
    
    // Bind DataScript methods to this instance
    this.transact = this.transact.bind(this);
    this.q = this.q.bind(this);
    this.pull = this.pull.bind(this);
    this.entity = this.entity.bind(this);
    this.db = this.db.bind(this);
    this.history = this.history.bind(this);
    this.asOf = this.asOf.bind(this);
  }

  /**
   * Execute a transaction
   * @param {Array|Function} tx - Transaction data or function
   * @returns {Object} Transaction result with txData and tempids
   */
  transact(tx) {
    const txData = typeof tx === 'function' ? tx(this.db()) : tx;
    const dbBefore = this.conn.db();
    const result = this.conn.transact(txData);
    
    // DataScript returns { dbAfter, tempids, tx }
    // DataScript's transact method already updates the connection's _db
    // Build txData from the transaction
    const actualTxData = [];
    if (result.dbAfter && dbBefore) {
      // Get the datoms that were added in this transaction
      const txId = result.tx;
      // For now, just return a simple structure
      actualTxData.push({ tx: txId });
    }
    
    return {
      txData: actualTxData,
      tempids: result.tempids,
      dbBefore: dbBefore,
      dbAfter: result.dbAfter,
      txMeta: {}
    };
  }

  /**
   * Query the database
   * @param {Object|String} query - Datalog query (object or EDN string)
   * @param {Array} inputs - Additional inputs for the query
   * @returns {Array} Query results
   */
  q(query, ...inputs) {
    const db = this.db();
    // If query is a string, use EDN parser
    if (typeof query === 'string') {
      return qEdn(query, db, ...inputs);
    }
    // Otherwise use object query
    return q(query, db, ...inputs);
  }

  /**
   * Pull entity data
   * @param {Array|String} pattern - Pull pattern
   * @param {Number|Array} entityId - Entity ID or lookup ref
   * @returns {Object} Pulled entity data
   */
  pull(pattern, entityId) {
    const db = this.db();
    return pull(db, pattern, entityId);
  }

  /**
   * Get entity by ID
   * @param {Number|Array} entityId - Entity ID or lookup ref
   * @returns {Object} Entity object
   */
  entity(entityId) {
    const db = this.db();
    return db.entity(entityId);
  }

  /**
   * Get current database value
   * @returns {Object} Current database
   */
  db() {
    return this.conn.db();
  }

  /**
   * Get database history
   * @returns {Object} History database
   */
  history() {
    // DataScript history is accessed through db methods
    const db = this.db();
    return db.history || db;
  }

  /**
   * Get database as of a specific transaction
   * @param {Number} tx - Transaction ID
   * @returns {Object} Database as of transaction
   */
  asOf(tx) {
    const db = this.db();
    return db.asOf ? db.asOf(tx) : db;
  }

  /**
   * Get database since a specific transaction
   * @param {Number} tx - Transaction ID
   * @returns {Object} Database since transaction
   */
  since(tx) {
    const db = this.db();
    return db.since ? db.since(tx) : db;
  }

  /**
   * Add listener for transaction reports
   * @param {String|Symbol} key - Listener key
   * @param {Function} callback - Callback function
   * @returns {String|Symbol} Listener key for unlisten
   */
  listen(key, callback) {
    if (typeof key === 'function') {
      // If only callback provided, generate key
      callback = key;
      key = Symbol('listener');
    }
    this.conn.listen(key, callback);
    return key;
  }

  /**
   * Remove listener
   * @param {String|Symbol} key - Listener key
   */
  unlisten(key) {
    this.conn.unlisten(key);
  }

  /**
   * Get schema
   * @returns {Object} Database schema
   */
  getSchema() {
    return this.schema;
  }
}