/**
 * Integration tests for Neo4j DataSource and Handle pattern
 */

import { Neo4jDataSource } from '../../src/datasources/Neo4jDataSource.js';
import { ResourceManager } from '../../src/index.js';
import { jest } from '@jest/globals';

describe('Neo4j DataSource and Handle Integration', () => {
  let resourceManager;
  let dataSource;
  let graphHandle;
  
  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
    dataSource = new Neo4jDataSource(resourceManager);
    await dataSource.initialize();
    graphHandle = dataSource.createHandle();
  });
  
  afterAll(async () => {
    // Clean up any test data
    try {
      await dataSource.queryAsync({
        type: 'cypher',
        query: 'MATCH (n:TestNode) DETACH DELETE n'
      });
    } catch (error) {
      console.log('Cleanup error (expected):', error.message);
    }
  });

  describe('DataSource Async Interface', () => {
    it('should execute basic Cypher queries', async () => {
      const result = await dataSource.queryAsync({
        type: 'cypher',
        query: 'RETURN 42 as answer, "hello" as greeting'
      });
      
      expect(result.records).toHaveLength(1);
      expect(result.records[0].answer).toBe(42);
      expect(result.records[0].greeting).toBe('hello');
    });
    
    it('should create and retrieve nodes', async () => {
      const createResult = await dataSource.queryAsync({
        type: 'cypher',
        query: 'CREATE (n:TestNode {name: $name, value: $value}) RETURN n',
        params: { name: 'test-node', value: 123 }
      });
      
      expect(createResult.records).toHaveLength(1);
      expect(createResult.records[0].n.labels).toContain('TestNode');
      expect(createResult.records[0].n.properties.name).toBe('test-node');
      expect(createResult.records[0].n.properties.value).toBe(123);
    });
    
    it('should query nodes by label', async () => {
      const result = await dataSource.queryAsync({
        type: 'node',
        labels: ['TestNode'],
        properties: { name: 'test-node' }
      });
      
      expect(result.records.length).toBeGreaterThan(0);
      expect(result.records[0].n.labels).toContain('TestNode');
    });
    
    it('should get schema information', async () => {
      const schema = await dataSource.getSchemaAsync();
      
      expect(schema).toHaveProperty('labels');
      expect(schema).toHaveProperty('relationships');  
      expect(schema).toHaveProperty('properties');
      expect(schema.labels).toContain('TestNode');
    });
  });

  describe('Handle Sync Interface Structure', () => {
    it('should create GraphDatabaseHandle', () => {
      expect(graphHandle).toBeDefined();
      expect(graphHandle._type).toBe('GraphDatabase');
    });
    
    it('should have sync methods that delegate to ResourceManager', () => {
      expect(() => {
        graphHandle.cypher('RETURN 1 as test');
      }).toThrow('Synchronous query wrapper not yet implemented');
      
      expect(() => {
        graphHandle.schema();
      }).toThrow('Synchronous query wrapper not yet implemented');
      
      expect(() => {
        graphHandle.stats();
      }).toThrow('Synchronous query wrapper not yet implemented');
    });
    
    it('should create NodeHandle instances', () => {
      const nodeHandle = dataSource.createNodeHandle('123');
      
      expect(nodeHandle).toBeDefined();
      expect(nodeHandle._type).toBe('Node');
      expect(nodeHandle.id).toBe('123');
    });
    
    it('should have sync NodeHandle methods that delegate to ResourceManager', () => {
      const nodeHandle = dataSource.createNodeHandle('123');
      
      expect(() => {
        nodeHandle.setProperty('name', 'test');
      }).toThrow('Synchronous query wrapper not yet implemented');
      
      expect(() => {
        nodeHandle.addLabel('NewLabel');
      }).toThrow('Synchronous query wrapper not yet implemented');
    });
  });

  describe('Subscription System', () => {
    it('should support subscription registration', () => {
      const callback = jest.fn();
      const unsubscribe = dataSource.subscribe({ type: '*' }, callback);
      
      expect(typeof unsubscribe).toBe('function');
      
      // Unsubscribe to clean up
      unsubscribe();
    });
    
    it('should trigger subscriptions for write operations', async () => {
      const callback = jest.fn();
      dataSource.subscribe({ type: '*' }, callback);
      
      // Perform a write operation
      await dataSource.queryAsync({
        type: 'cypher',
        query: 'CREATE (n:TempNode {temp: true}) RETURN n'
      });
      
      // Wait a brief moment for async subscription trigger
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(callback).toHaveBeenCalledTimes(1); // CREATE operation
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        type: 'create'
      }));
      
      // Clean up the temp node
      await dataSource.queryAsync({
        type: 'cypher',
        query: 'MATCH (n:TempNode {temp: true}) DELETE n'
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid Cypher queries', async () => {
      await expect(
        dataSource.queryAsync({
          type: 'cypher',
          query: 'INVALID CYPHER SYNTAX'
        })
      ).rejects.toThrow();
    });
    
    it('should handle uninitialized DataSource', () => {
      const uninitializedDataSource = new Neo4jDataSource(resourceManager);
      
      expect(() => {
        uninitializedDataSource.query({ type: 'cypher', query: 'RETURN 1' });
      }).toThrow('DataSource not initialized');
    });
  });

  describe('Data Type Conversion', () => {
    it('should convert Neo4j Integers to JavaScript numbers', async () => {
      const result = await dataSource.queryAsync({
        type: 'cypher',
        query: 'RETURN 42 as int, 3.14 as float, "text" as str'
      });
      
      expect(typeof result.records[0].int).toBe('number');
      expect(result.records[0].int).toBe(42);
      expect(typeof result.records[0].float).toBe('number');
      expect(typeof result.records[0].str).toBe('string');
    });
    
    it('should handle arrays and objects', async () => {
      const result = await dataSource.queryAsync({
        type: 'cypher',
        query: 'RETURN [1,2,3] as arr, {key: "value", num: 42} as obj'
      });
      
      expect(Array.isArray(result.records[0].arr)).toBe(true);
      expect(result.records[0].arr).toEqual([1, 2, 3]);
      expect(typeof result.records[0].obj).toBe('object');
      expect(result.records[0].obj.key).toBe('value');
      expect(result.records[0].obj.num).toBe(42);
    });
  });
});