/**
 * Integration tests for MongoQueryModule
 * Tests with real ResourceManager and MongoDB
 */

import { jest } from '@jest/globals';
import MongoQueryModule, { MongoQueryTool } from '../../src/index.js';
import { Module } from '@legion/tools-registry';
import { getResourceManager } from '@legion/resource-manager';
import { MongoDBProvider } from '@legion/storage';

describe('MongoQueryModule - Integration', () => {
  let resourceManager;
  let mongoProvider;

  beforeAll(async () => {
    // Get real ResourceManager (will load .env)
    resourceManager = await getResourceManager();
    
    // Ensure we have MongoDB URL
    const mongoUrl = resourceManager.get('env.MONGODB_URL');
    if (!mongoUrl) {
      throw new Error('MONGODB_URL must be set in .env for integration tests');
    }
  });

  afterAll(async () => {
    // Clean up MongoDB connections
    if (mongoProvider && mongoProvider.connected) {
      await mongoProvider.disconnect();
    }
  });

  describe('Module Structure', () => {
    it('should create module with constructor', () => {
      const mockProvider = {
        find: jest.fn(),
        databaseName: 'test'
      };
      
      const module = new MongoQueryModule({ mongoProvider: mockProvider });
      
      expect(module).toBeInstanceOf(Module);
      expect(module.name).toBe('mongo-query');
      expect(module.description).toBe('MongoDB query and manipulation tools');
      expect(module.mongoProvider).toBe(mockProvider);
    });

    it('should have correct module properties', () => {
      const module = new MongoQueryModule({ mongoProvider: {} });
      
      expect(module.name).toBe('mongo-query');
      expect(module.description).toContain('MongoDB');
    });
  });

  describe('Async Factory Pattern', () => {
    it('should create module with ResourceManager', async () => {
      const module = await MongoQueryModule.create(resourceManager);
      
      expect(module).toBeInstanceOf(MongoQueryModule);
      expect(module.mongoProvider).toBeDefined();
      expect(module.mongoProvider).toBeInstanceOf(MongoDBProvider);
    });

    it('should throw error without MONGODB_URL', async () => {
      // Create a mock ResourceManager without MONGODB_URL
      const mockRM = {
        get: (key) => {
          if (key === 'env.MONGODB_URL') return null;
          return resourceManager.get(key);
        },
        set: jest.fn(),
        has: jest.fn()
      };
      
      await expect(MongoQueryModule.create(mockRM)).rejects.toThrow('MONGODB_URL environment variable is required');
    });

    it('should retrieve existing MongoDBProvider from ResourceManager', async () => {
      // Create a provider and add it to ResourceManager
      const testProvider = new MongoDBProvider({
        connectionString: resourceManager.get('env.MONGODB_URL'),
        database: 'test_db'
      });
      await testProvider.connect();
      
      resourceManager.set('MongoDBProvider', testProvider);
      
      const module = await MongoQueryModule.create(resourceManager);
      
      expect(module.mongoProvider).toBe(testProvider);
      
      // Clean up
      resourceManager.set('MongoDBProvider', null);
      await testProvider.disconnect();
    });

    it('should create new MongoDBProvider when not exists', async () => {
      // Ensure no provider exists
      resourceManager.set('MongoDBProvider', null);
      
      const module = await MongoQueryModule.create(resourceManager);
      
      expect(module.mongoProvider).toBeInstanceOf(MongoDBProvider);
      expect(resourceManager.get('MongoDBProvider')).toBe(module.mongoProvider);
      
      // Store for cleanup
      mongoProvider = module.mongoProvider;
    });
  });

  describe('Module Initialization', () => {
    it('should initialize and register tool', async () => {
      const module = await MongoQueryModule.create(resourceManager);
      
      const tools = module.getTools();
      expect(tools.length).toBe(1);
      expect(tools[0]).toBeInstanceOf(MongoQueryTool);
      expect(tools[0].name).toBe('mongo_query');
    });

    it('should register tool with correct name', async () => {
      const module = await MongoQueryModule.create(resourceManager);
      
      const tool = module.getTool('mongo_query');
      expect(tool).toBeInstanceOf(MongoQueryTool);
      expect(tool.mongoProvider).toBe(module.mongoProvider);
    });
  });
});