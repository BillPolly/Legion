/**
 * SQLiteProvider - SQLite3 implementation of the Provider interface
 * 
 * Provides storage operations using SQLite3 database with document-style
 * storage in a flexible schema using JSON columns.
 */

import { Provider } from '../../core/Provider.js';
import path from 'path';
import fs from 'fs/promises';

// Dynamic imports for optional sqlite dependencies
let sqlite3;
let sqliteOpen;

export class SQLiteProvider extends Provider {
  constructor(config) {
    super(config);
    this.db = null;
    this.filename = config.filename || ':memory:';
    this.verbose = config.verbose || false;
  }

  /**
   * Connect to SQLite database
   */
  async connect() {
    if (this.connected) return;

    // Load sqlite modules dynamically
    if (!sqlite3 || !sqliteOpen) {
      try {
        const sqlite3Module = await import('sqlite3');
        sqlite3 = sqlite3Module.default || sqlite3Module;
        const sqliteModule = await import('sqlite');
        sqliteOpen = sqliteModule.open;
      } catch (error) {
        throw new Error('SQLite modules not installed. Run: npm install sqlite3 sqlite');
      }
    }

    // Ensure directory exists if using file
    if (this.filename !== ':memory:') {
      const dir = path.dirname(this.filename);
      if (dir && dir !== '.') {
        await fs.mkdir(dir, { recursive: true });
      }
    }

    // Open database connection
    this.db = await sqliteOpen({
      filename: this.filename,
      driver: sqlite3.Database
    });

    // Enable foreign keys and JSON functions
    await this.db.exec('PRAGMA foreign_keys = ON');
    
    // Create collections metadata table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS _collections (
        name TEXT PRIMARY KEY,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        document_count INTEGER DEFAULT 0
      )
    `);

    this.connected = true;

    if (this.verbose) {
      console.log(`SQLite connected to ${this.filename}`);
    }
  }

  /**
   * Disconnect from SQLite database
   */
  async disconnect() {
    if (!this.connected) return;

    if (this.db) {
      await this.db.close();
      this.db = null;
    }
    
    this.connected = false;
  }

  /**
   * Ensure a collection (table) exists
   * @private
   */
  async _ensureCollection(collection) {
    // Check if table exists
    const table = await this.db.get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
      collection
    );

    if (!table) {
      // Create table with flexible schema using JSON
      await this.db.exec(`
        CREATE TABLE ${this._escapeIdentifier(collection)} (
          _id TEXT PRIMARY KEY,
          _data JSON NOT NULL,
          _created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          _updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create index on common query patterns
      await this.db.exec(`
        CREATE INDEX idx_${collection}_created 
        ON ${this._escapeIdentifier(collection)}(_created_at)
      `);

      // Register collection
      await this.db.run(
        'INSERT OR IGNORE INTO _collections (name) VALUES (?)',
        collection
      );
    }
  }

  /**
   * Escape SQL identifier
   * @private
   */
  _escapeIdentifier(name) {
    return `"${name.replace(/"/g, '""')}"`;
  }

  /**
   * Convert MongoDB-style query to SQL WHERE clause
   * @private
   */
  _buildWhereClause(query) {
    const conditions = [];
    const params = [];

    for (const [field, value] of Object.entries(query)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Handle operators
        for (const [op, opValue] of Object.entries(value)) {
          switch (op) {
            case '$gt':
              conditions.push(`json_extract(_data, '$.${field}') > ?`);
              params.push(opValue);
              break;
            case '$gte':
              conditions.push(`json_extract(_data, '$.${field}') >= ?`);
              params.push(opValue);
              break;
            case '$lt':
              conditions.push(`json_extract(_data, '$.${field}') < ?`);
              params.push(opValue);
              break;
            case '$lte':
              conditions.push(`json_extract(_data, '$.${field}') <= ?`);
              params.push(opValue);
              break;
            case '$ne':
              conditions.push(`json_extract(_data, '$.${field}') != ?`);
              params.push(opValue);
              break;
            case '$in':
              const placeholders = opValue.map(() => '?').join(',');
              conditions.push(`json_extract(_data, '$.${field}') IN (${placeholders})`);
              params.push(...opValue);
              break;
            case '$regex':
              conditions.push(`json_extract(_data, '$.${field}') LIKE ?`);
              params.push(`%${opValue}%`);
              break;
            case '$exists':
              if (opValue) {
                conditions.push(`json_extract(_data, '$.${field}') IS NOT NULL`);
              } else {
                conditions.push(`json_extract(_data, '$.${field}') IS NULL`);
              }
              break;
          }
        }
      } else {
        // Simple equality
        if (field === '_id') {
          conditions.push('_id = ?');
          params.push(value);
        } else {
          conditions.push(`json_extract(_data, '$.${field}') = ?`);
          params.push(typeof value === 'object' ? JSON.stringify(value) : value);
        }
      }
    }

    return {
      where: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
      params
    };
  }

  /**
   * Build ORDER BY clause from options
   * @private
   */
  _buildOrderBy(sort) {
    if (!sort || Object.keys(sort).length === 0) return '';

    const orderParts = [];
    for (const [field, direction] of Object.entries(sort)) {
      const order = direction === 1 ? 'ASC' : 'DESC';
      if (field === '_id') {
        orderParts.push(`_id ${order}`);
      } else {
        orderParts.push(`json_extract(_data, '$.${field}') ${order}`);
      }
    }

    return `ORDER BY ${orderParts.join(', ')}`;
  }

  /**
   * Find documents
   */
  async find(collection, query = {}, options = {}) {
    if (!this.connected) {
      throw new Error('SQLiteProvider: Not connected to database');
    }

    await this._ensureCollection(collection);

    const { where, params } = this._buildWhereClause(query);
    const orderBy = this._buildOrderBy(options.sort);
    const limit = options.limit ? `LIMIT ${options.limit}` : '';
    const offset = options.skip ? `OFFSET ${options.skip}` : '';

    const sql = `
      SELECT _id, _data 
      FROM ${this._escapeIdentifier(collection)}
      ${where}
      ${orderBy}
      ${limit}
      ${offset}
    `;

    const rows = await this.db.all(sql, params);

    // Parse JSON data and merge with _id
    return rows.map(row => ({
      _id: row._id,
      ...JSON.parse(row._data)
    }));
  }

  /**
   * Find one document
   */
  async findOne(collection, query = {}, options = {}) {
    const results = await this.find(collection, query, { ...options, limit: 1 });
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Insert documents
   */
  async insert(collection, documents, options = {}) {
    if (!this.connected) {
      throw new Error('SQLiteProvider: Not connected to database');
    }

    await this._ensureCollection(collection);

    const isArray = Array.isArray(documents);
    const docs = isArray ? documents : [documents];
    const insertedIds = {};
    let insertedCount = 0;

    // Begin transaction for multiple inserts
    await this.db.exec('BEGIN TRANSACTION');

    try {
      for (let i = 0; i < docs.length; i++) {
        const doc = { ...docs[i] };
        const docId = doc._id || `${collection}_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 9)}`;
        delete doc._id; // Remove _id from data as it's stored separately

        await this.db.run(
          `INSERT INTO ${this._escapeIdentifier(collection)} (_id, _data) VALUES (?, ?)`,
          docId,
          JSON.stringify(doc)
        );

        insertedIds[i] = docId;
        insertedCount++;
      }

      // Update collection document count
      await this.db.run(
        `UPDATE _collections 
         SET document_count = document_count + ? 
         WHERE name = ?`,
        insertedCount,
        collection
      );

      await this.db.exec('COMMIT');
    } catch (error) {
      await this.db.exec('ROLLBACK');
      throw error;
    }

    return {
      acknowledged: true,
      insertedCount,
      insertedIds
    };
  }

  /**
   * Update documents
   */
  async update(collection, query, update, options = {}) {
    if (!this.connected) {
      throw new Error('SQLiteProvider: Not connected to database');
    }

    await this._ensureCollection(collection);

    // First find matching documents
    const matches = await this.find(collection, query);
    if (matches.length === 0) {
      return {
        acknowledged: true,
        modifiedCount: 0,
        matchedCount: 0
      };
    }

    const toUpdate = options.multi ? matches : [matches[0]];
    let modifiedCount = 0;

    await this.db.exec('BEGIN TRANSACTION');

    try {
      for (const doc of toUpdate) {
        let newDoc = { ...doc };
        delete newDoc._id; // Remove _id from data

        // Handle update operators
        if (update.$set) {
          Object.assign(newDoc, update.$set);
        } else if (update.$inc) {
          for (const [field, value] of Object.entries(update.$inc)) {
            newDoc[field] = (newDoc[field] || 0) + value;
          }
        } else if (update.$unset) {
          for (const field of Object.keys(update.$unset)) {
            delete newDoc[field];
          }
        } else {
          // Direct replacement
          newDoc = update;
        }

        await this.db.run(
          `UPDATE ${this._escapeIdentifier(collection)} 
           SET _data = ?, _updated_at = CURRENT_TIMESTAMP 
           WHERE _id = ?`,
          JSON.stringify(newDoc),
          doc._id
        );

        modifiedCount++;
      }

      await this.db.exec('COMMIT');
    } catch (error) {
      await this.db.exec('ROLLBACK');
      throw error;
    }

    return {
      acknowledged: true,
      modifiedCount,
      matchedCount: matches.length
    };
  }

  /**
   * Delete documents
   */
  async delete(collection, query, options = {}) {
    if (!this.connected) {
      throw new Error('SQLiteProvider: Not connected to database');
    }

    await this._ensureCollection(collection);

    const { where, params } = this._buildWhereClause(query);

    const result = await this.db.run(
      `DELETE FROM ${this._escapeIdentifier(collection)} ${where}`,
      params
    );

    // Update collection document count
    if (result.changes > 0) {
      await this.db.run(
        `UPDATE _collections 
         SET document_count = document_count - ? 
         WHERE name = ?`,
        result.changes,
        collection
      );
    }

    return {
      acknowledged: true,
      deletedCount: result.changes || 0
    };
  }

  /**
   * Count documents
   */
  async count(collection, query = {}, options = {}) {
    if (!this.connected) {
      throw new Error('SQLiteProvider: Not connected to database');
    }

    await this._ensureCollection(collection);

    const { where, params } = this._buildWhereClause(query);

    const result = await this.db.get(
      `SELECT COUNT(*) as count 
       FROM ${this._escapeIdentifier(collection)} 
       ${where}`,
      params
    );

    return result.count;
  }

  /**
   * List all collections
   */
  async listCollections() {
    if (!this.connected) {
      throw new Error('SQLiteProvider: Not connected to database');
    }

    const collections = await this.db.all(
      'SELECT name FROM _collections ORDER BY name'
    );

    return collections.map(c => c.name);
  }

  /**
   * Drop a collection
   */
  async dropCollection(collection) {
    if (!this.connected) {
      throw new Error('SQLiteProvider: Not connected to database');
    }

    try {
      await this.db.exec(`DROP TABLE IF EXISTS ${this._escapeIdentifier(collection)}`);
      await this.db.run('DELETE FROM _collections WHERE name = ?', collection);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * SQLite-specific: Create index
   */
  async createIndex(collection, spec, options = {}) {
    if (!this.connected) {
      throw new Error('SQLiteProvider: Not connected to database');
    }

    await this._ensureCollection(collection);

    const indexName = options.name || `idx_${collection}_${Object.keys(spec).join('_')}`;
    const fields = [];

    for (const [field, direction] of Object.entries(spec)) {
      const order = direction === 1 ? 'ASC' : 'DESC';
      if (field === '_id') {
        fields.push(`_id ${order}`);
      } else {
        fields.push(`json_extract(_data, '$.${field}') ${order}`);
      }
    }

    const unique = options.unique ? 'UNIQUE' : '';

    await this.db.exec(`
      CREATE ${unique} INDEX IF NOT EXISTS ${indexName}
      ON ${this._escapeIdentifier(collection)} (${fields.join(', ')})
    `);

    return indexName;
  }

  /**
   * SQLite-specific: Execute raw SQL
   */
  async executeSql(sql, params = []) {
    if (!this.connected) {
      throw new Error('SQLiteProvider: Not connected to database');
    }

    return await this.db.all(sql, params);
  }

  /**
   * SQLite-specific: Vacuum database
   */
  async vacuum() {
    if (!this.connected) {
      throw new Error('SQLiteProvider: Not connected to database');
    }

    await this.db.exec('VACUUM');
  }

  /**
   * Get provider capabilities
   */
  getCapabilities() {
    return [
      ...super.getCapabilities(),
      'createIndex',
      'transactions',
      'json-queries',
      'sql-execution',
      'vacuum'
    ];
  }

  /**
   * Get provider metadata
   */
  getMetadata() {
    return {
      ...super.getMetadata(),
      filename: this.filename,
      inMemory: this.filename === ':memory:'
    };
  }
}