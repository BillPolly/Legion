/**
 * Artifact Entity Operations
 *
 * CRUD operations for Artifact entities.
 */

import { getNeo4j } from './neo4j.js';

/**
 * Create a new artifact
 * @param {Object} params - Artifact parameters
 * @param {string} params.path - File system path
 * @param {string} params.type - Artifact type (code, test, report, screenshot, documentation)
 * @param {number} params.size - File size in bytes (optional)
 * @returns {Promise<Object>} Created artifact info
 */
export async function createArtifact(params) {
  const neo4j = await getNeo4j();

  const query = params.size !== undefined
    ? `
      CREATE (a:Artifact {
        id: randomUUID(),
        path: $path,
        type: $type,
        size: $size,
        created: datetime()
      })
      RETURN a.id AS artifactId, a.path AS path
    `
    : `
      CREATE (a:Artifact {
        id: randomUUID(),
        path: $path,
        type: $type,
        created: datetime()
      })
      RETURN a.id AS artifactId, a.path AS path
    `;

  const queryParams = {
    path: params.path,
    type: params.type
  };

  if (params.size !== undefined) {
    queryParams.size = params.size;
  }

  const result = await neo4j.run(query, queryParams);

  return {
    artifactId: result.records[0].get('artifactId'),
    path: result.records[0].get('path')
  };
}

/**
 * Link artifact to task
 * @param {string} artifactId - Artifact ID
 * @param {string} taskId - Task ID
 * @returns {Promise<Object>} Link result
 */
export async function linkArtifactToTask(artifactId, taskId) {
  const neo4j = await getNeo4j();

  await neo4j.run(`
    MATCH (t:Task {id: $taskId})
    MATCH (a:Artifact {id: $artifactId})
    CREATE (t)-[:PRODUCES]->(a)
  `, { taskId, artifactId });

  return {
    success: true,
    artifactId,
    taskId
  };
}

/**
 * Find artifacts by task
 * @param {string} taskId - Task ID
 * @returns {Promise<Object[]>} Array of artifacts
 */
export async function findArtifactsByTask(taskId) {
  const neo4j = await getNeo4j();

  const result = await neo4j.run(`
    MATCH (t:Task {id: $taskId})-[:PRODUCES]->(a:Artifact)
    RETURN a
    ORDER BY a.created
  `, { taskId });

  return result.records.map(record => {
    const artifact = record.get('a').properties;
    return {
      id: artifact.id,
      path: artifact.path,
      type: artifact.type,
      size: artifact.size ? artifact.size.low : null,
      created: artifact.created
    };
  });
}

/**
 * Find artifacts by type
 * @param {string} type - Artifact type
 * @returns {Promise<Object[]>} Array of artifacts
 */
export async function findArtifactsByType(type) {
  const neo4j = await getNeo4j();

  const result = await neo4j.run(`
    MATCH (a:Artifact {type: $type})
    RETURN a
    ORDER BY a.created DESC
  `, { type });

  return result.records.map(record => {
    const artifact = record.get('a').properties;
    return {
      id: artifact.id,
      path: artifact.path,
      type: artifact.type,
      size: artifact.size ? artifact.size.low : null,
      created: artifact.created
    };
  });
}
