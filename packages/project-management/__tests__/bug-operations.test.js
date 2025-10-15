/**
 * Bug Entity Operations Tests
 *
 * Tests for Bug CRUD operations.
 * NO MOCKS for Neo4j - uses real database.
 */

import { getNeo4j } from '../src/neo4j.js';
import { initializeSchema } from '../src/schema.js';
import {
  createBug,
  linkBugToTasks,
  updateBugStatus,
  findBugsBySeverity
} from '../src/bug-operations.js';

describe('Bug Entity Operations', () => {
  let neo4j;

  beforeAll(async () => {
    neo4j = await getNeo4j();
    await initializeSchema();

    // Create test epic and tasks for bugs
    await neo4j.run(`
      CREATE (p:Project {id: 'bug-test-project', name: 'Bug Test Project', status: 'active', created: datetime(), updated: datetime()})
      CREATE (e:Epic {id: 'bug-test-epic', name: 'Bug Test Epic', description: 'Test Epic', status: 'pending', priority: 'high'})
      CREATE (p)-[:CONTAINS]->(e)
    `);

    // Create test agent
    await neo4j.run(`
      CREATE (a:Agent {
        name: 'bug-test-agent',
        type: 'tester',
        capabilities: ['testing'],
        status: 'idle',
        lastActive: datetime()
      })
    `);
  }, 30000);

  afterAll(async () => {
    // Clean up test data
    await neo4j.run('MATCH (n) WHERE n.id STARTS WITH "bug-test-" OR n.id STARTS WITH "BUG-TEST-" DETACH DELETE n');
    await neo4j.run('MATCH (a:Agent {name: "bug-test-agent"}) DETACH DELETE a');
  }, 30000);

  beforeEach(async () => {
    // Clean up test bugs and tasks before each test
    await neo4j.run('MATCH (b:Bug) WHERE b.id STARTS WITH "BUG-TEST-" DETACH DELETE b');
    await neo4j.run('MATCH (t:Task) WHERE t.id STARTS WITH "BUG-TASK-" DETACH DELETE t');
  }, 10000);

  test('Create bug', async () => {
    // Create test task where bug was found
    await neo4j.run(`
      MATCH (e:Epic {id: 'bug-test-epic'})
      CREATE (t:Task {
        id: 'BUG-TASK-001',
        name: 'Test task',
        description: 'Task where bug was found',
        status: 'in_progress',
        priority: 'high',
        requiredCapabilities: [],
        created: datetime(),
        updated: datetime()
      })
      CREATE (e)-[:HAS_TASK]->(t)
    `);

    const bugData = {
      title: 'Login fails',
      description: 'Login button does not respond',
      severity: 'critical',
      foundBy: 'bug-test-agent',
      foundInTask: 'BUG-TASK-001'
    };

    const result = await createBug(bugData);

    expect(result.bugId).toBeDefined();
    expect(result.bugId).toMatch(/^BUG-TEST-/);
    expect(result.status).toBe('open');

    // Verify in database
    const queryResult = await neo4j.run(
      'MATCH (b:Bug {id: $id}) RETURN b',
      { id: result.bugId }
    );

    expect(queryResult.records.length).toBe(1);
    const bug = queryResult.records[0].get('b').properties;
    expect(bug.title).toBe('Login fails');
    expect(bug.description).toBe('Login button does not respond');
    expect(bug.severity).toBe('critical');
    expect(bug.status).toBe('open');
    expect(bug.foundBy).toBe('bug-test-agent');

    // Verify relationships
    const relResult = await neo4j.run(`
      MATCH (a:Agent {name: 'bug-test-agent'})-[:REPORTED]->(b:Bug {id: $bugId})
      MATCH (b)-[:FOUND_IN]->(t:Task {id: 'BUG-TASK-001'})
      RETURN count(*) AS count
    `, { bugId: result.bugId });

    expect(relResult.records[0].get('count').low).toBe(1);
  }, 10000);

  test('Link bug to blocking tasks', async () => {
    // Create bug and tasks
    await neo4j.run(`
      MATCH (e:Epic {id: 'bug-test-epic'})
      CREATE (bug:Bug {
        id: 'BUG-TEST-002',
        title: 'Test bug',
        description: 'Test bug',
        severity: 'high',
        status: 'open',
        foundBy: 'bug-test-agent',
        created: datetime()
      })
      CREATE (t1:Task {
        id: 'BUG-TASK-002',
        name: 'Task 2',
        description: 'Task 2',
        status: 'pending',
        priority: 'high',
        requiredCapabilities: [],
        created: datetime(),
        updated: datetime()
      })
      CREATE (t2:Task {
        id: 'BUG-TASK-003',
        name: 'Task 3',
        description: 'Task 3',
        status: 'pending',
        priority: 'high',
        requiredCapabilities: [],
        created: datetime(),
        updated: datetime()
      })
      CREATE (e)-[:HAS_TASK]->(t1)
      CREATE (e)-[:HAS_TASK]->(t2)
    `);

    const result = await linkBugToTasks('BUG-TEST-002', ['BUG-TASK-002', 'BUG-TASK-003']);

    expect(result.bugId).toBe('BUG-TEST-002');
    expect(result.blockedTasksCount).toBe(2);
    expect(result.blockedTasks).toContain('BUG-TASK-002');
    expect(result.blockedTasks).toContain('BUG-TASK-003');

    // Verify tasks are blocked
    const taskResult = await neo4j.run(`
      MATCH (t:Task)-[:BLOCKED_BY]->(b:Bug {id: 'BUG-TEST-002'})
      RETURN t.id AS taskId, t.status AS status
      ORDER BY taskId
    `);

    expect(taskResult.records.length).toBe(2);
    expect(taskResult.records[0].get('taskId')).toBe('BUG-TASK-002');
    expect(taskResult.records[0].get('status')).toBe('blocked');
    expect(taskResult.records[1].get('taskId')).toBe('BUG-TASK-003');
    expect(taskResult.records[1].get('status')).toBe('blocked');
  }, 10000);

  test('Update bug status', async () => {
    // Create test bug
    await neo4j.run(`
      CREATE (b:Bug {
        id: 'BUG-TEST-003',
        title: 'Test bug',
        description: 'Test bug',
        severity: 'medium',
        status: 'open',
        foundBy: 'bug-test-agent',
        created: datetime()
      })
    `);

    const result = await updateBugStatus('BUG-TEST-003', 'fixed');

    expect(result.previousStatus).toBe('open');
    expect(result.newStatus).toBe('fixed');

    // Verify in database
    const queryResult = await neo4j.run(
      'MATCH (b:Bug {id: $id}) RETURN b',
      { id: 'BUG-TEST-003' }
    );

    const bug = queryResult.records[0].get('b').properties;
    expect(bug.status).toBe('fixed');
    expect(bug.resolved).toBeDefined();
  }, 10000);

  test('Find bugs by severity', async () => {
    // Create multiple test bugs with different severities
    await neo4j.run(`
      CREATE (b1:Bug {
        id: 'BUG-TEST-004',
        title: 'Critical bug',
        description: 'Critical bug',
        severity: 'critical',
        status: 'open',
        foundBy: 'bug-test-agent',
        created: datetime()
      })
      CREATE (b2:Bug {
        id: 'BUG-TEST-005',
        title: 'High bug',
        description: 'High bug',
        severity: 'high',
        status: 'open',
        foundBy: 'bug-test-agent',
        created: datetime()
      })
      CREATE (b3:Bug {
        id: 'BUG-TEST-006',
        title: 'Medium bug',
        description: 'Medium bug',
        severity: 'medium',
        status: 'open',
        foundBy: 'bug-test-agent',
        created: datetime()
      })
    `);

    const criticalBugs = await findBugsBySeverity('critical');
    expect(criticalBugs.length).toBeGreaterThanOrEqual(1);
    const criticalIds = criticalBugs.map(b => b.id);
    expect(criticalIds).toContain('BUG-TEST-004');

    const highBugs = await findBugsBySeverity('high');
    expect(highBugs.length).toBeGreaterThanOrEqual(1);
    const highIds = highBugs.map(b => b.id);
    expect(highIds).toContain('BUG-TEST-005');

    const mediumBugs = await findBugsBySeverity('medium');
    expect(mediumBugs.length).toBeGreaterThanOrEqual(1);
    const mediumIds = mediumBugs.map(b => b.id);
    expect(mediumIds).toContain('BUG-TEST-006');
  }, 10000);
});
