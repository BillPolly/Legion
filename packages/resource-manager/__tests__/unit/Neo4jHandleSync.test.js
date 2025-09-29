/**
 * Tests for Neo4j Handle classes with sync DataSource
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { Neo4jDataSource } from '../../src/datasources/Neo4jDataSource.js';
import { GraphDatabaseHandle } from '../../src/handles/GraphDatabaseHandle.js';
import { NodeHandle } from '../../src/handles/NodeHandle.js';
import { ResourceManager } from '../../src/index.js';

describe('Neo4j Handle Sync Operations', () => {
  let resourceManager;
  let dataSource;
  let graphHandle;

  beforeAll(async () => {
    console.log('Getting ResourceManager singleton...');
    resourceManager = await ResourceManager.getInstance();
    
    // Initialize DataSource
    dataSource = new Neo4jDataSource(resourceManager);
    await dataSource.initialize();
    
    // Create GraphDatabaseHandle
    graphHandle = dataSource.createHandle();
  }, 30000);

  afterAll(async () => {
    // Clean up test data
    console.log('Cleaning up test data...');
    const neo4j = await resourceManager.getNeo4jServer();
    await neo4j.run('MATCH (n:HandleTest) DETACH DELETE n');
    console.log('Test cleanup complete');
  });

  describe('GraphDatabaseHandle Sync Operations', () => {
    it('should execute sync Cypher query', () => {
      const result = graphHandle.cypher('RETURN 42 as answer, "sync" as type');
      
      expect(result).toBeDefined();
      expect(result.records).toHaveLength(1);
      expect(result.records[0].answer).toBe(42);
      expect(result.records[0].type).toBe('sync');
    });

    it('should create node synchronously', () => {
      const nodeHandle = graphHandle.createNode('HandleTest', { 
        name: 'SyncNode',
        value: 100 
      });
      
      expect(nodeHandle).toBeDefined();
      expect(nodeHandle).toBeInstanceOf(NodeHandle);
      expect(nodeHandle.id).toBeDefined();
    });

    it('should query nodes synchronously', () => {
      // Create a test node
      graphHandle.createNode('HandleTest', { 
        name: 'QueryTest',
        type: 'sync' 
      });
      
      // Query for the node
      const nodes = graphHandle.nodes('HandleTest', { type: 'sync' });
      
      expect(nodes).toBeDefined();
      expect(Array.isArray(nodes)).toBe(true);
      expect(nodes.length).toBeGreaterThan(0);
      expect(nodes[0]).toBeInstanceOf(NodeHandle);
    });

    it('should get database stats synchronously', () => {
      const stats = graphHandle.stats();
      
      expect(stats).toBeDefined();
      expect(stats.nodes).toBeDefined();
      expect(stats.relationships).toBeDefined();
      expect(typeof stats.nodes).toBe('number');
      expect(typeof stats.relationships).toBe('number');
    });

    it('should get schema synchronously', async () => {
      // Note: getSchema is still async in the Handle
      const schema = await graphHandle.schema();
      
      expect(schema).toBeDefined();
      expect(schema.labels).toBeDefined();
      expect(Array.isArray(schema.labels)).toBe(true);
      expect(schema.relationships).toBeDefined();
      expect(Array.isArray(schema.relationships)).toBe(true);
    });
  });

  describe('NodeHandle Sync Operations', () => {
    let testNode;

    beforeEach(() => {
      // Create a test node for each test
      testNode = graphHandle.createNode('HandleTest', { 
        name: 'NodeHandleTest',
        value: 50,
        type: 'test'
      });
    });

    it('should get node properties synchronously', () => {
      const properties = testNode.properties;
      
      expect(properties).toBeDefined();
      expect(properties.name).toBe('NodeHandleTest');
      expect(properties.value).toBe(50);
      expect(properties.type).toBe('test');
    });

    it('should get node labels synchronously', () => {
      const labels = testNode.labels;
      
      expect(labels).toBeDefined();
      expect(Array.isArray(labels)).toBe(true);
      expect(labels).toContain('HandleTest');
    });

    it('should set property synchronously', () => {
      testNode.setProperty('newProp', 'newValue');
      
      const properties = testNode.properties;
      expect(properties.newProp).toBe('newValue');
    });

    it('should set multiple properties synchronously', () => {
      testNode.setProperties({ 
        prop1: 'value1',
        prop2: 42,
        prop3: true
      });
      
      const properties = testNode.properties;
      expect(properties.prop1).toBe('value1');
      expect(properties.prop2).toBe(42);
      expect(properties.prop3).toBe(true);
    });

    it('should add label synchronously', () => {
      testNode.addLabel('NewLabel');
      
      const labels = testNode.labels;
      expect(labels).toContain('NewLabel');
    });

    it('should create relationship synchronously', () => {
      // Create target node
      const targetNode = graphHandle.createNode('HandleTest', { 
        name: 'TargetNode' 
      });
      
      // Create relationship
      const relationship = testNode.createRelationshipTo(targetNode, 'LINKS_TO', {
        weight: 5
      });
      
      expect(relationship).toBeDefined();
      expect(relationship.type).toBe('LINKS_TO');
      expect(relationship.properties.weight).toBe(5);
    });

    it('should get relationships synchronously', () => {
      // Create a relationship
      const targetNode = graphHandle.createNode('HandleTest', { name: 'RelTarget' });
      testNode.createRelationshipTo(targetNode, 'TEST_REL');
      
      // Get relationships
      const relationships = testNode.relationships('TEST_REL', 'outgoing');
      
      expect(relationships).toBeDefined();
      expect(Array.isArray(relationships)).toBe(true);
      expect(relationships.length).toBeGreaterThan(0);
    });

    it('should get neighbor nodes synchronously', () => {
      // Create neighbor
      const neighbor = graphHandle.createNode('HandleTest', { name: 'Neighbor' });
      testNode.createRelationshipTo(neighbor, 'NEIGHBOR_OF');
      
      // Get neighbors
      const neighbors = testNode.neighbors('NEIGHBOR_OF', 'outgoing');
      
      expect(neighbors).toBeDefined();
      expect(Array.isArray(neighbors)).toBe(true);
      expect(neighbors.length).toBeGreaterThan(0);
      expect(neighbors[0]).toBeInstanceOf(NodeHandle);
    });

    it('should delete node synchronously', () => {
      const nodeId = testNode.id;
      const result = testNode.delete();
      
      expect(result).toBe(true);
      
      // Verify node is deleted
      const queryResult = graphHandle.cypher('MATCH (n) WHERE id(n) = $id RETURN n', {
        id: parseInt(nodeId)
      });
      
      expect(queryResult.records).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle sync query errors', () => {
      expect(() => {
        graphHandle.cypher('INVALID CYPHER SYNTAX');
      }).toThrow();
    });

    it('should require initialization', () => {
      const uninitializedDS = new Neo4jDataSource(resourceManager);
      const handle = uninitializedDS.createHandle();
      
      expect(() => {
        handle.cypher('RETURN 1');
      }).toThrow('DataSource not initialized');
    });
  });
});