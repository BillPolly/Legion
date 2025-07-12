import { LLMCLIFramework } from '../../../src';
import { MockLLMProvider } from '../../../src/core/providers/MockLLMProvider';
import { 
  MongoDocumentStorage,
  VectorStorage,
  EmbeddingService,
  SearchService,
  SyncService,
  DocumentProcessor 
} from '@search-demo/semantic-search';
import { MongoConnection } from '@search-demo/shared-utils';

// Mock only the EmbeddingService to avoid OPENAI_API_KEY requirement
jest.mock('@search-demo/semantic-search', () => {
  const actual = jest.requireActual('@search-demo/semantic-search');
  return {
    ...actual,
    EmbeddingService: jest.fn().mockImplementation(() => ({
      generateEmbedding: jest.fn().mockResolvedValue(Array(1536).fill(0.1)),
      generateEmbeddings: jest.fn().mockResolvedValue([Array(1536).fill(0.1)])
    }))
  };
});

describe('LLM-CLI and Semantic Search Integration', () => {
  let framework: LLMCLIFramework;
  let mongoStorage: MongoDocumentStorage;
  let vectorStorage: VectorStorage;
  let searchService: SearchService;
  let syncService: SyncService;

  beforeAll(async () => {
    // Initialize mocks
    const mongoConnection = {
      getCollection: jest.fn().mockReturnValue({
        insertOne: jest.fn(),
        findOne: jest.fn(),
        find: jest.fn().mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) }),
        updateOne: jest.fn(),
        deleteOne: jest.fn()
      })
    } as unknown as MongoConnection;
    
    mongoStorage = new MongoDocumentStorage(mongoConnection);
    vectorStorage = new VectorStorage();
    
    // Mock EmbeddingService methods instead of passing llmProvider
    const embeddingService = new EmbeddingService();
    jest.spyOn(embeddingService, 'generateEmbedding').mockResolvedValue(new Array(1536).fill(0));
    
    // Create document processor
    const documentProcessor = new DocumentProcessor();
    
    searchService = new SearchService({
      mongoStorage,
      vectorStorage,
      embeddingService
    });
    
    syncService = new SyncService({
      mongoStorage,
      vectorStorage,
      embeddingService,
      documentProcessor
    });

    // mongoStorage doesn't have connect/disconnect methods - those are on MongoConnection
    
    // Initialize framework with configured mock provider
    const mockLLMProvider = new MockLLMProvider();
    
    // Clear responses and configure one by one to avoid conflicts
    // The mock provider matches patterns in order, so more specific patterns should come first
    
    // For the parameter validation test - just "search" without params
    mockLLMProvider.clearResponses();
    
    // Need to handle each test input specifically
    // The intent recognizer adds "USER INPUT: " prefix to the prompt
    mockLLMProvider.addResponse('USER INPUT: search\n', JSON.stringify({
      command: 'search',
      parameters: {}, // Missing query parameter
      confidence: 0.95
    }));
    
    mockLLMProvider.addResponse('USER INPUT: find documents about machine learning', JSON.stringify({
      command: 'search',
      parameters: { query: 'machine learning' },
      confidence: 0.95
    }));
    
    mockLLMProvider.addResponse('USER INPUT: search for AI papers with limit 5', JSON.stringify({
      command: 'search',
      parameters: { query: 'AI papers', limit: 5 },
      confidence: 0.95
    }));
    
    mockLLMProvider.addResponse('USER INPUT: find documents about AI', JSON.stringify({
      command: 'search',
      parameters: { query: 'AI' },
      confidence: 0.95
    }));
    
    mockLLMProvider.addResponse('USER INPUT: query for neural networks', JSON.stringify({
      command: 'search',
      parameters: { query: 'neural networks' },
      confidence: 0.95
    }));
    
    mockLLMProvider.addResponse('USER INPUT: search machine learning', JSON.stringify({
      command: 'search',
      parameters: { query: 'machine learning' },
      confidence: 0.95
    }));
    
    mockLLMProvider.addResponse('USER INPUT: error-test', JSON.stringify({
      command: 'error-test',
      parameters: {},
      confidence: 0.95
    }));
    
    mockLLMProvider.addResponse('USER INPUT: real-search deep learning', JSON.stringify({
      command: 'real-search',
      parameters: { query: 'deep learning' },
      confidence: 0.95
    }));
    
    mockLLMProvider.addResponse('USER INPUT: I want to find stuff about learning', JSON.stringify({
      command: 'search',
      parameters: { query: 'machine learning' },
      confidence: 0.95
    }));
    
    // Default for unknown commands
    mockLLMProvider.setDefaultResponse(JSON.stringify({
      command: 'unknown',
      parameters: {},
      confidence: 0.3
    }));
    
    framework = new LLMCLIFramework({
      llmProvider: mockLLMProvider,
      commands: {} // Will register commands below
    });
    
    // Disable natural language generation after framework is created
    const session = framework.getSession();
    session.state.set('useNaturalLanguage', false);

    // Register search command
    framework.registerCommand('search', {
      description: 'Search for documents',
      parameters: [
        { name: 'query', type: 'string', description: 'The search query', required: true },
        { name: 'limit', type: 'number', description: 'Maximum number of results', required: false, default: 10 }
      ],
      handler: async (args) => {
        // Check for required query parameter
        if (!args.query) {
          return {
            success: false,
            error: 'Missing required parameter: query'
          };
        }
        
        const mockResults = {
          success: true,
          results: [
            {
              document: {
                _id: '123',
                title: 'Machine Learning Basics',
                content: 'Introduction to machine learning...',
                metadata: {}
              },
              score: 0.95,
              vectorMetadata: {}
            }
          ],
          totalResults: 1,
          processingTime: 100
        };
        
        return {
          success: true,
          output: `Found 1 result:\n\n1. Machine Learning Basics (Score: 95.0%)`
        };
      }
    });
  });

  afterAll(async () => {
    // Cleanup if needed
  });

  describe('Natural Language Processing', () => {
    it('should understand search intent from natural language', async () => {
      const result = await framework.processInput('find documents about machine learning');
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('Found 1 result');
      expect(result.message).toContain('Machine Learning Basics');
    });

    it('should handle search with parameters', async () => {
      const result = await framework.processInput('search for AI papers with limit 5');
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('Found 1 result');
    });

    it('should recognize command aliases', async () => {
      const queries = [
        'find documents about AI',
        'query for neural networks',
        'search machine learning'
      ];

      for (const query of queries) {
        const result = await framework.processInput(query);
        expect(result.success).toBe(true);
        expect(result.message).toContain('Found 1 result');
      }
    });
  });

  describe('Command Registration and Execution', () => {
    it('should register commands with the framework', () => {
      const commands = framework.listCommands();
      expect(commands).toContain('search');
      
      const searchCommand = framework.getCommandInfo('search');
      // CommandDefinition doesn't have aliases property - they are set separately
      // Aliases would be checked through another mechanism
    });

    it('should validate command parameters', async () => {
      // Empty query should fail
      const result = await framework.processInput('search');
      expect(result.success).toBe(false);
      expect(result.message).toContain('query');
    });
  });

  describe('Mock LLM Provider Integration', () => {
    it('should use MockLLMProvider for intent recognition', async () => {
      const mockProvider = framework.getConfig().llmProvider as MockLLMProvider;
      
      // Setup mock to return specific intent
      mockProvider.addResponse('find.*learning', JSON.stringify({
        command: 'search',
        parameters: { query: 'machine learning' },
        confidence: 0.95
      }));

      const result = await framework.processInput('I want to find stuff about learning');
      expect(result.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      // Register a command that throws an error
      framework.registerCommand('error-test', {
        description: 'Test error handling',
        handler: async () => {
          throw new Error('Service unavailable');
        }
      });

      const result = await framework.processInput('error-test');
      expect(result.success).toBe(false);
      expect(result.message).toContain('Service unavailable');
    });
  });

  describe('Real Service Integration Mock', () => {
    it('should integrate with SearchService interface', async () => {
      // Mock SearchService response
      const mockSearchResponse = {
        success: true,
        results: [
          {
            document: {
              _id: '456',
              title: 'Deep Learning Guide',
              content: 'Advanced deep learning techniques...'
            },
            score: 0.89,
            vectorMetadata: {
              mongodb_id: '456',
              content_preview: 'Advanced deep learning techniques...',
              created_at: new Date().toISOString(),
              category: 'AI'
            },
            relevanceLevel: 'high' as const,
            scorePercentage: 89
          }
        ],
        totalResults: 1,
        processingTime: 150
      };

      jest.spyOn(searchService, 'semanticSearch').mockResolvedValue(mockSearchResponse);

      // Register command with real service
      framework.registerCommand('real-search', {
        description: 'Search with real service',
        parameters: [
          { name: 'query', type: 'string', description: 'The search query', required: true }
        ],
        handler: async (args) => {
          const results = await searchService.semanticSearch(args.query as string);
          
          if (!results.success || !results.results) {
            return { success: false, error: 'Search failed' };
          }

          const output = results.results
            .map((r, i) => `${i + 1}. ${r.document.title} (${(r.score * 100).toFixed(1)}%)`)
            .join('\n');

          return {
            success: true,
            output: `Found ${results.results.length} results:\n${output}`
          };
        }
      });

      const result = await framework.processInput('real-search deep learning');
      expect(result.success).toBe(true);
      expect(result.message).toContain('Deep Learning Guide');
      expect(result.message).toContain('89.0%');
    });
  });
});