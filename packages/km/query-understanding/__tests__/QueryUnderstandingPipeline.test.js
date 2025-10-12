import { QueryUnderstandingPipeline } from '../src/QueryUnderstandingPipeline.js';

// Helper to create mock function
const mockFn = (impl) => {
  const fn = impl || (() => {});
  fn.calls = [];
  const wrapped = (...args) => {
    wrapped.calls.push(args);
    return fn(...args);
  };
  wrapped.calls = fn.calls;
  return wrapped;
};

describe('QueryUnderstandingPipeline', () => {
  describe('Constructor', () => {
    test('should throw if ResourceManager not provided', () => {
      expect(() => {
        new QueryUnderstandingPipeline();
      }).toThrow('ResourceManager is required');
    });

    test('should throw if ResourceManager is null', () => {
      expect(() => {
        new QueryUnderstandingPipeline(null);
      }).toThrow('ResourceManager is required');
    });

    test('should create instance with valid ResourceManager', () => {
      const mockRM = { get: mockFn() };
      const pipeline = new QueryUnderstandingPipeline(mockRM);

      expect(pipeline).toBeInstanceOf(QueryUnderstandingPipeline);
      expect(pipeline.resourceManager).toBe(mockRM);
      expect(pipeline.initialized).toBe(false);
    });

    test('should initialize all properties to null/false', () => {
      const mockRM = { get: mockFn() };
      const pipeline = new QueryUnderstandingPipeline(mockRM);

      expect(pipeline.initialized).toBe(false);
      expect(pipeline.phase1).toBeNull();
      expect(pipeline.phase2).toBeNull();
      expect(pipeline.phase3).toBeNull();
      expect(pipeline.phase4).toBeNull();
      expect(pipeline.llmClient).toBeNull();
      expect(pipeline.semanticSearch).toBeNull();
      expect(pipeline.ontology).toBeNull();
      expect(pipeline.dataSource).toBeNull();
    });
  });

  describe('initialize()', () => {
    test('should throw if LLM client not available', async () => {
      const mockRM = {
        get: mockFn(async (key) => {
          if (key === 'llmClient') return null;
          return {}; // Other resources available
        })
      };

      const pipeline = new QueryUnderstandingPipeline(mockRM);

      await expect(pipeline.initialize()).rejects.toThrow(
        'LLM client not available in ResourceManager - required for Phase 1'
      );
    });

    test('should throw if semantic search not available', async () => {
      const mockRM = {
        get: mockFn(async (key) => {
          if (key === 'llmClient') return {};
          if (key === 'semanticSearch') return null;
          return {};
        })
      };

      const pipeline = new QueryUnderstandingPipeline(mockRM);

      await expect(pipeline.initialize()).rejects.toThrow(
        'Semantic search not available in ResourceManager - required for Phase 3'
      );
    });

    test('should throw if ontology not available', async () => {
      const mockRM = {
        get: mockFn(async (key) => {
          if (key === 'llmClient') return {};
          if (key === 'semanticSearch') return {};
          if (key === 'ontology') return null;
          return {};
        })
      };

      const pipeline = new QueryUnderstandingPipeline(mockRM);

      await expect(pipeline.initialize()).rejects.toThrow(
        'Ontology not available in ResourceManager - required for Phase 3'
      );
    });

    test('should throw if DataSource not available', async () => {
      const mockRM = {
        get: mockFn(async (key) => {
          if (key === 'llmClient') return {};
          if (key === 'semanticSearch') return {};
          if (key === 'ontology') return {};
          if (key === 'dataStoreDataSource') return null;
          return {};
        })
      };

      const pipeline = new QueryUnderstandingPipeline(mockRM);

      await expect(pipeline.initialize()).rejects.toThrow(
        "DataSource 'dataStoreDataSource' not available in ResourceManager - required for Phase 4"
      );
    });

    test('should throw if DataSource does not implement query method', async () => {
      const mockRM = {
        get: mockFn(async (key) => {
          if (key === 'llmClient') return {};
          if (key === 'semanticSearch') return {};
          if (key === 'ontology') return {};
          if (key === 'dataStoreDataSource') return {}; // No query method!
          return {};
        })
      };

      const pipeline = new QueryUnderstandingPipeline(mockRM);

      await expect(pipeline.initialize()).rejects.toThrow(
        "DataSource 'dataStoreDataSource' does not implement required query() method"
      );
    });

    test('should initialize successfully with all dependencies available', async () => {
      const mockLLMClient = { generate: mockFn() };
      const mockSemanticSearch = { search: mockFn() };
      const mockOntology = { getClasses: mockFn() };
      const mockDataSource = { query: mockFn() };

      const mockRM = {
        get: mockFn(async (key) => {
          if (key === 'llmClient') return mockLLMClient;
          if (key === 'semanticSearch') return mockSemanticSearch;
          if (key === 'ontology') return mockOntology;
          if (key === 'dataStoreDataSource') return mockDataSource;
          return null;
        })
      };

      const pipeline = new QueryUnderstandingPipeline(mockRM);
      await pipeline.initialize();

      expect(pipeline.initialized).toBe(true);
      expect(pipeline.llmClient).toBe(mockLLMClient);
      expect(pipeline.semanticSearch).toBe(mockSemanticSearch);
      expect(pipeline.ontology).toBe(mockOntology);
      expect(pipeline.dataSource).toBe(mockDataSource);
      expect(pipeline.config).toEqual({
        dataSourceName: 'dataStoreDataSource',
        domain: null
      });
    });

    test('should accept custom dataSource option', async () => {
      const mockDataSource = { query: mockFn() };

      const mockRM = {
        get: mockFn(async (key) => {
          if (key === 'llmClient') return {};
          if (key === 'semanticSearch') return {};
          if (key === 'ontology') return {};
          if (key === 'tripleStoreDataSource') return mockDataSource;
          return null;
        })
      };

      const pipeline = new QueryUnderstandingPipeline(mockRM);
      await pipeline.initialize({ dataSource: 'tripleStoreDataSource' });

      expect(pipeline.dataSource).toBe(mockDataSource);
      expect(pipeline.config.dataSourceName).toBe('tripleStoreDataSource');
    });

    test('should accept domain hint option', async () => {
      const mockRM = {
        get: mockFn(async (key) => {
          if (key === 'llmClient') return {};
          if (key === 'semanticSearch') return {};
          if (key === 'ontology') return {};
          if (key === 'dataStoreDataSource') return { query: mockFn() };
          return null;
        })
      };

      const pipeline = new QueryUnderstandingPipeline(mockRM);
      await pipeline.initialize({ domain: 'finance' });

      expect(pipeline.config.domain).toBe('finance');
    });
  });

  describe('process()', () => {
    let pipeline;
    let mockRM;

    beforeEach(() => {
      mockRM = {
        get: mockFn(async (key) => {
          if (key === 'llmClient') return {};
          if (key === 'semanticSearch') return {};
          if (key === 'ontology') return {};
          if (key === 'dataStoreDataSource') return { query: mockFn() };
          return null;
        })
      };

      pipeline = new QueryUnderstandingPipeline(mockRM);
    });

    test('should throw if pipeline not initialized', async () => {
      await expect(pipeline.process('what is the capital of France?'))
        .rejects.toThrow('Pipeline not initialized - call initialize() first');
    });

    test('should throw if question is not provided', async () => {
      await pipeline.initialize();

      await expect(pipeline.process())
        .rejects.toThrow('Question must be a non-empty string');
    });

    test('should throw if question is empty string', async () => {
      await pipeline.initialize();

      await expect(pipeline.process(''))
        .rejects.toThrow('Question must be a non-empty string');
    });

    test('should throw if question is only whitespace', async () => {
      await pipeline.initialize();

      await expect(pipeline.process('   '))
        .rejects.toThrow('Question must be a non-empty string');
    });

    test('should throw if question is not a string', async () => {
      await pipeline.initialize();

      await expect(pipeline.process(123))
        .rejects.toThrow('Question must be a non-empty string');

      await expect(pipeline.process(null))
        .rejects.toThrow('Question must be a non-empty string');

      await expect(pipeline.process({}))
        .rejects.toThrow('Question must be a non-empty string');
    });

    test('should throw not implemented error for now', async () => {
      await pipeline.initialize();

      // Until phases are implemented, this should throw
      await expect(pipeline.process('what is the capital of France?'))
        .rejects.toThrow('Pipeline processing not yet implemented');
    });
  });

  describe('isReady()', () => {
    test('should return false if not initialized', () => {
      const mockRM = { get: mockFn() };
      const pipeline = new QueryUnderstandingPipeline(mockRM);

      expect(pipeline.isReady()).toBe(false);
    });

    test('should return true after successful initialization', async () => {
      const mockRM = {
        get: mockFn(async (key) => {
          if (key === 'llmClient') return {};
          if (key === 'semanticSearch') return {};
          if (key === 'ontology') return {};
          if (key === 'dataStoreDataSource') return { query: mockFn() };
          return null;
        })
      };

      const pipeline = new QueryUnderstandingPipeline(mockRM);
      expect(pipeline.isReady()).toBe(false);

      await pipeline.initialize();
      expect(pipeline.isReady()).toBe(true);
    });
  });

  describe('getStatus()', () => {
    test('should return status for uninitialized pipeline', () => {
      const mockRM = { get: mockFn() };
      const pipeline = new QueryUnderstandingPipeline(mockRM);

      const status = pipeline.getStatus();

      expect(status).toEqual({
        initialized: false,
        ready: false,
        config: null,
        dependencies: {
          llmClient: false,
          semanticSearch: false,
          ontology: false,
          dataSource: false
        }
      });
    });

    test('should return status for initialized pipeline', async () => {
      const mockRM = {
        get: mockFn(async (key) => {
          if (key === 'llmClient') return {};
          if (key === 'semanticSearch') return {};
          if (key === 'ontology') return {};
          if (key === 'dataStoreDataSource') return { query: mockFn() };
          return null;
        })
      };

      const pipeline = new QueryUnderstandingPipeline(mockRM);
      await pipeline.initialize({ domain: 'geography' });

      const status = pipeline.getStatus();

      expect(status).toEqual({
        initialized: true,
        ready: true,
        config: {
          dataSourceName: 'dataStoreDataSource',
          domain: 'geography'
        },
        dependencies: {
          llmClient: true,
          semanticSearch: true,
          ontology: true,
          dataSource: true
        }
      });
    });
  });

  describe('FAIL FAST behavior', () => {
    test('should throw immediately on missing ResourceManager', () => {
      expect(() => new QueryUnderstandingPipeline()).toThrow();
    });

    test('should throw immediately on missing LLM client during init', async () => {
      const mockRM = {
        get: mockFn(async () => null)
      };

      const pipeline = new QueryUnderstandingPipeline(mockRM);

      // Should fail fast, not continue with initialization
      await expect(pipeline.initialize()).rejects.toThrow();
      expect(pipeline.initialized).toBe(false);
    });

    test('should throw immediately if process called before init', async () => {
      const mockRM = { get: mockFn() };
      const pipeline = new QueryUnderstandingPipeline(mockRM);

      // Should fail fast
      await expect(pipeline.process('test')).rejects.toThrow('Pipeline not initialized');
    });
  });
});
