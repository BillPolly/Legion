/**
 * E2E Test: Complete UAT Workflow
 *
 * Tests the complete workflow from DESIGN.md Example 1:
 * 1. Orchestrator gets next task
 * 2. Integration Tester starts work
 * 3. Integration Tester completes task with artifacts
 * 4. Dependent task gets unblocked
 * 5. Next task assigned
 *
 * NO MOCKS - real Neo4j, real MCP operations
 */

import { getNeo4j } from '../src/neo4j.js';
import { initializeSchema } from '../src/schema.js';
import { getNextTask } from '../src/get-next-task.js';
import { reportProgress } from '../src/progress-tracking.js';
import { createTask } from '../src/task-operations.js';
import { createAgent } from '../src/agent-operations.js';

describe('E2E: Complete UAT Workflow', () => {
  let neo4j;

  beforeAll(async () => {
    neo4j = await getNeo4j();
    await initializeSchema();
  }, 30000);

  beforeEach(async () => {
    // Clean up test data
    await neo4j.run(`
      MATCH (n)
      WHERE n.id STARTS WITH 'E2E-' OR n.name = 'e2e-orchestrator' OR n.name = 'e2e-integration-tester'
      DETACH DELETE n
    `);

    // Create test project structure
    await neo4j.run(`
      CREATE (p:Project {
        id: 'E2E-PROJECT',
        name: 'E2E Test Project',
        description: 'E2E UAT workflow test',
        status: 'active',
        created: datetime(),
        updated: datetime()
      })
      CREATE (e:Epic {
        id: 'E2E-EPIC',
        name: 'E2E UAT Testing',
        description: 'E2E test epic',
        status: 'pending',
        priority: 'high'
      })
      CREATE (p)-[:CONTAINS]->(e)
    `);

    // Create test agents
    await createAgent({
      name: 'e2e-orchestrator',
      type: 'orchestrator',
      capabilities: ['orchestration', 'browser-automation']
    });

    await createAgent({
      name: 'e2e-integration-tester',
      type: 'integration-tester',
      capabilities: ['browser-automation', 'screenshot-capture', 'test-execution']
    });
  }, 10000);

  afterAll(async () => {
    // Clean up test data
    await neo4j.run(`
      MATCH (n)
      WHERE n.id STARTS WITH 'E2E-' OR n.name = 'e2e-orchestrator' OR n.name = 'e2e-integration-tester'
      DETACH DELETE n
    `);
  }, 10000);

  test('Complete UAT workflow: get task → start → complete → unblock → next task', async () => {
    // Setup: Create two tasks with dependency
    // UAT-001 (no dependencies) → UAT-002 (depends on UAT-001)
    await createTask({
      taskId: 'E2E-UAT-001',
      name: 'Test user registration',
      description: 'Verify user can register with valid credentials',
      priority: 'high',
      epicId: 'E2E-EPIC',
      requiredCapabilities: ['browser-automation'],
      estimatedDuration: '5m',
      dependencies: []
    });

    await createTask({
      taskId: 'E2E-UAT-002',
      name: 'Test duplicate email handling',
      description: 'Verify system rejects duplicate email addresses',
      priority: 'high',
      epicId: 'E2E-EPIC',
      requiredCapabilities: ['browser-automation'],
      estimatedDuration: '3m',
      dependencies: ['E2E-UAT-001']
    });

    // Step 1: Orchestrator requests next task
    const task1 = await getNextTask('e2e-orchestrator', ['browser-automation']);

    expect(task1).toBeDefined();
    expect(task1.taskId).toBe('E2E-UAT-001');
    expect(task1.taskName).toBe('Test user registration');
    expect(task1.priority).toBe('high');
    expect(task1.dependencies).toEqual([]);

    // Step 2: Integration Tester starts work
    const startProgress = await reportProgress({
      agentName: 'e2e-integration-tester',
      taskId: 'E2E-UAT-001',
      status: 'in_progress'
    });

    expect(startProgress.previousStatus).toBe('pending');
    expect(startProgress.newStatus).toBe('in_progress');

    // Verify task status in graph
    const taskInProgress = await neo4j.run(`
      MATCH (t:Task {id: 'E2E-UAT-001'})
      RETURN t.status AS status, t.assignedTo AS assignedTo, t.started AS started
    `);

    const inProgressData = taskInProgress.records[0];
    expect(inProgressData.get('status')).toBe('in_progress');
    expect(inProgressData.get('assignedTo')).toBe('e2e-integration-tester');
    expect(inProgressData.get('started')).toBeDefined();

    // Step 3: Integration Tester completes task with artifacts
    const completeProgress = await reportProgress({
      agentName: 'e2e-integration-tester',
      taskId: 'E2E-UAT-001',
      status: 'completed',
      artifacts: [
        { path: 'screenshots/e2e-scenario-001/', type: 'screenshot' },
        { path: 'reports/E2E-UAT-001.md', type: 'report' }
      ]
    });

    expect(completeProgress.previousStatus).toBe('in_progress');
    expect(completeProgress.newStatus).toBe('completed');
    expect(completeProgress.artifactsCreated).toBe(2);
    expect(completeProgress.unblockedTasks).toContain('E2E-UAT-002');

    // Verify task completion in graph
    const taskCompleted = await neo4j.run(`
      MATCH (t:Task {id: 'E2E-UAT-001'})
      RETURN t.status AS status, t.completed AS completed
    `);

    const completedData = taskCompleted.records[0];
    expect(completedData.get('status')).toBe('completed');
    expect(completedData.get('completed')).toBeDefined();

    // Verify artifacts created
    const artifacts = await neo4j.run(`
      MATCH (t:Task {id: 'E2E-UAT-001'})-[:PRODUCES]->(a:Artifact)
      RETURN a.path AS path, a.type AS type
      ORDER BY a.path
    `);

    expect(artifacts.records.length).toBe(2);
    expect(artifacts.records[0].get('path')).toBe('reports/E2E-UAT-001.md');
    expect(artifacts.records[0].get('type')).toBe('report');
    expect(artifacts.records[1].get('path')).toBe('screenshots/e2e-scenario-001/');
    expect(artifacts.records[1].get('type')).toBe('screenshot');

    // Verify agent completion relationship
    const agentCompletion = await neo4j.run(`
      MATCH (a:Agent {name: 'e2e-integration-tester'})-[:COMPLETED]->(t:Task {id: 'E2E-UAT-001'})
      RETURN COUNT(a) AS count
    `);

    expect(agentCompletion.records[0].get('count').toNumber()).toBe(1);

    // Step 4: Verify UAT-002 is now unblocked (dependency met)
    const task2Status = await neo4j.run(`
      MATCH (t:Task {id: 'E2E-UAT-002'})
      RETURN t.status AS status
    `);

    expect(task2Status.records[0].get('status')).toBe('pending');

    // Verify dependency relationship exists
    const dependency = await neo4j.run(`
      MATCH (t2:Task {id: 'E2E-UAT-002'})-[:DEPENDS_ON]->(t1:Task {id: 'E2E-UAT-001'})
      RETURN t1.status AS t1Status
    `);

    expect(dependency.records.length).toBe(1);
    expect(dependency.records[0].get('t1Status')).toBe('completed');

    // Step 5: Orchestrator requests next task (should get UAT-002)
    const task2 = await getNextTask('e2e-orchestrator', ['browser-automation']);

    expect(task2).toBeDefined();
    expect(task2.taskId).toBe('E2E-UAT-002');
    expect(task2.taskName).toBe('Test duplicate email handling');
    expect(task2.dependencies).toEqual(['E2E-UAT-001']);

    // Complete UAT-002
    await reportProgress({
      agentName: 'e2e-integration-tester',
      taskId: 'E2E-UAT-002',
      status: 'in_progress'
    });

    await reportProgress({
      agentName: 'e2e-integration-tester',
      taskId: 'E2E-UAT-002',
      status: 'completed',
      artifacts: [
        { path: 'reports/E2E-UAT-002.md', type: 'report' }
      ]
    });

    // Step 6: No more tasks available
    const noMoreTasks = await getNextTask('e2e-orchestrator', ['browser-automation']);

    expect(noMoreTasks).toBeNull();

    // Final verification: All tasks completed
    const finalStatus = await neo4j.run(`
      MATCH (e:Epic {id: 'E2E-EPIC'})-[:HAS_TASK]->(t:Task)
      WHERE t.id STARTS WITH 'E2E-UAT'
      RETURN t.id AS id, t.status AS status
      ORDER BY t.id
    `);

    expect(finalStatus.records.length).toBe(2);
    expect(finalStatus.records[0].get('status')).toBe('completed');
    expect(finalStatus.records[1].get('status')).toBe('completed');
  }, 30000);
});
