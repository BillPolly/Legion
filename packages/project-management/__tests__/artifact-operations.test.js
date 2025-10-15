/**
 * Artifact Entity Operations Tests
 *
 * Tests for Artifact CRUD operations.
 * NO MOCKS for Neo4j - uses real database.
 */

import { getNeo4j } from '../src/neo4j.js';
import { initializeSchema } from '../src/schema.js';
import {
  createArtifact,
  linkArtifactToTask,
  findArtifactsByTask,
  findArtifactsByType
} from '../src/artifact-operations.js';

describe('Artifact Entity Operations', () => {
  let neo4j;

  beforeAll(async () => {
    neo4j = await getNeo4j();
    await initializeSchema();

    // Create test epic and task for artifacts
    await neo4j.run(`
      CREATE (p:Project {id: 'artifact-test-project', name: 'Artifact Test Project', status: 'active', created: datetime(), updated: datetime()})
      CREATE (e:Epic {id: 'artifact-test-epic', name: 'Artifact Test Epic', description: 'Test Epic', status: 'pending', priority: 'high'})
      CREATE (p)-[:CONTAINS]->(e)
    `);
  }, 30000);

  afterAll(async () => {
    // Clean up test data
    await neo4j.run('MATCH (n) WHERE n.id STARTS WITH "artifact-test-" DETACH DELETE n');
    await neo4j.run('MATCH (a:Artifact) WHERE a.path STARTS WITH "test-artifacts/" DETACH DELETE a');
    await neo4j.run('MATCH (t:Task) WHERE t.id STARTS WITH "ART-TASK-" DETACH DELETE t');
  }, 30000);

  beforeEach(async () => {
    // Clean up test artifacts and tasks before each test
    await neo4j.run('MATCH (a:Artifact) WHERE a.path STARTS WITH "test-artifacts/" DETACH DELETE a');
    await neo4j.run('MATCH (t:Task) WHERE t.id STARTS WITH "ART-TASK-" DETACH DELETE t');
  }, 10000);

  test('Create artifact', async () => {
    const artifactData = {
      path: 'test-artifacts/report-001.md',
      type: 'report',
      size: 12345
    };

    const result = await createArtifact(artifactData);

    expect(result.artifactId).toBeDefined();
    expect(result.path).toBe('test-artifacts/report-001.md');

    // Verify in database
    const queryResult = await neo4j.run(
      'MATCH (a:Artifact {id: $id}) RETURN a',
      { id: result.artifactId }
    );

    expect(queryResult.records.length).toBe(1);
    const artifact = queryResult.records[0].get('a').properties;
    expect(artifact.path).toBe('test-artifacts/report-001.md');
    expect(artifact.type).toBe('report');
    // Size is stored as a plain number
    expect(artifact.size).toBe(12345);
  }, 10000);

  test('Link artifact to task', async () => {
    // Create test task
    await neo4j.run(`
      MATCH (e:Epic {id: 'artifact-test-epic'})
      CREATE (t:Task {
        id: 'ART-TASK-001',
        name: 'Test task',
        description: 'Task with artifacts',
        status: 'completed',
        priority: 'high',
        requiredCapabilities: [],
        created: datetime(),
        updated: datetime()
      })
      CREATE (e)-[:HAS_TASK]->(t)
    `);

    // Create artifact
    const artifactData = {
      path: 'test-artifacts/screenshot-001.png',
      type: 'screenshot',
      size: 45678
    };

    const artifact = await createArtifact(artifactData);

    // Link to task
    const result = await linkArtifactToTask(artifact.artifactId, 'ART-TASK-001');

    expect(result.success).toBe(true);
    expect(result.artifactId).toBe(artifact.artifactId);
    expect(result.taskId).toBe('ART-TASK-001');

    // Verify relationship
    const relResult = await neo4j.run(`
      MATCH (t:Task {id: 'ART-TASK-001'})-[:PRODUCES]->(a:Artifact {id: $artifactId})
      RETURN count(*) AS count
    `, { artifactId: artifact.artifactId });

    expect(relResult.records[0].get('count').low).toBe(1);
  }, 10000);

  test('Find artifacts by task', async () => {
    // Create test task
    await neo4j.run(`
      MATCH (e:Epic {id: 'artifact-test-epic'})
      CREATE (t:Task {
        id: 'ART-TASK-002',
        name: 'Test task 2',
        description: 'Task with multiple artifacts',
        status: 'completed',
        priority: 'high',
        requiredCapabilities: [],
        created: datetime(),
        updated: datetime()
      })
      CREATE (e)-[:HAS_TASK]->(t)
    `);

    // Create and link multiple artifacts
    const artifact1 = await createArtifact({
      path: 'test-artifacts/report-002.md',
      type: 'report'
    });
    await linkArtifactToTask(artifact1.artifactId, 'ART-TASK-002');

    const artifact2 = await createArtifact({
      path: 'test-artifacts/screenshot-002.png',
      type: 'screenshot'
    });
    await linkArtifactToTask(artifact2.artifactId, 'ART-TASK-002');

    const artifacts = await findArtifactsByTask('ART-TASK-002');

    expect(artifacts.length).toBe(2);
    const paths = artifacts.map(a => a.path);
    expect(paths).toContain('test-artifacts/report-002.md');
    expect(paths).toContain('test-artifacts/screenshot-002.png');
  }, 10000);

  test('Find artifacts by type', async () => {
    // Create test task
    await neo4j.run(`
      MATCH (e:Epic {id: 'artifact-test-epic'})
      CREATE (t:Task {
        id: 'ART-TASK-003',
        name: 'Test task 3',
        description: 'Task',
        status: 'completed',
        priority: 'high',
        requiredCapabilities: [],
        created: datetime(),
        updated: datetime()
      })
      CREATE (e)-[:HAS_TASK]->(t)
    `);

    // Create artifacts of different types
    const screenshot1 = await createArtifact({
      path: 'test-artifacts/screenshot-003a.png',
      type: 'screenshot'
    });
    await linkArtifactToTask(screenshot1.artifactId, 'ART-TASK-003');

    const screenshot2 = await createArtifact({
      path: 'test-artifacts/screenshot-003b.png',
      type: 'screenshot'
    });
    await linkArtifactToTask(screenshot2.artifactId, 'ART-TASK-003');

    const report = await createArtifact({
      path: 'test-artifacts/report-003.md',
      type: 'report'
    });
    await linkArtifactToTask(report.artifactId, 'ART-TASK-003');

    const screenshots = await findArtifactsByType('screenshot');
    const screenshotPaths = screenshots.map(a => a.path);
    expect(screenshotPaths).toContain('test-artifacts/screenshot-003a.png');
    expect(screenshotPaths).toContain('test-artifacts/screenshot-003b.png');

    const reports = await findArtifactsByType('report');
    const reportPaths = reports.map(a => a.path);
    expect(reportPaths).toContain('test-artifacts/report-003.md');
  }, 10000);
});
