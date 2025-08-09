/**
 * Unit Tests for Tool Registry Database Service
 * 
 * Tests the database service layer in isolation
 */

import { ToolRegistryDatabaseService } from '../../../src/database/ToolRegistryDatabaseService.js';
import { ToolRegistrySchemaManager } from '../../../src/database/schemas/ToolRegistrySchemas.js';
import { ResourceManager } from '@legion/tools';

// Mock storage provider
const mockStorageProvider = {
  connected: true,
  connect: jest.fn(),
  disconnect: jest.fn(),
  insert: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  updateOne: jest.fn(),
  deleteOne: jest.fn(),
  delete: jest.fn(),
  count: jest.fn(),
  createIndex: jest.fn(),
  ensureCollection: jest.fn(),
  startTransaction: jest.fn(),
  commitTransaction: jest.fn(),
  rollbackTransaction: jest.fn()
};

// Mock StorageProvider.create
jest.mock('@legion/storage', () => ({
  StorageProvider: {
    create: jest.fn()
  }
}));

describe('ToolRegistryDatabaseService Unit Tests', () => {
  let resourceManager;

  beforeAll(async () => {
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
  });

  afterAll(async () => {
    if (resourceManager) {
      await resourceManager.cleanup();
    }
  });

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup default mock behaviors
    mockStorageProvider.connect.mockResolvedValue(undefined);
    mockStorageProvider.disconnect.mockResolvedValue(undefined);
    mockStorageProvider.insert.mockResolvedValue({ _id: 'mock_id', acknowledged: true });
    mockStorageProvider.findOne.mockResolvedValue(null);
    mockStorageProvider.find.mockResolvedValue([]);
    mockStorageProvider.updateOne.mockResolvedValue({ modifiedCount: 1 });
    mockStorageProvider.deleteOne.mockResolvedValue({ deletedCount: 1 });
    mockStorageProvider.delete.mockResolvedValue({ deletedCount: 0 });
    mockStorageProvider.count.mockResolvedValue(0);
    mockStorageProvider.createIndex.mockResolvedValue(undefined);
    mockStorageProvider.ensureCollection.mockResolvedValue(undefined);
    mockStorageProvider.startTransaction.mockResolvedValue('mock_transaction');
    mockStorageProvider.commitTransaction.mockResolvedValue(undefined);
    mockStorageProvider.rollbackTransaction.mockResolvedValue(undefined);
  });

  describe('Factory Method and Initialization', () => {
    test('should require ResourceManager for creation', async () => {
      console.log('🧪 Testing ToolRegistryDatabaseService ResourceManager requirement');

      await expect(ToolRegistryDatabaseService.create(null))
        .rejects
        .toThrow('ResourceManager is required');

      const uninitializedRM = new ResourceManager();
      await expect(ToolRegistryDatabaseService.create(uninitializedRM))
        .rejects
        .toThrow('ResourceManager must be initialized');

      console.log('✅ ResourceManager requirement enforced');
    });

    test('should create service with valid ResourceManager', async () => {
      console.log('🧪 Testing valid ToolRegistryDatabaseService creation');

      const { StorageProvider } = await import('@legion/storage');
      StorageProvider.create.mockResolvedValue(mockStorageProvider);

      const service = await ToolRegistryDatabaseService.create(resourceManager);

      expect(service).toBeDefined();
      expect(service.initialized).toBe(true);
      expect(service.mongoProvider).toBe(mockStorageProvider);
      expect(StorageProvider.create).toHaveBeenCalledWith(resourceManager);
      expect(mockStorageProvider.connect).toHaveBeenCalled();

      console.log('✅ Valid service creation working');
    });

    test('should initialize schemas during creation', async () => {
      console.log('🧪 Testing schema initialization');

      const { StorageProvider } = await import('@legion/storage');
      StorageProvider.create.mockResolvedValue(mockStorageProvider);

      const service = await ToolRegistryDatabaseService.create(resourceManager);

      // Should have called ensureCollection for each schema
      expect(mockStorageProvider.ensureCollection).toHaveBeenCalledWith(
        'modules',
        expect.any(Object)
      );
      expect(mockStorageProvider.ensureCollection).toHaveBeenCalledWith(
        'tools', 
        expect.any(Object)
      );
      expect(mockStorageProvider.ensureCollection).toHaveBeenCalledWith(
        'tool_usage',
        expect.any(Object)
      );

      console.log('✅ Schema initialization working');
    });

    test('should handle storage provider creation failures', async () => {
      console.log('🧪 Testing storage provider creation failure handling');

      const { StorageProvider } = await import('@legion/storage');
      StorageProvider.create.mockRejectedValue(new Error('MongoDB connection failed'));

      await expect(ToolRegistryDatabaseService.create(resourceManager))
        .rejects
        .toThrow('MongoDB connection failed');

      console.log('✅ Storage provider failure handling working');
    });
  });

  describe('Module Operations', () => {
    let service;

    beforeEach(async () => {
      const { StorageProvider } = await import('@legion/storage');
      StorageProvider.create.mockResolvedValue(mockStorageProvider);
      service = await ToolRegistryDatabaseService.create(resourceManager);
    });

    test('should save modules correctly', async () => {
      console.log('🧪 Testing module saving');

      const moduleData = {
        name: 'TestModule',
        description: 'A test module',
        version: '1.0.0',
        type: 'class',
        tags: ['test'],
        category: 'testing'
      };

      const mockResult = {
        _id: 'module_123',
        ...moduleData,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockStorageProvider.insert.mockResolvedValue(mockResult);

      const result = await service.saveModule(moduleData);

      expect(mockStorageProvider.insert).toHaveBeenCalledWith(
        'modules',
        expect.objectContaining({
          name: 'TestModule',
          description: 'A test module',
          version: '1.0.0',
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date)
        })
      );

      expect(result).toEqual(mockResult);

      console.log('✅ Module saving working');
    });

    test('should get modules by name', async () => {
      console.log('🧪 Testing module retrieval');

      const mockModule = {
        _id: 'module_123',
        name: 'TestModule',
        description: 'A test module'
      };

      mockStorageProvider.findOne.mockResolvedValue(mockModule);

      const result = await service.getModule('TestModule');

      expect(mockStorageProvider.findOne).toHaveBeenCalledWith(
        'modules',
        { name: 'TestModule' },
        {}
      );

      expect(result).toEqual(mockModule);

      console.log('✅ Module retrieval working');
    });

    test('should list modules with filters', async () => {
      console.log('🧪 Testing module listing with filters');

      const mockModules = [
        { _id: '1', name: 'Module1', category: 'testing' },
        { _id: '2', name: 'Module2', category: 'testing' }
      ];

      mockStorageProvider.find.mockResolvedValue(mockModules);

      const result = await service.listModules({
        category: 'testing',
        limit: 10,
        skip: 0,
        sort: { name: 1 }
      });

      expect(mockStorageProvider.find).toHaveBeenCalledWith(
        'modules',
        { category: 'testing' },
        {
          limit: 10,
          skip: 0,
          sort: { name: 1 }
        }
      );

      expect(result).toEqual(mockModules);

      console.log('✅ Module listing with filters working');
    });

    test('should delete modules', async () => {
      console.log('🧪 Testing module deletion');

      mockStorageProvider.deleteOne.mockResolvedValue({ deletedCount: 1 });

      const result = await service.deleteModule('TestModule');

      expect(mockStorageProvider.deleteOne).toHaveBeenCalledWith(
        'modules',
        { name: 'TestModule' }
      );

      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(1);

      console.log('✅ Module deletion working');
    });

    test('should search modules by text', async () => {
      console.log('🧪 Testing module text search');

      const mockModules = [
        { _id: '1', name: 'FileModule', description: 'File operations' }
      ];

      mockStorageProvider.find.mockResolvedValue(mockModules);

      const result = await service.searchModules('file', { limit: 5 });

      expect(mockStorageProvider.find).toHaveBeenCalledWith(
        'modules',
        {
          $or: [
            { name: { $regex: 'file', $options: 'i' } },
            { description: { $regex: 'file', $options: 'i' } },
            { tags: { $in: [/file/i] } }
          ]
        },
        expect.objectContaining({ limit: 5 })
      );

      expect(result).toEqual(mockModules);

      console.log('✅ Module text search working');
    });
  });

  describe('Tool Operations', () => {
    let service;

    beforeEach(async () => {
      const { StorageProvider } = await import('@legion/storage');
      StorageProvider.create.mockResolvedValue(mockStorageProvider);
      service = await ToolRegistryDatabaseService.create(resourceManager);
    });

    test('should save tools correctly', async () => {
      console.log('🧪 Testing tool saving');

      const toolData = {
        name: 'test_tool',
        moduleName: 'TestModule',
        description: 'A test tool',
        category: 'test',
        tags: ['test'],
        inputSchema: {
          type: 'object',
          properties: {
            input: { type: 'string' }
          }
        }
      };

      const mockResult = {
        _id: 'tool_123',
        ...toolData,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockStorageProvider.insert.mockResolvedValue(mockResult);

      const result = await service.saveTool(toolData);

      expect(mockStorageProvider.insert).toHaveBeenCalledWith(
        'tools',
        expect.objectContaining({
          name: 'test_tool',
          moduleName: 'TestModule',
          description: 'A test tool',
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date)
        })
      );

      expect(result).toEqual(mockResult);

      console.log('✅ Tool saving working');
    });

    test('should get tools by name and module', async () => {
      console.log('🧪 Testing tool retrieval');

      const mockTool = {
        _id: 'tool_123',
        name: 'test_tool',
        moduleName: 'TestModule',
        description: 'A test tool'
      };

      mockStorageProvider.findOne.mockResolvedValue(mockTool);

      const result = await service.getTool('test_tool', 'TestModule');

      expect(mockStorageProvider.findOne).toHaveBeenCalledWith(
        'tools',
        { name: 'test_tool', moduleName: 'TestModule' },
        {}
      );

      expect(result).toEqual(mockTool);

      console.log('✅ Tool retrieval working');
    });

    test('should list tools with complex filters', async () => {
      console.log('🧪 Testing tool listing with complex filters');

      const mockTools = [
        { _id: '1', name: 'tool1', moduleName: 'Module1', category: 'read' },
        { _id: '2', name: 'tool2', moduleName: 'Module1', category: 'write' }
      ];

      mockStorageProvider.find.mockResolvedValue(mockTools);

      const result = await service.listTools({
        moduleName: 'Module1',
        category: 'read',
        tags: ['file'],
        limit: 20,
        skip: 10
      });

      expect(mockStorageProvider.find).toHaveBeenCalledWith(
        'tools',
        {
          moduleName: 'Module1',
          category: 'read',
          tags: { $in: ['file'] }
        },
        expect.objectContaining({
          limit: 20,
          skip: 10
        })
      );

      expect(result).toEqual(mockTools);

      console.log('✅ Tool listing with complex filters working');
    });

    test('should delete tools', async () => {
      console.log('🧪 Testing tool deletion');

      mockStorageProvider.deleteOne.mockResolvedValue({ deletedCount: 1 });

      const result = await service.deleteTool('test_tool', 'TestModule');

      expect(mockStorageProvider.deleteOne).toHaveBeenCalledWith(
        'tools',
        { name: 'test_tool', moduleName: 'TestModule' }
      );

      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(1);

      console.log('✅ Tool deletion working');
    });

    test('should update tool embeddings', async () => {
      console.log('🧪 Testing tool embedding updates');

      const embedding = new Array(1536).fill(0.1);
      mockStorageProvider.updateOne.mockResolvedValue({ modifiedCount: 1 });

      const result = await service.updateToolEmbedding('tool_123', embedding, 'text-embedding-3-small');

      expect(mockStorageProvider.updateOne).toHaveBeenCalledWith(
        'tools',
        { _id: 'tool_123' },
        {
          $set: {
            'embedding.vector': embedding,
            'embedding.model': 'text-embedding-3-small',
            'embedding.generatedAt': expect.any(Date),
            updatedAt: expect.any(Date)
          }
        }
      );

      expect(result.success).toBe(true);

      console.log('✅ Tool embedding updates working');
    });

    test('should get tools without embeddings', async () => {
      console.log('🧪 Testing tools without embeddings retrieval');

      const mockTools = [
        { _id: '1', name: 'tool1', moduleName: 'Module1' },
        { _id: '2', name: 'tool2', moduleName: 'Module1' }
      ];

      mockStorageProvider.find.mockResolvedValue(mockTools);

      const result = await service.getToolsWithoutEmbeddings(10);

      expect(mockStorageProvider.find).toHaveBeenCalledWith(
        'tools',
        { 'embedding.vector': { $exists: false } },
        { limit: 10 }
      );

      expect(result).toEqual(mockTools);

      console.log('✅ Tools without embeddings retrieval working');
    });

    test('should search tools with text', async () => {
      console.log('🧪 Testing tool text search');

      const mockTools = [
        { _id: '1', name: 'file_read', description: 'Read file contents' }
      ];

      mockStorageProvider.find.mockResolvedValue(mockTools);

      const result = await service.searchTools('read file', {
        category: 'read',
        limit: 10
      });

      expect(mockStorageProvider.find).toHaveBeenCalledWith(
        'tools',
        {
          $and: [
            {
              $or: [
                { name: { $regex: 'read file', $options: 'i' } },
                { description: { $regex: 'read file', $options: 'i' } },
                { summary: { $regex: 'read file', $options: 'i' } },
                { tags: { $in: [/read file/i] } }
              ]
            },
            { category: 'read' }
          ]
        },
        expect.objectContaining({ limit: 10 })
      );

      expect(result).toEqual(mockTools);

      console.log('✅ Tool text search working');
    });
  });

  describe('Usage Tracking', () => {
    let service;

    beforeEach(async () => {
      const { StorageProvider } = await import('@legion/storage');
      StorageProvider.create.mockResolvedValue(mockStorageProvider);
      service = await ToolRegistryDatabaseService.create(resourceManager);
    });

    test('should record tool usage', async () => {
      console.log('🧪 Testing usage recording');

      const usageData = {
        toolId: 'tool_123',
        toolName: 'test_tool',
        moduleName: 'TestModule',
        userId: 'user_456',
        success: true,
        executionTime: 150,
        inputData: { test: 'input' },
        outputData: { result: 'output' },
        errorMessage: null,
        metadata: { source: 'test' }
      };

      const mockResult = {
        _id: 'usage_789',
        ...usageData,
        timestamp: new Date()
      };

      mockStorageProvider.insert.mockResolvedValue(mockResult);

      const result = await service.recordUsage(usageData);

      expect(mockStorageProvider.insert).toHaveBeenCalledWith(
        'tool_usage',
        expect.objectContaining({
          toolId: 'tool_123',
          toolName: 'test_tool',
          success: true,
          executionTime: 150,
          timestamp: expect.any(Date)
        })
      );

      expect(result).toEqual(mockResult);

      console.log('✅ Usage recording working');
    });

    test('should get usage statistics', async () => {
      console.log('🧪 Testing usage statistics retrieval');

      const mockStats = [
        {
          _id: null,
          totalUsage: 100,
          successfulUsage: 95,
          failedUsage: 5,
          avgExecutionTime: 125.5,
          lastUsed: new Date()
        }
      ];

      mockStorageProvider.find.mockResolvedValue(mockStats);

      const result = await service.getUsageStats('test_tool', 'TestModule', {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31')
      });

      expect(mockStorageProvider.find).toHaveBeenCalled();
      expect(result).toEqual(mockStats[0]);

      console.log('✅ Usage statistics retrieval working');
    });

    test('should get trending tools', async () => {
      console.log('🧪 Testing trending tools retrieval');

      const mockTrending = [
        {
          _id: { toolName: 'file_read', moduleName: 'FileModule' },
          recentUsage: 50,
          successRate: 0.96,
          avgExecutionTime: 100
        },
        {
          _id: { toolName: 'file_write', moduleName: 'FileModule' },
          recentUsage: 30,
          successRate: 0.93,
          avgExecutionTime: 150
        }
      ];

      mockStorageProvider.find.mockResolvedValue(mockTrending);

      const result = await service.getTrendingTools({
        days: 7,
        limit: 10
      });

      expect(mockStorageProvider.find).toHaveBeenCalled();
      expect(result).toEqual(mockTrending);

      console.log('✅ Trending tools retrieval working');
    });

    test('should clean old usage records', async () => {
      console.log('🧪 Testing old usage records cleanup');

      mockStorageProvider.delete.mockResolvedValue({ deletedCount: 25 });

      const result = await service.cleanOldUsageRecords(30);

      expect(mockStorageProvider.delete).toHaveBeenCalledWith(
        'tool_usage',
        {
          timestamp: {
            $lt: expect.any(Date)
          }
        }
      );

      expect(result.deletedCount).toBe(25);

      console.log('✅ Old usage records cleanup working');
    });
  });

  describe('Transaction Support', () => {
    let service;

    beforeEach(async () => {
      const { StorageProvider } = await import('@legion/storage');
      StorageProvider.create.mockResolvedValue(mockStorageProvider);
      service = await ToolRegistryDatabaseService.create(resourceManager);
    });

    test('should support transaction operations', async () => {
      console.log('🧪 Testing transaction support');

      const transactionId = 'mock_transaction_123';
      mockStorageProvider.startTransaction.mockResolvedValue(transactionId);

      const sessionId = await service.startTransaction();
      expect(sessionId).toBe(transactionId);
      expect(mockStorageProvider.startTransaction).toHaveBeenCalled();

      await service.commitTransaction(sessionId);
      expect(mockStorageProvider.commitTransaction).toHaveBeenCalledWith(sessionId);

      // Test rollback
      const sessionId2 = await service.startTransaction();
      await service.rollbackTransaction(sessionId2);
      expect(mockStorageProvider.rollbackTransaction).toHaveBeenCalledWith(sessionId2);

      console.log('✅ Transaction support working');
    });

    test('should handle transaction errors', async () => {
      console.log('🧪 Testing transaction error handling');

      mockStorageProvider.startTransaction.mockRejectedValue(new Error('Transaction start failed'));

      await expect(service.startTransaction())
        .rejects
        .toThrow('Transaction start failed');

      mockStorageProvider.commitTransaction.mockRejectedValue(new Error('Commit failed'));

      await expect(service.commitTransaction('test_session'))
        .rejects
        .toThrow('Commit failed');

      console.log('✅ Transaction error handling working');
    });
  });

  describe('Database Statistics', () => {
    let service;

    beforeEach(async () => {
      const { StorageProvider } = await import('@legion/storage');
      StorageProvider.create.mockResolvedValue(mockStorageProvider);
      service = await ToolRegistryDatabaseService.create(resourceManager);
    });

    test('should provide database statistics', async () => {
      console.log('🧪 Testing database statistics');

      mockStorageProvider.count
        .mockResolvedValueOnce(10) // modules
        .mockResolvedValueOnce(50) // tools
        .mockResolvedValueOnce(500); // usage records

      const stats = await service.getDatabaseStats();

      expect(mockStorageProvider.count).toHaveBeenCalledWith('modules', {});
      expect(mockStorageProvider.count).toHaveBeenCalledWith('tools', {});
      expect(mockStorageProvider.count).toHaveBeenCalledWith('tool_usage', {});

      expect(stats).toEqual({
        modules: 10,
        tools: 50,
        usageRecords: 500
      });

      console.log(`📊 Stats: ${stats.modules} modules, ${stats.tools} tools, ${stats.usageRecords} usage records`);
      console.log('✅ Database statistics working');
    });

    test('should handle statistics errors gracefully', async () => {
      console.log('🧪 Testing statistics error handling');

      mockStorageProvider.count.mockRejectedValue(new Error('Count failed'));

      const stats = await service.getDatabaseStats();

      expect(stats).toEqual({
        modules: 0,
        tools: 0,
        usageRecords: 0
      });

      console.log('✅ Statistics error handling working');
    });
  });

  describe('Health Check', () => {
    let service;

    beforeEach(async () => {
      const { StorageProvider } = await import('@legion/storage');
      StorageProvider.create.mockResolvedValue(mockStorageProvider);
      service = await ToolRegistryDatabaseService.create(resourceManager);
    });

    test('should provide health check information', async () => {
      console.log('🧪 Testing health check');

      mockStorageProvider.count.mockResolvedValue(10);

      const health = await service.healthCheck();

      expect(health).toMatchObject({
        status: 'healthy',
        initialized: true,
        connected: true,
        provider: 'ToolRegistryDatabaseService',
        collections: {
          modules: expect.any(Number),
          tools: expect.any(Number),
          tool_usage: expect.any(Number)
        }
      });

      console.log(`🏥 Health: ${health.status} (${health.collections.tools} tools)`);
      console.log('✅ Health check working');
    });

    test('should detect unhealthy state', async () => {
      console.log('🧪 Testing unhealthy state detection');

      const disconnectedService = new ToolRegistryDatabaseService({
        _factoryCall: true,
        resourceManager,
        mongoProvider: { ...mockStorageProvider, connected: false }
      });

      const health = await disconnectedService.healthCheck();

      expect(health.status).toBe('degraded');
      expect(health.connected).toBe(false);

      console.log('✅ Unhealthy state detection working');
    });
  });

  describe('Resource Cleanup', () => {
    test('should cleanup resources properly', async () => {
      console.log('🧪 Testing resource cleanup');

      const { StorageProvider } = await import('@legion/storage');
      StorageProvider.create.mockResolvedValue(mockStorageProvider);

      const service = await ToolRegistryDatabaseService.create(resourceManager);

      expect(service.initialized).toBe(true);

      await service.cleanup();

      expect(mockStorageProvider.disconnect).toHaveBeenCalled();

      console.log('✅ Resource cleanup working');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    let service;

    beforeEach(async () => {
      const { StorageProvider } = await import('@legion/storage');
      StorageProvider.create.mockResolvedValue(mockStorageProvider);
      service = await ToolRegistryDatabaseService.create(resourceManager);
    });

    test('should handle database connection failures', async () => {
      console.log('🧪 Testing database connection failure handling');

      mockStorageProvider.findOne.mockRejectedValue(new Error('Connection lost'));

      await expect(service.getModule('TestModule'))
        .rejects
        .toThrow('Connection lost');

      console.log('✅ Database connection failure handling working');
    });

    test('should handle malformed data gracefully', async () => {
      console.log('🧪 Testing malformed data handling');

      // Test with invalid module data
      const invalidModule = {
        // Missing required fields
        description: 'Invalid module'
      };

      mockStorageProvider.insert.mockRejectedValue(new Error('Validation failed'));

      await expect(service.saveModule(invalidModule))
        .rejects
        .toThrow('Validation failed');

      console.log('✅ Malformed data handling working');
    });

    test('should handle null and undefined parameters', async () => {
      console.log('🧪 Testing null/undefined parameter handling');

      mockStorageProvider.findOne.mockResolvedValue(null);

      // These should not crash, should return null or empty results
      const result1 = await service.getModule(null);
      const result2 = await service.getTool(undefined, 'Module');
      const result3 = await service.listModules(null);

      expect(result1).toBeNull();
      expect(result2).toBeNull();
      expect(Array.isArray(result3)).toBe(true);

      console.log('✅ Null/undefined parameter handling working');
    });

    test('should handle concurrent operations', async () => {
      console.log('🧪 Testing concurrent operations handling');

      const operations = [
        service.getModule('Module1'),
        service.getTool('tool1', 'Module1'),
        service.listModules(),
        service.listTools(),
        service.getDatabaseStats()
      ];

      mockStorageProvider.findOne.mockResolvedValue(null);
      mockStorageProvider.find.mockResolvedValue([]);
      mockStorageProvider.count.mockResolvedValue(0);

      const results = await Promise.all(operations);

      expect(results).toHaveLength(5);
      results.forEach(result => expect(result).toBeDefined());

      console.log('✅ Concurrent operations handling working');
    });
  });
});