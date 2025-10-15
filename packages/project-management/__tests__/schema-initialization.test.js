/**
 * Schema Initialization Tests
 *
 * Tests that verify Neo4j schema (constraints and indexes) is properly initialized.
 * NO MOCKS - uses real Neo4j database.
 */

import { initializeSchema } from '../src/schema.js';
import { getNeo4j } from '../src/neo4j.js';

describe('Schema Initialization', () => {
  let neo4j;

  beforeAll(async () => {
    neo4j = await getNeo4j();

    // Clean up any existing test schema
    await neo4j.run('DROP CONSTRAINT project_id IF EXISTS');
    await neo4j.run('DROP CONSTRAINT epic_id IF EXISTS');
    await neo4j.run('DROP CONSTRAINT task_id IF EXISTS');
    await neo4j.run('DROP CONSTRAINT agent_name IF EXISTS');
    await neo4j.run('DROP CONSTRAINT artifact_id IF EXISTS');
    await neo4j.run('DROP CONSTRAINT bug_id IF EXISTS');
    await neo4j.run('DROP CONSTRAINT test_scenario_id IF EXISTS');
    await neo4j.run('DROP INDEX task_status IF EXISTS');
    await neo4j.run('DROP INDEX task_priority IF EXISTS');
    await neo4j.run('DROP INDEX task_assignedTo IF EXISTS');
    await neo4j.run('DROP INDEX agent_status IF EXISTS');
    await neo4j.run('DROP INDEX bug_status IF EXISTS');
    await neo4j.run('DROP INDEX bug_severity IF EXISTS');
    await neo4j.run('DROP INDEX task_created IF EXISTS');
    await neo4j.run('DROP INDEX task_completed IF EXISTS');
  }, 30000);

  afterAll(async () => {
    // Keep schema for other tests to use
  });

  test('All constraints created', async () => {
    await initializeSchema();

    // Check constraints exist
    const result = await neo4j.run('SHOW CONSTRAINTS');
    const constraints = result.records.map(r => r.get('name'));

    expect(constraints).toContain('project_id');
    expect(constraints).toContain('epic_id');
    expect(constraints).toContain('task_id');
    expect(constraints).toContain('agent_name');
    expect(constraints).toContain('artifact_id');
    expect(constraints).toContain('bug_id');
    expect(constraints).toContain('test_scenario_id');
  }, 30000);

  test('All indexes created', async () => {
    await initializeSchema();

    // Check indexes exist
    const result = await neo4j.run('SHOW INDEXES');
    const indexes = result.records.map(r => r.get('name'));

    expect(indexes).toContain('task_status');
    expect(indexes).toContain('task_priority');
    expect(indexes).toContain('task_assignedTo');
    expect(indexes).toContain('agent_status');
    expect(indexes).toContain('bug_status');
    expect(indexes).toContain('bug_severity');
    expect(indexes).toContain('task_created');
    expect(indexes).toContain('task_completed');
  }, 30000);

  test('Schema can be initialized multiple times (idempotent)', async () => {
    // Initialize twice - should not throw error
    await initializeSchema();
    await initializeSchema();

    // Verify constraints still exist
    const result = await neo4j.run('SHOW CONSTRAINTS');
    const constraints = result.records.map(r => r.get('name'));

    expect(constraints).toContain('project_id');
  }, 30000);

  test('Verify constraints with actual graph queries', async () => {
    await initializeSchema();

    // Test Project constraint
    await neo4j.run('CREATE (p:Project {id: $id})', { id: 'test-project-1' });

    // Try to create duplicate - should fail
    await expect(
      neo4j.run('CREATE (p:Project {id: $id})', { id: 'test-project-1' })
    ).rejects.toThrow();

    // Cleanup
    await neo4j.run('MATCH (p:Project {id: $id}) DELETE p', { id: 'test-project-1' });

    // Test Task constraint
    await neo4j.run('CREATE (t:Task {id: $id})', { id: 'test-task-1' });

    // Try to create duplicate - should fail
    await expect(
      neo4j.run('CREATE (t:Task {id: $id})', { id: 'test-task-1' })
    ).rejects.toThrow();

    // Cleanup
    await neo4j.run('MATCH (t:Task {id: $id}) DELETE t', { id: 'test-task-1' });
  }, 30000);
});
