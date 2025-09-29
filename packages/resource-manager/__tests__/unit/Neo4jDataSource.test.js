/**
 * Unit tests for Neo4jDataSource
 * TDD approach - write tests first, then implement
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { Neo4jDataSource } from '../../src/datasources/Neo4jDataSource.js';
import { ResourceManager } from '../../src/index.js';

describe('Neo4jDataSource', () => {
  let resourceManager;
  let neo4jHandle;
  let dataSource;

  beforeAll(async () => {
    // Get ResourceManager singleton
    resourceManager = await ResourceManager.getInstance();
    
    // Get Neo4j handle (this connects to real Neo4j)
    neo4jHandle = await resourceManager.getNeo4jServer();
    
    // Clean up any test data from previous runs
    await neo4jHandle.run('MATCH (n:TestNode) DETACH DELETE n');
  });

  beforeEach(() => {
    // Create fresh DataSource for each test
    dataSource = new Neo4jDataSource(resourceManager);
  });

  afterAll(async () => {
    // Clean up test data
    await neo4jHandle.run('MATCH (n:TestNode) DETACH DELETE n');
    
    // Note: We don't close the neo4j handle as it's managed by ResourceManager
  });

  describe('Constructor and Initialization', () => {
    it('should create DataSource instance with ResourceManager', () => {
      expect(dataSource).toBeDefined();
      expect(dataSource).toBeInstanceOf(Neo4jDataSource);
      expect(dataSource.resourceManager).toBe(resourceManager);
    });

    it('should initialize with Neo4j handle from ResourceManager', async () => {
      await dataSource.initialize();
      expect(dataSource.neo4jHandle).toBeDefined();
      expect(dataSource.neo4jHandle).toBe(neo4jHandle);
    });

    it('should fail without ResourceManager', () => {
      expect(() => new Neo4jDataSource()).toThrow('ResourceManager is required');
    });
  });

  describe('Query Execution', () => {
    beforeEach(async () => {
      await dataSource.initialize();
    });

    it('should execute simple query synchronously', () => {
      const result = dataSource.query({
        type: 'cypher',
        query: 'RETURN 1 as number, "test" as text'
      });

      expect(result).toBeDefined();
      expect(result.records).toHaveLength(1);
      expect(result.records[0].number).toBe(1);
      expect(result.records[0].text).toBe('test');
    });

    it('should create and retrieve nodes synchronously', () => {
      // Create node
      const createResult = dataSource.query({
        type: 'cypher',
        query: 'CREATE (n:TestNode {name: $name, value: $value}) RETURN n',
        params: { name: 'TestNode1', value: 42 }
      });

      expect(createResult.records).toHaveLength(1);
      const createdNode = createResult.records[0].n;
      expect(createdNode.labels).toContain('TestNode');
      expect(createdNode.properties.name).toBe('TestNode1');
      expect(createdNode.properties.value).toBe(42);

      // Retrieve node
      const retrieveResult = dataSource.query({
        type: 'cypher',
        query: 'MATCH (n:TestNode {name: $name}) RETURN n',
        params: { name: 'TestNode1' }
      });

      expect(retrieveResult.records).toHaveLength(1);
      expect(retrieveResult.records[0].n.properties.name).toBe('TestNode1');
    });

    it('should handle relationships synchronously', () => {
      // Create nodes and relationship
      dataSource.query({
        type: 'cypher',
        query: `
          CREATE (a:TestNode {name: 'NodeA'})
          CREATE (b:TestNode {name: 'NodeB'})
          CREATE (a)-[r:CONNECTED {weight: 5}]->(b)
        `
      });

      // Query relationship
      const result = dataSource.query({
        type: 'cypher',
        query: `
          MATCH (a:TestNode {name: 'NodeA'})-[r:CONNECTED]->(b:TestNode {name: 'NodeB'})
          RETURN a.name as from, b.name as to, r.weight as weight
        `
      });

      expect(result.records).toHaveLength(1);
      expect(result.records[0].from).toBe('NodeA');
      expect(result.records[0].to).toBe('NodeB');
      expect(result.records[0].weight).toBe(5);
    });

    it('should support different query types', () => {
      // Node query
      const nodeResult = dataSource.query({
        type: 'node',
        labels: ['TestNode'],
        properties: { name: 'TestNode1' }
      });
      expect(nodeResult).toBeDefined();

      // Relationship query
      const relResult = dataSource.query({
        type: 'relationship',
        relationshipType: 'CONNECTED',
        direction: 'outgoing'
      });
      expect(relResult).toBeDefined();

      // Path query
      const pathResult = dataSource.query({
        type: 'path',
        startNode: { labels: ['TestNode'], properties: { name: 'NodeA' } },
        endNode: { labels: ['TestNode'], properties: { name: 'NodeB' } }
      });
      expect(pathResult).toBeDefined();
    });

    it('should handle errors gracefully', () => {
      expect(() => {
        dataSource.query({
          type: 'cypher',
          query: 'INVALID CYPHER SYNTAX'
        });
      }).toThrow();
    });
  });

  describe('Schema Introspection', () => {
    beforeEach(async () => {
      await dataSource.initialize();
      // Create some test schema
      await neo4jHandle.run('CREATE (n:Person {name: "test", age: 30})');
      await neo4jHandle.run('CREATE (n:Company {name: "test", founded: 2020})');
      await neo4jHandle.run('MATCH (p:Person), (c:Company) CREATE (p)-[:WORKS_FOR]->(c)');
    });

    afterEach(async () => {
      await neo4jHandle.run('MATCH (n:Person) DETACH DELETE n');
      await neo4jHandle.run('MATCH (n:Company) DETACH DELETE n');
    });

    it('should return schema information synchronously', () => {
      const schema = dataSource.getSchema();
      
      expect(schema).toBeDefined();
      expect(schema.labels).toBeDefined();
      expect(schema.relationships).toBeDefined();
      expect(schema.properties).toBeDefined();
    });

    it('should identify node labels', () => {
      const schema = dataSource.getSchema();
      
      expect(schema.labels).toContain('Person');
      expect(schema.labels).toContain('Company');
    });

    it('should identify relationship types', () => {
      const schema = dataSource.getSchema();
      
      expect(schema.relationships).toContain('WORKS_FOR');
    });

    it('should identify properties by label', () => {
      const schema = dataSource.getSchema();
      
      expect(schema.properties.Person).toBeDefined();
      expect(schema.properties.Person).toContain('name');
      expect(schema.properties.Person).toContain('age');
      
      expect(schema.properties.Company).toBeDefined();
      expect(schema.properties.Company).toContain('name');
      expect(schema.properties.Company).toContain('founded');
    });
  });

  describe('Subscription System', () => {
    beforeEach(async () => {
      await dataSource.initialize();
    });

    it('should set up subscriptions synchronously', () => {
      const callback = jest.fn();
      
      const unsubscribe = dataSource.subscribe({
        type: 'node',
        labels: ['TestNode']
      }, callback);
      
      expect(unsubscribe).toBeDefined();
      expect(typeof unsubscribe).toBe('function');
    });

    it('should trigger callbacks on matching changes', async () => {
      const callback = jest.fn();
      
      dataSource.subscribe({
        type: 'node',
        labels: ['TestNode'],
        operation: 'create'
      }, callback);
      
      // Create a node that should trigger the subscription
      dataSource.query({
        type: 'cypher',
        query: 'CREATE (n:TestNode {name: "Subscription Test"}) RETURN n'
      });
      
      // Wait a bit for async propagation
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(callback).toHaveBeenCalled();
      const callArgs = callback.mock.calls[0][0];
      expect(callArgs.type).toBe('create');
      expect(callArgs.data.labels).toContain('TestNode');
    });

    it('should support multiple subscriptions', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      
      const unsub1 = dataSource.subscribe({ type: 'node' }, callback1);
      const unsub2 = dataSource.subscribe({ type: 'relationship' }, callback2);
      
      expect(unsub1).toBeDefined();
      expect(unsub2).toBeDefined();
      expect(unsub1).not.toBe(unsub2);
    });

    it('should unsubscribe correctly', () => {
      const callback = jest.fn();
      
      const unsubscribe = dataSource.subscribe({
        type: 'node',
        labels: ['TestNode']
      }, callback);
      
      // Unsubscribe
      unsubscribe();
      
      // Create node (should not trigger callback)
      dataSource.query({
        type: 'cypher',
        query: 'CREATE (n:TestNode {name: "After Unsubscribe"}) RETURN n'
      });
      
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('Handle Creation', () => {
    beforeEach(async () => {
      await dataSource.initialize();
    });

    it('should create root GraphDatabaseHandle', () => {
      const handle = dataSource.createHandle();
      
      expect(handle).toBeDefined();
      expect(handle.constructor.name).toBe('GraphDatabaseHandle');
      expect(handle.dataSource).toBe(dataSource);
    });

    it('should create handles for specific nodes', () => {
      // Create a test node
      const result = dataSource.query({
        type: 'cypher',
        query: 'CREATE (n:TestNode {id: 123, name: "Handle Test"}) RETURN n'
      });
      const nodeId = result.records[0].n.identity;
      
      // Create handle for the node
      const nodeHandle = dataSource.createNodeHandle(nodeId);
      
      expect(nodeHandle).toBeDefined();
      expect(nodeHandle.constructor.name).toBe('NodeHandle');
      expect(nodeHandle.id).toBe(nodeId);
    });
  });
});