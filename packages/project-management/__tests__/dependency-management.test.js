/**
 * Dependency Management Tests
 *
 * Tests for task dependency operations.
 * NO MOCKS for Neo4j - uses real database.
 */

import { getNeo4j } from '../src/neo4j.js';
import { initializeSchema } from '../src/schema.js';
import {
  createTaskWithDependencies,
  getDependencies,
  getDependentTasks,
  detectCircularDependencies
} from '../src/dependency-management.js';

describe('Dependency Management', () => {
  let neo4j;

  beforeAll(async () => {
    neo4j = await getNeo4j();
    await initializeSchema();

    // Create test epic for tasks
    await neo4j.run(`
      CREATE (p:Project {id: 'dep-test-project', name: 'Dep Test Project', status: 'active', created: datetime(), updated: datetime()})
      CREATE (e:Epic {id: 'dep-test-epic', name: 'Dep Test Epic', description: 'Test Epic', status: 'pending', priority: 'high'})
      CREATE (p)-[:CONTAINS]->(e)
    `);
  }, 30000);

  afterAll(async () => {
    // Clean up test data
    await neo4j.run('MATCH (n) WHERE n.id STARTS WITH "dep-test-" OR n.id STARTS WITH "DEP-" DETACH DELETE n');
  }, 30000);

  beforeEach(async () => {
    // Clean up test tasks before each test
    await neo4j.run('MATCH (t:Task) WHERE t.id STARTS WITH "DEP-" DETACH DELETE t');
  }, 10000);

  test('Create task with dependencies', async () => {
    // Create dependency tasks first
    await neo4j.run(`
      MATCH (e:Epic {id: 'dep-test-epic'})
      CREATE (t1:Task {
        id: 'DEP-001',
        name: 'Task 1',
        description: 'First task',
        status: 'completed',
        priority: 'high',
        requiredCapabilities: [],
        created: datetime(),
        updated: datetime()
      })
      CREATE (t2:Task {
        id: 'DEP-002',
        name: 'Task 2',
        description: 'Second task',
        status: 'completed',
        priority: 'high',
        requiredCapabilities: [],
        created: datetime(),
        updated: datetime()
      })
      CREATE (e)-[:HAS_TASK]->(t1)
      CREATE (e)-[:HAS_TASK]->(t2)
    `);

    // Create task with dependencies
    const result = await createTaskWithDependencies({
      taskId: 'DEP-003',
      name: 'Task 3',
      description: 'Third task with dependencies',
      priority: 'high',
      epicId: 'dep-test-epic',
      dependencies: ['DEP-001', 'DEP-002']
    });

    expect(result.taskId).toBe('DEP-003');
    expect(result.dependenciesCreated).toBe(2);

    // Verify dependencies in database
    const queryResult = await neo4j.run(`
      MATCH (t:Task {id: 'DEP-003'})-[:DEPENDS_ON]->(dep:Task)
      RETURN dep.id AS depId
      ORDER BY depId
    `);

    expect(queryResult.records.length).toBe(2);
    const depIds = queryResult.records.map(r => r.get('depId'));
    expect(depIds).toContain('DEP-001');
    expect(depIds).toContain('DEP-002');
  }, 10000);

  test('Find task dependencies', async () => {
    // Create tasks with dependencies
    await neo4j.run(`
      MATCH (e:Epic {id: 'dep-test-epic'})
      CREATE (t1:Task {
        id: 'DEP-004',
        name: 'Task 4',
        description: 'Task 4',
        status: 'completed',
        priority: 'high',
        requiredCapabilities: [],
        created: datetime(),
        updated: datetime()
      })
      CREATE (t2:Task {
        id: 'DEP-005',
        name: 'Task 5',
        description: 'Task 5',
        status: 'completed',
        priority: 'high',
        requiredCapabilities: [],
        created: datetime(),
        updated: datetime()
      })
      CREATE (t3:Task {
        id: 'DEP-006',
        name: 'Task 6',
        description: 'Task 6',
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

    const dependencies = await getDependencies('DEP-006');

    expect(dependencies.length).toBe(2);
    const depIds = dependencies.map(d => d.id);
    expect(depIds).toContain('DEP-004');
    expect(depIds).toContain('DEP-005');
  }, 10000);

  test('Find dependent tasks', async () => {
    // Create tasks with dependencies
    await neo4j.run(`
      MATCH (e:Epic {id: 'dep-test-epic'})
      CREATE (t1:Task {
        id: 'DEP-007',
        name: 'Task 7',
        description: 'Task 7',
        status: 'completed',
        priority: 'high',
        requiredCapabilities: [],
        created: datetime(),
        updated: datetime()
      })
      CREATE (t2:Task {
        id: 'DEP-008',
        name: 'Task 8',
        description: 'Task 8',
        status: 'pending',
        priority: 'high',
        requiredCapabilities: [],
        created: datetime(),
        updated: datetime()
      })
      CREATE (t3:Task {
        id: 'DEP-009',
        name: 'Task 9',
        description: 'Task 9',
        status: 'pending',
        priority: 'high',
        requiredCapabilities: [],
        created: datetime(),
        updated: datetime()
      })
      CREATE (e)-[:HAS_TASK]->(t1)
      CREATE (e)-[:HAS_TASK]->(t2)
      CREATE (e)-[:HAS_TASK]->(t3)
      CREATE (t2)-[:DEPENDS_ON]->(t1)
      CREATE (t3)-[:DEPENDS_ON]->(t1)
    `);

    const dependentTasks = await getDependentTasks('DEP-007');

    expect(dependentTasks.length).toBe(2);
    const depIds = dependentTasks.map(d => d.id);
    expect(depIds).toContain('DEP-008');
    expect(depIds).toContain('DEP-009');
  }, 10000);

  test('Validate circular dependency detection', async () => {
    // Create tasks
    await neo4j.run(`
      MATCH (e:Epic {id: 'dep-test-epic'})
      CREATE (t1:Task {
        id: 'DEP-010',
        name: 'Task 10',
        description: 'Task 10',
        status: 'pending',
        priority: 'high',
        requiredCapabilities: [],
        created: datetime(),
        updated: datetime()
      })
      CREATE (t2:Task {
        id: 'DEP-011',
        name: 'Task 11',
        description: 'Task 11',
        status: 'pending',
        priority: 'high',
        requiredCapabilities: [],
        created: datetime(),
        updated: datetime()
      })
      CREATE (t3:Task {
        id: 'DEP-012',
        name: 'Task 12',
        description: 'Task 12',
        status: 'pending',
        priority: 'high',
        requiredCapabilities: [],
        created: datetime(),
        updated: datetime()
      })
      CREATE (e)-[:HAS_TASK]->(t1)
      CREATE (e)-[:HAS_TASK]->(t2)
      CREATE (e)-[:HAS_TASK]->(t3)
      CREATE (t1)-[:DEPENDS_ON]->(t2)
      CREATE (t2)-[:DEPENDS_ON]->(t3)
    `);

    // Trying to create DEP-012 -> DEP-010 would create a cycle: DEP-010 -> DEP-011 -> DEP-012 -> DEP-010
    const result = await detectCircularDependencies('DEP-012', ['DEP-010']);

    expect(result.hasCircularDependency).toBe(true);
    expect(result.cycle).toBeDefined();
    expect(result.cycle.length).toBeGreaterThan(0);
  }, 10000);

  test('No circular dependency for valid graph', async () => {
    // Create tasks
    await neo4j.run(`
      MATCH (e:Epic {id: 'dep-test-epic'})
      CREATE (t1:Task {
        id: 'DEP-013',
        name: 'Task 13',
        description: 'Task 13',
        status: 'completed',
        priority: 'high',
        requiredCapabilities: [],
        created: datetime(),
        updated: datetime()
      })
      CREATE (t2:Task {
        id: 'DEP-014',
        name: 'Task 14',
        description: 'Task 14',
        status: 'pending',
        priority: 'high',
        requiredCapabilities: [],
        created: datetime(),
        updated: datetime()
      })
      CREATE (e)-[:HAS_TASK]->(t1)
      CREATE (e)-[:HAS_TASK]->(t2)
    `);

    // DEP-014 -> DEP-013 is a valid DAG (no cycle)
    const result = await detectCircularDependencies('DEP-014', ['DEP-013']);

    expect(result.hasCircularDependency).toBe(false);
    expect(result.cycle).toBeNull();
  }, 10000);
});
