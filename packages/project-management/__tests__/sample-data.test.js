/**
 * Sample Data Creation Tests
 *
 * Tests that verify we can create complete project structures with all entity types and relationships.
 * NO MOCKS - uses real Neo4j database.
 */

import { getNeo4j } from '../src/neo4j.js';
import { initializeSchema } from '../src/schema.js';
import { createSampleData } from '../src/sample-data.js';

describe('Sample Data Creation', () => {
  let neo4j;

  beforeAll(async () => {
    neo4j = await getNeo4j();

    // Initialize schema
    await initializeSchema();
  }, 30000);

  beforeEach(async () => {
    // Clean up any existing sample data before each test
    await neo4j.run('MATCH (n) WHERE n.id IN ["working-todo-app", "uat-testing", "UAT-001", "UAT-002"] DETACH DELETE n');
    await neo4j.run('MATCH (a:Agent {name: "integration-tester"}) DETACH DELETE a');
  }, 10000);

  afterAll(async () => {
    // Clean up sample data after all tests
    await neo4j.run('MATCH (n) WHERE n.id IN ["working-todo-app", "uat-testing", "UAT-001", "UAT-002"] DETACH DELETE n');
    await neo4j.run('MATCH (a:Agent {name: "integration-tester"}) DETACH DELETE a');
  }, 30000);

  test('Create complete project structure', async () => {
    await createSampleData();

    // Verify project exists
    const projectResult = await neo4j.run(
      'MATCH (p:Project {id: $id}) RETURN p',
      { id: 'working-todo-app' }
    );
    expect(projectResult.records.length).toBe(1);

    const project = projectResult.records[0].get('p').properties;
    expect(project.name).toBe('Working Todo App');
    expect(project.status).toBe('active');

    // Verify epic exists and is connected to project
    const epicResult = await neo4j.run(`
      MATCH (p:Project {id: $projectId})-[:CONTAINS]->(e:Epic {id: $epicId})
      RETURN e
    `, { projectId: 'working-todo-app', epicId: 'uat-testing' });
    expect(epicResult.records.length).toBe(1);

    const epic = epicResult.records[0].get('e').properties;
    expect(epic.name).toBe('UAT Testing');
    expect(epic.priority).toBe('high');

    // Verify tasks exist and are connected to epic
    const tasksResult = await neo4j.run(`
      MATCH (e:Epic {id: $epicId})-[:HAS_TASK]->(t:Task)
      RETURN t
      ORDER BY t.id
    `, { epicId: 'uat-testing' });
    expect(tasksResult.records.length).toBe(2);

    const task1 = tasksResult.records[0].get('t').properties;
    const task2 = tasksResult.records[1].get('t').properties;
    expect(task1.id).toBe('UAT-001');
    expect(task1.status).toBe('completed');
    expect(task2.id).toBe('UAT-002');
    expect(task2.status).toBe('pending');

    // Verify agent exists
    const agentResult = await neo4j.run(
      'MATCH (a:Agent {name: $name}) RETURN a',
      { name: 'integration-tester' }
    );
    expect(agentResult.records.length).toBe(1);

    const agent = agentResult.records[0].get('a').properties;
    expect(agent.type).toBe('integration-tester');
    expect(agent.status).toBe('idle');
    expect(agent.capabilities).toEqual(['browser-automation', 'screenshot-capture', 'test-execution']);

    // Verify artifacts exist and are connected to task
    const artifactsResult = await neo4j.run(`
      MATCH (t:Task {id: $taskId})-[:PRODUCES]->(a:Artifact)
      RETURN a
      ORDER BY a.path
    `, { taskId: 'UAT-001' });
    expect(artifactsResult.records.length).toBe(2);

    const artifact1 = artifactsResult.records[0].get('a').properties;
    const artifact2 = artifactsResult.records[1].get('a').properties;
    expect(artifact1.path).toBe('reports/UAT-001.md');
    expect(artifact1.type).toBe('report');
    expect(artifact2.path).toBe('screenshots/scenario-001/');
    expect(artifact2.type).toBe('screenshot');
  }, 30000);

  test('Verify all relationships exist', async () => {
    await createSampleData();

    // Verify Project-[:CONTAINS]->Epic
    const projectEpicResult = await neo4j.run(`
      MATCH (p:Project {id: 'working-todo-app'})-[:CONTAINS]->(e:Epic {id: 'uat-testing'})
      RETURN count(*) AS count
    `);
    expect(projectEpicResult.records[0].get('count').low).toBe(1);

    // Verify Epic-[:HAS_TASK]->Task
    const epicTaskResult = await neo4j.run(`
      MATCH (e:Epic {id: 'uat-testing'})-[:HAS_TASK]->(t:Task)
      RETURN count(*) AS count
    `);
    expect(epicTaskResult.records[0].get('count').low).toBe(2);

    // Verify Task-[:DEPENDS_ON]->Task
    const dependencyResult = await neo4j.run(`
      MATCH (t1:Task {id: 'UAT-002'})-[:DEPENDS_ON]->(t2:Task {id: 'UAT-001'})
      RETURN count(*) AS count
    `);
    expect(dependencyResult.records[0].get('count').low).toBe(1);

    // Verify Agent-[:COMPLETED]->Task
    const completedResult = await neo4j.run(`
      MATCH (a:Agent {name: 'integration-tester'})-[:COMPLETED]->(t:Task {id: 'UAT-001'})
      RETURN count(*) AS count
    `);
    expect(completedResult.records[0].get('count').low).toBe(1);

    // Verify Task-[:PRODUCES]->Artifact
    const artifactResult = await neo4j.run(`
      MATCH (t:Task {id: 'UAT-001'})-[:PRODUCES]->(a:Artifact)
      RETURN count(*) AS count
    `);
    expect(artifactResult.records[0].get('count').low).toBe(2);
  }, 30000);

  test('Query sample data successfully', async () => {
    await createSampleData();

    // Query for pending tasks that depend on completed tasks
    const queryResult = await neo4j.run(`
      MATCH (pending:Task {status: 'pending'})-[:DEPENDS_ON]->(completed:Task {status: 'completed'})
      WHERE NOT EXISTS {
        MATCH (pending)-[:DEPENDS_ON]->(other:Task)
        WHERE other.status <> 'completed'
      }
      RETURN pending.id AS taskId, pending.name AS taskName
    `);

    expect(queryResult.records.length).toBe(1);
    const pendingTask = queryResult.records[0];
    expect(pendingTask.get('taskId')).toBe('UAT-002');
    expect(pendingTask.get('taskName')).toBe('Test duplicate email handling');

    // Query for agent's completed tasks with artifacts
    const agentQueryResult = await neo4j.run(`
      MATCH (a:Agent {name: 'integration-tester'})-[:COMPLETED]->(t:Task)-[:PRODUCES]->(art:Artifact)
      RETURN t.id AS taskId, collect(art.type) AS artifactTypes
    `);

    expect(agentQueryResult.records.length).toBe(1);
    const completedTask = agentQueryResult.records[0];
    expect(completedTask.get('taskId')).toBe('UAT-001');

    const artifactTypes = completedTask.get('artifactTypes');
    expect(artifactTypes).toContain('screenshot');
    expect(artifactTypes).toContain('report');
  }, 30000);
});
