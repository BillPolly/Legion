/**
 * Progress Tracking Tests
 *
 * Tests for task progress reporting, status transitions, and artifact creation.
 * NO MOCKS for Neo4j - uses real database.
 */

import { getNeo4j } from '../src/neo4j.js';
import { initializeSchema } from '../src/schema.js';
import { reportProgress } from '../src/progress-tracking.js';

describe('Progress Tracking', () => {
  let neo4j;

  beforeAll(async () => {
    neo4j = await getNeo4j();
    await initializeSchema();

    // Clean up any existing test data first
    await neo4j.run('MATCH (n) WHERE n.id STARTS WITH "progress-test-" OR n.id STARTS WITH "PROG-TASK-" OR n.id STARTS WITH "PROG-" DETACH DELETE n');
    await neo4j.run('MATCH (a:Agent {name: "progress-test-agent"}) DETACH DELETE a');

    // Create test project and epic
    await neo4j.run(`
      CREATE (p:Project {id: 'progress-test-project', name: 'Progress Test Project', status: 'active', created: datetime(), updated: datetime()})
      CREATE (e:Epic {id: 'progress-test-epic', name: 'Progress Test Epic', description: 'Test Epic', status: 'pending', priority: 'high'})
      CREATE (p)-[:CONTAINS]->(e)
    `);

    // Create test agent
    await neo4j.run(`
      CREATE (a:Agent {
        name: 'progress-test-agent',
        type: 'developer',
        capabilities: ['coding'],
        status: 'idle',
        lastActive: datetime()
      })
    `);
  }, 30000);

  afterAll(async () => {
    // Clean up test data
    await neo4j.run('MATCH (n) WHERE n.id STARTS WITH "progress-test-" OR n.id STARTS WITH "PROG-TASK-" OR n.id STARTS WITH "PROG-" DETACH DELETE n');
    await neo4j.run('MATCH (a:Agent {name: "progress-test-agent"}) DETACH DELETE a');
  }, 30000);

  beforeEach(async () => {
    // Clean up test tasks and artifacts before each test
    await neo4j.run('MATCH (t:Task) WHERE t.id STARTS WITH "PROG-TASK-" DETACH DELETE t');
    await neo4j.run('MATCH (a:Artifact) WHERE a.id STARTS WITH "PROG-ART-" OR a.path STARTS WITH "progress-test/" DETACH DELETE a');
  }, 10000);

  test('Task transition: pending -> in_progress sets started timestamp', async () => {
    // Create pending task
    await neo4j.run(`
      MATCH (e:Epic {id: 'progress-test-epic'})
      CREATE (t:Task {
        id: 'PROG-TASK-001',
        name: 'Test task',
        description: 'Task to test status transition',
        status: 'pending',
        priority: 'high',
        requiredCapabilities: ['coding'],
        created: datetime(),
        updated: datetime()
      })
      CREATE (e)-[:HAS_TASK]->(t)
    `);

    const result = await reportProgress({
      agentName: 'progress-test-agent',
      taskId: 'PROG-TASK-001',
      status: 'in_progress'
    });

    expect(result.success).toBe(true);
    expect(result.previousStatus).toBe('pending');
    expect(result.newStatus).toBe('in_progress');

    // Verify in database
    const queryResult = await neo4j.run(
      'MATCH (t:Task {id: $id}) RETURN t',
      { id: 'PROG-TASK-001' }
    );

    const task = queryResult.records[0].get('t').properties;
    expect(task.status).toBe('in_progress');
    expect(task.started).toBeDefined();
    expect(task.assignedTo).toBe('progress-test-agent');
    expect(task.completed).toBeUndefined();
  }, 10000);

  test('Task transition: in_progress -> completed sets completed timestamp and clears assignment', async () => {
    // Create in_progress task
    await neo4j.run(`
      MATCH (e:Epic {id: 'progress-test-epic'})
      CREATE (t:Task {
        id: 'PROG-TASK-002',
        name: 'Active task',
        description: 'Task in progress',
        status: 'in_progress',
        assignedTo: 'progress-test-agent',
        priority: 'high',
        requiredCapabilities: ['coding'],
        created: datetime(),
        started: datetime(),
        updated: datetime()
      })
      CREATE (e)-[:HAS_TASK]->(t)
    `);

    const result = await reportProgress({
      agentName: 'progress-test-agent',
      taskId: 'PROG-TASK-002',
      status: 'completed'
    });

    expect(result.success).toBe(true);
    expect(result.previousStatus).toBe('in_progress');
    expect(result.newStatus).toBe('completed');

    // Verify in database
    const queryResult = await neo4j.run(
      'MATCH (t:Task {id: $id}) RETURN t',
      { id: 'PROG-TASK-002' }
    );

    const task = queryResult.records[0].get('t').properties;
    expect(task.status).toBe('completed');
    expect(task.completed).toBeDefined();
    expect(task.assignedTo).toBeUndefined(); // null in Neo4j = undefined in JS

    // Verify COMPLETED relationship created
    const relResult = await neo4j.run(`
      MATCH (a:Agent {name: 'progress-test-agent'})-[:COMPLETED]->(t:Task {id: 'PROG-TASK-002'})
      RETURN count(*) AS count
    `);
    expect(relResult.records[0].get('count').low).toBe(1);
  }, 10000);

  test('Task transition: in_progress -> failed sets failure state', async () => {
    // Create in_progress task
    await neo4j.run(`
      MATCH (e:Epic {id: 'progress-test-epic'})
      CREATE (t:Task {
        id: 'PROG-TASK-003',
        name: 'Task that will fail',
        description: 'Task to test failure',
        status: 'in_progress',
        assignedTo: 'progress-test-agent',
        priority: 'high',
        requiredCapabilities: ['coding'],
        created: datetime(),
        started: datetime(),
        updated: datetime()
      })
      CREATE (e)-[:HAS_TASK]->(t)
    `);

    const result = await reportProgress({
      agentName: 'progress-test-agent',
      taskId: 'PROG-TASK-003',
      status: 'failed',
      notes: 'Test execution failed due to environment issue'
    });

    expect(result.success).toBe(true);
    expect(result.previousStatus).toBe('in_progress');
    expect(result.newStatus).toBe('failed');

    // Verify in database
    const queryResult = await neo4j.run(
      'MATCH (t:Task {id: $id}) RETURN t',
      { id: 'PROG-TASK-003' }
    );

    const task = queryResult.records[0].get('t').properties;
    expect(task.status).toBe('failed');
    expect(task.assignedTo).toBeUndefined(); // null in Neo4j = undefined in JS
  }, 10000);

  test('Create artifacts linked to task', async () => {
    // Create completed task
    await neo4j.run(`
      MATCH (e:Epic {id: 'progress-test-epic'})
      CREATE (t:Task {
        id: 'PROG-TASK-004',
        name: 'Task with artifacts',
        description: 'Task that produces artifacts',
        status: 'in_progress',
        assignedTo: 'progress-test-agent',
        priority: 'high',
        requiredCapabilities: ['coding'],
        created: datetime(),
        started: datetime(),
        updated: datetime()
      })
      CREATE (e)-[:HAS_TASK]->(t)
    `);

    const result = await reportProgress({
      agentName: 'progress-test-agent',
      taskId: 'PROG-TASK-004',
      status: 'completed',
      artifacts: [
        { path: 'progress-test/report.md', type: 'report' },
        { path: 'progress-test/screenshot.png', type: 'screenshot', size: 12345 }
      ]
    });

    expect(result.success).toBe(true);
    expect(result.artifactsCreated).toBe(2);

    // Verify artifacts in database
    const artifactResult = await neo4j.run(`
      MATCH (t:Task {id: 'PROG-TASK-004'})-[:PRODUCES]->(a:Artifact)
      RETURN a
      ORDER BY a.path
    `);

    expect(artifactResult.records.length).toBe(2);

    const artifact1 = artifactResult.records[0].get('a').properties;
    expect(artifact1.path).toBe('progress-test/report.md');
    expect(artifact1.type).toBe('report');

    const artifact2 = artifactResult.records[1].get('a').properties;
    expect(artifact2.path).toBe('progress-test/screenshot.png');
    expect(artifact2.type).toBe('screenshot');
    expect(artifact2.size).toBe(12345);
  }, 10000);

  test('Completing task unblocks dependent tasks', async () => {
    // Create dependency chain: PROG-TASK-005 (in_progress) <- PROG-TASK-006 (pending)
    await neo4j.run(`
      MATCH (e:Epic {id: 'progress-test-epic'})
      CREATE (t1:Task {
        id: 'PROG-TASK-005',
        name: 'Blocking task',
        description: 'Must be done first',
        status: 'in_progress',
        assignedTo: 'progress-test-agent',
        priority: 'high',
        requiredCapabilities: ['coding'],
        created: datetime(),
        started: datetime(),
        updated: datetime()
      })
      CREATE (t2:Task {
        id: 'PROG-TASK-006',
        name: 'Dependent task',
        description: 'Depends on PROG-TASK-005',
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

    const result = await reportProgress({
      agentName: 'progress-test-agent',
      taskId: 'PROG-TASK-005',
      status: 'completed'
    });

    expect(result.success).toBe(true);
    expect(result.unblockedTasks).toContain('PROG-TASK-006');
  }, 10000);

  test('Completing task with multiple dependents only unblocks when all dependencies met', async () => {
    // Create complex dependency:
    // PROG-TASK-007 (completed) <- PROG-TASK-009 (pending)
    // PROG-TASK-008 (in_progress) <-/
    await neo4j.run(`
      MATCH (e:Epic {id: 'progress-test-epic'})
      CREATE (t1:Task {
        id: 'PROG-TASK-007',
        name: 'First dependency',
        description: 'Already done',
        status: 'completed',
        priority: 'high',
        requiredCapabilities: ['coding'],
        created: datetime(),
        started: datetime(),
        completed: datetime(),
        updated: datetime()
      })
      CREATE (t2:Task {
        id: 'PROG-TASK-008',
        name: 'Second dependency',
        description: 'Still in progress',
        status: 'in_progress',
        assignedTo: 'progress-test-agent',
        priority: 'high',
        requiredCapabilities: ['coding'],
        created: datetime(),
        started: datetime(),
        updated: datetime()
      })
      CREATE (t3:Task {
        id: 'PROG-TASK-009',
        name: 'Multi-dependent task',
        description: 'Needs both deps',
        status: 'pending',
        priority: 'high',
        requiredCapabilities: ['coding'],
        created: datetime(),
        updated: datetime()
      })
      CREATE (e)-[:HAS_TASK]->(t1)
      CREATE (e)-[:HAS_TASK]->(t2)
      CREATE (e)-[:HAS_TASK]->(t3)
      CREATE (t3)-[:DEPENDS_ON]->(t1)
      CREATE (t3)-[:DEPENDS_ON]->(t2)
    `);

    // Complete PROG-TASK-008
    const result = await reportProgress({
      agentName: 'progress-test-agent',
      taskId: 'PROG-TASK-008',
      status: 'completed'
    });

    expect(result.success).toBe(true);
    // Now that both dependencies are complete, PROG-TASK-009 should be unblocked
    expect(result.unblockedTasks).toContain('PROG-TASK-009');
  }, 10000);

  test('No tasks unblocked when completing task with no dependents', async () => {
    // Create standalone task
    await neo4j.run(`
      MATCH (e:Epic {id: 'progress-test-epic'})
      CREATE (t:Task {
        id: 'PROG-TASK-010',
        name: 'Standalone task',
        description: 'No dependents',
        status: 'in_progress',
        assignedTo: 'progress-test-agent',
        priority: 'high',
        requiredCapabilities: ['coding'],
        created: datetime(),
        started: datetime(),
        updated: datetime()
      })
      CREATE (e)-[:HAS_TASK]->(t)
    `);

    const result = await reportProgress({
      agentName: 'progress-test-agent',
      taskId: 'PROG-TASK-010',
      status: 'completed'
    });

    expect(result.success).toBe(true);
    expect(result.unblockedTasks).toEqual([]);
  }, 10000);
});
