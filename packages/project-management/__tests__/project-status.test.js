/**
 * Project Status Query Tests
 *
 * Tests for project status aggregation and metrics.
 * NO MOCKS for Neo4j - uses real database.
 */

import { getNeo4j } from '../src/neo4j.js';
import { initializeSchema } from '../src/schema.js';
import { getProjectStatus } from '../src/project-status.js';

describe('Project Status Queries', () => {
  let neo4j;

  beforeAll(async () => {
    neo4j = await getNeo4j();
    await initializeSchema();

    // Clean up any existing test data first
    await neo4j.run('MATCH (n) WHERE n.id STARTS WITH "proj-stat-" OR n.id STARTS WITH "PS-" DETACH DELETE n');

    // Create comprehensive test project structure
    await neo4j.run(`
      // Project
      CREATE (p:Project {
        id: 'proj-stat-test',
        name: 'Status Test Project',
        description: 'Test project for status queries',
        status: 'active',
        created: datetime(),
        updated: datetime()
      })

      // Epics
      CREATE (e1:Epic {
        id: 'PS-EPIC-001',
        name: 'Epic 1',
        description: 'First epic',
        status: 'completed',
        priority: 'high'
      })
      CREATE (e2:Epic {
        id: 'PS-EPIC-002',
        name: 'Epic 2',
        description: 'Second epic',
        status: 'in_progress',
        priority: 'high'
      })
      CREATE (e3:Epic {
        id: 'PS-EPIC-003',
        name: 'Epic 3',
        description: 'Third epic',
        status: 'pending',
        priority: 'medium'
      })

      CREATE (p)-[:CONTAINS]->(e1)
      CREATE (p)-[:CONTAINS]->(e2)
      CREATE (p)-[:CONTAINS]->(e3)

      // Tasks for Epic 1 (completed)
      CREATE (t1:Task {
        id: 'PS-TASK-001',
        name: 'Task 1',
        description: 'Completed task',
        status: 'completed',
        priority: 'high',
        requiredCapabilities: [],
        created: datetime(),
        started: datetime(),
        completed: datetime(),
        updated: datetime()
      })
      CREATE (t2:Task {
        id: 'PS-TASK-002',
        name: 'Task 2',
        description: 'Completed task',
        status: 'completed',
        priority: 'high',
        requiredCapabilities: [],
        created: datetime(),
        started: datetime(),
        completed: datetime(),
        updated: datetime()
      })
      CREATE (e1)-[:HAS_TASK]->(t1)
      CREATE (e1)-[:HAS_TASK]->(t2)

      // Tasks for Epic 2 (mixed)
      CREATE (t3:Task {
        id: 'PS-TASK-003',
        name: 'Task 3',
        description: 'Pending task',
        status: 'pending',
        priority: 'high',
        requiredCapabilities: [],
        created: datetime(),
        updated: datetime()
      })
      CREATE (t4:Task {
        id: 'PS-TASK-004',
        name: 'Task 4',
        description: 'In progress task',
        status: 'in_progress',
        priority: 'high',
        requiredCapabilities: [],
        created: datetime(),
        started: datetime(),
        updated: datetime()
      })
      CREATE (t5:Task {
        id: 'PS-TASK-005',
        name: 'Task 5',
        description: 'Blocked task',
        status: 'blocked',
        priority: 'medium',
        requiredCapabilities: [],
        created: datetime(),
        updated: datetime()
      })
      CREATE (e2)-[:HAS_TASK]->(t3)
      CREATE (e2)-[:HAS_TASK]->(t4)
      CREATE (e2)-[:HAS_TASK]->(t5)

      // Tasks for Epic 3 (all pending)
      CREATE (t6:Task {
        id: 'PS-TASK-006',
        name: 'Task 6',
        description: 'Pending task',
        status: 'pending',
        priority: 'low',
        requiredCapabilities: [],
        created: datetime(),
        updated: datetime()
      })
      CREATE (t7:Task {
        id: 'PS-TASK-007',
        name: 'Task 7',
        description: 'Pending task',
        status: 'pending',
        priority: 'low',
        requiredCapabilities: [],
        created: datetime(),
        updated: datetime()
      })
      CREATE (e3)-[:HAS_TASK]->(t6)
      CREATE (e3)-[:HAS_TASK]->(t7)

      // Bugs
      CREATE (b1:Bug {
        id: 'PS-BUG-001',
        title: 'Critical bug',
        description: 'Open critical bug',
        severity: 'critical',
        status: 'open',
        foundBy: 'test-agent',
        created: datetime()
      })
      CREATE (b2:Bug {
        id: 'PS-BUG-002',
        title: 'Fixed bug',
        description: 'Already fixed',
        severity: 'high',
        status: 'fixed',
        foundBy: 'test-agent',
        created: datetime(),
        resolved: datetime()
      })
      CREATE (t5)-[:BLOCKED_BY]->(b1)
      CREATE (t5)-[:BLOCKED_BY]->(b2)
    `);
  }, 30000);

  afterAll(async () => {
    // Clean up test data
    await neo4j.run('MATCH (n) WHERE n.id STARTS WITH "proj-stat-" OR n.id STARTS WITH "PS-" DETACH DELETE n');
  }, 30000);

  test('Get complete project status with all metrics', async () => {
    const status = await getProjectStatus('proj-stat-test');

    expect(status.projectId).toBe('proj-stat-test');
    expect(status.projectName).toBe('Status Test Project');
    expect(status.status).toBe('active');

    // Epic stats
    expect(status.epics.total).toBe(3);
    expect(status.epics.completed).toBe(1);
    expect(status.epics.inProgress).toBe(1);
    expect(status.epics.pending).toBe(1);

    // Task stats
    expect(status.tasks.total).toBe(7);
    expect(status.tasks.pending).toBe(3); // PS-TASK-003, 006, 007
    expect(status.tasks.inProgress).toBe(1); // PS-TASK-004
    expect(status.tasks.blocked).toBe(1); // PS-TASK-005
    expect(status.tasks.completed).toBe(2); // PS-TASK-001, 002

    // Bug stats
    expect(status.bugs.total).toBe(2);
    expect(status.bugs.open).toBe(1);
    expect(status.bugs.critical).toBe(1);

    // Progress calculation
    // 2 completed out of 7 total = 28.57%
    expect(status.progress).toBeCloseTo(28.57, 1);
  }, 10000);

  test('Empty project returns zero stats', async () => {
    // Create empty project
    await neo4j.run(`
      CREATE (p:Project {
        id: 'PS-EMPTY',
        name: 'Empty Project',
        status: 'active',
        created: datetime(),
        updated: datetime()
      })
    `);

    const status = await getProjectStatus('PS-EMPTY');

    expect(status.projectId).toBe('PS-EMPTY');
    expect(status.epics.total).toBe(0);
    expect(status.tasks.total).toBe(0);
    expect(status.bugs.total).toBe(0);
    expect(status.progress).toBe(0);

    // Clean up
    await neo4j.run('MATCH (p:Project {id: "PS-EMPTY"}) DETACH DELETE p');
  }, 10000);

  test('Task statistics grouped by status', async () => {
    const status = await getProjectStatus('proj-stat-test');

    // Verify each status count
    expect(status.tasks.pending).toBe(3);
    expect(status.tasks.inProgress).toBe(1);
    expect(status.tasks.blocked).toBe(1);
    expect(status.tasks.completed).toBe(2);
    expect(status.tasks.failed || 0).toBe(0);

    // Sum should equal total
    const sum = status.tasks.pending + status.tasks.inProgress +
                status.tasks.blocked + status.tasks.completed + (status.tasks.failed || 0);
    expect(sum).toBe(status.tasks.total);
  }, 10000);

  test('Bug statistics by severity and status', async () => {
    const status = await getProjectStatus('proj-stat-test');

    expect(status.bugs.total).toBe(2);
    expect(status.bugs.open).toBe(1);
    expect(status.bugs.critical).toBe(1);
  }, 10000);

  test('Progress percentage calculated correctly', async () => {
    const status = await getProjectStatus('proj-stat-test');

    const expectedProgress = (status.tasks.completed / status.tasks.total) * 100;
    expect(status.progress).toBeCloseTo(expectedProgress, 2);
  }, 10000);
});
