/**
 * Dependency Resolution Logic
 *
 * Determines if a task's dependencies are resolved.
 */

import { getNeo4j } from './neo4j.js';

/**
 * Check if a task's dependencies are resolved
 * @param {string} taskId - Task ID to check
 * @returns {Promise<Object>} Result with resolved status and unresolved dependencies
 */
export async function checkDependenciesResolved(taskId) {
  const neo4j = await getNeo4j();

  const result = await neo4j.run(`
    MATCH (t:Task {id: $taskId})
    OPTIONAL MATCH (t)-[:DEPENDS_ON]->(dep:Task)
    WHERE dep.status <> 'completed'
    RETURN
      CASE WHEN count(dep) = 0 THEN true ELSE false END AS resolved,
      COLLECT(dep {.id, .name, .status}) AS unresolvedDependencies
  `, { taskId });

  const record = result.records[0];
  const resolved = record.get('resolved');
  const unresolvedDeps = record.get('unresolvedDependencies').filter(dep => dep.id !== null);

  return {
    resolved,
    unresolvedDependencies: unresolvedDeps
  };
}
