/**
 * Get Next Task Integration Tests
 *
 * Tests for the complete getNextTask logic that combines:
 * - Dependency resolution
 * - Blocker detection
 * - Capability matching
 * - Priority sorting
 *
 * NO MOCKS for Neo4j - uses real database.
 */

import { getNeo4j } from '../src/neo4j.js';
import { initializeSchema } from '../src/schema.js';
import { getNextTask } from '../src/get-next-task.js';

describe('Get Next Task Integration', () => {
  let neo4j;

  beforeAll(async () => {
    neo4j = await getNeo4j();
    await initializeSchema();

    // Create test project and epic
    await neo4j.run(`
      CREATE (p:Project {id: 'gnt-test-project', name: 'GNT Test Project', status: 'active', created: datetime(), updated: datetime()})
      CREATE (e:Epic {id: 'gnt-test-epic', name: 'GNT Test Epic', description: 'Test Epic', status: 'pending', priority: 'high'})
      CREATE (p)-[:CONTAINS]->(e)
    `);

    // Create test agent with specific capabilities
    await neo4j.run(`
      CREATE (a:Agent {
        name: 'gnt-test-agent',
        type: 'developer',
        capabilities: ['coding', 'testing'],
        status: 'idle',
        lastActive: datetime()
      })
    `);
  }, 30000);

  afterAll(async () => {
    // Clean up test data
    await neo4j.run('MATCH (n) WHERE n.id STARTS WITH "gnt-test-" OR n.id STARTS WITH "GNT-TASK-" OR n.id STARTS WITH "GNT-BUG-" DETACH DELETE n');
    await neo4j.run('MATCH (a:Agent {name: "gnt-test-agent"}) DETACH DELETE a');
  }, 30000);

  beforeEach(async () => {
    // Clean up test tasks and bugs before each test
    await neo4j.run('MATCH (t:Task) WHERE t.id STARTS WITH "GNT-TASK-" DETACH DELETE t');
    await neo4j.run('MATCH (b:Bug) WHERE b.id STARTS WITH "GNT-BUG-" DETACH DELETE b');
  }, 10000);

  test('Returns simple pending task with matching capabilities', async () => {
    // Create a simple pending task
    await neo4j.run(`
      MATCH (e:Epic {id: 'gnt-test-epic'})
      CREATE (t:Task {
        id: 'GNT-TASK-001',
        name: 'Simple task',
        description: 'Easy coding task',
        status: 'pending',
        priority: 'high',
        requiredCapabilities: ['coding'],
        created: datetime(),
        updated: datetime()
      })
      CREATE (e)-[:HAS_TASK]->(t)
    `);

    const result = await getNextTask('gnt-test-agent');

    expect(result.taskId).toBe('GNT-TASK-001');
    expect(result.taskName).toBe('Simple task');
    expect(result.priority).toBe('high');
  }, 10000);

  test('Returns null when no pending tasks exist', async () => {
    // No tasks created
    const result = await getNextTask('gnt-test-agent');

    expect(result).toBeNull();
  }, 10000);

  test('Skips tasks with incomplete dependencies', async () => {
    // Create task chain: GNT-TASK-002 (pending) <- GNT-TASK-003 (pending)
    await neo4j.run(`
      MATCH (e:Epic {id: 'gnt-test-epic'})
      CREATE (t1:Task {
        id: 'GNT-TASK-002',
        name: 'Dependency task',
        description: 'Must be done first',
        status: 'pending',
        priority: 'high',
        requiredCapabilities: ['coding'],
        created: datetime(),
        updated: datetime()
      })
      CREATE (t2:Task {
        id: 'GNT-TASK-003',
        name: 'Blocked by dependency',
        description: 'Depends on GNT-TASK-002',
        status: 'pending',
        priority: 'critical',
        requiredCapabilities: ['coding'],
        created: datetime(),
        updated: datetime()
      })
      CREATE (e)-[:HAS_TASK]->(t1)
      CREATE (e)-[:HAS_TASK]->(t2)
      CREATE (t2)-[:DEPENDS_ON]->(t1)
    `);

    const result = await getNextTask('gnt-test-agent');

    // Should return GNT-TASK-002, not GNT-TASK-003 (even though 003 has higher priority)
    expect(result.taskId).toBe('GNT-TASK-002');
  }, 10000);

  test('Skips tasks blocked by open bugs', async () => {
    // Create task blocked by bug, and unblocked task
    await neo4j.run(`
      MATCH (e:Epic {id: 'gnt-test-epic'})
      CREATE (t1:Task {
        id: 'GNT-TASK-004',
        name: 'Blocked task',
        description: 'Has open bug',
        status: 'pending',
        priority: 'critical',
        requiredCapabilities: ['coding'],
        created: datetime(),
        updated: datetime()
      })
      CREATE (t2:Task {
        id: 'GNT-TASK-005',
        name: 'Clean task',
        description: 'No bugs',
        status: 'pending',
        priority: 'medium',
        requiredCapabilities: ['coding'],
        created: datetime(),
        updated: datetime()
      })
      CREATE (bug:Bug {
        id: 'GNT-BUG-001',
        title: 'Blocker',
        description: 'Blocks task',
        severity: 'high',
        status: 'open',
        foundBy: 'gnt-test-agent',
        created: datetime()
      })
      CREATE (e)-[:HAS_TASK]->(t1)
      CREATE (e)-[:HAS_TASK]->(t2)
      CREATE (t1)-[:BLOCKED_BY]->(bug)
    `);

    const result = await getNextTask('gnt-test-agent');

    // Should return GNT-TASK-005, not GNT-TASK-004 (even though 004 has higher priority)
    expect(result.taskId).toBe('GNT-TASK-005');
  }, 10000);

  test('Skips tasks requiring capabilities agent does not have', async () => {
    // Create task requiring documentation (which agent lacks)
    await neo4j.run(`
      MATCH (e:Epic {id: 'gnt-test-epic'})
      CREATE (t1:Task {
        id: 'GNT-TASK-006',
        name: 'Documentation task',
        description: 'Needs docs skill',
        status: 'pending',
        priority: 'high',
        requiredCapabilities: ['documentation'],
        created: datetime(),
        updated: datetime()
      })
      CREATE (t2:Task {
        id: 'GNT-TASK-007',
        name: 'Coding task',
        description: 'Needs coding skill',
        status: 'pending',
        priority: 'medium',
        requiredCapabilities: ['coding'],
        created: datetime(),
        updated: datetime()
      })
      CREATE (e)-[:HAS_TASK]->(t1)
      CREATE (e)-[:HAS_TASK]->(t2)
    `);

    const result = await getNextTask('gnt-test-agent');

    // Should return GNT-TASK-007, not GNT-TASK-006 (agent has coding, not documentation)
    expect(result.taskId).toBe('GNT-TASK-007');
  }, 10000);

  test('Returns highest priority task when multiple are available', async () => {
    // Create multiple eligible tasks with different priorities
    await neo4j.run(`
      MATCH (e:Epic {id: 'gnt-test-epic'})
      CREATE (t1:Task {
        id: 'GNT-TASK-008',
        name: 'Low priority',
        description: 'Can wait',
        status: 'pending',
        priority: 'low',
        requiredCapabilities: ['coding'],
        created: datetime(),
        updated: datetime()
      })
      CREATE (t2:Task {
        id: 'GNT-TASK-009',
        name: 'Critical priority',
        description: 'Do this first',
        status: 'pending',
        priority: 'critical',
        requiredCapabilities: ['coding'],
        created: datetime(),
        updated: datetime()
      })
      CREATE (t3:Task {
        id: 'GNT-TASK-010',
        name: 'Medium priority',
        description: 'Do this second',
        status: 'pending',
        priority: 'medium',
        requiredCapabilities: ['coding'],
        created: datetime(),
        updated: datetime()
      })
      CREATE (e)-[:HAS_TASK]->(t1)
      CREATE (e)-[:HAS_TASK]->(t2)
      CREATE (e)-[:HAS_TASK]->(t3)
    `);

    const result = await getNextTask('gnt-test-agent');

    // Should return GNT-TASK-009 (critical priority)
    expect(result.taskId).toBe('GNT-TASK-009');
    expect(result.priority).toBe('critical');
  }, 10000);

  test('Returns task when dependencies are completed', async () => {
    // Create task chain: GNT-TASK-011 (completed) <- GNT-TASK-012 (pending)
    await neo4j.run(`
      MATCH (e:Epic {id: 'gnt-test-epic'})
      CREATE (t1:Task {
        id: 'GNT-TASK-011',
        name: 'Completed dependency',
        description: 'Already done',
        status: 'completed',
        priority: 'high',
        requiredCapabilities: ['coding'],
        created: datetime(),
        updated: datetime()
      })
      CREATE (t2:Task {
        id: 'GNT-TASK-012',
        name: 'Now available',
        description: 'Deps are done',
        status: 'pending',
        priority: 'high',
        requiredCapabilities: ['coding'],
        created: datetime(),
        updated: datetime()
      })
      CREATE (e)-[:HAS_TASK]->(t1)
      CREATE (e)-[:HAS_TASK]->(t2)
      CREATE (t2)-[:DEPENDS_ON]->(t1)
    `);

    const result = await getNextTask('gnt-test-agent');

    // Should return GNT-TASK-012 because GNT-TASK-011 is completed
    expect(result.taskId).toBe('GNT-TASK-012');
  }, 10000);

  test('Complex scenario: multiple constraints', async () => {
    // Create complex scenario with multiple tasks and constraints
    await neo4j.run(`
      MATCH (e:Epic {id: 'gnt-test-epic'})

      // Task A - blocked by bug (should NOT be returned)
      CREATE (tA:Task {
        id: 'GNT-TASK-A',
        name: 'Task A - Blocked',
        description: 'Blocked by bug',
        status: 'pending',
        priority: 'critical',
        requiredCapabilities: ['coding'],
        created: datetime(),
        updated: datetime()
      })

      // Task B - wrong capabilities (should NOT be returned)
      CREATE (tB:Task {
        id: 'GNT-TASK-B',
        name: 'Task B - Wrong caps',
        description: 'Needs documentation',
        status: 'pending',
        priority: 'high',
        requiredCapabilities: ['documentation'],
        created: datetime(),
        updated: datetime()
      })

      // Task C - incomplete dependency (should NOT be returned)
      CREATE (tC:Task {
        id: 'GNT-TASK-C',
        name: 'Task C - Incomplete dep',
        description: 'Dependency not done',
        status: 'pending',
        priority: 'high',
        requiredCapabilities: ['coding'],
        created: datetime(),
        updated: datetime()
      })
      CREATE (tC_dep:Task {
        id: 'GNT-TASK-C-DEP',
        name: 'Task C dependency',
        description: 'Not done yet',
        status: 'in_progress',
        priority: 'high',
        requiredCapabilities: ['coding'],
        created: datetime(),
        updated: datetime()
      })

      // Task D - all good! (SHOULD be returned)
      CREATE (tD:Task {
        id: 'GNT-TASK-D',
        name: 'Task D - Available',
        description: 'Ready to go',
        status: 'pending',
        priority: 'medium',
        requiredCapabilities: ['coding'],
        created: datetime(),
        updated: datetime()
      })

      // Bug blocking Task A
      CREATE (bug:Bug {
        id: 'GNT-BUG-A',
        title: 'Blocker for A',
        description: 'Blocks A',
        severity: 'high',
        status: 'open',
        foundBy: 'gnt-test-agent',
        created: datetime()
      })

      CREATE (e)-[:HAS_TASK]->(tA)
      CREATE (e)-[:HAS_TASK]->(tB)
      CREATE (e)-[:HAS_TASK]->(tC)
      CREATE (e)-[:HAS_TASK]->(tC_dep)
      CREATE (e)-[:HAS_TASK]->(tD)
      CREATE (tA)-[:BLOCKED_BY]->(bug)
      CREATE (tC)-[:DEPENDS_ON]->(tC_dep)
    `);

    const result = await getNextTask('gnt-test-agent');

    // Should return GNT-TASK-D - the only task that passes all checks
    expect(result.taskId).toBe('GNT-TASK-D');
    expect(result.taskName).toBe('Task D - Available');
  }, 10000);
});
