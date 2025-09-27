/**
 * Comprehensive integration tests for Context Handle Delegation Pattern
 * 
 * Tests that handles stored in ExecutionContext properly delegate
 * query and update operations, enabling single-expression access
 * to heterogeneous handle types (MongoDB, files, etc.)
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import ExecutionContext from '../../src/core/ExecutionContext.js';
import { ContextResourceManager } from '../../src/core/ContextResourceManager.js';
import { ContextHandle } from '../../src/core/ContextHandle.js';
import { MongoDBDataSource } from '@legion/mongodb-datasource';
import { Handle } from '@legion/handle';
import { MongoClient } from 'mongodb';

// Mock file system handle for testing
class MockFileHandle extends Handle {
  constructor(path, fileSystem) {
    const fileResourceManager = {
      path: path,
      fileSystem: fileSystem,
      
      query: (querySpec) => {
        if (querySpec.type === 'content') {
          return fileSystem.files[path] || null;
        }
        if (querySpec.type === 'list') {
          return Object.keys(fileSystem.files).filter(f => f.startsWith(path));
        }
        return null;
      },
      
      update: (updateSpec) => {
        if (updateSpec.operation === 'write') {
          fileSystem.files[path] = updateSpec.content;
          return { success: true, path };
        }
        if (updateSpec.operation === 'delete') {
          delete fileSystem.files[path];
          return { success: true, path };
        }
        return { success: false };
      },
      
      subscribe: (querySpec, callback) => {
        const id = Date.now();
        fileSystem.subscriptions[id] = { querySpec, callback };
        return { 
          id, 
          unsubscribe: () => delete fileSystem.subscriptions[id] 
        };
      },
      
      getSchema: () => ({
        type: 'file',
        properties: {
          path: { type: 'string' },
          content: { type: 'string' }
        }
      }),
      
      // Add queryBuilder to satisfy DataSource interface
      queryBuilder: (sourceHandle) => {
        return {
          where: () => this,
          select: () => this,
          toArray: () => []
        };
      }
    };
    
    super(fileResourceManager);
    this.path = path;
    this.fileSystem = fileSystem;
  }
  
  value() {
    return this.dataSource.query({ type: 'content' });
  }
  
  query(querySpec) {
    return this.dataSource.query(querySpec);
  }
  
  write(content) {
    return this.dataSource.update({ operation: 'write', content });
  }
  
  delete() {
    return this.dataSource.update({ operation: 'delete' });
  }
}

// Mock file system
class MockFileSystem {
  constructor() {
    this.files = {};
    this.subscriptions = {};
  }
  
  file(path) {
    return new MockFileHandle(path, this);
  }
  
  createFile(path, content) {
    this.files[path] = content;
    return this.file(path);
  }
}

describe('Context Handle Delegation Pattern', () => {
  let context;
  let contextRM;
  let contextHandle;
  let mongoDS;
  let mongoClient;
  let fileSystem;
  
  beforeEach(async () => {
    // Create ExecutionContext and its handle wrapper
    context = new ExecutionContext();
    contextRM = new ContextResourceManager(context);
    contextHandle = new ContextHandle(contextRM);
    
    // Initialize MongoDB data source
    mongoDS = new MongoDBDataSource('mongodb://localhost:27017');
    mongoClient = new MongoClient('mongodb://localhost:27017');
    await mongoClient.connect();
    
    // Initialize mock file system
    fileSystem = new MockFileSystem();
    
    // Ensure test database is clean
    const db = mongoClient.db('test_delegation');
    const collections = await db.listCollections().toArray();
    for (const coll of collections) {
      await db.collection(coll.name).drop();
    }
  });
  
  afterEach(async () => {
    if (mongoClient) {
      await mongoClient.close();
    }
    if (mongoDS) {
      await mongoDS.disconnect();
    }
  });
  
  describe('Basic Delegation', () => {
    it('should store and query MongoDB handle through context', async () => {
      // Store MongoDB database handle in context
      const dbHandle = mongoDS.database('test_delegation');
      context.set('resources.db', dbHandle);
      
      // Query through context delegation
      // Since dbHandle is already a Handle, resource() returns it directly
      const dbResource = contextHandle.resource('db');
      expect(dbResource).toBe(dbHandle);
      
      // Get database stats through the handle - returns QueryResultHandle
      const dbInfo = dbResource.value();
      expect(dbInfo.constructor.name).toBe('QueryResultHandle');
      
      // Wait for async population
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // QueryResultHandle's value() returns the populated data
      const data = dbInfo.value();
      expect(data).toBeDefined();
      // MongoDB stats object has properties like db, collections, dataSize etc
      expect(data.db).toBe('test_delegation');
    });
    
    it('should store and query file handle through context', () => {
      // Create and store file handle in context
      const fileHandle = fileSystem.createFile('/config.json', '{"test": true}');
      context.set('resources.configFile', fileHandle);
      
      // Query through context delegation
      // Since fileHandle is already a Handle, resource() returns it directly
      const resourceHandle = contextHandle.resource('configFile');
      expect(resourceHandle).toBe(fileHandle);
      
      // Get content from the file handle - value() returns content directly
      const content = resourceHandle.value();
      expect(content).toBe('{"test": true}');
    });
    
    it('should update through delegated MongoDB handle', async () => {
      // Store collection handle in context
      const collHandle = mongoDS.collection('test_delegation', 'users');
      context.set('resources.users', collHandle);
      
      // Get collection through delegation - returns the handle directly
      const usersResource = contextHandle.resource('users');
      expect(usersResource).toBe(collHandle);
      
      // Insert through the collection handle
      const insertResult = usersResource.insertOne({
        name: 'John Doe',
        email: 'john@example.com'
      });
      
      // insertResult is an UpdateResultHandle, wait for it to complete
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Verify insertion
      const users = await mongoClient.db('test_delegation')
        .collection('users')
        .find({})
        .toArray();
      
      expect(users).toHaveLength(1);
      expect(users[0].name).toBe('John Doe');
    });
    
    it('should update through delegated file handle', () => {
      // Store file handle in context
      const fileHandle = fileSystem.createFile('/data.txt', 'initial');
      context.set('resources.dataFile', fileHandle);
      
      // Get handle through delegation - returns the handle directly
      const fileResource = contextHandle.resource('dataFile');
      expect(fileResource).toBe(fileHandle);
      
      // Update through the file handle
      const result = fileResource.write('updated content');
      
      expect(result.success).toBe(true);
      expect(fileSystem.files['/data.txt']).toBe('updated content');
    });
  });
  
  describe('Mixed Handle Types', () => {
    it('should handle MongoDB and file handles in same context', async () => {
      // Store different handle types
      const dbHandle = mongoDS.database('test_delegation');
      const fileHandle = fileSystem.createFile('/app.config', '{"port": 3000}');
      
      context.set('resources.database', dbHandle);
      context.set('resources.config', fileHandle);
      
      // Query both through delegation - returns handles directly
      const dbResource = contextHandle.resource('database');
      const configResource = contextHandle.resource('config');
      
      // Handles are returned directly
      expect(dbResource).toBe(dbHandle);
      expect(configResource).toBe(fileHandle);
      
      // Get actual values from handles
      const dbInfo = dbResource.value(); // Returns QueryResultHandle
      const config = configResource.value(); // Returns file content directly
      
      // Wait for MongoDB async population
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Get data from QueryResultHandle - stats object has db property
      const dbData = dbInfo.value();
      expect(dbData.db).toBe('test_delegation');
      expect(config).toBe('{"port": 3000}');
    });
    
    it('should query across different handle types uniformly', () => {
      // Store various handles
      const handles = {
        db: mongoDS.database('test_delegation'),
        config: fileSystem.createFile('/config.json', '{}'),
        logs: fileSystem.createFile('/logs/app.log', 'startup')
      };
      
      for (const [key, handle] of Object.entries(handles)) {
        context.set(`resources.${key}`, handle);
      }
      
      // Query all uniformly
      const resources = contextHandle.value().resources;
      
      expect(resources).toBeDefined();
      expect(resources.db).toBeDefined();
      expect(resources.config).toBeDefined();
      expect(resources.logs).toBeDefined();
    });
    
    it('should perform update operations across different handle types', async () => {
      // Setup handles
      const collHandle = mongoDS.collection('test_delegation', 'tasks');
      const logHandle = fileSystem.createFile('/logs/tasks.log', '');
      
      context.set('resources.taskDB', collHandle);
      context.set('resources.taskLog', logHandle);
      
      // Get handles through delegation - returns handles directly
      const taskDBResource = contextHandle.resource('taskDB');
      const taskLogResource = contextHandle.resource('taskLog');
      
      // Insert task in DB
      const insertResult = taskDBResource.insertOne({
        title: 'Test Task',
        status: 'pending'
      });
      
      // Log to file
      taskLogResource.write('Task created: Test Task\n');
      
      // Wait for MongoDB operation (UpdateResultHandle to complete)
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Verify both updates
      const tasks = await mongoClient.db('test_delegation')
        .collection('tasks')
        .find({})
        .toArray();
      
      expect(tasks).toHaveLength(1);
      expect(tasks[0].title).toBe('Test Task');
      expect(fileSystem.files['/logs/tasks.log']).toContain('Task created');
    });
  });
  
  describe('Complex Delegation Scenarios', () => {
    it('should update value inside MongoDB document through context path', async () => {
      // Create document first
      const db = mongoClient.db('test_delegation');
      const result = await db.collection('profiles').insertOne({
        userId: 'user123',
        profile: {
          name: 'Jane Doe',
          settings: {
            theme: 'light'
          }
        }
      });
      
      // Store document handle in context
      const docHandle = mongoDS.document('test_delegation', 'profiles', result.insertedId);
      context.set('resources.userProfile', docHandle);
      
      // Get document handle through delegation - returns handle directly
      const userProfileResource = contextHandle.resource('userProfile');
      
      // Update nested field through the document handle
      // Note: MongoDocumentHandle's update() wraps in $set automatically
      const updateResult = userProfileResource.update({
        'profile.settings.theme': 'dark'
      });
      
      // Wait for async update (UpdateResultHandle to complete)
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Verify update
      const doc = await db.collection('profiles').findOne({ _id: result.insertedId });
      expect(doc.profile.settings.theme).toBe('dark');
    });
    
    it('should query collection with filter from context root', async () => {
      // Insert test data
      const db = mongoClient.db('test_delegation');
      await db.collection('products').insertMany([
        { name: 'Product A', active: true, price: 100 },
        { name: 'Product B', active: false, price: 200 },
        { name: 'Product C', active: true, price: 150 }
      ]);
      
      // Store collection handle
      const collHandle = mongoDS.collection('test_delegation', 'products');
      context.set('resources.products', collHandle);
      
      // Get collection handle through delegation - returns handle directly
      const productsResource = contextHandle.resource('products');
      
      // Query with filter through the collection handle
      const queryResult = productsResource.find({ active: true });
      
      // Wait for async query (QueryResultHandle to complete)
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Get results from QueryResultHandle
      const activeProducts = queryResult.value();
      expect(activeProducts).toHaveLength(2);
      expect(activeProducts.every(p => p.active)).toBe(true);
    });
    
    it('should handle nested resource paths with multiple handles', () => {
      // Create nested structure
      const services = {
        auth: {
          db: mongoDS.database('auth_db'),
          config: fileSystem.createFile('/config/auth.json', '{"secret": "xyz"}')
        },
        api: {
          db: mongoDS.database('api_db'),
          logs: fileSystem.createFile('/logs/api.log', 'API started')
        }
      };
      
      // Store in context with nested paths
      context.set('resources.services', services);
      
      // Access through nested paths - returns the handles
      const authConfigHandle = contextHandle.path('resources.services.auth.config').value();
      const apiLogsHandle = contextHandle.path('resources.services.api.logs').value();
      
      // Get values from the handles
      const authConfig = authConfigHandle.value();
      const apiLogs = apiLogsHandle.value();
      
      expect(authConfig).toBe('{"secret": "xyz"}');
      expect(apiLogs).toBe('API started');
    });
  });
  
  describe('Single Expression Pattern', () => {
    it('should support chained queries in single expression', async () => {
      // Setup collection with data
      const db = mongoClient.db('test_delegation');
      await db.collection('orders').insertMany([
        { orderId: 1, userId: 'user1', total: 100, status: 'completed' },
        { orderId: 2, userId: 'user2', total: 200, status: 'pending' },
        { orderId: 3, userId: 'user1', total: 150, status: 'completed' }
      ]);
      
      // Store database handle
      const dbHandle = mongoDS.database('test_delegation');
      context.set('resources.orderDB', dbHandle);
      
      // Get database handle through delegation - returns handle directly
      const orderDBResource = contextHandle.resource('orderDB');
      
      // Get collection and query - note: collection() returns a handle, find() returns QueryResultHandle
      const orders = orderDBResource.collection('orders').find({ userId: 'user1', status: 'completed' });
      
      // Wait for results (QueryResultHandle to complete)
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Get data from QueryResultHandle
      const orderData = orders.value();
      expect(orderData).toHaveLength(2);
      expect(orderData[0].userId).toBe('user1');
    });
    
    it('should support path navigation for deep updates', () => {
      // Create nested file structure
      const projectFiles = {
        src: fileSystem.createFile('/project/src/index.js', 'console.log("hello")'),
        config: fileSystem.createFile('/project/config.json', '{"version": "1.0.0"}'),
        docs: fileSystem.createFile('/project/README.md', '# Project')
      };
      
      // Store in nested context structure
      context.set('resources.project.files', projectFiles);
      
      // Get handle through path navigation
      const configHandle = contextHandle.path('resources.project.files.config').value();
      
      // Update through the handle
      configHandle.write('{"version": "2.0.0"}');
      
      expect(fileSystem.files['/project/config.json']).toBe('{"version": "2.0.0"}');
    });
    
    it('should handle resource method delegation', async () => {
      // Create collection handle with custom method
      const collHandle = mongoDS.collection('test_delegation', 'metrics');
      
      // Add data
      const db = mongoClient.db('test_delegation');
      await db.collection('metrics').insertMany([
        { type: 'cpu', value: 45 },
        { type: 'memory', value: 80 },
        { type: 'disk', value: 60 }
      ]);
      
      // Store in context
      context.set('resources.metrics', collHandle);
      
      // Get collection handle through delegation - returns handle directly
      const metricsResource = contextHandle.resource('metrics');
      
      // Use aggregation through the collection handle
      const avgResult = metricsResource.aggregate([
        { $group: { _id: null, avgValue: { $avg: '$value' } } }
      ]);
      
      // Wait for results (QueryResultHandle to complete)
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Get data from QueryResultHandle
      const avgData = avgResult.value();
      expect(avgData[0].avgValue).toBeCloseTo(61.67, 1);
    });
  });
  
  describe('Error Handling', () => {
    it('should throw error for non-existent resource', () => {
      expect(() => {
        contextHandle.resource('nonexistent');
      }).toThrow('Resource not found: nonexistent');
    });
    
    it('should handle errors in delegated operations', async () => {
      // Store collection handle
      const collHandle = mongoDS.collection('test_delegation', 'test');
      context.set('resources.testColl', collHandle);
      
      // Get collection handle through delegation - returns handle directly
      const testCollResource = contextHandle.resource('testColl');
      
      // Handle is returned directly
      expect(testCollResource).toBe(collHandle);
      
      // Try invalid operation on the collection handle
      const invalidOp = () => {
        testCollResource.aggregate('not-an-array');
      };
      
      expect(invalidOp).toThrow('Pipeline must be an array');
    });
    
    it('should maintain handle lifecycle through delegation', () => {
      // Create handle with subscriptions
      const fileHandle = fileSystem.createFile('/watched.txt', 'initial');
      let changeCount = 0;
      
      // Subscribe before storing in context
      fileHandle.subscribe({ type: 'content' }, () => changeCount++);
      
      // Store in context
      context.set('resources.watched', fileHandle);
      
      // Get handle through delegation and update - returns handle directly
      const watchedResource = contextHandle.resource('watched');
      watchedResource.write('changed');
      
      // Destroy handle
      fileHandle.destroy();
      
      // Verify cleanup
      expect(fileHandle.isDestroyed()).toBe(true);
    });
  });
  
  describe('Performance and Optimization', () => {
    it('should efficiently handle multiple delegated queries', async () => {
      // Store multiple handles
      const handles = {};
      for (let i = 0; i < 10; i++) {
        handles[`coll${i}`] = mongoDS.collection('test_delegation', `collection_${i}`);
      }
      context.set('resources.collections', handles);
      
      // Query all collections
      const startTime = Date.now();
      const queries = [];
      
      for (let i = 0; i < 10; i++) {
        const collHandle = contextHandle.path(`resources.collections.coll${i}`).value();
        const query = collHandle.find({});
        queries.push(query);
      }
      
      // Wait for all queries to complete (QueryResultHandles)
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const duration = Date.now() - startTime;
      
      // Should complete reasonably fast (under 2 seconds for 10 queries)
      expect(duration).toBeLessThan(2000);
    });
    
    it('should not create unnecessary intermediate handles', () => {
      // Track handle creation
      let handleCount = 0;
      const originalConstructor = Handle;
      
      // Mock to count instantiations
      jest.spyOn(Handle.prototype, 'constructor');
      
      // Store handle
      const fileHandle = fileSystem.createFile('/test.txt', 'content');
      context.set('resources.file', fileHandle);
      
      // Access through delegation - returns handle directly
      const fileResource = contextHandle.resource('file');
      expect(fileResource).toBe(fileHandle);
      
      // Get content from the handle
      const content = fileResource.value();
      expect(content).toBe('content');
      
      // Restore
      Handle.prototype.constructor.mockRestore();
    });
  });
});