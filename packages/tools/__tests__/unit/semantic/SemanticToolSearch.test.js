/**
 * Unit Tests for Semantic Tool Search
 * 
 * Tests the semantic search functionality in isolation
 */

import { SemanticToolSearch } from '../../../src/semantic/SemanticToolSearch.js';
import { ResourceManager } from '@legion/tools';

// Mock the semantic search provider
const mockSemanticSearchProvider = {
  connected: true,
  connect: jest.fn(),
  disconnect: jest.fn(),
  createCollection: jest.fn(),
  insert: jest.fn(),
  semanticSearch: jest.fn(),
  delete: jest.fn(),
  count: jest.fn()
};

// Mock the tool registry provider
const mockToolRegistryProvider = {
  initialized: true,
  hasCapability: jest.fn(),
  getToolsWithoutEmbeddings: jest.fn(),
  listTools: jest.fn(),
  getTool: jest.fn(),
  updateToolEmbedding: jest.fn()
};

// Mock SemanticSearchProvider.create
jest.mock('@legion/semantic-search', () => ({
  SemanticSearchProvider: {
    create: jest.fn()
  }
}));

describe('SemanticToolSearch Unit Tests', () => {
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
    mockSemanticSearchProvider.createCollection.mockResolvedValue(undefined);
    mockSemanticSearchProvider.insert.mockResolvedValue(undefined);
    mockSemanticSearchProvider.semanticSearch.mockResolvedValue([]);
    mockSemanticSearchProvider.count.mockResolvedValue(0);
    
    mockToolRegistryProvider.hasCapability.mockReturnValue(false);
    mockToolRegistryProvider.getToolsWithoutEmbeddings.mockResolvedValue([]);
    mockToolRegistryProvider.listTools.mockResolvedValue([]);
    mockToolRegistryProvider.getTool.mockResolvedValue(null);
  });

  describe('Constructor and Factory', () => {
    test('should not allow direct constructor usage', () => {
      console.log('🧪 Testing SemanticToolSearch constructor protection');

      expect(() => new SemanticToolSearch()).toThrow('must be created using create() factory method');

      console.log('✅ Constructor protection working');
    });

    test('should require ResourceManager for factory method', async () => {
      console.log('🧪 Testing SemanticToolSearch factory method requirements');

      await expect(SemanticToolSearch.create(null, mockToolRegistryProvider))
        .rejects
        .toThrow('requires initialized ResourceManager');

      const uninitializedRM = new ResourceManager();
      await expect(SemanticToolSearch.create(uninitializedRM, mockToolRegistryProvider))
        .rejects
        .toThrow('requires initialized ResourceManager');

      console.log('✅ Factory method requirements enforced');
    });

    test('should require tool registry provider', async () => {
      console.log('🧪 Testing tool registry provider requirement');

      await expect(SemanticToolSearch.create(resourceManager, null))
        .rejects
        .toThrow('requires a tool registry provider');

      console.log('✅ Tool registry provider requirement enforced');
    });

    test('should create instance with valid parameters', async () => {
      console.log('🧪 Testing valid SemanticToolSearch creation');

      const { SemanticSearchProvider } = await import('@legion/semantic-search');
      SemanticSearchProvider.create.mockResolvedValue(mockSemanticSearchProvider);

      const search = await SemanticToolSearch.create(resourceManager, mockToolRegistryProvider);
      
      expect(search).toBeDefined();
      expect(search.initialized).toBe(true);
      expect(search.resourceManager).toBe(resourceManager);
      expect(search.provider).toBe(mockToolRegistryProvider);

      await search.cleanup();

      console.log('✅ Valid creation working');
    });
  });

  describe('Initialization', () => {
    test('should initialize collections during setup', async () => {
      console.log('🧪 Testing collection initialization');

      const { SemanticSearchProvider } = await import('@legion/semantic-search');
      SemanticSearchProvider.create.mockResolvedValue(mockSemanticSearchProvider);

      const search = await SemanticToolSearch.create(resourceManager, mockToolRegistryProvider);

      expect(mockSemanticSearchProvider.createCollection).toHaveBeenCalledWith(
        'tools',
        expect.objectContaining({
          description: expect.stringContaining('Tool definitions'),
          dimension: 1536
        })
      );

      expect(mockSemanticSearchProvider.createCollection).toHaveBeenCalledWith(
        'modules',
        expect.objectContaining({
          description: expect.stringContaining('Module definitions'),
          dimension: 1536
        })
      );

      await search.cleanup();

      console.log('✅ Collection initialization working');
    });

    test('should index existing tools during initialization', async () => {
      console.log('🧪 Testing existing tools indexing');

      const { SemanticSearchProvider } = await import('@legion/semantic-search');
      SemanticSearchProvider.create.mockResolvedValue(mockSemanticSearchProvider);

      const mockTools = [
        {
          _id: 'tool1',
          name: 'file_read',
          moduleName: 'FileModule',
          description: 'Read file contents',
          category: 'read',
          tags: ['file', 'read']
        },
        {
          _id: 'tool2',
          name: 'file_write',
          moduleName: 'FileModule',
          description: 'Write file contents',
          category: 'write',
          tags: ['file', 'write']
        }
      ];

      mockToolRegistryProvider.listTools.mockResolvedValue(mockTools);

      const search = await SemanticToolSearch.create(resourceManager, mockToolRegistryProvider);

      expect(mockSemanticSearchProvider.insert).toHaveBeenCalledWith(
        'tools',
        expect.arrayContaining([
          expect.objectContaining({
            id: 'tool1',
            content: expect.stringContaining('file_read'),
            metadata: expect.objectContaining({
              toolName: 'file_read',
              moduleName: 'FileModule'
            })
          })
        ])
      );

      await search.cleanup();

      console.log('✅ Existing tools indexing working');
    });

    test('should handle initialization without semantic search dependencies', async () => {
      console.log('🧪 Testing initialization without semantic search');

      const { SemanticSearchProvider } = await import('@legion/semantic-search');
      SemanticSearchProvider.create.mockRejectedValue(new Error('OpenAI API key not found'));

      await expect(SemanticToolSearch.create(resourceManager, mockToolRegistryProvider))
        .rejects
        .toThrow('OpenAI API key not found');

      console.log('✅ Dependency error handling working');
    });
  });

  describe('Tool Text Generation', () => {
    let search;

    beforeEach(async () => {
      const { SemanticSearchProvider } = await import('@legion/semantic-search');
      SemanticSearchProvider.create.mockResolvedValue(mockSemanticSearchProvider);
      search = await SemanticToolSearch.create(resourceManager, mockToolRegistryProvider);
    });

    afterEach(async () => {
      if (search) {
        await search.cleanup();
      }
    });

    test('should create searchable text from tool metadata', () => {
      console.log('🧪 Testing tool text generation');

      const tool = {
        name: 'file_read',
        description: 'Read contents from a file',
        summary: 'Reads file data',
        category: 'read',
        tags: ['file', 'filesystem', 'read'],
        moduleName: 'FileModule',
        inputSchema: {
          type: 'object',
          properties: {
            filepath: { type: 'string', description: 'Path to file' }
          }
        },
        examples: [
          { title: 'Read config file', description: 'Read JSON configuration' }
        ]
      };

      const searchText = search.createToolSearchText(tool);

      expect(searchText).toContain('file_read');
      expect(searchText).toContain('Read contents from a file');
      expect(searchText).toContain('read');
      expect(searchText).toContain('file');
      expect(searchText).toContain('FileModule');
      expect(searchText).toContain('filepath');
      expect(searchText).toContain('Path to file');
      expect(searchText).toContain('Read config file');

      console.log(`📝 Generated search text: ${searchText.substring(0, 100)}...`);
      console.log('✅ Tool text generation working');
    });

    test('should convert schema to searchable text', () => {
      console.log('🧪 Testing schema to text conversion');

      const schema = {
        type: 'object',
        description: 'File operation parameters',
        properties: {
          filepath: { type: 'string', description: 'Path to target file' },
          content: { type: 'string', description: 'Content to write' },
          encoding: { type: 'string', description: 'File encoding' }
        }
      };

      const schemaText = search.schemaToText(schema);

      expect(schemaText).toContain('filepath');
      expect(schemaText).toContain('Path to target file');
      expect(schemaText).toContain('content');
      expect(schemaText).toContain('Content to write');
      expect(schemaText).toContain('File operation parameters');

      console.log(`📋 Schema text: ${schemaText}`);
      console.log('✅ Schema to text conversion working');
    });

    test('should handle malformed schemas gracefully', () => {
      console.log('🧪 Testing malformed schema handling');

      // Test with various malformed inputs
      expect(search.schemaToText(null)).toBe('');
      expect(search.schemaToText(undefined)).toBe('');
      expect(search.schemaToText('string schema')).toBe('string schema');
      expect(search.schemaToText(123)).toBe('');

      // Test with circular reference (should not crash)
      const circular = { a: 1 };
      circular.self = circular;
      const result = search.schemaToText(circular);
      expect(typeof result).toBe('string');

      console.log('✅ Malformed schema handling working');
    });
  });

  describe('Semantic Search Operations', () => {
    let search;

    beforeEach(async () => {
      const { SemanticSearchProvider } = await import('@legion/semantic-search');
      SemanticSearchProvider.create.mockResolvedValue(mockSemanticSearchProvider);
      search = await SemanticToolSearch.create(resourceManager, mockToolRegistryProvider);
    });

    afterEach(async () => {
      if (search) {
        await search.cleanup();
      }
    });

    test('should perform semantic tool search', async () => {
      console.log('🧪 Testing semantic tool search');

      const mockSearchResults = [
        {
          metadata: {
            toolName: 'file_read',
            moduleName: 'FileModule'
          },
          _similarity: 0.85
        }
      ];

      const mockTool = {
        name: 'file_read',
        moduleName: 'FileModule',
        description: 'Read file contents'
      };

      mockSemanticSearchProvider.semanticSearch.mockResolvedValue(mockSearchResults);
      mockToolRegistryProvider.getTool.mockResolvedValue(mockTool);

      const results = await search.searchTools('read file contents', { limit: 5 });

      expect(mockSemanticSearchProvider.semanticSearch).toHaveBeenCalledWith(
        'tools',
        'read file contents',
        expect.objectContaining({
          limit: 5,
          threshold: 0.7
        })
      );

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        name: 'file_read',
        moduleName: 'FileModule',
        _similarity: 0.85,
        _searchRank: 1
      });

      console.log('✅ Semantic tool search working');
    });

    test('should find similar tools', async () => {
      console.log('🧪 Testing similar tools discovery');

      const referenceTool = {
        name: 'file_read',
        moduleName: 'FileModule',
        description: 'Read file contents',
        tags: ['file', 'read']
      };

      const similarTools = [
        {
          name: 'file_write',
          moduleName: 'FileModule',
          description: 'Write file contents',
          _similarity: 0.75
        }
      ];

      mockToolRegistryProvider.getTool.mockResolvedValue(referenceTool);
      mockSemanticSearchProvider.semanticSearch.mockResolvedValue([
        {
          metadata: { toolName: 'file_write', moduleName: 'FileModule' },
          _similarity: 0.75
        }
      ]);
      mockToolRegistryProvider.getTool
        .mockResolvedValueOnce(referenceTool)
        .mockResolvedValueOnce(similarTools[0]);

      const results = await search.findSimilarTools('file_read', 'FileModule');

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('file_write');
      expect(results[0]._similarity).toBe(0.75);

      console.log('✅ Similar tools discovery working');
    });

    test('should provide task-based tool recommendations', async () => {
      console.log('🧪 Testing task-based recommendations');

      const mockTools = [
        {
          name: 'file_read',
          moduleName: 'FileModule',
          description: 'Read file contents',
          category: 'read',
          tags: ['file'],
          _similarity: 0.85
        },
        {
          name: 'file_write', 
          moduleName: 'FileModule',
          description: 'Write file contents',
          category: 'write',
          tags: ['file'],
          _similarity: 0.80
        }
      ];

      mockSemanticSearchProvider.semanticSearch.mockResolvedValue([
        { metadata: { toolName: 'file_read', moduleName: 'FileModule' }, _similarity: 0.85 },
        { metadata: { toolName: 'file_write', moduleName: 'FileModule' }, _similarity: 0.80 }
      ]);

      mockToolRegistryProvider.getTool
        .mockResolvedValueOnce(mockTools[0])
        .mockResolvedValueOnce(mockTools[1]);

      const recommendations = await search.recommendToolsForTask('read and write files');

      expect(recommendations).toHaveProperty('taskDescription', 'read and write files');
      expect(recommendations).toHaveProperty('totalRecommendations');
      expect(recommendations).toHaveProperty('recommendations');
      expect(Array.isArray(recommendations.recommendations)).toBe(true);

      if (recommendations.recommendations.length > 0) {
        const firstRec = recommendations.recommendations[0];
        expect(firstRec).toHaveProperty('tool');
        expect(firstRec).toHaveProperty('similarity');
        expect(firstRec).toHaveProperty('reasoning');
        expect(typeof firstRec.reasoning).toBe('string');
      }

      console.log(`🎯 Generated ${recommendations.totalRecommendations} recommendations`);
      console.log('✅ Task-based recommendations working');
    });
  });

  describe('Query Enhancement', () => {
    let search;

    beforeEach(async () => {
      const { SemanticSearchProvider } = await import('@legion/semantic-search');
      SemanticSearchProvider.create.mockResolvedValue(mockSemanticSearchProvider);
      search = await SemanticToolSearch.create(resourceManager, mockToolRegistryProvider);
    });

    afterEach(async () => {
      if (search) {
        await search.cleanup();
      }
    });

    test('should enhance task queries with operation keywords', () => {
      console.log('🧪 Testing query enhancement');

      const testCases = [
        {
          input: 'read a file',
          expectedKeywords: ['read', 'get', 'fetch', 'load']
        },
        {
          input: 'write data to file',
          expectedKeywords: ['write', 'save', 'create', 'store']
        },
        {
          input: 'delete old files',
          expectedKeywords: ['delete', 'remove', 'unlink']
        },
        {
          input: 'search for documents',
          expectedKeywords: ['search', 'find', 'query', 'lookup']
        },
        {
          input: 'make HTTP API call',
          expectedKeywords: ['http', 'api', 'request', 'response']
        }
      ];

      for (const testCase of testCases) {
        const enhanced = search.enhanceTaskQuery(testCase.input);
        
        expect(enhanced).toContain(testCase.input);
        for (const keyword of testCase.expectedKeywords) {
          expect(enhanced.toLowerCase()).toContain(keyword);
        }
      }

      console.log('✅ Query enhancement working');
    });

    test('should generate meaningful recommendation reasoning', () => {
      console.log('🧪 Testing recommendation reasoning generation');

      const tool = {
        name: 'file_read',
        description: 'Read contents from a file system',
        tags: ['file', 'filesystem', 'read']
      };

      const testCases = [
        {
          task: 'read a file',
          expectedReasons: ['Supports read operations', 'File system operations']
        },
        {
          task: 'work with JSON data',
          expectedReasons: []  // Should fallback to similarity percentage
        }
      ];

      for (const testCase of testCases) {
        const reasoning = search.generateRecommendationReasoning(
          { ...tool, _similarity: 0.85 }, 
          testCase.task
        );
        
        expect(typeof reasoning).toBe('string');
        expect(reasoning.length).toBeGreaterThan(0);
        
        if (testCase.expectedReasons.length > 0) {
          const containsExpected = testCase.expectedReasons.some(reason =>
            reasoning.includes(reason)
          );
          expect(containsExpected).toBe(true);
        } else {
          // Should contain similarity percentage as fallback
          expect(reasoning).toMatch(/\d+%/);
        }
      }

      console.log('✅ Recommendation reasoning working');
    });
  });

  describe('Indexing Operations', () => {
    let search;

    beforeEach(async () => {
      const { SemanticSearchProvider } = await import('@legion/semantic-search');
      SemanticSearchProvider.create.mockResolvedValue(mockSemanticSearchProvider);
      search = await SemanticToolSearch.create(resourceManager, mockToolRegistryProvider);
    });

    afterEach(async () => {
      if (search) {
        await search.cleanup();
      }
    });

    test('should index individual tools', async () => {
      console.log('🧪 Testing individual tool indexing');

      const tool = {
        _id: 'tool123',
        name: 'test_tool',
        moduleName: 'TestModule',
        description: 'A test tool',
        category: 'test',
        tags: ['test']
      };

      await search.indexTool(tool);

      expect(mockSemanticSearchProvider.insert).toHaveBeenCalledWith(
        'tools',
        expect.arrayContaining([
          expect.objectContaining({
            id: 'tool123',
            content: expect.stringContaining('test_tool'),
            metadata: expect.objectContaining({
              toolName: 'test_tool',
              moduleName: 'TestModule'
            })
          })
        ])
      );

      console.log('✅ Individual tool indexing working');
    });

    test('should remove tools from index', async () => {
      console.log('🧪 Testing tool removal from index');

      await search.removeToolFromIndex('test_tool', 'TestModule');

      expect(mockSemanticSearchProvider.delete).toHaveBeenCalledWith(
        'tools',
        { id: 'TestModule.test_tool' }
      );

      console.log('✅ Tool removal from index working');
    });

    test('should reindex all tools', async () => {
      console.log('🧪 Testing complete reindexing');

      const allTools = [
        { name: 'tool1', moduleName: 'Module1', description: 'Tool 1' },
        { name: 'tool2', moduleName: 'Module2', description: 'Tool 2' }
      ];

      mockToolRegistryProvider.listTools.mockResolvedValue(allTools);

      await search.reindexAllTools();

      expect(mockSemanticSearchProvider.delete).toHaveBeenCalledWith('tools', {});
      expect(mockSemanticSearchProvider.insert).toHaveBeenCalledWith(
        'tools',
        expect.arrayContaining([
          expect.objectContaining({
            content: expect.stringContaining('tool1'),
            metadata: expect.objectContaining({ toolName: 'tool1' })
          }),
          expect.objectContaining({
            content: expect.stringContaining('tool2'),
            metadata: expect.objectContaining({ toolName: 'tool2' })
          })
        ])
      );

      console.log('✅ Complete reindexing working');
    });
  });

  describe('Statistics and Health', () => {
    let search;

    beforeEach(async () => {
      const { SemanticSearchProvider } = await import('@legion/semantic-search');
      SemanticSearchProvider.create.mockResolvedValue(mockSemanticSearchProvider);
      search = await SemanticToolSearch.create(resourceManager, mockToolRegistryProvider);
    });

    afterEach(async () => {
      if (search) {
        await search.cleanup();
      }
    });

    test('should provide search statistics', async () => {
      console.log('🧪 Testing search statistics');

      mockSemanticSearchProvider.count
        .mockResolvedValueOnce(25) // tools
        .mockResolvedValueOnce(5); // modules

      const stats = await search.getSearchStats();

      expect(stats).toMatchObject({
        toolsIndexed: 25,
        modulesIndexed: 5,
        collections: ['tools', 'modules'],
        config: expect.objectContaining({
          threshold: expect.any(Number),
          maxResults: expect.any(Number),
          batchSize: expect.any(Number)
        })
      });

      console.log(`📊 Stats: ${stats.toolsIndexed} tools, ${stats.modulesIndexed} modules`);
      console.log('✅ Search statistics working');
    });

    test('should provide health check information', async () => {
      console.log('🧪 Testing health check');

      mockSemanticSearchProvider.count.mockResolvedValue(10);

      const health = await search.healthCheck();

      expect(health).toMatchObject({
        status: 'healthy',
        initialized: true,
        connected: true,
        stats: expect.objectContaining({
          toolsIndexed: expect.any(Number)
        })
      });

      console.log(`🏥 Health: ${health.status} (${health.stats.toolsIndexed} tools indexed)`);
      console.log('✅ Health check working');
    });

    test('should handle errors in statistics gracefully', async () => {
      console.log('🧪 Testing error handling in statistics');

      mockSemanticSearchProvider.count.mockRejectedValue(new Error('Connection failed'));

      const stats = await search.getSearchStats();
      const health = await search.healthCheck();

      expect(stats).toMatchObject({
        error: 'Connection failed',
        toolsIndexed: 0,
        modulesIndexed: 0
      });

      expect(health.status).toBe('error');
      expect(health.error).toBe('Connection failed');

      console.log('✅ Error handling in statistics working');
    });
  });

  describe('Resource Cleanup', () => {
    test('should cleanup resources properly', async () => {
      console.log('🧪 Testing resource cleanup');

      const { SemanticSearchProvider } = await import('@legion/semantic-search');
      SemanticSearchProvider.create.mockResolvedValue(mockSemanticSearchProvider);

      const search = await SemanticToolSearch.create(resourceManager, mockToolRegistryProvider);
      
      expect(search.initialized).toBe(true);

      await search.cleanup();

      expect(mockSemanticSearchProvider.disconnect).toHaveBeenCalled();
      expect(search.initialized).toBe(false);

      console.log('✅ Resource cleanup working');
    });
  });

  describe('Error Scenarios', () => {
    test('should handle semantic search provider failures', async () => {
      console.log('🧪 Testing semantic search provider failure handling');

      const { SemanticSearchProvider } = await import('@legion/semantic-search');
      SemanticSearchProvider.create.mockResolvedValue(mockSemanticSearchProvider);

      const search = await SemanticToolSearch.create(resourceManager, mockToolRegistryProvider);

      // Mock search failure
      mockSemanticSearchProvider.semanticSearch.mockRejectedValue(new Error('Vector search failed'));

      await expect(search.searchTools('test query'))
        .rejects
        .toThrow('Vector search failed');

      await search.cleanup();

      console.log('✅ Provider failure handling working');
    });

    test('should handle tool provider failures', async () => {
      console.log('🧪 Testing tool provider failure handling');

      const { SemanticSearchProvider } = await import('@legion/semantic-search');
      SemanticSearchProvider.create.mockResolvedValue(mockSemanticSearchProvider);

      const search = await SemanticToolSearch.create(resourceManager, mockToolRegistryProvider);

      mockSemanticSearchProvider.semanticSearch.mockResolvedValue([
        { metadata: { toolName: 'missing_tool', moduleName: 'MissingModule' }, _similarity: 0.9 }
      ]);
      mockToolRegistryProvider.getTool.mockResolvedValue(null);

      const results = await search.searchTools('test query');

      // Should handle missing tools gracefully
      expect(results).toHaveLength(0);

      await search.cleanup();

      console.log('✅ Tool provider failure handling working');
    });

    test('should handle uninitialized state gracefully', async () => {
      console.log('🧪 Testing uninitialized state handling');

      const { SemanticSearchProvider } = await import('@legion/semantic-search');
      SemanticSearchProvider.create.mockResolvedValue(mockSemanticSearchProvider);

      // Create but don't initialize
      const search = new SemanticToolSearch({
        _factoryCall: true,
        resourceManager,
        semanticSearch: mockSemanticSearchProvider,
        provider: mockToolRegistryProvider,
        config: {}
      });

      expect(search.initialized).toBe(false);

      // Operations on uninitialized instance should throw
      await expect(search.searchTools('test'))
        .rejects
        .toThrow('not initialized');

      // Indexing operations should be no-ops
      await search.indexTool({ name: 'test', moduleName: 'test' }); // Should not throw
      await search.removeToolFromIndex('test', 'test'); // Should not throw

      console.log('✅ Uninitialized state handling working');
    });
  });
});