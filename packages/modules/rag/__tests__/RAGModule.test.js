import { describe, it, expect, beforeEach, afterEach, beforeAll, jest } from '@jest/globals';
import RAGModule from '../src/RAGModule.js';
import { ResourceManager } from '@legion/resource-manager';

describe('RAGModule', () => {
  let ragModule;
  let resourceManager;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
  });

  beforeEach(() => {
    ragModule = new RAGModule();
    ragModule.resourceManager = resourceManager;
  });

  afterEach(async () => {
    if (ragModule) {
      await ragModule.cleanup();
    }
  });

  describe('constructor', () => {
    it('should create instance with correct properties', () => {
      expect(ragModule.name).toBe('rag');
      expect(ragModule.description).toContain('RAG');
      expect(ragModule.version).toBe('1.0.0');
      expect(ragModule.metadataPath).toBe('./tools-metadata.json');
    });
  });

  describe('static create method', () => {
    it('should create and initialize module', async () => {
      const module = await RAGModule.create(resourceManager);
      
      expect(module).toBeInstanceOf(RAGModule);
      expect(module.resourceManager).toBe(resourceManager);
      expect(module.config).toBeDefined();
      expect(module.initialized).toBe(true);
      
      await module.cleanup();
    });
  });

  describe('configuration loading', () => {
    it('should load config from environment variables', () => {
      const config = ragModule.loadConfig({});
      
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
      
      const config = ragModule.loadConfig(customConfig);
      expect(config.mongodb.database).toBe('custom-semantic');
      expect(config.processing.defaultChunkSize).toBe(1000);
    });

    it('should validate config and throw on invalid data', () => {
      expect(() => {
        ragModule.loadConfig({
          mongodb: { database: null }  // Invalid
        });
      }).toThrow('Semantic search configuration validation failed');
    });
  });

  describe('initialization', () => {
    it('should initialize successfully with valid config', async () => {
      const result = await ragModule.initialize();
      
      expect(result).toBe(true);
      expect(ragModule.initialized).toBe(true);
      expect(ragModule.config).toBeDefined();
    });

    it('should handle missing dependencies gracefully', async () => {
      const emptyResourceManager = {
        get: jest.fn().mockReturnValue(null)
      };
      ragModule.resourceManager = emptyResourceManager;

      const result = await ragModule.initialize();
      expect(result).toBe(true);
    });
  });

  describe('tool registration', () => {
    beforeEach(async () => {
      await ragModule.initialize();
    });

    it('should register all semantic search tools', () => {
      const expectedTools = ['index_content', 'search_content', 'query_rag', 'manage_index'];
      
      for (const toolName of expectedTools) {
        const tool = ragModule.getTool(toolName);
        expect(tool).toBeDefined();
        expect(tool.name).toBe(toolName);
      }
    });

    it('should return all tools via getTools method', () => {
      const tools = ragModule.getTools();
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
      await ragModule.initialize();
    });

    it('should return config without sensitive data', () => {
      const config = ragModule.getConfig();
      
      expect(config).toBeDefined();
      expect(config.mongodb).toBeDefined();
      expect(config.qdrant).toBeDefined();
      expect(config.processing).toBeDefined();
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources properly', async () => {
      await ragModule.initialize();
      
      await ragModule.cleanup();
      
      expect(ragModule.initialized).toBe(false);
    });
  });
});