/**
 * Tests for Neo4jDataSource async implementation
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import { Neo4jDataSource } from '../../src/datasources/Neo4jDataSource.js';
import { ResourceManager } from '../../src/index.js';

describe('Neo4jDataSource Async', () => {
  let resourceManager;
  let dataSource;

  beforeAll(async () => {
    console.log('Getting ResourceManager singleton...');
    resourceManager = await ResourceManager.getInstance();
  });

  beforeEach(() => {
    dataSource = new Neo4jDataSource(resourceManager);
  });

  afterAll(async () => {
    // Clean up test data
    const neo4j = await resourceManager.getNeo4jServer();
    await neo4j.run('MATCH (n:TestNode) DETACH DELETE n');
    console.log('Test cleanup complete');
  });

  describe('Initialization', () => {
    it('should create DataSource instance', () => {
      expect(dataSource).toBeDefined();
      expect(dataSource).toBeInstanceOf(Neo4jDataSource);
    });

    it('should initialize successfully', async () => {
      await dataSource.initialize();
      expect(dataSource.initialized).toBe(true);
    });

    it('should fail without ResourceManager', () => {
      expect(() => new Neo4jDataSource()).toThrow('ResourceManager is required');
    });
  });

  describe('Async Query Execution', () => {
    beforeEach(async () => {
      await dataSource.initialize();
    });

    it('should execute simple Cypher query', async () => {
      const result = await dataSource.queryAsync({
        type: 'cypher',
        query: 'RETURN 1 as number, "test" as text'
      });

      expect(result).toBeDefined();
      expect(result.records).toHaveLength(1);
      expect(result.records[0].number).toBe(1);
      expect(result.records[0].text).toBe('test');
    });

    it('should create and retrieve nodes', async () => {
      // Create node
      const createResult = await dataSource.queryAsync({
        type: 'cypher',
        query: 'CREATE (n:TestNode {name: $name, value: $value}) RETURN n',
        params: { name: 'AsyncTest', value: 99 }
      });

      expect(createResult.records).toHaveLength(1);
      const node = createResult.records[0].n;
      expect(node.labels).toContain('TestNode');
      expect(node.properties.name).toBe('AsyncTest');
      expect(node.properties.value).toBe(99);

      // Retrieve node
      const retrieveResult = await dataSource.queryAsync({
        type: 'node',
        labels: ['TestNode'],
        properties: { name: 'AsyncTest' }
      });

      expect(retrieveResult.records).toHaveLength(1);
      expect(retrieveResult.records[0].n.properties.name).toBe('AsyncTest');
    });

    it('should handle relationships', async () => {
      // Create nodes and relationship
      await dataSource.queryAsync({
        type: 'cypher',
        query: `
          CREATE (a:TestNode {name: 'NodeA'})
          CREATE (b:TestNode {name: 'NodeB'})
          CREATE (a)-[r:CONNECTED {weight: 10}]->(b)
        `
      });

      // Query relationship
      const result = await dataSource.queryAsync({
        type: 'relationship',
        relationshipType: 'CONNECTED',
        direction: 'outgoing'
      });

      expect(result.records.length).toBeGreaterThan(0);
      const rel = result.records[0].r;
      expect(rel.type).toBe('CONNECTED');
      expect(rel.properties.weight).toBe(10);
    });

    it('should handle query errors', async () => {
      await expect(
        dataSource.queryAsync({
          type: 'cypher',
          query: 'INVALID CYPHER SYNTAX'
        })
      ).rejects.toThrow();
    });
  });

  describe('Schema Introspection', () => {
    beforeEach(async () => {
      await dataSource.initialize();
      // Create test schema
      const neo4j = await resourceManager.getNeo4jServer();
      await neo4j.run('CREATE (n:Person {name: "John", age: 30})');
      await neo4j.run('CREATE (n:Company {name: "ACME", founded: 2020})');
      await neo4j.run('MATCH (p:Person), (c:Company) CREATE (p)-[:WORKS_FOR]->(c)');
    });

    afterEach(async () => {
      // Clean up schema test data
      const neo4j = await resourceManager.getNeo4jServer();
      await neo4j.run('MATCH (n:Person) DETACH DELETE n');
      await neo4j.run('MATCH (n:Company) DETACH DELETE n');
    });

    it('should retrieve schema information', async () => {
      const schema = await dataSource.getSchema();
      
      expect(schema).toBeDefined();
      expect(schema.labels).toBeDefined();
      expect(schema.relationships).toBeDefined();
      expect(schema.properties).toBeDefined();
    });

    it('should identify labels', async () => {
      const schema = await dataSource.getSchema();
      
      expect(schema.labels).toContain('Person');
      expect(schema.labels).toContain('Company');
    });

    it('should identify relationship types', async () => {
      const schema = await dataSource.getSchema();
      
      expect(schema.relationships).toContain('WORKS_FOR');
    });

    it('should identify properties', async () => {
      const schema = await dataSource.getSchema();
      
      expect(schema.properties.Person).toContain('name');
      expect(schema.properties.Person).toContain('age');
      expect(schema.properties.Company).toContain('name');
      expect(schema.properties.Company).toContain('founded');
    });
  });

  describe('Subscription System', () => {
    beforeEach(async () => {
      await dataSource.initialize();
    });

    it('should register subscriptions', () => {
      const callback = jest.fn();
      
      const unsubscribe = dataSource.subscribe({
        type: 'node',
        labels: ['TestNode']
      }, callback);
      
      expect(unsubscribe).toBeDefined();
      expect(typeof unsubscribe).toBe('function');
    });

    it('should trigger callbacks on write operations', async () => {
      const callback = jest.fn();
      
      dataSource.subscribe({
        type: 'cypher',
        labels: ['TestNode']
      }, callback);
      
      // Create a node (write operation)
      await dataSource.queryAsync({
        type: 'cypher',
        query: 'CREATE (n:TestNode {name: "SubTest"}) RETURN n'
      });
      
      // Wait for async callback
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(callback).toHaveBeenCalled();
    });

    it('should unsubscribe correctly', async () => {
      const callback = jest.fn();
      
      const unsubscribe = dataSource.subscribe({
        type: 'node'
      }, callback);
      
      unsubscribe();
      
      // Create node after unsubscribe
      await dataSource.queryAsync({
        type: 'cypher',
        query: 'CREATE (n:TestNode {name: "AfterUnsub"}) RETURN n'
      });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('Handle Creation', () => {
    beforeEach(async () => {
      await dataSource.initialize();
    });

    it('should create GraphDatabaseHandle', () => {
      const handle = dataSource.createHandle();
      
      expect(handle).toBeDefined();
      expect(handle.constructor.name).toBe('GraphDatabaseHandle');
      expect(handle.dataSource).toBe(dataSource);
    });

    it('should create NodeHandle', () => {
      const nodeHandle = dataSource.createNodeHandle('123');
      
      expect(nodeHandle).toBeDefined();
      expect(nodeHandle.constructor.name).toBe('NodeHandle');
      expect(nodeHandle.id).toBe('123');
      expect(nodeHandle.dataSource).toBe(dataSource);
    });
  });
});