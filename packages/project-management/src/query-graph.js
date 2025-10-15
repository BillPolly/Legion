/**
 * Query Graph Operations
 *
 * Execute read-only Cypher queries on the knowledge graph.
 */

import { getNeo4j } from './neo4j.js';

/**
 * Validate that a Cypher query is read-only
 * @param {string} query - Cypher query to validate
 * @throws {Error} If query contains write operations
 */
function validateReadOnlyQuery(query) {
  const writeKeywords = /\b(CREATE|SET|DELETE|MERGE|REMOVE|DROP|DETACH)\b/i;

  if (writeKeywords.test(query)) {
    throw new Error('Write operations not allowed in query tool. Use specific tools for mutations.');
  }
}

/**
 * Execute a read-only Cypher query
 * @param {Object} params - Query parameters
 * @param {string} params.query - Cypher query to execute
 * @param {Object} params.parameters - Query parameters
 * @returns {Promise<Object>} Query results
 */
export async function queryGraph(params) {
  const { query, parameters = {} } = params;

  // Validate query is read-only
  validateReadOnlyQuery(query);

  const neo4j = await getNeo4j();

  // Execute query with timeout
  const result = await neo4j.run(query, parameters);

  // Convert Neo4j results to plain objects
  const results = result.records.map(record => {
    const obj = {};
    record.keys.forEach(key => {
      const value = record.get(key);

      // Convert Neo4j types to plain JavaScript
      if (value && typeof value === 'object' && value.properties) {
        // Node or Relationship
        obj[key] = value.properties;
      } else if (Array.isArray(value)) {
        // Array
        obj[key] = value.map(item =>
          item && typeof item === 'object' && item.properties
            ? item.properties
            : item
        );
      } else {
        // Primitive value
        obj[key] = value;
      }
    });
    return obj;
  });

  return {
    results,
    count: results.length
  };
}
