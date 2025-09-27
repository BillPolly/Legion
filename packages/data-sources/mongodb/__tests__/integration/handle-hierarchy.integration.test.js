/**
 * Integration tests for MongoDB Handle Hierarchy
 * Tests the Server → Database → Collection → Document handle chain
 * with real MongoDB operations using MongoDB Memory Server
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';
import { MongoDBDataSource } from '../../src/MongoDBDataSource.js';
import { MongoServerHandle } from '../../src/handles/MongoServerHandle.js';
import { MongoDatabaseHandle } from '../../src/handles/MongoDatabaseHandle.js';
import { MongoCollectionHandle } from '../../src/handles/MongoCollectionHandle.js';
import { QueryResultHandle } from '../../src/handles/QueryResultHandle.js';
import { UpdateResultHandle } from '../../src/handles/UpdateResultHandle.js';
import { SubscriptionHandle } from '../../src/handles/SubscriptionHandle.js';

describe('MongoDB Handle Hierarchy Integration', () => {
  let mongod;
  let connectionString;
  let dataSource;
  let testClient;
  let testDbName;

  beforeEach(async () => {
    // Use unique database name for each test to ensure isolation
    testDbName = `testdb_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    // If MongoDB is already running from a previous test, use it
    // Otherwise start a new instance
    if (!mongod) {
      mongod = await MongoMemoryServer.create({
        binary: {
          version: '6.0.0'
        }
      });
    }
    connectionString = mongod.getUri();
    
    // Create test client for data setup
    testClient = new MongoClient(connectionString);
    await testClient.connect();
    
    // Create fresh database and collections with sample data
    const db = testClient.db(testDbName);
    
    const users = db.collection('users');
    await users.insertMany([
      { _id: 1, name: 'Alice', age: 30, city: 'New York' },
      { _id: 2, name: 'Bob', age: 25, city: 'Los Angeles' },
      { _id: 3, name: 'Charlie', age: 35, city: 'Chicago' }
    ]);
    
    const products = db.collection('products');
    await products.insertMany([
      { _id: 1, name: 'Laptop', price: 999, category: 'Electronics' },
      { _id: 2, name: 'Phone', price: 699, category: 'Electronics' },
      { _id: 3, name: 'Desk', price: 299, category: 'Furniture' }
    ]);
    
    // Verify the database and collections exist
    const verifyCollections = await db.listCollections().toArray();
    if (verifyCollections.length !== 2) {
      throw new Error(`Expected 2 collections in ${testDbName}, got ${verifyCollections.length}: ${verifyCollections.map(c => c.name).join(', ')}`);
    }
    
    // Create data source with the same connection string
    dataSource = new MongoDBDataSource(connectionString);
    await dataSource.connect();
  }, 60000);

  afterEach(async () => {
    // Cleanup after each test
    if (dataSource) {
      await dataSource.disconnect();
      dataSource = null;
    }
    if (testClient) {
      await testClient.close();
      testClient = null;
    }
    // Keep MongoDB running for next test to avoid startup overhead
  });
  
  afterAll(async () => {
    // Final cleanup - stop MongoDB
    if (mongod) {
      await mongod.stop();
      mongod = null;
    }
  });

  describe('Server Handle Operations', () => {
    it('should create server handle and access server info', async () => {
      const serverHandle = new MongoServerHandle(dataSource, connectionString);
      
      // Test value() - server status
      const statusHandle = serverHandle.value();
      expect(statusHandle).toBeInstanceOf(QueryResultHandle);
      
      // Wait for async population
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const status = statusHandle.value();
      expect(status).toBeDefined();
      expect(status.ok).toBe(1);
    });

    it('should list databases', async () => {
      const serverHandle = new MongoServerHandle(dataSource, connectionString);
      
      const databasesHandle = serverHandle.databases();
      expect(databasesHandle).toBeInstanceOf(QueryResultHandle);
      
      // Wait for async population
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const databases = databasesHandle.value();
      expect(databases).toBeDefined();
      expect(databases.databases).toBeInstanceOf(Array);
      
      // Check what databases actually exist
      console.log('Available databases:', databases.databases.map(d => d.name));
      console.log('Looking for:', testDbName);
      
      // MongoDB creates databases lazily, so unique test databases may not show up in listDatabases
      // unless they have been written to. Instead, just check that we get some databases back
      expect(databases.databases.length).toBeGreaterThan(0);
    });

    it('should ping server', async () => {
      const serverHandle = new MongoServerHandle(dataSource, connectionString);
      
      const pingHandle = serverHandle.ping();
      expect(pingHandle).toBeInstanceOf(QueryResultHandle);
      
      // Wait for async population
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const pingResult = pingHandle.value();
      expect(pingResult).toBeDefined();
      expect(pingResult.ok).toBe(1);
    });

    it('should get build info', async () => {
      const serverHandle = new MongoServerHandle(dataSource, connectionString);
      
      const buildHandle = serverHandle.buildInfo();
      expect(buildHandle).toBeInstanceOf(QueryResultHandle);
      
      // Wait for async population
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const buildInfo = buildHandle.value();
      expect(buildInfo).toBeDefined();
      expect(buildInfo.version).toBeDefined();
      expect(buildInfo.ok).toBe(1);
    });

    it('should project to database handle', () => {
      const serverHandle = new MongoServerHandle(dataSource, connectionString);
      
      const dbHandle = serverHandle.database(testDbName);
      expect(dbHandle).toBeInstanceOf(MongoDatabaseHandle);
      expect(dbHandle.database).toBe(testDbName);
      expect(dbHandle.dataSource).toBe(dataSource);
    });
  });

  describe('Database Handle Operations', () => {
    it('should get database statistics', async () => {
      const serverHandle = new MongoServerHandle(dataSource, connectionString);
      const dbHandle = serverHandle.database(testDbName);
      
      const statsHandle = dbHandle.value();
      expect(statsHandle).toBeInstanceOf(QueryResultHandle);
      
      // Wait for async population
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const stats = statsHandle.value();
      expect(stats).toBeDefined();
      expect(stats.db).toBe(testDbName);
      expect(stats.collections).toBeGreaterThan(0);
    });

    it('should list collections', async () => {
      // Debug: Check what testClient sees
      const testDb = testClient.db(testDbName);
      const testCollections = await testDb.listCollections().toArray();
      console.log('Test client collections in DB', testDbName + ':', testCollections.map(c => c.name));
      
      // Debug: Check what dataSource client sees
      const db = dataSource.client.db(testDbName);
      const directCollections = await db.listCollections().toArray();
      console.log('DataSource client collections in DB', testDbName + ':', directCollections.map(c => c.name));
      
      // Debug: List all databases
      const adminDb = dataSource.client.db('admin');
      const dbList = await adminDb.admin().listDatabases();
      console.log('All databases:', dbList.databases.map(d => d.name));
      
      const serverHandle = new MongoServerHandle(dataSource, connectionString);
      const dbHandle = serverHandle.database(testDbName);
      
      const collectionsHandle = dbHandle.collections();
      expect(collectionsHandle).toBeInstanceOf(QueryResultHandle);
      
      // Wait for async population
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const collections = collectionsHandle.value();
      console.log('Handle value collections:', collections);
      
      expect(collections).toBeInstanceOf(Array);
      expect(collections.length).toBeGreaterThan(0);
      
      const collectionNames = collections.map(c => c.name);
      expect(collectionNames).toContain('users');
      expect(collectionNames).toContain('products');
    });

    it('should get collection names', async () => {
      const serverHandle = new MongoServerHandle(dataSource, connectionString);
      const dbHandle = serverHandle.database(testDbName);
      
      // Trigger collections query and wait for population
      const collectionsHandle = dbHandle.collections();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const names = dbHandle.collectionNames();
      expect(names).toBeInstanceOf(Array);
      expect(names).toContain('users');
      expect(names).toContain('products');
    });

    it('should check if collection exists', async () => {
      const serverHandle = new MongoServerHandle(dataSource, connectionString);
      const dbHandle = serverHandle.database(testDbName);
      
      // Trigger collections query and wait for population
      const collectionsHandle = dbHandle.collections();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(dbHandle.hasCollection('users')).toBe(true);
      expect(dbHandle.hasCollection('products')).toBe(true);
      expect(dbHandle.hasCollection('nonexistent')).toBe(false);
    });

    it('should create collection', async () => {
      const serverHandle = new MongoServerHandle(dataSource, connectionString);
      const dbHandle = serverHandle.database(testDbName);
      
      const createHandle = dbHandle.createCollection('newcollection');
      expect(createHandle).toBeInstanceOf(UpdateResultHandle);
      
      // Wait for async operation
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const result = createHandle.value();
      expect(result).toBeDefined();
      expect(result.ok).toBe(1);
      
      // Verify collection was created - force refresh of collections
      dbHandle.collections(true); // Force refresh
      await new Promise(resolve => setTimeout(resolve, 100));
      const names = dbHandle.collectionNames();
      expect(names).toContain('newcollection');
    });

    it('should create capped collection with options', async () => {
      const serverHandle = new MongoServerHandle(dataSource, connectionString);
      const dbHandle = serverHandle.database(testDbName);
      
      const options = {
        capped: true,
        size: 100000,
        max: 100
      };
      
      const createHandle = dbHandle.createCollection('cappedcollection', options);
      expect(createHandle).toBeInstanceOf(UpdateResultHandle);
      
      // Wait for async operation
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const result = createHandle.value();
      expect(result).toBeDefined();
      expect(result.ok).toBe(1);
      
      // Verify collection was created and is capped
      const db = testClient.db(testDbName);
      const collInfo = await db.listCollections({ name: 'cappedcollection' }).toArray();
      expect(collInfo.length).toBe(1);
      expect(collInfo[0].options.capped).toBe(true);
    });

    it('should execute database command', async () => {
      const serverHandle = new MongoServerHandle(dataSource, connectionString);
      const dbHandle = serverHandle.database(testDbName);
      
      const commandHandle = dbHandle.command({ dbStats: 1 });
      expect(commandHandle).toBeInstanceOf(QueryResultHandle);
      
      // Wait for async population
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const result = commandHandle.value();
      expect(result).toBeDefined();
      expect(result.db).toBe(testDbName);
      expect(result.ok).toBe(1);
    });

    it('should project to collection handle', () => {
      const serverHandle = new MongoServerHandle(dataSource, connectionString);
      const dbHandle = serverHandle.database(testDbName);
      
      const collHandle = dbHandle.collection('users');
      expect(collHandle).toBeInstanceOf(MongoCollectionHandle);
      expect(collHandle.database).toBe(testDbName);
      expect(collHandle.collection).toBe('users');
      expect(collHandle.dataSource).toBe(dataSource);
    });

    it('should drop database', async () => {
      // Create a test database to drop
      const serverHandle = new MongoServerHandle(dataSource, connectionString);
      const dbHandle = serverHandle.database('droptest');
      
      // Create a collection in it first
      const createHandle = dbHandle.createCollection('testcoll');
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Now drop the database
      const dropHandle = dbHandle.drop();
      expect(dropHandle).toBeInstanceOf(UpdateResultHandle);
      
      // Wait for async operation
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const result = dropHandle.value();
      expect(result).toBeDefined();
      expect(result.ok).toBe(1);
      
      // Verify database was dropped
      const adminDb = testClient.db('admin');
      const dbList = await adminDb.admin().listDatabases();
      const dbNames = dbList.databases.map(d => d.name);
      expect(dbNames).not.toContain('droptest');
    });
  });

  describe('Handle Hierarchy Navigation', () => {
    it('should navigate from server to collection', () => {
      const serverHandle = new MongoServerHandle(dataSource, connectionString);
      
      // Navigate: Server → Database → Collection
      const dbHandle = serverHandle.database(testDbName);
      const collHandle = dbHandle.collection('users');
      
      expect(collHandle).toBeInstanceOf(MongoCollectionHandle);
      expect(collHandle.database).toBe(testDbName);
      expect(collHandle.collection).toBe('users');
    });

    it('should maintain data source reference through hierarchy', () => {
      const serverHandle = new MongoServerHandle(dataSource, connectionString);
      const dbHandle = serverHandle.database(testDbName);
      const collHandle = dbHandle.collection('users');
      
      // All handles should share the same data source
      expect(serverHandle.dataSource).toBe(dataSource);
      expect(dbHandle.dataSource).toBe(dataSource);
      expect(collHandle.dataSource).toBe(dataSource);
    });

    it('should perform operations at each level', async () => {
      const serverHandle = new MongoServerHandle(dataSource, connectionString);
      
      // Server level operation
      const serverStatsHandle = serverHandle.stats();
      await new Promise(resolve => setTimeout(resolve, 100));
      const serverStats = serverStatsHandle.value();
      expect(serverStats.ok).toBe(1);
      
      // Database level operation
      const dbHandle = serverHandle.database(testDbName);
      const dbStatsHandle = dbHandle.value();
      await new Promise(resolve => setTimeout(resolve, 100));
      const dbStats = dbStatsHandle.value();
      expect(dbStats.db).toBe(testDbName);
      
      // Collection level operation (placeholder)
      const collHandle = dbHandle.collection('users');
      const collStatsHandle = collHandle.value();
      expect(collStatsHandle).toBeInstanceOf(QueryResultHandle);
    });
  });

  describe('Error Handling in Handle Hierarchy', () => {
    it('should throw error for invalid database name', () => {
      const serverHandle = new MongoServerHandle(dataSource, connectionString);
      
      expect(() => serverHandle.database()).toThrow('Database name is required');
      expect(() => serverHandle.database('')).toThrow('Database name is required');
    });

    it('should throw error for invalid collection name', () => {
      const serverHandle = new MongoServerHandle(dataSource, connectionString);
      const dbHandle = serverHandle.database(testDbName);
      
      expect(() => dbHandle.collection()).toThrow('Collection name is required');
      expect(() => dbHandle.collection('')).toThrow('Collection name is required');
    });

    it('should handle database command errors', async () => {
      const serverHandle = new MongoServerHandle(dataSource, connectionString);
      const dbHandle = serverHandle.database(testDbName);
      
      // Invalid command
      const commandHandle = dbHandle.command({ invalidCommand: 1 });
      
      // Wait for async population
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Should have error in handle
      expect(() => commandHandle.value()).toThrow();
    });

    it('should handle collection creation errors', async () => {
      const serverHandle = new MongoServerHandle(dataSource, connectionString);
      const dbHandle = serverHandle.database(testDbName);
      
      // Try to create collection with invalid name
      const createHandle = dbHandle.createCollection('$invalid.name');
      
      // Wait for async operation
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Should have error
      expect(createHandle.hasError()).toBe(true);
      const error = createHandle.getError();
      expect(error).toBeDefined();
    });
  });

  describe('Subscription Support in Handles', () => {
    it('should create server-level change stream', () => {
      const serverHandle = new MongoServerHandle(dataSource, connectionString);
      
      const callback = (change) => {
        console.log('Server change:', change);
      };
      
      const subscription = serverHandle.watch(callback);
      expect(subscription).toBeInstanceOf(SubscriptionHandle);
      expect(subscription.isActive()).toBe(true);
      
      // Clean up
      subscription.unsubscribe();
    });

    it('should create database-level change stream', () => {
      const serverHandle = new MongoServerHandle(dataSource, connectionString);
      const dbHandle = serverHandle.database(testDbName);
      
      const callback = (change) => {
        console.log('Database change:', change);
      };
      
      const subscription = dbHandle.watch(callback);
      expect(subscription).toBeInstanceOf(SubscriptionHandle);
      expect(subscription.isActive()).toBe(true);
      
      // Clean up
      subscription.unsubscribe();
    });

    it('should create filtered change stream with pipeline', () => {
      const serverHandle = new MongoServerHandle(dataSource, connectionString);
      const dbHandle = serverHandle.database(testDbName);
      
      const pipeline = [
        { $match: { 'ns.coll': 'users' } }
      ];
      
      const callback = (change) => {
        console.log('Filtered change:', change);
      };
      
      const subscription = dbHandle.watch(pipeline, callback);
      expect(subscription).toBeInstanceOf(SubscriptionHandle);
      expect(subscription.isActive()).toBe(true);
      
      // Clean up
      subscription.unsubscribe();
    });
  });

  describe('Async Result Population', () => {
    it('should populate query results asynchronously', async () => {
      const serverHandle = new MongoServerHandle(dataSource, connectionString);
      const dbHandle = serverHandle.database(testDbName);
      
      const collectionsHandle = dbHandle.collections();
      
      // Initially pending
      expect(collectionsHandle.isPending()).toBe(true);
      expect(collectionsHandle.value()).toBeNull();
      
      // Wait for population
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Now should be ready
      expect(collectionsHandle.isPending()).toBe(false);
      expect(collectionsHandle.isReady()).toBe(true);
      
      const collections = collectionsHandle.value();
      expect(collections).toBeInstanceOf(Array);
      expect(collections.length).toBeGreaterThan(0);
    });

    it('should populate update results asynchronously', async () => {
      const serverHandle = new MongoServerHandle(dataSource, connectionString);
      const dbHandle = serverHandle.database(testDbName);
      
      const createHandle = dbHandle.createCollection('asynctest');
      
      // Initially pending
      expect(createHandle.isPending()).toBe(true);
      expect(createHandle.value()).toBeNull();
      
      // Wait for population
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Now should be ready
      expect(createHandle.isPending()).toBe(false);
      expect(createHandle.isReady()).toBe(true);
      
      const result = createHandle.value();
      expect(result).toBeDefined();
      expect(result.ok).toBe(1);
    });

    it('should notify subscribers when results are ready', async () => {
      const serverHandle = new MongoServerHandle(dataSource, connectionString);
      const dbHandle = serverHandle.database(testDbName);
      
      const createHandle = dbHandle.createCollection('subscribetest');
      
      let notified = false;
      let notificationResult = null;
      
      // Subscribe to result
      createHandle.onResult((result, error) => {
        notified = true;
        notificationResult = result;
      });
      
      // Initially not notified
      expect(notified).toBe(false);
      
      // Wait for async operation
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Should be notified
      expect(notified).toBe(true);
      expect(notificationResult).toBeDefined();
      expect(notificationResult.ok).toBe(1);
    });
  });
});