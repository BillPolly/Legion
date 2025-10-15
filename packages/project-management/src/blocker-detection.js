/**
 * Blocker Detection Logic
 *
 * Determines if a task is blocked by open bugs.
 */

import { getNeo4j } from './neo4j.js';

/**
 * Check if a task is blocked by open bugs
 * @param {string} taskId - Task ID to check
 * @returns {Promise<Object>} Result with blocked status and blocking bugs
 */
export async function checkTaskNotBlocked(taskId) {
  const neo4j = await getNeo4j();

  const result = await neo4j.run(`
    MATCH (t:Task {id: $taskId})
    OPTIONAL MATCH (t)-[:BLOCKED_BY]->(bug:Bug)
    WHERE NOT (bug.status IN ['fixed', 'wont_fix'])
    RETURN
      CASE WHEN count(bug) = 0 THEN false ELSE true END AS blocked,
      COLLECT(bug {.id, .title, .severity, .status}) AS blockingBugs
  `, { taskId });

  const record = result.records[0];
  const blocked = record.get('blocked');
  const blockingBugs = record.get('blockingBugs').filter(bug => bug.id !== null);

  return {
    blocked,
    blockingBugs
  };
}
