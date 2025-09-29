/**
 * Neo4jDataSourceSync - Synchronous wrapper for Neo4j operations
 * 
 * Uses child_process.spawnSync to execute async operations synchronously
 * This is required for Actor pattern compatibility
 */

import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class Neo4jDataSourceSync {
  constructor(resourceManager) {
    if (!resourceManager) {
      throw new Error('ResourceManager is required');
    }
    
    this.resourceManager = resourceManager;
    this.initialized = false;
    this.subscriptions = new Map();
    this.subscriptionCounter = 0;
  }

  /**
   * Initialize the DataSource
   * This must still be called asynchronously once at setup
   */
  async initialize() {
    if (this.initialized) {
      return;
    }
    
    // Verify connection
    const neo4jHandle = await this.resourceManager.getNeo4jServer();
    const result = await neo4jHandle.run('RETURN 1 as test');
    if (result.records[0].get('test').toNumber() !== 1) {
      throw new Error('Neo4j connection test failed');
    }
    
    this.initialized = true;
    console.log('[Neo4jDataSourceSync] Initialized');
  }

  /**
   * Execute a query synchronously
   * Uses a worker script executed via spawnSync
   */
  query(querySpec) {
    if (!this.initialized) {
      throw new Error('DataSource not initialized. Call initialize() first.');
    }
    
    // Create worker script that will be executed
    const workerScript = `
      import { ResourceManager } from '${join(__dirname, '../../index.js')}';
      
      async function executeQuery() {
        const rm = await ResourceManager.getInstance();
        const neo4j = await rm.getNeo4jServer();
        
        const querySpec = JSON.parse(process.argv[2]);
        
        try {
          const result = await neo4j.run(querySpec.query, querySpec.params || {});
          
          // Convert to serializable format
          const output = {
            records: result.records.map(record => {
              const obj = {};
              record.keys.forEach(key => {
                const value = record.get(key);
                obj[key] = convertValue(value);
              });
              return obj;
            })
          };
          
          console.log(JSON.stringify({ success: true, data: output }));
        } catch (error) {
          console.log(JSON.stringify({ success: false, error: error.message }));
        }
      }
      
      function convertValue(value) {
        if (!value) return value;
        if (value.toNumber) return value.toNumber();
        if (value.labels && value.properties) {
          return {
            identity: value.identity?.toString(),
            labels: value.labels,
            properties: value.properties
          };
        }
        if (value.type && value.start && value.end) {
          return {
            identity: value.identity?.toString(),
            type: value.type,
            start: value.start?.toString(),
            end: value.end?.toString(),
            properties: value.properties
          };
        }
        if (Array.isArray(value)) {
          return value.map(v => convertValue(v));
        }
        return value;
      }
      
      executeQuery().catch(e => {
        console.log(JSON.stringify({ success: false, error: e.message }));
      });
    `;
    
    // Write worker script to temp file
    const tempFile = join(__dirname, `../../__tests__/tmp/neo4j-query-${Date.now()}.mjs`);
    fs.mkdirSync(dirname(tempFile), { recursive: true });
    fs.writeFileSync(tempFile, workerScript);
    
    try {
      // Execute synchronously
      const result = spawnSync('node', [
        '--experimental-vm-modules',
        tempFile,
        JSON.stringify(querySpec)
      ], {
        encoding: 'utf8',
        timeout: 30000
      });
      
      if (result.error) {
        throw result.error;
      }
      
      const output = JSON.parse(result.stdout);
      
      if (!output.success) {
        throw new Error(output.error);
      }
      
      return output.data;
    } finally {
      // Clean up temp file
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }
  }

  /**
   * Get schema information synchronously
   */
  getSchema() {
    const schemaQueries = {
      labels: 'CALL db.labels() YIELD label RETURN collect(label) as labels',
      relationships: 'CALL db.relationshipTypes() YIELD relationshipType RETURN collect(relationshipType) as types'
    };
    
    const schema = {
      labels: [],
      relationships: [],
      properties: {}
    };
    
    // Get labels
    const labelResult = this.query({ 
      type: 'cypher', 
      query: schemaQueries.labels 
    });
    schema.labels = labelResult.records[0].labels;
    
    // Get relationship types
    const relResult = this.query({ 
      type: 'cypher', 
      query: schemaQueries.relationships 
    });
    schema.relationships = relResult.records[0].types;
    
    return schema;
  }

  /**
   * Subscribe to changes (synchronous registration, async callbacks)
   */
  subscribe(querySpec, callback) {
    const subscriptionId = ++this.subscriptionCounter;
    
    this.subscriptions.set(subscriptionId, {
      querySpec,
      callback
    });
    
    // Return unsubscribe function
    return () => {
      this.subscriptions.delete(subscriptionId);
    };
  }
}