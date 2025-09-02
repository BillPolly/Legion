import { describe, it, expect, beforeEach, afterEach, beforeAll } from '@jest/globals';
import MongoDBModule from '../src/MongoDBModule.js';
import MongoQueryTool from '../src/MongoQueryTool.js';
import { ResourceManager } from '@legion/resource-manager';

describe('MongoQueryTool', () => {
  let mongoModule;
  let mongoQueryTool;
  let resourceManager;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
  });

  beforeEach(async () => {
    mongoModule = await MongoDBModule.create(resourceManager);
    mongoQueryTool = mongoModule.getTool('mongo_query');
  });

  afterEach(async () => {
    if (mongoModule) {
      await mongoModule.cleanup();
    }
  });

  describe('constructor', () => {
    it('should create tool instance with correct metadata', () => {
      expect(mongoQueryTool).toBeInstanceOf(MongoQueryTool);
      expect(mongoQueryTool.name).toBe('mongo_query');
      expect(mongoQueryTool.description).toContain('MongoDB database operations');
      expect(mongoQueryTool.mongoModule).toBe(mongoModule);
    });

    it('should have proper input schema', () => {
      const metadata = mongoQueryTool.getMetadata();
      expect(metadata.inputSchema).toBeDefined();
      expect(metadata.inputSchema.properties.collection).toBeDefined();
      expect(metadata.inputSchema.properties.command).toBeDefined();
      expect(metadata.inputSchema.properties.params).toBeDefined();
      expect(metadata.inputSchema.required).toContain('collection');
      expect(metadata.inputSchema.required).toContain('command');
    });
  });

  describe('input validation', () => {
    it('should validate valid input', () => {
      const validInput = {
        collection: 'users',
        command: 'find',
        params: { query: { active: true } }
      };

      const validation = mongoQueryTool.validateInput(validInput);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should reject input without collection', () => {
      const invalidInput = {
        command: 'find'
      };

      const validation = mongoQueryTool.validateInput(invalidInput);
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should reject input without command', () => {
      const invalidInput = {
        collection: 'users'
      };

      const validation = mongoQueryTool.validateInput(invalidInput);
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should reject invalid command', () => {
      const invalidInput = {
        collection: 'users',
        command: 'invalidCommand'
      };

      const validation = mongoQueryTool.validateInput(invalidInput);
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should accept valid commands', () => {
      const validCommands = [
        'find', 'findOne', 'countDocuments', 'distinct', 'aggregate',
        'insertOne', 'insertMany', 'updateOne', 'updateMany',
        'deleteOne', 'deleteMany', 'createIndex', 'dropCollection', 'listCollections'
      ];

      for (const command of validCommands) {
        const input = {
          collection: 'users',
          command: command,
          params: {}
        };

        const validation = mongoQueryTool.validateInput(input);
        expect(validation.valid).toBe(true);
      }
    });
  });

  describe('tool execution', () => {
    let testCollection;
    const testDbName = 'mongo-query-tool-test';
    const testCollectionName = 'test-collection';

    beforeEach(async () => {
      testCollection = mongoModule.getCollection(testCollectionName, testDbName);
      
      // Clear test collection and drop any indexes
      try {
        await testCollection.drop();
      } catch (error) {
        // Collection might not exist yet, ignore
      }
    });

    afterEach(async () => {
      if (testCollection) {
        try {
          await testCollection.drop();
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    });

    describe('query operations', () => {
      beforeEach(async () => {
        // Insert test data
        await testCollection.insertMany([
          { name: 'Alice', active: true, age: 25, department: 'Engineering' },
          { name: 'Bob', active: false, age: 30, department: 'Marketing' },
          { name: 'Carol', active: true, age: 35, department: 'Engineering' }
        ]);
      });

      it('should execute find operation', async () => {
        const result = await mongoQueryTool.execute({
          database: testDbName,
          collection: testCollectionName,
          command: 'find',
          params: {
            query: { active: true },
            options: { limit: 2 }
          }
        });

        expect(result.success).toBe(true);
        expect(result.data.command).toBe('find');
        expect(result.data.collection).toBe(testCollectionName);
        expect(result.data.database).toBe(testDbName);
        expect(result.data.documents).toBeDefined();
        expect(result.data.count).toBeLessThanOrEqual(2);
        expect(result.data.documents[0].active).toBe(true);
      });

      it('should execute findOne operation', async () => {
        const result = await mongoQueryTool.execute({
          collection: testCollectionName,
          database: testDbName,
          command: 'findOne',
          params: {
            query: { name: 'Bob' }
          }
        });

        expect(result.success).toBe(true);
        expect(result.data.document).toBeDefined();
        expect(result.data.document.name).toBe('Bob');
        expect(result.data.found).toBe(true);
      });

      it('should execute countDocuments operation', async () => {
        const result = await mongoQueryTool.execute({
          collection: testCollectionName,
          database: testDbName,
          command: 'countDocuments',
          params: {
            query: { active: true }
          }
        });

        expect(result.success).toBe(true);
        expect(result.data.count).toBe(2);
      });

      it('should execute distinct operation', async () => {
        const result = await mongoQueryTool.execute({
          collection: testCollectionName,
          database: testDbName,
          command: 'distinct',
          params: {
            field: 'department',
            query: {}
          }
        });

        expect(result.success).toBe(true);
        expect(result.data.values).toBeDefined();
        expect(result.data.values).toContain('Engineering');
        expect(result.data.values).toContain('Marketing');
        expect(result.data.count).toBe(2);
      });

      it('should execute aggregate operation', async () => {
        const result = await mongoQueryTool.execute({
          collection: testCollectionName,
          database: testDbName,
          command: 'aggregate',
          params: {
            pipeline: [
              { $group: { _id: '$department', avgAge: { $avg: '$age' }, count: { $sum: 1 } } },
              { $sort: { count: -1 } }
            ]
          }
        });

        expect(result.success).toBe(true);
        expect(result.data.documents).toBeDefined();
        expect(Array.isArray(result.data.documents)).toBe(true);
        expect(result.data.documents.length).toBe(2);
        expect(result.data.documents[0]).toHaveProperty('_id');
        expect(result.data.documents[0]).toHaveProperty('avgAge');
        expect(result.data.documents[0]).toHaveProperty('count');
      });
    });

    describe('insert operations', () => {
      it('should execute insertOne operation', async () => {
        const newUser = { name: 'David', active: true, age: 28 };
        
        const result = await mongoQueryTool.execute({
          collection: testCollectionName,
          database: testDbName,
          command: 'insertOne',
          params: {
            document: newUser
          }
        });

        expect(result.success).toBe(true);
        expect(result.data.insertedId).toBeDefined();
        expect(result.data.acknowledged).toBe(true);

        // Verify insertion
        const inserted = await testCollection.findOne({ name: 'David' });
        expect(inserted).toBeDefined();
        expect(inserted.name).toBe('David');
      });

      it('should execute insertMany operation', async () => {
        const newUsers = [
          { name: 'Eve', active: true, age: 24 },
          { name: 'Frank', active: false, age: 32 }
        ];
        
        const result = await mongoQueryTool.execute({
          collection: testCollectionName,
          database: testDbName,
          command: 'insertMany',
          params: {
            documents: newUsers
          }
        });

        expect(result.success).toBe(true);
        expect(result.data.insertedIds).toBeDefined();
        expect(result.data.insertedCount).toBe(2);
        expect(result.data.acknowledged).toBe(true);

        // Verify insertion
        const count = await testCollection.countDocuments({ name: { $in: ['Eve', 'Frank'] } });
        expect(count).toBe(2);
      });

      it('should return error for insertOne without document', async () => {
        const result = await mongoQueryTool.execute({
          collection: testCollectionName,
          database: testDbName,
          command: 'insertOne',
          params: {}
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('insertOne operation requires "document" parameter');
      });
    });

    describe('update operations', () => {
      beforeEach(async () => {
        await testCollection.insertMany([
          { name: 'Grace', status: 'pending', priority: 1 },
          { name: 'Henry', status: 'pending', priority: 2 }
        ]);
      });

      it('should execute updateOne operation', async () => {
        const result = await mongoQueryTool.execute({
          collection: testCollectionName,
          database: testDbName,
          command: 'updateOne',
          params: {
            query: { name: 'Grace' },
            update: { $set: { status: 'active' } }
          }
        });

        expect(result.success).toBe(true);
        expect(result.data.matchedCount).toBe(1);
        expect(result.data.modifiedCount).toBe(1);
        expect(result.data.acknowledged).toBe(true);

        // Verify update
        const updated = await testCollection.findOne({ name: 'Grace' });
        expect(updated.status).toBe('active');
      });

      it('should execute updateMany operation', async () => {
        const result = await mongoQueryTool.execute({
          collection: testCollectionName,
          database: testDbName,
          command: 'updateMany',
          params: {
            query: { status: 'pending' },
            update: { $set: { status: 'processed' }, $inc: { priority: 10 } }
          }
        });

        expect(result.success).toBe(true);
        expect(result.data.matchedCount).toBe(2);
        expect(result.data.modifiedCount).toBe(2);
        expect(result.data.acknowledged).toBe(true);

        // Verify updates
        const updated = await testCollection.find({ status: 'processed' }).toArray();
        expect(updated.length).toBe(2);
        expect(updated[0].priority).toBeGreaterThan(10);
      });

      it('should return error for update without update parameter', async () => {
        const result = await mongoQueryTool.execute({
          collection: testCollectionName,
          database: testDbName,
          command: 'updateOne',
          params: {
            query: { name: 'Grace' }
          }
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('updateOne operation requires "update" parameter');
      });
    });

    describe('delete operations', () => {
      beforeEach(async () => {
        await testCollection.insertMany([
          { name: 'Ivan', category: 'temporary' },
          { name: 'Jane', category: 'permanent' },
          { name: 'Kyle', category: 'temporary' }
        ]);
      });

      it('should execute deleteOne operation', async () => {
        const result = await mongoQueryTool.execute({
          collection: testCollectionName,
          database: testDbName,
          command: 'deleteOne',
          params: {
            query: { category: 'temporary' }
          }
        });

        expect(result.success).toBe(true);
        expect(result.data.deletedCount).toBe(1);
        expect(result.data.acknowledged).toBe(true);

        // Verify deletion
        const remaining = await testCollection.countDocuments({ category: 'temporary' });
        expect(remaining).toBe(1); // One of two temporary records deleted
      });

      it('should execute deleteMany operation', async () => {
        const result = await mongoQueryTool.execute({
          collection: testCollectionName,
          database: testDbName,
          command: 'deleteMany',
          params: {
            query: { category: 'temporary' }
          }
        });

        expect(result.success).toBe(true);
        expect(result.data.deletedCount).toBe(2);
        expect(result.data.acknowledged).toBe(true);

        // Verify deletion
        const remaining = await testCollection.countDocuments({ category: 'temporary' });
        expect(remaining).toBe(0);
      });
    });

    describe('admin operations', () => {
      it('should execute createIndex operation', async () => {
        const result = await mongoQueryTool.execute({
          collection: testCollectionName,
          database: testDbName,
          command: 'createIndex',
          params: {
            keys: { name: 1, status: -1 },
            options: { unique: false }
          }
        });

        expect(result.success).toBe(true);
        expect(result.data.indexName).toBeDefined();
        expect(result.data.created).toBe(true);
      });

      it('should execute listCollections operation', async () => {
        const result = await mongoQueryTool.execute({
          collection: testCollectionName,
          database: testDbName,
          command: 'listCollections',
          params: {
            database: testDbName
          }
        });

        expect(result.success).toBe(true);
        expect(result.data.collections).toBeDefined();
        expect(Array.isArray(result.data.collections)).toBe(true);
      });

      it('should return error for createIndex without keys', async () => {
        const result = await mongoQueryTool.execute({
          collection: testCollectionName,
          database: testDbName,
          command: 'createIndex',
          params: {}
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('createIndex operation requires "keys" parameter');
      });

      it('should return error for distinct without field', async () => {
        const result = await mongoQueryTool.execute({
          collection: testCollectionName,
          database: testDbName,
          command: 'distinct',
          params: {}
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('distinct operation requires "field" parameter');
      });
    });

    describe('error handling', () => {
      it('should handle missing collection error', async () => {
        const result = await mongoQueryTool.execute({
          command: 'find',
          params: {}
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Input validation failed');
      });

      it('should handle missing command error', async () => {
        const result = await mongoQueryTool.execute({
          collection: testCollectionName,
          params: {}
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Input validation failed');
      });

      it('should handle MongoDB operation errors', async () => {
        // Try to create duplicate unique index
        await mongoQueryTool.execute({
          collection: testCollectionName,
          database: testDbName,
          command: 'createIndex',
          params: {
            keys: { email: 1 },
            options: { unique: true }
          }
        });

        // Insert duplicate emails
        await testCollection.insertOne({ email: 'test@example.com' });

        const result = await mongoQueryTool.execute({
          collection: testCollectionName,
          database: testDbName,
          command: 'insertOne',
          params: {
            document: { email: 'test@example.com' }
          }
        });

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    describe('result formatting', () => {
      it('should include consistent metadata in all results', async () => {
        const result = await mongoQueryTool.execute({
          collection: testCollectionName,
          database: testDbName,
          command: 'find',
          params: { query: {} }
        });

        expect(result.success).toBe(true);
        expect(result.data.command).toBe('find');
        expect(result.data.collection).toBe(testCollectionName);
        expect(result.data.database).toBe(testDbName);
        expect(result.data.timestamp).toBeDefined();
        expect(new Date(result.data.timestamp).getTime()).toBeLessThanOrEqual(Date.now());
      });
    });
  });

  describe('tool without MongoDB module', () => {
    it('should throw error when mongoModule not provided', async () => {
      const standaloneTool = new MongoQueryTool();
      
      const result = await standaloneTool.execute({
        collection: 'test',
        command: 'find',
        params: {}
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('MongoDB module not provided to MongoQueryTool');
    });
  });
});