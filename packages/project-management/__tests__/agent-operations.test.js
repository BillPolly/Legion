/**
 * Agent Entity Operations Tests
 *
 * Tests for Agent CRUD operations.
 * NO MOCKS for Neo4j - uses real database.
 */

import { getNeo4j } from '../src/neo4j.js';
import { initializeSchema } from '../src/schema.js';
import {
  createAgent,
  findAgentByName,
  updateAgentStatus,
  findAgentsByStatus
} from '../src/agent-operations.js';

describe('Agent Entity Operations', () => {
  let neo4j;

  beforeAll(async () => {
    neo4j = await getNeo4j();
    await initializeSchema();
  }, 30000);

  afterAll(async () => {
    // Clean up test data
    await neo4j.run('MATCH (a:Agent) WHERE a.name STARTS WITH "test-agent" DETACH DELETE a');
  }, 30000);

  beforeEach(async () => {
    // Clean up test agents before each test
    await neo4j.run('MATCH (a:Agent) WHERE a.name STARTS WITH "test-agent" DETACH DELETE a');
  }, 10000);

  test('Create agent with capabilities', async () => {
    const agentData = {
      name: 'test-agent-1',
      type: 'integration-tester',
      capabilities: ['browser-automation', 'screenshot-capture', 'test-execution']
    };

    const result = await createAgent(agentData);

    expect(result.name).toBe('test-agent-1');
    expect(result.status).toBe('idle');

    // Verify in database
    const queryResult = await neo4j.run(
      'MATCH (a:Agent {name: $name}) RETURN a',
      { name: 'test-agent-1' }
    );

    expect(queryResult.records.length).toBe(1);
    const agent = queryResult.records[0].get('a').properties;
    expect(agent.name).toBe('test-agent-1');
    expect(agent.type).toBe('integration-tester');
    expect(agent.status).toBe('idle');
    expect(agent.capabilities).toEqual(['browser-automation', 'screenshot-capture', 'test-execution']);
  }, 10000);

  test('Find agent by name', async () => {
    // Create test agent
    await neo4j.run(`
      CREATE (a:Agent {
        name: 'test-agent-2',
        type: 'debugger',
        capabilities: ['debugging', 'code-analysis'],
        status: 'idle',
        lastActive: datetime()
      })
    `);

    const agent = await findAgentByName('test-agent-2');

    expect(agent).toBeDefined();
    expect(agent.name).toBe('test-agent-2');
    expect(agent.type).toBe('debugger');
    expect(agent.status).toBe('idle');
    expect(agent.capabilities).toEqual(['debugging', 'code-analysis']);
  }, 10000);

  test('Find agent by name returns null for non-existent agent', async () => {
    const agent = await findAgentByName('non-existent-agent');
    expect(agent).toBeNull();
  }, 10000);

  test('Update agent status', async () => {
    // Create test agent
    await neo4j.run(`
      CREATE (a:Agent {
        name: 'test-agent-3',
        type: 'orchestrator',
        capabilities: ['task-management'],
        status: 'idle',
        lastActive: datetime()
      })
    `);

    const result = await updateAgentStatus('test-agent-3', 'busy');

    expect(result.previousStatus).toBe('idle');
    expect(result.newStatus).toBe('busy');

    // Verify in database
    const queryResult = await neo4j.run(
      'MATCH (a:Agent {name: $name}) RETURN a',
      { name: 'test-agent-3' }
    );

    const agent = queryResult.records[0].get('a').properties;
    expect(agent.status).toBe('busy');
  }, 10000);

  test('List agents by status', async () => {
    // Create multiple test agents with different statuses
    await neo4j.run(`
      CREATE (a1:Agent {
        name: 'test-agent-4',
        type: 'tester',
        capabilities: ['testing'],
        status: 'idle',
        lastActive: datetime()
      })
      CREATE (a2:Agent {
        name: 'test-agent-5',
        type: 'tester',
        capabilities: ['testing'],
        status: 'idle',
        lastActive: datetime()
      })
      CREATE (a3:Agent {
        name: 'test-agent-6',
        type: 'tester',
        capabilities: ['testing'],
        status: 'busy',
        lastActive: datetime()
      })
    `);

    const idleAgents = await findAgentsByStatus('idle');
    expect(idleAgents.length).toBeGreaterThanOrEqual(2);
    const idleNames = idleAgents.map(a => a.name);
    expect(idleNames).toContain('test-agent-4');
    expect(idleNames).toContain('test-agent-5');

    const busyAgents = await findAgentsByStatus('busy');
    expect(busyAgents.length).toBeGreaterThanOrEqual(1);
    const busyNames = busyAgents.map(a => a.name);
    expect(busyNames).toContain('test-agent-6');

    const offlineAgents = await findAgentsByStatus('offline');
    // Should not contain our test agents
    const offlineNames = offlineAgents.map(a => a.name);
    expect(offlineNames).not.toContain('test-agent-4');
  }, 10000);
});
