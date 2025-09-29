/**
 * Neo4jDataSourceAsync - Async version of DataSource for Neo4j
 * 
 * We'll get this working first, then convert to sync if needed
 */

import { GraphDatabaseHandle } from '../handles/GraphDatabaseHandle.js';
import { NodeHandle } from '../handles/NodeHandle.js';

export class Neo4jDataSourceAsync {
  constructor(resourceManager) {
    if (!resourceManager) {
      throw new Error('ResourceManager is required');
    }
    
    this.resourceManager = resourceManager;
    this.neo4jHandle = null;
    this.initialized = false;
  }

  /**
   * Initialize the DataSource with Neo4j connection
   */
  async initialize() {
    if (this.initialized) {
      return;
    }
    
    console.log('[Neo4jDataSourceAsync] Initializing...');
    this.neo4jHandle = await this.resourceManager.getNeo4jServer();
    this.initialized = true;
    console.log('[Neo4jDataSourceAsync] Initialized successfully');
  }

  /**
   * Execute a query asynchronously
   */
  async query(querySpec) {
    if (!this.initialized) {
      throw new Error('DataSource not initialized. Call initialize() first.');
    }
    
    console.log('[Neo4jDataSourceAsync] Query type:', querySpec.type);
    
    switch (querySpec.type) {
      case 'cypher':
        return await this._executeCypherQuery(querySpec);
      default:
        throw new Error(`Unsupported query type: ${querySpec.type}`);
    }
  }

  /**
   * Execute Cypher query asynchronously
   */
  async _executeCypherQuery(querySpec) {
    console.log('[Neo4jDataSourceAsync] Executing:', querySpec.query.substring(0, 50) + '...');
    
    try {
      const result = await this.neo4jHandle.run(querySpec.query, querySpec.params || {});
      
      // Transform Neo4j result to simpler format
      const transformedResult = {
        records: result.records.map(record => {
          const obj = {};
          record.keys.forEach(key => {
            const value = record.get(key);
            obj[key] = this._convertNeo4jValue(value);
          });
          return obj;
        }),
        summary: result.summary
      };
      
      console.log('[Neo4jDataSourceAsync] Query returned', transformedResult.records.length, 'records');
      return transformedResult;
    } catch (error) {
      console.error('[Neo4jDataSourceAsync] Query error:', error.message);
      throw error;
    }
  }

  /**
   * Convert Neo4j values to plain JavaScript
   */
  _convertNeo4jValue(value) {
    if (!value) return value;
    
    // Handle Neo4j Integer
    if (value.toNumber) {
      return value.toNumber();
    }
    
    // Handle Neo4j Node
    if (value.labels && value.properties) {
      return {
        identity: value.identity?.toString(),
        labels: value.labels,
        properties: value.properties
      };
    }
    
    // Handle Neo4j Relationship
    if (value.type && value.start && value.end) {
      return {
        identity: value.identity?.toString(),
        type: value.type,
        start: value.start?.toString(),
        end: value.end?.toString(),
        properties: value.properties
      };
    }
    
    // Handle arrays
    if (Array.isArray(value)) {
      return value.map(v => this._convertNeo4jValue(v));
    }
    
    return value;
  }
}