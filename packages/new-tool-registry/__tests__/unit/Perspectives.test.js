/**
 * Unit tests for Perspectives functionality
 * 
 * Tests perspective generation for semantic search
 * Following TDD principles - these tests are written before implementation
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Perspectives } from '../../src/search/Perspectives.js';
import { DatabaseStorage } from '../../src/core/DatabaseStorage.js';

describe('Perspectives', () => {
  let perspectives;
  let mockDatabaseStorage;
  let mockPerspectivesCollection;
  let mockToolsCollection;
  let mockLLMClient;
  let mockStorageProvider;
  let mockResourceManager;
  
  beforeEach(() => {
    // Create mock collections
    mockPerspectivesCollection = {
      find: jest.fn().mockReturnValue({
        toArray: jest.fn().mockResolvedValue([])
      }),
      findOne: jest.fn().mockResolvedValue(null),
      insertOne: jest.fn().mockResolvedValue({ insertedId: 'perspective-123' }),
      replaceOne: jest.fn().mockResolvedValue({ upsertedId: 'perspective-456' }),
      deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 }),
      countDocuments: jest.fn().mockResolvedValue(0)
    };
    
    mockToolsCollection = {
      find: jest.fn().mockReturnValue({
        toArray: jest.fn().mockResolvedValue([
          {
            name: 'file-reader',
            description: 'Read files from the filesystem',
            moduleName: 'FileModule',
            inputSchema: { type: 'object', properties: { path: { type: 'string' } } },
            outputSchema: { type: 'object', properties: { content: { type: 'string' } } }
          }
        ])
      }),
      findOne: jest.fn().mockResolvedValue({
        name: 'file-reader',
        description: 'Read files from the filesystem',
        moduleName: 'FileModule'
      })
    };
    
    // Create mock storage provider
    mockStorageProvider = {
      find: jest.fn((collection, query, options) => {
        if (collection === 'perspectives') {
          return mockPerspectivesCollection.find(query).toArray();
        }
        if (collection === 'tools') {
          return mockToolsCollection.find(query).toArray();
        }
        return [];
      }),
      findOne: jest.fn((collection, query) => {
        if (collection === 'perspectives') {
          return mockPerspectivesCollection.findOne(query);
        }
        if (collection === 'tools') {
          return mockToolsCollection.findOne(query);
        }
        return null;
      }),
      upsertOne: jest.fn().mockResolvedValue({ upsertedId: 'perspective-456' }),
      deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 }),
      count: jest.fn().mockResolvedValue(0),
      distinct: jest.fn().mockResolvedValue(['file-operations', 'data-processing'])
    };
    
    // Create mock LLM client
    mockLLMClient = {
      sendMessage: jest.fn().mockResolvedValue(JSON.stringify({
        perspective: "This tool reads files from the filesystem and returns their contents",
        category: "file-operations",
        useCases: [
          "Reading configuration files",
          "Loading data from disk",
          "Processing text files"
        ],
        relatedTools: ["file-writer", "file-scanner"]
      })),
      isConfigured: jest.fn().mockReturnValue(true)
    };
    
    // Create mock ResourceManager
    mockResourceManager = {
      get: jest.fn((key) => {
        if (key === 'storageProvider') return mockStorageProvider;
        if (key === 'llmClient') return mockLLMClient;
        return null;
      })
    };
    
    // Create perspectives instance
    perspectives = new Perspectives({
      resourceManager: mockResourceManager
    });
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('constructor', () => {
    it('should create a Perspectives instance', () => {
      expect(perspectives).toBeInstanceOf(Perspectives);
    });
    
    it('should accept options', () => {
      const mockResourceManager = {
        get: jest.fn((key) => {
          if (key === 'storageProvider') return {};
          if (key === 'llmClient') return {};
          return null;
        })
      };
      
      const persp = new Perspectives({
        resourceManager: mockResourceManager,
        options: {
          batchSize: 20,
          verbose: true
        }
      });
      
      expect(persp.options.batchSize).toBe(20);
      expect(persp.options.verbose).toBe(true);
    });
    
    it('should throw error without ResourceManager', () => {
      expect(() => new Perspectives({}))
        .toThrow('ResourceManager is required');
    });
    
    it('should throw error without LLM client during initialization', async () => {
      const mockResourceManager = {
        get: jest.fn((key) => {
          if (key === 'storageProvider') return {};
          if (key === 'llmClient') return null;
          return null;
        })
      };
      
      const persp = new Perspectives({ resourceManager: mockResourceManager });
      await expect(persp.initialize()).rejects.toThrow('LLMClient not available');
    });
  });
  
  describe('generatePerspective', () => {
    it('should generate perspective for a tool', async () => {
      await perspectives.initialize();
      
      const result = await perspectives.generatePerspective('file-reader');
      
      expect(result).toBeDefined();
      expect(result).toHaveProperty('toolName', 'file-reader');
      expect(result).toHaveProperty('perspective');
      expect(result).toHaveProperty('category');
      expect(result).toHaveProperty('useCases');
      expect(Array.isArray(result.useCases)).toBe(true);
    });
    
    it('should call LLM client with proper prompt', async () => {
      await perspectives.initialize();
      
      await perspectives.generatePerspective('file-reader');
      
      expect(mockLLMClient.sendMessage).toHaveBeenCalled();
      const call = mockLLMClient.sendMessage.mock.calls[0][0];
      expect(call).toContain('file-reader');
      expect(call).toContain('Read files from the filesystem');
    });
    
    it('should cache perspectives', async () => {
      await perspectives.initialize();
      
      // First call should generate
      await perspectives.generatePerspective('file-reader');
      expect(mockLLMClient.sendMessage).toHaveBeenCalledTimes(1);
      
      // Second call should use cache
      mockPerspectivesCollection.findOne.mockResolvedValue({
        toolName: 'file-reader',
        perspective: 'Cached perspective',
        category: 'file-operations'
      });
      
      await perspectives.generatePerspective('file-reader');
      expect(mockLLMClient.sendMessage).toHaveBeenCalledTimes(1); // Still just 1 call
    });
    
    it('should handle LLM errors gracefully', async () => {
      await perspectives.initialize();
      mockLLMClient.sendMessage.mockRejectedValue(new Error('LLM error'));
      
      await expect(perspectives.generatePerspective('file-reader'))
        .rejects.toThrow('Failed to generate perspective');
    });
    
    it('should handle invalid LLM responses', async () => {
      await perspectives.initialize();
      mockLLMClient.sendMessage.mockResolvedValue('Invalid JSON response');
      
      const result = await perspectives.generatePerspective('file-reader');
      
      // Should fall back to default structure
      expect(result).toHaveProperty('perspective');
      expect(result).toHaveProperty('category', 'general');
    });
  });
  
  describe('generateForModule', () => {
    it('should generate perspectives for all tools in a module', async () => {
      await perspectives.initialize();
      
      mockToolsCollection.find().toArray.mockResolvedValue([
        { name: 'tool1', description: 'Tool 1', moduleName: 'TestModule' },
        { name: 'tool2', description: 'Tool 2', moduleName: 'TestModule' }
      ]);
      
      const results = await perspectives.generateForModule('TestModule');
      
      expect(results).toHaveLength(2);
      expect(mockLLMClient.sendMessage).toHaveBeenCalledTimes(2);
    });
    
    it('should use batch generation for multiple tools', async () => {
      await perspectives.initialize();
      
      // Create many tools
      const manyTools = Array.from({ length: 15 }, (_, i) => ({
        name: `tool${i}`,
        description: `Tool ${i}`,
        moduleName: 'TestModule'
      }));
      
      mockToolsCollection.find().toArray.mockResolvedValue(manyTools);
      
      // Mock batch response
      mockLLMClient.sendMessage.mockResolvedValue(JSON.stringify(
        Array.from({ length: 10 }, () => ({
          perspective: 'Batch perspective',
          category: 'general',
          useCases: [],
          relatedTools: []
        }))
      ));
      
      const results = await perspectives.generateForModule('TestModule', { useBatch: true });
      
      expect(results.length).toBeGreaterThan(0);
    });
  });
  
  describe('getPerspective', () => {
    it('should retrieve perspective from database', async () => {
      await perspectives.initialize();
      
      mockPerspectivesCollection.findOne.mockResolvedValue({
        toolName: 'file-reader',
        perspective: 'Stored perspective',
        category: 'file-operations'
      });
      
      const result = await perspectives.getPerspective('file-reader');
      
      expect(result).toBeDefined();
      expect(result.toolName).toBe('file-reader');
      expect(result.perspective).toBe('Stored perspective');
    });
    
    it('should return null if perspective not found', async () => {
      await perspectives.initialize();
      
      mockPerspectivesCollection.findOne.mockResolvedValue(null);
      
      const result = await perspectives.getPerspective('non-existent');
      
      expect(result).toBeNull();
    });
  });
  
  describe('searchByPerspective', () => {
    it('should search perspectives by text', async () => {
      await perspectives.initialize();
      
      mockPerspectivesCollection.find().toArray.mockResolvedValue([
        {
          toolName: 'file-reader',
          perspective: 'Read files from disk',
          category: 'file-operations'
        },
        {
          toolName: 'file-writer',
          perspective: 'Write files to disk',
          category: 'file-operations'
        }
      ]);
      
      const results = await perspectives.searchByPerspective('read');
      
      expect(mockStorageProvider.find).toHaveBeenCalledWith(
        'perspectives',
        expect.objectContaining({
          perspective: expect.objectContaining({ $regex: expect.any(RegExp) })
        }),
        {}
      );
    });
    
    it('should support limit option', async () => {
      await perspectives.initialize();
      
      await perspectives.searchByPerspective('test', { limit: 5 });
      
      expect(mockStorageProvider.find).toHaveBeenCalledWith(
        'perspectives',
        expect.any(Object),
        { limit: 5 }
      );
    });
  });
  
  describe('getRelatedTools', () => {
    it('should return related tools', async () => {
      await perspectives.initialize();
      
      mockPerspectivesCollection.findOne.mockResolvedValue({
        toolName: 'file-reader',
        relatedTools: ['file-writer', 'file-scanner'],
        category: 'file-operations'
      });
      
      const related = await perspectives.getRelatedTools('file-reader');
      
      expect(related).toContain('file-writer');
      expect(related).toContain('file-scanner');
    });
    
    it('should include tools from same category if requested', async () => {
      await perspectives.initialize();
      
      mockPerspectivesCollection.findOne.mockResolvedValue({
        toolName: 'file-reader',
        relatedTools: ['file-writer'],
        category: 'file-operations'
      });
      
      mockPerspectivesCollection.find().toArray.mockResolvedValue([
        { toolName: 'file-scanner', category: 'file-operations' },
        { toolName: 'file-validator', category: 'file-operations' }
      ]);
      
      const related = await perspectives.getRelatedTools('file-reader', { includeCategory: true });
      
      expect(related).toContain('file-writer');
      expect(related).toContain('file-scanner');
      expect(related).toContain('file-validator');
    });
    
    it('should return empty array if no perspective found', async () => {
      await perspectives.initialize();
      
      mockPerspectivesCollection.findOne.mockResolvedValue(null);
      
      const related = await perspectives.getRelatedTools('non-existent');
      
      expect(related).toEqual([]);
    });
  });
  
  describe('clearPerspectives', () => {
    it('should clear all perspectives', async () => {
      await perspectives.initialize();
      
      mockStorageProvider.deleteMany.mockResolvedValue({ deletedCount: 10 });
      
      const result = await perspectives.clearPerspectives();
      
      expect(mockStorageProvider.deleteMany).toHaveBeenCalledWith('perspectives', {});
      expect(result.deletedCount).toBe(10);
    });
    
    it('should clear perspectives for specific module', async () => {
      await perspectives.initialize();
      
      mockToolsCollection.find().toArray.mockResolvedValue([
        { name: 'tool1' },
        { name: 'tool2' }
      ]);
      
      mockStorageProvider.deleteMany.mockResolvedValue({ deletedCount: 2 });
      
      const result = await perspectives.clearPerspectives('TestModule');
      
      expect(mockStorageProvider.find).toHaveBeenCalledWith('tools', { moduleName: 'TestModule' });
      expect(mockStorageProvider.deleteMany).toHaveBeenCalledWith(
        'perspectives',
        { toolName: { $in: ['tool1', 'tool2'] } }
      );
    });
  });
  
  describe('getStatistics', () => {
    it('should return perspective statistics', async () => {
      await perspectives.initialize();
      
      mockStorageProvider.count.mockResolvedValue(25);
      mockStorageProvider.distinct.mockResolvedValue(['file-operations', 'data-processing', 'network']);
      
      // Mock count for each category
      mockStorageProvider.count
        .mockResolvedValueOnce(25) // total
        .mockResolvedValueOnce(10) // file-operations
        .mockResolvedValueOnce(8)  // data-processing
        .mockResolvedValueOnce(5)  // network
        .mockResolvedValueOnce(2); // uncategorized
      
      const stats = await perspectives.getStatistics();
      
      expect(stats.total).toBe(25);
      expect(stats.byCategory).toBeDefined();
      expect(stats.uncategorized).toBe(2);
    });
  });
});