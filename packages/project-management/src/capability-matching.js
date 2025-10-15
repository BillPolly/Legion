/**
 * Capability Matching Logic
 *
 * Determines if an agent has the required capabilities for a task.
 */

import { getNeo4j } from './neo4j.js';

/**
 * Check if an agent has the required capabilities for a task
 * @param {string} agentName - Agent name
 * @param {string} taskId - Task ID
 * @returns {Promise<Object>} Result with hasCapabilities status and missing capabilities
 */
export async function checkAgentCapabilities(agentName, taskId) {
  const neo4j = await getNeo4j();

  const result = await neo4j.run(`
    MATCH (a:Agent {name: $agentName})
    MATCH (t:Task {id: $taskId})
    WITH a.capabilities AS agentCaps, t.requiredCapabilities AS requiredCaps
    WITH agentCaps, requiredCaps,
         [cap IN requiredCaps WHERE NOT cap IN agentCaps] AS missing
    RETURN
      CASE WHEN size(missing) = 0 THEN true ELSE false END AS hasCapabilities,
      missing AS missingCapabilities
  `, { agentName, taskId });

  const record = result.records[0];
  const hasCapabilities = record.get('hasCapabilities');
  const missingCapabilities = record.get('missingCapabilities');

  return {
    hasCapabilities,
    missingCapabilities
  };
}
