import { ITripleStore } from './ITripleStore.js';
import { StorageError, ConnectionError, TransactionError, ValidationError } from './StorageError.js';

/**
 * SQL-based triple store implementation
 * Supports PostgreSQL, SQLite, and other SQL databases
 */
export class SQLTripleStore extends ITripleStore {
  constructor(connectionString, options = {}) {
    super();
    
    this.connectionString = connectionString;
    this.tableName = options.tableName || 'triples';
    this.poolSize = options.poolSize || 10;
    this.enableTransactions = options.enableTransactions !== false;
    this.autoCreateTable = options.autoCreateTable !== false;
    this.indexStrategy = options.indexStrategy || 'balanced';
    
    // Database type detection
    this.dbType = this._detectDatabaseType(connectionString);
    
    // Connection pool
    this.pool = null;
    this.connected = false;
    
    // Transaction support
    this.currentTransaction = null;
    
    this._validateConfig();
  }

  getMetadata() {
    return {
      type: 'sql',
      supportsTransactions: this.enableTransactions,
      supportsPersistence: true,
      supportsAsync: true,
      maxTriples: Infinity,
      dbType: this.dbType,
      tableName: this.tableName,
      poolSize: this.poolSize,
      connected: this.connected,
      indexStrategy: this.indexStrategy
    };
  }

  /**
   * Connect to the database and initialize
   */
  async connect() {
    if (this.connected) return;
    
    try {
      // Create connection pool based on database type
      await this._createConnectionPool();
      
      // Create table if needed
      if (this.autoCreateTable) {
        await this._createTable();
        await this._createIndexes();
      }
      
      this.connected = true;
    } catch (error) {
      throw new ConnectionError(`Failed to connect to SQL database: ${error.message}`, error);
    }
  }

  /**
   * Disconnect from the database
   */
  async disconnect() {
    if (!this.connected) return;
    
    try {
      if (this.currentTransaction) {
        await this.currentTransaction.rollback();
        this.currentTransaction = null;
      }
      
      if (this.pool) {
        await this._closeConnectionPool();
        this.pool = null;
      }
      
      this.connected = false;
    } catch (error) {
      throw new ConnectionError(`Failed to disconnect from SQL database: ${error.message}`, error);
    }
  }

  /**
   * Add a triple to the store
   */
  async addTriple(subject, predicate, object) {
    await this._ensureConnected();
    
    const query = this._getInsertQuery();
    const params = [subject, predicate, JSON.stringify(object)];
    
    try {
      const result = await this._executeQuery(query, params);
      return result.rowCount > 0;
    } catch (error) {
      if (this._isDuplicateError(error)) {
        return false; // Triple already exists
      }
      throw new StorageError(`Failed to add triple: ${error.message}`, 'ADD_ERROR', error);
    }
  }

  /**
   * Remove a triple from the store
   */
  async removeTriple(subject, predicate, object) {
    await this._ensureConnected();
    
    const query = this._getDeleteQuery();
    const params = [subject, predicate, JSON.stringify(object)];
    
    try {
      const result = await this._executeQuery(query, params);
      return result.rowCount > 0;
    } catch (error) {
      throw new StorageError(`Failed to remove triple: ${error.message}`, 'REMOVE_ERROR', error);
    }
  }

  /**
   * Query triples with pattern matching
   */
  async query(subject, predicate, object) {
    await this._ensureConnected();
    
    const { query, params } = this._buildSelectQuery(subject, predicate, object);
    
    try {
      const result = await this._executeQuery(query, params);
      return result.rows.map(row => [
        row.subject,
        row.predicate,
        JSON.parse(row.object)
      ]);
    } catch (error) {
      throw new StorageError(`Failed to query triples: ${error.message}`, 'QUERY_ERROR', error);
    }
  }

  /**
   * Get the total number of triples
   */
  async size() {
    await this._ensureConnected();
    
    const query = `SELECT COUNT(*) as count FROM ${this.tableName}`;
    
    try {
      const result = await this._executeQuery(query);
      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      throw new StorageError(`Failed to get size: ${error.message}`, 'SIZE_ERROR', error);
    }
  }

  /**
   * Clear all triples
   */
  async clear() {
    await this._ensureConnected();
    
    const query = `DELETE FROM ${this.tableName}`;
    
    try {
      await this._executeQuery(query);
    } catch (error) {
      throw new StorageError(`Failed to clear triples: ${error.message}`, 'CLEAR_ERROR', error);
    }
  }

  /**
   * Check if a triple exists
   */
  async exists(subject, predicate, object) {
    const results = await this.query(subject, predicate, object);
    return results.length > 0;
  }

  /**
   * Add multiple triples in a batch
   */
  async addTriples(triples) {
    await this._ensureConnected();
    
    if (triples.length === 0) return 0;
    
    const query = this._getBatchInsertQuery(triples.length);
    const params = [];
    
    for (const [s, p, o] of triples) {
      params.push(s, p, JSON.stringify(o));
    }
    
    try {
      const result = await this._executeQuery(query, params);
      return result.rowCount || 0;
    } catch (error) {
      throw new StorageError(`Failed to add triples batch: ${error.message}`, 'BATCH_ADD_ERROR', error);
    }
  }

  /**
   * Remove multiple triples in a batch
   */
  async removeTriples(triples) {
    await this._ensureConnected();
    
    if (triples.length === 0) return 0;
    
    let removedCount = 0;
    
    // Use transaction for batch removal
    const transaction = await this.beginTransaction();
    try {
      for (const [s, p, o] of triples) {
        const removed = await this.removeTriple(s, p, o);
        if (removed) removedCount++;
      }
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
    
    return removedCount;
  }

  /**
   * Begin a database transaction
   */
  async beginTransaction() {
    if (!this.enableTransactions) {
      throw new TransactionError('Transactions are not enabled for this store');
    }
    
    await this._ensureConnected();
    
    if (this.currentTransaction) {
      throw new TransactionError('Transaction already in progress');
    }
    
    try {
      const client = await this._getTransactionClient();
      await client.query('BEGIN');
      
      this.currentTransaction = {
        client,
        async commit() {
          await client.query('COMMIT');
          await client.release();
        },
        async rollback() {
          await client.query('ROLLBACK');
          await client.release();
        }
      };
      
      return this.currentTransaction;
    } catch (error) {
      throw new TransactionError(`Failed to begin transaction: ${error.message}`, error);
    }
  }

  /**
   * Get database statistics
   */
  async getStats() {
    await this._ensureConnected();
    
    const queries = {
      totalTriples: `SELECT COUNT(*) as count FROM ${this.tableName}`,
      uniqueSubjects: `SELECT COUNT(DISTINCT subject) as count FROM ${this.tableName}`,
      uniquePredicates: `SELECT COUNT(DISTINCT predicate) as count FROM ${this.tableName}`,
      tableSize: this._getTableSizeQuery()
    };
    
    const stats = {};
    
    for (const [key, query] of Object.entries(queries)) {
      try {
        const result = await this._executeQuery(query);
        stats[key] = parseInt(result.rows[0].count, 10);
      } catch (error) {
        stats[key] = null;
      }
    }
    
    return stats;
  }

  /**
   * Optimize database performance
   */
  async optimize() {
    await this._ensureConnected();
    
    try {
      // Analyze table statistics
      await this._executeQuery(`ANALYZE ${this.tableName}`);
      
      // Vacuum if supported
      if (this.dbType === 'postgresql') {
        await this._executeQuery(`VACUUM ANALYZE ${this.tableName}`);
      }
      
      return true;
    } catch (error) {
      throw new StorageError(`Failed to optimize database: ${error.message}`, 'OPTIMIZE_ERROR', error);
    }
  }

  /**
   * Close the store and cleanup resources
   */
  async close() {
    await this.disconnect();
  }

  // Private methods

  /**
   * Ensure database connection is established
   */
  async _ensureConnected() {
    if (!this.connected) {
      await this.connect();
    }
  }

  /**
   * Validate configuration
   */
  _validateConfig() {
    if (!this.connectionString) {
      throw new ValidationError('Connection string is required');
    }
    
    if (this.poolSize < 1 || this.poolSize > 100) {
      throw new ValidationError('Pool size must be between 1 and 100');
    }
    
    const validIndexStrategies = ['minimal', 'balanced', 'aggressive'];
    if (!validIndexStrategies.includes(this.indexStrategy)) {
      throw new ValidationError(`Index strategy must be one of: ${validIndexStrategies.join(', ')}`);
    }
  }

  /**
   * Detect database type from connection string
   */
  _detectDatabaseType(connectionString) {
    if (connectionString.startsWith('postgresql://') || connectionString.startsWith('postgres://')) {
      return 'postgresql';
    } else if (connectionString.startsWith('sqlite:') || connectionString.includes('.db') || connectionString === ':memory:') {
      return 'sqlite';
    } else if (connectionString.startsWith('mysql://')) {
      return 'mysql';
    } else {
      return 'unknown';
    }
  }

  /**
   * Create connection pool based on database type
   */
  async _createConnectionPool() {
    switch (this.dbType) {
      case 'postgresql':
        await this._createPostgreSQLPool();
        break;
      case 'sqlite':
        await this._createSQLitePool();
        break;
      case 'mysql':
        await this._createMySQLPool();
        break;
      default:
        throw new ConnectionError(`Unsupported database type: ${this.dbType}`);
    }
  }

  /**
   * Create PostgreSQL connection pool
   */
  async _createPostgreSQLPool() {
    // This would use pg library in real implementation
    this.pool = {
      query: async (text, params) => {
        // Mock implementation for now
        throw new Error('PostgreSQL support requires pg library');
      },
      connect: async () => {
        throw new Error('PostgreSQL support requires pg library');
      },
      end: async () => {
        // Mock cleanup
      }
    };
  }

  /**
   * Create SQLite connection pool
   */
  async _createSQLitePool() {
    // This would use sqlite3 library in real implementation
    this.pool = {
      query: async (text, params) => {
        // Mock implementation for now
        throw new Error('SQLite support requires sqlite3 library');
      },
      end: async () => {
        // Mock cleanup
      }
    };
  }

  /**
   * Create MySQL connection pool
   */
  async _createMySQLPool() {
    // This would use mysql2 library in real implementation
    this.pool = {
      query: async (text, params) => {
        // Mock implementation for now
        throw new Error('MySQL support requires mysql2 library');
      },
      end: async () => {
        // Mock cleanup
      }
    };
  }

  /**
   * Close connection pool
   */
  async _closeConnectionPool() {
    if (this.pool && this.pool.end) {
      await this.pool.end();
    }
  }

  /**
   * Execute a query with optional parameters
   */
  async _executeQuery(query, params = []) {
    if (this.currentTransaction) {
      return await this.currentTransaction.client.query(query, params);
    } else {
      return await this.pool.query(query, params);
    }
  }

  /**
   * Get a client for transaction use
   */
  async _getTransactionClient() {
    return await this.pool.connect();
  }

  /**
   * Create the triples table
   */
  async _createTable() {
    const query = this._getCreateTableQuery();
    await this._executeQuery(query);
  }

  /**
   * Create database indexes
   */
  async _createIndexes() {
    const indexes = this._getIndexQueries();
    for (const query of indexes) {
      try {
        await this._executeQuery(query);
      } catch (error) {
        // Ignore if index already exists
        if (!this._isIndexExistsError(error)) {
          throw error;
        }
      }
    }
  }

  /**
   * Get CREATE TABLE query for the database type
   */
  _getCreateTableQuery() {
    switch (this.dbType) {
      case 'postgresql':
        return `
          CREATE TABLE IF NOT EXISTS ${this.tableName} (
            id SERIAL PRIMARY KEY,
            subject VARCHAR(255) NOT NULL,
            predicate VARCHAR(255) NOT NULL,
            object TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(subject, predicate, object)
          )
        `;
      case 'sqlite':
        return `
          CREATE TABLE IF NOT EXISTS ${this.tableName} (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            subject TEXT NOT NULL,
            predicate TEXT NOT NULL,
            object TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(subject, predicate, object)
          )
        `;
      case 'mysql':
        return `
          CREATE TABLE IF NOT EXISTS ${this.tableName} (
            id INT AUTO_INCREMENT PRIMARY KEY,
            subject VARCHAR(255) NOT NULL,
            predicate VARCHAR(255) NOT NULL,
            object TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY unique_triple (subject, predicate, object(255))
          )
        `;
      default:
        throw new StorageError(`Unsupported database type for table creation: ${this.dbType}`);
    }
  }

  /**
   * Get index creation queries based on strategy
   */
  _getIndexQueries() {
    const indexes = [];
    
    // Always create basic indexes
    indexes.push(`CREATE INDEX IF NOT EXISTS idx_${this.tableName}_subject ON ${this.tableName} (subject)`);
    indexes.push(`CREATE INDEX IF NOT EXISTS idx_${this.tableName}_predicate ON ${this.tableName} (predicate)`);
    
    if (this.indexStrategy === 'balanced' || this.indexStrategy === 'aggressive') {
      indexes.push(`CREATE INDEX IF NOT EXISTS idx_${this.tableName}_subject_predicate ON ${this.tableName} (subject, predicate)`);
      indexes.push(`CREATE INDEX IF NOT EXISTS idx_${this.tableName}_predicate_object ON ${this.tableName} (predicate, object(255))`);
    }
    
    if (this.indexStrategy === 'aggressive') {
      indexes.push(`CREATE INDEX IF NOT EXISTS idx_${this.tableName}_subject_object ON ${this.tableName} (subject, object(255))`);
      indexes.push(`CREATE INDEX IF NOT EXISTS idx_${this.tableName}_full ON ${this.tableName} (subject, predicate, object(255))`);
    }
    
    return indexes;
  }

  /**
   * Get INSERT query
   */
  _getInsertQuery() {
    return `INSERT INTO ${this.tableName} (subject, predicate, object) VALUES ($1, $2, $3)`;
  }

  /**
   * Get DELETE query
   */
  _getDeleteQuery() {
    return `DELETE FROM ${this.tableName} WHERE subject = $1 AND predicate = $2 AND object = $3`;
  }

  /**
   * Get batch INSERT query
   */
  _getBatchInsertQuery(count) {
    const values = [];
    for (let i = 0; i < count; i++) {
      const offset = i * 3;
      values.push(`($${offset + 1}, $${offset + 2}, $${offset + 3})`);
    }
    return `INSERT INTO ${this.tableName} (subject, predicate, object) VALUES ${values.join(', ')} ON CONFLICT DO NOTHING`;
  }

  /**
   * Build SELECT query with pattern matching
   */
  _buildSelectQuery(subject, predicate, object) {
    let query = `SELECT subject, predicate, object FROM ${this.tableName}`;
    const conditions = [];
    const params = [];
    let paramIndex = 1;
    
    if (subject !== null && subject !== undefined) {
      conditions.push(`subject = $${paramIndex++}`);
      params.push(subject);
    }
    
    if (predicate !== null && predicate !== undefined) {
      conditions.push(`predicate = $${paramIndex++}`);
      params.push(predicate);
    }
    
    if (object !== null && object !== undefined) {
      conditions.push(`object = $${paramIndex++}`);
      params.push(JSON.stringify(object));
    }
    
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    return { query, params };
  }

  /**
   * Get table size query
   */
  _getTableSizeQuery() {
    switch (this.dbType) {
      case 'postgresql':
        return `SELECT pg_total_relation_size('${this.tableName}') as count`;
      case 'sqlite':
        return `SELECT COUNT(*) as count FROM ${this.tableName}`; // Fallback
      case 'mysql':
        return `SELECT data_length + index_length as count FROM information_schema.tables WHERE table_name = '${this.tableName}'`;
      default:
        return `SELECT COUNT(*) as count FROM ${this.tableName}`;
    }
  }

  /**
   * Check if error is a duplicate key error
   */
  _isDuplicateError(error) {
    const message = error.message.toLowerCase();
    return message.includes('duplicate') || 
           message.includes('unique constraint') ||
           message.includes('already exists');
  }

  /**
   * Check if error is an index exists error
   */
  _isIndexExistsError(error) {
    const message = error.message.toLowerCase();
    return message.includes('already exists') || 
           message.includes('duplicate key name');
  }
}
