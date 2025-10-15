/**
 * Dependency Resolution Tests
 *
 * Tests for task dependency resolution logic.
 * NO MOCKS for Neo4j - uses real database.
 */

import { getNeo4j } from '../src/neo4j.js';
import { initializeSchema } from '../src/schema.js';
import { checkDependenciesResolved } from '../src/dependency-resolution.js';

describe('Dependency Resolution', () => {
  let neo4j;

  beforeAll(async () => {
    neo4j = await getNeo4j();
    await initializeSchema();

    // Create test project and epic
    await neo4j.run(`
      CREATE (p:Project {id: 'dep-test-project', name: 'Dependency Test Project', status: 'active', created: datetime(), updated: datetime()})
      CREATE (e:Epic {id: 'dep-test-epic', name: 'Dependency Test Epic', description: 'Test Epic', status: 'pending', priority: 'high'})
      CREATE (p)-[:CONTAINS]->(e)
    `);
  }, 30000);

  afterAll(async () => {
    // Clean up test data
    await neo4j.run('MATCH (n) WHERE n.id STARTS WITH "dep-test-" OR n.id STARTS WITH "DEP-TASK-" DETACH DELETE n');
  }, 30000);

  beforeEach(async () => {
    // Clean up test tasks before each test
    await neo4j.run('MATCH (t:Task) WHERE t.id STARTS WITH "DEP-TASK-" DETACH DELETE t');
  }, 10000);

  test('Task with no dependencies is available', async () => {
    // Create task with no dependencies
    await neo4j.run(`
      MATCH (e:Epic {id: 'dep-test-epic'})
      CREATE (t:Task {
        id: 'DEP-TASK-001',
        name: 'Independent task',
        description: 'Task with no dependencies',
        status: 'pending',
        priority: 'high',
        requiredCapabilities: [],
        created: datetime(),
        updated: datetime()
      })
      CREATE (e)-[:HAS_TASK]->(t)
    `);

    const result = await checkDependenciesResolved('DEP-TASK-001');

    expect(result.resolved).toBe(true);
    expect(result.unresolvedDependencies).toEqual([]);
  }, 10000);

  test('Task with completed dependencies is available', async () => {
    // Create dependency chain: DEP-TASK-002 (completed) <- DEP-TASK-003 (pending)
    await neo4j.run(`
      MATCH (e:Epic {id: 'dep-test-epic'})
      CREATE (t1:Task {
        id: 'DEP-TASK-002',
        name: 'Completed dependency',
        description: 'This task is done',
        status: 'completed',
        priority: 'high',
        requiredCapabilities: [],
        created: datetime(),
        updated: datetime()
      })
      CREATE (t2:Task {
        id: 'DEP-TASK-003',
        name: 'Dependent task',
        description: 'Depends on DEP-TASK-002',
        status: 'pending',
        priority: 'high',
        requiredCapabilities: [],
        created: datetime(),
        updated: datetime()
      })
      CREATE (e)-[:HAS_TASK]->(t1)
      CREATE (e)-[:HAS_TASK]->(t2)
      CREATE (t2)-[:DEPENDS_ON]->(t1)
    `);

    const result = await checkDependenciesResolved('DEP-TASK-003');

    expect(result.resolved).toBe(true);
    expect(result.unresolvedDependencies).toEqual([]);
  }, 10000);

  test('Task with incomplete dependencies is NOT available', async () => {
    // Create dependency chain: DEP-TASK-004 (pending) <- DEP-TASK-005 (pending)
    await neo4j.run(`
      MATCH (e:Epic {id: 'dep-test-epic'})
      CREATE (t1:Task {
        id: 'DEP-TASK-004',
        name: 'Incomplete dependency',
        description: 'This task is not done',
        status: 'pending',
        priority: 'high',
        requiredCapabilities: [],
        created: datetime(),
        updated: datetime()
      })
      CREATE (t2:Task {
        id: 'DEP-TASK-005',
        name: 'Blocked task',
        description: 'Depends on DEP-TASK-004',
        status: 'pending',
        priority: 'high',
        requiredCapabilities: [],
        created: datetime(),
        updated: datetime()
      })
      CREATE (e)-[:HAS_TASK]->(t1)
      CREATE (e)-[:HAS_TASK]->(t2)
      CREATE (t2)-[:DEPENDS_ON]->(t1)
    `);

    const result = await checkDependenciesResolved('DEP-TASK-005');

    expect(result.resolved).toBe(false);
    expect(result.unresolvedDependencies.length).toBe(1);
    expect(result.unresolvedDependencies[0].id).toBe('DEP-TASK-004');
    expect(result.unresolvedDependencies[0].status).toBe('pending');
  }, 10000);

  test('Task with multiple dependencies - some incomplete', async () => {
    // Create dependency chain:
    // DEP-TASK-006 (completed) <- DEP-TASK-008 (pending)
    // DEP-TASK-007 (pending)   <-/
    await neo4j.run(`
      MATCH (e:Epic {id: 'dep-test-epic'})
      CREATE (t1:Task {
        id: 'DEP-TASK-006',
        name: 'Completed dependency',
        description: 'This task is done',
        status: 'completed',
        priority: 'high',
        requiredCapabilities: [],
        created: datetime(),
        updated: datetime()
      })
      CREATE (t2:Task {
        id: 'DEP-TASK-007',
        name: 'Incomplete dependency',
        description: 'This task is not done',
        status: 'in_progress',
        priority: 'high',
        requiredCapabilities: [],
        created: datetime(),
        updated: datetime()
      })
      CREATE (t3:Task {
        id: 'DEP-TASK-008',
        name: 'Blocked task',
        description: 'Depends on both',
        status: 'pending',
        priority: 'high',
        requiredCapabilities: [],
        created: datetime(),
        updated: datetime()
      })
      CREATE (e)-[:HAS_TASK]->(t1)
      CREATE (e)-[:HAS_TASK]->(t2)
      CREATE (e)-[:HAS_TASK]->(t3)
      CREATE (t3)-[:DEPENDS_ON]->(t1)
      CREATE (t3)-[:DEPENDS_ON]->(t2)
    `);

    const result = await checkDependenciesResolved('DEP-TASK-008');

    expect(result.resolved).toBe(false);
    expect(result.unresolvedDependencies.length).toBe(1);
    expect(result.unresolvedDependencies[0].id).toBe('DEP-TASK-007');
    expect(result.unresolvedDependencies[0].status).toBe('in_progress');
  }, 10000);

  test('Task with multiple completed dependencies is available', async () => {
    // Create dependency chain - all completed:
    // DEP-TASK-009 (completed) <- DEP-TASK-011 (pending)
    // DEP-TASK-010 (completed) <-/
    await neo4j.run(`
      MATCH (e:Epic {id: 'dep-test-epic'})
      CREATE (t1:Task {
        id: 'DEP-TASK-009',
        name: 'Completed dependency 1',
        description: 'Done',
        status: 'completed',
        priority: 'high',
        requiredCapabilities: [],
        created: datetime(),
        updated: datetime()
      })
      CREATE (t2:Task {
        id: 'DEP-TASK-010',
        name: 'Completed dependency 2',
        description: 'Done',
        status: 'completed',
        priority: 'high',
        requiredCapabilities: [],
        created: datetime(),
        updated: datetime()
      })
      CREATE (t3:Task {
        id: 'DEP-TASK-011',
        name: 'Ready task',
        description: 'All deps done',
        status: 'pending',
        priority: 'high',
        requiredCapabilities: [],
        created: datetime(),
        updated: datetime()
      })
      CREATE (e)-[:HAS_TASK]->(t1)
      CREATE (e)-[:HAS_TASK]->(t2)
      CREATE (e)-[:HAS_TASK]->(t3)
      CREATE (t3)-[:DEPENDS_ON]->(t1)
      CREATE (t3)-[:DEPENDS_ON]->(t2)
    `);

    const result = await checkDependenciesResolved('DEP-TASK-011');

    expect(result.resolved).toBe(true);
    expect(result.unresolvedDependencies).toEqual([]);
  }, 10000);
});
