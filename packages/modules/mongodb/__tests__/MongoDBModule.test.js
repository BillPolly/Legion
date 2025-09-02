import { describe, it, expect, beforeEach, afterEach, beforeAll, jest } from '@jest/globals';
import MongoDBModule from '../src/MongoDBModule.js';
import { ResourceManager } from '@legion/resource-manager';

describe('MongoDBModule', () => {
  let mongoModule;
  let resourceManager;

  beforeAll(async () => {
    // Get real ResourceManager for integration testing
    resourceManager = await ResourceManager.getInstance();
  });

  beforeEach(() => {
    mongoModule = new MongoDBModule();
    mongoModule.resourceManager = resourceManager;
  });

  afterEach(async () => {
    if (mongoModule) {
      await mongoModule.cleanup();
    }
  });

  describe('constructor', () => {
    it('should create instance with correct properties', () => {
      expect(mongoModule.name).toBe('mongodb');
      expect(mongoModule.description).toBe('MongoDB integration module for database operations');
      expect(mongoModule.version).toBe('1.0.0');
      expect(mongoModule.metadataPath).toBe('./tools-metadata.json');
    });
  });

  describe('static create method', () => {
    it('should create and initialize module', async () => {
      const module = await MongoDBModule.create(resourceManager);
      
      expect(module).toBeInstanceOf(MongoDBModule);
      expect(module.resourceManager).toBe(resourceManager);
      expect(module.config).toBeDefined();
      expect(module.initialized).toBe(true);
      
      await module.cleanup();
    });
  });

  describe('configuration loading', () => {
    it('should load config from environment variables', () => {
      const config = mongoModule.loadConfig({});
      
      expect(config).toBeDefined();
      expect(config.connectionString).toBeDefined();
      expect(config.options).toBeDefined();
      expect(config.options.maxPoolSize).toBe(10);
      expect(config.options.serverSelectionTimeoutMS).toBe(5000);
    });

    it('should merge provided config with environment config', () => {
      const customConfig = {
        database: 'custom-db',
        options: {
          maxPoolSize: 20
        }
      };
      
      const config = mongoModule.loadConfig(customConfig);
      expect(config.database).toBe('custom-db');
      expect(config.options.maxPoolSize).toBe(20);
    });

    it('should validate config and throw on invalid data', () => {
      expect(() => {
        mongoModule.loadConfig({
          connectionString: null  // Invalid
        });
      }).toThrow('MongoDB configuration validation failed');
    });
  });

  describe('initialization', () => {
    it('should initialize successfully with live MongoDB connection', async () => {
      const result = await mongoModule.initialize();
      
      expect(result).toBe(true);
      expect(mongoModule.initialized).toBe(true);
      expect(mongoModule.config).toBeDefined();
      expect(mongoModule.client).toBeDefined();
    });

    it('should handle missing MongoDB gracefully', async () => {
      const originalConfig = mongoModule.config;
      mongoModule.config = {
        connectionString: 'mongodb://localhost:99999',  // Invalid port
        options: { serverSelectionTimeoutMS: 1000 }
      };
      
      // Should not throw, just warn
      const result = await mongoModule.initialize();
      expect(result).toBe(true);
    });
  });

  describe('database operations', () => {
    beforeEach(async () => {
      await mongoModule.initialize();
    });

    it('should get client instance', () => {
      const client = mongoModule.getClient();
      expect(client).toBeDefined();
    });

    it('should get database instance with default name', () => {
      mongoModule.config.database = 'test-db';
      const db = mongoModule.getDatabase();
      expect(db).toBeDefined();
    });

    it('should get database instance with custom name', () => {
      const db = mongoModule.getDatabase('custom-db');
      expect(db).toBeDefined();
    });

    it('should get collection instance', () => {
      mongoModule.config.database = 'test-db';
      const collection = mongoModule.getCollection('test-collection');
      expect(collection).toBeDefined();
    });

    it('should throw error when getting database without name', () => {
      mongoModule.config.database = null;
      expect(() => {
        mongoModule.getDatabase();
      }).toThrow('No database name specified');
    });
  });

  describe('MongoDB operations', () => {
    let testCollection;

    beforeEach(async () => {
      await mongoModule.initialize();
      testCollection = mongoModule.getCollection('test-collection', 'mongodb-module-test');
      
      // Clear test collection
      try {
        await testCollection.deleteMany({});
      } catch (error) {
        // Collection might not exist yet
      }
    });

    afterEach(async () => {
      if (testCollection) {
        try {
          await testCollection.deleteMany({});
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    });

    describe('insert operations', () => {
      it('should execute insertOne operation', async () => {
        const result = await mongoModule.executeOperation(testCollection, 'insertOne', {
          document: { name: 'Test User', active: true }
        });
        
        expect(result.insertedId).toBeDefined();
        expect(result.acknowledged).toBe(true);
      });

      it('should execute insertMany operation', async () => {
        const result = await mongoModule.executeOperation(testCollection, 'insertMany', {
          documents: [
            { name: 'User 1', active: true },
            { name: 'User 2', active: false }
          ]
        });
        
        expect(result.insertedIds).toBeDefined();
        expect(Object.keys(result.insertedIds)).toHaveLength(2);
        expect(result.insertedCount).toBe(2);
      });

      it('should throw error for insertOne without document', async () => {
        await expect(
          mongoModule.executeOperation(testCollection, 'insertOne', {})
        ).rejects.toThrow('insertOne operation requires "document" parameter');
      });
    });

    describe('query operations', () => {
      beforeEach(async () => {
        // Insert test data
        await testCollection.insertMany([
          { name: 'Active User', active: true, age: 25 },
          { name: 'Inactive User', active: false, age: 30 },
          { name: 'Another Active User', active: true, age: 35 }
        ]);
      });

      it('should execute find operation', async () => {
        const result = await mongoModule.executeOperation(testCollection, 'find', {
          query: { active: true },
          options: { limit: 2 }
        });
        
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBeLessThanOrEqual(2);
        expect(result[0].active).toBe(true);
      });

      it('should execute findOne operation', async () => {
        const result = await mongoModule.executeOperation(testCollection, 'findOne', {
          query: { active: false }
        });
        
        expect(result).toBeDefined();
        expect(result.active).toBe(false);
        expect(result.name).toBe('Inactive User');
      });

      it('should execute countDocuments operation', async () => {
        const result = await mongoModule.executeOperation(testCollection, 'countDocuments', {
          query: { active: true }
        });
        
        expect(result).toBe(2);
      });

      it('should execute distinct operation', async () => {
        const result = await mongoModule.executeOperation(testCollection, 'distinct', {
          field: 'active',
          query: {}
        });
        
        expect(Array.isArray(result)).toBe(true);
        expect(result).toContain(true);
        expect(result).toContain(false);
      });

      it('should execute aggregate operation', async () => {
        const result = await mongoModule.executeOperation(testCollection, 'aggregate', {
          pipeline: [
            { $group: { _id: '$active', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
          ]
        });
        
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(2);
        expect(result[0]).toHaveProperty('_id');
        expect(result[0]).toHaveProperty('count');
      });

      it('should throw error for distinct without field', async () => {
        await expect(
          mongoModule.executeOperation(testCollection, 'distinct', {})
        ).rejects.toThrow('distinct operation requires "field" parameter');
      });
    });

    describe('update operations', () => {
      beforeEach(async () => {
        await testCollection.insertMany([
          { name: 'User 1', status: 'pending' },
          { name: 'User 2', status: 'pending' }
        ]);
      });

      it('should execute updateOne operation', async () => {
        const result = await mongoModule.executeOperation(testCollection, 'updateOne', {
          query: { name: 'User 1' },
          update: { $set: { status: 'active' } }
        });
        
        expect(result.matchedCount).toBe(1);
        expect(result.modifiedCount).toBe(1);
        expect(result.acknowledged).toBe(true);
      });

      it('should execute updateMany operation', async () => {
        const result = await mongoModule.executeOperation(testCollection, 'updateMany', {
          query: { status: 'pending' },
          update: { $set: { status: 'active' } }
        });
        
        expect(result.matchedCount).toBe(2);
        expect(result.modifiedCount).toBe(2);
        expect(result.acknowledged).toBe(true);
      });

      it('should throw error for update without update parameter', async () => {
        await expect(
          mongoModule.executeOperation(testCollection, 'updateOne', {
            query: { name: 'User 1' }
          })
        ).rejects.toThrow('updateOne operation requires "update" parameter');
      });
    });

    describe('delete operations', () => {
      beforeEach(async () => {
        await testCollection.insertMany([
          { name: 'User 1', status: 'pending' },
          { name: 'User 2', status: 'active' },
          { name: 'User 3', status: 'pending' }
        ]);
      });

      it('should execute deleteOne operation', async () => {
        const result = await mongoModule.executeOperation(testCollection, 'deleteOne', {
          query: { status: 'pending' }
        });
        
        expect(result.deletedCount).toBe(1);
        expect(result.acknowledged).toBe(true);
      });

      it('should execute deleteMany operation', async () => {
        const result = await mongoModule.executeOperation(testCollection, 'deleteMany', {
          query: { status: 'pending' }
        });
        
        expect(result.deletedCount).toBe(2);
        expect(result.acknowledged).toBe(true);
      });
    });

    describe('admin operations', () => {
      it('should execute createIndex operation', async () => {
        const result = await mongoModule.executeOperation(testCollection, 'createIndex', {
          keys: { name: 1 },
          options: { unique: false }
        });
        
        expect(result).toBeDefined();
        expect(typeof result).toBe('string'); // Index name
      });

      it('should throw error for createIndex without keys', async () => {
        await expect(
          mongoModule.executeOperation(testCollection, 'createIndex', {})
        ).rejects.toThrow('createIndex operation requires "keys" parameter');
      });

      it('should execute listCollections operation', async () => {
        const result = await mongoModule.executeOperation(null, 'listCollections', {
          database: 'mongodb-module-test'
        });
        
        expect(Array.isArray(result)).toBe(true);
      });
    });

    it('should throw error for unsupported operation', async () => {
      await expect(
        mongoModule.executeOperation(testCollection, 'invalidOperation', {})
      ).rejects.toThrow('Unsupported MongoDB operation: invalidOperation');
    });
  });

  describe('connection testing', () => {
    beforeEach(async () => {
      await mongoModule.initialize();
    });

    it('should test connection successfully', async () => {
      const result = await mongoModule.testConnection();
      
      expect(result.success).toBe(true);
      expect(result.message).toBe('MongoDB connection successful');
    });
  });

  describe('getConfig', () => {
    beforeEach(async () => {
      await mongoModule.initialize();
    });

    it('should return config and mask credentials if present', () => {
      const config = mongoModule.getConfig();
      
      expect(config).toBeDefined();
      expect(config.connectionString).toBeDefined();
      expect(config.options).toBeDefined();
      // Should mask credentials if they exist in connection string
      if (config.connectionString.includes('@')) {
        expect(config.connectionString).toContain('***');
      } else {
        // If no credentials, should return original connection string
        expect(config.connectionString).toBe(mongoModule.config.connectionString);
      }
    });
  });

  describe('tool management', () => {
    beforeEach(async () => {
      await mongoModule.initialize();
    });

    it('should register mongo_query tool', () => {
      const tool = mongoModule.getTool('mongo_query');
      expect(tool).toBeDefined();
      expect(tool.name).toBe('mongo_query');
      expect(tool.mongoModule).toBe(mongoModule);
    });

    it('should return all tools', () => {
      const tools = mongoModule.getTools();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
      
      const mongoQueryTool = tools.find(tool => tool.name === 'mongo_query');
      expect(mongoQueryTool).toBeDefined();
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources', async () => {
      await mongoModule.initialize();
      const originalClient = mongoModule.client;
      
      await mongoModule.cleanup();
      
      expect(mongoModule.initialized).toBe(false);
    });
  });
});