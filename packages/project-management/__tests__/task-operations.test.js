/**
 * Task Entity Operations Tests
 *
 * Tests for Task CRUD operations.
 * NO MOCKS for Neo4j - uses real database.
 */

import { getNeo4j } from '../src/neo4j.js';
import { initializeSchema } from '../src/schema.js';
import {
  createTask,
  findTaskById,
  updateTaskStatus,
  deleteTask,
  findTasksByStatus
} from '../src/task-operations.js';

describe('Task Entity Operations', () => {
  let neo4j;

  beforeAll(async () => {
    neo4j = await getNeo4j();
    await initializeSchema();

    // Create test epic for tasks
    await neo4j.run(`
      CREATE (p:Project {id: 'test-project', name: 'Test Project', status: 'active', created: datetime(), updated: datetime()})
      CREATE (e:Epic {id: 'test-epic', name: 'Test Epic', description: 'Test Epic', status: 'pending', priority: 'high'})
      CREATE (p)-[:CONTAINS]->(e)
    `);
  }, 30000);

  afterAll(async () => {
    // Clean up test data
    await neo4j.run('MATCH (n) WHERE n.id STARTS WITH "test-" OR n.id STARTS WITH "TASK-" DETACH DELETE n');
  }, 30000);

  beforeEach(async () => {
    // Clean up test tasks before each test
    await neo4j.run('MATCH (t:Task) WHERE t.id STARTS WITH "TASK-" DETACH DELETE t');
  }, 10000);

  test('Create task with all properties', async () => {
    const taskData = {
      taskId: 'TASK-001',
      name: 'Test task 1',
      description: 'This is a test task',
      priority: 'high',
      epicId: 'test-epic',
      requiredCapabilities: ['test-capability'],
      estimatedDuration: '30m'
    };

    const result = await createTask(taskData);

    expect(result.taskId).toBe('TASK-001');
    expect(result.status).toBe('pending');

    // Verify in database
    const queryResult = await neo4j.run(
      'MATCH (t:Task {id: $id}) RETURN t',
      { id: 'TASK-001' }
    );

    expect(queryResult.records.length).toBe(1);
    const task = queryResult.records[0].get('t').properties;
    expect(task.name).toBe('Test task 1');
    expect(task.description).toBe('This is a test task');
    expect(task.priority).toBe('high');
    expect(task.status).toBe('pending');
    expect(task.requiredCapabilities).toEqual(['test-capability']);
    expect(task.estimatedDuration).toBe('30m');
  }, 10000);

  test('Find task by ID', async () => {
    // Create test task
    await neo4j.run(`
      MATCH (e:Epic {id: 'test-epic'})
      CREATE (t:Task {
        id: 'TASK-002',
        name: 'Test task 2',
        description: 'Description',
        status: 'pending',
        priority: 'medium',
        requiredCapabilities: [],
        created: datetime(),
        updated: datetime()
      })
      CREATE (e)-[:HAS_TASK]->(t)
    `);

    const task = await findTaskById('TASK-002');

    expect(task).toBeDefined();
    expect(task.id).toBe('TASK-002');
    expect(task.name).toBe('Test task 2');
    expect(task.status).toBe('pending');
    expect(task.priority).toBe('medium');
  }, 10000);

  test('Find task by ID returns null for non-existent task', async () => {
    const task = await findTaskById('NON-EXISTENT');
    expect(task).toBeNull();
  }, 10000);

  test('Update task status', async () => {
    // Create test task
    await neo4j.run(`
      MATCH (e:Epic {id: 'test-epic'})
      CREATE (t:Task {
        id: 'TASK-003',
        name: 'Test task 3',
        description: 'Description',
        status: 'pending',
        priority: 'high',
        requiredCapabilities: [],
        created: datetime(),
        updated: datetime()
      })
      CREATE (e)-[:HAS_TASK]->(t)
    `);

    const result = await updateTaskStatus('TASK-003', 'in_progress');

    expect(result.previousStatus).toBe('pending');
    expect(result.newStatus).toBe('in_progress');

    // Verify in database
    const queryResult = await neo4j.run(
      'MATCH (t:Task {id: $id}) RETURN t',
      { id: 'TASK-003' }
    );

    const task = queryResult.records[0].get('t').properties;
    expect(task.status).toBe('in_progress');
  }, 10000);

  test('Delete task', async () => {
    // Create test task
    await neo4j.run(`
      MATCH (e:Epic {id: 'test-epic'})
      CREATE (t:Task {
        id: 'TASK-004',
        name: 'Test task 4',
        description: 'Description',
        status: 'pending',
        priority: 'low',
        requiredCapabilities: [],
        created: datetime(),
        updated: datetime()
      })
      CREATE (e)-[:HAS_TASK]->(t)
    `);

    const result = await deleteTask('TASK-004');
    expect(result.success).toBe(true);
    expect(result.taskId).toBe('TASK-004');

    // Verify deleted from database
    const queryResult = await neo4j.run(
      'MATCH (t:Task {id: $id}) RETURN t',
      { id: 'TASK-004' }
    );

    expect(queryResult.records.length).toBe(0);
  }, 10000);

  test('List tasks by status', async () => {
    // Create multiple test tasks with different statuses
    await neo4j.run(`
      MATCH (e:Epic {id: 'test-epic'})
      CREATE (t1:Task {
        id: 'TASK-005',
        name: 'Test task 5',
        description: 'Description',
        status: 'pending',
        priority: 'high',
        requiredCapabilities: [],
        created: datetime(),
        updated: datetime()
      })
      CREATE (t2:Task {
        id: 'TASK-006',
        name: 'Test task 6',
        description: 'Description',
        status: 'pending',
        priority: 'medium',
        requiredCapabilities: [],
        created: datetime(),
        updated: datetime()
      })
      CREATE (t3:Task {
        id: 'TASK-007',
        name: 'Test task 7',
        description: 'Description',
        status: 'in_progress',
        priority: 'high',
        requiredCapabilities: [],
        created: datetime(),
        updated: datetime()
      })
      CREATE (e)-[:HAS_TASK]->(t1)
      CREATE (e)-[:HAS_TASK]->(t2)
      CREATE (e)-[:HAS_TASK]->(t3)
    `);

    const pendingTasks = await findTasksByStatus('pending');
    expect(pendingTasks.length).toBeGreaterThanOrEqual(2);
    expect(pendingTasks.map(t => t.id)).toContain('TASK-005');
    expect(pendingTasks.map(t => t.id)).toContain('TASK-006');

    const inProgressTasks = await findTasksByStatus('in_progress');
    expect(inProgressTasks.length).toBeGreaterThanOrEqual(1);
    const inProgressIds = inProgressTasks.map(t => t.id);
    expect(inProgressIds).toContain('TASK-007');

    // Don't check exact count for completed tasks as other test suites may have created them
    const completedTasks = await findTasksByStatus('completed');
    // Just verify we can query for completed tasks without error
    expect(Array.isArray(completedTasks)).toBe(true);
  }, 10000);
});
