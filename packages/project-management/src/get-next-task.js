/**
 * Get Next Task Logic
 *
 * Finds the next available task for an agent based on:
 * - Capability matching
 * - Dependency resolution
 * - Blocker detection (bugs)
 * - Priority sorting
 */

import { getNeo4j } from './neo4j.js';

/**
 * Get the next available task for an agent
 * @param {string} agentName - Agent name
 * @returns {Promise<Object|null>} Next task or null if none available
 */
export async function getNextTask(agentName) {
  const neo4j = await getNeo4j();

  // This query implements the pm_get_next_task specification from DESIGN.md
  const result = await neo4j.run(`
    MATCH (agent:Agent {name: $agentName})
    MATCH (task:Task {status: 'pending'})

    // Check 1: Agent has required capabilities
    WHERE ALL(cap IN task.requiredCapabilities WHERE cap IN agent.capabilities)

    // Check 2: All dependencies are completed
    AND NOT EXISTS {
      MATCH (task)-[:DEPENDS_ON]->(dep:Task)
      WHERE dep.status <> 'completed'
    }

    // Check 3: Not blocked by open bugs
    AND NOT EXISTS {
      MATCH (task)-[:BLOCKED_BY]->(bug:Bug)
      WHERE NOT (bug.status IN ['fixed', 'wont_fix'])
    }

    // Sort by priority (critical > high > medium > low), then by creation time
    WITH task,
         CASE task.priority
           WHEN 'critical' THEN 0
           WHEN 'high' THEN 1
           WHEN 'medium' THEN 2
           WHEN 'low' THEN 3
           ELSE 4
         END AS priorityOrder
    ORDER BY priorityOrder ASC, task.created ASC
    LIMIT 1

    // Get dependencies for context
    OPTIONAL MATCH (task)-[:DEPENDS_ON]->(dep:Task)
    WITH task, COLLECT(dep.id) AS dependencies

    RETURN task.id AS taskId, task.name AS taskName, task.description AS description,
           task.priority AS priority, dependencies
  `, { agentName });

  if (result.records.length === 0) {
    return null;
  }

  const record = result.records[0];
  return {
    taskId: record.get('taskId'),
    taskName: record.get('taskName'),
    description: record.get('description'),
    priority: record.get('priority'),
    dependencies: record.get('dependencies')
  };
}
