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
    // Create mock perspective types collection with proper sequence for initialization
    const mockPerspectiveTypesCollection = {
      countDocuments: jest.fn(),
      insertMany: jest.fn().mockResolvedValue({ insertedCount: 4 }),
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([
            { _id: 'type1', name: 'functional', prompt_template: 'Describe {toolName}', category: 'technical', order: 1, enabled: true },
            { _id: 'type2', name: 'usage', prompt_template: 'Usage for {toolName}', category: 'practical', order: 2, enabled: true }
          ])
        })
      }),
      createIndex: jest.fn().mockResolvedValue(true)
    };
    
    // Set up countDocuments to return appropriate values based on the test flow
    let perspectiveTypesCountCalls = 0;
    mockPerspectiveTypesCollection.countDocuments.mockImplementation(() => {
      perspectiveTypesCountCalls++;
      // First call during seeding check returns 0 (empty)
      // Second call during validation returns 4 (after seeding)
      // All subsequent calls return 4
      if (perspectiveTypesCountCalls === 1) {
        return Promise.resolve(0);
      }
      return Promise.resolve(4);
    });
    
    // Create mock tool perspectives collection
    mockPerspectivesCollection = {
      find: jest.fn().mockReturnValue({
        toArray: jest.fn().mockResolvedValue([])
      }),
      findOne: jest.fn().mockResolvedValue(null),
      insertOne: jest.fn().mockResolvedValue({ insertedId: 'perspective-123' }),
      insertMany: jest.fn().mockResolvedValue({ insertedCount: 1 }),
      replaceOne: jest.fn().mockResolvedValue({ upsertedId: 'perspective-456' }),
      deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 }),
      countDocuments: jest.fn().mockResolvedValue(0),
      distinct: jest.fn().mockResolvedValue(['tool1', 'tool2']),
      createIndex: jest.fn().mockResolvedValue(true),
      bulkWrite: jest.fn().mockResolvedValue({ upsertedCount: 2, modifiedCount: 0 })
    };
    
    // Create mock tools collection
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
      }),
      createIndex: jest.fn().mockResolvedValue(true)
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
      complete: jest.fn().mockResolvedValue(JSON.stringify({
        perspective: "This tool reads files from the filesystem and returns their contents",
        category: "file-operations",
        useCases: [
          "Reading configuration files",
          "Loading data from disk",
          "Processing text files"
        ],
        relatedTools: ["file-writer", "file-scanner"]
      })),
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
    
    // Create mock DatabaseStorage with all required methods
    mockDatabaseStorage = {
      db: {
        collection: jest.fn((name) => {
          if (name === 'perspective_types') return mockPerspectiveTypesCollection;
          if (name === 'tool_perspectives') return mockPerspectivesCollection;
          if (name === 'tools') return mockToolsCollection;
          return mockPerspectivesCollection;
        }),
        listCollections: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([
            { name: 'perspective_types' },
            { name: 'tool_perspectives' },
            { name: 'tools' }
          ])
        }),
        createCollection: jest.fn().mockResolvedValue(true)
      },
      findToolPerspectivesByTool: jest.fn().mockResolvedValue([]),
      findTool: jest.fn().mockResolvedValue({
        _id: 'tool1',
        name: 'file-reader',
        description: 'Read files from the filesystem',
        moduleName: 'FileModule'
      }),
      saveToolPerspectives: jest.fn().mockResolvedValue(2),
      saveToolPerspective: jest.fn().mockResolvedValue({ 
        tool_name: 'file-reader',
        perspective_type_name: 'functional',
        content: 'Mocked perspective'
      }),
      findToolPerspectives: jest.fn().mockResolvedValue([]),
      findTools: jest.fn().mockResolvedValue([]),
      deleteToolPerspectivesByTool: jest.fn().mockResolvedValue(1),
      clearPerspectiveData: jest.fn().mockResolvedValue(),
      getPerspectiveStats: jest.fn().mockResolvedValue({
        perspectiveTypes: { total: 4, enabled: 4, disabled: 0 },
        toolPerspectives: { total: 25 },
        coverage: { toolsWithPerspectives: 10 }
      })
    };
    
    // Create mock ResourceManager
    mockResourceManager = {
      get: jest.fn((key) => {
        if (key === 'storageProvider') return mockStorageProvider;
        if (key === 'llmClient') return mockLLMClient;
        if (key === 'databaseStorage') return mockDatabaseStorage;
        return null;
      })
    };
    
    // Create perspectives instance
    perspectives = new Perspectives({
      resourceManager: mockResourceManager
    });
    
    // Mark as initialized to prevent auto-initialization in tests
    perspectives.initialized = true;
    
    // CRITICAL: Assign the mock database storage to the perspectives instance
    // This ensures all tests have access to the mocked database operations
    perspectives.databaseStorage = mockDatabaseStorage;
    
    // CRITICAL: Assign the mock LLM client to the perspectives instance
    // This ensures all tests have access to the mocked LLM client
    perspectives.llmClient = mockLLMClient;
    
    // Mock the database initializer that would be created during initialize
    perspectives.databaseInitializer = { 
      initialize: jest.fn().mockResolvedValue(true)
    };
    
    // Mock the perspective type manager with default perspective types
    perspectives.perspectiveTypeManager = {
      getAllPerspectiveTypes: jest.fn().mockResolvedValue([
        { name: 'functional', prompt_template: 'Functional perspective for {toolName}', order: 1 },
        { name: 'usage', prompt_template: 'Usage for {toolName}', order: 2 }
      ]),
      initialize: jest.fn().mockResolvedValue(true)
    };
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('constructor', () => {
    it('should create a Perspectives instance', () => {
      expect(perspectives).toBeInstanceOf(Perspectives);
    });
    
    it('should accept options', () => {
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
    
    it('should work with valid configuration', () => {
      const persp = new Perspectives({ resourceManager: mockResourceManager });
      expect(persp).toBeInstanceOf(Perspectives);
    });
  });
  
  describe('generatePerspectivesForTool', () => {
    it('should generate perspectives for a tool', async () => {
      // Mock perspective types for new architecture
      const mockPerspectiveTypes = [
        { _id: 'type1', name: 'functional', prompt_template: 'Describe how {toolName} functions' },
        { _id: 'type2', name: 'usage', prompt_template: 'Describe when to use {toolName}' }
      ];
      
      // Update the mock to return the specific perspective types for this test
      perspectives.perspectiveTypeManager.getAllPerspectiveTypes.mockResolvedValue(mockPerspectiveTypes);
      
      // Override specific mock methods for this test
      mockDatabaseStorage.findToolPerspectivesByTool.mockResolvedValue([]);
      mockDatabaseStorage.findTool.mockResolvedValue({
        _id: 'tool1',
        name: 'file-reader',
        description: 'Read files from the filesystem',
        moduleName: 'FileModule'
      });
      mockDatabaseStorage.saveToolPerspectives.mockResolvedValue(2);
      
      // Mock LLM response for multi-perspective generation
      mockLLMClient.complete.mockResolvedValue(JSON.stringify([
        { content: 'Functional perspective content' },
        { content: 'Usage perspective content' }
      ]));
      
      const result = await perspectives.generatePerspectivesForTool('file-reader');
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('tool_name', 'file-reader');
      expect(result[0]).toHaveProperty('content');
      expect(result[0]).toHaveProperty('keywords');
      expect(result[0]).toHaveProperty('perspective_type_name');
    });
    
    it('should call LLM client with proper multi-perspective prompt', async () => {
      // Mock perspective types - use 2 types to match what initialize sets up
      const mockPerspectiveTypes = [
        { _id: 'type1', name: 'functional', prompt_template: 'Describe how {toolName} functions' },
        { _id: 'type2', name: 'usage', prompt_template: 'Usage for {toolName}' }
      ];
      
      const mockTypeManager = {
        getAllPerspectiveTypes: jest.fn().mockResolvedValue(mockPerspectiveTypes),
        initialize: jest.fn()
      };
      
      perspectives.perspectiveTypeManager = mockTypeManager;
      perspectives.databaseInitializer = { initialize: jest.fn() };
      
      // Override specific mock methods for this test
      mockDatabaseStorage.findToolPerspectivesByTool.mockResolvedValue([]);
      mockDatabaseStorage.findTool.mockResolvedValue({
        _id: 'tool1',
        name: 'file-reader',
        description: 'Read files from the filesystem'
      });
      mockDatabaseStorage.saveToolPerspectives.mockResolvedValue(2);
      
      mockLLMClient.complete.mockResolvedValue(JSON.stringify([
        { content: 'Functional perspective' },
        { content: 'Usage perspective' }
      ]));
      
      
      await perspectives.generatePerspectivesForTool('file-reader');
      
      expect(mockLLMClient.complete).toHaveBeenCalled();
      const call = mockLLMClient.complete.mock.calls[0][0];
      expect(call).toContain('file-reader');
      expect(call).toContain('Read files from the filesystem');
      expect(call).toContain('Generate 2 different perspectives');
    });
    
    it('should use existing perspectives when available', async () => {
      // Mock perspective types - use 2 to match initialize
      const mockPerspectiveTypes = [
        { _id: 'type1', name: 'functional', prompt_template: 'Describe how {toolName} functions' },
        { _id: 'type2', name: 'usage', prompt_template: 'Usage for {toolName}' }
      ];
      
      const mockTypeManager = {
        getAllPerspectiveTypes: jest.fn().mockResolvedValue(mockPerspectiveTypes),
        initialize: jest.fn()
      };
      
      perspectives.perspectiveTypeManager = mockTypeManager;
      perspectives.databaseInitializer = { initialize: jest.fn() };
      
      // Mock existing perspectives - matching the 2 types
      const existingPerspectives = [
        {
          tool_name: 'file-reader',
          perspective_type_name: 'functional',
          content: 'Existing functional perspective'
        },
        {
          tool_name: 'file-reader',
          perspective_type_name: 'usage',
          content: 'Existing usage perspective'
        }
      ];
      
      // Mock the direct collection query that the implementation uses
      mockPerspectivesCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue(existingPerspectives)
      });
      
      // Override specific mock methods for this test
      mockDatabaseStorage.findTool.mockResolvedValue({
        _id: 'tool1',  // Need an ID for the lookup to work
        name: 'file-reader',
        description: 'Read files'
      });
      
      
      // Reset mock after initialization to ensure it's not called during the test
      mockLLMClient.complete.mockClear();
      
      const result = await perspectives.generatePerspectivesForTool('file-reader');
      
      expect(mockLLMClient.complete).not.toHaveBeenCalled(); // Should use existing
      expect(result).toEqual(existingPerspectives);
    });
    
    it('should handle LLM errors gracefully', async () => {
      // Setup mocks for new architecture
      const mockPerspectiveTypes = [
        { _id: 'type1', name: 'functional', prompt_template: 'Describe {toolName}' }
      ];
      
      perspectives.perspectiveTypeManager = {
        getAllPerspectiveTypes: jest.fn().mockResolvedValue(mockPerspectiveTypes),
        initialize: jest.fn()
      };
      perspectives.databaseInitializer = { initialize: jest.fn() };
      
      perspectives.databaseStorage = {
        findToolPerspectivesByTool: jest.fn().mockResolvedValue([]),
        findTool: jest.fn().mockResolvedValue({
          name: 'file-reader',
          description: 'Read files'
        })
      };
      
      mockLLMClient.complete.mockRejectedValue(new Error('LLM error'));
      
      await expect(perspectives.generatePerspectivesForTool('file-reader'))
        .rejects.toThrow('Failed to generate perspectives');
    });
    
    it('should handle invalid LLM responses', async () => {
      // Setup mocks
      const mockPerspectiveTypes = [
        { _id: 'type1', name: 'functional', prompt_template: 'Describe {toolName}' }
      ];
      
      perspectives.perspectiveTypeManager = {
        getAllPerspectiveTypes: jest.fn().mockResolvedValue(mockPerspectiveTypes),
        initialize: jest.fn()
      };
      perspectives.databaseInitializer = { initialize: jest.fn() };
      
      // Override specific mock methods for this test
      mockDatabaseStorage.findToolPerspectivesByTool.mockResolvedValue([]);
      mockDatabaseStorage.findTool.mockResolvedValue({
        _id: 'tool1',
        name: 'file-reader',
        description: 'Read files'
      });
      mockDatabaseStorage.saveToolPerspectives.mockResolvedValue(1);
      
      mockLLMClient.complete.mockResolvedValue('Invalid JSON response');
      
      const result = await perspectives.generatePerspectivesForTool('file-reader');
      
      // Should fall back to default structure
      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty('content');
      expect(result[0].content).toContain('Auto-generated perspective');
    });
  });
  
  describe('generateForModule', () => {
    it('should generate perspectives for all tools in a module', async () => {
      // Mock perspective types - using 2 types to match initialize
      const mockPerspectiveTypes = [
        { _id: 'type1', name: 'functional', prompt_template: 'Describe {toolName}' },
        { _id: 'type2', name: 'usage', prompt_template: 'Usage for {toolName}' }
      ];
      
      perspectives.perspectiveTypeManager = {
        getAllPerspectiveTypes: jest.fn().mockResolvedValue(mockPerspectiveTypes),
        initialize: jest.fn()
      };
      perspectives.databaseInitializer = { initialize: jest.fn() };
      
      mockDatabaseStorage.findTools.mockResolvedValue([
        { name: 'tool1', description: 'Tool 1', moduleName: 'TestModule' },
        { name: 'tool2', description: 'Tool 2', moduleName: 'TestModule' }
      ]);
      
      mockDatabaseStorage.findToolPerspectivesByTool.mockResolvedValue([]);
      
      mockLLMClient.complete.mockResolvedValue(JSON.stringify([
        { content: 'Functional perspective' },
        { content: 'Usage perspective' }
      ]));
      
      
      const results = await perspectives.generateForModule('TestModule');
      
      // Each tool generates 2 perspectives (functional and usage), so 2 tools = 4 perspectives total
      expect(results).toHaveLength(4);
      expect(mockLLMClient.complete).toHaveBeenCalledTimes(2); // Once per tool
    });
    
    it('should use batch generation for multiple tools', async () => {
      // Mock perspective types
      const mockPerspectiveTypes = [
        { _id: 'type1', name: 'functional', prompt_template: 'Describe {toolName}' }
      ];
      
      perspectives.perspectiveTypeManager = {
        getAllPerspectiveTypes: jest.fn().mockResolvedValue(mockPerspectiveTypes),
        initialize: jest.fn()
      };
      perspectives.databaseInitializer = { initialize: jest.fn() };
      
      // Create many tools
      const manyTools = Array.from({ length: 15 }, (_, i) => ({
        name: `tool${i}`,
        description: `Tool ${i}`,
        moduleName: 'TestModule'
      }));
      
      mockDatabaseStorage.findTools.mockResolvedValue(manyTools);
      mockDatabaseStorage.findToolPerspectives.mockResolvedValue([]);
      mockDatabaseStorage.findToolPerspectivesByTool.mockResolvedValue([]);
      
      // Mock batch response
      mockLLMClient.complete.mockResolvedValue(JSON.stringify([
        { content: 'Batch perspective' }
      ]));
      
      
      const results = await perspectives.generateForModule('TestModule', { useBatch: true });
      
      expect(results.length).toBeGreaterThan(0);
    });
  });
  
  describe('getToolPerspectives', () => {
    it('should retrieve perspectives from database', async () => {
      perspectives.databaseInitializer = { initialize: jest.fn() };
      perspectives.perspectiveTypeManager = { 
        initialize: jest.fn(),
        getAllPerspectiveTypes: jest.fn().mockResolvedValue([
          { _id: 'type1', name: 'functional', prompt_template: 'Describe {toolName}' },
          { _id: 'type2', name: 'usage', prompt_template: 'Usage for {toolName}' }
        ])
      };
      
      const mockPerspectives = [
        {
          tool_name: 'file-reader',
          perspective_type_name: 'functional',
          content: 'Stored perspective content'
        },
        {
          tool_name: 'file-reader', 
          perspective_type_name: 'usage',
          content: 'Usage perspective content'
        }
      ];
      
      // Use the shared mockDatabaseStorage but override findToolPerspectivesByTool
      mockDatabaseStorage.findToolPerspectivesByTool.mockResolvedValue(mockPerspectives);
      
      
      const result = await perspectives.getToolPerspectives('file-reader');
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      expect(result[0].tool_name).toBe('file-reader');
      expect(result[0].content).toBe('Stored perspective content');
    });
    
    it('should return empty array if perspectives not found', async () => {
      perspectives.databaseInitializer = { initialize: jest.fn() };
      perspectives.perspectiveTypeManager = { initialize: jest.fn() };
      perspectives.databaseStorage = {
        findToolPerspectivesByTool: jest.fn().mockResolvedValue([])
      };
      
      
      const result = await perspectives.getToolPerspectives('non-existent');
      
      expect(result).toEqual([]);
    });
    
    it('should support deprecated getPerspective method', async () => {
      perspectives.databaseInitializer = { initialize: jest.fn() };
      perspectives.perspectiveTypeManager = { 
        initialize: jest.fn(),
        getAllPerspectiveTypes: jest.fn().mockResolvedValue([
          { _id: 'type1', name: 'functional', prompt_template: 'Describe {toolName}' }
        ])
      };
      
      const mockPerspectives = [
        { tool_name: 'file-reader', content: 'First perspective' }
      ];
      
      // Use shared mockDatabaseStorage but override the method
      mockDatabaseStorage.findToolPerspectivesByTool.mockResolvedValue(mockPerspectives);
      
      
      const result = await perspectives.getPerspective('file-reader');
      
      expect(result).toBeDefined();
      expect(result.tool_name).toBe('file-reader');
      expect(result.content).toBe('First perspective');
    });
    
    it('should return null from deprecated getPerspective if no perspectives found', async () => {
      perspectives.databaseInitializer = { initialize: jest.fn() };
      perspectives.perspectiveTypeManager = { initialize: jest.fn() };
      
      perspectives.databaseStorage = {
        findToolPerspectivesByTool: jest.fn().mockResolvedValue([])
      };
      
      
      const result = await perspectives.getPerspective('non-existent');
      
      expect(result).toBeNull();
    });
  });
  
  describe('searchByPerspective', () => {
    it('should search perspectives by text', async () => {
      perspectives.databaseInitializer = { initialize: jest.fn() };
      perspectives.perspectiveTypeManager = { 
        initialize: jest.fn(),
        getAllPerspectiveTypes: jest.fn().mockResolvedValue([
          { _id: 'type1', name: 'functional', prompt_template: 'Describe {toolName}' }
        ])
      };
      
      const mockSearchResults = [
        {
          tool_name: 'file-reader',
          content: 'Read files from disk',
          perspective_type_name: 'functional'
        },
        {
          tool_name: 'file-writer',
          content: 'Write files to disk',
          perspective_type_name: 'functional'
        }
      ];
      
      // Use the shared mockDatabaseStorage but override the method
      mockDatabaseStorage.findToolPerspectives.mockResolvedValue(mockSearchResults);
      
      
      const results = await perspectives.searchByPerspective('read');
      
      expect(mockDatabaseStorage.findToolPerspectives).toHaveBeenCalledWith(
        expect.objectContaining({
          $or: expect.arrayContaining([
            expect.objectContaining({ content: expect.objectContaining({ $regex: expect.any(RegExp) }) }),
            expect.objectContaining({ keywords: expect.objectContaining({ $regex: expect.any(RegExp) }) })
          ])
        })
      );
      
      expect(results).toEqual(mockSearchResults);
    });
    
    it('should support search options', async () => {
      perspectives.databaseInitializer = { initialize: jest.fn() };
      perspectives.perspectiveTypeManager = { 
        initialize: jest.fn(),
        getAllPerspectiveTypes: jest.fn().mockResolvedValue([
          { _id: 'type1', name: 'functional', prompt_template: 'Describe {toolName}' }
        ])
      };
      
      // Use shared mockDatabaseStorage but override the method
      mockDatabaseStorage.findToolPerspectives.mockResolvedValue([]);
      
      
      await perspectives.searchByPerspective('test', { limit: 5 });
      
      expect(mockDatabaseStorage.findToolPerspectives).toHaveBeenCalledWith(
        expect.objectContaining({
          $or: expect.arrayContaining([
            expect.objectContaining({ content: expect.any(Object) }),
            expect.objectContaining({ keywords: expect.any(Object) })
          ])
        })
      );
    });
  });
  
  describe('getRelatedTools', () => {
    it('should return related tools (currently returns empty array)', async () => {
      perspectives.databaseInitializer = { initialize: jest.fn() };
      perspectives.perspectiveTypeManager = { initialize: jest.fn() };
      
      perspectives.databaseStorage = {
        findToolPerspectivesByTool: jest.fn().mockResolvedValue([
          {
            tool_name: 'file-reader',
            content: 'Read files from disk'
          }
        ])
      };
      
      
      const related = await perspectives.getRelatedTools('file-reader');
      
      // Current implementation returns empty array as related tools need semantic analysis
      expect(Array.isArray(related)).toBe(true);
      expect(related).toHaveLength(0);
    });
    
    it('should return empty array if no perspectives found', async () => {
      perspectives.databaseInitializer = { initialize: jest.fn() };
      perspectives.perspectiveTypeManager = { initialize: jest.fn() };
      
      perspectives.databaseStorage = {
        findToolPerspectivesByTool: jest.fn().mockResolvedValue([])
      };
      
      
      const related = await perspectives.getRelatedTools('non-existent');
      
      expect(related).toEqual([]);
    });
  });
  
  describe('clearPerspectives', () => {
    it('should clear all perspectives', async () => {
      perspectives.databaseInitializer = { initialize: jest.fn() };
      perspectives.perspectiveTypeManager = { initialize: jest.fn() };
      
      perspectives.databaseStorage = {
        clearPerspectiveData: jest.fn().mockResolvedValue()
      };
      
      
      const result = await perspectives.clearPerspectives();
      
      expect(perspectives.databaseStorage.clearPerspectiveData).toHaveBeenCalled();
      expect(result).toBe(0); // clearPerspectiveData doesn't return count
    });
    
    it('should clear perspectives for specific module', async () => {
      perspectives.databaseInitializer = { initialize: jest.fn() };
      perspectives.perspectiveTypeManager = { 
        initialize: jest.fn(),
        getAllPerspectiveTypes: jest.fn().mockResolvedValue([
          { _id: 'type1', name: 'functional', prompt_template: 'Describe {toolName}' }
        ])
      };
      
      const mockTools = [
        { name: 'tool1' },
        { name: 'tool2' }
      ];
      
      // Use shared mockDatabaseStorage but override specific methods
      mockDatabaseStorage.findTools.mockResolvedValue(mockTools);
      mockDatabaseStorage.deleteToolPerspectivesByTool.mockResolvedValue(1);
      
      
      const result = await perspectives.clearModulePerspectives('TestModule');
      
      expect(mockDatabaseStorage.findTools).toHaveBeenCalledWith({ moduleName: 'TestModule' });
      expect(mockDatabaseStorage.deleteToolPerspectivesByTool).toHaveBeenCalledTimes(2);
      expect(result).toBe(2);
    });
  });
  
  describe('getStatistics', () => {
    it('should return perspective statistics', async () => {
      perspectives.databaseInitializer = { initialize: jest.fn() };
      perspectives.perspectiveTypeManager = { 
        initialize: jest.fn(),
        getAllPerspectiveTypes: jest.fn().mockResolvedValue([
          { name: 'functional', category: 'technical' },
          { name: 'usage', category: 'practical' }
        ])
      };
      
      const mockStats = {
        perspectiveTypes: { total: 4, enabled: 4, disabled: 0 },
        toolPerspectives: { total: 25 },
        coverage: { toolsWithPerspectives: 10 }
      };
      
      const mockPerspectives = [
        { tool_name: 'tool1', perspective_type_name: 'functional' },
        { tool_name: 'tool2', perspective_type_name: 'functional' }
      ];
      
      perspectives.databaseStorage = {
        getPerspectiveStats: jest.fn().mockResolvedValue(mockStats),
        findToolPerspectives: jest.fn().mockResolvedValue(mockPerspectives),
        findTool: jest.fn().mockResolvedValue({ moduleName: 'FileModule' })
      };
      
      
      const stats = await perspectives.getStatistics();
      
      expect(stats.total).toBe(25);
      expect(stats.byCategory).toBeDefined();
      expect(stats.byModule).toBeDefined();
    });
  });
});