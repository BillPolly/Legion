/**
 * Integration tests for schema discovery
 * Uses MongoDB Memory Server for real database operations
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoDBDataSource } from '../../src/MongoDBDataSource.js';

describe('MongoDBDataSource - Schema Discovery Integration', () => {
  let mongod;
  let dataSource;
  let connectionString;
  
  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    connectionString = mongod.getUri();
  });
  
  afterAll(async () => {
    if (dataSource) {
      await dataSource.disconnect();
    }
    if (mongod) {
      await mongod.stop();
    }
  });
  
  beforeEach(() => {
    dataSource = new MongoDBDataSource({
      connectionString
    });
  });
  
  describe('Collection Schema Discovery', () => {
    it('should discover schema from collection with documents', async () => {
      // Insert test documents
      const insertHandle = dataSource.update({
        level: 'collection',
        database: 'testdb',
        collection: 'users',
        operation: 'insertMany',
        documents: [
          { name: 'Alice', age: 30, email: 'alice@example.com' },
          { name: 'Bob', age: 25, email: 'bob@example.com' },
          { name: 'Charlie', age: 35, email: 'charlie@example.com' }
        ]
      });
      
      // Wait for insert to complete
      await new Promise((resolve, reject) => {
        insertHandle.onData((result, error) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        });
      });
      
      // Discover schema
      const schema = await dataSource.discoverSchema({
        level: 'collection',
        database: 'testdb',
        collection: 'users',
        sampleSize: 10
      });
      
      expect(schema).toBeDefined();
      expect(schema.type).toBe('mongodb');
      expect(schema.database).toBe('testdb');
      expect(schema.collection).toBe('users');
      expect(schema.schema).toBeDefined();
      expect(schema.schema.properties).toBeDefined();
      
      // Should have discovered the fields
      expect(schema.schema.properties.name).toBeDefined();
      expect(schema.schema.properties.age).toBeDefined();
      expect(schema.schema.properties.email).toBeDefined();
      
      // Should have correct types
      expect(schema.schema.properties.name.type).toBe('string');
      expect(schema.schema.properties.age.type).toBe('number');
      expect(schema.schema.properties.email.type).toBe('string');
    });
    
    it('should mark frequently occurring fields as required', async () => {
      // Insert documents with consistent fields
      const insertHandle = dataSource.update({
        level: 'collection',
        database: 'testdb',
        collection: 'products',
        operation: 'insertMany',
        documents: [
          { name: 'Product 1', price: 10, category: 'Electronics' },
          { name: 'Product 2', price: 20, category: 'Electronics' },
          { name: 'Product 3', price: 30, category: 'Electronics' },
          { name: 'Product 4', price: 40, category: 'Electronics' }
        ]
      });
      
      await new Promise((resolve, reject) => {
        insertHandle.onData((result, error) => {
          error ? reject(error) : resolve(result);
        });
      });
      
      const schema = await dataSource.discoverSchema({
        level: 'collection',
        database: 'testdb',
        collection: 'products'
      });
      
      // Fields present in all documents should be marked as required
      expect(schema.schema.required).toBeDefined();
      expect(schema.schema.required).toContain('name');
      expect(schema.schema.required).toContain('price');
      expect(schema.schema.required).toContain('category');
    });
    
    it('should handle nested objects', async () => {
      const insertHandle = dataSource.update({
        level: 'collection',
        database: 'testdb',
        collection: 'profiles',
        operation: 'insertMany',
        documents: [
          {
            username: 'user1',
            profile: {
              firstName: 'John',
              lastName: 'Doe',
              age: 30
            }
          },
          {
            username: 'user2',
            profile: {
              firstName: 'Jane',
              lastName: 'Smith',
              age: 28
            }
          }
        ]
      });
      
      await new Promise((resolve, reject) => {
        insertHandle.onData((result, error) => {
          error ? reject(error) : resolve(result);
        });
      });
      
      const schema = await dataSource.discoverSchema({
        level: 'collection',
        database: 'testdb',
        collection: 'profiles'
      });
      
      // Should discover nested structure
      expect(schema.schema.properties.profile).toBeDefined();
      expect(schema.schema.properties.profile.type).toBe('object');
      expect(schema.schema.properties['profile.firstName']).toBeDefined();
      expect(schema.schema.properties['profile.lastName']).toBeDefined();
    });
    
    it('should handle arrays', async () => {
      const insertHandle = dataSource.update({
        level: 'collection',
        database: 'testdb',
        collection: 'posts',
        operation: 'insertMany',
        documents: [
          {
            title: 'Post 1',
            tags: ['javascript', 'nodejs', 'mongodb']
          },
          {
            title: 'Post 2',
            tags: ['python', 'django']
          }
        ]
      });
      
      await new Promise((resolve, reject) => {
        insertHandle.onData((result, error) => {
          error ? reject(error) : resolve(result);
        });
      });
      
      const schema = await dataSource.discoverSchema({
        level: 'collection',
        database: 'testdb',
        collection: 'posts'
      });
      
      // Should discover array fields
      expect(schema.schema.properties.tags).toBeDefined();
      expect(schema.schema.properties.tags.type).toBe('array');
    });
    
    it('should return empty schema for empty collection', async () => {
      const schema = await dataSource.discoverSchema({
        level: 'collection',
        database: 'testdb',
        collection: 'empty_collection'
      });
      
      expect(schema).toBeDefined();
      expect(schema.schema).toBeDefined();
      expect(schema.schema.properties).toEqual({});
      expect(schema.schema.description).toContain('Empty collection');
    });
    
    it('should include metadata', async () => {
      const insertHandle = dataSource.update({
        level: 'collection',
        database: 'testdb',
        collection: 'items',
        operation: 'insertMany',
        documents: [
          { item: 'Item 1' },
          { item: 'Item 2' }
        ]
      });
      
      await new Promise((resolve, reject) => {
        insertHandle.onData((result, error) => {
          error ? reject(error) : resolve(result);
        });
      });
      
      const schema = await dataSource.discoverSchema({
        level: 'collection',
        database: 'testdb',
        collection: 'items',
        includeIndexes: true,
        includeStats: true
      });
      
      expect(schema.metadata).toBeDefined();
      expect(schema.metadata.sampleSize).toBe(2);
      expect(schema.metadata.totalDocuments).toBe(2);
      expect(schema.metadata.indexes).toBeDefined();
    });
  });
  
  describe('Database Schema Discovery', () => {
    it('should discover schemas for all collections in database', async () => {
      // Create multiple collections with documents
      const insert1 = dataSource.update({
        level: 'collection',
        database: 'multidb',
        collection: 'collection1',
        operation: 'insert',
        document: { field1: 'value1' }
      });
      
      const insert2 = dataSource.update({
        level: 'collection',
        database: 'multidb',
        collection: 'collection2',
        operation: 'insert',
        document: { field2: 'value2' }
      });
      
      await Promise.all([
        new Promise((resolve, reject) => {
          insert1.onData((result, error) => error ? reject(error) : resolve(result));
        }),
        new Promise((resolve, reject) => {
          insert2.onData((result, error) => error ? reject(error) : resolve(result));
        })
      ]);
      
      const schema = await dataSource.discoverSchema({
        level: 'database',
        database: 'multidb'
      });
      
      expect(schema).toBeDefined();
      expect(schema.type).toBe('mongodb');
      expect(schema.database).toBe('multidb');
      expect(schema.collections).toBeDefined();
      expect(schema.collections.collection1).toBeDefined();
      expect(schema.collections.collection2).toBeDefined();
    });
    
    it('should skip system collections', async () => {
      // Insert into regular collection
      const insertHandle = dataSource.update({
        level: 'collection',
        database: 'systemdb',
        collection: 'users',
        operation: 'insert',
        document: { name: 'User' }
      });
      
      await new Promise((resolve, reject) => {
        insertHandle.onData((result, error) => error ? reject(error) : resolve(result));
      });
      
      const schema = await dataSource.discoverSchema({
        level: 'database',
        database: 'systemdb'
      });
      
      // Should have users collection
      expect(schema.collections.users).toBeDefined();
      
      // Should not have system collections (if they exist)
      const collectionNames = Object.keys(schema.collections);
      const hasSystemCollections = collectionNames.some(name => name.startsWith('system.'));
      expect(hasSystemCollections).toBe(false);
    });
  });
  
  describe('Schema Caching', () => {
    it('should cache discovered schema', async () => {
      const insertHandle = dataSource.update({
        level: 'collection',
        database: 'cachedb',
        collection: 'items',
        operation: 'insert',
        document: { name: 'Item' }
      });
      
      await new Promise((resolve, reject) => {
        insertHandle.onData((result, error) => error ? reject(error) : resolve(result));
      });
      
      // First discovery
      const schema1 = await dataSource.discoverSchema({
        level: 'collection',
        database: 'cachedb',
        collection: 'items'
      });
      
      // Should be cached now
      expect(dataSource._schemaCache).toBeDefined();
      expect(dataSource._schemaCacheTime).toBeGreaterThan(0);
      
      // Second discovery should return cached version
      const schema2 = await dataSource.discoverSchema({
        level: 'collection',
        database: 'cachedb',
        collection: 'items'
      });
      
      expect(schema2).toBe(schema1); // Same reference
    });
    
    it('should refresh cache when refresh option is true', async () => {
      const insertHandle = dataSource.update({
        level: 'collection',
        database: 'refreshdb',
        collection: 'items',
        operation: 'insert',
        document: { name: 'Item' }
      });
      
      await new Promise((resolve, reject) => {
        insertHandle.onData((result, error) => error ? reject(error) : resolve(result));
      });
      
      // First discovery
      const schema1 = await dataSource.discoverSchema({
        level: 'collection',
        database: 'refreshdb',
        collection: 'items'
      });
      
      // Force refresh
      const schema2 = await dataSource.discoverSchema({
        level: 'collection',
        database: 'refreshdb',
        collection: 'items',
        refresh: true
      });
      
      // Should be different instances (not cached)
      expect(schema2).not.toBe(schema1);
      expect(schema2.schema).toEqual(schema1.schema); // But same content
    });
    
    it('should use cached schema in getSchema() if available', async () => {
      const insertHandle = dataSource.update({
        level: 'collection',
        database: 'getdb',
        collection: 'items',
        operation: 'insert',
        document: { name: 'Item' }
      });
      
      await new Promise((resolve, reject) => {
        insertHandle.onData((result, error) => error ? reject(error) : resolve(result));
      });
      
      // Discover and cache schema
      await dataSource.discoverSchema({
        level: 'collection',
        database: 'getdb',
        collection: 'items'
      });
      
      // getSchema() should now return cached version
      const schema = dataSource.getSchema();
      
      expect(schema.collection).toBe('items');
      expect(schema.cached).toBeUndefined(); // Cached schemas don't have the 'cached' flag
    });
  });
  
  describe('Schema Discovery Errors', () => {
    it('should throw error for invalid discovery level', async () => {
      await expect(
        dataSource.discoverSchema({
          level: 'invalid'
        })
      ).rejects.toThrow('Invalid schema discovery level');
    });
    
    it('should throw error for database level without database name', async () => {
      await expect(
        dataSource.discoverSchema({
          level: 'database'
        })
      ).rejects.toThrow('Database name is required');
    });
    
    it('should throw error for collection level without database name', async () => {
      await expect(
        dataSource.discoverSchema({
          level: 'collection',
          collection: 'items'
        })
      ).rejects.toThrow('Database and collection names are required');
    });
    
    it('should throw error for collection level without collection name', async () => {
      await expect(
        dataSource.discoverSchema({
          level: 'collection',
          database: 'testdb'
        })
      ).rejects.toThrow('Database and collection names are required');
    });
  });
});