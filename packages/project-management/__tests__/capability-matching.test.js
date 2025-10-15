/**
 * Capability Matching Tests
 *
 * Tests for agent capability matching logic.
 * NO MOCKS for Neo4j - uses real database.
 */

import { getNeo4j } from '../src/neo4j.js';
import { initializeSchema } from '../src/schema.js';
import { checkAgentCapabilities } from '../src/capability-matching.js';

describe('Capability Matching', () => {
  let neo4j;

  beforeAll(async () => {
    neo4j = await getNeo4j();
    await initializeSchema();

    // Create test project and epic
    await neo4j.run(`
      CREATE (p:Project {id: 'cap-test-project', name: 'Capability Test Project', status: 'active', created: datetime(), updated: datetime()})
      CREATE (e:Epic {id: 'cap-test-epic', name: 'Capability Test Epic', description: 'Test Epic', status: 'pending', priority: 'high'})
      CREATE (p)-[:CONTAINS]->(e)
    `);

    // Create test agents with different capabilities
    await neo4j.run(`
      CREATE (a1:Agent {
        name: 'cap-test-agent-1',
        type: 'developer',
        capabilities: ['coding', 'testing'],
        status: 'idle',
        lastActive: datetime()
      })
      CREATE (a2:Agent {
        name: 'cap-test-agent-2',
        type: 'developer',
        capabilities: ['coding', 'documentation'],
        status: 'idle',
        lastActive: datetime()
      })
      CREATE (a3:Agent {
        name: 'cap-test-agent-3',
        type: 'tester',
        capabilities: ['testing'],
        status: 'idle',
        lastActive: datetime()
      })
    `);
  }, 30000);

  afterAll(async () => {
    // Clean up test data
    await neo4j.run('MATCH (n) WHERE n.id STARTS WITH "cap-test-" OR n.id STARTS WITH "CAP-TASK-" DETACH DELETE n');
    await neo4j.run('MATCH (a:Agent) WHERE a.name STARTS WITH "cap-test-agent-" DETACH DELETE a');
  }, 30000);

  beforeEach(async () => {
    // Clean up test tasks before each test
    await neo4j.run('MATCH (t:Task) WHERE t.id STARTS WITH "CAP-TASK-" DETACH DELETE t');
  }, 10000);

  test('Agent with exact capabilities matches task', async () => {
    // Create task requiring coding capability
    await neo4j.run(`
      MATCH (e:Epic {id: 'cap-test-epic'})
      CREATE (t:Task {
        id: 'CAP-TASK-001',
        name: 'Coding task',
        description: 'Requires coding',
        status: 'pending',
        priority: 'high',
        requiredCapabilities: ['coding'],
        created: datetime(),
        updated: datetime()
      })
      CREATE (e)-[:HAS_TASK]->(t)
    `);

    const result = await checkAgentCapabilities('cap-test-agent-1', 'CAP-TASK-001');

    expect(result.hasCapabilities).toBe(true);
    expect(result.missingCapabilities).toEqual([]);
  }, 10000);

  test('Agent with superset of capabilities matches task', async () => {
    // Create task requiring only coding
    await neo4j.run(`
      MATCH (e:Epic {id: 'cap-test-epic'})
      CREATE (t:Task {
        id: 'CAP-TASK-002',
        name: 'Simple coding task',
        description: 'Only needs coding',
        status: 'pending',
        priority: 'high',
        requiredCapabilities: ['coding'],
        created: datetime(),
        updated: datetime()
      })
      CREATE (e)-[:HAS_TASK]->(t)
    `);

    // Agent 1 has coding AND testing - should still match
    const result = await checkAgentCapabilities('cap-test-agent-1', 'CAP-TASK-002');

    expect(result.hasCapabilities).toBe(true);
    expect(result.missingCapabilities).toEqual([]);
  }, 10000);

  test('Agent missing capabilities does NOT match task', async () => {
    // Create task requiring both coding and testing
    await neo4j.run(`
      MATCH (e:Epic {id: 'cap-test-epic'})
      CREATE (t:Task {
        id: 'CAP-TASK-003',
        name: 'Complex task',
        description: 'Needs coding and testing',
        status: 'pending',
        priority: 'high',
        requiredCapabilities: ['coding', 'testing'],
        created: datetime(),
        updated: datetime()
      })
      CREATE (e)-[:HAS_TASK]->(t)
    `);

    // Agent 3 only has testing - missing coding
    const result = await checkAgentCapabilities('cap-test-agent-3', 'CAP-TASK-003');

    expect(result.hasCapabilities).toBe(false);
    expect(result.missingCapabilities).toEqual(['coding']);
  }, 10000);

  test('Agent with no required capabilities matches task with no requirements', async () => {
    // Create task with no capability requirements
    await neo4j.run(`
      MATCH (e:Epic {id: 'cap-test-epic'})
      CREATE (t:Task {
        id: 'CAP-TASK-004',
        name: 'Simple task',
        description: 'No special skills needed',
        status: 'pending',
        priority: 'high',
        requiredCapabilities: [],
        created: datetime(),
        updated: datetime()
      })
      CREATE (e)-[:HAS_TASK]->(t)
    `);

    const result = await checkAgentCapabilities('cap-test-agent-3', 'CAP-TASK-004');

    expect(result.hasCapabilities).toBe(true);
    expect(result.missingCapabilities).toEqual([]);
  }, 10000);

  test('Agent missing multiple capabilities', async () => {
    // Create task requiring coding, testing, and documentation
    await neo4j.run(`
      MATCH (e:Epic {id: 'cap-test-epic'})
      CREATE (t:Task {
        id: 'CAP-TASK-005',
        name: 'Full-stack task',
        description: 'Needs all skills',
        status: 'pending',
        priority: 'high',
        requiredCapabilities: ['coding', 'testing', 'documentation'],
        created: datetime(),
        updated: datetime()
      })
      CREATE (e)-[:HAS_TASK]->(t)
    `);

    // Agent 3 only has testing - missing coding and documentation
    const result = await checkAgentCapabilities('cap-test-agent-3', 'CAP-TASK-005');

    expect(result.hasCapabilities).toBe(false);
    expect(result.missingCapabilities.length).toBe(2);
    expect(result.missingCapabilities).toContain('coding');
    expect(result.missingCapabilities).toContain('documentation');
  }, 10000);

  test('Different agent with overlapping capabilities', async () => {
    // Create task requiring coding and documentation
    await neo4j.run(`
      MATCH (e:Epic {id: 'cap-test-epic'})
      CREATE (t:Task {
        id: 'CAP-TASK-006',
        name: 'Documentation task',
        description: 'Needs coding and docs',
        status: 'pending',
        priority: 'high',
        requiredCapabilities: ['coding', 'documentation'],
        created: datetime(),
        updated: datetime()
      })
      CREATE (e)-[:HAS_TASK]->(t)
    `);

    // Agent 2 has coding and documentation - perfect match
    const result = await checkAgentCapabilities('cap-test-agent-2', 'CAP-TASK-006');

    expect(result.hasCapabilities).toBe(true);
    expect(result.missingCapabilities).toEqual([]);
  }, 10000);
});
