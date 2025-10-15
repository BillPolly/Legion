/**
 * Bug Resolution Logic
 *
 * Handles bug resolution and automatic task unblocking.
 */

import { getNeo4j } from './neo4j.js';

/**
 * Resolve a bug and unblock tasks
 * @param {string} bugId - Bug ID to resolve
 * @param {string} status - New status (defaults to 'fixed')
 * @returns {Promise<Object>} Resolution result
 */
export async function resolveBug(bugId, status = 'fixed') {
  const neo4j = await getNeo4j();

  return await neo4j.transaction(async (tx) => {
    // 1. Update bug status
    const bugResult = await tx.run(`
      MATCH (b:Bug {id: $bugId})
      WITH b, b.status AS previousStatus
      SET b.status = $status,
          b.resolved = CASE WHEN $status IN ['fixed', 'wont_fix'] THEN datetime() ELSE b.resolved END
      RETURN previousStatus, b.status AS newStatus
    `, { bugId, status });

    const previousStatus = bugResult.records[0].get('previousStatus');
    const newStatus = bugResult.records[0].get('newStatus');

    // 2. Find tasks that were blocked by this bug
    const blockedTasksResult = await tx.run(`
      MATCH (b:Bug {id: $bugId})
      MATCH (t:Task)-[r:BLOCKED_BY]->(b)
      RETURN COLLECT(t.id) AS blockedTasks
    `, { bugId });

    const blockedTasks = blockedTasksResult.records[0].get('blockedTasks');

    // 3. Remove BLOCKED_BY relationships for this bug
    await tx.run(`
      MATCH (b:Bug {id: $bugId})
      MATCH (t:Task)-[r:BLOCKED_BY]->(b)
      DELETE r
    `, { bugId });

    // 4. For each previously blocked task, check if it has other blocking bugs
    // If not, set status back to 'pending'
    const unblockedResult = await tx.run(`
      UNWIND $blockedTasks AS taskId
      MATCH (t:Task {id: taskId})
      WHERE NOT EXISTS {
        MATCH (t)-[:BLOCKED_BY]->(b:Bug)
        WHERE NOT (b.status IN ['fixed', 'wont_fix'])
      }
      SET t.status = 'pending'
      RETURN COLLECT(t.id) AS unblockedTasks
    `, { blockedTasks });

    const unblockedTasks = unblockedResult.records[0].get('unblockedTasks');

    return {
      success: true,
      bugId,
      previousStatus,
      newStatus,
      unblockedTasks
    };
  });
}
