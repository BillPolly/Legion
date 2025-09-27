/**
 * MongoServerHandle - Represents a MongoDB server connection
 * 
 * This handle provides server-level operations including:
 * - Server status and statistics
 * - Database listing and management
 * - Server-wide change streams
 * - Database projection (creating database handles)
 */

import { Handle } from '@legion/handle';
import { MongoDatabaseHandle } from './MongoDatabaseHandle.js';

export class MongoServerHandle extends Handle {
  constructor(dataSource, connectionString) {
    super(dataSource);
    this.connectionString = connectionString;
  }
  
  /**
   * Get server status and information
   * @returns {QueryResultHandle} Server status information
   */
  value() {
    return this.dataSource.query({
      level: 'server',
      operation: 'serverStatus'
    });
  }
  
  /**
   * List all databases on server
   * @returns {QueryResultHandle} List of databases
   */
  databases() {
    return this.dataSource.query({
      level: 'server',
      operation: 'listDatabases'
    });
  }
  
  /**
   * Get handle for specific database (projection)
   * @param {string} dbName - Database name
   * @returns {MongoDatabaseHandle} Database handle
   */
  database(dbName) {
    if (!dbName) {
      throw new Error('Database name is required');
    }
    return new MongoDatabaseHandle(this.dataSource, dbName);
  }
  
  /**
   * Server statistics (alias for value())
   * @returns {QueryResultHandle} Server statistics
   */
  stats() {
    return this.dataSource.query({
      level: 'server',
      operation: 'serverStatus'
    });
  }
  
  /**
   * Current operations on server
   * @param {Object} options - Query options
   * @returns {QueryResultHandle} Current operations
   */
  currentOps(options = {}) {
    return this.dataSource.query({
      level: 'server',
      operation: 'currentOp',
      options
    });
  }
  
  /**
   * Check server connectivity
   * @returns {QueryResultHandle} Ping result
   */
  ping() {
    return this.dataSource.query({
      level: 'server',
      operation: 'ping'
    });
  }
  
  /**
   * Get server build information
   * @returns {QueryResultHandle} Build information
   */
  buildInfo() {
    return this.dataSource.query({
      level: 'server',
      operation: 'buildInfo'
    });
  }
  
  /**
   * Host information
   * @returns {QueryResultHandle} Host information
   */
  hostInfo() {
    return this.dataSource.query({
      level: 'server',
      operation: 'hostInfo'
    });
  }
  
  /**
   * Watch for server-wide changes
   * @param {Array} pipeline - Aggregation pipeline for filtering changes (optional)
   * @param {Function} callback - Callback for change events (optional)
   * @returns {SubscriptionHandle} Subscription handle
   */
  watch(pipeline, callback) {
    // Handle overloaded parameters
    if (typeof pipeline === 'function') {
      callback = pipeline;
      pipeline = [];
    }
    
    if (!pipeline) {
      pipeline = [];
    }
    
    return this.dataSource.subscribe({
      level: 'server',
      pipeline,
      changeStream: true,
      callback
    });
  }
}