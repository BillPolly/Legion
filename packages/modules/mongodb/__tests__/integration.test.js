import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { getToolRegistry } from '@legion/tools-registry';
import { ResourceManager } from '@legion/resource-manager';
import MongoDBModule from '../src/MongoDBModule.js';

describe('MongoDB Module Integration', () => {
  let toolRegistry;
  let resourceManager;
  let mongoModule;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
    toolRegistry = await getToolRegistry();
  });

  afterAll(async () => {
    if (mongoModule) {
      await mongoModule.cleanup();
    }
  });

  describe('Tool Registry Integration', () => {
    it('should create and register MongoDB module with tool registry', async () => {
      mongoModule = await MongoDBModule.create(resourceManager);
      
      expect(mongoModule).toBeInstanceOf(MongoDBModule);
      expect(mongoModule.name).toBe('mongodb');
      
      // Verify tools are available
      const tools = mongoModule.getTools();
      expect(tools.length).toBeGreaterThan(0);
      
      const mongoQueryTool = mongoModule.getTool('mongo_query');
      expect(mongoQueryTool).toBeDefined();
      expect(mongoQueryTool.name).toBe('mongo_query');
    });

    it('should execute mongo_query tool through module', async () => {
      mongoModule = await MongoDBModule.create(resourceManager);
      const tool = mongoModule.getTool('mongo_query');
      
      // Test a simple count operation
      const result = await tool.execute({
        collection: 'integration-test',
        database: 'mongodb-integration-test',
        command: 'countDocuments',
        params: {
          query: {}
        }
      });

      expect(result.success).toBe(true);
      expect(result.data.command).toBe('countDocuments');
      expect(result.data.collection).toBe('integration-test');
      expect(result.data.database).toBe('mongodb-integration-test');
      expect(typeof result.data.count).toBe('number');
    });

    it('should validate tool input properly', async () => {
      mongoModule = await MongoDBModule.create(resourceManager);
      const tool = mongoModule.getTool('mongo_query');
      
      // Test validation with missing required fields
      const result = await tool.execute({
        command: 'find'
        // Missing collection
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Input validation failed');
    });

    it('should handle MongoDB errors gracefully', async () => {
      mongoModule = await MongoDBModule.create(resourceManager);
      const tool = mongoModule.getTool('mongo_query');
      
      // Test with invalid command
      const validation = tool.validateInput({
        collection: 'test',
        command: 'invalidCommand'
      });

      expect(validation.valid).toBe(false);
    });
  });

  describe('ResourceManager Integration', () => {
    it('should use ResourceManager for configuration', async () => {
      mongoModule = await MongoDBModule.create(resourceManager);
      
      expect(mongoModule.resourceManager).toBe(resourceManager);
      expect(mongoModule.config).toBeDefined();
      expect(mongoModule.config.connectionString).toBeDefined();
      expect(mongoModule.config.options).toBeDefined();
    });

    it('should connect to MongoDB using ResourceManager config', async () => {
      mongoModule = await MongoDBModule.create(resourceManager);
      
      const connectionTest = await mongoModule.testConnection();
      expect(connectionTest).toBeDefined();
      expect(typeof connectionTest.success).toBe('boolean');
      expect(connectionTest.message).toBeDefined();
    });
  });

  describe('Metadata Integration', () => {
    it('should load tool metadata properly', async () => {
      mongoModule = await MongoDBModule.create(resourceManager);
      const tool = mongoModule.getTool('mongo_query');
      
      const metadata = tool.getMetadata();
      expect(metadata).toBeDefined();
      expect(metadata.name).toBe('mongo_query');
      expect(metadata.description).toBeDefined();
      expect(metadata.inputSchema).toBeDefined();
      expect(metadata.outputSchema).toBeDefined();
      
      // Verify schema has required properties
      expect(metadata.inputSchema.properties.collection).toBeDefined();
      expect(metadata.inputSchema.properties.command).toBeDefined();
      expect(metadata.inputSchema.required).toContain('collection');
      expect(metadata.inputSchema.required).toContain('command');
    });

    it('should have proper command validation in schema', async () => {
      mongoModule = await MongoDBModule.create(resourceManager);
      const tool = mongoModule.getTool('mongo_query');
      
      const metadata = tool.getMetadata();
      const commandProperty = metadata.inputSchema.properties.command;
      
      expect(commandProperty.enum).toBeDefined();
      expect(commandProperty.enum).toContain('find');
      expect(commandProperty.enum).toContain('insertOne');
      expect(commandProperty.enum).toContain('updateMany');
      expect(commandProperty.enum).toContain('aggregate');
    });
  });

  describe('Live MongoDB Integration', () => {
    let testCollection;

    beforeAll(async () => {
      mongoModule = await MongoDBModule.create(resourceManager);
      testCollection = mongoModule.getCollection('live-integration-test', 'mongodb-integration-test');
      
      // Clear test data
      try {
        await testCollection.deleteMany({});
      } catch (error) {
        // Collection might not exist
      }
    });

    afterAll(async () => {
      if (testCollection) {
        try {
          await testCollection.deleteMany({});
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    });

    it('should perform end-to-end MongoDB operations', async () => {
      const tool = mongoModule.getTool('mongo_query');

      // Insert test data
      const insertResult = await tool.execute({
        collection: 'live-integration-test',
        database: 'mongodb-integration-test',
        command: 'insertMany',
        params: {
          documents: [
            { name: 'Integration Test 1', active: true, score: 85 },
            { name: 'Integration Test 2', active: false, score: 92 },
            { name: 'Integration Test 3', active: true, score: 78 }
          ]
        }
      });

      expect(insertResult.success).toBe(true);
      expect(insertResult.data.insertedCount).toBe(3);

      // Query the data
      const findResult = await tool.execute({
        collection: 'live-integration-test',
        database: 'mongodb-integration-test',
        command: 'find',
        params: {
          query: { active: true },
          options: { sort: { score: -1 } }
        }
      });

      expect(findResult.success).toBe(true);
      expect(findResult.data.documents).toBeDefined();
      expect(findResult.data.documents.length).toBe(2);
      expect(findResult.data.documents[0].score).toBe(85); // Higher score first due to sort

      // Update data
      const updateResult = await tool.execute({
        collection: 'live-integration-test',
        database: 'mongodb-integration-test',
        command: 'updateMany',
        params: {
          query: { active: true },
          update: { $inc: { score: 5 } }
        }
      });

      expect(updateResult.success).toBe(true);
      expect(updateResult.data.matchedCount).toBe(2);
      expect(updateResult.data.modifiedCount).toBe(2);

      // Aggregate data
      const aggregateResult = await tool.execute({
        collection: 'live-integration-test',
        database: 'mongodb-integration-test',
        command: 'aggregate',
        params: {
          pipeline: [
            { $group: { _id: '$active', avgScore: { $avg: '$score' }, count: { $sum: 1 } } },
            { $sort: { count: -1 } }
          ]
        }
      });

      expect(aggregateResult.success).toBe(true);
      expect(aggregateResult.data.documents).toBeDefined();
      expect(aggregateResult.data.documents.length).toBe(2); // true and false groups

      // Count documents
      const countResult = await tool.execute({
        collection: 'live-integration-test',
        database: 'mongodb-integration-test',
        command: 'countDocuments',
        params: {
          query: { score: { $gte: 80 } }
        }
      });

      expect(countResult.success).toBe(true);
      expect(countResult.data.count).toBe(3); // All documents have score >= 80 after update

      // Delete some data
      const deleteResult = await tool.execute({
        collection: 'live-integration-test',
        database: 'mongodb-integration-test',
        command: 'deleteMany',
        params: {
          query: { active: false }
        }
      });

      expect(deleteResult.success).toBe(true);
      expect(deleteResult.data.deletedCount).toBe(1);
    });

    it('should work with complex aggregation pipelines', async () => {
      const tool = mongoModule.getTool('mongo_query');

      // Insert more complex test data
      await testCollection.insertMany([
        { department: 'Engineering', employees: [
          { name: 'Alice', salary: 90000, level: 'Senior' },
          { name: 'Bob', salary: 75000, level: 'Mid' }
        ]},
        { department: 'Marketing', employees: [
          { name: 'Carol', salary: 65000, level: 'Junior' },
          { name: 'David', salary: 80000, level: 'Senior' }
        ]}
      ]);

      const result = await tool.execute({
        collection: 'live-integration-test',
        database: 'mongodb-integration-test',
        command: 'aggregate',
        params: {
          pipeline: [
            { $unwind: '$employees' },
            { $group: {
                _id: '$department',
                avgSalary: { $avg: '$employees.salary' },
                totalEmployees: { $sum: 1 },
                seniors: { $sum: { $cond: [{ $eq: ['$employees.level', 'Senior'] }, 1, 0] } }
              }
            },
            { $sort: { avgSalary: -1 } }
          ]
        }
      });

      expect(result.success).toBe(true);
      expect(result.data.documents).toBeDefined();
      expect(result.data.documents.length).toBe(2);
      
      const engineeringDept = result.data.documents.find(d => d._id === 'Engineering');
      expect(engineeringDept).toBeDefined();
      expect(engineeringDept.avgSalary).toBe(82500); // (90000 + 75000) / 2
      expect(engineeringDept.totalEmployees).toBe(2);
      expect(engineeringDept.seniors).toBe(1);
    });
  });
});