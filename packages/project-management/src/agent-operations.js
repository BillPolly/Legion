/**
 * Agent Entity Operations
 *
 * CRUD operations for Agent entities.
 */

import { getNeo4j } from './neo4j.js';

/**
 * Create a new agent
 * @param {Object} params - Agent parameters
 * @param {string} params.name - Unique agent name
 * @param {string} params.type - Agent type
 * @param {string[]} params.capabilities - Agent capabilities
 * @returns {Promise<Object>} Created agent info
 */
export async function createAgent(params) {
  const neo4j = await getNeo4j();

  const result = await neo4j.run(`
    CREATE (a:Agent {
      name: $name,
      type: $type,
      capabilities: $capabilities,
      status: 'idle',
      lastActive: datetime()
    })
    RETURN a
  `, {
    name: params.name,
    type: params.type,
    capabilities: params.capabilities || []
  });

  const agent = result.records[0].get('a').properties;

  return {
    name: agent.name,
    status: agent.status
  };
}

/**
 * Find agent by name
 * @param {string} name - Agent name
 * @returns {Promise<Object|null>} Agent object or null if not found
 */
export async function findAgentByName(name) {
  const neo4j = await getNeo4j();

  const result = await neo4j.run(
    'MATCH (a:Agent {name: $name}) RETURN a',
    { name }
  );

  if (result.records.length === 0) {
    return null;
  }

  const agent = result.records[0].get('a').properties;

  return {
    name: agent.name,
    type: agent.type,
    capabilities: agent.capabilities || [],
    status: agent.status,
    currentTask: agent.currentTask || null,
    lastActive: agent.lastActive
  };
}

/**
 * Update agent status
 * @param {string} name - Agent name
 * @param {string} newStatus - New status (idle, busy, offline)
 * @returns {Promise<Object>} Update result
 */
export async function updateAgentStatus(name, newStatus) {
  const neo4j = await getNeo4j();

  const result = await neo4j.run(`
    MATCH (a:Agent {name: $name})
    WITH a, a.status AS previousStatus
    SET a.status = $newStatus,
        a.lastActive = datetime()
    RETURN previousStatus, a.status AS newStatus
  `, { name, newStatus });

  const record = result.records[0];

  return {
    previousStatus: record.get('previousStatus'),
    newStatus: record.get('newStatus')
  };
}

/**
 * Find agents by status
 * @param {string} status - Agent status
 * @returns {Promise<Object[]>} Array of agents
 */
export async function findAgentsByStatus(status) {
  const neo4j = await getNeo4j();

  const result = await neo4j.run(
    'MATCH (a:Agent {status: $status}) RETURN a ORDER BY a.name',
    { status }
  );

  return result.records.map(record => {
    const agent = record.get('a').properties;
    return {
      name: agent.name,
      type: agent.type,
      capabilities: agent.capabilities || [],
      status: agent.status,
      currentTask: agent.currentTask || null,
      lastActive: agent.lastActive
    };
  });
}
