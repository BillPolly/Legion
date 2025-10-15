/**
 * Blocker Detection Tests
 *
 * Tests for task blocker detection logic (bugs blocking tasks).
 * NO MOCKS for Neo4j - uses real database.
 */

import { getNeo4j } from '../src/neo4j.js';
import { initializeSchema } from '../src/schema.js';
import { checkTaskNotBlocked } from '../src/blocker-detection.js';

describe('Blocker Detection', () => {
  let neo4j;

  beforeAll(async () => {
    neo4j = await getNeo4j();
    await initializeSchema();

    // Clean up any existing test data first
    await neo4j.run('MATCH (n) WHERE n.id STARTS WITH "blocker-test-" OR n.id STARTS WITH "BLOCKER-TASK-" OR n.id STARTS WITH "BLOCKER-BUG-" DETACH DELETE n');

    // Create test project and epic
    await neo4j.run(`
      CREATE (p:Project {id: 'blocker-test-project', name: 'Blocker Test Project', status: 'active', created: datetime(), updated: datetime()})
      CREATE (e:Epic {id: 'blocker-test-epic', name: 'Blocker Test Epic', description: 'Test Epic', status: 'pending', priority: 'high'})
      CREATE (p)-[:CONTAINS]->(e)
    `);
  }, 30000);

  afterAll(async () => {
    // Clean up test data
    await neo4j.run('MATCH (n) WHERE n.id STARTS WITH "blocker-test-" OR n.id STARTS WITH "BLOCKER-TASK-" OR n.id STARTS WITH "BLOCKER-BUG-" DETACH DELETE n');
  }, 30000);

  beforeEach(async () => {
    // Clean up test tasks and bugs before each test
    await neo4j.run('MATCH (t:Task) WHERE t.id STARTS WITH "BLOCKER-TASK-" DETACH DELETE t');
    await neo4j.run('MATCH (b:Bug) WHERE b.id STARTS WITH "BLOCKER-BUG-" DETACH DELETE b');
  }, 10000);

  test('Task with no blockers is available', async () => {
    // Create task with no bugs blocking it
    await neo4j.run(`
      MATCH (e:Epic {id: 'blocker-test-epic'})
      CREATE (t:Task {
        id: 'BLOCKER-TASK-001',
        name: 'Unblocked task',
        description: 'Task with no bugs',
        status: 'pending',
        priority: 'high',
        requiredCapabilities: [],
        created: datetime(),
        updated: datetime()
      })
      CREATE (e)-[:HAS_TASK]->(t)
    `);

    const result = await checkTaskNotBlocked('BLOCKER-TASK-001');

    expect(result.blocked).toBe(false);
    expect(result.blockingBugs).toEqual([]);
  }, 10000);

  test('Task blocked by open bug is NOT available', async () => {
    // Create task and open bug blocking it
    await neo4j.run(`
      MATCH (e:Epic {id: 'blocker-test-epic'})
      CREATE (t:Task {
        id: 'BLOCKER-TASK-002',
        name: 'Blocked task',
        description: 'Task blocked by bug',
        status: 'pending',
        priority: 'high',
        requiredCapabilities: [],
        created: datetime(),
        updated: datetime()
      })
      CREATE (b:Bug {
        id: 'BLOCKER-BUG-001',
        title: 'Critical bug',
        description: 'Blocks task',
        severity: 'critical',
        status: 'open',
        foundBy: 'test-agent',
        created: datetime()
      })
      CREATE (e)-[:HAS_TASK]->(t)
      CREATE (t)-[:BLOCKED_BY]->(b)
    `);

    const result = await checkTaskNotBlocked('BLOCKER-TASK-002');

    expect(result.blocked).toBe(true);
    expect(result.blockingBugs.length).toBe(1);
    expect(result.blockingBugs[0].id).toBe('BLOCKER-BUG-001');
    expect(result.blockingBugs[0].status).toBe('open');
  }, 10000);

  test('Task blocked by fixed bug is available', async () => {
    // Create task and fixed bug (not blocking)
    await neo4j.run(`
      MATCH (e:Epic {id: 'blocker-test-epic'})
      CREATE (t:Task {
        id: 'BLOCKER-TASK-003',
        name: 'Previously blocked task',
        description: 'Bug is now fixed',
        status: 'pending',
        priority: 'high',
        requiredCapabilities: [],
        created: datetime(),
        updated: datetime()
      })
      CREATE (b:Bug {
        id: 'BLOCKER-BUG-002',
        title: 'Fixed bug',
        description: 'Was blocking task',
        severity: 'high',
        status: 'fixed',
        foundBy: 'test-agent',
        created: datetime(),
        resolved: datetime()
      })
      CREATE (e)-[:HAS_TASK]->(t)
      CREATE (t)-[:BLOCKED_BY]->(b)
    `);

    const result = await checkTaskNotBlocked('BLOCKER-TASK-003');

    expect(result.blocked).toBe(false);
    expect(result.blockingBugs).toEqual([]);
  }, 10000);

  test('Task blocked by multiple open bugs', async () => {
    // Create task blocked by 2 open bugs
    await neo4j.run(`
      MATCH (e:Epic {id: 'blocker-test-epic'})
      CREATE (t:Task {
        id: 'BLOCKER-TASK-004',
        name: 'Multi-blocked task',
        description: 'Blocked by multiple bugs',
        status: 'pending',
        priority: 'high',
        requiredCapabilities: [],
        created: datetime(),
        updated: datetime()
      })
      CREATE (b1:Bug {
        id: 'BLOCKER-BUG-003',
        title: 'Bug 1',
        description: 'First blocker',
        severity: 'high',
        status: 'open',
        foundBy: 'test-agent',
        created: datetime()
      })
      CREATE (b2:Bug {
        id: 'BLOCKER-BUG-004',
        title: 'Bug 2',
        description: 'Second blocker',
        severity: 'critical',
        status: 'investigating',
        foundBy: 'test-agent',
        created: datetime()
      })
      CREATE (e)-[:HAS_TASK]->(t)
      CREATE (t)-[:BLOCKED_BY]->(b1)
      CREATE (t)-[:BLOCKED_BY]->(b2)
    `);

    const result = await checkTaskNotBlocked('BLOCKER-TASK-004');

    expect(result.blocked).toBe(true);
    expect(result.blockingBugs.length).toBe(2);
    const bugIds = result.blockingBugs.map(b => b.id);
    expect(bugIds).toContain('BLOCKER-BUG-003');
    expect(bugIds).toContain('BLOCKER-BUG-004');
  }, 10000);

  test('Task blocked by mix of open and fixed bugs', async () => {
    // Create task blocked by 1 open and 1 fixed bug
    await neo4j.run(`
      MATCH (e:Epic {id: 'blocker-test-epic'})
      CREATE (t:Task {
        id: 'BLOCKER-TASK-005',
        name: 'Partially blocked task',
        description: 'One bug fixed, one still open',
        status: 'pending',
        priority: 'high',
        requiredCapabilities: [],
        created: datetime(),
        updated: datetime()
      })
      CREATE (b1:Bug {
        id: 'BLOCKER-BUG-005',
        title: 'Fixed bug',
        description: 'No longer blocks',
        severity: 'medium',
        status: 'fixed',
        foundBy: 'test-agent',
        created: datetime(),
        resolved: datetime()
      })
      CREATE (b2:Bug {
        id: 'BLOCKER-BUG-006',
        title: 'Open bug',
        description: 'Still blocks',
        severity: 'high',
        status: 'open',
        foundBy: 'test-agent',
        created: datetime()
      })
      CREATE (e)-[:HAS_TASK]->(t)
      CREATE (t)-[:BLOCKED_BY]->(b1)
      CREATE (t)-[:BLOCKED_BY]->(b2)
    `);

    const result = await checkTaskNotBlocked('BLOCKER-TASK-005');

    expect(result.blocked).toBe(true);
    expect(result.blockingBugs.length).toBe(1);
    expect(result.blockingBugs[0].id).toBe('BLOCKER-BUG-006');
    expect(result.blockingBugs[0].status).toBe('open');
  }, 10000);
});
