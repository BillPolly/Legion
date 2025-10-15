/**
 * Progress Tracking Logic
 *
 * Reports task progress, handles status transitions, creates artifacts,
 * and detects newly unblocked tasks.
 */

import { getNeo4j } from './neo4j.js';

/**
 * Report task progress
 * @param {Object} params - Progress parameters
 * @param {string} params.agentName - Name of reporting agent
 * @param {string} params.taskId - Task ID
 * @param {string} params.status - New status (in_progress, completed, failed)
 * @param {Array} params.artifacts - Optional artifacts produced
 * @param {Object} params.metrics - Optional metrics
 * @param {string} params.notes - Optional notes
 * @returns {Promise<Object>} Progress report result
 */
export async function reportProgress(params) {
  const neo4j = await getNeo4j();

  return await neo4j.transaction(async (tx) => {
    // 1. Update task status
    const updateResult = await tx.run(`
      MATCH (t:Task {id: $taskId})
      MATCH (a:Agent {name: $agentName})
      WITH t, a, t.status AS previousStatus
      SET t.status = $status,
          t.updated = datetime(),
          t.assignedTo = CASE WHEN $status IN ['completed', 'failed'] THEN null ELSE $agentName END,
          t.started = CASE WHEN $status = 'in_progress' AND t.started IS NULL
                           THEN datetime() ELSE t.started END,
          t.completed = CASE WHEN $status = 'completed'
                             THEN datetime() ELSE t.completed END
      WITH t, a, previousStatus
      MERGE (a)-[:COMPLETED]->(t)
      RETURN previousStatus, t.status AS newStatus
    `, {
      taskId: params.taskId,
      agentName: params.agentName,
      status: params.status
    });

    const previousStatus = updateResult.records[0].get('previousStatus');
    const newStatus = updateResult.records[0].get('newStatus');

    // 2. Create artifacts if provided
    let artifactsCreated = 0;
    if (params.artifacts && params.artifacts.length > 0) {
      const artifactResult = await tx.run(`
        MATCH (t:Task {id: $taskId})
        UNWIND $artifacts AS artifact
        CREATE (a:Artifact {
          id: randomUUID(),
          path: artifact.path,
          type: artifact.type,
          size: artifact.size,
          created: datetime()
        })
        CREATE (t)-[:PRODUCES]->(a)
        RETURN count(a) AS count
      `, {
        taskId: params.taskId,
        artifacts: params.artifacts
      });

      artifactsCreated = artifactResult.records[0].get('count').low || artifactResult.records[0].get('count');
    }

    // 3. Find newly unblocked tasks (if this task was completed)
    let unblockedTasks = [];
    if (params.status === 'completed') {
      const unblockedResult = await tx.run(`
        MATCH (completed:Task {id: $taskId, status: 'completed'})
        MATCH (pending:Task {status: 'pending'})-[:DEPENDS_ON]->(completed)
        WHERE NOT EXISTS {
          MATCH (pending)-[:DEPENDS_ON]->(other:Task)
          WHERE other.status <> 'completed' AND other.id <> $taskId
        }
        RETURN COLLECT(pending.id) AS unblockedTasks
      `, { taskId: params.taskId });

      unblockedTasks = unblockedResult.records[0].get('unblockedTasks');
    }

    return {
      success: true,
      taskId: params.taskId,
      previousStatus,
      newStatus,
      artifactsCreated,
      unblockedTasks
    };
  });
}
