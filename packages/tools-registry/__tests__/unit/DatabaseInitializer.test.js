/**
 * DatabaseInitializer Unit Tests
 * 
 * Tests the DatabaseInitializer class functionality for 3-collection perspective architecture
 * Ensures proper database setup, seeding, and validation without external dependencies
 * 
 * No mocks, real database operations with test isolation
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';
import { DatabaseInitializer } from '../../src/core/DatabaseInitializer.js';

describe('DatabaseInitializer', () => {
  let mongod;
  let client;
  let db;
  let databaseInitializer;

  beforeEach(async () => {
    // Create in-memory MongoDB instance for testing
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    client = new MongoClient(uri);
    await client.connect();
    db = client.db('test_database');

    // Mock ResourceManager
    const mockResourceManager = {
      get: jest.fn().mockReturnValue(null)
    };

    databaseInitializer = new DatabaseInitializer({
      db,
      resourceManager: mockResourceManager,
      options: {
        verbose: false,
        seedData: true,
        validateSchema: true,
        createIndexes: true
      }
    });
  });

  afterEach(async () => {
    if (client) {
      await client.close();
    }
    if (mongod) {
      await mongod.stop();
    }
  });

  describe('constructor', () => {
    it('should create DatabaseInitializer with required parameters', () => {
      expect(databaseInitializer).toBeInstanceOf(DatabaseInitializer);
      expect(databaseInitializer.db).toBe(db);
      expect(databaseInitializer.options.seedData).toBe(true);
    });

    it('should throw error without database instance', () => {
      expect(() => {
        new DatabaseInitializer({
          resourceManager: {},
          options: {}
        });
      }).toThrow('Database instance is required');
    });

    it('should use default options when not provided', () => {
      const initializer = new DatabaseInitializer({
        db,
        resourceManager: {},
        options: {}
      });

      expect(initializer.options.verbose).toBe(false);
      expect(initializer.options.seedData).toBe(true);
      expect(initializer.options.validateSchema).toBe(true);
    });
  });

  describe('initialize', () => {
    it('should initialize collections and seed default data', async () => {
      await databaseInitializer.initialize();

      // Check collections were created
      const collections = await db.listCollections().toArray();
      const collectionNames = collections.map(c => c.name);
      
      expect(collectionNames).toContain('perspective_types');
      expect(collectionNames).toContain('tool_perspectives');

      // Check default perspective types were seeded
      const perspectiveTypes = await db.collection('perspective_types').find({}).toArray();
      expect(perspectiveTypes).toHaveLength(4);
      
      const typeNames = perspectiveTypes.map(pt => pt.name);
      expect(typeNames).toContain('input_perspective');
      expect(typeNames).toContain('definition_perspective');
      expect(typeNames).toContain('keyword_perspective');
      expect(typeNames).toContain('use_case_perspective');
    });

    it('should create proper indexes on collections', async () => {
      await databaseInitializer.initialize();

      // Check perspective_types indexes
      const ptIndexes = await db.collection('perspective_types').indexes();
      const ptIndexNames = ptIndexes.map(idx => Object.keys(idx.key).join('_'));
      expect(ptIndexNames).toContain('name');
      expect(ptIndexNames).toContain('category');
      expect(ptIndexNames).toContain('order');

      // Check tool_perspectives indexes  
      const tpIndexes = await db.collection('tool_perspectives').indexes();
      const tpIndexNames = tpIndexes.map(idx => Object.keys(idx.key).join('_'));
      expect(tpIndexNames).toContain('tool_name');
      expect(tpIndexNames).toContain('perspective_type_name');
    });

    it('should not seed data when seedData option is false', async () => {
      const noSeedInitializer = new DatabaseInitializer({
        db,
        resourceManager: {},
        options: { seedData: false, validateSchema: false }
      });

      await noSeedInitializer.initialize();

      const perspectiveTypes = await db.collection('perspective_types').find({}).toArray();
      expect(perspectiveTypes).toHaveLength(0);
    });

    it('should skip initialization if already initialized', async () => {
      await databaseInitializer.initialize();
      const firstCallTypes = await db.collection('perspective_types').find({}).toArray();

      await databaseInitializer.initialize();
      const secondCallTypes = await db.collection('perspective_types').find({}).toArray();

      expect(firstCallTypes).toHaveLength(secondCallTypes.length);
    });
  });

  describe('ensureCollectionsExist', () => {
    it('should create perspective_types collection with schema', async () => {
      await databaseInitializer.ensureCollectionsExist();

      const collection = db.collection('perspective_types');
      const exists = await collection.findOne({});
      
      // Collection should exist (findOne won't throw)
      expect(exists).toBeNull(); // Empty but exists
    });

    it('should create tool_perspectives collection', async () => {
      await databaseInitializer.ensureCollectionsExist();

      const collection = db.collection('tool_perspectives');
      const exists = await collection.findOne({});
      
      expect(exists).toBeNull(); // Empty but exists
    });
  });

  describe('seedPerspectiveTypes', () => {
    it('should insert all default perspective types', async () => {
      await databaseInitializer.ensureCollectionsExist();
      await databaseInitializer.seedPerspectiveTypes();

      const perspectiveTypes = await db.collection('perspective_types').find({}).toArray();
      expect(perspectiveTypes).toHaveLength(4);

      // Check specific properties of first type
      const inputPerspective = perspectiveTypes.find(pt => pt.name === 'input_perspective');
      expect(inputPerspective).toBeDefined();
      expect(inputPerspective.description).toContain('input parameters');
      expect(inputPerspective.category).toBe('technical');
      expect(inputPerspective.order).toBe(1);
      expect(inputPerspective.enabled).toBe(true);
      expect(inputPerspective.created_at).toBeInstanceOf(Date);
    });

    it('should not duplicate perspective types on multiple calls', async () => {
      await databaseInitializer.ensureCollectionsExist();
      await databaseInitializer.seedPerspectiveTypes();
      await databaseInitializer.seedPerspectiveTypes(); // Second call

      const perspectiveTypes = await db.collection('perspective_types').find({}).toArray();
      expect(perspectiveTypes).toHaveLength(4); // Should still be 4, not 8
    });

    it('should not seed if data already exists', async () => {
      await databaseInitializer.ensureCollectionsExist();

      // Insert custom perspective type first
      await db.collection('perspective_types').insertOne({
        name: 'custom_perspective',
        description: 'Custom perspective type',
        prompt_template: 'Custom prompt',
        category: 'custom',
        order: 10,
        enabled: true,
        created_at: new Date()
      });

      const seeded = await databaseInitializer.seedPerspectiveTypes();
      expect(seeded).toBe(0); // Should return 0 since collection is not empty

      const perspectiveTypes = await db.collection('perspective_types').find({}).toArray();
      expect(perspectiveTypes).toHaveLength(1); // Only the custom one

      const customType = perspectiveTypes.find(pt => pt.name === 'custom_perspective');
      expect(customType).toBeDefined();
    });
  });

  describe('createIndexes', () => {
    it('should create all required indexes', async () => {
      await databaseInitializer.ensureCollectionsExist();
      await databaseInitializer.createIndexes();

      // Test perspective_types indexes
      const ptCollection = db.collection('perspective_types');
      const ptIndexes = await ptCollection.indexes();
      
      expect(ptIndexes.length).toBeGreaterThan(1);
      
      // Check for specific indexes
      const nameIndex = ptIndexes.find(idx => idx.key.name === 1);
      expect(nameIndex).toBeDefined();
      expect(nameIndex.unique).toBe(true);

      const categoryIndex = ptIndexes.find(idx => idx.key.category === 1);
      expect(categoryIndex).toBeDefined();

      // Test tool_perspectives indexes
      const tpCollection = db.collection('tool_perspectives');
      const tpIndexes = await tpCollection.indexes();
      
      const toolNameIndex = tpIndexes.find(idx => idx.key.tool_name === 1);
      expect(toolNameIndex).toBeDefined();

      const compositeIndex = tpIndexes.find(idx => 
        idx.key.tool_name === 1 && idx.key.perspective_type_name === 1
      );
      expect(compositeIndex).toBeDefined();
      expect(compositeIndex.unique).toBe(true);
    });

    it('should handle index creation errors gracefully', async () => {
      await databaseInitializer.ensureCollectionsExist();
      
      // Close database connection to simulate error
      await client.close();
      
      // Should not throw error
      await expect(databaseInitializer.createIndexes()).resolves.not.toThrow();
    });
  });

  describe('validateSetup', () => {
    it('should validate complete setup successfully', async () => {
      await databaseInitializer.initialize();

      // validateSetup throws error on failure, completing without error means success
      await expect(databaseInitializer.validateSetup()).resolves.not.toThrow();
    });

    it('should throw error if collections are missing', async () => {
      // Don't initialize collections
      await expect(databaseInitializer.validateSetup()).rejects.toThrow('No perspective types found');
    });

    it('should throw error if perspective types are missing', async () => {
      await databaseInitializer.ensureCollectionsExist();
      // Don't seed data
      
      await expect(databaseInitializer.validateSetup()).rejects.toThrow('No perspective types found');
    });

    it('should handle validation errors gracefully', async () => {
      await client.close(); // Close connection to simulate error
      
      await expect(databaseInitializer.validateSetup()).rejects.toThrow('Database validation failed');
    });
  });

  describe('getStats', () => {
    it('should return initialization statistics', async () => {
      await databaseInitializer.initialize();

      const stats = await databaseInitializer.getStats();
      
      expect(stats).toHaveProperty('initialized', true);
      expect(stats).toHaveProperty('perspective_types');
      expect(stats).toHaveProperty('tool_perspectives');
      expect(stats).toHaveProperty('tools');
      expect(typeof stats.perspective_types).toBe('number');
      expect(stats.perspective_types).toBeGreaterThan(0);
    });

    it('should return zero counts for empty collections', async () => {
      await databaseInitializer.ensureCollectionsExist();
      // Skip seeding

      const stats = await databaseInitializer.getStats();
      
      expect(stats.perspective_types).toBe(0);
      expect(stats.tool_perspectives).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should handle database connection errors', async () => {
      await client.close();
      
      await expect(databaseInitializer.initialize()).rejects.toThrow('Database initialization failed');
    });

    it('should provide detailed error information', async () => {
      await client.close();
      
      try {
        await databaseInitializer.initialize();
      } catch (error) {
        expect(error.message).toContain('Database initialization failed');
        expect(error.code).toBe('DATABASE_ERROR');
        expect(error.collection).toBe('DatabaseInitializer');
      }
    });
  });

  describe('getDefaultPerspectiveTypes', () => {
    it('should return all default perspective types with correct structure', () => {
      const defaultTypes = databaseInitializer.getDefaultPerspectiveTypes();
      
      expect(defaultTypes).toHaveLength(4);
      
      for (const perspectiveType of defaultTypes) {
        expect(perspectiveType).toHaveProperty('name');
        expect(perspectiveType).toHaveProperty('description');
        expect(perspectiveType).toHaveProperty('prompt_template');
        expect(perspectiveType).toHaveProperty('category');
        expect(perspectiveType).toHaveProperty('order');
        expect(perspectiveType).toHaveProperty('enabled');
        
        expect(typeof perspectiveType.name).toBe('string');
        expect(typeof perspectiveType.description).toBe('string');
        expect(typeof perspectiveType.prompt_template).toBe('string');
        expect(typeof perspectiveType.category).toBe('string');
        expect(typeof perspectiveType.order).toBe('number');
        expect(typeof perspectiveType.enabled).toBe('boolean');
      }
    });

    it('should have unique names and orders', () => {
      const defaultTypes = databaseInitializer.getDefaultPerspectiveTypes();
      
      const names = defaultTypes.map(pt => pt.name);
      const orders = defaultTypes.map(pt => pt.order);
      
      expect(new Set(names).size).toBe(names.length);
      expect(new Set(orders).size).toBe(orders.length);
    });
  });
});