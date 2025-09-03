import { describe, it, expect, beforeEach, afterEach, beforeAll, jest } from '@jest/globals';
import SemanticSearchModule from '../src/SemanticSearchModule.js';
import { ResourceManager } from '@legion/resource-manager';

describe('SemanticSearchModule', () => {
  let semanticSearchModule;
  let resourceManager;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
  });

  beforeEach(() => {
    semanticSearchModule = new SemanticSearchModule();
    semanticSearchModule.resourceManager = resourceManager;
  });

  afterEach(async () => {
    if (semanticSearchModule) {
      await semanticSearchModule.cleanup();
    }
  });

  describe('constructor', () => {
    it('should create instance with correct properties', () => {
      expect(semanticSearchModule.name).toBe('semantic-search');
      expect(semanticSearchModule.description).toContain('RAG-based semantic search');
      expect(semanticSearchModule.version).toBe('1.0.0');
      expect(semanticSearchModule.metadataPath).toBe('./tools-metadata.json');
    });
  });

  describe('static create method', () => {
    it('should create and initialize module', async () => {
      const module = await SemanticSearchModule.create(resourceManager);
      
      expect(module).toBeInstanceOf(SemanticSearchModule);
      expect(module.resourceManager).toBe(resourceManager);
      expect(module.config).toBeDefined();
      expect(module.initialized).toBe(true);
      
      await module.cleanup();
    });
  });

  describe('configuration loading', () => {
    it('should load config from environment variables', () => {
      const config = semanticSearchModule.loadConfig({});
      
      expect(config).toBeDefined();
      expect(config.mongodb).toBeDefined();
      expect(config.mongodb.database).toBeDefined();
      expect(config.qdrant).toBeDefined();
      expect(config.qdrant.collection).toBe('semantic_content');
      expect(config.processing).toBeDefined();
      expect(config.processing.defaultChunkSize).toBe(800);
    });

    it('should merge provided config with environment config', () => {
      const customConfig = {
        mongodb: { database: 'custom-semantic' },
        processing: { defaultChunkSize: 1000 }
      };
      
      const config = semanticSearchModule.loadConfig(customConfig);
      expect(config.mongodb.database).toBe('custom-semantic');
      expect(config.processing.defaultChunkSize).toBe(1000);
    });

    it('should validate config and throw on invalid data', () => {
      expect(() => {
        semanticSearchModule.loadConfig({
          mongodb: { database: null }  // Invalid
        });
      }).toThrow('Semantic search configuration validation failed');
    });
  });

  describe('initialization', () => {
    it('should initialize successfully with valid config', async () => {
      const result = await semanticSearchModule.initialize();
      
      expect(result).toBe(true);
      expect(semanticSearchModule.initialized).toBe(true);
      expect(semanticSearchModule.config).toBeDefined();
    });

    it('should handle missing dependencies gracefully', async () => {
      const emptyResourceManager = {
        get: jest.fn().mockReturnValue(null)
      };
      semanticSearchModule.resourceManager = emptyResourceManager;

      const result = await semanticSearchModule.initialize();
      expect(result).toBe(true);
    });
  });

  describe('tool registration', () => {
    beforeEach(async () => {
      await semanticSearchModule.initialize();
    });

    it('should register all semantic search tools', () => {
      const expectedTools = ['index_content', 'search_content', 'query_rag', 'manage_index'];
      
      for (const toolName of expectedTools) {
        const tool = semanticSearchModule.getTool(toolName);
        expect(tool).toBeDefined();
        expect(tool.name).toBe(toolName);
      }
    });

    it('should return all tools via getTools method', () => {
      const tools = semanticSearchModule.getTools();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBe(4);
      
      const toolNames = tools.map(tool => tool.name);
      expect(toolNames).toContain('index_content');
      expect(toolNames).toContain('search_content');
      expect(toolNames).toContain('query_rag');
      expect(toolNames).toContain('manage_index');
    });
  });

  describe('getConfig', () => {
    beforeEach(async () => {
      await semanticSearchModule.initialize();
    });

    it('should return config without sensitive data', () => {
      const config = semanticSearchModule.getConfig();
      
      expect(config).toBeDefined();
      expect(config.mongodb).toBeDefined();
      expect(config.qdrant).toBeDefined();
      expect(config.processing).toBeDefined();
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources properly', async () => {
      await semanticSearchModule.initialize();
      
      await semanticSearchModule.cleanup();
      
      expect(semanticSearchModule.initialized).toBe(false);
    });
  });
});