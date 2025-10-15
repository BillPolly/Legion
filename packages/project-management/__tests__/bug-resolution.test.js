/**
 * Bug Resolution Tests
 *
 * Tests for bug resolution and task unblocking.
 * NO MOCKS for Neo4j - uses real database.
 */

import { getNeo4j } from '../src/neo4j.js';
import { initializeSchema } from '../src/schema.js';
import { resolveBug } from '../src/bug-resolution.js';

describe('Bug Resolution', () => {
  let neo4j;

  beforeAll(async () => {
    neo4j = await getNeo4j();
    await initializeSchema();

    // Clean up any existing test data first
    await neo4j.run('MATCH (n) WHERE n.id STARTS WITH "bug-res-" OR n.id STARTS WITH "BR-" DETACH DELETE n');

    // Create test project and epic
    await neo4j.run(`
      CREATE (p:Project {id: 'bug-res-project', name: 'Bug Resolution Test', status: 'active', created: datetime(), updated: datetime()})
      CREATE (e:Epic {id: 'bug-res-epic', name: 'Bug Resolution Epic', description: 'Test Epic', status: 'pending', priority: 'high'})
      CREATE (p)-[:CONTAINS]->(e)
    `);
  }, 30000);

  afterAll(async () => {
    // Clean up test data
    await neo4j.run('MATCH (n) WHERE n.id STARTS WITH "bug-res-" OR n.id STARTS WITH "BR-" DETACH DELETE n');
  }, 30000);

  beforeEach(async () => {
    // Clean up test tasks and bugs before each test
    await neo4j.run('MATCH (t:Task) WHERE t.id STARTS WITH "BR-TASK-" DETACH DELETE t');
    await neo4j.run('MATCH (b:Bug) WHERE b.id STARTS WITH "BR-BUG-" DETACH DELETE b');
  }, 10000);

  test('Resolving bug unblocks single task', async () => {
    // Create task and bug blocking it
    await neo4j.run(`
      MATCH (e:Epic {id: 'bug-res-epic'})
      CREATE (t:Task {
        id: 'BR-TASK-001',
        name: 'Blocked task',
        description: 'Task blocked by bug',
        status: 'blocked',
        priority: 'high',
        requiredCapabilities: [],
        created: datetime(),
        updated: datetime()
      })
      CREATE (b:Bug {
        id: 'BR-BUG-001',
        title: 'Test bug',
        description: 'Blocking task',
        severity: 'high',
        status: 'open',
        foundBy: 'test-agent',
        created: datetime()
      })
      CREATE (e)-[:HAS_TASK]->(t)
      CREATE (t)-[:BLOCKED_BY]->(b)
    `);

    const result = await resolveBug('BR-BUG-001');

    expect(result.success).toBe(true);
    expect(result.bugId).toBe('BR-BUG-001');
    expect(result.previousStatus).toBe('open');
    expect(result.newStatus).toBe('fixed');
    expect(result.unblockedTasks).toContain('BR-TASK-001');

    // Verify bug is fixed
    const bugResult = await neo4j.run(
      'MATCH (b:Bug {id: $id}) RETURN b',
      { id: 'BR-BUG-001' }
    );
    const bug = bugResult.records[0].get('b').properties;
    expect(bug.status).toBe('fixed');
    expect(bug.resolved).toBeDefined();

    // Verify task is unblocked
    const taskResult = await neo4j.run(
      'MATCH (t:Task {id: $id}) RETURN t',
      { id: 'BR-TASK-001' }
    );
    const task = taskResult.records[0].get('t').properties;
    expect(task.status).toBe('pending');

    // Verify BLOCKED_BY relationship removed
    const relResult = await neo4j.run(`
      MATCH (t:Task {id: 'BR-TASK-001'})-[r:BLOCKED_BY]->(b:Bug {id: 'BR-BUG-001'})
      RETURN count(r) AS count
    `);
    expect(relResult.records[0].get('count').low).toBe(0);
  }, 10000);

  test('Resolving bug unblocks multiple tasks', async () => {
    // Create multiple tasks blocked by same bug
    await neo4j.run(`
      MATCH (e:Epic {id: 'bug-res-epic'})
      CREATE (t1:Task {
        id: 'BR-TASK-002',
        name: 'Blocked task 1',
        description: 'Task 1',
        status: 'blocked',
        priority: 'high',
        requiredCapabilities: [],
        created: datetime(),
        updated: datetime()
      })
      CREATE (t2:Task {
        id: 'BR-TASK-003',
        name: 'Blocked task 2',
        description: 'Task 2',
        status: 'blocked',
        priority: 'high',
        requiredCapabilities: [],
        created: datetime(),
        updated: datetime()
      })
      CREATE (t3:Task {
        id: 'BR-TASK-004',
        name: 'Blocked task 3',
        description: 'Task 3',
        status: 'blocked',
        priority: 'high',
        requiredCapabilities: [],
        created: datetime(),
        updated: datetime()
      })
      CREATE (b:Bug {
        id: 'BR-BUG-002',
        title: 'Multi-block bug',
        description: 'Blocks multiple tasks',
        severity: 'critical',
        status: 'open',
        foundBy: 'test-agent',
        created: datetime()
      })
      CREATE (e)-[:HAS_TASK]->(t1)
      CREATE (e)-[:HAS_TASK]->(t2)
      CREATE (e)-[:HAS_TASK]->(t3)
      CREATE (t1)-[:BLOCKED_BY]->(b)
      CREATE (t2)-[:BLOCKED_BY]->(b)
      CREATE (t3)-[:BLOCKED_BY]->(b)
    `);

    const result = await resolveBug('BR-BUG-002');

    expect(result.success).toBe(true);
    expect(result.unblockedTasks.length).toBe(3);
    expect(result.unblockedTasks).toContain('BR-TASK-002');
    expect(result.unblockedTasks).toContain('BR-TASK-003');
    expect(result.unblockedTasks).toContain('BR-TASK-004');
  }, 10000);

  test('Task blocked by multiple bugs only unblocks when all are fixed', async () => {
    // Create task blocked by two bugs
    await neo4j.run(`
      MATCH (e:Epic {id: 'bug-res-epic'})
      CREATE (t:Task {
        id: 'BR-TASK-005',
        name: 'Multi-blocked task',
        description: 'Blocked by 2 bugs',
        status: 'blocked',
        priority: 'high',
        requiredCapabilities: [],
        created: datetime(),
        updated: datetime()
      })
      CREATE (b1:Bug {
        id: 'BR-BUG-003',
        title: 'Bug 1',
        description: 'First blocker',
        severity: 'high',
        status: 'open',
        foundBy: 'test-agent',
        created: datetime()
      })
      CREATE (b2:Bug {
        id: 'BR-BUG-004',
        title: 'Bug 2',
        description: 'Second blocker',
        severity: 'high',
        status: 'open',
        foundBy: 'test-agent',
        created: datetime()
      })
      CREATE (e)-[:HAS_TASK]->(t)
      CREATE (t)-[:BLOCKED_BY]->(b1)
      CREATE (t)-[:BLOCKED_BY]->(b2)
    `);

    // Fix first bug - task should still be blocked
    const result1 = await resolveBug('BR-BUG-003');
    expect(result1.unblockedTasks).toEqual([]);

    // Verify task still blocked
    const taskCheck1 = await neo4j.run(
      'MATCH (t:Task {id: $id}) RETURN t.status AS status',
      { id: 'BR-TASK-005' }
    );
    expect(taskCheck1.records[0].get('status')).toBe('blocked');

    // Fix second bug - now task should be unblocked
    const result2 = await resolveBug('BR-BUG-004');
    expect(result2.unblockedTasks).toContain('BR-TASK-005');

    // Verify task now pending
    const taskCheck2 = await neo4j.run(
      'MATCH (t:Task {id: $id}) RETURN t.status AS status',
      { id: 'BR-TASK-005' }
    );
    expect(taskCheck2.records[0].get('status')).toBe('pending');
  }, 10000);

  test('Resolving already-fixed bug is idempotent', async () => {
    // Create bug that's already fixed
    await neo4j.run(`
      CREATE (b:Bug {
        id: 'BR-BUG-005',
        title: 'Already fixed',
        description: 'Previously fixed bug',
        severity: 'medium',
        status: 'fixed',
        foundBy: 'test-agent',
        created: datetime(),
        resolved: datetime()
      })
    `);

    const result = await resolveBug('BR-BUG-005');

    expect(result.success).toBe(true);
    expect(result.previousStatus).toBe('fixed');
    expect(result.newStatus).toBe('fixed');
    expect(result.unblockedTasks).toEqual([]);
  }, 10000);

  test('No tasks unblocked when bug has no blocked tasks', async () => {
    // Create bug with no BLOCKED_BY relationships
    await neo4j.run(`
      CREATE (b:Bug {
        id: 'BR-BUG-006',
        title: 'Standalone bug',
        description: 'Not blocking anything',
        severity: 'low',
        status: 'open',
        foundBy: 'test-agent',
        created: datetime()
      })
    `);

    const result = await resolveBug('BR-BUG-006');

    expect(result.success).toBe(true);
    expect(result.unblockedTasks).toEqual([]);
  }, 10000);
});
