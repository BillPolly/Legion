/**
 * Neo4j Connection Tests via ResourceManager
 *
 * Tests that verify Neo4j connection is properly established via ResourceManager.
 * NO MOCKS - uses real ResourceManager and real Neo4j connection.
 */

import { ResourceManager } from '@legion/resource-manager';

describe('Neo4j Connection via ResourceManager', () => {
  let resourceManager;
  let neo4j;

  beforeAll(async () => {
    // Get ResourceManager instance - it auto-initializes
    resourceManager = await ResourceManager.getInstance();

    // Get Neo4j handle from ResourceManager
    neo4j = await resourceManager.getNeo4jServer();
  }, 30000); // 30 second timeout for initialization

  afterAll(async () => {
    // Cleanup
    if (neo4j) {
      await neo4j.close();
    }
  });

  test('ResourceManager provides Neo4j handle successfully', () => {
    expect(neo4j).toBeDefined();
    expect(neo4j).not.toBeNull();
  });

  test('Neo4j handle has required methods', () => {
    expect(typeof neo4j.run).toBe('function');
    expect(typeof neo4j.transaction).toBe('function');
    expect(typeof neo4j.session).toBe('function');
    expect(typeof neo4j.isHealthy).toBe('function');
  });

  test('Connection is healthy', async () => {
    const healthy = await neo4j.isHealthy();
    expect(healthy).toBe(true);
  }, 10000);

  test('Can execute simple query', async () => {
    const result = await neo4j.run('RETURN 1 AS result');

    expect(result).toBeDefined();
    expect(result.records).toBeDefined();
    expect(result.records.length).toBe(1);

    // Neo4j returns integers as objects with low/high properties
    const value = result.records[0].get('result');
    expect(value.low).toBe(1);
    expect(value.high).toBe(0);
  }, 10000);

  test('Can use transaction helper to execute queries', async () => {
    const result = await neo4j.transaction(async (tx) => {
      const queryResult = await tx.run('RETURN 42 AS answer');
      return queryResult.records[0].get('answer');
    });

    // Neo4j returns integers as objects with low/high properties
    expect(result.low).toBe(42);
    expect(result.high).toBe(0);
  }, 10000);

  test('Transaction rollback works on error', async () => {
    // Create a unique test node
    const testId = `test-${Date.now()}`;

    try {
      await neo4j.transaction(async (tx) => {
        // Create a node
        await tx.run('CREATE (n:TestNode {id: $id})', { id: testId });

        // Throw error to trigger rollback
        throw new Error('Intentional rollback');
      });
    } catch (error) {
      expect(error.message).toBe('Intentional rollback');
    }

    // Verify node was NOT created (rollback worked)
    const checkResult = await neo4j.run(
      'MATCH (n:TestNode {id: $id}) RETURN n',
      { id: testId }
    );

    expect(checkResult.records.length).toBe(0);
  }, 10000);
});
