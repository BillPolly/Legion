/**
 * Neo4j Connection Wrapper
 *
 * Provides convenience functions for accessing Neo4j via ResourceManager.
 * NO manual driver creation - ResourceManager handles everything!
 */

import { ResourceManager } from '@legion/resource-manager';

// Singleton Neo4j handle
let neo4jHandle = null;

/**
 * Get Neo4j handle from ResourceManager
 * @returns {Promise<Object>} Neo4j handle with run(), transaction(), session(), isHealthy() methods
 */
export async function getNeo4j() {
  if (!neo4jHandle) {
    const resourceManager = await ResourceManager.getInstance();
    neo4jHandle = await resourceManager.getNeo4jServer();
  }
  return neo4jHandle;
}

/**
 * Execute a Cypher query
 * @param {string} query - Cypher query string
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
export async function runQuery(query, params = {}) {
  const neo4j = await getNeo4j();
  return neo4j.run(query, params);
}

/**
 * Execute queries within a transaction
 * @param {Function} work - Async function that receives transaction object
 * @returns {Promise<any>} Result from work function
 */
export async function runTransaction(work) {
  const neo4j = await getNeo4j();
  return neo4j.transaction(work);
}

/**
 * Check if Neo4j connection is healthy
 * @returns {Promise<boolean>} True if healthy
 */
export async function isHealthy() {
  const neo4j = await getNeo4j();
  return neo4j.isHealthy();
}

/**
 * Close Neo4j connection
 * @returns {Promise<void>}
 */
export async function close() {
  if (neo4jHandle) {
    await neo4jHandle.close();
    neo4jHandle = null;
  }
}
